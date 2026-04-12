-- Migration 002: Learning Quality Features
-- Creates tables for concept cards, mistake notebook, spaced repetition, and adaptive difficulty

-- ═══════════════════════════════════════════════════════════════════════════════
-- CONCEPT CARDS (সূত্র কার্ড)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS concept_cards (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  class_id INTEGER NOT NULL,
  title_bengali TEXT NOT NULL,
  formula TEXT NOT NULL,
  explanation_bengali TEXT NOT NULL,
  example_bengali TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_concept_cards_topic ON concept_cards(topic_id);
CREATE INDEX idx_concept_cards_chapter ON concept_cards(chapter_id);

CREATE TABLE IF NOT EXISTS concept_card_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  card_id TEXT NOT NULL,
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES concept_cards(id)
);

CREATE INDEX idx_card_reviews_user ON concept_card_reviews(user_id, reviewed_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MISTAKE NOTEBOOK (ভুলের খাতা)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mistake_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  first_attempt_date TEXT NOT NULL DEFAULT (datetime('now')),
  times_failed INTEGER DEFAULT 1,
  last_failed_date TEXT NOT NULL DEFAULT (datetime('now')),
  times_retried INTEGER DEFAULT 0,
  mastered INTEGER DEFAULT 0,
  mastered_date TEXT,
  user_answer TEXT,
  correct_answer TEXT,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_mistakes_user ON mistake_records(user_id, last_failed_date DESC);
CREATE INDEX idx_mistakes_topic ON mistake_records(user_id, topic_id);
CREATE INDEX idx_mistakes_mastered ON mistake_records(user_id, mastered);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SPACED REPETITION SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS review_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  mistake_record_id INTEGER NOT NULL,
  next_review_date TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor REAL DEFAULT 2.5,
  times_reviewed INTEGER DEFAULT 0,
  last_reviewed_date TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mistake_record_id) REFERENCES mistake_records(id) ON DELETE CASCADE,
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_review_schedule_user_date ON review_schedule(user_id, next_review_date);
CREATE INDEX idx_review_schedule_due ON review_schedule(next_review_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PERFORMANCE TRACKING FOR ADAPTIVE DIFFICULTY
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS performance_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic_id TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  total_attempted INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  avg_time_seconds REAL DEFAULT 0,
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  recommended_difficulty TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, topic_id, difficulty)
);

CREATE INDEX idx_performance_user_topic ON performance_stats(user_id, topic_id);

CREATE TABLE IF NOT EXISTS question_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  session_id TEXT,
  correct INTEGER NOT NULL,
  time_taken_seconds INTEGER,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_attempts_user ON question_attempts(user_id, attempted_at DESC);
CREATE INDEX idx_attempts_question ON question_attempts(question_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SOLUTION STEPS FOR STEP REVEALER
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS solution_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_text_bengali TEXT NOT NULL,
  hint_bengali TEXT,
  formula_used TEXT,
  explanation_bengali TEXT,
  UNIQUE(question_id, step_number)
);

CREATE INDEX idx_solution_steps_question ON solution_steps(question_id, step_number);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS FOR LEARNING INSIGHTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE VIEW IF NOT EXISTS user_mistake_summary AS
SELECT
  user_id,
  COUNT(*) as total_mistakes,
  COUNT(CASE WHEN mastered = 1 THEN 1 END) as mastered_count,
  COUNT(CASE WHEN mastered = 0 THEN 1 END) as pending_count,
  topic_id,
  chapter_id
FROM mistake_records
GROUP BY user_id, topic_id, chapter_id;

CREATE VIEW IF NOT EXISTS daily_review_queue AS
SELECT
  rs.user_id,
  rs.question_id,
  rs.next_review_date,
  rs.interval_days,
  mr.topic_id,
  mr.chapter_id,
  mr.difficulty,
  mr.times_failed
FROM review_schedule rs
JOIN mistake_records mr ON rs.mistake_record_id = mr.id
WHERE rs.next_review_date <= date('now')
  AND mr.mastered = 0
ORDER BY rs.next_review_date ASC;

CREATE VIEW IF NOT EXISTS topic_mastery AS
SELECT
  user_id,
  topic_id,
  difficulty,
  CASE
    WHEN total_attempted = 0 THEN 0
    ELSE ROUND((CAST(total_correct AS REAL) / total_attempted) * 100, 2)
  END as accuracy_percentage,
  total_attempted,
  total_correct,
  recommended_difficulty
FROM performance_stats
ORDER BY user_id, topic_id, difficulty;
