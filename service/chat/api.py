"""Bengali Math — Chat service (Python / Flask).

Reimplementation of the former Node.js `service/chat` microservice. Serves the
Bengali math chat assistant backed by Supabase (conversation/message storage)
and Google Gemini (streaming completions + audio transcription).

Endpoints (root-level, identical to the old Node service):
    GET    /health
    GET    /conversations
    POST   /conversations
    DELETE /conversations/<id>
    GET    /conversations/<id>/messages
    POST   /conversations/<id>/messages   (SSE streaming)
    GET    /quick-actions
    POST   /audio/transcribe

Configuration comes from environment variables (Cloud Run injects these):
    SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY, CORS_ORIGINS, PORT
"""
import os
import time
import json
import base64
import logging
import random
import string
from datetime import datetime, timezone

from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv

from supabase_client import supabase
from gemini_client import get_client, GEMINI_MODEL

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Allow origins from env var (comma-separated) or fall back to localhost dev
_raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
CORS(app, origins=_allowed_origins)

CLASS_NAMES = {
    5: "পঞ্চম",
    6: "ষষ্ঠ",
    7: "সপ্তম",
    8: "অষ্টম",
    9: "নবম",
    10: "দশম",
}

DEFAULT_TITLE = "নতুন কথোপকথন"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _system_instruction(class_id: int) -> str:
    class_name = CLASS_NAMES.get(class_id, "")
    return (
        f"তুমি একজন সহায়ক বাংলা গণিত শিক্ষক সহকারী। তুমি {class_name} শ্রেণীর "
        "পশ্চিমবঙ্গ বোর্ড (WBBSE) এর ছাত্রছাত্রীদের সাহায্য করো।\n\n"
        "তোমার কাজ:\n"
        "- সবসময় বাংলায় উত্তর দাও\n"
        "- গণিতের সমস্যা সমাধানে ধাপে ধাপে সাহায্য করো\n"
        "- ধারণা সহজ ভাষায় ব্যাখ্যা করো\n"
        "- উৎসাহজনক ও বন্ধুত্বপূর্ণ ভঙ্গিতে কথা বলো\n"
        "- প্রয়োজনে উদাহরণ দাও\n"
        "- শিক্ষার্থীকে নিজে চিন্তা করতে উৎসাহিত করো, সরাসরি উত্তর না দিয়ে\n\n"
        "তুমি একজন সহায়ক বন্ধুর মতো, শুধু একজন শিক্ষক নয়।"
    )


@app.before_request
def _start_timer():
    request._start_time = time.perf_counter()


@app.after_request
def _log_latency(response):
    elapsed = time.perf_counter() - getattr(request, "_start_time", time.perf_counter())
    logger.info(
        "[%s] %s %s %d %.0fms",
        _now_iso(), request.method, request.path, response.status_code, elapsed * 1000,
    )
    return response


# ── Health ────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# ── Conversations ───────────────────────────────────────────────────────────

@app.route("/conversations", methods=["GET"])
def list_conversations():
    try:
        class_id = request.args.get("classId")
        user_id = request.args.get("userId")

        query = (
            supabase.table("chat_conversations")
            .select("*")
            .eq("is_archived", False)
            .order("updated_at", desc=True)
            .limit(50)
        )
        if class_id:
            query = query.eq("class_id", int(class_id))
        if user_id:
            query = query.eq("user_id", int(user_id))

        conversations = query.execute().data or []

        result = []
        for conv in conversations:
            count = (
                supabase.table("chat_messages")
                .select("id", count="exact")
                .eq("conversation_id", conv["id"])
                .execute()
                .count
            )
            result.append({
                "id": conv["id"],
                "title": conv["title"],
                "updatedAt": conv["updated_at"],
                "messageCount": count or 0,
            })

        return jsonify(result)
    except Exception as error:  # noqa: BLE001
        logger.exception("Error fetching conversations")
        return jsonify({"error": str(error)}), 500


@app.route("/conversations", methods=["POST"])
def create_conversation():
    try:
        body = request.get_json(silent=True) or {}
        class_id = body.get("classId")
        if not class_id:
            return jsonify({"error": "classId is required"}), 400

        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=9))
        conversation_id = f"chat_{int(time.time() * 1000)}_{suffix}"
        now = _now_iso()

        conversation = (
            supabase.table("chat_conversations")
            .insert({
                "id": conversation_id,
                "class_id": int(class_id),
                "title": DEFAULT_TITLE,
                "created_at": now,
                "updated_at": now,
                "is_archived": False,
            })
            .execute()
            .data[0]
        )

        return jsonify({
            "id": conversation["id"],
            "title": conversation["title"],
            "updatedAt": conversation["updated_at"],
            "messageCount": 0,
        })
    except Exception as error:  # noqa: BLE001
        logger.exception("Error creating conversation")
        return jsonify({"error": str(error)}), 500


@app.route("/conversations/<conversation_id>", methods=["DELETE"])
def delete_conversation(conversation_id):
    try:
        supabase.table("chat_conversations").update({"is_archived": True}).eq(
            "id", conversation_id
        ).execute()
        return jsonify({"ok": True})
    except Exception as error:  # noqa: BLE001
        logger.exception("Error deleting conversation")
        return jsonify({"error": str(error)}), 500


# ── Messages ────────────────────────────────────────────────────────────────

@app.route("/conversations/<conversation_id>/messages", methods=["GET"])
def list_messages(conversation_id):
    try:
        messages = (
            supabase.table("chat_messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
            .data
            or []
        )
        return jsonify([
            {
                "id": m["id"],
                "role": m["role"],
                "content": m["content"],
                "createdAt": m["created_at"],
            }
            for m in messages
        ])
    except Exception as error:  # noqa: BLE001
        logger.exception("Error fetching messages")
        return jsonify({"error": str(error)}), 500


@app.route("/conversations/<conversation_id>/messages", methods=["POST"])
def post_message(conversation_id):
    body = request.get_json(silent=True) or {}
    message = body.get("message")
    class_id = body.get("classId")

    if not message or not class_id:
        return jsonify({"error": "message and classId are required"}), 400

    # Verify conversation exists
    conv_rows = (
        supabase.table("chat_conversations")
        .select("*")
        .eq("id", conversation_id)
        .execute()
        .data
    )
    if not conv_rows:
        return jsonify({"error": "Conversation not found"}), 404
    conversation = conv_rows[0]

    # Save the user message
    supabase.table("chat_messages").insert({
        "conversation_id": conversation_id,
        "role": "user",
        "content": message,
        "created_at": _now_iso(),
    }).execute()

    # Build the contents array from the last 10 messages (chronological order).
    # The just-saved user message is the final entry, so we do not append it again.
    history = (
        supabase.table("chat_messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
        .data
        or []
    )
    history.reverse()

    from google.genai import types

    contents = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part.from_text(text=m["content"])],
        )
        for m in history
    ]

    config = types.GenerateContentConfig(
        system_instruction=_system_instruction(int(class_id)),
    )

    @stream_with_context
    def generate():
        full_response = ""
        try:
            client = get_client()
            stream = client.models.generate_content_stream(
                model=GEMINI_MODEL,
                contents=contents,
                config=config,
            )
            for chunk in stream:
                text = getattr(chunk, "text", None)
                if text:
                    full_response += text
                    yield f"data: {json.dumps({'text': text})}\n\n"

            # Persist the assistant response
            supabase.table("chat_messages").insert({
                "conversation_id": conversation_id,
                "role": "assistant",
                "content": full_response,
                "created_at": _now_iso(),
            }).execute()

            # Update conversation title (first time) and timestamp
            update = {"updated_at": _now_iso()}
            if not conversation.get("title") or conversation["title"] == DEFAULT_TITLE:
                title = message[:50] + ("..." if len(message) > 50 else "")
                update["title"] = title
            supabase.table("chat_conversations").update(update).eq(
                "id", conversation_id
            ).execute()

            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as err:  # noqa: BLE001
            logger.exception("Chat streaming error")
            yield f"data: {json.dumps({'error': str(err)})}\n\n"

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return Response(generate(), headers=headers)


# ── Quick actions ───────────────────────────────────────────────────────────

@app.route("/quick-actions", methods=["GET"])
def quick_actions():
    try:
        class_id = request.args.get("classId")
        if not class_id:
            return jsonify({"error": "classId is required"}), 400

        actions = (
            supabase.table("chat_quick_actions")
            .select("*")
            .eq("class_id", int(class_id))
            .order("sort_order", desc=False)
            .order("id", desc=False)
            .execute()
            .data
            or []
        )
        return jsonify([
            {
                "id": a["id"],
                "category": a["category"],
                "question": a["question_bengali"],
                "icon": a["icon"],
            }
            for a in actions
        ])
    except Exception as error:  # noqa: BLE001
        logger.exception("Error fetching quick actions")
        return jsonify({"error": str(error)}), 500


# ── Audio transcription ─────────────────────────────────────────────────────

@app.route("/audio/transcribe", methods=["POST"])
def transcribe_audio():
    try:
        body = request.get_json(silent=True) or {}
        audio_base64 = body.get("audioBase64")
        mime_type = body.get("mimeType")

        if not audio_base64 or not mime_type:
            return jsonify({"error": "audioBase64 and mimeType are required"}), 400

        from google.genai import types

        client = get_client()
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(
                    data=base64.b64decode(audio_base64), mime_type=mime_type
                ),
                types.Part.from_text(
                    text="এই অডিওটি বাংলায় ট্রান্সক্রাইব করুন। শুধুমাত্র ট্রান্সক্রিপ্শন দিন, অন্য কিছু নয়।"
                ),
            ],
        )
        return jsonify({"text": (response.text or "").strip()})
    except Exception as error:  # noqa: BLE001
        logger.exception("Audio transcription error")
        return jsonify({"error": str(error)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=False, host="0.0.0.0", port=port)
