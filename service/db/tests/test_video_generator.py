"""video_generator.py: the staging-row lifecycle around the (mocked) Cloud Run
Job trigger, and the review workflow. No network -- the chapter lookup and the
job trigger are both monkeypatched."""
import types

import pytest

import video_generator as vg
from question_generator import GenerationError


class _Table:
    """Minimal in-memory chapter_videos, mirrors the fakes used for lessons/
    questions in this test suite."""
    def __init__(self, db):
        self.db, self.filters, self.op, self.payload, self.ordering = db, [], "select", None, None

    def select(self, *a): self.op = "select"; return self
    def insert(self, row): self.op, self.payload = "insert", row; return self
    def update(self, payload): self.op, self.payload = "update", payload; return self
    def eq(self, key, value): self.filters.append((key, value)); return self
    def order(self, col, desc=False): self.ordering = (col, desc); return self
    def limit(self, *a): return self

    def execute(self):
        if self.op == "insert":
            self.db.append(dict(self.payload))
            return types.SimpleNamespace(data=[dict(self.payload)])
        rows = [r for r in self.db if all(r.get(k) == v for k, v in self.filters)]
        if self.op == "update":
            for r in rows:
                r.update(self.payload)
        if self.ordering:
            rows = sorted(rows, key=lambda r: r[self.ordering[0]], reverse=self.ordering[1])
        return types.SimpleNamespace(data=[dict(r) for r in rows])


@pytest.fixture
def db(monkeypatch):
    rows = []
    monkeypatch.setattr(vg, "supabase", types.SimpleNamespace(
        table=lambda name: _Table(rows),
        rpc=lambda name, params: types.SimpleNamespace(
            execute=lambda: types.SimpleNamespace(data={"ok": True, "called": name, **params}))))
    return rows


def test_generate_does_not_reuse_question_generators_book_mapping_check(monkeypatch, db):
    """Regression guard: video's chapter lookup must be its own, not
    question_generator.resolve_chapter -- that function 404/400s on a missing
    chapter_gcs_map entry, a book-search concern video generation doesn't
    have (it only narrates an already-approved lesson)."""
    import question_generator
    def must_not_be_called(*a, **k):
        raise AssertionError("video_generator must not call question_generator.resolve_chapter")
    monkeypatch.setattr(question_generator, "resolve_chapter", must_not_be_called)
    monkeypatch.setattr(vg, "_load_chapter", lambda cid, chid: {"id": chid, "details": None})
    with pytest.raises(GenerationError):
        vg.generate(7, "7-5")


def test_load_chapter_unknown_is_404(db):
    with pytest.raises(GenerationError) as e:
        vg._load_chapter(7, "nope")
    assert e.value.status == 404


def test_generate_requires_an_approved_lesson(monkeypatch, db):
    monkeypatch.setattr(vg, "_load_chapter", lambda cid, chid: {"id": chid, "details": None})
    with pytest.raises(GenerationError) as e:
        vg.generate(7, "7-5")
    assert e.value.status == 400 and "পাঠ" in e.value.message
    assert db == []                       # no half-created row for a request that never should have started


def test_generate_creates_a_generating_row_and_triggers_the_job(monkeypatch, db):
    monkeypatch.setattr(vg, "_load_chapter", lambda cid, chid: {"id": chid, "details": {"overview": "x"}})
    triggered = []
    monkeypatch.setattr(vg, "_trigger_job", lambda row_id, class_id, chapter_id: triggered.append((row_id, class_id, chapter_id)))

    row = vg.generate(7, "7-5")

    assert row["status"] == "generating" and row["class_id"] == 7 and row["chapter_id"] == "7-5"
    assert row["version"] == 1
    assert triggered == [(row["id"], 7, "7-5")]
    assert db[0]["status"] == "generating"


def test_generate_versions_increment_per_chapter(monkeypatch, db):
    monkeypatch.setattr(vg, "_load_chapter", lambda cid, chid: {"id": chid, "details": {"overview": "x"}})
    monkeypatch.setattr(vg, "_trigger_job", lambda *a: None)
    a = vg.generate(7, "7-5")
    b = vg.generate(7, "7-5")
    other = vg.generate(7, "7-6")
    assert (a["version"], b["version"], other["version"]) == (1, 2, 1)


def test_generate_marks_the_row_failed_if_the_job_cannot_be_started(monkeypatch, db):
    """The row must never be left stuck at 'generating' when we already know,
    synchronously, that nothing is going to update it."""
    monkeypatch.setattr(vg, "_load_chapter", lambda cid, chid: {"id": chid, "details": {"overview": "x"}})

    def boom(row_id, class_id, chapter_id):
        raise RuntimeError("Cloud Run Admin API unreachable")
    monkeypatch.setattr(vg, "_trigger_job", boom)

    with pytest.raises(GenerationError) as e:
        vg.generate(7, "7-5")
    assert e.value.status == 502
    assert db[0]["status"] == "failed" and "চালু করতে ব্যর্থ" in db[0]["error"]


def test_get_video_unknown_id_is_404(db):
    with pytest.raises(GenerationError) as e:
        vg.get_video("nope")
    assert e.value.status == 404


def test_list_videos_filters(db):
    db.extend([
        {"id": "v1", "class_id": 7, "chapter_id": "7-5", "version": 1, "status": "draft"},
        {"id": "v2", "class_id": 7, "chapter_id": "7-6", "version": 1, "status": "approved"},
    ])
    assert [r["id"] for r in vg.list_videos(chapter_id="7-5")] == ["v1"]
    assert [r["id"] for r in vg.list_videos(status="approved")] == ["v2"]


def test_approve_only_allowed_from_draft_or_superseded(db):
    db.append({"id": "v1", "status": "generating"})
    with pytest.raises(GenerationError) as e:
        vg.approve_video("v1")
    assert e.value.status == 409


def test_approve_calls_the_atomic_rpc(db):
    db.append({"id": "v1", "status": "draft"})
    result = vg.approve_video("v1")
    assert result["called"] == "approve_video" and result["p_id"] == "v1"


def test_reject_only_allowed_from_draft(db):
    db.append({"id": "v1", "status": "approved"})
    with pytest.raises(GenerationError) as e:
        vg.reject_video("v1")
    assert e.value.status == 409


def test_reject_sets_status_and_a_real_timestamp_not_the_literal_now(db):
    db.append({"id": "v1", "status": "draft"})
    result = vg.reject_video("v1")
    assert result[0]["status"] == "rejected"
    assert result[0]["reviewed_at"] != "now()"
    assert result[0]["reviewed_at"].startswith("20")   # a real ISO timestamp, e.g. "2026-09-29T..."


def test_unpublish_calls_the_atomic_rpc(db):
    result = vg.unpublish_video("7-5")
    assert result["called"] == "unpublish_video" and result["p_chapter_id"] == "7-5"


def test_rpc_error_messages_map_to_expected_statuses(db):
    def rpc_raising(text):
        class Err(Exception):
            message = text
        def _rpc(name, params):
            raise Err()
        return _rpc
    db.append({"id": "v1", "status": "draft"})
    for text, status in [("video v1 not found", 404), ("cannot approve a video that is draft", 409),
                         ("video v1 has no rendered file to publish", 409)]:
        vg.supabase.rpc = rpc_raising(text)
        with pytest.raises(GenerationError) as e:
            vg.approve_video("v1")
        assert e.value.status == status
