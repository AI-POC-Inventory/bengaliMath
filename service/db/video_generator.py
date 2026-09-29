"""Admin video generator: create a staging row, hand the real work to the
service/video Cloud Run Job, then serve the review workflow.

Unlike question/lesson generation, rendering a video takes real minutes (TTS
per slide + Pillow render + ffmpeg mux), so this module does NOT do the work
inline in the HTTP request. generate() only:
  1. requires an approved lesson to exist (the video narrates it -- see
     service/video/entrypoint.py, which re-reads the lesson itself; the check
     here exists purely so the admin gets an immediate, clear 400 instead of
     waiting minutes for the job to fail with the same message)
  2. inserts a chapter_videos row with status='generating'
  3. starts an execution of the video job, passing that row's id
  4. returns immediately

The job fills the row in (status='draft', paths, duration) or marks it
'failed' with a reason. The admin UI polls list()/get() to see that happen.
Approve/reject/unpublish are the same shape as lesson_generator.py's: atomic
Postgres functions (see database/supabase/009_chapter_videos.sql), called
here, not reimplemented.
"""
import logging
import os
import random
import string
import time
from datetime import datetime, timezone

from supabase_client import supabase

from question_generator import GenerationError

log = logging.getLogger("video_generator")

VIDEO_JOB_NAME = os.environ.get("VIDEO_JOB_NAME", "bengali-math-video")
GCP_PROJECT = os.environ.get("GCP_PROJECT")
GCP_REGION = os.environ.get("GCP_REGION", "us-central1")

LIST_COLUMNS = ("id,class_id,chapter_id,version,status,source,duration_seconds,"
                "gcs_video_path,gcs_thumbnail_path,error,created_at,updated_at,reviewed_at")


def _next_version(chapter_id: str) -> int:
    rows = (supabase.table("chapter_videos").select("version")
            .eq("chapter_id", chapter_id).order("version", desc=True).limit(1).execute().data)
    return (rows[0]["version"] + 1) if rows else 1


def _trigger_job(row_id: str, class_id: int, chapter_id: str) -> None:
    """Fire-and-forget: starts an execution and returns without waiting for it
    to finish. If GCP_PROJECT isn't configured (local dev without the job
    deployed), this raises -- generate() catches that and marks the row
    'failed' rather than leaving it stuck at 'generating' forever."""
    from google.cloud import run_v2

    if not GCP_PROJECT:
        raise GenerationError("GCP_PROJECT কনফিগার করা নেই, ভিডিও জব চালু করা যায়নি", 500)

    client = run_v2.JobsClient()
    request = run_v2.RunJobRequest(
        name=f"projects/{GCP_PROJECT}/locations/{GCP_REGION}/jobs/{VIDEO_JOB_NAME}",
        overrides=run_v2.RunJobRequest.Overrides(container_overrides=[
            run_v2.RunJobRequest.Overrides.ContainerOverride(env=[
                run_v2.EnvVar(name="VIDEO_ROW_ID", value=row_id),
                run_v2.EnvVar(name="CLASS_ID", value=str(class_id)),
                run_v2.EnvVar(name="CHAPTER_ID", value=chapter_id),
            ]),
        ]),
    )
    client.run_job(request=request)          # returns a long-running operation; not awaited here


def _load_chapter(class_id: int, chapter_id: str) -> dict:
    """Deliberately NOT question_generator.resolve_chapter(): that function's
    job is checking the chapter_gcs_map book-chapter mapping, which question
    and lesson generation need (they search the textbook) but video
    generation does not -- it only narrates an already-approved lesson. In
    practice a chapter with an approved lesson always has a mapping too
    (lesson generation required one), but video's own real precondition is
    "has an approved lesson", checked separately below, so it must not
    silently inherit a different feature's requirement."""
    rows = (supabase.table("chapters").select("*")
           .eq("id", chapter_id).eq("class_id", class_id).limit(1).execute().data)
    if not rows:
        raise GenerationError("অধ্যায় পাওয়া যায়নি (chapter not found)", 404)
    return rows[0]


def generate(class_id: int, chapter_id: str) -> dict:
    chapter = _load_chapter(class_id, chapter_id)
    if not chapter.get("details"):
        raise GenerationError(
            "এই অধ্যায়ের কোনো অনুমোদিত পাঠ (lesson) নেই। ভিডিও তৈরির আগে একটি পাঠ অনুমোদন করুন।", 400)

    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    row = {
        "id": f"vid_{int(time.time() * 1000)}_{suffix}",
        "class_id": class_id, "chapter_id": chapter_id,
        "version": _next_version(chapter_id), "status": "generating", "source": "generated",
    }
    inserted = supabase.table("chapter_videos").insert(row).execute().data[0]

    try:
        _trigger_job(inserted["id"], class_id, chapter_id)
    except GenerationError:
        supabase.table("chapter_videos").update(
            {"status": "failed", "error": "ভিডিও জেনারেশন জব চালু করা যায়নি"}).eq("id", inserted["id"]).execute()
        raise
    except Exception as e:  # noqa: BLE001
        log.exception("failed to start video job")
        supabase.table("chapter_videos").update(
            {"status": "failed", "error": f"জব চালু করতে ব্যর্থ: {e}"}).eq("id", inserted["id"]).execute()
        raise GenerationError(f"ভিডিও জেনারেশন জব চালু করা যায়নি: {e}", 502) from e

    return inserted


def list_videos(class_id: int | None = None, chapter_id: str | None = None, status: str | None = None) -> list[dict]:
    query = supabase.table("chapter_videos").select(LIST_COLUMNS)
    if class_id:
        query = query.eq("class_id", class_id)
    if chapter_id:
        query = query.eq("chapter_id", chapter_id)
    if status:
        query = query.eq("status", status)
    return query.order("chapter_id").order("version", desc=True).execute().data


def get_video(video_id: str) -> dict:
    rows = supabase.table("chapter_videos").select("*").eq("id", video_id).limit(1).execute().data
    if not rows:
        raise GenerationError("ভিডিও পাওয়া যায়নি (video not found)", 404)
    return rows[0]


def _rpc(name: str, params: dict) -> dict:
    try:
        return supabase.rpc(name, params).execute().data
    except Exception as e:  # noqa: BLE001
        msg = getattr(e, "message", None) or str(e)
        if "not found" in msg:
            raise GenerationError("ভিডিও পাওয়া যায়নি (video not found)", 404) from e
        if "cannot approve" in msg:
            raise GenerationError("এই অবস্থার ভিডিও অনুমোদন করা যায় না (শুধু প্রস্তুত বা আগের সংস্করণ)", 409) from e
        if "no rendered file" in msg:
            raise GenerationError("এই ভিডিওটি এখনও তৈরি হয়নি, অনুমোদন করা যাবে না", 409) from e
        raise


def approve_video(video_id: str) -> dict:
    row = get_video(video_id)
    if row["status"] not in ("draft", "superseded"):
        raise GenerationError(f"শুধু প্রস্তুত ভিডিও অনুমোদন করা যায় (এটি এখন {row['status']})", 409)
    return _rpc("approve_video", {"p_id": video_id})


def reject_video(video_id: str) -> dict:
    row = get_video(video_id)
    if row["status"] != "draft":
        raise GenerationError(f"শুধু প্রস্তুত ভিডিও বাতিল করা যায় (এটি এখন {row['status']})", 409)
    return (supabase.table("chapter_videos")
            .update({"status": "rejected", "reviewed_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", video_id).execute().data)


def unpublish_video(chapter_id: str) -> dict:
    return _rpc("unpublish_video", {"p_chapter_id": chapter_id})
