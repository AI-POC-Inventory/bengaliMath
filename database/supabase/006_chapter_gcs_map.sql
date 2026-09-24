-- Supabase Migration 006: chapter -> GCS-book chapter mapping table
--
-- Why: 005 added chapters.gcs_chapter_no, a single INTEGER. That cannot
-- represent the real relationship for Class 7: Supabase 7-1 "অনুপাত ও
-- সমানুপাত" covers TWO book chapters (2 অনুপাত and 3 সমানুপাত), and 7-3
-- "বীজগণিতের ভূমিকা" is an introduction that draws on two (6 and 22). So the
-- mapping is many-to-many by nature; this table is its single source of truth
-- and service/db/question_generator.py reads it (retrieving from every mapped
-- book chapter). chapters.gcs_chapter_no is now DEPRECATED -- kept only so the
-- previously deployed API revision keeps working until this ships; drop it in
-- a later migration once nothing reads it.
--
-- The chapter list below was checked against the book's own printed contents
-- page (সূচিপত্র, PDF page 9), not just against the OCR'd titles:
--    1 পূর্বপাঠের পুনরালোচনা   2 অনুপাত   3 সমানুপাত   4 পূর্ণসংখ্যার যোগ,বিয়োগ,গুণ ও ভাগ
--    5 সূচকের ধারণা   6 বীজগাণিতিক প্রক্রিয়া   7 কম্পাসের সাহায্যে নির্দিষ্ট কোণ অঙ্কন
--    8 ত্রিভুজ অঙ্কন   9 সর্বসমতার ধারণা   10 আসন্নমান   11 ভগ্নাংশের বর্গমূল
--   12 বীজগাণিতিক সূত্রাবলী   13 সমান্তরাল সরলরেখা ও ছেদকের ধারণা   14 ত্রিভুজের ধর্ম
--   15 সময় ও দূরত্ব   16 দ্বি-স্তম্ভ লেখ   17 আয়তক্ষেত্র ও বর্গক্ষেত্রের ক্ষেত্রফল
--   18 প্রতিসাম্য   19 উৎপাদকে বিশ্লেষণ   20 চতুর্ভুজের শ্রেণিবিভাগ   21 চতুর্ভুজ অঙ্কন
--   22 সমীকরণ গঠন ও সমাধান   23 মজার অঙ্ক   24 মিলিয়ে দেখি (answers; not indexed)
--
-- confidence:
--   'confirmed' -- title matches the printed contents page, and/or the
--                  Supabase questions for that chapter text-match chunks of
--                  that book chapter (checked 2026-09-24).
--   'inferred'  -- best available evidence, but Supabase's row is not a clean
--                  1:1 of a book chapter. Reviewed by eye before relying on it.
--
-- Deliberately NOT mapped (no Supabase chapter row exists for them):
--   * book ch 1 as its own chapter -- only its শতকরা material is reachable,
--     via 7-2 (below).
--   * book ch 9 সর্বসমতার ধারণা -- out of scope, no curriculum row.
--   * book ch 24 মিলিয়ে দেখি -- answer key, not indexed.
--
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT DO NOTHING; title fixes are
-- guarded on the old value so they never overwrite a later manual edit.

CREATE TABLE IF NOT EXISTS chapter_gcs_map (
  chapter_id      TEXT    NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  gcs_chapter_no  INTEGER NOT NULL,
  confidence      TEXT    NOT NULL DEFAULT 'confirmed' CHECK (confidence IN ('confirmed', 'inferred')),
  note            TEXT,
  PRIMARY KEY (chapter_id, gcs_chapter_no)
);

CREATE INDEX IF NOT EXISTS idx_chapter_gcs_map_chapter ON chapter_gcs_map(chapter_id);

-- ── 1. Backfill the 16 mappings 005 already established ────────────────────
INSERT INTO chapter_gcs_map (chapter_id, gcs_chapter_no, confidence, note)
SELECT id, gcs_chapter_no, 'confirmed', 'backfilled from chapters.gcs_chapter_no (migration 005); title matches printed contents'
FROM chapters
WHERE gcs_chapter_no IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 2. The six previously unmapped Class 7 chapters ───────────────────────
INSERT INTO chapter_gcs_map (chapter_id, gcs_chapter_no, confidence, note) VALUES
  ('7-1', 2, 'confirmed', 'printed contents: 2 অনুপাত (p.22); 7-1 covers ratio and proportion together'),
  ('7-1', 3, 'confirmed', 'printed contents: 3 সমানুপাত (p.34)'),
  ('7-2', 1, 'inferred',  'শতকরা/% content exists only in book ch 1 পূর্বপাঠের পুনরালোচনা (21 chunks; none elsewhere). Ch 1 is broader than 7-2 (fractions, decimals, etc.), so topic-level retrieval matters; the book has no profit/loss chapter'),
  ('7-3', 6, 'inferred',  '7-3 is a generic algebra-intro row ("চল রাশি, সমীকরণের ধারণা") with no single book chapter; বীজগাণিতিক প্রক্রিয়া covers the expressions half'),
  ('7-3', 22, 'inferred', 'সমীকরণ গঠন ও সমাধান covers the equations half; shares this book chapter with 7-22'),
  ('7-10', 10, 'confirmed', 'printed contents: 10 আসন্নমান (p.129); Supabase title "আমার মান" was an OCR error; its questions text-match ch 10'),
  ('7-16', 16, 'confirmed', 'printed contents: 16 দ্বি-স্তম্ভ লেখ (p.189); description is about স্তম্ভ লেখচিত্র; 3/3 questions text-match ch 16'),
  ('7-20', 20, 'confirmed', 'printed contents: 20 চতুর্ভুজের শ্রেণিবিভাগ (p.229); topic ট্র‍্যাপিজিয়াম and its questions match ch 20')
ON CONFLICT DO NOTHING;

-- ── 3. Correct the three chapter titles that were OCR errors ──────────────
-- (the printed contents page is authoritative; guarded on the old value)
UPDATE chapters SET name = 'আসন্নমান'                WHERE id = '7-10' AND name = 'আমার মান';
UPDATE chapters SET name = 'দ্বি-স্তম্ভ লেখ'          WHERE id = '7-16' AND name = 'চিত্র-তত্ত্ব';
UPDATE chapters SET name = 'চতুর্ভুজের শ্রেণিবিভাগ'  WHERE id = '7-20' AND name = 'চতুর্ভুজ ও প্রতিসাম্য';

-- ── 4. Keep the deprecated column in step for single-mapped chapters ─────
-- so the API revision that still reads it serves these chapters too. 7-1 and
-- 7-3 (two book chapters each) cannot be expressed there and stay NULL until
-- the new code (which reads chapter_gcs_map) is deployed.
UPDATE chapters c SET gcs_chapter_no = m.gcs_chapter_no
FROM chapter_gcs_map m
WHERE m.chapter_id = c.id AND c.gcs_chapter_no IS NULL
  AND (SELECT COUNT(*) FROM chapter_gcs_map x WHERE x.chapter_id = c.id) = 1;

NOTIFY pgrst, 'reload schema';
