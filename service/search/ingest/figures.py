"""Step 05 -- crop real figures, discard page furniture."""
import hashlib
import json
import logging

import fitz

from config import PDF_PATH, FIG_DIR, WORK

log = logging.getLogger("figures")
MIN_SIDE_PT = 40      # drop bullets, rules, tiny ornaments
FOOTER_Y = 600        # page is 684 pt tall; the mascot badge lives below
HEADER_Y = 55         # the cyan chapter chip lives above
REPEAT_LIMIT = 10     # an image on >10 pages is decoration, not a figure


def extract_figures() -> list[dict]:
    doc = fitz.open(PDF_PATH)
    seen, candidates = {}, []

    for i in range(len(doc)):
        page = doc[i]
        for info in page.get_image_info(xrefs=True):
            x0, y0, x1, y1 = info["bbox"]
            if (x1 - x0) < MIN_SIDE_PT or (y1 - y0) < MIN_SIDE_PT:
                continue
            if y0 > FOOTER_Y or y1 < HEADER_Y:
                continue
            xref = info.get("xref")
            if not xref:
                continue
            try:
                raw = doc.extract_image(xref)["image"]
            except Exception:                        # noqa: BLE001
                continue
            digest = hashlib.md5(raw).hexdigest()
            seen[digest] = seen.get(digest, 0) + 1
            candidates.append({"figure_id": f"fig_p{i + 1:03d}_{xref}",
                               "pdf_index": i + 1,
                               "bbox": [round(v, 1) for v in (x0, y0, x1, y1)],
                               "digest": digest})

    repeats = {d for d, n in seen.items() if n > REPEAT_LIMIT}
    figures = [f for f in candidates if f["digest"] not in repeats]

    for f in figures:
        x0, y0, x1, y1 = f["bbox"]
        doc[f["pdf_index"] - 1].get_pixmap(
            clip=fitz.Rect(x0, y0, x1, y1), dpi=200
        ).save(FIG_DIR / f"{f['figure_id']}.png")
        f.pop("digest")

    doc.close()
    (WORK / "figures.json").write_text(
        json.dumps(figures, ensure_ascii=False, indent=1), encoding="utf-8")
    log.info("figures: %d candidates, %d decorative digests dropped, %d kept",
             len(candidates), len(repeats), len(figures))
    return figures


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(len(extract_figures()))
