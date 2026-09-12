"""Bengali Math -- search service (Flask).

Hybrid retrieval over the Class VII textbook index. The index is baked into
the container image and loaded once at startup; a cold start performs no
extraction, no OCR and no embedding of the corpus.

Endpoints:
    GET  /health
    GET  /search?q=...&top=5
    POST /search   {"q": "...", "top": 5}

Environment (Cloud Run injects these):
    INDEX_DIR, GOOGLE_API_KEY, CORS_ORIGINS, PORT
"""
import logging
import os
import time

from flask import Flask, jsonify, request
from flask_cors import CORS

from store import Store
from retrieve import search

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("search-api")

app = Flask(__name__)
CORS(app, origins=[o for o in os.getenv("CORS_ORIGINS", "*").split(",") if o])

_t0 = time.perf_counter()
STORE = Store()
log.info("index loaded in %.0f ms", (time.perf_counter() - _t0) * 1000)


@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "chunks": STORE.manifest.get("n_chunks"),
        "parents": STORE.manifest.get("n_parents"),
        "dim": STORE.manifest.get("dim"),
        "embedding_model": STORE.manifest.get("embedding_model"),
        "index_version": STORE.manifest.get("version"),
    })


@app.route("/search", methods=["GET", "POST"])
def search_route():
    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        q, top = body.get("q", ""), int(body.get("top", 5))
    else:
        q, top = request.args.get("q", ""), int(request.args.get("top", 5))

    q = (q or "").strip()
    if not q:
        return jsonify({"error": "query is required", "hint": "pass ?q=..."}), 400

    t0 = time.perf_counter()
    out = search(STORE, q, top=max(1, min(top, 20)))
    out["took_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return jsonify(out)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
