-- Supabase Migration 004: Daily Puzzle (standalone, idempotent)
--
-- The daily-puzzle tables are declared in 001_initial_schema.sql, but live
-- databases provisioned before they were added are missing them (error 42P01).
-- This version is self-contained: no foreign keys to base tables like `users`,
-- so it runs on partially-provisioned databases. Safe to re-run.

CREATE TABLE IF NOT EXISTS daily_puzzles (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  puzzle_bengali TEXT NOT NULL,
  answer TEXT NOT NULL,
  hint_bengali TEXT,
  explanation_bengali TEXT,
  difficulty TEXT DEFAULT 'medium',
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_puzzles_date ON daily_puzzles(date);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id SERIAL PRIMARY KEY,
  puzzle_id TEXT NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  user_id INTEGER,
  solved BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 1,
  user_answer TEXT,
  solved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_puzzle ON puzzle_attempts(puzzle_id);

-- Refresh PostgREST schema cache so the new tables are visible immediately
NOTIFY pgrst, 'reload schema';
