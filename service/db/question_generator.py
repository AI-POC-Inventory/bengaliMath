"""Admin question generator: retrieve -> generate -> dedup -> stage.

Mirrors the existing daily_puzzle_generate() pattern in api.py (google.genai,
GEMINI_API_KEY, response_mime_type="application/json", Bengali prompts) rather
than introducing a new LLM-calling convention.

Pipeline for one POST /api/admin/questions/generate call:
  1. resolve the chapter's book chapters from chapter_gcs_map (400 if none --
     an unmapped chapter is one this feature genuinely cannot serve yet, not
     a bug to paper over). One Supabase chapter can span several book
     chapters (e.g. 7-1 = book ch 2 + 3), hence a table, not a column.
  2. retrieve grounding context from bengali-math-search (the GCS-indexed
     textbook), filtered to each mapped book chapter
  3. generate candidates in small per-difficulty-band batches via Gemini
  4. embed every candidate and every existing question already in that topic,
     flag near-duplicates by cosine similarity (does NOT auto-reject --
     the admin decides, see Admin.tsx's review view)
  5. bulk-insert into generated_questions (status='pending')
  6. best-effort audit blob to GCS -- failure here must not fail the request,
     the staged rows are already the source of truth
"""
import json
import logging
import os
import random
import re
import string
import time

import requests
from supabase_client import supabase

from embed import embed_documents, max_cosine_similarity

log = logging.getLogger("question_generator")

QUESTION_GEN_MODEL = os.environ.get("QUESTION_GEN_MODEL", os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
SEARCH_API_URL = os.environ.get("SEARCH_API_URL", "https://bengali-math-search-989713142030.us-central1.run.app").rstrip("/")
DUP_THRESHOLD = float(os.environ.get("DUP_SIMILARITY_THRESHOLD", "0.90"))
GEN_BATCH_SIZE = 15          # questions per single LLM call (JSON-output reliability)
RETRIEVAL_TOP_K = 20         # chunks pulled from bengali-math-search per request
MAX_COUNT = 100

DIFFICULTY_BN = {"easy": "সহজ", "medium": "মাঝারি", "hard": "কঠিন"}
VALID_TYPES = {"mcq", "short"}


class GenerationError(Exception):
    """Carries an HTTP status + a user-facing (Bengali-friendly) message."""
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# ── Curriculum resolution ────────────────────────────────────────────────

def resolve_chapter(class_id: int, chapter_id: str) -> dict:
    rows = (supabase.table("chapters").select("*")
           .eq("id", chapter_id).eq("class_id", class_id).limit(1).execute().data)
    if not rows:
        raise GenerationError("অধ্যায় পাওয়া যায়নি (chapter not found)", 404)
    chapter = rows[0]
    maps = (supabase.table("chapter_gcs_map").select("gcs_chapter_no")
           .eq("chapter_id", chapter_id).execute().data)
    chapter["gcs_chapter_nos"] = sorted({m["gcs_chapter_no"] for m in maps or []})
    if not chapter["gcs_chapter_nos"]:
        raise GenerationError(
            "এই অধ্যায়ের পাঠ্যবই এখনও ইনডেক্স করা হয়নি, তাই প্রশ্ন তৈরি করা যাচ্ছে না। "
            "(This chapter's textbook content hasn't been indexed/mapped yet.)", 400)
    return chapter


def resolve_topic(chapter_id: str, topic_id: str) -> dict:
    rows = (supabase.table("topics").select("*")
           .eq("id", topic_id).eq("chapter_id", chapter_id).limit(1).execute().data)
    if not rows:
        raise GenerationError("বিষয় পাওয়া যায়নি (topic not found)", 404)
    return rows[0]


# ── Retrieval ─────────────────────────────────────────────────────────────

def _search_chapter(topic: dict, gcs_chapter_no: int, top: int) -> list[dict]:
    """Query bengali-math-search, filtered to one book chapter via the query
    text itself (its own parse_filters() regexes for "অধ্যায় N" -- no API
    change needed on that service, see service/search/serve/retrieve.py)."""
    query = f"{topic['name']} {topic.get('description') or ''} অধ্যায় {gcs_chapter_no}".strip()
    try:
        resp = requests.get(f"{SEARCH_API_URL}/search",
                            params={"q": query, "top": top}, timeout=30)
        resp.raise_for_status()
        return resp.json().get("results", [])
    except requests.RequestException as e:
        raise GenerationError(f"সার্চ সার্ভিসে সংযোগ ব্যর্থ হয়েছে: {e}", 502) from e


def retrieve_context(topic: dict, gcs_chapter_nos: list[int],
                     top_k: int = RETRIEVAL_TOP_K) -> tuple[str, list[str]]:
    """Grounding context for a topic. When the Supabase chapter maps to several
    book chapters, each is searched and the results are interleaved rank by
    rank (the search API returns ranked results without a comparable score),
    so the total stays at top_k and no one chapter crowds out the others."""
    per_chapter = -(-top_k // len(gcs_chapter_nos))      # ceil
    ranked = [_search_chapter(topic, n, per_chapter) for n in gcs_chapter_nos]

    results, seen = [], set()
    for rank in range(per_chapter):
        for chapter_results in ranked:
            if rank < len(chapter_results) and chapter_results[rank].get("id") not in seen:
                seen.add(chapter_results[rank].get("id"))
                results.append(chapter_results[rank])
    results = results[:top_k]

    if not results:
        raise GenerationError(
            "এই বিষয়ের জন্য পাঠ্যবইয়ে কোনো প্রাসঙ্গিক অংশ পাওয়া যায়নি।", 400)

    blocks, chunk_ids = [], []
    for r in results:
        prefix = r.get("context_prefix") or ""
        text = r.get("text") or ""
        blocks.append(f"[{r.get('id')}] {prefix}\n{text}".strip())
        chunk_ids.append(r.get("id"))
    return "\n\n".join(blocks), chunk_ids


# ── Generation ────────────────────────────────────────────────────────────

def _band_counts(count: int, difficulty_mix: dict) -> list[tuple[str, int]]:
    levels = ["easy", "medium", "hard"]
    pct = {lvl: float(difficulty_mix.get(lvl, 0)) for lvl in levels}
    total_pct = sum(pct.values())
    if abs(total_pct - 100.0) > 0.01:
        raise GenerationError(
            f"difficultyMix শতাংশের যোগফল ১০০ হতে হবে (পেয়েছি {total_pct:g})", 400)

    bands, assigned = [], 0
    active = [lvl for lvl in levels if pct[lvl] > 0]
    for i, lvl in enumerate(active):
        if i == len(active) - 1:
            n = count - assigned
        else:
            n = round(count * pct[lvl] / 100)
            assigned += n
        if n > 0:
            bands.append((lvl, n))
    return bands


def _type_split(n: int, question_type: str) -> list[tuple[str, int]]:
    """mixed defaults to ~70% mcq / 30% short, per band."""
    if question_type == "mcq":
        return [("mcq", n)]
    if question_type == "short":
        return [("short", n)]
    mcq_n = round(n * 0.7)
    short_n = n - mcq_n
    return [(t, c) for t, c in (("mcq", mcq_n), ("short", short_n)) if c > 0]


def _build_prompt(topic_name: str, chapter_no: str, context: str,
                  n: int, difficulty: str, qtype: str) -> str:
    diff_bn = DIFFICULTY_BN[difficulty]
    type_instruction = (
        "প্রতিটি প্রশ্ন MCQ (multiple choice) হতে হবে, ঠিক ৪টি বিকল্পসহ।"
        if qtype == "mcq" else
        "প্রতিটি প্রশ্ন সংক্ষিপ্ত উত্তরধর্মী হতে হবে (কোনো বিকল্প ছাড়া)।"
    )
    return f"""তুমি একজন অভিজ্ঞ গণিত শিক্ষক যিনি সপ্তম শ্রেণির পাঠ্যপুস্তক থেকে অনুশীলনী প্রশ্ন তৈরি করছ।

বিষয়: {topic_name}
অধ্যায় নম্বর: {chapter_no}
কঠিনতার মাত্রা: {diff_bn}
{type_instruction}

নিচে পাঠ্যপুস্তকের প্রাসঙ্গিক অংশ দেওয়া হলো। এই প্রসঙ্গের বাইরে কোনো তথ্য ব্যবহার না করে,
ঠিক {n}টি {diff_bn} মানের নতুন প্রশ্ন তৈরি করো।

--- প্রসঙ্গ শুরু ---
{context[:12000]}
--- প্রসঙ্গ শেষ ---

নির্দেশনা:
1. প্রতিটি প্রশ্ন সম্পূর্ণ ও স্বনির্ভর হতে হবে -- প্রসঙ্গ ছাড়াই প্রশ্নটি বোঝা ও সমাধান করা যায়।
2. একে অপরের পুনরাবৃত্তি নয় -- প্রতিটি প্রশ্নের সংখ্যা/পরিস্থিতি আলাদা হতে হবে।
3. MCQ হলে ৪টি বিকল্প দাও এবং সঠিক উত্তরের index (0, 1, 2, বা 3) "answer" ফিল্ডে দাও।
4. সংক্ষিপ্ত উত্তর হলে "answer" ফিল্ডে সরাসরি উত্তর দাও (সংখ্যা বা ছোট বাক্যাংশ)।
5. প্রতিটি প্রশ্নের সাথে ধাপে ধাপে বাংলায় সমাধান ("solution") দাও।
6. খালি উত্তরের বাক্স (□) বা ব্যাখ্যাহীন প্রশ্ন তৈরি কোরো না।

শুধু নিচের JSON অ্যারে ফরম্যাটে উত্তর দাও, অন্য কোনো লেখা ছাড়া:
[
  {{"type": "{qtype if qtype != 'mixed' else 'mcq'}", "text": "প্রশ্নের লেখা", "options": ["ক","খ","গ","ঘ"], "answer": "0", "solution": "সমাধানের ব্যাখ্যা"}}
]
(সংক্ষিপ্ত উত্তরের প্রশ্নে "options" ফিল্ড বাদ দাও।)"""


def _call_gemini(prompt: str, temperature: float = 0.8, model: str | None = None) -> str:
    from google import genai
    from google.genai import types

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise GenerationError("GEMINI_API_KEY কনফিগার করা নেই", 500)

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model or QUESTION_GEN_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=temperature, response_mime_type="application/json"),
    )
    return response.text or ""


def _parse_candidates(raw_text: str) -> list[dict]:
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        match = re.search(r"\[[\s\S]*\]", raw_text)
        if not match:
            log.warning("model returned no parseable JSON array: %s", raw_text[:200])
            return []
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            log.warning("model JSON still unparseable after regex extraction")
            return []
    if not isinstance(data, list):
        return []

    out = []
    for item in data:
        if not isinstance(item, dict):
            continue
        qtype = item.get("type")
        text = (item.get("text") or "").strip()
        answer = item.get("answer")
        if qtype not in VALID_TYPES or not text or answer is None:
            continue
        if qtype == "mcq":
            options = item.get("options")
            if not isinstance(options, list) or len(options) < 2:
                continue
            try:
                if not (0 <= int(answer) < len(options)):
                    continue
            except (TypeError, ValueError):
                continue
        out.append({
            "type": qtype, "text": text, "answer": str(answer),
            "solution": (item.get("solution") or "").strip(),
            "options": item.get("options") if qtype == "mcq" else None,
        })
    return out


def _generate_band(topic_name: str, chapter_no: str, context: str,
                   difficulty: str, qtype: str, n: int) -> list[dict]:
    """One difficulty+type band, looped in GEN_BATCH_SIZE chunks."""
    candidates, produced, stalls = [], 0, 0
    while produced < n and stalls < 2:
        batch_n = min(GEN_BATCH_SIZE, n - produced)
        prompt = _build_prompt(topic_name, chapter_no, context, batch_n, difficulty, qtype)
        raw = _call_gemini(prompt)
        parsed = _parse_candidates(raw)
        if not parsed:
            stalls += 1
            continue
        for item in parsed[:n - produced]:
            item["difficulty"] = difficulty
            candidates.append(item)
        produced += len(parsed[:n - produced])
    return candidates


# ── Dedup ─────────────────────────────────────────────────────────────────

def _existing_topic_questions(topic_id: str) -> list[dict]:
    rows = supabase.table("questions").select("id,text").eq("topic_id", topic_id).execute().data
    return rows or []


def _flag_duplicates(candidates: list[dict], topic_id: str) -> None:
    """Mutates each candidate dict in place: adds possible_duplicate_of /
    similarity_score. Both None when nothing crosses DUP_THRESHOLD or there's
    nothing yet to compare against."""
    if not candidates:
        return
    existing = _existing_topic_questions(topic_id)
    cand_vecs = embed_documents([c["text"] for c in candidates])
    existing_vecs = embed_documents([e["text"] for e in existing])
    for i, cand in enumerate(candidates):
        sim, idx = max_cosine_similarity(cand_vecs[i], existing_vecs)
        if idx >= 0 and sim >= DUP_THRESHOLD:
            cand["possible_duplicate_of"] = existing[idx]["id"]
            cand["similarity_score"] = round(sim, 4)
        else:
            cand["possible_duplicate_of"] = None
            cand["similarity_score"] = round(sim, 4) if idx >= 0 else None


# ── Audit trail (best-effort, non-fatal) ────────────────────────────────

def _write_audit_blob(batch_id: str, class_id: int, payload: dict) -> str | None:
    try:
        from google.cloud import storage
        client = storage.Client()
        bucket = client.bucket("ganit-siksha-pipeline")
        path = f"content/class{class_id}/generated_questions/{batch_id}.json"
        bucket.blob(path).upload_from_string(
            json.dumps(payload, ensure_ascii=False, indent=1), content_type="application/json")
        return f"gs://ganit-siksha-pipeline/{path}"
    except Exception as e:                      # noqa: BLE001
        log.warning("audit blob write failed (non-fatal): %s", e)
        return None


# ── Orchestration ─────────────────────────────────────────────────────────

def generate(class_id: int, chapter_id: str, topic_id: str, count: int,
            difficulty_mix: dict, question_type: str) -> dict:
    if not (1 <= count <= MAX_COUNT):
        raise GenerationError(f"count ১ থেকে {MAX_COUNT}-এর মধ্যে হতে হবে", 400)
    if question_type not in ("mcq", "short", "mixed"):
        raise GenerationError("questionType অবশ্যই mcq, short বা mixed হতে হবে", 400)

    chapter = resolve_chapter(class_id, chapter_id)
    topic = resolve_topic(chapter_id, topic_id)
    gcs_chapter_nos = chapter["gcs_chapter_nos"]
    chapter_label = ", ".join(str(n) for n in gcs_chapter_nos)      # prompt: "2, 3"

    context, source_chunk_ids = retrieve_context(topic, gcs_chapter_nos)

    bands = _band_counts(count, difficulty_mix)
    raw_candidates: list[dict] = []
    for difficulty, n in bands:
        for qtype, tn in _type_split(n, question_type):
            raw_candidates.extend(
                _generate_band(topic["name"], chapter_label, context, difficulty, qtype, tn))

    if not raw_candidates:
        raise GenerationError(
            "মডেল থেকে কোনো বৈধ প্রশ্ন তৈরি করা যায়নি, আবার চেষ্টা করুন।", 502)

    _flag_duplicates(raw_candidates, topic_id)

    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    batch_id = f"batch_{int(time.time() * 1000)}_{suffix}"

    rows = []
    for i, c in enumerate(raw_candidates):
        rows.append({
            "id": f"{batch_id}_{i}",
            "batch_id": batch_id,
            "class_id": class_id,
            "chapter_id": chapter_id,
            "topic_id": topic_id,
            "type": c["type"],
            "text": c["text"],
            "answer": c["answer"],
            "solution": c["solution"],
            "difficulty": c["difficulty"],
            "options": c["options"],
            "status": "pending",
            "possible_duplicate_of": c["possible_duplicate_of"],
            "similarity_score": c["similarity_score"],
            "source_chunk_ids": source_chunk_ids,
        })

    supabase.table("generated_questions").insert(rows).execute()

    audit_uri = _write_audit_blob(batch_id, class_id, {
        "batchId": batch_id, "classId": class_id, "chapterId": chapter_id, "topicId": topic_id,
        "count": count, "difficultyMix": difficulty_mix, "questionType": question_type,
        "gcsChapterNos": gcs_chapter_nos, "sourceChunkIds": source_chunk_ids,
        "candidates": rows,
    })

    return {"batchId": batch_id, "candidates": rows, "auditUri": audit_uri}
