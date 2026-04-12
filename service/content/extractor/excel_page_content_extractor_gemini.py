"""
Bengali Math PDF → Excel Page Content Extractor — Gemini (google-genai SDK)

Reads every page of a textbook PDF and extracts the full text content of each
page into a single Excel file with the following columns:

    page_number  — 1-based page number
    content      — full text content of that page (Bengali script, verbatim)

No interpretation, classification, or summarisation — purely verbatim extraction.

Configuration via .env:
    GOOGLE_API_KEY   = <your key>
    PDF_PATH         = path/to/book.pdf
    CLASS_ID         = 6
    OUTPUT_DIR       = output          (optional, default: ./output)
    GEMINI_MODEL     = gemini-2.5-flash (optional)
    BATCH_SIZE       = 5               (optional, pages per Gemini call, default: 5)
    START_PAGE       = 1               (optional, first page to extract, default: 1)
    END_PAGE         = 0               (optional, last page; 0 = last page of PDF)
"""

import os
import time
from pathlib import Path

import fitz  # PyMuPDF
from dotenv import load_dotenv

load_dotenv()

COLUMNS = ["page_number", "content"]


# ---------------------------------------------------------------------------
# PageContentExtractor
# ---------------------------------------------------------------------------
class PageContentExtractor:
    """
    Extract the full verbatim text of every page in a PDF and save to Excel.

    Strategy:
      - Pages are sent to Gemini in small batches (BATCH_SIZE) as PNG images.
      - Gemini returns the text for each page separated by a clear delimiter.
      - Results are written to Excel incrementally — a batch failure never
        loses rows already collected.
    """

    PAGE_DELIMITER = "<<<PAGE_BREAK>>>"

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
        batch_size: int = None,
        start_page: int = None,
        end_page: int = None,
        output_filename: str = None,
    ) -> str:
        """
        Extract full text of every page into a single Excel file.
        Returns the path of the saved .xlsx file.
        """
        pdf_path   = pdf_path   or os.getenv("PDF_PATH")
        class_id   = class_id   or int(os.getenv("CLASS_ID", 0))
        output_dir = output_dir or os.getenv("OUTPUT_DIR", "output")
        batch_size = batch_size or int(os.getenv("BATCH_SIZE", 5))
        start_page = start_page or int(os.getenv("START_PAGE", 1))
        end_page   = end_page   or int(os.getenv("END_PAGE", 0))

        if not pdf_path or not Path(pdf_path).exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path!r}. Set PDF_PATH in .env")
        if not class_id:
            raise ValueError("CLASS_ID not set in .env or passed as class_id=")

        Path(output_dir).mkdir(parents=True, exist_ok=True)

        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        doc.close()

        # Resolve page range
        s_page = max(1, start_page)
        e_page = end_page if end_page and end_page <= total_pages else total_pages
        pages_to_extract = list(range(s_page, e_page + 1))

        print(f"\n📚 Book   : {pdf_path}")
        print(f"🎓 Class  : {class_id} | Model: {self.model_name}")
        print(f"📄 Pages  : {s_page}–{e_page}  ({len(pages_to_extract)} page(s), batch_size={batch_size})\n")

        filename = output_filename or f"class_{class_id}_page_content.xlsx"
        out_path = Path(output_dir) / filename

        all_rows: list[dict] = []

        # Process pages in batches
        for batch_start in range(0, len(pages_to_extract), batch_size):
            batch = pages_to_extract[batch_start: batch_start + batch_size]
            first, last = batch[0], batch[-1]
            print(f"── Extracting pages {first}–{last} …", end=" ", flush=True)
            try:
                rows = self._extract_batch(pdf_path, batch)
                all_rows.extend(rows)
                print(f"✅ {len(rows)} page(s)  (total: {len(all_rows)})")
            except Exception as exc:
                print(f"❌ Batch {first}–{last} failed: {exc}")
                # Insert blank rows so page numbers stay traceable
                for pg in batch:
                    all_rows.append({"page_number": pg, "content": f"[EXTRACTION ERROR: {exc}]"})

            # Save after every batch
            if all_rows:
                self._save_excel(all_rows, out_path, silent=True)

        self._save_excel(all_rows, out_path)
        print(f"\n✅ Done. {len(all_rows)} page(s) saved → {out_path}")
        return str(out_path)

    # ------------------------------------------------------------------
    # Batch extraction
    # ------------------------------------------------------------------

    def _extract_batch(self, pdf_path: str, page_numbers: list[int]) -> list[dict]:
        """
        Send a batch of pages as images to Gemini and parse the response
        into one row per page: {"page_number": N, "content": "..."}.
        """
        from google.genai import types

        image_parts = self._pages_to_image_parts(pdf_path, page_numbers)
        prompt = self._extraction_prompt(page_numbers)

        contents = image_parts + [types.Part.from_text(text=prompt)]
        raw = self._call_gemini(contents)
        return self._parse_response(raw, page_numbers)

    def _parse_response(self, raw: str, page_numbers: list[int]) -> list[dict]:
        """
        Parse Gemini output.  Expected format (one block per page):

            PAGE 5
            <<<PAGE_BREAK>>>
            <full text of page 5>
            <<<PAGE_BREAK>>>
            PAGE 6
            <<<PAGE_BREAK>>>
            <full text of page 6>
            <<<PAGE_BREAK>>>

        Falls back to splitting the whole response evenly if the delimited
        format cannot be detected.
        """
        delimiter = self.PAGE_DELIMITER
        rows = []

        if delimiter in raw:
            # Split by delimiter and pair (header, content) blocks
            segments = [s.strip() for s in raw.split(delimiter)]
            # segments pattern: [header, content, header, content, ...]
            # or: [empty?, header, content, header, content, ...]
            paired = _pair_segments(segments, page_numbers)
            for pg, content in paired:
                rows.append({"page_number": pg, "content": content})
        else:
            # Fallback: assign whole response to first page in batch
            # (rare — happens when Gemini ignores the delimiter instruction)
            content = raw.strip()
            if len(page_numbers) == 1:
                rows.append({"page_number": page_numbers[0], "content": content})
            else:
                # Try to split by "PAGE N" markers
                rows = _split_by_page_markers(raw, page_numbers)
                if not rows:
                    rows.append({"page_number": page_numbers[0], "content": content})

        return rows

    # ------------------------------------------------------------------
    # Gemini helpers
    # ------------------------------------------------------------------

    def _make_client(self):
        from google import genai
        return genai.Client(api_key=self.api_key)

    def _pages_to_image_parts(self, pdf_path: str, page_numbers: list[int], dpi: int = 200) -> list:
        from google.genai import types

        doc = fitz.open(pdf_path)
        total = len(doc)
        parts = []
        for pg in page_numbers:
            idx = pg - 1  # 0-based
            if idx < 0 or idx >= total:
                continue
            page = doc.load_page(idx)
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            parts.append(types.Part.from_bytes(data=pix.tobytes("png"), mime_type="image/png"))
        doc.close()
        return parts

    def _call_gemini(self, contents: list) -> str:
        from google.genai import types

        client = self._make_client()
        response = client.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=types.GenerateContentConfig(temperature=0.0, max_output_tokens=8192),
        )
        return response.text

    # ------------------------------------------------------------------
    # Prompt
    # ------------------------------------------------------------------

    def _extraction_prompt(self, page_numbers: list[int]) -> str:
        pages_str = ", ".join(str(p) for p in page_numbers)
        delimiter = self.PAGE_DELIMITER
        return f"""
You are a precise OCR assistant for a Bengali mathematics textbook.
You have been given {len(page_numbers)} page image(s) in order: pages {pages_str}.

TASK:
For EACH page image, extract ALL text exactly as printed — every word, number,
Bengali digit, punctuation mark, and mathematical symbol.  Do NOT translate,
summarise, interpret, or skip any text.

OUTPUT FORMAT — strictly follow this structure for EVERY page:
PAGE <page_number>
{delimiter}
<complete verbatim text of the page, preserving line breaks as best as possible>
{delimiter}

RULES:
1. Use the exact delimiter "{delimiter}" (on its own line) to separate sections.
2. Preserve Bengali script exactly as printed.
3. For mathematical expressions write them as they appear (e.g. ২৩ × ৪৫ = ১০৩৫).
4. If a page contains a diagram or figure with no readable text, write: [চিত্র / Figure]
5. Do NOT add any explanation, comment, or metadata outside the format above.
6. Output ALL {len(page_numbers)} page(s) — do not skip any.
"""


# ---------------------------------------------------------------------------
# Response parsing helpers
# ---------------------------------------------------------------------------

def _pair_segments(segments: list[str], page_numbers: list[int]) -> list[tuple]:
    """
    Given a list of segments produced by splitting on PAGE_DELIMITER, extract
    (page_number, content) pairs by matching "PAGE N" header lines.
    """
    import re
    pairs = []
    page_set = set(page_numbers)

    i = 0
    while i < len(segments):
        seg = segments[i].strip()
        # Check if this segment is a PAGE header
        m = re.match(r"^PAGE\s+(\d+)\s*$", seg, re.IGNORECASE)
        if m:
            pg = int(m.group(1))
            content = segments[i + 1].strip() if i + 1 < len(segments) else ""
            if pg in page_set:
                pairs.append((pg, content))
            i += 2
        else:
            i += 1

    return pairs


def _split_by_page_markers(text: str, page_numbers: list[int]) -> list[dict]:
    """
    Attempt to split raw text by inline 'PAGE N' or 'পৃষ্ঠা N' markers.
    Returns list of {"page_number": N, "content": "..."} or empty list.
    """
    import re
    pattern = re.compile(
        r"(?:PAGE|পৃষ্ঠা)\s+(\d+)\s*\n", re.IGNORECASE
    )
    parts = pattern.split(text)
    if len(parts) < 3:
        return []

    rows = []
    page_set = set(page_numbers)
    # parts = [pre_text, pg_num, content, pg_num, content, ...]
    for j in range(1, len(parts) - 1, 2):
        try:
            pg = int(parts[j])
            content = parts[j + 1].strip() if j + 1 < len(parts) else ""
            if pg in page_set:
                rows.append({"page_number": pg, "content": content})
        except (ValueError, IndexError):
            continue
    return rows


# ---------------------------------------------------------------------------
# Excel output
# ---------------------------------------------------------------------------

def _save_excel(rows: list[dict], out_path: Path, silent: bool = False) -> None:
    try:
        import pandas as pd
    except ImportError:
        raise ImportError("pandas is required: pip install pandas openpyxl")

    df = pd.DataFrame(rows, columns=COLUMNS)
    with pd.ExcelWriter(str(out_path), engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="PageContent")
        ws = writer.sheets["PageContent"]

        # Column widths
        ws.column_dimensions["A"].width = 14   # page_number
        ws.column_dimensions["B"].width = 120  # content

        # Wrap text in content column and set row height hint
        from openpyxl.styles import Alignment
        for row in ws.iter_rows(min_row=2, max_col=2):
            for cell in row:
                cell.alignment = Alignment(wrap_text=True, vertical="top")

    if not silent:
        print(f"   💾 Saved → {out_path}")


# Attach to class for convenience
PageContentExtractor._save_excel = staticmethod(_save_excel)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    extractor = PageContentExtractor()
    extractor.extract_to_excel()


if __name__ == "__main__":
    main()