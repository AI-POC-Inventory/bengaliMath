"""Multi-chapter retrieval and chapter resolution (chapter_gcs_map)."""
import types

import pytest

import question_generator as qg


def _fake_search(calls):
    def search(topic, n, top):
        calls.append((n, top))
        return [{"id": f"c{n}-{i}", "context_prefix": f"অধ্যায় {n}", "text": f"t{n}{i}"} for i in range(top)]
    return search


def test_two_chapters_split_budget_and_interleave(monkeypatch):
    calls = []
    monkeypatch.setattr(qg, "_search_chapter", _fake_search(calls))
    _, ids = qg.retrieve_context({"name": "অনুপাত"}, [2, 3])
    assert calls == [(2, 10), (3, 10)]
    assert len(ids) == 20
    assert ids[:4] == ["c2-0", "c3-0", "c2-1", "c3-1"]          # rank-interleaved, neither chapter crowds out


def test_single_chapter_is_unchanged(monkeypatch):
    calls = []
    monkeypatch.setattr(qg, "_search_chapter", _fake_search(calls))
    _, ids = qg.retrieve_context({"name": "x"}, [7])
    assert calls == [(7, 20)]
    assert ids == [f"c7-{i}" for i in range(20)]


def test_uneven_split_is_capped_at_top_k(monkeypatch):
    calls = []
    monkeypatch.setattr(qg, "_search_chapter", _fake_search(calls))
    _, ids = qg.retrieve_context({"name": "x"}, [1, 2, 3])
    assert calls == [(1, 7), (2, 7), (3, 7)]
    assert len(ids) == 20


def test_custom_top_k(monkeypatch):
    calls = []
    monkeypatch.setattr(qg, "_search_chapter", _fake_search(calls))
    _, ids = qg.retrieve_context({"name": "x"}, [2, 3], top_k=30)
    assert calls == [(2, 15), (3, 15)] and len(ids) == 30


def test_duplicate_chunk_across_chapters_not_repeated(monkeypatch):
    monkeypatch.setattr(qg, "_search_chapter", lambda t, n, top: [{"id": "same", "text": "a"}])
    assert qg.retrieve_context({"name": "x"}, [2, 3])[1] == ["same"]


def test_one_empty_chapter_is_fine_all_empty_is_400(monkeypatch):
    monkeypatch.setattr(qg, "_search_chapter", lambda t, n, top: [] if n == 2 else [{"id": "z", "text": "a"}])
    assert qg.retrieve_context({"name": "x"}, [2, 3])[1] == ["z"]
    monkeypatch.setattr(qg, "_search_chapter", lambda t, n, top: [])
    with pytest.raises(qg.GenerationError) as e:
        qg.retrieve_context({"name": "x"}, [2, 3])
    assert e.value.status == 400


class _Query:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *a): return self
    def eq(self, *a): return self
    def limit(self, *a): return self
    def execute(self): return types.SimpleNamespace(data=self.rows)


def _fake_supabase(maps):
    return types.SimpleNamespace(
        table=lambda name: _Query([{"id": "7-1", "class_id": 7}] if name == "chapters" else maps))


def test_resolve_chapter_collects_sorted_book_chapters(monkeypatch):
    monkeypatch.setattr(qg, "supabase", _fake_supabase([{"gcs_chapter_no": 3}, {"gcs_chapter_no": 2}]))
    assert qg.resolve_chapter(7, "7-1")["gcs_chapter_nos"] == [2, 3]


def test_resolve_chapter_unmapped_is_a_clear_400(monkeypatch):
    monkeypatch.setattr(qg, "supabase", _fake_supabase([]))
    with pytest.raises(qg.GenerationError) as e:
        qg.resolve_chapter(7, "7-1")
    assert e.value.status == 400 and "ইনডেক্স" in e.value.message
