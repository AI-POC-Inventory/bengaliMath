"""Step 02 -- render every PDF page to PNG. Resumable, idempotent."""
import logging

import fitz

from config import PDF_PATH, PAGES_DIR, RENDER_DPI, EXPECTED_PAGES

log = logging.getLogger("render")


def render_all(dpi: int = RENDER_DPI) -> int:
    doc = fitz.open(PDF_PATH)
    assert len(doc) == EXPECTED_PAGES, f"expected {EXPECTED_PAGES} pages, got {len(doc)}"

    made = 0
    for i in range(len(doc)):
        out = PAGES_DIR / f"p{i + 1:03d}.png"
        if out.exists():
            continue
        doc[i].get_pixmap(dpi=dpi).save(out)
        made += 1
    doc.close()

    total = len(list(PAGES_DIR.glob("p*.png")))
    log.info("rendered %d new, %d total at %d dpi", made, total, dpi)
    return total


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(render_all())
