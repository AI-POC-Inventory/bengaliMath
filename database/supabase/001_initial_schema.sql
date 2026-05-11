-- ═══════════════════════════════════════════════════════════════════════════════
-- Bengali Math - Supabase Migration 001: Initial Schema
-- Complete schema for Bengali Math learning platform
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════════
-- CURRICULUM STRUCTURE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  bengali_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq', 'short')),
  text TEXT NOT NULL,
  answer TEXT NOT NULL,
  solution TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard'))
);

CREATE TABLE IF NOT EXISTS options (
  id SERIAL PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE
);

-- Indexes for curriculum
CREATE INDEX IF NOT EXISTS idx_chapters_class ON chapters(class_id);
CREATE INDEX IF NOT EXISTS idx_topics_chapter ON topics(chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- USER PROFILES & GAMIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  streak_count INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_practice_date DATE,
  avatar_url TEXT DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_users_class ON users(class_id);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- Daily Streaks
CREATE TABLE IF NOT EXISTS daily_streaks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_date DATE NOT NULL,
  questions_completed INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 1,
  UNIQUE(user_id, practice_date)
);

CREATE INDEX IF NOT EXISTS idx_streaks_user_date ON daily_streaks(user_id, practice_date DESC);

-- Levels
CREATE TABLE IF NOT EXISTS levels (
  level INTEGER PRIMARY KEY,
  name_bengali TEXT NOT NULL,
  name_english TEXT NOT NULL,
  xp_required INTEGER NOT NULL,
  icon TEXT NOT NULL
);

-- XP Transactions
CREATE TABLE IF NOT EXISTS xp_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_user ON xp_transactions(user_id, created_at DESC);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name_bengali TEXT NOT NULL,
  name_english TEXT NOT NULL,
  description_bengali TEXT NOT NULL,
  description_english TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  progress INTEGER DEFAULT 100,
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRACTICE SESSIONS & HISTORY
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  chapter_id TEXT REFERENCES chapters(id),
  topic_id TEXT REFERENCES topics(id),
  difficulty TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  completed BOOLEAN DEFAULT FALSE,
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_questions (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  topic_id TEXT NOT NULL REFERENCES topics(id),
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  correct BOOLEAN DEFAULT FALSE,
  attempted BOOLEAN DEFAULT TRUE
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MISTAKE NOTEBOOK & SPACED REPETITION
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mistake_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  topic_id TEXT NOT NULL REFERENCES topics(id),
  first_attempt_date DATE NOT NULL,
  times_failed INTEGER DEFAULT 1,
  last_failed_date DATE NOT NULL,
  mastered BOOLEAN DEFAULT FALSE,
  mastered_date DATE,
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistake_records(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_topic ON mistake_records(topic_id);

CREATE TABLE IF NOT EXISTS review_schedule (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id),
  next_review_date DATE NOT NULL,
  interval_days INTEGER DEFAULT 1,
  ease_factor DECIMAL(3, 2) DEFAULT 2.5,
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_review_user ON review_schedule(user_id, next_review_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOUBTS / Q&A
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS doubts (
  id TEXT PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  question TEXT NOT NULL,
  topic TEXT,
  response TEXT NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- REAL-WORLD FEATURES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Word Problems
CREATE TABLE IF NOT EXISTS word_problems (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  chapter_id TEXT NOT NULL REFERENCES chapters(id),
  problem_bengali TEXT NOT NULL,
  context_type TEXT NOT NULL,
  answer TEXT NOT NULL,
  solution_bengali JSONB,
  difficulty TEXT DEFAULT 'medium',
  generated_by TEXT DEFAULT 'ai',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_word_problems_topic ON word_problems(topic_id);
CREATE INDEX IF NOT EXISTS idx_word_problems_class ON word_problems(class_id);

-- Problem Contexts
CREATE TABLE IF NOT EXISTS problem_contexts (
  id TEXT PRIMARY KEY,
  name_bengali TEXT NOT NULL,
  name_english TEXT NOT NULL,
  description TEXT,
  icon TEXT
);

-- Topic Applications ("কেন শিখব?")
CREATE TABLE IF NOT EXISTS topic_applications (
  id SERIAL PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id),
  title_bengali TEXT NOT NULL,
  description_bengali TEXT NOT NULL,
  real_world_example TEXT NOT NULL,
  profession_bengali TEXT,
  icon TEXT DEFAULT '💡'
);

CREATE INDEX IF NOT EXISTS idx_topic_applications_topic ON topic_applications(topic_id);

-- Daily Puzzles
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
  puzzle_id TEXT NOT NULL REFERENCES daily_puzzles(id),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  solved BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 1,
  user_answer TEXT,
  solved_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHATBOT ASSISTANT
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  title TEXT DEFAULT 'নতুন কথোপকথন',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_class ON chat_conversations(class_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tokens_used INTEGER
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS chat_quick_actions (
  id TEXT PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  category TEXT NOT NULL,
  question_bengali TEXT NOT NULL,
  icon TEXT DEFAULT '💡',
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_quick_actions_class ON chat_quick_actions(class_id, sort_order);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PREFERENCES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id,
  u.username,
  u.display_name,
  u.class_id,
  u.total_xp,
  u.current_level,
  l.name_bengali as level_name,
  u.streak_count,
  u.longest_streak,
  COUNT(DISTINCT ub.badge_id) as badges_earned,
  (SELECT COUNT(*) FROM daily_streaks WHERE user_id = u.id) as days_practiced,
  (SELECT SUM(questions_completed) FROM daily_streaks WHERE user_id = u.id) as total_questions
FROM users u
LEFT JOIN levels l ON u.current_level = l.level
LEFT JOIN user_badges ub ON u.id = ub.user_id
GROUP BY u.id, l.name_bengali;
