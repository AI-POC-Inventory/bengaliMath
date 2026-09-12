"""Step 04 -- vision extraction to typed blocks. Checkpointed per page."""
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from json_repair import repair_json

from config import PAGES_DIR, BLOCK_DIR, EXPECTED_PAGES, EXTRACT_WORKERS
from prompts import EXTRACT_SYSTEM, EXTRACT_USER
from vision import call_vision

log = logging.getLogger("extract")
MAX_RETRIES = 3
VALID = {"section_header", "exercise_item", "worked_example",
         "rule_box", "prose", "table", "figure"}


def extract_page(pdf_index: int) -> tuple[int, str, dict]:
    out = BLOCK_DIR / f"p{pdf_index:03d}.json"
    if out.exists():
        return pdf_index, "cached", {}

    img = (PAGES_DIR / f"p{pdf_index:03d}.png").read_bytes()
    last = None
    for attempt in range(MAX_RETRIES):
        try:
            raw, usage = call_vision(img, EXTRACT_SYSTEM, EXTRACT_USER)
            data = json.loads(repair_json(raw))
            blocks = data.get("blocks")
            if not isinstance(blocks, list):
                raise ValueError("no blocks list")
            data["blocks"] = [b for b in blocks
                              if isinstance(b, dict) and b.get("type") in VALID]
            data["pdf_index"] = pdf_index
            data["usage"] = usage
            out.write_text(json.dumps(data, ensure_ascii=False, indent=1),
                           encoding="utf-8")
            return pdf_index, "ok", usage
        except Exception as e:                       # noqa: BLE001
            last = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
    return pdf_index, f"FAILED {type(last).__name__}: {last}", {}


def run(pages=None) -> dict:
    pages = list(pages or range(1, EXPECTED_PAGES + 1))
    failed, totals = [], {"input_tokens": 0, "output_tokens": 0, "calls": 0}

    with ThreadPoolExecutor(max_workers=EXTRACT_WORKERS) as ex:
        futs = {ex.submit(extract_page, p): p for p in pages}
        for i, f in enumerate(as_completed(futs), 1):
            page, status, usage = f.result()
            if status.startswith("FAILED"):
                failed.append((page, status))
                log.warning("page %d %s", page, status)
            elif usage:
                totals["input_tokens"] += usage.get("input_tokens", 0)
                totals["output_tokens"] += usage.get("output_tokens", 0)
                totals["calls"] += 1
            if i % 25 == 0:
                log.info("  %d/%d", i, len(futs))

    totals["failed"] = failed
    log.info("extract done: %d calls, %d in / %d out tokens, %d failed",
             totals["calls"], totals["input_tokens"], totals["output_tokens"],
             len(failed))
    return totals


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    sel = [int(a) for a in sys.argv[1:]] or None
    print(json.dumps(run(sel), indent=1, ensure_ascii=False))
