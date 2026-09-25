-- Supabase Migration 008: atomic approval of generated questions
--
-- Problem: approving a staged question was three separate PostgREST calls from
-- service/db/api.py -- INSERT into questions, INSERT into options, UPDATE the
-- staging row. If the request died between them (seen for
-- batch_1790349215799_8rfcqonk_10) the question went LIVE to students while
-- the admin still saw it as "pending"; re-approving then failed on the
-- duplicate key, and rejecting it would have hidden nothing.
--
-- Fix: do all three in ONE function = one transaction (same approach as
-- approve_lesson in 007). It is also safe on a half-approved row: if the
-- question already exists it is not inserted again, and options are only
-- written when it has none, so re-approving just completes the job.
--
-- Also repairs existing damage: any staging row still 'pending' whose id is
-- already in questions (i.e. live) is marked approved.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION approve_generated_question(p_id TEXT) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  r generated_questions%ROWTYPE;
BEGIN
  SELECT * INTO r FROM generated_questions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staged question % not found', p_id;
  END IF;
  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'already %', r.status;
  END IF;

  INSERT INTO questions (id, topic_id, type, text, answer, solution, difficulty)
  VALUES (r.id, r.topic_id, r.type, r.text, r.answer, r.solution, r.difficulty)
  ON CONFLICT (id) DO NOTHING;

  IF r.type = 'mcq' AND r.options IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM options WHERE question_id = r.id) THEN
    INSERT INTO options (question_id, option_text, is_correct)
    SELECT r.id, t.opt,
           (r.answer ~ '^[0-9]+$' AND (t.ord - 1) = r.answer::int)
    FROM jsonb_array_elements_text(r.options) WITH ORDINALITY AS t(opt, ord)
    ORDER BY t.ord;                       -- options.id is SERIAL: insertion order = display order
  END IF;

  UPDATE generated_questions SET status = 'approved', reviewed_at = NOW() WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;

-- One-off repair: live but still 'pending' in staging.
UPDATE generated_questions g
   SET status = 'approved', reviewed_at = COALESCE(g.reviewed_at, NOW())
 WHERE g.status = 'pending'
   AND EXISTS (SELECT 1 FROM questions q WHERE q.id = g.id);

NOTIFY pgrst, 'reload schema';
