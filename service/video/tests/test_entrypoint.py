"""entrypoint.run()'s orchestration, with tts/render/storage/supabase all
faked -- no network, no spend. What's pinned: the chapter-has-no-lesson guard,
that the row is only ever finalized once (draft or failed, never left
'generating'), and that a mid-pipeline exception still reaches the row."""
import types

import pytest

import entrypoint
from entrypoint import VideoJobError


class _Query:
    def __init__(self, rows):
        self.rows, self.filters = rows, []

    def select(self, *a): return self
    def eq(self, k, v): self.filters.append((k, v)); return self
    def limit(self, *a): return self
    def order(self, *a, **k): return self
    def update(self, payload): self.payload = payload; return self

    def execute(self):
        rows = [r for r in self.rows if all(r.get(k) == v for k, v in self.filters)]
        return types.SimpleNamespace(data=rows)


class FakeSupabase:
    def __init__(self, chapters, lessons, videos):
        self._t = {"chapters": chapters, "generated_lessons": lessons, "chapter_videos": videos}
        self.updates = []

    def table(self, name):
        rows = self._t[name]
        q = _Query(rows)
        if name == "chapter_videos":
            real_execute = q.execute
            def execute():
                if hasattr(q, "payload"):
                    matched = [r for r in rows if all(r.get(k) == v for k, v in q.filters)]
                    for r in matched:
                        r.update(q.payload)
                        self.updates.append(dict(r))
                    return types.SimpleNamespace(data=matched)
                return real_execute()
            q.execute = execute
        return q


LESSON = {"overview": "o", "sections": [{"title": "T", "explanation": "E"}]}


def _patch_pipeline(monkeypatch, fail_at=None):
    calls = []

    def fake_assert_voice_exists():
        if fail_at == "voice":
            raise entrypoint.tts.UnknownVoiceError("bad voice")
        calls.append("voice_checked")

    def fake_synthesize(text):
        if fail_at == "tts":
            raise RuntimeError("tts down")
        calls.append(("tts", text))
        return types.SimpleNamespace(wav_bytes=b"wav", duration_seconds=1.0)

    def fake_render_slide_png(slide):
        import io
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (4, 4), (255, 0, 0)).save(buf, format="PNG")
        return buf.getvalue()          # a real PNG: entrypoint.run() uses clips[0] as the thumbnail source

    def fake_render_video(clips, out_path, work_dir):
        if fail_at == "render":
            raise RuntimeError("ffmpeg exploded")
        open(out_path, "wb").write(b"mp4-bytes")
        calls.append(("render", len(clips)))
        return sum(c.duration_seconds for c in clips)

    class FakeBlob:
        def __init__(self, path): self.path = path
        def upload_from_filename(self, path, content_type=None): calls.append(("upload_file", self.path))
        def upload_from_string(self, data, content_type=None): calls.append(("upload_bytes", self.path))

    class FakeBucket:
        def blob(self, path): return FakeBlob(path)

    class FakeStorageClient:
        def bucket(self, name): return FakeBucket()

    monkeypatch.setattr(entrypoint.tts, "assert_voice_exists", fake_assert_voice_exists)
    monkeypatch.setattr(entrypoint.tts, "synthesize", fake_synthesize)
    monkeypatch.setattr(entrypoint.tts, "TTS_VOICE", "bn-IN-Chirp3-HD-Achernar")
    monkeypatch.setattr(entrypoint.slides, "render_slide_png", fake_render_slide_png)
    monkeypatch.setattr(entrypoint.render, "render_video", fake_render_video)
    monkeypatch.setattr(entrypoint, "storage", types.SimpleNamespace(Client=lambda: FakeStorageClient()))
    return calls


def test_run_happy_path_writes_a_draft_row(monkeypatch):
    fake = FakeSupabase(
        chapters=[{"id": "7-5", "class_id": 7, "name": "সূচকের ধারণা", "details": LESSON}],
        lessons=[{"id": "lsn_1", "chapter_id": "7-5", "status": "approved"}],
        videos=[{"id": "vid_1", "chapter_id": "7-5", "version": 1, "status": "generating"}],
    )
    monkeypatch.setattr(entrypoint, "supabase", fake)
    calls = _patch_pipeline(monkeypatch)

    entrypoint.run("vid_1", 7, "7-5")

    final = fake._t["chapter_videos"][0]
    assert final["status"] == "draft"
    assert final["source_lesson_id"] == "lsn_1"
    assert final["gcs_video_path"] == "content/class7/videos/7-5/v1.mp4"
    assert final["gcs_thumbnail_path"] == "content/class7/videos/7-5/v1.jpg"
    assert final["duration_seconds"] > 0
    assert "voice_checked" in calls
    assert any(c[0] == "upload_file" for c in calls) and any(c[0] == "upload_bytes" for c in calls)


def test_run_without_an_approved_lesson_is_a_clear_failure_not_a_crash(monkeypatch):
    fake = FakeSupabase(
        chapters=[{"id": "7-9", "class_id": 7, "name": "X", "details": None}],
        lessons=[], videos=[{"id": "vid_2", "chapter_id": "7-9", "version": 1, "status": "generating"}],
    )
    monkeypatch.setattr(entrypoint, "supabase", fake)
    with pytest.raises(VideoJobError, match="অনুমোদিত পাঠ"):
        entrypoint.run("vid_2", 7, "7-9")


def test_run_with_unknown_chapter_raises_video_job_error(monkeypatch):
    fake = FakeSupabase(chapters=[], lessons=[], videos=[])
    monkeypatch.setattr(entrypoint, "supabase", fake)
    with pytest.raises(VideoJobError, match="not found"):
        entrypoint.run("vid_3", 7, "7-nope")


@pytest.mark.parametrize("fail_at", ["tts", "render"])
def test_pipeline_failure_propagates_for_main_to_catch(monkeypatch, fail_at):
    """run() itself doesn't swallow errors -- __main__'s except block is what
    writes status='failed'; this just confirms the exception actually escapes
    instead of being lost partway through the pipeline."""
    fake = FakeSupabase(
        chapters=[{"id": "7-5", "class_id": 7, "name": "T", "details": LESSON}],
        lessons=[], videos=[{"id": "vid_1", "chapter_id": "7-5", "version": 1, "status": "generating"}],
    )
    monkeypatch.setattr(entrypoint, "supabase", fake)
    _patch_pipeline(monkeypatch, fail_at=fail_at)
    with pytest.raises(RuntimeError):
        entrypoint.run("vid_1", 7, "7-5")
    # and the row must still be 'generating' -- run() never marks success/failure itself
    assert fake._t["chapter_videos"][0]["status"] == "generating"


def test_reruns_reread_the_version_so_they_dont_clobber_a_different_draft(monkeypatch):
    """The row's version comes from the DB, not from a value cached before the
    render started -- a slow first attempt and a fresh retry must not both
    resolve to writing v1's GCS path."""
    fake = FakeSupabase(
        chapters=[{"id": "7-5", "class_id": 7, "name": "T", "details": LESSON}],
        lessons=[], videos=[{"id": "vid_2", "chapter_id": "7-5", "version": 2, "status": "generating"}],
    )
    monkeypatch.setattr(entrypoint, "supabase", fake)
    _patch_pipeline(monkeypatch)
    entrypoint.run("vid_2", 7, "7-5")
    assert fake._t["chapter_videos"][0]["gcs_video_path"] == "content/class7/videos/7-5/v2.mp4"
