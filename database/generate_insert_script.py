"""
generate_insert_script.py
=========================
Reads  service/content/extractor/output/class_7_page_content.xlsx
(columns: page_number | content — raw OCR text from the Class 7 Bengali
math textbook) and produces a ready-to-run SQL seed file at
database/seed_class7.sql that populates the tables defined in
database/ddl.sh:

    classes → chapters → topics → questions → options

Strategy
--------
1. Load all page text from the Excel file.
2. Detect chapter boundaries by scanning for the "অধ্যায় : N" marker
   that appears in page headers throughout the book.
3. For each chapter, send the combined page text to Gemini
   (gemini-2.5-flash) with a prompt that both *extracts* questions and
   *professionally reformulates* any ill-formed ones (e.g. fill-in-blank
   boxes, incomplete stems) into clear, self-contained questions.
4. Emit INSERT statements in dependency order (classes → chapters →
   topics → questions → options) that are compatible with SQLite.

Output
------
database/seed_class7.sql  — run this against bengali_curriculam.db

Usage
-----
    cd database
    python generate_insert_script.py

    # Apply to SQLite:
    sqlite3 bengali_curriculam.db < seed_class7.sql

Configuration (resolved in order)
----------------------------------
  1. database/.env
  2. service/content/extractor/.env  (already has GOOGLE_API_KEY)
  3. Environment variables

Required env var:
    GOOGLE_API_KEY

Optional env vars:
    GEMINI_MODEL  — default: gemini-2.5-flash
    EXCEL_PATH    — default: ../service/content/extractor/output/class_7_page_content.xlsx
    OUTPUT_SQL    — default: seed_class7.sql  (written next to this script)
    CLASS_ID      — default: 7
"""

import json
import os
import re
import sys
import unicodedata
from pathlib import Path

# Force UTF-8 on Windows consoles so Bengali text in log output doesn't crash
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ─── resolve .env files ────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    _here = Path(__file__).parent
    load_dotenv(_here / ".env")
    load_dotenv(_here.parent / "service" / "content" / "extractor" / ".env", override=False)
except ImportError:
    pass  # dotenv optional; rely on environment variables

# ─── configuration ─────────────────────────────────────────────────────────────
_here = Path(__file__).parent

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
CLASS_ID       = int(os.getenv("CLASS_ID", 7))
EXCEL_PATH     = os.getenv(
    "EXCEL_PATH",
    str(_here.parent / "service" / "content" / "extractor" / "output" / "class_7_page_content.xlsx"),
)
OUTPUT_SQL = os.getenv("OUTPUT_SQL", str(_here / "seed_class7.sql"))

if not GOOGLE_API_KEY:
    sys.exit(
        "ERROR: GOOGLE_API_KEY is not set.\n"
        "  Add it to database/.env  OR  service/content/extractor/.env"
    )

try:
    import openpyxl
except ImportError:
    sys.exit("ERROR: openpyxl is required.  Install with:  pip install openpyxl")

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:
    sys.exit("ERROR: google-genai SDK is required.  Install with:  pip install google-genai")

_gemini = genai.Client(api_key=GOOGLE_API_KEY)


# ══════════════════════════════════════════════════════════════════════════════
# 1. Load Excel
# ══════════════════════════════════════════════════════════════════════════════

def load_pages(excel_path: str) -> dict[int, str]:
    """
    Return {page_number: content_text} from the PageContent sheet.

    All content is NFC-normalised so Bengali characters with dual
    representations (e.g. য় as U+09DF vs U+09AF+U+09BC) are unified,
    making regex matching reliable regardless of how the OCR encoded them.
    """
    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active
    pages: dict[int, str] = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        page_num, content = row[0], row[1]
        if page_num is not None:
            text = unicodedata.normalize("NFC", (content or "").strip())
            pages[int(page_num)] = text
    return pages


# ══════════════════════════════════════════════════════════════════════════════
# 2. Chapter boundary detection
# ══════════════════════════════════════════════════════════════════════════════

# Matches "অধ্যায় : 3" or "অধ্যায়: 12" anywhere in a page.
# Pattern string is NFC-normalised to match both composed/decomposed Bengali forms.
_CH_MARKER = re.compile(
    unicodedata.normalize("NFC", r"অধ্যায়") + r"\s*[:\|।]\s*(\d+)",
    re.UNICODE,
)


def detect_chapters(pages: dict[int, str]) -> list[dict]:
    """
    Scan every page for the chapter marker "অধ্যায় : N".
    Return a list of dicts (sorted by chapter_num):
        {"chapter_num": int, "pages": [list of page numbers]}

    The first page a given chapter number appears is taken as the chapter
    boundary — pages from there up to (not including) the next chapter
    boundary belong to that chapter.
    """
    chapter_first_page: dict[int, int] = {}

    for page_num in sorted(pages):
        for match in _CH_MARKER.finditer(pages[page_num]):
            ch_num = int(match.group(1))
            if ch_num not in chapter_first_page:
                chapter_first_page[ch_num] = page_num

    if not chapter_first_page:
        all_pages = sorted(pages)
        return [{"chapter_num": 1, "pages": all_pages}]

    sorted_ch = sorted(chapter_first_page.items())
    all_sorted_pages = sorted(pages)
    result = []

    for idx, (ch_num, first_page) in enumerate(sorted_ch):
        if idx + 1 < len(sorted_ch):
            next_first = sorted_ch[idx + 1][1]
            ch_pages = [p for p in all_sorted_pages if first_page <= p < next_first]
        else:
            ch_pages = [p for p in all_sorted_pages if p >= first_page]

        result.append({"chapter_num": ch_num, "pages": ch_pages})

    return result


# ══════════════════════════════════════════════════════════════════════════════
# 3. Gemini extraction & question reformulation
# ══════════════════════════════════════════════════════════════════════════════

_EXTRACTION_PROMPT = """\
You are an expert Bengali mathematics educator analysing pages from the
West Bengal Board Class 7 textbook "গণিতপ্রভা সপ্তম শ্রেণি".

The raw OCR text of one chapter is provided above, delimited by
"--- PAGE N ---" markers.  Your job has two parts:

PART A — EXTRACT
  Identify every question present, including:
  • Numbered / lettered exercises (অনুশীলনী, নিজে করি, করো, ইত্যাদি)
  • Worked examples (উদাহরণ) — extract the problem statement
  • Fill-in-the-blank items (boxes ☐ or underscores ____)
  • Word problems, application problems
  • MCQ items (if any)
  For sub-parts (i, ii, iii… or a, b, c…) create ONE entry per sub-part,
  always prepending the common stem so the question is self-contained.

PART B — WELLFORM (professional reformulation)
  Rewrite each extracted question into a clear, professionally worded
  Bengali question sentence so that:
  • Fill-in-blank boxes (☐) are replaced by "কত?" or an appropriate
    question phrase — e.g. "☐ টি বলে" → "কতটি বল রং করা হবে?"
  • Incomplete or telegraphic stems are expanded into full sentences.
  • The mathematical content and numbers remain exactly as in the original.
  • Language is formal, grammatically correct Bengali (শুদ্ধ বাংলা).
  • Do NOT change the mathematical meaning or add new information.

OUTPUT — return ONLY a single valid JSON object, no markdown fences:

{
  "chapter_name": "<Bengali chapter title as printed in the book>",
  "chapter_description": "<one concise Bengali sentence describing the chapter>",
  "topics": [
    {
      "topic_name": "<Bengali section name, e.g. 'নিজে করি ১.১', 'অনুশীলনী', 'উদাহরণ'>",
      "topic_description": "<one concise Bengali sentence>",
      "questions": [
        {
          "type": "short|mcq|long",
          "text": "<professionally worded complete question in Bengali>",
          "answer": "<printed answer verbatim, or empty string>",
          "solution": "<verbatim printed worked steps for উদাহরণ only; empty string otherwise>",
          "difficulty": "easy|medium|hard",
          "options": ["<opt1>", "<opt2>", "<opt3>", "<opt4>"]
        }
      ]
    }
  ]
}

FIELD RULES
  type       : "short" — single-step calculation, fill-in-blank, direct answer
               "mcq"   — multiple-choice (options list must have exactly 4 items)
               "long"  — word problem, proof, or multi-step reasoning
  difficulty : "easy"   — single operation or direct recall
               "medium" — two or three logical steps
               "hard"   — multi-concept, proof, or complex word problem
  options    : non-empty ONLY for "mcq"; use [] for all other types
  answer     : for MCQ give the correct option text (not the index number)
  solution   : ONLY for উদাহরণ (examples) — copy verbatim; NEVER invent solutions

IMPORTANT
  • Output strictly valid JSON — no trailing commas, no comments.
  • All text fields must be in Bengali script.
  • Do not skip any question, no matter how simple.
"""


def _build_chapter_text(pages: dict[int, str], page_nums: list[int]) -> str:
    """Join page contents with page-boundary markers."""
    parts = []
    for pg in page_nums:
        content = pages.get(pg, "")
        if content:
            parts.append(f"--- PAGE {pg} ---\n{content}")
    return "\n\n".join(parts)


def _parse_json_robust(text: str) -> dict:
    """Parse JSON from Gemini response, stripping markdown fences if present."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```\s*$", "", text.strip())

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    try:
        from json_repair import repair_json  # type: ignore
        return json.loads(repair_json(text))
    except (ImportError, Exception):
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON:\n{text[:600]}")


_STRICT_JSON_RETRY_PROMPT = """\
Your previous response was not valid JSON. You MUST return ONLY a JSON object.

No markdown formatting, no bullet points, no explanations — just raw JSON.

Start your response with { and end it with }

Required structure:
{
  "chapter_name": "...",
  "chapter_description": "...",
  "topics": [
    {
      "topic_name": "...",
      "topic_description": "...",
      "questions": [
        {
          "type": "short",
          "text": "...",
          "answer": "...",
          "solution": "",
          "difficulty": "easy",
          "options": []
        }
      ]
    }
  ]
}

Extract questions from the chapter text provided earlier.
Output ONLY the JSON object. Nothing else.
"""


def _call_gemini(contents: list) -> str:
    """Send a list of Part objects to Gemini and return the response text."""
    response = _gemini.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=genai_types.GenerateContentConfig(
            temperature=0.1,
            max_output_tokens=8192,
        ),
    )
    return response.text


def extract_chapter_data(chapter_num: int, pages: dict[int, str], page_nums: list[int]) -> dict:
    """
    Call Gemini to extract and wellform questions from one chapter's pages.
    Retries once with a stricter JSON-only prompt if the first response is
    not parseable as JSON (Gemini occasionally returns markdown prose).
    Returns the parsed JSON dict.
    """
    chapter_text = _build_chapter_text(pages, page_nums)

    # Gemini 2.5 Flash supports ~1M token context; cap at 200k chars to be safe
    MAX_CHARS = 200_000
    if len(chapter_text) > MAX_CHARS:
        chapter_text = chapter_text[:MAX_CHARS] + "\n\n[...content truncated...]"

    chapter_part = genai_types.Part.from_text(
        text=(
            f"Chapter {chapter_num} — raw page text "
            f"({len(page_nums)} pages):\n\n{chapter_text}"
        )
    )

    # Attempt 1 — full extraction + wellform prompt
    raw = _call_gemini([chapter_part, genai_types.Part.from_text(text=_EXTRACTION_PROMPT)])
    try:
        return _parse_json_robust(raw)
    except ValueError:
        pass

    # Attempt 2 — retry with a strict JSON-only prompt (Gemini returned prose)
    raw2 = _call_gemini([
        chapter_part,
        genai_types.Part.from_text(text=_EXTRACTION_PROMPT),
        genai_types.Part.from_text(text=_STRICT_JSON_RETRY_PROMPT),
    ])
    return _parse_json_robust(raw2)


# ══════════════════════════════════════════════════════════════════════════════
# 4. SQL generation (SQLite-compatible)
# ══════════════════════════════════════════════════════════════════════════════

def _esc(value: str) -> str:
    """Escape single quotes for SQLite string literals."""
    return str(value).replace("'", "''")


def _safe_type(value: str) -> str:
    v = str(value).strip().lower()
    return v if v in ("short", "mcq", "long") else "short"


def _safe_difficulty(value: str) -> str:
    v = str(value).strip().lower()
    return v if v in ("easy", "medium", "hard") else "easy"


def generate_sql(class_id: int, chapters_data: list[tuple[int, dict]]) -> str:
    """
    Build the complete SQL seed file content for Supabase (PostgreSQL).
    Insertion order respects foreign-key dependencies:
        classes → chapters → topics → questions → options
    Uses INSERT ... ON CONFLICT (id) DO NOTHING so the script is idempotent (safe to re-run).
    """
    lines: list[str] = [
        "-- ═══════════════════════════════════════════════════════════════",
        "-- Auto-generated by database/generate_insert_script.py",
        "-- Source  : service/content/extractor/output/class_7_page_content.xlsx",
        "-- Schema  : database/ddl.sh",
        "-- Model   : " + GEMINI_MODEL,
        "-- Target  : Supabase PostgreSQL",
        "--",
        "-- Apply   : Paste into Supabase SQL Editor and run",
        "-- ═══════════════════════════════════════════════════════════════",
        "",
    ]

    # ── classes ──────────────────────────────────────────────────────────────
    lines += [
        "-- ─── classes ───────────────────────────────────────────────────",
        (
            f"INSERT INTO classes (id, name, bengali_name) VALUES "
            f"({class_id}, 'Class {class_id}', 'সপ্তম শ্রেণী') ON CONFLICT (id) DO NOTHING;"
        ),
        "",
    ]

    # ── chapters ─────────────────────────────────────────────────────────────
    lines.append("-- ─── chapters ──────────────────────────────────────────────────")
    for ch_num, ch_data in chapters_data:
        ch_id   = f"{class_id}-{ch_num}"
        ch_name = _esc(ch_data.get("chapter_name", f"অধ্যায় {ch_num}"))
        ch_desc = _esc(ch_data.get("chapter_description", ""))
        lines.append(
            f"INSERT INTO chapters (id, class_id, name, description) VALUES "
            f"('{ch_id}', {class_id}, '{ch_name}', '{ch_desc}') ON CONFLICT (id) DO NOTHING;"
        )
    lines.append("")

    # ── topics ───────────────────────────────────────────────────────────────
    lines.append("-- ─── topics ────────────────────────────────────────────────────")
    for ch_num, ch_data in chapters_data:
        ch_id = f"{class_id}-{ch_num}"
        for t_idx, topic in enumerate(ch_data.get("topics", []), start=1):
            t_id   = f"{ch_id}-{t_idx}"
            t_name = _esc(topic.get("topic_name", f"বিষয় {t_idx}"))
            t_desc = _esc(topic.get("topic_description", ""))
            lines.append(
                f"INSERT INTO topics (id, chapter_id, name, description) VALUES "
                f"('{t_id}', '{ch_id}', '{t_name}', '{t_desc}') ON CONFLICT (id) DO NOTHING;"
            )
    lines.append("")

    # ── questions ────────────────────────────────────────────────────────────
    lines.append("-- ─── questions ─────────────────────────────────────────────────")
    option_inserts: list[str] = []

    for ch_num, ch_data in chapters_data:
        ch_id = f"{class_id}-{ch_num}"
        for t_idx, topic in enumerate(ch_data.get("topics", []), start=1):
            t_id = f"{ch_id}-{t_idx}"
            for q_idx, q in enumerate(topic.get("questions", []), start=1):
                q_id   = f"{t_id}-{q_idx}"
                q_type = _safe_type(q.get("type", "short"))
                q_text = _esc(q.get("text", ""))
                q_ans  = _esc(q.get("answer", ""))
                q_sol  = _esc(q.get("solution", ""))
                q_diff = _safe_difficulty(q.get("difficulty", "easy"))

                lines.append(
                    f"INSERT INTO questions "
                    f"(id, topic_id, type, text, answer, solution, difficulty) VALUES "
                    f"('{q_id}', '{t_id}', '{q_type}', '{q_text}', "
                    f"'{q_ans}', '{q_sol}', '{q_diff}') ON CONFLICT (id) DO NOTHING;"
                )

                # Collect MCQ options
                if q_type == "mcq":
                    answer_text = q.get("answer", "").strip()
                    for opt_text in q.get("options", []):
                        is_correct = 1 if str(opt_text).strip() == answer_text else 0
                        option_inserts.append(
                            f"INSERT INTO options (question_id, option_text, is_correct) VALUES "
                            f"('{q_id}', '{_esc(str(opt_text))}', {is_correct});"
                        )

    lines.append("")

    # ── options ──────────────────────────────────────────────────────────────
    if option_inserts:
        lines.append("-- ─── options (MCQ) ─────────────────────────────────────────────")
        lines.extend(option_inserts)
        lines.append("")

    lines.append("-- ─── end of seed ───────────────────────────────────────────────")
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
# 5. Entry point
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("=" * 65)
    print("  Bengali Math — DB Insert Script Generator  (Gemini)")
    print("=" * 65)

    # ── Step 1: load Excel ────────────────────────────────────────────────────
    excel_path = Path(EXCEL_PATH)
    if not excel_path.exists():
        sys.exit(f"ERROR: Excel file not found: {excel_path}")

    print(f"\n[1/4] Loading pages from:\n      {excel_path}")
    pages = load_pages(str(excel_path))
    print(f"      Loaded {len(pages)} pages  "
          f"(page numbers {min(pages)}-{max(pages)})")

    # ── Step 2: detect chapters ───────────────────────────────────────────────
    print("\n[2/4] Detecting chapter boundaries...")
    chapter_groups = detect_chapters(pages)
    print(f"      Found {len(chapter_groups)} chapter(s):")
    for cg in chapter_groups:
        pg_list = cg["pages"]
        print(
            f"        Ch{cg['chapter_num']:>2} -- "
            f"pages {pg_list[0]}-{pg_list[-1]}  ({len(pg_list)} pages)"
        )

    # ── Step 3: extract + wellform via Gemini ────────────────────────────────
    print(f"\n[3/4] Extracting questions with Gemini ({GEMINI_MODEL})...")
    chapters_data: list[tuple[int, dict]] = []

    for cg in chapter_groups:
        ch_num  = cg["chapter_num"]
        pg_list = cg["pages"]
        print(f"\n  Chapter {ch_num}  ({len(pg_list)} pages)...", end=" ", flush=True)
        try:
            data = extract_chapter_data(ch_num, pages, pg_list)
            chapters_data.append((ch_num, data))
            n_topics    = len(data.get("topics", []))
            n_questions = sum(len(t.get("questions", [])) for t in data.get("topics", []))
            print(f"OK  ->  {n_topics} topic(s), {n_questions} question(s)")
        except Exception as exc:
            print(f"FAILED: {exc}")
            # Keep a placeholder chapter row so the chapter INSERT is preserved
            chapters_data.append((ch_num, {
                "chapter_name": f"অধ্যায় {ch_num}",
                "chapter_description": "",
                "topics": [],
            }))

    # ── Step 4: generate SQL ──────────────────────────────────────────────────
    print("\n[4/4] Generating SQL INSERT statements...")
    sql_content = generate_sql(CLASS_ID, chapters_data)

    out_path = Path(OUTPUT_SQL)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(sql_content, encoding="utf-8")

    total_inserts = sql_content.count("INSERT")
    total_q = sum(
        sum(len(t.get("questions", [])) for t in data.get("topics", []))
        for _, data in chapters_data
    )

    print(f"\n{'=' * 65}")
    print(f"  Output  : {out_path}")
    print(f"  Model   : {GEMINI_MODEL}")
    print(f"  INSERT statements : {total_inserts}")
    print(f"  Questions         : {total_q}")
    print(f"\n  Apply to DB:")
    print(f"    sqlite3 database/bengali_curriculam.db < {out_path.name}")
    print("=" * 65)


if __name__ == "__main__":
    main()
