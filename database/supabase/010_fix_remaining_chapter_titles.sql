-- Supabase Migration 010: fix three remaining OCR-corrupted Class 7 titles
--
-- Migration 006 already fixed three chapter titles that had captured a stray
-- OCR artifact instead of the book's real title (7-10, 7-16, 7-20). A direct
-- re-comparison against the book's own printed contents page (সূচিপত্র,
-- confirmed fresh from the GCS-stored PDF, not from memory) on 2026-10-06
-- found three more of the same defect that were missed:
--
--   7-8  "৮. ত্রিভুজ অঙ্কন"        -> book says "ত্রিভুজ অঙ্কন"       (stray "৮." prefix)
--   7-21 "২১. চতুর্ভুজ অঙ্কন"      -> book says "চতুর্ভুজ অঙ্কন"      (stray "২১." prefix)
--   7-15 "সময় ও দূরত্ব নির্ণয়"   -> book says "সময় ও দূরত্ব"        (extra "নির্ণয়" appended)
--
-- Every other Class 7 title was re-checked against the same TOC page and
-- matches exactly; these three are the only remaining discrepancies.
--
-- Guarded on the old value so this never overwrites a later manual edit.
-- Safe to re-run.

UPDATE chapters SET name = 'ত্রিভুজ অঙ্কন'     WHERE id = '7-8'  AND name = '৮. ত্রিভুজ অঙ্কন';
UPDATE chapters SET name = 'চতুর্ভুজ অঙ্কন'    WHERE id = '7-21' AND name = '২১. চতুর্ভুজ অঙ্কন';
UPDATE chapters SET name = 'সময় ও দূরত্ব'      WHERE id = '7-15' AND name = 'সময় ও দূরত্ব নির্ণয়';

NOTIFY pgrst, 'reload schema';
