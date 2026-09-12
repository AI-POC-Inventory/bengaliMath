"""Page metadata from pixels and arithmetic. No OCR, no model calls."""
import json
import fitz
import numpy as np
from config import (PDF_PATH, WORK, PAGE_OFFSET, FRONT_MATTER_END,
                    BACK_MATTER_START, EXPECTED_CHAPTERS, EXPECTED_PAGES)

CHIP_VERSO = fitz.Rect( 55, 18, 130, 50)
CHIP_RECTO = fitz.Rect(410, 18, 486, 50)
CYAN_MIN_FRACTION = 0.20


def _has_chapter_chip(page, pdf_index: int) -> bool:
    band = CHIP_VERSO if pdf_index % 2 == 0 else CHIP_RECTO
    pix = page.get_pixmap(clip=band, dpi=72)
    a = (np.frombuffer(pix.samples, dtype=np.uint8)
           .reshape(pix.height, pix.width, pix.n)[:, :, :3].astype(int))
    cyan = (a[:, :, 0] < 90) & (a[:, :, 1] > 120) & (a[:, :, 2] > 190)
    return bool(cyan.mean() > CYAN_MIN_FRACTION)


def build() -> dict:
    doc = fitz.open(PDF_PATH)
    chip = {i: _has_chapter_chip(doc[i - 1], i)
            for i in range(1, len(doc) + 1)}
    doc.close()

    openings = [FRONT_MATTER_END + 1] + [
        i for i in range(FRONT_MATTER_END + 2, BACK_MATTER_START) if not chip[i]
    ]

    chapters = []
    for n, start in enumerate(openings, start=1):
        end = openings[n] - 1 if n < len(openings) else BACK_MATTER_START - 1
        chapters.append({"chapter_no": n, "pdf_start": start, "pdf_end": end,
                         "printed_start": start - PAGE_OFFSET,
                         "printed_end": end - PAGE_OFFSET})

    assert len(chapters) == EXPECTED_CHAPTERS, f"got {len(chapters)} chapters"
    assert all(c["pdf_end"] >= c["pdf_start"] for c in chapters)
    assert all(chapters[i]["pdf_start"] == chapters[i - 1]["pdf_end"] + 1
               for i in range(1, len(chapters))), "chapter ranges not contiguous"

    by_page = {}
    for c in chapters:
        for i in range(c["pdf_start"], c["pdf_end"] + 1):
            by_page[i] = c

    pages = []
    for i in range(1, EXPECTED_PAGES + 1):
        c = by_page.get(i)
        pages.append({
            "pdf_index":    i,
            "printed_page": i - PAGE_OFFSET,
            "chapter_no":   c["chapter_no"] if c else None,
            "is_opening":   bool(c and i == c["pdf_start"]),
            "section": ("front" if i <= FRONT_MATTER_END
                        else "back" if i >= BACK_MATTER_START else "body"),
        })

    out = {"chapters": chapters, "pages": pages}
    (WORK / "page_metadata.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


if __name__ == "__main__":
    m = build()
    print(f"{len(m['chapters'])} chapters, "
          f"{sum(1 for p in m['pages'] if p['section'] == 'body')} body pages")
