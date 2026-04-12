"""
Bengali Math PDF → Excel Extractor — Gemini only (google-genai SDK)

Reads a textbook PDF, detects chapters, then extracts every question into a
single Excel file with the following columns:

    chapter     — chapter title (Bengali)
    question    — full question text (Bengali)
    answer      — answer (string or blank for open-ended)
    category    — "short" | "medium" | "long"  (expected answer length/type)
    complexity  — "easy" | "medium" | "complex"
    solution    — step-by-step solution IF the book provides one (else empty)

NOTE: No solutions are generated — only extracted verbatim from the book.

Configuration via .env (same keys as pdf_extractor.py):
    GOOGLE_API_KEY   = <your key>
    PDF_PATH         = path/to/book.pdf
    CLASS_ID         = 6
    OUTPUT_DIR       = output          (optional, default: ./output)
    GEMINI_MODEL     = gemini-2.5-flash (optional)
    USE_FILE_API     = false            (optional)
"""

import json
import os
import re
import time
from pathlib import Path

import fitz  # PyMuPDF
from dotenv import load_dotenv

load_dotenv()

COLUMNS = ["chapter", "question", "answer", "category", "complexity", "solution"]


# ---------------------------------------------------------------------------
# ExcelExtractor
# ---------------------------------------------------------------------------
class ExcelExtractor:
    """
    Extract ALL questions from a Bengali math textbook PDF and save to Excel.

    Extraction strategy (most robust → least):
      1. Ask Gemini for JSON  →  try to parse (with repair)
      2. If JSON fails        →  retry with a pipe-delimited plain-text prompt
      3. Rows are written to Excel incrementally — a chapter failure never
         loses rows already collected.
    """

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not set in .env or passed as api_key=")
        self.model_name = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract_to_excel(
        self,
        pdf_path: str = None,
        class_id: int = None,
        output_dir: str = None,
        use_file_api: bool = None,
        output_filename: str = None,
    ) -> str:
        """
        Extract the full textbook into a single Excel file.
        Returns the path of the saved .xlsx file.
        """
        pdf_path   = pdf_path   or os.getenv("PDF_PATH")
        class_id   = class_id   or int(os.getenv("CLASS_ID", 0))
        output_dir = output_dir or os.getenv("OUTPUT_DIR", "output")
        if use_file_api is None:
            use_file_api = os.getenv("USE_FILE_API", "false").lower() == "true"

        if not pdf_path or not Path(pdf_path).exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path!r}. Set PDF_PATH in .env")
        if not class_id:
            raise ValueError("CLASS_ID not set in .env or passed as class_id=")

        Path(output_dir).mkdir(parents=True, exist_ok=True)

        print(f"\n📚 Book  : {pdf_path}")
        print(f"🎓 Class : {class_id} | Model: {self.model_name} | mode: {'file-api' if use_file_api else 'image'}\n")

        # Phase 1 — detect chapters
        chapters_meta = self.detect_chapters(pdf_path)
        print(f"📑 Detected {len(chapters_meta)} chapter(s):\n")
        for ch in chapters_meta:
            print(f"   Ch{ch['chapter_num']:>2}  pages {ch['start_page']}-{ch['end_page']}  {ch['title']}")

        # Phase 2 — extract rows per chapter and write Excel incrementally
        filename = output_filename or f"class_{class_id}_questions.xlsx"
        out_path = Path(output_dir) / filename

        all_rows: list[dict] = []
        for ch in chapters_meta:
            print(f"\n── Extracting chapter {ch['chapter_num']}: {ch['title']} ──")
            try:
                rows = self._extract_chapter_rows(pdf_path, ch, use_file_api)
                all_rows.extend(rows)
                print(f"   ✅ {len(rows)} question(s) extracted  (total so far: {len(all_rows)})")
            except Exception as exc:
                print(f"   ❌ Chapter {ch['chapter_num']} skipped: {exc}")

            # Save after each chapter so partial results survive crashes
            if all_rows:
                self._save_excel(all_rows, out_path, silent=True)

        self._save_excel(all_rows, out_path)
        print(f"\n✅ Done. {len(all_rows)} question(s) saved → {out_path}")
        return str(out_path)

    def detect_chapters(self, pdf_path: str) -> list[dict]:
        """Phase 1: ask Gemini for chapter list with page ranges."""
        print("🔍 Phase 1: detecting chapter structure …")
        raw = self._call_with_images(pdf_path, self._chapter_detection_prompt(), dpi=100)
        chapters = self._parse_json_robust(raw)
        if not isinstance(chapters, list) or not chapters:
            raise ValueError("Gemini did not return a valid chapter list.")
        chapters.sort(key=lambda c: c.get("chapter_num", 0))

        # Fix end pages: chapter N ends on the page before chapter N+1 starts.
        # This is more reliable than trusting Gemini's end_page values.
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        doc.close()
        for i, ch in enumerate(chapters):
            if i + 1 < len(chapters):
                ch["end_page"] = chapters[i + 1]["start_page"] - 1
            else:
                ch["end_page"] = total_pages

        return chapters

    # ------------------------------------------------------------------
    # Internal extraction — JSON first, pipe-text fallback
    # ------------------------------------------------------------------

    def _extract_chapter_rows(
        self, pdf_path: str, chapter_meta: dict, use_file_api: bool
    ) -> list[dict]:
        """
        Try JSON prompt → parse.  If that fails, retry with pipe-delimited
        plain-text prompt → parse.  Returns normalised row dicts.
        """
        # --- attempt 1: JSON ---
        raw = self._call_chapter(pdf_path, chapter_meta, use_file_api,
                                 self._json_extraction_prompt(chapter_meta))
        rows, err = self._try_parse_json_rows(raw, chapter_meta["title"])
        if rows is not None:
            return rows

        print(f"   ⚠  JSON parse failed ({err}), retrying with text format …")

        # --- attempt 2: pipe-delimited text ---
        raw2 = self._call_chapter(pdf_path, chapter_meta, use_file_api,
                                  self._text_extraction_prompt(chapter_meta))
        rows2 = self._parse_pipe_text(raw2, chapter_meta["title"])
        if rows2:
            return rows2

        print(f"   ⚠  Text parse also failed — chapter skipped")
        return []

    def _try_parse_json_rows(self, raw: str, chapter_title: str):
        """
        Returns (rows, None) on success or (None, error_str) on failure.
        Tries json.loads → json-repair fallback.
        """
        try:
            data = self._parse_json_robust(raw)
        except Exception as e:
            return None, str(e)

        if isinstance(data, dict):
            data = [data]
        if not isinstance(data, list):
            return None, "Not a list"

        return self._normalise_rows(data, chapter_title), None

    def _normalise_rows(self, data: list, chapter_title: str) -> list[dict]:
        rows = []
        for r in data:
            if not isinstance(r, dict):
                continue
            q = str(r.get("question", "")).strip()
            if not q:
                continue
            rows.append({
                "chapter":    chapter_title,
                "question":   q,
                "answer":     str(r.get("answer", "")).strip(),
                "category":   _normalise_category(r.get("category", "short")),
                "complexity": _normalise_complexity(r.get("complexity", "easy")),
                "solution":   str(r.get("solution", "")).strip(),
            })
        return rows

    def _parse_pipe_text(self, raw: str, chapter_title: str) -> list[dict]:
        """
        Parse pipe-delimited lines produced by _text_extraction_prompt.
        Expected format (one question per line):
            question|answer|category|complexity|solution
        """
        rows = []
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("|")
            if len(parts) < 2:
                continue
            # Pad to 5 fields
            while len(parts) < 5:
                parts.append("")
            q = parts[0].strip()
            if not q:
                continue
            rows.append({
                "chapter":    chapter_title,
                "question":   q,
                "answer":     parts[1].strip(),
                "category":   _normalise_category(parts[2].strip()),
                "complexity": _normalise_complexity(parts[3].strip()),
                "solution":   parts[4].strip(),
            })
        return rows

    # ------------------------------------------------------------------
    # Gemini call helpers
    # ------------------------------------------------------------------

    def _make_client(self):
        from google import genai
        return genai.Client(api_key=self.api_key)

    def _pages_to_image_parts(self, pdf_path: str, start_page: int, end_page: int, dpi: int = 200) -> list:
        from google.genai import types

        doc = fitz.open(pdf_path)
        total = len(doc)
        s = max(0, start_page - 1)
        e = min(total, end_page)
        parts = []
        for page_num in range(s, e):
            page = doc.load_page(page_num)
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            parts.append(types.Part.from_bytes(data=pix.tobytes("png"), mime_type="image/png"))
        doc.close()
        return parts

    def _call_with_images(self, pdf_path: str, prompt: str, dpi: int = 200) -> str:
        from google.genai import types

        doc = fitz.open(pdf_path)
        total = len(doc)
        doc.close()
        parts = self._pages_to_image_parts(pdf_path, 1, total, dpi)
        print(f"   ↳ sending {len(parts)} page(s) as images")
        return self._call_gemini(parts + [types.Part.from_text(text=prompt)])

    def _call_chapter(
        self, pdf_path: str, chapter_meta: dict, use_file_api: bool, prompt: str
    ) -> str:
        if use_file_api:
            return self._call_chapter_file_api(pdf_path, chapter_meta, prompt)
        return self._call_chapter_images(pdf_path, chapter_meta, prompt)

    def _call_chapter_images(self, pdf_path: str, chapter_meta: dict, prompt: str) -> str:
        from google.genai import types

        parts = self._pages_to_image_parts(
            pdf_path, chapter_meta["start_page"], chapter_meta["end_page"]
        )
        print(f"   ↳ sending pages {chapter_meta['start_page']}–{chapter_meta['end_page']} ({len(parts)} image(s))")
        return self._call_gemini(parts + [types.Part.from_text(text=prompt)])

    def _call_chapter_file_api(self, pdf_path: str, chapter_meta: dict, prompt: str) -> str:
        from google import genai
        from google.genai import types
        import tempfile

        src = fitz.open(pdf_path)
        tmp_doc = fitz.open()
        s = chapter_meta["start_page"] - 1
        e = chapter_meta["end_page"]
        tmp_doc.insert_pdf(src, from_page=s, to_page=e - 1)
        src.close()

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name
        tmp_doc.save(tmp_path)
        tmp_doc.close()

        try:
            client = self._make_client()
            print(f"   ↳ uploading chapter PDF (pages {chapter_meta['start_page']}–{chapter_meta['end_page']}) …")
            uploaded = client.files.upload(
                file=tmp_path,
                config=types.UploadFileConfig(mime_type="application/pdf"),
            )
            while uploaded.state.name == "PROCESSING":
                time.sleep(2)
                uploaded = client.files.get(name=uploaded.name)
            if uploaded.state.name == "FAILED":
                raise RuntimeError(f"File upload failed: {uploaded.name}")

            response = client.models.generate_content(
                model=self.model_name,
                contents=[
                    types.Part.from_uri(file_uri=uploaded.uri, mime_type="application/pdf"),
                    types.Part.from_text(text=prompt),
                ],
                config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=8192),
            )
            try:
                client.files.delete(name=uploaded.name)
            except Exception:
                pass
            return response.text
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    def _call_gemini(self, contents: list) -> str:
        from google.genai import types

        client = self._make_client()
        response = client.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=8192),
        )
        return response.text

    # ------------------------------------------------------------------
    # Prompts
    # ------------------------------------------------------------------

    def _chapter_detection_prompt(self) -> str:
        return """
You are analysing a Bengali mathematics textbook PDF.
Identify every chapter. Return ONLY a JSON array — no markdown, no explanation:

[
  {"chapter_num": 1, "title": "<Bengali title>", "start_page": 10, "end_page": 24},
  {"chapter_num": 2, "title": "<Bengali title>", "start_page": 25, "end_page": 40}
]

RULES:
- chapter_num is an integer starting from 1
- start_page is the page where the chapter heading first appears (1-based)
- end_page is the LAST page of that chapter — which is exactly one page before the next chapter's start_page
  Example: if chapter 1 starts at page 10 and chapter 2 starts at page 25, then chapter 1 end_page = 24
- The last chapter ends at the last page of the book
- title must be in Bengali script as printed in the book
- Do NOT include front matter, index, or appendix as chapters
- Output strictly valid JSON — no trailing commas, no markdown fences
"""

    def _json_extraction_prompt(self, chapter_meta: dict) -> str:
        ch_title = chapter_meta["title"]
        start_page = chapter_meta["start_page"]
        end_page = chapter_meta["end_page"]
        return f"""
You are a meticulous Bengali mathematics textbook analyser.
Chapter: "{ch_title}" (pages {start_page}–{end_page})

Your task: READ EVERY PAGE carefully, word by word, and extract EVERY question without missing a single one.

━━━ WHAT COUNTS AS A QUESTION ━━━
Go through each page in order and capture ALL of the following:

1. NUMBERED EXERCISES — any numbered or lettered item inside exercise boxes (অনুশীলনী / Practice sets).
   Example: ১. ২৩৪ × ৪৫ = কত?

2. FILL-IN-THE-BLANK — sentences with blanks (____) or boxes (□).
   Convert to a proper question: "নিচের ফাঁকা ঘরটি পূরণ করো: ২৩ + ___ = ৫০"

3. TRUE/FALSE — items asking to determine if a statement is correct (সত্য/মিথ্যা).
   Write the full statement as the question.

4. EXAMPLES (উদাহরণ) — worked example problems.
   Extract the PROBLEM STATEMENT as the question.
   Copy the printed step-by-step solution verbatim into "solution".

5. WORD PROBLEMS / APPLICATION PROBLEMS — multi-sentence story problems.
   Include the complete problem text.

6. MATCH THE FOLLOWING, MCQ, IDENTIFY THE ERROR — any such items per question/row.

7. DIAGRAMS / FIGURES — if a question refers to a figure, describe the figure briefly in Bengali and include the question.

━━━ STRICT EXTRACTION RULES ━━━
A. Scan page by page. Do NOT skip any page or section.
B. Keep ALL text in Bengali (বাংলা) script exactly as printed — do NOT translate.
C. For exercises with sub-parts (a, b, c… or i, ii, iii…), create ONE row per sub-part.
D. Include the full context: if the question stem is shared across sub-parts, prepend it to each sub-part.
E. "answer" → copy the printed final answer (উত্তর) if given in the book; otherwise leave empty string.
F. "solution" → copy verbatim ONLY if the book prints worked steps (only for উদাহরণ); otherwise empty string. NEVER invent or generate a solution.
G. Do NOT duplicate questions that appear identically on multiple pages.

━━━ FIELD CLASSIFICATION ━━━
category:
  "short"   — single-step calculation, fill-in-blank, true/false, one-line answer
  "medium"  — 2–4 step problems, short word problems
  "long"    — multi-step, proof, lengthy word problem, construction

complexity:
  "easy"    — direct recall or single operation
  "medium"  — requires 2–3 logical steps
  "complex" — multi-concept, proof, or real-world application

━━━ OUTPUT FORMAT ━━━
Return ONLY a JSON array. No markdown fences. No explanation. No trailing commas.

[
  {{
    "question":   "<complete question text in Bengali>",
    "answer":     "<printed answer or empty string>",
    "category":   "short|medium|long",
    "complexity": "easy|medium|complex",
    "solution":   "<verbatim printed worked steps for উদাহরণ, else empty string>"
  }}
]

FINAL CHECK before outputting: count the questions you found. If the chapter has exercise sets,
make sure you have captured every numbered item from every exercise set. If any seem missing, add them.
"""

    def _text_extraction_prompt(self, chapter_meta: dict) -> str:
        ch_title = chapter_meta["title"]
        start_page = chapter_meta["start_page"]
        end_page = chapter_meta["end_page"]
        return f"""
You are a meticulous Bengali mathematics textbook analyser.
Chapter: "{ch_title}" (pages {start_page}–{end_page})

READ EVERY PAGE carefully and extract EVERY question without missing a single one.

━━━ WHAT COUNTS AS A QUESTION ━━━
1. NUMBERED EXERCISES — every numbered/lettered item in exercise boxes (অনুশীলনী).
2. FILL-IN-THE-BLANK — convert blanks (____/□) to a proper question sentence.
3. TRUE/FALSE — write the full statement as the question.
4. EXAMPLES (উদাহরণ) — extract the problem statement; copy printed solution steps into the solution field.
5. WORD PROBLEMS — include the complete multi-sentence text.
6. MCQ / MATCH / ERROR-FINDING — one row per item.
7. For sub-parts (a/b/c or i/ii/iii), create ONE row per sub-part, including the shared stem.

━━━ RULES ━━━
- Scan page by page — do NOT skip any page or section.
- Keep ALL text in Bengali script exactly as printed.
- "answer": copy printed final answer if given; else leave empty.
- "solution": copy verbatim printed steps ONLY for উদাহরণ; NEVER generate or invent.
- Do NOT use pipe (|) inside any field — replace with a space if needed.
- Do NOT add headers, numbering, or extra lines.

Output ONE question per line:
question|answer|category|complexity|solution

category  : short OR medium OR long
complexity: easy OR medium OR complex

Example lines:
২৩৪ × ৪৫ = কত?|১০৫৩০|short|easy|
একটি আয়তক্ষেত্রের দৈর্ঘ্য ১২ সেমি ও প্রস্থ ৮ সেমি। ক্ষেত্রফল নির্ণয় করো।|৯৬ বর্গ সেমি|medium|easy|

FINAL CHECK: verify you have captured every numbered item from every exercise set before outputting.
"""

    # ------------------------------------------------------------------
    # Robust JSON parsing
    # ------------------------------------------------------------------

    def _parse_json_robust(self, text: str):
        """
        Try to parse JSON with increasingly aggressive repair strategies.
        Raises json.JSONDecodeError if all strategies fail.
        """
        text = text.strip()
        # Strip markdown fences
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text.strip())
        text = text.strip()

        # Strategy 1: parse as-is
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strategy 2: try json_repair library if available
        try:
            from json_repair import repair_json  # pip install json-repair
            repaired = repair_json(text)
            return json.loads(repaired)
        except (ImportError, json.JSONDecodeError, Exception):
            pass

        # Strategy 3: manual repairs
        fixed = text
        # Remove trailing commas before } or ]
        fixed = re.sub(r",\s*([}\]])", r"\1", fixed)
        # Replace single-quoted strings with double-quoted (simple cases)
        fixed = re.sub(r"'([^']*)'", r'"\1"', fixed)
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass

        # Strategy 4: extract the largest valid JSON array we can find
        match = re.search(r"\[.*\]", fixed, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        # Strategy 5: collect individually valid JSON objects from the text
        objects = re.findall(r'\{[^{}]*\}', fixed)
        collected = []
        for obj in objects:
            try:
                collected.append(json.loads(obj))
            except json.JSONDecodeError:
                continue
        if collected:
            return collected

        # All strategies failed — raise original error
        return json.loads(text)

    # ------------------------------------------------------------------
    # Excel output
    # ------------------------------------------------------------------

    def _save_excel(self, rows: list[dict], out_path: Path, silent: bool = False) -> None:
        try:
            import pandas as pd
        except ImportError:
            raise ImportError("pandas is required: pip install pandas openpyxl")

        df = pd.DataFrame(rows, columns=COLUMNS)
        with pd.ExcelWriter(str(out_path), engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Questions")
            ws = writer.sheets["Questions"]
            col_widths = {
                "chapter": 30, "question": 60, "answer": 30,
                "category": 12, "complexity": 12, "solution": 80,
            }
            for col_name, width in col_widths.items():
                col_idx = df.columns.get_loc(col_name) + 1
                col_letter = ws.cell(row=1, column=col_idx).column_letter
                ws.column_dimensions[col_letter].width = width

        if not silent:
            print(f"   💾 Saved → {out_path}")


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _normalise_category(value: str) -> str:
    v = str(value).strip().lower()
    if v in ("long", "লম্বা", "দীর্ঘ"):
        return "long"
    if v in ("medium", "মাঝারি"):
        return "medium"
    return "short"


def _normalise_complexity(value: str) -> str:
    v = str(value).strip().lower()
    if v in ("complex", "hard", "কঠিন", "জটিল"):
        return "complex"
    if v in ("medium", "মাঝারি"):
        return "medium"
    return "easy"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    extractor = ExcelExtractor()
    extractor.extract_to_excel()


if __name__ == "__main__":
    main()
