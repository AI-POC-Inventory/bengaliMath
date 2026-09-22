-- Supabase Migration 005: Admin Question Generator
--
-- Adds:
--   1. chapters.gcs_chapter_no  -- maps a Supabase chapter row to the chapter
--      number in the GCS-indexed textbook (service/search), so the question
--      generator knows which chunks to retrieve for a given chapter.
--   2. generated_questions  -- staging table for LLM-generated questions
--      pending admin review. Approved rows are copied into questions/options
--      (unchanged schema, see 001_initial_schema.sql); this table keeps the
--      full audit trail (status, dedup result, provenance) independently.
--
-- gcs_chapter_no values below were computed by
-- database/map_class7_chapters.py, NOT hand-typed -- it cross-references the
-- validated GCS chapter map (23 chapters, spot-checked at 10/10 boundaries
-- when service/search was built) against Supabase's chapter titles and only
-- emits a value where the chapter number AND title both line up (or where
-- the Supabase title is unambiguously a corrupted running-head marker, in
-- which case the title is corrected too). Re-run that script --sql to
-- regenerate this block if the source data changes.
--
-- Deliberately LEFT NULL (2026-09-22 decision, not a defect):
--   * Class 7 chapters 1, 2, 3, 10, 16, 20 -- chapter number matches but the
--     title text diverges enough that automatic matching refused to trust
--     it. Chapters 1-3 in particular proved that number-only matching is
--     unsafe here: Supabase's early chapter numbering has drifted from the
--     physical book's order (Supabase 7-2 "শতকরা"/Percentage is NOT the
--     book's chapter 2, which is Ratio). These need a human to read the
--     actual pages before they're trustworthy for content retrieval.
--   * Class 7 chapter 9 (সর্বসমতার ধারণা / Congruence) -- no Supabase
--     chapter row exists for it at all. Out of scope for this feature;
--     the question generator will not offer this chapter until the missing
--     curriculum row is created separately.
--   * Classes 5, 6, 8, 9, 10 -- no book has been through the GCS ingestion
--     pipeline for them yet, so there is nothing to map to. All their
--     chapters stay NULL until that ingestion work happens.
--
-- Safe to re-run: ALTER/CREATE use IF NOT EXISTS, the UPDATEs are
-- idempotent (setting the same value again), and the value bank is
-- exhaustive rather than incremental.

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS gcs_chapter_no INTEGER;
CREATE INDEX IF NOT EXISTS idx_chapters_gcs_chapter_no ON chapters(class_id, gcs_chapter_no);

-- ── Class 7 chapter mapping (16 of 23 GCS chapters; see note above) ────────
UPDATE chapters SET gcs_chapter_no = 4 WHERE id = '7-4';
UPDATE chapters SET gcs_chapter_no = 5 WHERE id = '7-5';
UPDATE chapters SET gcs_chapter_no = 6 WHERE id = '7-6';
UPDATE chapters SET gcs_chapter_no = 7 WHERE id = '7-7';
UPDATE chapters SET gcs_chapter_no = 8, name = '৮. ত্রিভুজ অঙ্কন' WHERE id = '7-8';
UPDATE chapters SET gcs_chapter_no = 11 WHERE id = '7-11';
UPDATE chapters SET gcs_chapter_no = 12 WHERE id = '7-12';
UPDATE chapters SET gcs_chapter_no = 13 WHERE id = '7-13';
UPDATE chapters SET gcs_chapter_no = 14 WHERE id = '7-14';
UPDATE chapters SET gcs_chapter_no = 15 WHERE id = '7-15';
UPDATE chapters SET gcs_chapter_no = 17 WHERE id = '7-17';
UPDATE chapters SET gcs_chapter_no = 18 WHERE id = '7-18';
UPDATE chapters SET gcs_chapter_no = 19 WHERE id = '7-19';
UPDATE chapters SET gcs_chapter_no = 21, name = '২১. চতুর্ভুজ অঙ্কন' WHERE id = '7-21';
UPDATE chapters SET gcs_chapter_no = 22 WHERE id = '7-22';
UPDATE chapters SET gcs_chapter_no = 23 WHERE id = '7-23';

-- ── Staging table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generated_questions (
  id                     TEXT PRIMARY KEY,
  batch_id               TEXT NOT NULL,
  class_id               INTEGER NOT NULL REFERENCES classes(id),
  chapter_id             TEXT NOT NULL REFERENCES chapters(id),
  topic_id               TEXT NOT NULL REFERENCES topics(id),
  type                   TEXT NOT NULL CHECK (type IN ('mcq', 'short')),
  text                   TEXT NOT NULL,
  answer                 TEXT NOT NULL,
  solution               TEXT,
  difficulty             TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  options                JSONB,                       -- array of strings, MCQ only
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  possible_duplicate_of  TEXT REFERENCES questions(id),
  similarity_score       NUMERIC,
  source_chunk_ids       JSONB,                       -- provenance from bengali-math-search
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_generated_batch  ON generated_questions(batch_id);
CREATE INDEX IF NOT EXISTS idx_generated_status ON generated_questions(status, class_id, chapter_id, topic_id);

-- Refresh PostgREST schema cache so the new column/table are visible
-- immediately via the REST API (matches 004_daily_puzzle.sql's convention).
NOTIFY pgrst, 'reload schema';
