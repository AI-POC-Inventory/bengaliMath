"""
Bengali Math PDF Extractor — Gemini only (google-genai SDK)

Reads a full textbook PDF, auto-detects every chapter, then extracts content
for each chapter and saves one JSON file per chapter.

Configuration via .env:
    GOOGLE_API_KEY   = <your key>
    PDF_PATH         = path/to/book.pdf
    CLASS_ID         = 6
    OUTPUT_DIR       = output          (optional, default: ./output)
    GEMINI_MODEL     = gemini-2.5-flash (optional)
    USE_FILE_API     = false            (optional, "true" for Files API mode)

Output schema matches mock.json / mock_6.json:
[
  {
    "id": <class_id>,
    "name": "Class N",
    "bengaliName": "...",
    "chapters": [
      {
        "id": "N-C",
        "name": "<chapter title in Bengali>",
        "description": "...",
        "topics": [
          {
            "id": "N-C-T",
            "name": "...",
            "description": "...",
            "questions": [
              {
                "id": "N-C-T-Q",
                "type": "mcq" | "short" | "long",
                "text": "...",
                "options": [...],    # MCQ only
                "answer": 0,        # MCQ: 0-based index; short/long: string
                "solution": "...",
                "difficulty": "easy" | "medium" | "hard"
              }
            ]
          }
        ]
      }
    ]
  }
]
"""

import json
import os
import re
import time
from pathlib import Path
from dotenv import load_dotenv
import fitz  # PyMuPDF

load_dotenv()


# ---------------------------------------------------------------------------
# Bengali class-name map
# ---------------------------------------------------------------------------
BENGALI_CLASS_NAMES = {
    1: "প্রথম শ্রেণী",
    2: "দ্বিতীয় শ্রেণী",
    3: "তৃতীয় শ্রেণী",
    4: "চতুর্থ শ্রেণী",
    5: "পঞ্চম শ্রেণী",
    6: "ষষ্ঠ শ্রেণী",
    7: "সপ্তম শ্রেণী",
    8: "অষ্টম শ্রেণী",
    9: "নবম শ্রেণী",
    10: "দশম শ্রেণী",
}


# ---------------------------------------------------------------------------
# GeminiBookExtractor
# ---------------------------------------------------------------------------
class GeminiBookExtractor:
    """
    Extract ALL chapters from a Bengali math textbook PDF using Google Gemini.

    Flow
    ----
    1. detect_chapters()  — send full PDF to Gemini, get chapter list with page ranges
    2. extract_chapter()  — for each chapter, send its pages and extract questions
    3. extract_book()     — runs both phases, saves one JSON per chapter

    All config is read from .env (or passed explicitly).
    """

    def __init__(
        self,
        api_key: str = None,
        model: str = None,
    ):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not set in .env or passed as api_key=")
        self.model_name = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract_book(
        self,
        pdf_path: str = None,
        class_id: int = None,
        output_dir: str = None,
        use_file_api: bool = None,
    ) -> list[str]:
        """
        Extract the entire textbook PDF — all chapters — and save one JSON per chapter.

        All parameters fall back to .env values when not supplied.
        Returns a list of saved JSON file paths.
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

        print(f"\n📚 Book: {pdf_path}")
        print(f"🎓 Class: {class_id} | Model: {self.model_name} | mode: {'file-api' if use_file_api else 'image'}\n")

        # Phase 1 — detect chapter structure
        chapters_meta = self.detect_chapters(pdf_path)
        print(f"📑 Detected {len(chapters_meta)} chapter(s):\n")
        for ch in chapters_meta:
            print(f"   Ch{ch['chapter_num']:>2}  pages {ch['start_page']}-{ch['end_page']}  {ch['title']}")

        # Phase 2 — extract each chapter
        saved_files = []
        for ch in chapters_meta:
            print(f"\n── Extracting chapter {ch['chapter_num']}: {ch['title']} ──")
            try:
                data = self.extract_chapter(
                    pdf_path=pdf_path,
                    class_id=class_id,
                    chapter_meta=ch,
                    use_file_api=use_file_api,
                )
                out_path = self._save_chapter(data, class_id, ch["chapter_num"], output_dir)
                saved_files.append(out_path)
            except Exception as exc:
                print(f"❌ Chapter {ch['chapter_num']} failed: {exc}")

        print(f"\n✅ Done. {len(saved_files)}/{len(chapters_meta)} chapters saved to {output_dir}/")
        return saved_files

    def detect_chapters(self, pdf_path: str) -> list[dict]:
        """
        Phase 1: ask Gemini to return a JSON list of chapters with page ranges.

        Returns list of dicts:
          [{"chapter_num": 1, "title": "ভগ্নাংশ", "start_page": 1, "end_page": 14}, ...]
        """
        print("🔍 Phase 1: detecting chapter structure …")
        prompt = self._chapter_detection_prompt()

        # Use image mode for detection (cheaper, no file upload needed for just structure)
        raw = self._call_with_images(pdf_path, prompt, dpi=100)
        chapters = self._parse_json(raw)

        if not isinstance(chapters, list) or not chapters:
            raise ValueError("Gemini did not return a valid chapter list. Check the PDF.")

        # Sort by chapter_num for predictable order
        chapters.sort(key=lambda c: c.get("chapter_num", 0))
        return chapters

    def extract_chapter(
        self,
        pdf_path: str,
        class_id: int,
        chapter_meta: dict,
        use_file_api: bool = False,
    ) -> list:
        """
        Phase 2: extract questions/solutions from a single chapter's pages.

        chapter_meta: {"chapter_num": 1, "title": "...", "start_page": 1, "end_page": 14}
        Returns a list matching the mock.json schema.
        """
        prompt = self._extraction_prompt(class_id, chapter_meta)

        if use_file_api:
            raw = self._call_chapter_file_api(pdf_path, chapter_meta, prompt)
        else:
            raw = self._call_chapter_images(pdf_path, chapter_meta, prompt)

        data = self._parse_json(raw)
        if isinstance(data, dict):
            data = [data]

        q_count = self._count_questions(data)
        print(f"   ✅ {q_count} question(s) extracted")
        return data

    # ------------------------------------------------------------------
    # Gemini call helpers
    # ------------------------------------------------------------------

    def _make_client(self):
        from google import genai
        return genai.Client(api_key=self.api_key)

    def _pages_to_image_parts(self, pdf_path: str, start_page: int, end_page: int, dpi: int = 200) -> list:
        """Convert a page range (1-based, inclusive) to Gemini image Parts."""
        from google.genai import types

        doc = fitz.open(pdf_path)
        total = len(doc)
        # Clamp to actual page count
        s = max(0, start_page - 1)
        e = min(total, end_page)
        parts = []
        for page_num in range(s, e):
            page = doc.load_page(page_num)
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            parts.append(
                types.Part.from_bytes(data=pix.tobytes("png"), mime_type="image/png")
            )
        doc.close()
        return parts

    def _call_with_images(self, pdf_path: str, prompt: str, dpi: int = 200) -> str:
        """Send ALL pages as images to Gemini."""
        from google.genai import types

        doc = fitz.open(pdf_path)
        total = len(doc)
        doc.close()

        parts = self._pages_to_image_parts(pdf_path, 1, total, dpi)
        print(f"   ↳ sending {len(parts)} page(s) as images")
        return self._call_gemini(parts + [types.Part.from_text(text=prompt)])

    def _call_chapter_images(self, pdf_path: str, chapter_meta: dict, prompt: str) -> str:
        """Send only the chapter's pages as images to Gemini."""
        from google.genai import types

        parts = self._pages_to_image_parts(
            pdf_path, chapter_meta["start_page"], chapter_meta["end_page"]
        )
        print(f"   ↳ sending pages {chapter_meta['start_page']}–{chapter_meta['end_page']} ({len(parts)} image(s))")
        return self._call_gemini(parts + [types.Part.from_text(text=prompt)])

    def _call_chapter_file_api(self, pdf_path: str, chapter_meta: dict, prompt: str) -> str:
        """
        Extract the chapter's pages into a temp PDF, upload via Files API, call Gemini.
        """
        from google import genai
        from google.genai import types
        import tempfile

        # Slice the chapter pages into a temporary PDF
        src = fitz.open(pdf_path)
        tmp_doc = fitz.open()
        s = chapter_meta["start_page"] - 1
        e = chapter_meta["end_page"]
        tmp_doc.insert_pdf(src, from_page=s, to_page=e - 1)
        src.close()

        # On Windows the file handle must be closed before fitz can write to it
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
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=8192,
            ),
        )
        return response.text

    # ------------------------------------------------------------------
    # Prompts
    # ------------------------------------------------------------------

    def _chapter_detection_prompt(self) -> str:
        return """
You are analysing a Bengali mathematics textbook PDF.

Identify every chapter in this book. For each chapter return its number, Bengali title,
and the page range (1-based, inclusive).

Return ONLY a JSON array — no markdown, no explanation:

[
  {"chapter_num": 1, "title": "<Bengali chapter title>", "start_page": 1, "end_page": 14},
  {"chapter_num": 2, "title": "<Bengali chapter title>", "start_page": 15, "end_page": 30}
]

RULES:
- chapter_num must be an integer starting from 1
- start_page and end_page are 1-based page numbers (inclusive)
- title must be in Bengali script as printed in the book
- Do NOT include front matter, index, or appendix pages as chapters
- Output strictly valid JSON — no trailing commas, no markdown fences
"""

    def _extraction_prompt(self, class_id: int, chapter_meta: dict) -> str:
        bengali_class = BENGALI_CLASS_NAMES.get(class_id, f"শ্রেণী {class_id}")
        ch = chapter_meta["chapter_num"]
        return f"""
You are an expert at extracting educational content from Bengali mathematics textbooks.

Carefully analyse ALL pages in this PDF — it contains Chapter {ch} of Class {class_id}.
Extract EVERY example problem, exercise question, and worked solution.

Return ONLY a valid JSON array — no markdown, no explanation:

[
  {{
    "id": {class_id},
    "name": "Class {class_id}",
    "bengaliName": "{bengali_class}",
    "chapters": [
      {{
        "id": "{class_id}-{ch}",
        "name": "<chapter title in Bengali exactly as printed>",
        "description": "<one-line description in Bengali>",
        "topics": [
          {{
            "id": "{class_id}-{ch}-1",
            "name": "<section/topic name in Bengali>",
            "description": "<short description>",
            "questions": [
              {{
                "id": "{class_id}-{ch}-1-1",
                "type": "mcq",
                "text": "<full question in Bengali>",
                "options": ["<A>", "<B>", "<C>", "<D>"],
                "answer": 0,
                "solution": "<step-by-step solution in Bengali>",
                "difficulty": "easy"
              }},
              {{
                "id": "{class_id}-{ch}-1-2",
                "type": "short",
                "text": "<question in Bengali>",
                "answer": "<answer string>",
                "solution": "<step-by-step solution in Bengali>",
                "difficulty": "medium"
              }}
            ]
          }}
        ]
      }}
    ]
  }}
]

RULES:
1. "type": "mcq" — include "options" (4 strings) and "answer" (0-based correct index)
2. "type": "short" or "long" — "answer" is a string; no "options" field
3. "difficulty": "easy", "medium", or "hard"
4. IDs follow pattern: {class_id}-{ch}-<topic_num>-<question_num>
5. Keep ALL text in Bengali script — do NOT translate to English
6. Output strictly valid JSON — no trailing commas, no markdown fences
"""

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def _parse_json(self, text: str):
        text = text.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        return json.loads(text.strip())

    def _count_questions(self, data: list) -> int:
        count = 0
        for cls in data:
            for chapter in cls.get("chapters", []):
                for topic in chapter.get("topics", []):
                    count += len(topic.get("questions", []))
        return count

    def _save_chapter(self, data: list, class_id: int, chapter_num: int, output_dir: str) -> str:
        out_file = Path(output_dir) / f"class_{class_id}_chapter_{chapter_num:02d}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"   💾 Saved → {out_file}")
        return str(out_file)


# ---------------------------------------------------------------------------
# Entry point — reads everything from .env
# ---------------------------------------------------------------------------

def main():
    extractor = GeminiBookExtractor()
    extractor.extract_book()


if __name__ == "__main__":
    main()
