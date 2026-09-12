"""Step 06 -- blocks to atomic chunks with parents and context prefixes."""
import json
import logging
import re
import unicodedata

from config import BOOK_ID, CLASS_NAME, BLOCK_DIR, WORK
from normalize import fold

log = logging.getLogger("chunk")

ATOMIC = {"exercise_item", "worked_example", "rule_box", "figure"}
LABEL = {
    "exercise_item": "অনুশীলনী প্রশ্ন",
    "worked_example": "সমাধান-সহ উদাহরণ",
    "rule_box": "নিয়ম",
    "figure": "চিত্র",
}
MAX_CHARS = 1200

# The model emits the running head as a section_header despite being told to
# ignore it. metadata.py already owns chapter numbers deterministically, so
# these are dropped rather than allowed to become parent headings.
#
# Unicode trap: the model returns precomposed BENGALI LETTER YYA (U+09DF) in
# অধ্যায়, while a literal typed elsewhere may carry the decomposed য + ় pair
# (U+09AF U+09BC). They are the same grapheme and compare unequal. U+09DF is a
# composition exclusion, so NFC normalises TOWARDS the decomposed pair -- both
# sides are normalised here so the match works whichever form arrives.
_ODHYAY = unicodedata.normalize("NFC", "অধ্যায়")
RUNNING_HEAD = re.compile(rf"^\s*{_ODHYAY}\s*[:：]?\s*[0-9০-৯]+\s*$")


def is_running_head(text: str | None) -> bool:
    return bool(RUNNING_HEAD.match(unicodedata.normalize("NFC", (text or "").strip())))


def _load_blocks() -> dict[int, list[dict]]:
    out = {}
    for f in sorted(BLOCK_DIR.glob("p*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        out[int(d["pdf_index"])] = d.get("blocks", [])
    return out


def chapter_titles(meta: dict, blocks: dict[int, list[dict]]) -> dict[int, str]:
    """The display title on each chapter's opening page."""
    titles = {}
    for c in meta["chapters"]:
        for b in blocks.get(c["pdf_start"], []):
            txt = (b.get("text") or "").strip()
            # section_header only: falling back to prose picks up the first
            # sentence of the chapter, which is noise in every context prefix.
            if b.get("type") == "section_header" and txt and not is_running_head(txt):
                titles[c["chapter_no"]] = txt[:60]
                break
        titles.setdefault(c["chapter_no"], "")
    return titles


def build_chunks(meta: dict, figures: list[dict] | None = None):
    blocks = _load_blocks()
    titles = chapter_titles(meta, blocks)
    figs_by_page: dict[int, list[str]] = {}
    for f in figures or []:
        figs_by_page.setdefault(f["pdf_index"], []).append(f["figure_id"])

    chunks: list[dict] = []
    parents: dict[str, dict] = {}

    for page in meta["pages"]:
        if page["section"] != "body":
            continue
        idx, ch = page["pdf_index"], page["chapter_no"]
        title = titles.get(ch, "")
        parent = None
        fig_pool = list(figs_by_page.get(idx, []))

        for b in blocks.get(idx, []):
            btype = b.get("type")

            if btype == "section_header":
                if is_running_head(b.get("text")):
                    continue
                ex = b.get("exercise_id")
                pid = f"{BOOK_ID}.ch{ch:02d}.{ex or f'p{idx}'}"
                parent = {"id": pid, "heading": (b.get("text") or "").strip(),
                          "exercise_id": ex, "chapter_no": ch,
                          "printed_page": page["printed_page"], "text": []}
                parents[pid] = parent
                continue

            if btype not in ATOMIC:
                if parent and b.get("text"):
                    parent["text"].append(b["text"])
                continue

            text = (b.get("text") or b.get("describe") or "").strip()
            if not text:
                continue
            if b.get("steps"):
                text = text + "\n" + "\n".join(b["steps"])
            if b.get("answer"):
                text = f"{text}\nউত্তর: {b['answer']}"
            text = text[:MAX_CHARS]

            pid = parent["id"] if parent else f"{BOOK_ID}.ch{ch:02d}.p{idx}"
            if pid not in parents:
                parents[pid] = {"id": pid, "heading": "", "exercise_id": None,
                                "chapter_no": ch,
                                "printed_page": page["printed_page"], "text": []}
            heading = parents[pid]["heading"]

            prefix = " · ".join(x for x in [
                CLASS_NAME,
                f"অধ্যায় {ch}" + (f": {title}" if title else ""),
                heading or None,
                LABEL.get(btype, ""),
            ] if x)

            number = b.get("number") or str(len(chunks))
            figure_id = fig_pool.pop(0) if (b.get("has_figure") or btype == "figure") and fig_pool else None

            chunks.append({
                "id": f"{pid}.{number}".replace(" ", ""),
                "context_prefix": prefix,
                "text": text,
                "embed_text": f"{prefix}\n{text}",
                "text_norm": fold(f"{prefix} {text}"),
                "block_type": btype,
                "parent_id": pid,
                "chapter_no": ch,
                "exercise_id": parents[pid]["exercise_id"],
                "printed_page": page["printed_page"],
                "pdf_index": idx,
                "answer": b.get("answer"),
                "figure_id": figure_id,
            })

    # de-duplicate ids (same exercise number can repeat across pages)
    seen: dict[str, int] = {}
    for c in chunks:
        n = seen.get(c["id"], 0)
        seen[c["id"]] = n + 1
        if n:
            c["id"] = f"{c['id']}#{n}"

    # Small-to-big only works if the parent carries content. An exercise set
    # is nothing but its numbered items, so prose accumulation leaves it
    # empty -- fill it from the children, in printed order.
    kids: dict[str, list[str]] = {}
    for c in chunks:
        kids.setdefault(c["parent_id"], []).append(c["text"])
    for pid, par in parents.items():
        body = "\n".join(par["text"]) if par["text"] else ""
        if not body.strip():
            body = "\n".join(kids.get(pid, []))
        par["text"] = body[:6000]
        par["n_children"] = len(kids.get(pid, []))

    (WORK / "chunks.json").write_text(
        json.dumps(chunks, ensure_ascii=False), encoding="utf-8")
    log.info("chunks: %d atomic across %d parents", len(chunks), len(parents))
    return chunks, parents
