"""In-process index. Loaded once at startup; never rebuilt per request."""
import json
import logging
import math
import os
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

log = logging.getLogger("store")
INDEX_DIR = Path(os.getenv("INDEX_DIR", "./index"))


class BM25:
    """Rebuilt at startup from the chunk store -- ~140 ms for 4k docs, so it
    is not worth shipping as a serialised artefact."""

    def __init__(self, docs: list[str], k1: float = 1.5, b: float = 0.75):
        from normalize import tokens
        self._tokens = tokens
        self.k1, self.b = k1, b
        self.tf = [Counter(tokens(d)) for d in docs]
        self.len = np.array([sum(c.values()) or 1 for c in self.tf], dtype="float32")
        self.avg = float(self.len.mean()) if len(self.len) else 1.0
        df = Counter()
        for c in self.tf:
            df.update(c.keys())
        n = max(len(docs), 1)
        self.idf = {t: math.log(1 + (n - v + 0.5) / (v + 0.5)) for t, v in df.items()}
        self.postings = defaultdict(list)
        for i, c in enumerate(self.tf):
            for t in c:
                self.postings[t].append(i)

    def search(self, query: str, allowed: set[int] | None, top: int) -> list[int]:
        scores: dict[int, float] = defaultdict(float)
        for t in self._tokens(query):
            idf = self.idf.get(t)
            if not idf:
                continue
            for i in self.postings[t]:
                if allowed is not None and i not in allowed:
                    continue
                f = self.tf[i][t]
                denom = f + self.k1 * (1 - self.b + self.b * self.len[i] / self.avg)
                scores[i] += idf * f * (self.k1 + 1) / denom
        return sorted(scores, key=scores.get, reverse=True)[:top]


class Store:
    def __init__(self, index_dir: Path = INDEX_DIR):
        self.dir = index_dir
        self.manifest = json.loads((index_dir / "manifest.json").read_text("utf-8"))
        self.V = np.load(index_dir / "vectors.npy")
        self.chunks = json.loads((index_dir / "chunks.json").read_text("utf-8"))
        self.parents = json.loads((index_dir / "parents.json").read_text("utf-8"))
        assert self.V.shape[0] == len(self.chunks), "vector/chunk count mismatch"

        self.bm25 = BM25([c["text_norm"] for c in self.chunks])
        self._by_chapter = defaultdict(set)
        self._by_exercise = defaultdict(set)
        for i, c in enumerate(self.chunks):
            if c.get("chapter_no"):
                self._by_chapter[int(c["chapter_no"])].add(i)
            if c.get("exercise_id"):
                self._by_exercise[str(c["exercise_id"])].add(i)
        log.info("store: %d chunks, dim %d, model %s",
                 len(self.chunks), self.V.shape[1],
                 self.manifest.get("embedding_model"))

    def candidates(self, filters: dict) -> set[int] | None:
        sets = []
        if "chapter_no" in filters:
            sets.append(self._by_chapter.get(filters["chapter_no"], set()))
        if "exercise_id" in filters:
            sets.append(self._by_exercise.get(filters["exercise_id"], set()))
        if not sets:
            return None
        out = set.intersection(*sets) if len(sets) > 1 else sets[0]
        # A filter that matches nothing must not blank the result set.
        return out or None

    def embed_query(self, text: str) -> np.ndarray:
        from embed import embed_query
        return embed_query(text)
