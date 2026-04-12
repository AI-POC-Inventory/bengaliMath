"""
Bengali Math PDF → Excel Extractor — Claude (Anthropic SDK)

Reads a textbook PDF, detects chapters, then extracts every question into a
single Excel file with the following columns:

    chapter     — chapter title (Bengali)
    question    — full question text (Bengali)
    answer      — answer (string or blank for open-ended)
    category    — "short" | "medium" | "long"  (expected answer length/type)
    complexity  — "easy" | "medium" | "complex"
    solution    — step-by-step solution IF the book provides one (else empty)

NOTE: No solutions are generated — only extracted verbatim from the book.

Configuration via .env:
    ANTHROPIC_API_KEY = <your key>
    PDF_PATH          = path/to/book.pdf
    CLASS_ID          = 6
    OUTPUT_DIR        = output              (optional, default: ./output)
    CLAUDE_MODEL      = claude-opus-4-6    (optional)
"""

import base64
import json
import os
import re
from pathlib import Path

import fitz  # PyMuPDF
from dotenv import load_dotenv

load_dotenv()

COLUMNS = ["chapter", "question", "answer", "category", "complexity", "solution"]

# Pages sent per API call when a chapter is large (Claude handles up to ~20 images well)
PAGE_BATCH_SIZE = 20


# ---------------------------------------------------------------------------
# ExcelExtractor
# ---------------------------------------------------------------------------
class ExcelExtractor:
    """
    Extract ALL questions from a Bengali math textbook PDF and save to Excel.

    Extraction strategy (most robust → least):
      1. Ask Claude for JSON  →  try to parse (with repair)
      2. If JSON fails        →  retry with a pipe-delimited plain-text prompt
      3. Rows are written to Excel incrementally — a chapter failure never
         loses rows already collected.
    """

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not set in .env or passed as api_key=")
        self.model_name = model or os.getenv("CLAUDE_MODEL", "claude-opus-4-6")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract_to_excel(
        self,
        pdf_path: str = None,
        class_id: int = None,
        output_dir: str = None,
        output_filename: str = None,
        only_chapters: list[int] = None,
    ) -> str:
        """
        Extract the full textbook into a single Excel file.
        Returns the path of the saved .xlsx file.

        only_chapters: if provided, only extract those chapter numbers.
                       e.g. only_chapters=[2] to test chapter 2 only.
        """
        pdf_path   = pdf_path   or os.getenv("PDF_PATH")
        class_id   = class_id   or int(os.getenv("CLASS_ID", 0))
        output_dir = output_dir or os.getenv("OUTPUT_DIR", "output")

        if not pdf_path or not Path(pdf_path).exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path!r}. Set PDF_PATH in .env")
        if not class_id:
            raise ValueError("CLASS_ID not set in .env or passed as class_id=")

        Path(output_dir).mkdir(parents=True, exist_ok=True)

        print(f"\n📚 Book  : {pdf_path}")
        print(f"🎓 Class : {class_id} | Model: {self.model_name}\n")

        # Phase 1 — detect chapters
        chapters_meta = self.detect_chapters(pdf_path)
        print(f"📑 Detected {len(chapters_meta)} chapter(s):\n")
        for ch in chapters_meta:
            print(f"   Ch{ch['chapter_num']:>2}  pages {ch['start_page']}-{ch['end_page']}  {ch['title']}")

        # Apply chapter filter (for testing)
        if only_chapters:
            chapters_meta = [ch for ch in chapters_meta if ch["chapter_num"] in only_chapters]
            print(f"\n⚡ Test mode — extracting only chapter(s): {only_chapters}")

        # Phase 2 — extract rows per chapter and write Excel incrementally
        suffix = f"_ch{'_'.join(str(c) for c in only_chapters)}" if only_chapters else ""
        filename = output_filename or f"class_{class_id}_questions{suffix}.xlsx"
        out_path = Path(output_dir) / filename

        all_rows: list[dict] = []
        for ch in chapters_meta:
            print(f"\n── Extracting chapter {ch['chapter_num']}: {ch['title']} ──")
            try:
                rows = self._extract_chapter_rows(pdf_path, ch)
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
        """
        Phase 1: extract text from the PDF and ask Claude for chapter list.
        Using text (not images) avoids the 413 request-too-large error for
        large PDFs while still giving Claude enough signal to find chapter headings.
        """
        print("🔍 Phase 1: detecting chapter structure …")

        doc = fitz.open(pdf_path)
        total_pages = len(doc)

        # Build a compact page-index: "PAGE 1:\n<text>\nPAGE 2:\n<text>…"
        # We only keep the first 300 chars per page — enough to spot headings.
        lines = []
        for i in range(total_pages):
            page_text = doc[i].get_text("text").strip()
            snippet = page_text[:300].replace("\n", " ")
            lines.append(f"PAGE {i + 1}: {snippet}")
        doc.close()

        page_index = "\n".join(lines)
        print(f"   ↳ sending text index of {total_pages} pages for chapter detection")

        content = [
            {"type": "text", "text": page_index},
            {"type": "text", "text": self._chapter_detection_prompt()},
        ]
        raw = self._call_claude(content, max_tokens=4096)

        chapters = self._parse_json_robust(raw)
        if not isinstance(chapters, list) or not chapters:
            raise ValueError("Claude did not return a valid chapter list.")
        chapters.sort(key=lambda c: c.get("chapter_num", 0))

        # Fix end pages: chapter N ends on the page before chapter N+1 starts.
        for i, ch in enumerate(chapters):
            if i + 1 < len(chapters):
                ch["end_page"] = chapters[i + 1]["start_page"] - 1
            else:
                ch["end_page"] = total_pages

        return chapters

    # ------------------------------------------------------------------
    # Internal extraction — JSON first, pipe-text fallback
    # ------------------------------------------------------------------

    def _extract_chapter_rows(self, pdf_path: str, chapter_meta: dict) -> list[dict]:
        """
        Try JSON prompt → parse.  If that fails, retry with pipe-delimited
        plain-text prompt → parse.  Returns normalised row dicts.
        """
        # --- attempt 1: JSON ---
        raw = self._call_chapter(pdf_path, chapter_meta, self._json_extraction_prompt(chapter_meta))
        rows, err = self._try_parse_json_rows(raw, chapter_meta["title"])
        if rows is not None:
            return rows

        print(f"   ⚠  JSON parse failed ({err}), retrying with text format …")

        # --- attempt 2: pipe-delimited text ---
        raw2 = self._call_chapter(pdf_path, chapter_meta, self._text_extraction_prompt(chapter_meta))
        rows2 = self._parse_pipe_text(raw2, chapter_meta["title"])
        if rows2:
            return rows2

        print(f"   ⚠  Text parse also failed — chapter skipped")
        return []

    def _try_parse_json_rows(self, raw: str, chapter_title: str):
        """Returns (rows, None) on success or (None, error_str) on failure."""
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
    # Claude call helpers
    # ------------------------------------------------------------------

    def _make_client(self):
        import anthropic
        return anthropic.Anthropic(api_key=self.api_key)

    def _pdf_pages_to_base64(
        self, pdf_path: str, start_page: int, end_page: int, dpi: int = 200
    ) -> list[dict]:
        """
        Render PDF pages as PNG images and return a list of Claude image
        content blocks (base64-encoded).
        """
        doc = fitz.open(pdf_path)
        total = len(doc)
        s = max(0, start_page - 1)
        e = min(total, end_page)
        blocks = []
        for page_num in range(s, e):
            page = doc.load_page(page_num)
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            b64 = base64.standard_b64encode(pix.tobytes("png")).decode("utf-8")
            blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": b64,
                },
            })
        doc.close()
        return blocks

    def _call_claude(self, content_blocks: list, max_tokens: int = 8192) -> str:
        """Send a list of content blocks to Claude and return the response text."""
        client = self._make_client()
        response = client.messages.create(
            model=self.model_name,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": content_blocks}],
        )
        return response.content[0].text

    def _call_chapter(self, pdf_path: str, chapter_meta: dict, prompt: str) -> str:
        """
        Send chapter pages to Claude for question extraction.
        If the chapter has more than PAGE_BATCH_SIZE pages, split into batches
        and merge results.
        """
        start = chapter_meta["start_page"]
        end   = chapter_meta["end_page"]
        total_pages = end - start + 1

        if total_pages <= PAGE_BATCH_SIZE:
            return self._call_chapter_single(pdf_path, start, end, prompt)

        # Large chapter: split into batches and combine raw responses
        print(f"   ↳ chapter has {total_pages} pages — splitting into batches of {PAGE_BATCH_SIZE}")
        combined_rows: list[dict] = []
        batch_start = start
        while batch_start <= end:
            batch_end = min(batch_start + PAGE_BATCH_SIZE - 1, end)
            batch_meta = {**chapter_meta, "start_page": batch_start, "end_page": batch_end}
            batch_prompt = self._json_extraction_prompt(batch_meta)
            raw = self._call_chapter_single(pdf_path, batch_start, batch_end, batch_prompt)
            rows, _ = self._try_parse_json_rows(raw, chapter_meta["title"])
            if rows:
                combined_rows.extend(rows)
                print(f"      batch pages {batch_start}–{batch_end}: {len(rows)} question(s)")
            batch_start = batch_end + 1

        # Return a pre-parsed sentinel so the caller gets rows directly
        # We abuse the raw-string path by returning JSON of already-parsed rows
        return json.dumps([
            {k: v for k, v in r.items() if k != "chapter"}
            for r in combined_rows
        ], ensure_ascii=False)

    def _call_chapter_single(
        self, pdf_path: str, start_page: int, end_page: int, prompt: str
    ) -> str:
        image_blocks = self._pdf_pages_to_base64(pdf_path, start_page, end_page, dpi=200)
        print(f"   ↳ sending pages {start_page}–{end_page} ({len(image_blocks)} image(s))")
        content = image_blocks + [{"type": "text", "text": prompt}]
        return self._call_claude(content, max_tokens=8192)

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
- end_page is the LAST page of that chapter — exactly one page before the next chapter's start_page
  Example: if chapter 1 starts at page 10 and chapter 2 starts at page 25, then chapter 1 end_page = 24
- The last chapter ends at the last page of the book
- title must be in Bengali script exactly as printed in the book
- Do NOT include front matter, index, or appendix as chapters
- Output strictly valid JSON — no trailing commas, no markdown fences
"""

    def _json_extraction_prompt(self, chapter_meta: dict) -> str:
        ch_title   = chapter_meta["title"]
        start_page = chapter_meta["start_page"]
        end_page   = chapter_meta["end_page"]
        return f"""
You are a meticulous Bengali mathematics textbook analyser.
Chapter: "{ch_title}" (pages {start_page}–{end_page})

Your task: READ EVERY PAGE carefully, line by line, and extract EVERY question without missing a single one.

━━━ WHAT COUNTS AS A QUESTION ━━━
Go through each page in order and capture ALL of the following:

1. NUMBERED EXERCISES — every numbered or lettered item inside exercise boxes (অনুশীলনী / Practice sets).
   Example: ১. ২৩৪ × ৪৫ = কত?

2. FILL-IN-THE-BLANK — sentences with blanks (____) or boxes (□).
   Convert to a proper question: "নিচের ফাঁকা ঘরটি পূরণ করো: ২৩ + ___ = ৫০"

3. TRUE/FALSE — items asking to determine if a statement is correct (সত্য/মিথ্যা).
   Write the full statement as the question.

4. EXAMPLES (উদাহরণ) — worked example problems printed in the book.
   Extract the PROBLEM STATEMENT as the question.
   Copy the printed step-by-step solution verbatim into "solution".

5. WORD PROBLEMS / APPLICATION PROBLEMS — multi-sentence story problems.
   Include the complete problem text.

6. MATCH THE FOLLOWING, MCQ, IDENTIFY THE ERROR — one row per item.

7. DIAGRAMS / FIGURES — if a question refers to a figure, describe it briefly in Bengali and include the question.

━━━ STRICT EXTRACTION RULES ━━━
A. Scan page by page. Do NOT skip any page or section.
B. Keep ALL text in Bengali (বাংলা) script exactly as printed — do NOT translate.
C. For exercises with sub-parts (a, b, c… or i, ii, iii…), create ONE row per sub-part.
D. Always prepend the shared stem to each sub-part question so it is self-contained.
E. "answer" → copy the printed final answer (উত্তর) if given in the book; otherwise empty string.
F. "solution" → copy verbatim ONLY if the book prints worked steps (only for উদাহরণ); otherwise empty string.
   NEVER invent or generate a solution.
G. Do NOT duplicate questions that appear identically on multiple pages.

━━━ FIELD CLASSIFICATION ━━━
category:
  "short"   — single-step calculation, fill-in-blank, true/false, one-line answer
  "medium"  — 2–4 step problems, short word problems
  "long"    — multi-step, proof, lengthy word problem, construction

complexity:
  "easy"    — direct recall or single arithmetic operation
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

FINAL CHECK before outputting: verify you have captured every numbered item from every
exercise set on every page. If any are missing, add them before returning.
"""

    def _text_extraction_prompt(self, chapter_meta: dict) -> str:
        ch_title   = chapter_meta["title"]
        start_page = chapter_meta["start_page"]
        end_page   = chapter_meta["end_page"]
        return f"""
You are a meticulous Bengali mathematics textbook analyser.
Chapter: "{ch_title}" (pages {start_page}–{end_page})

READ EVERY PAGE carefully and extract EVERY question without missing a single one.

━━━ WHAT COUNTS AS A QUESTION ━━━
1. NUMBERED EXERCISES — every numbered/lettered item in exercise boxes (অনুশীলনী).
2. FILL-IN-THE-BLANK — convert blanks (____/□) to a proper question sentence.
3. TRUE/FALSE — write the full statement as the question.
4. EXAMPLES (উদাহরণ) — extract the problem statement; copy printed solution steps verbatim into the solution field.
5. WORD PROBLEMS — include the complete multi-sentence text.
6. MCQ / MATCH / ERROR-FINDING — one row per item.
7. Sub-parts (a/b/c or i/ii/iii) → one row per sub-part, always include the shared stem.

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

        # Strategy 2: json_repair library (pip install json-repair)
        try:
            from json_repair import repair_json
            repaired = repair_json(text)
            return json.loads(repaired)
        except (ImportError, json.JSONDecodeError, Exception):
            pass

        # Strategy 3: manual repairs
        fixed = re.sub(r",\s*([}\]])", r"\1", text)
        fixed = re.sub(r"'([^']*)'", r'"\1"', fixed)
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass

        # Strategy 4: extract the largest JSON array
        match = re.search(r"\[.*\]", fixed, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        # Strategy 5: collect individually valid JSON objects
        objects = re.findall(r'\{[^{}]*\}', fixed)
        collected = []
        for obj in objects:
            try:
                collected.append(json.loads(obj))
            except json.JSONDecodeError:
                continue
        if collected:
            return collected

        return json.loads(text)  # raises with original error

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
    extractor.extract_to_excel(only_chapters=[2])  # remove only_chapters to run all


if __name__ == "__main__":
    main()
