from flask import Flask, jsonify, request, Response, stream_with_context
from curriculam_reader import get_class_data, get_chapter, get_topic, get_all_questions
from supabase_client import supabase
import json
import os
from dotenv import load_dotenv
import anthropic
from flask_cors import CORS

load_dotenv()

import logging
logging.basicConfig(level=logging.DEBUG, format="%(levelname)s %(name)s %(message)s")

app = Flask(__name__)

# Allow origins from env var (comma-separated) or fall back to localhost dev
_raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
CORS(app, origins=_allowed_origins)

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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
