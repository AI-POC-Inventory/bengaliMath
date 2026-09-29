-- Supabase Migration 009: chapter videos (generated, reviewed, then published)
--
-- Same generate -> review -> approve -> publish shape as chapter lessons (007),
-- with one structural difference generation is asynchronous: rendering a video
-- (TTS + slide render + ffmpeg mux) takes real minutes, so it runs in a Cloud
-- Run Job, not inside the HTTP request that starts it. The staging row exists
-- BEFORE the job finishes (status='generating') so the admin has something to
-- poll, and the job fills it in (or marks it 'failed') when done.
--
-- Design:
--   * chapters.video (JSONB) holds the LIVE video's pointer only -- url,
--     thumbnailUrl, durationSeconds -- mirroring chapters.details for lessons.
--     Deliberately a SEPARATE column from chapters.details, not nested inside
--     it: the lesson feature's approve_lesson() already overwrites `details`
--     wholesale, and video and lesson are approved independently (a video can
--     be regenerated without touching the lesson, and vice versa).
--   * chapter_videos is the staging/history table.
--   * A video is generated FROM an approved lesson (source_lesson_id), not
--     from a fresh LLM call -- the narration script comes from content that
--     already passed the lesson's own review and worked-example verification.
--
-- Approve / unpublish are plpgsql functions, same reasoning as 007: the status
-- flip and the chapters.video write must be one transaction.
--
-- Safe to re-run.

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS video JSONB;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS video_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS chapter_videos (
  id                TEXT PRIMARY KEY,
  class_id          INTEGER NOT NULL REFERENCES classes(id),
  chapter_id        TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,                       -- per chapter, 1,2,3...
  status            TEXT NOT NULL DEFAULT 'generating'
                    CHECK (status IN ('generating', 'draft', 'approved', 'rejected', 'superseded', 'failed')),
  source            TEXT NOT NULL DEFAULT 'generated' CHECK (source IN ('generated', 'uploaded')),
  source_lesson_id  TEXT REFERENCES generated_lessons(id),
  script            JSONB,                                  -- narration text actually sent to TTS, per slide
  tts_voice         TEXT,
  gcs_video_path    TEXT,                                   -- gs:// path, set when status leaves 'generating'
  gcs_thumbnail_path TEXT,
  duration_seconds  NUMERIC,
  error             TEXT,                                   -- set when status='failed'
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  UNIQUE (chapter_id, version)
);

CREATE INDEX IF NOT EXISTS idx_chapter_videos_chapter ON chapter_videos(chapter_id, status);

-- At most one live video per chapter, enforced by the database itself.
CREATE UNIQUE INDEX IF NOT EXISTS uq_chapter_videos_one_approved
  ON chapter_videos(chapter_id) WHERE status = 'approved';

-- Approve a draft (or re-approve a superseded version = rollback).
CREATE OR REPLACE FUNCTION approve_video(p_id TEXT) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  r chapter_videos%ROWTYPE;
  v_pointer JSONB;
BEGIN
  SELECT * INTO r FROM chapter_videos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'video % not found', p_id;
  END IF;
  IF r.status NOT IN ('draft', 'superseded') THEN
    RAISE EXCEPTION 'cannot approve a video that is %', r.status;
  END IF;
  IF r.gcs_video_path IS NULL THEN
    RAISE EXCEPTION 'video % has no rendered file to publish', p_id;
  END IF;

  v_pointer := jsonb_build_object(
    'url', 'https://storage.googleapis.com/ganit-siksha/' || r.gcs_video_path,
    'thumbnailUrl', CASE WHEN r.gcs_thumbnail_path IS NOT NULL
                         THEN 'https://storage.googleapis.com/ganit-siksha/' || r.gcs_thumbnail_path END,
    'durationSeconds', r.duration_seconds,
    'version', r.version
  );

  UPDATE chapter_videos SET status = 'superseded', updated_at = NOW()
   WHERE chapter_id = r.chapter_id AND status = 'approved';
  UPDATE chapter_videos SET status = 'approved', reviewed_at = NOW(), updated_at = NOW()
   WHERE id = p_id;
  UPDATE chapters SET video = v_pointer, video_updated_at = NOW() WHERE id = r.chapter_id;

  RETURN jsonb_build_object('ok', true, 'chapterId', r.chapter_id, 'version', r.version);
END;
$$;

-- Withdraw the live video (the version stays in history, re-approvable).
CREATE OR REPLACE FUNCTION unpublish_video(p_chapter_id TEXT) RETURNS JSONB
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE chapter_videos SET status = 'superseded', updated_at = NOW()
   WHERE chapter_id = p_chapter_id AND status = 'approved';
  UPDATE chapters SET video = NULL, video_updated_at = NULL WHERE id = p_chapter_id;
  RETURN jsonb_build_object('ok', true, 'chapterId', p_chapter_id);
END;
$$;

NOTIFY pgrst, 'reload schema';
