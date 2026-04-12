"""
PDF → Excel Page Extractor

Reads every page of a PDF and writes its text content to an Excel file.

Output Excel columns:
    Page No  — 1-based page number
    Content  — full extracted text of that page

One row per page. No AI/LLM involved — pure PyMuPDF text extraction.

Configuration via .env:
    PDF_PATH   = path/to/book.pdf
    OUTPUT_DIR = output          (optional, default: ./output)
"""

import os
from pathlib import Path

import fitz  # PyMuPDF
from dotenv import load_dotenv

load_dotenv()


def extract_pages_to_excel(
    pdf_path: str = None,
    output_dir: str = None,
    output_filename: str = None,
) -> str:
    """
    Extract text from every page of the PDF and save to Excel.
    Returns the path of the saved .xlsx file.
    """
    try:
        import pandas as pd
    except ImportError:
        raise ImportError("pandas is required: pip install pandas openpyxl")

    pdf_path   = pdf_path   or os.getenv("PDF_PATH")
    output_dir = output_dir or os.getenv("OUTPUT_DIR", "output")

    if not pdf_path or not Path(pdf_path).exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path!r}. Set PDF_PATH in .env")

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    pdf_stem = Path(pdf_path).stem
    filename = output_filename or f"{pdf_stem}_pages.xlsx"
    out_path = Path(output_dir) / filename

    print(f"\n📚 PDF    : {pdf_path}")
    print(f"📄 Output : {out_path}\n")

    doc = fitz.open(pdf_path)
    total = len(doc)
    rows = []

    for i in range(total):
        page_text = doc[i].get_text("text").strip()
        rows.append({"Page No": i + 1, "Content": page_text})
        if (i + 1) % 50 == 0 or (i + 1) == total:
            print(f"   ↳ processed {i + 1}/{total} pages …")

    doc.close()

    df = pd.DataFrame(rows, columns=["Page No", "Content"])
    with pd.ExcelWriter(str(out_path), engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Pages")
        ws = writer.sheets["Pages"]
        ws.column_dimensions["A"].width = 10   # Page No
        ws.column_dimensions["B"].width = 120  # Content

    print(f"\n✅ Done. {total} page(s) saved → {out_path}")
    return str(out_path)


if __name__ == "__main__":
    extract_pages_to_excel()