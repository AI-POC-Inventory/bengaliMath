"""Admin lesson generator: retrieve -> outline -> sections -> verify -> stage.

A "lesson" is the long-form, beginner-friendly explanation of one chapter that
students read on the chapter details page. It follows the same
generate -> admin review -> publish flow as the question generator, and reuses
its plumbing (chapter->book-chapter mapping, hybrid retrieval over the GCS
textbook index, the Gemini call helper, GenerationError).

Pipeline for one POST /api/admin/lessons/generate call:
  1. resolve the chapter's book chapters from chapter_gcs_map
  2. OUTLINE: one LLM call over broad chapter context -> overview,
     prerequisites and 3-7 concept sections (not the Supabase "topics": those
     are exercise labels like "কষে দেখি-14", useless as lesson units)
  3. SECTIONS: one LLM call per section, each with context retrieved for that
     section, run in parallel
  4. VERIFY: one LLM call re-solves every worked example independently and
     flags disagreements, so an admin sees "যাচাই ব্যর্থ" instead of a silent
     wrong answer in front of a child. A signal for the reviewer, not proof.
  5. insert into generated_lessons as a 'draft'

Grounding rule (in the prompts): definitions, formulas, rules and notation
must come from the retrieved textbook text; the model may add plain-language
explanation, everyday analogies and NEW worked examples, but no new rules.

Publishing is NOT done here: approve/unpublish are Postgres functions
(database/supabase/007_chapter_lessons.sql) so the status flip and the
chapters.details write happen in one transaction.
"""
import json
import logging
import os
import random
import re
import string
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from supabase_client import supabase

from question_generator import (
    GenerationError, resolve_chapter, retrieve_context, _call_gemini,
)

log = logging.getLogger("lesson_generator")

LESSON_MODEL = os.environ.get("LESSON_GEN_MODEL", os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
OUTLINE_TOP_K = 30           # broad pass over the whole chapter
SECTION_TOP_K = 14           # focused pass per section
MAX_SECTIONS = 7
MIN_SECTIONS = 2
SECTION_WORKERS = 4
CONTEXT_CHARS = 12000        # per-prompt cap on retrieved text
EDITABLE_STATUSES = {"draft"}

LIST_COLUMNS = "id,class_id,chapter_id,version,status,model,created_at,updated_at,reviewed_at"


# ── Prompts ──────────────────────────────────────────────────────────────

_MATH_TEXT_RULE = (
    "গাণিতিক লেখা সাধারণ টেক্সটে লিখবে: ভগ্নাংশ 3/4, ঘাত 10² বা 2^3, চিহ্ন × ÷ ≈ °। "
    "LaTeX বা markdown (**, #, $) ব্যবহার করবে না। সংখ্যা পাঠ্যবইয়ের মতো (0-9) লিখবে।"
)


def _outline_prompt(chapter_name: str, context: str) -> str:
    return f"""তুমি একজন অভিজ্ঞ গণিত শিক্ষক। সপ্তম শ্রেণির একটি অধ্যায়ের পাঠ পরিকল্পনা করছ।

অধ্যায়: {chapter_name}

নিচে পাঠ্যপুস্তক থেকে অধ্যায়টির প্রাসঙ্গিক অংশ দেওয়া হলো।
--- প্রসঙ্গ শুরু ---
{context[:CONTEXT_CHARS]}
--- প্রসঙ্গ শেষ ---

কাজ: অধ্যায়টি এমন একজন শিক্ষার্থীকে শেখানোর জন্য সাজাও যে বিষয়টি একেবারে গোড়া থেকে শিখছে।
১. অধ্যায়টিকে {MIN_SECTIONS} থেকে {MAX_SECTIONS}টি ধারণা-ভিত্তিক অংশে ভাগ করো, সহজ থেকে কঠিন ক্রমে।
২. শুধু প্রসঙ্গে থাকা বিষয় ব্যবহার করো। "কষে দেখি", "নিজে করি"-র মতো অনুশীলনীর নাম অংশের শিরোনাম হবে না।
৩. overview: অধ্যায়টি কী নিয়ে এবং দৈনন্দিন জীবনে কেন কাজে লাগে - ২ থেকে ৪টি সহজ বাক্যে।
৪. prerequisites: শুরুর আগে যা জানা দরকার (২-৪টি ছোট বাক্যাংশ); নিশ্চিত না হলে ফাঁকা তালিকা দাও।

শুধু নিচের JSON ফরম্যাটে উত্তর দাও:
{{"overview": "...", "prerequisites": ["..."], "sections": [{{"title": "অংশের শিরোনাম", "focus": "এই অংশে কোন ধারণা/নিয়ম/পদ্ধতি শেখানো হবে (এক বাক্যে)"}}]}}"""


def _section_prompt(chapter_name: str, title: str, focus: str, context: str) -> str:
    return f"""তুমি একজন ধৈর্যশীল গণিত শিক্ষক। শিক্ষার্থী বিষয়টি একেবারে গোড়া থেকে শিখছে - কোনো কিছু আগে থেকে জানা ধরে নেবে না।

অধ্যায়: {chapter_name}
অংশ: {title} - {focus}

--- পাঠ্যবইয়ের প্রসঙ্গ শুরু ---
{context[:CONTEXT_CHARS]}
--- প্রসঙ্গ শেষ ---

নিয়ম:
১. সংজ্ঞা, সূত্র, নিয়ম ও চিহ্ন শুধুই উপরের প্রসঙ্গ থেকে নেবে। প্রসঙ্গে নেই এমন কোনো নতুন নিয়ম, সূত্র বা তথ্য যোগ করবে না।
২. বোঝানোর জন্য সহজ ভাষা, দৈনন্দিন জীবনের উপমা এবং নতুন উদাহরণ ব্যবহার করতে পারো।
৩. ভাষা সহজ বাংলা, ছোট বাক্য। কোনো কঠিন শব্দ প্রথমবার এলে সহজ কথায় বুঝিয়ে দাও।
৪. explanation: ধাপে ধাপে ২ থেকে ৪টি অনুচ্ছেদ; অনুচ্ছেদের মাঝে একটি ফাঁকা লাইন।
৫. keyPoints: মনে রাখার মতো সংজ্ঞা/নিয়ম (২-৪টি), পাঠ্যবইয়ের শব্দে।
৬. examples: ২ থেকে ৩টি, সহজ থেকে কঠিন। প্রথমটি পাঠ্যবইয়ের উদাহরণ হলে ভালো। steps-এর প্রতিটি ধাপ আলাদা এলিমেন্ট, প্রতি ধাপে কী করছি ও কেন - সংক্ষেপে। answer-এ শুধু চূড়ান্ত উত্তর।
৭. প্রতিটি গণনা সাবধানে যাচাই করে লিখবে; ভুল উত্তর কোনোভাবেই চলবে না।
৮. commonMistakes: শিক্ষার্থীরা সাধারণত যে ভুল করে (১-৩টি)। quickCheck: উত্তরসহ ২-৩টি ছোট প্রশ্ন (উত্তর সংক্ষিপ্ত)। takeaway: এই অংশের মূল কথা এক বাক্যে।
৯. {_MATH_TEXT_RULE}

শুধু নিচের JSON ফরম্যাটে উত্তর দাও:
{{"title": "{title}", "explanation": "...", "keyPoints": ["..."],
  "examples": [{{"problem": "...", "steps": ["ধাপ ১", "ধাপ ২"], "answer": "..."}}],
  "commonMistakes": ["..."], "quickCheck": [{{"question": "...", "answer": "..."}}], "takeaway": "..."}}"""


def _verify_prompt(items: list[dict]) -> str:
    return f"""নিচের প্রতিটি গণিত সমস্যা তুমি নিজে ধাপে ধাপে সমাধান করো এবং নিজের উত্তর লেখো। তারপর দেখো তোমার উত্তর "claimedAnswer"-এর সাথে মেলে কি না।
রূপ আলাদা হলেও মান একই হলে (যেমন 0.5 ও 1/2) মিলেছে ধরবে। মান আলাদা হলে matches = false।

{json.dumps(items, ensure_ascii=False)}

শুধু JSON অ্যারে দাও, প্রতিটি সমস্যার জন্য একটি করে:
[{{"i": 0, "myAnswer": "...", "matches": true}}]"""


# ── LLM plumbing ─────────────────────────────────────────────────────────

def _loads(raw: str):
    """Parse the model's JSON, tolerating stray text around it."""
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        pass
    for pattern in (r"\{[\s\S]*\}", r"\[[\s\S]*\]"):
        m = re.search(pattern, raw or "")
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                continue
    return None


def _call_json(prompt: str, want: type, temperature: float, attempts: int = 2):
    """LLM call that must return JSON of type `want` (dict or list); retries
    once on unparseable output. Returns None if every attempt fails."""
    for attempt in range(attempts):
        try:
            data = _loads(_call_gemini(prompt, temperature=temperature, model=LESSON_MODEL))
        except GenerationError:
            raise
        except Exception as e:                                  # noqa: BLE001
            log.warning("lesson LLM call failed (attempt %d): %s", attempt + 1, e)
            data = None
        if isinstance(data, want):
            return data
    return None


# ── Content validation (used for generated AND admin-edited content) ─────

def _text(value, limit: int = 8000) -> str:
    return value.strip()[:limit] if isinstance(value, str) else ""


def _lines(value) -> list[str]:
    if isinstance(value, str):
        value = value.split("\n")
    if not isinstance(value, list):
        return []
    return [t for t in (_text(v, 2000) for v in value) if t]


def validate_content(content) -> dict:
    """Normalize and validate lesson content. Raises GenerationError(400) with
    a message an admin can act on. Returns the cleaned dict."""
    if not isinstance(content, dict):
        raise GenerationError("পাঠের কনটেন্ট সঠিক ফরম্যাটে নেই", 400)
    raw_sections = content.get("sections")
    if not isinstance(raw_sections, list) or not raw_sections:
        raise GenerationError("কমপক্ষে একটি অংশ (section) থাকতে হবে", 400)
    if len(raw_sections) > 12:
        raise GenerationError("অংশের সংখ্যা ১২টির বেশি হতে পারবে না", 400)

    sections = []
    for i, s in enumerate(raw_sections, start=1):
        if not isinstance(s, dict):
            raise GenerationError(f"অংশ {i} সঠিক ফরম্যাটে নেই", 400)
        title, explanation = _text(s.get("title"), 300), _text(s.get("explanation"))
        if not title or not explanation:
            raise GenerationError(f"অংশ {i}-এর শিরোনাম ও ব্যাখ্যা দুটিই থাকতে হবে", 400)

        examples = []
        for ex in (s.get("examples") or []):
            if not isinstance(ex, dict) or not _text(ex.get("problem")):
                continue
            verified = ex.get("verified")
            examples.append({
                "problem": _text(ex.get("problem")),
                "steps": _lines(ex.get("steps")),
                "answer": _text(ex.get("answer"), 2000),
                "verified": verified if isinstance(verified, bool) else None,
            })

        quick = [{"question": _text(q.get("question"), 2000), "answer": _text(q.get("answer"), 2000)}
                 for q in (s.get("quickCheck") or [])
                 if isinstance(q, dict) and _text(q.get("question"))]

        sections.append({
            "title": title, "explanation": explanation,
            "keyPoints": _lines(s.get("keyPoints")), "examples": examples,
            "commonMistakes": _lines(s.get("commonMistakes")),
            "quickCheck": quick, "takeaway": _text(s.get("takeaway"), 1000),
        })

    return {
        "version": 1,
        "overview": _text(content.get("overview"), 3000),
        "prerequisites": _lines(content.get("prerequisites")),
        "sections": sections,
    }


# ── Generation ───────────────────────────────────────────────────────────

def _make_section(chapter_name: str, gcs_chapter_nos: list[int], plan: dict) -> tuple[dict | None, list[str]]:
    title = _text(plan.get("title"), 300)
    focus = _text(plan.get("focus"), 600)
    topic = {"name": title, "description": focus}
    try:
        context, chunk_ids = retrieve_context(topic, gcs_chapter_nos, top_k=SECTION_TOP_K)
    except GenerationError as e:
        log.warning("no context for section %r: %s", title, e.message)
        return None, []
    data = _call_json(_section_prompt(chapter_name, title, focus, context), dict, temperature=0.4)
    return data, chunk_ids


def _verify_examples(sections: list[dict]) -> None:
    """Mutates examples in place: verified True/False, or None if the check
    itself could not run. One call covers every example in the lesson."""
    refs, items = [], []
    for si, s in enumerate(sections):
        for ei, ex in enumerate(s["examples"]):
            refs.append((si, ei))
            items.append({"i": len(items), "problem": ex["problem"], "claimedAnswer": ex["answer"]})
    if not items:
        return
    result = _call_json(_verify_prompt(items), list, temperature=0.0)
    if result is None:
        log.warning("example verification unavailable; examples left unchecked")
        return
    by_index = {r.get("i"): r for r in result if isinstance(r, dict)}
    for idx, (si, ei) in enumerate(refs):
        r = by_index.get(idx)
        if r is not None and isinstance(r.get("matches"), bool):
            sections[si]["examples"][ei]["verified"] = r["matches"]


def build_lesson(chapter_name: str, gcs_chapter_nos: list[int]) -> tuple[dict, list[str]]:
    """The full LLM pipeline for one chapter. Returns (validated content,
    every source chunk id). No database access -- testable on its own."""
    outline_ctx, outline_ids = retrieve_context(
        {"name": chapter_name, "description": "সংজ্ঞা নিয়ম উদাহরণ"}, gcs_chapter_nos, top_k=OUTLINE_TOP_K)
    outline = _call_json(_outline_prompt(chapter_name, outline_ctx), dict, temperature=0.3)
    plans = [p for p in (outline or {}).get("sections", []) if isinstance(p, dict) and _text(p.get("title"))]
    if len(plans) < MIN_SECTIONS:
        raise GenerationError("পাঠের রূপরেখা তৈরি করা যায়নি, আবার চেষ্টা করুন।", 502)
    plans = plans[:MAX_SECTIONS]

    with ThreadPoolExecutor(max_workers=SECTION_WORKERS) as pool:
        made = list(pool.map(lambda p: _make_section(chapter_name, gcs_chapter_nos, p), plans))

    sections, chunk_ids = [], list(outline_ids)
    for plan, (data, ids) in zip(plans, made):
        if data is None:
            log.warning("section %r failed and was skipped", plan.get("title"))
            continue
        data.setdefault("title", plan.get("title"))
        sections.append(data)
        chunk_ids.extend(ids)
    if len(sections) < MIN_SECTIONS:
        raise GenerationError("পাঠের অংশগুলো তৈরি করা যায়নি, আবার চেষ্টা করুন।", 502)

    content = validate_content({
        "overview": (outline or {}).get("overview"),
        "prerequisites": (outline or {}).get("prerequisites"),
        "sections": sections,
    })
    _verify_examples(content["sections"])
    return content, list(dict.fromkeys(chunk_ids))            # de-dupe, keep order


def _next_version(chapter_id: str) -> int:
    rows = (supabase.table("generated_lessons").select("version")
            .eq("chapter_id", chapter_id).order("version", desc=True).limit(1).execute().data)
    return (rows[0]["version"] + 1) if rows else 1


def _insert_draft(class_id: int, chapter_id: str, content: dict,
                  chunk_ids: list[str] | None, model: str | None) -> dict:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    row = {
        "id": f"lsn_{int(time.time() * 1000)}_{suffix}",
        "class_id": class_id, "chapter_id": chapter_id,
        "version": _next_version(chapter_id), "status": "draft",
        "content": content, "source_chunk_ids": chunk_ids, "model": model,
    }
    return supabase.table("generated_lessons").insert(row).execute().data[0]


def generate(class_id: int, chapter_id: str) -> dict:
    chapter = resolve_chapter(class_id, chapter_id)
    content, chunk_ids = build_lesson(chapter["name"], chapter["gcs_chapter_nos"])
    return _insert_draft(class_id, chapter_id, content, chunk_ids, LESSON_MODEL)


# ── Review workflow ──────────────────────────────────────────────────────

def list_lessons(class_id: int | None = None, chapter_id: str | None = None,
                 status: str | None = None) -> list[dict]:
    query = supabase.table("generated_lessons").select(LIST_COLUMNS)
    if class_id:
        query = query.eq("class_id", class_id)
    if chapter_id:
        query = query.eq("chapter_id", chapter_id)
    if status:
        query = query.eq("status", status)
    return query.order("chapter_id").order("version", desc=True).execute().data


def get_lesson(lesson_id: str) -> dict:
    rows = supabase.table("generated_lessons").select("*").eq("id", lesson_id).limit(1).execute().data
    if not rows:
        raise GenerationError("পাঠ পাওয়া যায়নি (lesson not found)", 404)
    return rows[0]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def update_lesson(lesson_id: str, content) -> dict:
    lesson = get_lesson(lesson_id)
    if lesson["status"] not in EDITABLE_STATUSES:
        raise GenerationError(
            "শুধু খসড়া (draft) পাঠ সম্পাদনা করা যায়। অনুমোদিত পাঠ বদলাতে 'কপি করে নতুন খসড়া' ব্যবহার করুন।", 409)
    clean = validate_content(content)
    return (supabase.table("generated_lessons")
            .update({"content": clean, "updated_at": _now()})
            .eq("id", lesson_id).execute().data[0])


def reject_lesson(lesson_id: str) -> dict:
    lesson = get_lesson(lesson_id)
    if lesson["status"] != "draft":
        raise GenerationError(f"শুধু খসড়া বাতিল করা যায় (এটি এখন {lesson['status']})", 409)
    return (supabase.table("generated_lessons")
            .update({"status": "rejected", "reviewed_at": _now(), "updated_at": _now()})
            .eq("id", lesson_id).execute().data[0])


def clone_lesson(lesson_id: str) -> dict:
    """New draft (next version) from any existing lesson -- the safe way to
    edit live content or to revive a rejected one."""
    src = get_lesson(lesson_id)
    return _insert_draft(src["class_id"], src["chapter_id"], src["content"],
                         src.get("source_chunk_ids"), src.get("model"))


def _rpc(name: str, params: dict) -> dict:
    """Call a plpgsql function from 007; translate its RAISE EXCEPTIONs."""
    try:
        return supabase.rpc(name, params).execute().data
    except Exception as e:                                      # noqa: BLE001
        msg = getattr(e, "message", None) or str(e)
        if "not found" in msg:
            raise GenerationError("পাঠ পাওয়া যায়নি (lesson not found)", 404) from e
        if "cannot approve" in msg:
            raise GenerationError("এই অবস্থার পাঠ অনুমোদন করা যায় না (শুধু খসড়া বা আগের সংস্করণ)", 409) from e
        raise


def approve_lesson(lesson_id: str) -> dict:
    validate_content(get_lesson(lesson_id)["content"])         # never publish malformed content
    return _rpc("approve_lesson", {"p_id": lesson_id})


def unpublish_lesson(chapter_id: str) -> dict:
    return _rpc("unpublish_lesson", {"p_chapter_id": chapter_id})
