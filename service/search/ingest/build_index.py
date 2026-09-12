"""Step 07 -- embed chunks and write the index bundle."""
import json
import logging

import numpy as np

from config import DIST, BOOK_ID, EMBED_MODEL, EMBED_DIM
from embed import embed_documents
from gcs_paths import INDEX_VERSION

log = logging.getLogger("build_index")


def build(chunks: list[dict], parents: dict) -> dict:
    V = embed_documents([c["embed_text"] for c in chunks])
    assert V.shape[0] == len(chunks), "embedding/chunk count mismatch"

    np.save(DIST / "vectors.npy", V)
    (DIST / "chunks.json").write_text(
        json.dumps([{k: v for k, v in c.items() if k != "embed_text"}
                    for c in chunks], ensure_ascii=False), encoding="utf-8")
    (DIST / "parents.json").write_text(
        json.dumps(parents, ensure_ascii=False), encoding="utf-8")

    manifest = {
        "book_id": BOOK_ID, "version": INDEX_VERSION,
        "n_chunks": len(chunks), "n_parents": len(parents),
        "dim": int(V.shape[1]),
        "embedding_model": EMBED_MODEL, "embedding_dim": EMBED_DIM,
        "vectors_mb": round(V.nbytes / 1e6, 2),
    }
    (DIST / "manifest.json").write_text(json.dumps(manifest, indent=1),
                                        encoding="utf-8")
    log.info("index: %d chunks, %.1f MB of vectors", len(chunks), V.nbytes / 1e6)
    return manifest
