from flask import Flask, jsonify, request, Response, stream_with_context
from curriculam_reader import get_class_data, get_chapter, get_topic, get_all_questions
import sqlite3
import json
import os
from dotenv import load_dotenv
import anthropic
from flask_cors import CORS
from google.cloud import storage

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

# ── CONFIG ─────────────────────────────────────────────────────────────

BUCKET_NAME = os.getenv("GCS_BUCKET")
DB_BLOB_NAME = os.getenv("DB_BLOB_NAME", "bengali_curriculam.db")
LOCAL_DB_PATH = "/tmp/bengali_curriculam.db"

print(f"GCS bucket: {BUCKET_NAME}")
print(f"Using local DB: {LOCAL_DB_PATH}")

storage_client = storage.Client()

# ── GCS SYNC HELPERS ───────────────────────────────────────────────────

def download_db():
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(DB_BLOB_NAME)

        if blob.exists():
            blob.download_to_filename(LOCAL_DB_PATH)
            print("✅ DB downloaded from GCS")
        else:
            print("⚠️ No DB found in GCS, starting fresh")

    except Exception as e:
        print("❌ Failed to download DB:", e)


def upload_db():
    try:
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(DB_BLOB_NAME)

        blob.upload_from_filename(LOCAL_DB_PATH)
        print("✅ DB uploaded to GCS")

    except Exception as e:
        print("❌ Failed to upload DB:", e)


# ── DB HELPERS ─────────────────────────────────────────────────────────

def get_db():
    con = sqlite3.connect(LOCAL_DB_PATH)
    con.row_factory = sqlite3.Row

    # ⚠️ IMPORTANT: no WAL in Cloud Run
    con.execute("PRAGMA journal_mode=DELETE")
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

# ── STARTUP ────────────────────────────────────────────────────────────

download_db()
init_db()

# ── WRITE WRAPPER (AUTO SYNC) ──────────────────────────────────────────

def commit_and_sync(con):
    con.commit()
    upload_db()

# ── ROUTES (same as yours, with sync added) ────────────────────────────

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


# ── Preferences ───────────────────────────────────────────────────────

@app.route("/api/preferences", methods=["GET"])
def get_preferences():
    with get_db() as con:
        rows = con.execute("SELECT key, value FROM preferences").fetchall()

    prefs = {r["key"]: r["value"] for r in rows}

    return jsonify({
        "classId": int(prefs["class_id"]) if prefs.get("class_id") else None,
        "theme": prefs.get("theme", "light"),
        "apiKey": prefs.get("api_key", "")
    })


@app.route("/api/preferences", methods=["PUT"])
def put_preferences():
    body = request.get_json()

    with get_db() as con:
        con.execute(
            "INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)",
            (body["key"], str(body.get("value", "")))
        )
        commit_and_sync(con)

    return jsonify({"ok": True})


# ── Sessions ──────────────────────────────────────────────────────────

@app.route("/api/sessions", methods=["POST"])
def post_session():
    s = request.get_json()

    with get_db() as con:
        con.execute("""
            INSERT OR REPLACE INTO sessions
            (id, class_id, chapter_id, topic_id, difficulty, date, completed, score, total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s["id"], s["classId"], s.get("chapterId"), s.get("topicId"),
            s.get("difficulty"), s["date"],
            1 if s.get("completed") else 0,
            s["score"], s["total"]
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
                1 if q.get("attempted") else 0
            ))

        commit_and_sync(con)

    return jsonify({"ok": True})


# ── Doubts (same pattern) ─────────────────────────────────────────────

@app.route("/api/doubts", methods=["POST"])
def post_doubt():
    d = request.get_json()

    with get_db() as con:
        con.execute("""
            INSERT OR REPLACE INTO doubts
            (id, class_id, question, topic, response, date)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            d["id"], d["classId"], d["question"],
            d.get("topic"), d["response"], d["date"]
        ))

        commit_and_sync(con)

    return jsonify({"ok": True})