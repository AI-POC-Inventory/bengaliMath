from flask import Flask, jsonify, request, Response, stream_with_context
from curriculam_reader import get_class_data, get_chapter, get_topic, get_all_questions
import sqlite3
import json
import os
from dotenv import load_dotenv
import anthropic
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)

_dir = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.getenv("DB_PATH", os.path.join(_dir, "..", "..", "database", "bengali_curriculam.db"))
CORS(app, origins=["http://localhost:5173"])
print(f"Using database at: {DB_PATH}")
# ── DB helpers ─────────────────────────────────────────────────────────────────

def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con

def init_db():
    with get_db() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS preferences (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id          TEXT    PRIMARY KEY,
                class_id    INTEGER NOT NULL,
                chapter_id  TEXT,
                topic_id    TEXT,
                difficulty  TEXT,
                date        TEXT    NOT NULL,
                completed   INTEGER NOT NULL DEFAULT 0,
                score       INTEGER NOT NULL DEFAULT 0,
                total       INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS session_questions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT    NOT NULL,
                question_id TEXT    NOT NULL,
                topic_id    TEXT    NOT NULL,
                chapter_id  TEXT    NOT NULL,
                correct     INTEGER NOT NULL DEFAULT 0,
                attempted   INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS doubts (
                id        TEXT    PRIMARY KEY,
                class_id  INTEGER NOT NULL,
                question  TEXT    NOT NULL,
                topic     TEXT,
                response  TEXT    NOT NULL,
                date      TEXT    NOT NULL
            );
        """)

init_db()

# ── Existing curriculum routes ────────────────────────────────────────────────

@app.route("/class/<int:class_id>")
def class_data(class_id):
    data = get_class_data(class_id)
    print(f"Fetched class data for classId={class_id}: {data}") 
    return jsonify(data)

@app.route("/chapter")
def chapter():
    class_id = int(request.args.get("classId"))
    chapter_id = request.args.get("chapterId")
    return jsonify(get_chapter(class_id, chapter_id))

@app.route("/topic")
def topic():
    class_id = int(request.args.get("classId"))
    topic_id = request.args.get("topicId")
    return jsonify(get_topic(class_id, topic_id))

@app.route("/questions")
def questions():
    class_id = int(request.args.get("classId"))
    chapter_id = request.args.get("chapterId")
    topic_id = request.args.get("topicId")
    difficulty = request.args.get("difficulty")
    data = get_all_questions(class_id, chapter_id, topic_id, difficulty)
    return jsonify(data)

# ── Preferences ───────────────────────────────────────────────────────────────

@app.route("/api/preferences", methods=["GET"])
def get_preferences():
    print("Fetching preferences from DB")
    with get_db() as con:
        rows = con.execute("SELECT key, value FROM preferences").fetchall()
    prefs = {r["key"]: r["value"] for r in rows}
    return jsonify({
        "classId": int(prefs["class_id"]) if prefs.get("class_id") else None,
        "theme":   prefs.get("theme", "light"),
        "apiKey":  prefs.get("api_key", ""),
    })

@app.route("/api/preferences", methods=["PUT"])
def put_preferences():
    print("Updating preferences in DB") 
    body = request.get_json()
    key = body.get("key")
    value = body.get("value", "")
    if not key:
        return jsonify({"error": "key required"}), 400
    with get_db() as con:
        con.execute(
            "INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)",
            (key, str(value))
        )
    return jsonify({"ok": True})

# ── Sessions ──────────────────────────────────────────────────────────────────

@app.route("/api/sessions", methods=["GET"])
def get_sessions():
    print("Fetching sessions from DB")
    class_id = request.args.get("classId", type=int)
    with get_db() as con:
        if class_id:
            rows = con.execute(
                "SELECT * FROM sessions WHERE class_id = ? ORDER BY date DESC", (class_id,)
            ).fetchall()
        else:
            rows = con.execute("SELECT * FROM sessions ORDER BY date DESC").fetchall()

        sessions = []
        for s in rows:
            questions = con.execute(
                "SELECT * FROM session_questions WHERE session_id = ?", (s["id"],)
            ).fetchall()
            sessions.append({
                "id":         s["id"],
                "classId":    s["class_id"],
                "chapterId":  s["chapter_id"],
                "topicId":    s["topic_id"],
                "difficulty": s["difficulty"],
                "date":       s["date"],
                "completed":  bool(s["completed"]),
                "score":      s["score"],
                "total":      s["total"],
                "questions": [{
                    "questionId": q["question_id"],
                    "topicId":    q["topic_id"],
                    "chapterId":  q["chapter_id"],
                    "correct":    bool(q["correct"]),
                    "attempted":  bool(q["attempted"]),
                } for q in questions],
            })
    return jsonify(sessions)

@app.route("/api/sessions", methods=["POST"])
def post_session():
    print("Saving session to DB")   
    s = request.get_json()
    with get_db() as con:
        con.execute("""
            INSERT OR REPLACE INTO sessions
              (id, class_id, chapter_id, topic_id, difficulty, date, completed, score, total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s["id"], s["classId"], s.get("chapterId"), s.get("topicId"),
            s.get("difficulty"), s["date"], 1 if s.get("completed") else 0,
            s["score"], s["total"],
        ))
        con.execute("DELETE FROM session_questions WHERE session_id = ?", (s["id"],))
        for q in s.get("questions", []):
            con.execute("""
                INSERT INTO session_questions
                  (session_id, question_id, topic_id, chapter_id, correct, attempted)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                s["id"], q["questionId"], q["topicId"], q["chapterId"],
                1 if q.get("correct") else 0,
                1 if q.get("attempted") else 0,
            ))
    return jsonify({"ok": True})

@app.route("/api/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    with get_db() as con:
        con.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    return jsonify({"ok": True})

# ── Doubts ────────────────────────────────────────────────────────────────────

@app.route("/api/doubts", methods=["GET"])
def get_doubts():
    class_id = request.args.get("classId", type=int)
    with get_db() as con:
        if class_id:
            rows = con.execute(
                "SELECT * FROM doubts WHERE class_id = ? ORDER BY date DESC", (class_id,)
            ).fetchall()
        else:
            rows = con.execute("SELECT * FROM doubts ORDER BY date DESC").fetchall()
    return jsonify([{
        "id":       d["id"],
        "classId":  d["class_id"],
        "question": d["question"],
        "topic":    d["topic"],
        "response": d["response"],
        "date":     d["date"],
    } for d in rows])

@app.route("/api/doubts", methods=["POST"])
def post_doubt():
    d = request.get_json()
    with get_db() as con:
        con.execute("""
            INSERT OR REPLACE INTO doubts (id, class_id, question, topic, response, date)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (d["id"], d["classId"], d["question"], d.get("topic"), d["response"], d["date"]))
    return jsonify({"ok": True})

@app.route("/api/doubts/<doubt_id>", methods=["DELETE"])
def delete_doubt(doubt_id):
    with get_db() as con:
        con.execute("DELETE FROM doubts WHERE id = ?", (doubt_id,))
    return jsonify({"ok": True})

# ── Anthropic streaming proxy ─────────────────────────────────────────────────

@app.route("/api/doubts/ask", methods=["POST"])
def ask_doubt():
    body = request.get_json()
    class_id = body.get("classId")
    question = body.get("question")
    topic    = body.get("topic", "")

    with get_db() as con:
        row = con.execute(
            "SELECT value FROM preferences WHERE key = 'api_key'"
        ).fetchone()

    api_key = row["value"] if row else None
    if not api_key:
        return jsonify({"error": "API key not configured"}), 400

    class_names = {5: "পঞ্চম", 6: "ষষ্ঠ", 7: "সপ্তম", 8: "অষ্টম", 9: "নবম", 10: "দশম"}
    user_message = (
        f"বিষয়: {topic.strip()}\n\nপ্রশ্ন: {question}"
        if topic and topic.strip()
        else f"প্রশ্ন: {question}"
    )

    def generate():
        try:
            client = anthropic.Anthropic(api_key=api_key)
            with client.messages.stream(
                model="claude-opus-4-6",
                max_tokens=4096,
                system=(
                    f"তুমি একজন অভিজ্ঞ বাংলা মাধ্যম গণিত শিক্ষক। "
                    f"পশ্চিমবঙ্গ বোর্ড (WBBSE)-এর {class_names.get(class_id, '')} শ্রেণীর "
                    f"ছাত্রছাত্রীদের গণিতের প্রশ্নের সমাধান করো।\n\n"
                    f"সবসময় বাংলায় উত্তর দাও। ধাপে ধাপে সহজ ভাষায় বোঝাও। "
                    f"প্রয়োজনে সূত্র ও উদাহরণ ব্যবহার করো।"
                ),
                messages=[{"role": "user", "content": user_message}],
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ── Start ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=3002)