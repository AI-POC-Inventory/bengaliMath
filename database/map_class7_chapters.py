"""
map_class7_chapters.py
=======================
Dry-run only. Cross-references Supabase's `chapters` rows for class_id=7
against the validated GCS chapter map (service/search's ingestion output —
23 chapters, spot-checked at 10/10 boundaries when it was built) and prints a
classified diff. It does NOT write to Supabase — see "Applying" below.

Why this exists
----------------
Supabase's Class 7 curriculum was seeded by an older one-shot script
(database/generate_insert_script.py) that detected chapter boundaries by
scanning raw OCR text for the "অধ্যায় : N" marker. That approach has no
defence against merged/split/missing chapters, and two of its 22 rows already
show the exact failure mode this script exists to catch: the marker text
itself ended up as the "title" (7-8, 7-21).

A naive ordinal mapping (Supabase 7-N <-> GCS chapter_no N) is NOT safe to
assume — chapters 1-3 prove it: the real book has chapter 1 (integers) and
separate chapters 2 (Ratio) and 3 (Proportion), while Supabase's 7-1
("অনুপাত ও সমানুপাত") merges Ratio+Proportion into one row and has nothing
for the book's actual chapter 1. From chapter 4 onward the numbering happens
to line up -- which is exactly the kind of "looks right until you check it"
trap this script is designed to catch instead of assume.

Classification
---------------
  CONFIRM    number matches AND title matches (exact or near) -> safe to map
  FIX_TITLE  number matches, Supabase title is a corrupted running-head
             ("অধ্যায় : N") -> safe to map AND correct the title
  REVIEW     number matches but titles diverge meaningfully -> map is very
             likely correct (the numbering pattern is otherwise perfectly
             consistent) but flagged for a human glance, title left alone
  UNMAPPED   no confident correspondence -> left NULL, printed with an
             explanation, needs a human decision (see output)

Usage
-----
    cd database
    python map_class7_chapters.py

Requires
--------
    ../service/search/_work/dist/chunks.json   (built already; has the
        validated chapter_no -> title map baked into each chunk's
        context_prefix)
    SUPABASE_URL / SUPABASE_KEY (from ../service/db/.env)
"""
import json
import os
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).parent
CHUNKS_JSON = HERE.parent / "service" / "search" / "_work" / "dist" / "chunks.json"
DB_ENV = HERE.parent / "service" / "db" / ".env"


def _load_env(path: Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def gcs_chapter_titles() -> dict[int, str]:
    """chapter_no -> title, extracted from the already-built, validated
    chunks.json (see service/search/ingest/chunk.py's chapter_titles())."""
    if not CHUNKS_JSON.exists():
        sys.exit(f"ERROR: {CHUNKS_JSON} not found -- build the search index first "
                 f"(service/search), or point CHUNKS_JSON at a copy.")
    chunks = json.loads(CHUNKS_JSON.read_text(encoding="utf-8"))
    titles: dict[int, str] = {}
    pat = re.compile(r"অধ্যায় (\d+)(?::\s*([^·]+))?")
    for c in chunks:
        m = pat.search(c.get("context_prefix", ""))
        if not m:
            continue
        num = int(m.group(1))
        title = (m.group(2) or "").strip()
        if title and num not in titles:
            titles[num] = title
    return titles


def supabase_chapters(class_id: int) -> list[dict]:
    env = {**_load_env(DB_ENV), **os.environ}
    url = env["SUPABASE_URL"].rstrip("/")
    key = env["SUPABASE_KEY"]
    req = urllib.request.Request(
        f"{url}/rest/v1/chapters?select=*&class_id=eq.{class_id}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    rows = json.loads(urllib.request.urlopen(req, timeout=20).read())
    rows.sort(key=lambda r: int(r["id"].split("-")[1]))
    return rows


RUNNING_HEAD = re.compile(r"^\s*অধ্যায়\s*[:：]?\s*[0-9০-৯]+")


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"[^\w]", "", s, flags=re.UNICODE).lower()


def _title_overlap(a: str, b: str) -> float:
    """Cheap, dependency-free similarity: normalized-character n-gram (n=3)
    Jaccard overlap. Good enough to separate "same chapter, minor spelling
    difference" from "different chapter" without adding a fuzzy-match lib."""
    na, nb = _norm(a), _norm(b)
    if not na or not nb:
        return 0.0
    ga = {na[i:i + 3] for i in range(len(na) - 2)} or {na}
    gb = {nb[i:i + 3] for i in range(len(nb) - 2)} or {nb}
    return len(ga & gb) / len(ga | gb)


def build_diff(class_id: int = 7) -> list[dict]:
    gcs_titles = gcs_chapter_titles()
    sb_rows = supabase_chapters(class_id)
    sb_by_num = {}
    for r in sb_rows:
        try:
            sb_by_num[int(r["id"].split("-")[1])] = r
        except (IndexError, ValueError):
            pass

    all_nums = sorted(set(gcs_titles) | set(sb_by_num))
    results = []
    for n in all_nums:
        gcs_title = gcs_titles.get(n)
        sb_row = sb_by_num.get(n)
        sb_title = sb_row["name"] if sb_row else None
        sb_id = sb_row["id"] if sb_row else None

        if sb_row is None:
            results.append({"gcs_chapter_no": n, "supabase_id": None, "supabase_title": None,
                            "gcs_title": gcs_title, "status": "UNMAPPED",
                            "reason": "no Supabase chapter row for this number at all"})
            continue
        if gcs_title is None:
            results.append({"gcs_chapter_no": n, "supabase_id": sb_id, "supabase_title": sb_title,
                            "gcs_title": None, "status": "UNMAPPED",
                            "reason": "GCS ingestion never captured a real title for this chapter "
                                     "(a section_header block was never recognised on its opening page)"})
            continue
        if RUNNING_HEAD.match(sb_title):
            results.append({"gcs_chapter_no": n, "supabase_id": sb_id, "supabase_title": sb_title,
                            "gcs_title": gcs_title, "status": "FIX_TITLE",
                            "reason": "Supabase title is the raw running-head marker, not a real title"})
            continue
        overlap = _title_overlap(gcs_title, sb_title)
        if overlap >= 0.5:
            results.append({"gcs_chapter_no": n, "supabase_id": sb_id, "supabase_title": sb_title,
                            "gcs_title": gcs_title, "status": "CONFIRM",
                            "reason": f"title overlap={overlap:.2f}"})
        else:
            results.append({"gcs_chapter_no": n, "supabase_id": sb_id, "supabase_title": sb_title,
                            "gcs_title": gcs_title, "status": "REVIEW",
                            "reason": f"number matches but title overlap only {overlap:.2f} -- "
                                     f"confirm by eye before trusting this mapping"})

    # Chapters 1-3 are a structural mismatch (merge/split), not a per-number
    # naming difference -- called out separately so it isn't lost among the
    # per-number rows above (GCS ch1 already appears UNMAPPED there; ch2/ch3
    # never got a Supabase row of their own because 7-1 absorbed both).
    return results


def print_report(results: list[dict]) -> None:
    by_status: dict[str, list[dict]] = {}
    for r in results:
        by_status.setdefault(r["status"], []).append(r)

    order = ["CONFIRM", "FIX_TITLE", "REVIEW", "UNMAPPED"]
    for status in order:
        rows = by_status.get(status, [])
        if not rows:
            continue
        print(f"\n{'=' * 70}\n{status}  ({len(rows)})\n{'=' * 70}")
        for r in rows:
            print(f"  gcs_ch={r['gcs_chapter_no']:<3} supabase={r['supabase_id'] or '(none)':<6} "
                 f"| {r['reason']}")
            print(f"    GCS title     : {r['gcs_title']}")
            print(f"    Supabase title: {r['supabase_title']}")

    n = len(results)
    mappable = len(by_status.get("CONFIRM", [])) + len(by_status.get("FIX_TITLE", [])) + len(by_status.get("REVIEW", []))
    print(f"\n{'=' * 70}")
    print(f"SUMMARY: {mappable}/{n} chapter numbers get a mapping "
         f"({len(by_status.get('CONFIRM', []))} confirmed, "
         f"{len(by_status.get('FIX_TITLE', []))} confirmed+title-fix, "
         f"{len(by_status.get('REVIEW', []))} confirmed-but-flagged), "
         f"{len(by_status.get('UNMAPPED', []))} left NULL pending a human decision.")
    print("\nThis is a DRY RUN. No writes were made. See the script docstring for")
    print("what UNMAPPED/REVIEW rows need before they can be included.")


def print_sql(results: list[dict]) -> None:
    """UPDATE statements for the rows safe to apply: CONFIRM and FIX_TITLE
    only. REVIEW and UNMAPPED rows are deliberately excluded -- per the
    2026-09-22 decision, those stay NULL for v1 rather than guessed."""
    print("-- Generated by map_class7_chapters.py -- do not hand-edit the")
    print("-- values, re-run the script if the source data changes.")
    for r in results:
        if r["status"] not in ("CONFIRM", "FIX_TITLE"):
            continue
        sid = r["supabase_id"]
        if r["status"] == "FIX_TITLE":
            title = r["gcs_title"].replace("'", "''")
            print(f"UPDATE chapters SET gcs_chapter_no = {r['gcs_chapter_no']}, "
                 f"name = '{title}' WHERE id = '{sid}';")
        else:
            print(f"UPDATE chapters SET gcs_chapter_no = {r['gcs_chapter_no']} "
                 f"WHERE id = '{sid}';")


if __name__ == "__main__":
    diff = build_diff()
    if "--sql" in sys.argv:
        print_sql(diff)
    else:
        print_report(diff)
