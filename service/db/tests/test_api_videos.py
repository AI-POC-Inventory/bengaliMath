"""Route wiring for /api/admin/videos/*: each route calls the right
video_generator function with the right arguments, and GenerationError /
unexpected exceptions map to the right HTTP status -- same contract
test_api_approve.py pins for the question-approval routes."""
import types

import pytest

import api
from question_generator import GenerationError


@pytest.fixture
def client():
    return api.app.test_client()


def _stub(monkeypatch, name, fn):
    monkeypatch.setattr(api.videos, name, fn)


def test_generate_requires_class_and_chapter(client):
    assert client.post("/api/admin/videos/generate", json={}).status_code == 400
    assert client.post("/api/admin/videos/generate", json={"classId": 7}).status_code == 400


def test_generate_calls_video_generator_with_parsed_args(client, monkeypatch):
    calls = []
    _stub(monkeypatch, "generate", lambda class_id, chapter_id: calls.append((class_id, chapter_id)) or {"id": "v1"})
    res = client.post("/api/admin/videos/generate", json={"classId": "7", "chapterId": "7-5"})
    assert res.status_code == 200 and res.get_json() == {"id": "v1"}
    assert calls == [(7, "7-5")]


def test_list_passes_query_filters_through(client, monkeypatch):
    calls = []
    _stub(monkeypatch, "list_videos", lambda *a: calls.append(a) or [])
    client.get("/api/admin/videos?classId=7&chapterId=7-5&status=draft")
    assert calls == [(7, "7-5", "draft")]

    calls.clear()
    client.get("/api/admin/videos")
    assert calls == [(None, None, None)]


@pytest.mark.parametrize("path,method,fn_name,args", [
    ("/api/admin/videos/v1", "get", "get_video", ("v1",)),
    ("/api/admin/videos/v1/approve", "post", "approve_video", ("v1",)),
    ("/api/admin/videos/v1/reject", "post", "reject_video", ("v1",)),
    ("/api/admin/videos/chapter/7-5/unpublish", "post", "unpublish_video", ("7-5",)),
])
def test_simple_routes_delegate_with_the_right_args(client, monkeypatch, path, method, fn_name, args):
    calls = []
    _stub(monkeypatch, fn_name, lambda *a: calls.append(a) or {"ok": True})
    getattr(client, method)(path)
    assert calls == [args]


def test_generation_error_maps_to_its_own_status(client, monkeypatch):
    def boom(class_id, chapter_id):
        raise GenerationError("এই অধ্যায়ের কোনো অনুমোদিত পাঠ নেই", 400)
    _stub(monkeypatch, "generate", boom)
    res = client.post("/api/admin/videos/generate", json={"classId": 7, "chapterId": "7-5"})
    assert res.status_code == 400 and res.get_json() == {"error": "এই অধ্যায়ের কোনো অনুমোদিত পাঠ নেই"}


def test_unexpected_exception_is_a_500_not_a_crash(client, monkeypatch):
    def boom(video_id):
        raise RuntimeError("db exploded")
    _stub(monkeypatch, "get_video", boom)
    res = client.get("/api/admin/videos/v1")
    assert res.status_code == 500 and "db exploded" in res.get_json()["details"]
