import time
import logging

from supabase_client import supabase

logger = logging.getLogger(__name__)


def _timed(label: str, fn):
    t0 = time.perf_counter()
    result = fn()
    elapsed = time.perf_counter() - t0
    logger.debug("[LATENCY] %-55s %.3fs", label, elapsed)
    return result


def get_class_data(class_id: int):
    total_start = time.perf_counter()

    # Query 1: class
    cls_row = _timed(f"classes  class_id={class_id}", lambda: supabase.table("classes").select("*").eq("id", class_id).limit(1).execute().data)
    if not cls_row:
        return None
    cls = cls_row[0]

    # Query 2: all chapters for class
    chapters = _timed(f"chapters class_id={class_id}", lambda: supabase.table("chapters").select("*").eq("class_id", class_id).execute().data)
    chapter_ids = [ch["id"] for ch in chapters]

    # Query 3: all topics for those chapters (bulk)
    topics = _timed("topics   (bulk)", lambda: supabase.table("topics").select("*").in_("chapter_id", chapter_ids).execute().data) if chapter_ids else []
    topic_ids = [t["id"] for t in topics]

    # Query 4: all questions for those topics (bulk)
    questions = _timed("questions (bulk)", lambda: supabase.table("questions").select("*").in_("topic_id", topic_ids).execute().data) if topic_ids else []
    mcq_ids = [q["id"] for q in questions if q["type"] == "mcq"]

    # Query 5: all options for MCQ questions (bulk)
    options_rows = _timed("options  (bulk)", lambda: supabase.table("options").select("question_id, option_text").in_("question_id", mcq_ids).execute().data) if mcq_ids else []

    logger.debug("[LATENCY] *** get_class_data total=%.3fs  queries=5 ***", time.perf_counter() - total_start)

    # Assemble in-memory
    options_map: dict = {}
    for o in options_rows:
        options_map.setdefault(o["question_id"], []).append(o["option_text"])

    questions_map: dict = {}
    for q in questions:
        qd = {
            "id": q["id"],
            "type": q["type"],
            "text": q["text"],
            "answer": q["answer"],
            "solution": q["solution"],
            "difficulty": q["difficulty"],
        }
        if q["type"] == "mcq":
            qd["options"] = options_map.get(q["id"], [])
        questions_map.setdefault(q["topic_id"], []).append(qd)

    topics_map: dict = {}
    for t in topics:
        topics_map.setdefault(t["chapter_id"], []).append({
            "id": t["id"],
            "name": t["name"],
            "description": t["description"],
            "questions": questions_map.get(t["id"], []),
        })

    return {
        "id": cls["id"],
        "name": cls["name"],
        "bengaliName": cls["bengali_name"],
        "chapters": [
            {
                "id": ch["id"],
                "name": ch["name"],
                "description": ch["description"],
                "topics": topics_map.get(ch["id"], []),
            }
            for ch in chapters
        ],
    }


def get_chapter(class_id: int, chapter_id: str):
    rows = (
        supabase.table("chapters")
        .select("*")
        .eq("id", chapter_id)
        .eq("class_id", class_id)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def get_topic(class_id: int, topic_id: str):
    rows = (
        supabase.table("topics")
        .select("*, chapters!inner(id, class_id)")
        .eq("id", topic_id)
        .eq("chapters.class_id", class_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return None
    row = rows[0]
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "chapter_id": row["chapters"]["id"],
    }


def get_all_questions(class_id: int, chapter_id=None, topic_id=None, difficulty=None):
    query = (
        supabase.table("questions")
        .select("*, topics!inner(id, chapter_id, chapters!inner(id, class_id))")
        .eq("topics.chapters.class_id", class_id)
    )

    if chapter_id:
        query = query.eq("topics.chapters.id", chapter_id)
    if topic_id:
        query = query.eq("topic_id", topic_id)
    if difficulty:
        query = query.eq("difficulty", difficulty)

    rows = query.execute().data

    result = []
    for row in rows:
        result.append({
            "question": {
                "id": row["id"],
                "type": row["type"],
                "text": row["text"],
                "answer": row["answer"],
                "solution": row["solution"],
                "difficulty": row["difficulty"],
            },
            "topicId": row["topics"]["id"],
            "chapterId": row["topics"]["chapters"]["id"],
        })

    return result


def get_options(question_id: str):
    rows = supabase.table("options").select("option_text, is_correct").eq("question_id", question_id).execute().data
    return [{"text": o["option_text"], "is_correct": bool(o["is_correct"])} for o in rows]
