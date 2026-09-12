"""Hybrid retrieval: dense + BM25, fused with RRF, expanded to parents."""
import re
from collections import defaultdict

import numpy as np

from normalize import fold

K_RRF, POOL, FINAL = 60, 30, 5
_CH = re.compile(r"(?:অধ্যায়|chapter|odhyay)\s*(\d{1,2})")
_EX = re.compile(r"\b(\d{1,2}\.\d{1,2})\b")


def parse_filters(query: str) -> dict:
    q, f = fold(query), {}
    if (m := _CH.search(q)):
        f["chapter_no"] = int(m.group(1))
    if (m := _EX.search(q)):
        f["exercise_id"] = m.group(1)
    return f


def rrf(rankings: list[list[int]], k: int = K_RRF) -> list[int]:
    s: dict[int, float] = defaultdict(float)
    for ranking in rankings:
        for rank, doc in enumerate(ranking, start=1):
            s[doc] += 1.0 / (k + rank)
    return sorted(s, key=s.get, reverse=True)


def search(store, query: str, top: int = FINAL, group_by_parent: bool = True):
    filters = parse_filters(query)
    allowed = store.candidates(filters)

    qv = store.embed_query(query)
    sims = store.V @ qv
    if allowed is not None:
        masked = np.full(sims.shape, -np.inf, dtype=sims.dtype)
        idx = np.fromiter(allowed, dtype=int)
        masked[idx] = sims[idx]
        sims = masked
    n = min(POOL, len(sims) - 1) if len(sims) > 1 else 1
    dense = np.argpartition(-sims, n)[:n]
    dense = [int(i) for i in dense[np.argsort(-sims[dense])] if np.isfinite(sims[i])]

    lexical = store.bm25.search(query, allowed, POOL)

    out, seen = [], set()
    for i in rrf([dense, lexical]):
        c = store.chunks[i]
        if group_by_parent:
            if c["parent_id"] in seen:
                continue
            seen.add(c["parent_id"])
        out.append({
            **{k: v for k, v in c.items() if k != "text_norm"},
            "score_dense": float(sims[i]) if np.isfinite(sims[i]) else None,
            "parent": store.parents.get(c["parent_id"]),
        })
        if len(out) == top:
            break
    return {"query": query, "filters": filters, "results": out}
