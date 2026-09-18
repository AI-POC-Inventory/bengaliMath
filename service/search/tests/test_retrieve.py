"""Query filter parsing and rank fusion, on a synthetic index."""
import numpy as np
import pytest

from retrieve import parse_filters, rrf, search

PRECOMPOSED = "\u0985\u09a7\u09cd\u09af\u09be\u09df"
DECOMPOSED = "\u0985\u09a7\u09cd\u09af\u09be\u09af\u09bc"


def test_chapter_filter_parses_both_unicode_forms():
    assert parse_filters(f"{PRECOMPOSED} 16") == {"chapter_no": 16}
    assert parse_filters(f"{DECOMPOSED} 16") == {"chapter_no": 16}


def test_chapter_filter_accepts_english_and_bengali_numerals():
    assert parse_filters("chapter 3")["chapter_no"] == 3
    assert parse_filters(f"{PRECOMPOSED} ৩")["chapter_no"] == 3


def test_exercise_reference_is_parsed():
    """The query archetype dense embeddings blur worst -- 1.2 vs 1.3."""
    assert parse_filters("কষে দেখি 1.2") == {"exercise_id": "1.2"}
    assert parse_filters("নিজে করি 21.2")["exercise_id"] == "21.2"


def test_plain_question_yields_no_filter():
    assert parse_filters("শতকরা বৃদ্ধি কীভাবে বার করব") == {}


def test_rrf_rewards_agreement_between_arms():
    """A document both arms rank highly must beat one only a single arm likes."""
    dense = [10, 1, 2]
    lexical = [20, 1, 3]
    assert rrf([dense, lexical])[0] == 1


def test_rrf_is_stable_with_one_empty_ranking():
    assert rrf([[5, 6], []]) == [5, 6]


class _FakeStore:
    """Minimal stand-in: 4 chunks, orthogonal vectors, real BM25."""

    def __init__(self):
        from store import BM25
        self.chunks = [
            {"id": "a", "text": "শতকরা কীভাবে বার করব", "text_norm": "শতকরা কীভাবে বার করব",
             "parent_id": "p1", "chapter_no": 1, "exercise_id": "1.2", "printed_page": 10},
            {"id": "b", "text": "5 : 7 :: 10 : 14", "text_norm": "5 : 7 :: 10 : 14",
             "parent_id": "p2", "chapter_no": 3, "exercise_id": "3.1", "printed_page": 35},
            {"id": "c", "text": "ত্রিভুজ অঙ্কন", "text_norm": "ত্রিভুজ অঙ্কন",
             "parent_id": "p3", "chapter_no": 8, "exercise_id": None, "printed_page": 117},
            {"id": "d", "text": "অন্য কিছু", "text_norm": "অন্য কিছু",
             "parent_id": "p3", "chapter_no": 8, "exercise_id": None, "printed_page": 118},
        ]
        self.parents = {f"p{i}": {"id": f"p{i}", "heading": f"h{i}"} for i in (1, 2, 3)}
        self.V = np.eye(4, 8, dtype="float32")
        self.bm25 = BM25([c["text_norm"] for c in self.chunks])

    def candidates(self, filters):
        idx = {i for i, c in enumerate(self.chunks)
               if all(c.get(k) == v for k, v in filters.items())}
        return idx or None

    def embed_query(self, text):           # no network in tests
        return self.V[0]


@pytest.fixture
def store():
    return _FakeStore()


def test_lexical_arm_finds_exact_notation(store):
    """Pure-dense retrieval loses this query; it is the reason for hybrid."""
    hits = search(store, "5 : 7 :: 10 : 14", top=3)["results"]
    assert hits[0]["id"] == "b"


def test_metadata_prefilter_restricts_candidates(store):
    out = search(store, "chapter 8", top=5)
    assert out["filters"] == {"chapter_no": 8}
    assert {h["chapter_no"] for h in out["results"]} == {8}


def test_results_are_grouped_by_parent(store):
    """Chunks c and d share parent p3; one hit per exercise set."""
    out = search(store, "chapter 8", top=5)
    assert len(out["results"]) == 1
    assert out["results"][0]["parent_id"] == "p3"


def test_parent_is_attached_for_generation(store):
    hits = search(store, "5 : 7 :: 10 : 14", top=1)["results"]
    assert hits[0]["parent"]["heading"] == "h2"


def test_unmatched_filter_does_not_blank_results(store):
    """A filter matching nothing must fall back, not return an empty page."""
    out = search(store, "chapter 99", top=3)
    assert out["results"]
