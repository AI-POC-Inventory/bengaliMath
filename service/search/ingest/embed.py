"""Embedding provider seam. Gemini multilingual embeddings, L2-normalised."""
import logging

import numpy as np

from config import GOOGLE_API_KEY, EMBED_MODEL, EMBED_DIM, EMBED_BATCH

log = logging.getLogger("embed")
_client = None


def _c():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=GOOGLE_API_KEY)
    return _client


def _embed(texts: list[str], task_type: str) -> np.ndarray:
    from google.genai import types
    r = _c().models.embed_content(
        model=EMBED_MODEL, contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM,
                                        task_type=task_type),
    )
    V = np.array([e.values for e in r.embeddings], dtype="float32")
    # Truncated MRL embeddings are NOT unit length (measured norm ~0.58 at
    # 768 dims). Normalise so a dot product is cosine similarity.
    V /= np.linalg.norm(V, axis=1, keepdims=True)
    return V


def embed_documents(texts: list[str]) -> np.ndarray:
    out = []
    for i in range(0, len(texts), EMBED_BATCH):
        out.append(_embed(texts[i:i + EMBED_BATCH], "RETRIEVAL_DOCUMENT"))
        log.info("  embedded %d/%d", min(i + EMBED_BATCH, len(texts)), len(texts))
    return np.vstack(out)


def embed_query(text: str) -> np.ndarray:
    return _embed([text], "RETRIEVAL_QUERY")[0]
