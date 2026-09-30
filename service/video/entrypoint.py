"""Cloud Run Job entrypoint: render one chapter's narrated video.

Invoked by service/db/api.py's POST /api/admin/videos/generate, which has
already inserted the chapter_videos row (status='generating') and passes its
id in via the environment -- this job's only responsibility is to fill that
row in, or mark it 'failed' with a reason. It never creates or approves rows;
that split keeps "does a draft exist to review" answerable from Supabase alone
even if this job crashes before writing anything.

Env vars (all required, set by the triggering Job execution's overrides):
  VIDEO_ROW_ID   chapter_videos.id to update
  CHAPTER_ID     e.g. "7-5"
  CLASS_ID       e.g. "7"
Plus the usual SUPABASE_URL / SUPABASE_KEY (service/video/.env locally, Cloud
Run env vars / secrets in production).
"""
import io
import logging
import os
import tempfile
import time
from datetime import datetime, timezone

from google.cloud import storage
from PIL import Image

import render
import script_builder
import slides
import tts
from supabase_client import supabase

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("video")

PUBLIC_BUCKET = "ganit-siksha"


class VideoJobError(Exception):
    """A known, reportable failure -- its message is written to
    chapter_videos.error verbatim, so keep these messages admin-facing."""


def _row_update(row_id: str, **fields) -> None:
    supabase.table("chapter_videos").update(fields).eq("id", row_id).execute()


def _fetch_chapter_and_lesson(class_id: int, chapter_id: str) -> tuple[dict, dict, str]:
    chapters = (supabase.table("chapters").select("id,name,details")
               .eq("id", chapter_id).eq("class_id", class_id).limit(1).execute().data)
    if not chapters:
        raise VideoJobError(f"chapter {chapter_id} not found for class {class_id}")
    chapter = chapters[0]
    if not chapter.get("details"):
        raise VideoJobError(
            "এই অধ্যায়ের কোনো অনুমোদিত পাঠ (lesson) নেই। ভিডিও তৈরির আগে একটি পাঠ অনুমোদন করুন। "
            "(no approved lesson for this chapter -- approve one before generating a video)")

    lessons = (supabase.table("generated_lessons").select("id")
              .eq("chapter_id", chapter_id).eq("status", "approved").limit(1).execute().data)
    source_lesson_id = lessons[0]["id"] if lessons else None
    return chapter, chapter["details"], source_lesson_id


def run(row_id: str, class_id: int, chapter_id: str) -> None:
    t0 = time.perf_counter()
    log.info("starting video generation: row=%s class=%s chapter=%s", row_id, class_id, chapter_id)

    # Cheap, local/DB checks first -- an unknown chapter or a missing lesson
    # is the common mistake and must not cost a network round-trip to catch.
    chapter, lesson, source_lesson_id = _fetch_chapter_and_lesson(class_id, chapter_id)
    script = script_builder.build_script(chapter["name"], lesson)
    log.info("script built: %d slides", len(script))

    tts.assert_voice_exists()          # fail fast and clearly if TTS_VOICE isn't real, before spending on any clip

    clips = []
    for i, slide in enumerate(script):
        narration = tts.synthesize(slide["narration"])
        png = slides.render_slide_png(slide)
        clips.append(render.Clip(png_bytes=png, wav_bytes=narration.wav_bytes,
                                 duration_seconds=narration.duration_seconds))
        log.info("slide %d/%d rendered (%.1fs narration)", i + 1, len(script), narration.duration_seconds)

    with tempfile.TemporaryDirectory() as work_dir:
        out_path = os.path.join(work_dir, "video.mp4")
        duration = render.render_video(clips, out_path, os.path.join(work_dir, "render"))
        log.info("muxed: %.1fs total, %s", duration, out_path)

        client = storage.Client()
        bucket = client.bucket(PUBLIC_BUCKET)

        video_path = f"content/class{class_id}/videos/{chapter_id}/v{{version}}.mp4"
        thumb_path = f"content/class{class_id}/videos/{chapter_id}/v{{version}}.jpg"
        # version is decided by the caller's row insert, not re-derived here --
        # read it back so a re-run of a failed generation doesn't silently
        # overwrite a different draft's file at the same path.
        row = supabase.table("chapter_videos").select("version").eq("id", row_id).limit(1).execute().data[0]
        video_path = video_path.format(version=row["version"])
        thumb_path = thumb_path.format(version=row["version"])

        bucket.blob(video_path).upload_from_filename(out_path, content_type="video/mp4")
        thumb_buf = io.BytesIO()
        Image.open(io.BytesIO(clips[0].png_bytes)).convert("RGB").save(thumb_buf, format="JPEG", quality=85)
        bucket.blob(thumb_path).upload_from_string(thumb_buf.getvalue(), content_type="image/jpeg")

    _row_update(
        row_id,
        status="draft",
        source_lesson_id=source_lesson_id,
        script=script,
        tts_voice=tts.TTS_VOICE,
        gcs_video_path=video_path,
        gcs_thumbnail_path=thumb_path,
        duration_seconds=round(duration, 1),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )

    log.info("done in %.0fs: %s (%.1fs runtime)", time.perf_counter() - t0, video_path, duration)


if __name__ == "__main__":
    row_id = os.environ["VIDEO_ROW_ID"]
    try:
        run(row_id, int(os.environ["CLASS_ID"]), os.environ["CHAPTER_ID"])
    except VideoJobError as e:
        log.error("video generation failed: %s", e)
        _row_update(row_id, status="failed", error=str(e))
        raise SystemExit(1)
    except Exception as e:  # noqa: BLE001
        log.exception("video generation crashed")
        _row_update(row_id, status="failed", error=f"অপ্রত্যাশিত ত্রুটি (unexpected error): {e}")
        raise SystemExit(1)
