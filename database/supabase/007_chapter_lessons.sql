-- Supabase Migration 007: chapter lessons (generated, reviewed, then published)
--
-- Design (Option B, decided 2026-09-24):
--   * chapters.description stays the one-line subtitle the syllabus list shows.
--   * chapters.details (JSONB) holds the LIVE lesson students read -- and only
--     ever an approved one, so the existing GET /chapter endpoint can return it
--     without any draft-leak risk.
--   * generated_lessons is the staging/history table: every generated draft,
--     its admin edits, and every version that was ever live. Approving copies a
--     row's content into chapters.details; rolling back = approving an older
--     (superseded) row again.
--
-- Lesson content shape (validated in service/db/lesson_generator.py):
--   { "version": 1,
--     "overview": text, "prerequisites": [text],
--     "sections": [ { "title", "explanation", "keyPoints": [text],
--                     "examples": [ { "problem", "steps": [text], "answer",
--                                     "verified": true|false|null } ],
--                     "commonMistakes": [text],
--                     "quickCheck": [ { "question", "answer" } ],
--                     "takeaway": text } ] }
--
-- Approve / unpublish are plpgsql functions so the status flip and the
-- chapters.details write are ONE transaction (PostgREST calls can't span
-- statements). Safe to re-run.

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS details_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS generated_lessons (
  id                TEXT PRIMARY KEY,
  class_id          INTEGER NOT NULL REFERENCES classes(id),
  chapter_id        TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,                       -- per chapter, 1,2,3...
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'rejected', 'superseded')),
  content           JSONB NOT NULL,
  source_chunk_ids  JSONB,                                  -- provenance from bengali-math-search
  model             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  UNIQUE (chapter_id, version)
);

CREATE INDEX IF NOT EXISTS idx_generated_lessons_chapter ON generated_lessons(chapter_id, status);

-- At most one live lesson per chapter, enforced by the database itself.
CREATE UNIQUE INDEX IF NOT EXISTS uq_generated_lessons_one_approved
  ON generated_lessons(chapter_id) WHERE status = 'approved';

-- Approve a draft (or re-approve a superseded version = rollback).
CREATE OR REPLACE FUNCTION approve_lesson(p_id TEXT) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  r generated_lessons%ROWTYPE;
BEGIN
  SELECT * INTO r FROM generated_lessons WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lesson % not found', p_id;
  END IF;
  IF r.status NOT IN ('draft', 'superseded') THEN
    RAISE EXCEPTION 'cannot approve a lesson that is %', r.status;
  END IF;

  UPDATE generated_lessons SET status = 'superseded', updated_at = NOW()
   WHERE chapter_id = r.chapter_id AND status = 'approved';
  UPDATE generated_lessons SET status = 'approved', reviewed_at = NOW(), updated_at = NOW()
   WHERE id = p_id;
  UPDATE chapters SET details = r.content, details_updated_at = NOW()
   WHERE id = r.chapter_id;

  RETURN jsonb_build_object('ok', true, 'chapterId', r.chapter_id, 'version', r.version);
END;
$$;

-- Withdraw the live lesson (the version stays in history, re-approvable).
CREATE OR REPLACE FUNCTION unpublish_lesson(p_chapter_id TEXT) RETURNS JSONB
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE generated_lessons SET status = 'superseded', updated_at = NOW()
   WHERE chapter_id = p_chapter_id AND status = 'approved';
  UPDATE chapters SET details = NULL, details_updated_at = NULL WHERE id = p_chapter_id;
  RETURN jsonb_build_object('ok', true, 'chapterId', p_chapter_id);
END;
$$;

NOTIFY pgrst, 'reload schema';
