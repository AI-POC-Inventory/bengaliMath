from flask import Flask, jsonify, request, Response, stream_with_context
from curriculam_reader import get_class_data, get_chapter, get_topic, get_all_questions
from supabase_client import supabase
from question_generator import generate as generate_questions, GenerationError
import lesson_generator as lessons
import json
import os
import re
import random
import string
from datetime import datetime, timezone
from dotenv import load_dotenv
import anthropic
from flask_cors import CORS

load_dotenv()

import logging
import time
logging.basicConfig(level=logging.DEBUG, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Allow origins from env var (comma-separated) or fall back to localhost dev
_raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
CORS(app, origins=_allowed_origins)


@app.before_request
def _start_timer():
    request._start_time = time.perf_counter()


@app.after_request
def _log_latency(response):
    elapsed = time.perf_counter() - request._start_time
    logger.debug("[API] %s %s  status=%d  %.3fs", request.method, request.full_path, response.status_code, elapsed)
    return response


# ── ROUTES ────────────────────────────────────────────────────────────────

@app.route("/class/<int:class_id>")
def class_data(class_id):
    return jsonify(get_class_data(class_id))


@app.route("/chapter")
def chapter():
    return jsonify(get_chapter(
        int(request.args.get("classId")),
        request.args.get("chapterId")
    ))


@app.route("/topic")
def topic():
    return jsonify(get_topic(
        int(request.args.get("classId")),
        request.args.get("topicId")
    ))


@app.route("/questions")
def questions():
    return jsonify(get_all_questions(
        int(request.args.get("classId")),
        request.args.get("chapterId"),
        request.args.get("topicId"),
        request.args.get("difficulty")
    ))


# ── Preferences ───────────────────────────────────────────────────────────

@app.route("/api/preferences", methods=["GET"])
def get_preferences():
    rows = supabase.table("preferences").select("key, value").execute().data
    prefs = {r["key"]: r["value"] for r in rows}

    return jsonify({
        "classId": int(prefs["class_id"]) if prefs.get("class_id") else None,
        "theme": prefs.get("theme", "light"),
        "apiKey": prefs.get("api_key", "")
    })


@app.route("/api/preferences", methods=["PUT"])
def put_preferences():
    body = request.get_json()
    supabase.table("preferences").upsert({
        "key": body["key"],
        "value": str(body.get("value", ""))
    }).execute()
    return jsonify({"ok": True})


# ── Sessions ──────────────────────────────────────────────────────────────

@app.route("/api/sessions", methods=["POST"])
def post_session():
    s = request.get_json()

    supabase.table("sessions").upsert({
        "id": s["id"],
        "class_id": s["classId"],
        "chapter_id": s.get("chapterId"),
        "topic_id": s.get("topicId"),
        "difficulty": s.get("difficulty"),
        "date": s["date"],
        "completed": s.get("completed", False),
        "score": s["score"],
        "total": s["total"]
    }).execute()

    # Replace session questions
    supabase.table("session_questions").delete().eq("session_id", s["id"]).execute()

    questions = s.get("questions", [])
    if questions:
        supabase.table("session_questions").insert([
            {
                "session_id": s["id"],
                "question_id": q["questionId"],
                "topic_id": q["topicId"],
                "chapter_id": q["chapterId"],
                "correct": q.get("correct", False),
                "attempted": q.get("attempted", True)
            }
            for q in questions
        ]).execute()

    return jsonify({"ok": True})


# ── Doubts ────────────────────────────────────────────────────────────────

@app.route("/api/doubts", methods=["POST"])
def post_doubt():
    d = request.get_json()

    supabase.table("doubts").upsert({
        "id": d["id"],
        "class_id": d["classId"],
        "question": d["question"],
        "topic": d.get("topic"),
        "response": d["response"],
        "date": d["date"]
    }).execute()

    return jsonify({"ok": True})


# ── Daily Puzzle ──────────────────────────────────────────────────────────

PUZZLE_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


@app.route("/api/daily-puzzle/today")
def daily_puzzle_today():
    rows = supabase.table("daily_puzzles").select("*").eq("date", _today_iso()).execute().data
    if not rows:
        return jsonify({"puzzle": None})

    p = rows[0]
    # Withhold answer/explanation until the user submits an attempt
    return jsonify({"puzzle": {
        "id": p["id"],
        "date": p["date"],
        "puzzle_date": p["date"],
        "puzzle_bengali": p["puzzle_bengali"],
        "hint_bengali": p.get("hint_bengali"),
        "difficulty": p.get("difficulty"),
        "category": p.get("category"),
    }})


@app.route("/api/daily-puzzle/generate", methods=["POST"])
def daily_puzzle_generate():
    try:
        body = request.get_json(silent=True) or {}
        difficulty = body.get("difficulty") or "medium"
        puzzle_date = body.get("date") or _today_iso()

        existing = supabase.table("daily_puzzles").select("id").eq("date", puzzle_date).execute().data
        if existing:
            return jsonify({"error": "Puzzle already exists for this date"}), 400

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return jsonify({"error": "GEMINI_API_KEY is not configured"}), 400

        prompt = f"""তুমি একজন গণিত ধাঁধা বিশেষজ্ঞ। একটি মজাদার গণিত ধাঁধা তৈরি করো যা শিক্ষার্থীদের চিন্তা করতে উৎসাহিত করবে।

কঠিনতা: {difficulty}

নির্দেশনা:
1. ধাঁধাটি সম্পূর্ণ বাংলায় লেখো
2. এটি পাঠ্যক্রমের বাইরের হতে পারে - শুধু মজার এবং চিন্তা-উদ্দীপক হতে হবে
3. একটি সংকেত (hint) দাও যা সমাধানের দিকে নিয়ে যাবে
4. সমাধান এবং ব্যাখ্যা দাও

JSON ফরম্যাটে উত্তর দাও:
{{
  "puzzle": "ধাঁধার প্রশ্ন",
  "hint": "সংকেত",
  "answer": "উত্তর",
  "explanation": "ব্যাখ্যা",
  "category": "logic/arithmetic/pattern/riddle"
}}"""

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=PUZZLE_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.9,
                response_mime_type="application/json",
            ),
        )

        text = response.text or ""
        try:
            generated = json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}", text)
            if not match:
                raise ValueError("Model did not return JSON")
            generated = json.loads(match.group(0))

        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=9))
        puzzle_id = f"puzzle_{int(time.time() * 1000)}_{suffix}"

        supabase.table("daily_puzzles").insert({
            "id": puzzle_id,
            "date": puzzle_date,
            "puzzle_bengali": generated["puzzle"],
            "answer": generated["answer"],
            "explanation_bengali": generated["explanation"],
            "hint_bengali": generated.get("hint", ""),
            "difficulty": difficulty,
            "category": generated.get("category"),
        }).execute()

        return jsonify({"id": puzzle_id, "date": puzzle_date, **generated})
    except Exception as error:  # noqa: BLE001
        logger.exception("Daily puzzle generation error")
        return jsonify({"error": "Failed to generate daily puzzle", "details": str(error)}), 500


@app.route("/api/daily-puzzle/attempt", methods=["POST"])
def daily_puzzle_attempt():
    try:
        body = request.get_json(silent=True) or {}
        puzzle_id = body.get("puzzleId")
        user_answer = body.get("userAnswer")

        if not puzzle_id or not user_answer:
            return jsonify({"error": "puzzleId and userAnswer are required"}), 400

        rows = supabase.table("daily_puzzles").select("*").eq("id", puzzle_id).execute().data
        if not rows:
            return jsonify({"error": "Puzzle not found"}), 404
        puzzle = rows[0]

        correct = user_answer.strip().lower() == (puzzle.get("answer") or "").strip().lower()

        supabase.table("puzzle_attempts").insert({
            "puzzle_id": puzzle_id,
            "solved": correct,
            "attempts": 1,
            "user_answer": user_answer,
            "solved_at": datetime.now(timezone.utc).isoformat() if correct else None,
        }).execute()

        return jsonify({
            "correct": correct,
            "answer": puzzle.get("answer"),
            "explanation": puzzle.get("explanation_bengali"),
        })
    except Exception as error:  # noqa: BLE001
        logger.exception("Puzzle attempt error")
        return jsonify({"error": "Failed to record puzzle attempt", "details": str(error)}), 500


# ── Admin: Question Generator ────────────────────────────────────────────

@app.route("/classes")
def list_classes():
    rows = supabase.table("classes").select("*").order("id").execute().data
    return jsonify([{"id": r["id"], "name": r["name"], "bengaliName": r["bengali_name"]} for r in rows])


@app.route("/api/admin/questions/generate", methods=["POST"])
def admin_generate_questions():
    body = request.get_json(silent=True) or {}
    required = ["classId", "chapterId", "topicId", "count"]
    missing = [k for k in required if body.get(k) in (None, "")]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    try:
        result = generate_questions(
            class_id=int(body["classId"]),
            chapter_id=body["chapterId"],
            topic_id=body["topicId"],
            count=int(body["count"]),
            difficulty_mix=body.get("difficultyMix") or {"easy": 30, "medium": 50, "hard": 20},
            question_type=body.get("questionType", "mcq"),
        )
        return jsonify(result)
    except GenerationError as e:
        return jsonify({"error": e.message}), e.status
    except Exception as error:  # noqa: BLE001
        logger.exception("Question generation error")
        return jsonify({"error": "Failed to generate questions", "details": str(error)}), 500


@app.route("/api/admin/questions/staging")
def admin_staging_list():
    query = supabase.table("generated_questions").select("*")
    for param, col in (("batchId", "batch_id"), ("classId", "class_id"),
                      ("chapterId", "chapter_id"), ("topicId", "topic_id"),
                      ("status", "status")):
        val = request.args.get(param)
        if val:
            query = query.eq(col, val)
    rows = query.order("created_at", desc=True).execute().data
    return jsonify(rows)


def _approve_one(staged_id: str) -> tuple[bool, str]:
    """Publish one staged question. The question insert, its options and the
    status flip all happen inside the approve_generated_question() Postgres
    function (migration 008) -- one transaction, so a failure part-way can no
    longer leave a question live while staging still says "pending"."""
    try:
        supabase.rpc("approve_generated_question", {"p_id": staged_id}).execute()
    except Exception as error:  # noqa: BLE001
        message = getattr(error, "message", None) or str(error)
        if "not found" in message:
            return False, "not found"
        if "already " in message:
            return False, message[message.index("already "):].split('"')[0]
        raise
    return True, "approved"


def _reject_one(staged_id: str) -> tuple[bool, str]:
    rows = supabase.table("generated_questions").select("status").eq("id", staged_id).limit(1).execute().data
    if not rows:
        return False, "not found"
    if rows[0]["status"] != "pending":
        return False, f"already {rows[0]['status']}"
    supabase.table("generated_questions").update({
        "status": "rejected", "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", staged_id).execute()
    return True, "rejected"


@app.route("/api/admin/questions/staging/<staged_id>/approve", methods=["POST"])
def admin_staging_approve(staged_id):
    try:
        ok, detail = _approve_one(staged_id)
        return jsonify({"ok": ok, "detail": detail}), (200 if ok else 400)
    except Exception as error:  # noqa: BLE001
        logger.exception("Approve error")
        return jsonify({"error": "Failed to approve question", "details": str(error)}), 500


@app.route("/api/admin/questions/staging/<staged_id>/reject", methods=["POST"])
def admin_staging_reject(staged_id):
    try:
        ok, detail = _reject_one(staged_id)
        return jsonify({"ok": ok, "detail": detail}), (200 if ok else 400)
    except Exception as error:  # noqa: BLE001
        logger.exception("Reject error")
        return jsonify({"error": "Failed to reject question", "details": str(error)}), 500


@app.route("/api/admin/questions/staging/batch-approve", methods=["POST"])
def admin_staging_batch_approve():
    ids = (request.get_json(silent=True) or {}).get("ids") or []
    results = {}
    for staged_id in ids:
        try:
            ok, detail = _approve_one(staged_id)
        except Exception as error:  # noqa: BLE001
            logger.exception("Batch approve error for %s", staged_id)
            ok, detail = False, str(error)
        results[staged_id] = {"ok": ok, "detail": detail}
    return jsonify({"results": results,
                    "approved": sum(1 for r in results.values() if r["ok"]),
                    "failed": sum(1 for r in results.values() if not r["ok"])})


@app.route("/api/admin/questions/staging/batch-reject", methods=["POST"])
def admin_staging_batch_reject():
    ids = (request.get_json(silent=True) or {}).get("ids") or []
    results = {}
    for staged_id in ids:
        try:
            ok, detail = _reject_one(staged_id)
        except Exception as error:  # noqa: BLE001
            logger.exception("Batch reject error for %s", staged_id)
            ok, detail = False, str(error)
        results[staged_id] = {"ok": ok, "detail": detail}
    return jsonify({"results": results,
                    "rejected": sum(1 for r in results.values() if r["ok"]),
                    "failed": sum(1 for r in results.values() if not r["ok"])})


# ── Admin: Chapter Lessons ───────────────────────────────────────────────
# Generate -> review/edit -> approve, same staging pattern as the question
# generator. Approving publishes into chapters.details, which students read via
# the existing GET /chapter endpoint (no separate student route needed).

def _lesson_response(fn, *args, **kwargs):
    """Run a lesson_generator call and map its errors to JSON responses."""
    try:
        return jsonify(fn(*args, **kwargs))
    except GenerationError as e:
        return jsonify({"error": e.message}), e.status
    except Exception as error:  # noqa: BLE001
        logger.exception("Lesson %s error", getattr(fn, "__name__", "call"))
        return jsonify({"error": "Lesson operation failed", "details": str(error)}), 500


@app.route("/api/admin/lessons/generate", methods=["POST"])
def admin_lesson_generate():
    body = request.get_json(silent=True) or {}
    if not body.get("classId") or not body.get("chapterId"):
        return jsonify({"error": "Missing required fields: classId, chapterId"}), 400
    return _lesson_response(lessons.generate, int(body["classId"]), body["chapterId"])


@app.route("/api/admin/lessons")
def admin_lesson_list():
    class_id = request.args.get("classId")
    return _lesson_response(lessons.list_lessons,
                            int(class_id) if class_id else None,
                            request.args.get("chapterId"), request.args.get("status"))


@app.route("/api/admin/lessons/<lesson_id>")
def admin_lesson_get(lesson_id):
    return _lesson_response(lessons.get_lesson, lesson_id)


@app.route("/api/admin/lessons/<lesson_id>", methods=["PUT"])
def admin_lesson_update(lesson_id):
    body = request.get_json(silent=True) or {}
    return _lesson_response(lessons.update_lesson, lesson_id, body.get("content"))


@app.route("/api/admin/lessons/<lesson_id>/approve", methods=["POST"])
def admin_lesson_approve(lesson_id):
    return _lesson_response(lessons.approve_lesson, lesson_id)


@app.route("/api/admin/lessons/<lesson_id>/reject", methods=["POST"])
def admin_lesson_reject(lesson_id):
    return _lesson_response(lessons.reject_lesson, lesson_id)


@app.route("/api/admin/lessons/<lesson_id>/clone", methods=["POST"])
def admin_lesson_clone(lesson_id):
    return _lesson_response(lessons.clone_lesson, lesson_id)


@app.route("/api/admin/lessons/chapter/<chapter_id>/unpublish", methods=["POST"])
def admin_lesson_unpublish(chapter_id):
    return _lesson_response(lessons.unpublish_lesson, chapter_id)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
