"""Embedding helper for question-generator dedup.

Port of service/search/ingest/embed.py (~20 lines) rather than a cross-service
import: service/db and service/search are deployed as separate Cloud Run
services with separate Dockerfiles/build contexts, so importing across that
boundary isn't practical. Kept behaviourally identical, including the one
detail that matters: truncated MRL embeddings from gemini-embedding-001 are
NOT unit length (measured norm ~0.58 at 768 dims when service/search was
built) -- skip the L2-normalise step and every cosine-similarity comparison
in the dedup check silently comes out wrong.
"""
import logging
import os

import numpy as np

log = logging.getLogger("embed")

EMBED_MODEL = os.environ.get("EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = int(os.environ.get("EMBED_DIM", "768"))
EMBED_BATCH = int(os.environ.get("EMBED_BATCH", "50"))

_client = None


def _c():
    global _client
    if _client is None:
        from google import genai
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=api_key)
    return _client


def _embed(texts: list[str], task_type: str) -> np.ndarray:
    from google.genai import types
    r = _c().models.embed_content(
        model=EMBED_MODEL, contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM,
                                        task_type=task_type),
    )
    V = np.array([e.values for e in r.embeddings], dtype="float32")
    V /= np.linalg.norm(V, axis=1, keepdims=True)
    return V


def embed_documents(texts: list[str]) -> np.ndarray:
    """Batch-embed for indexing / comparison-against (e.g. existing questions)."""
    if not texts:
        return np.zeros((0, EMBED_DIM), dtype="float32")
    out = []
    for i in range(0, len(texts), EMBED_BATCH):
        out.append(_embed(texts[i:i + EMBED_BATCH], "RETRIEVAL_DOCUMENT"))
        log.debug("embedded %d/%d", min(i + EMBED_BATCH, len(texts)), len(texts))
    return np.vstack(out)


def embed_query(text: str) -> np.ndarray:
    return _embed([text], "RETRIEVAL_QUERY")[0]


def max_cosine_similarity(candidate: np.ndarray, against: np.ndarray) -> tuple[float, int]:
    """Highest cosine similarity between one candidate vector and a bank of
    existing vectors, plus the index of the closest match. Both inputs must
    already be L2-normalised (embed_documents/embed_query do this), so a dot
    product is the cosine similarity directly. Returns (0.0, -1) when `against`
    is empty -- nothing to compare against, not a duplicate by definition."""
    if against.shape[0] == 0:
        return 0.0, -1
    sims = against @ candidate
    idx = int(np.argmax(sims))
    return float(sims[idx]), idx
