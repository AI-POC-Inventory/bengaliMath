-- Migration 003: Real-world Connection & Social Features
-- Creates tables for word problems, daily puzzles, challenges, and reports

-- ═══════════════════════════════════════════════════════════════════════════════
-- WORD PROBLEMS WITH LOCAL CONTEXT
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS word_problems (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  class_id INTEGER NOT NULL,
  problem_bengali TEXT NOT NULL,
  context_type TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  answer TEXT NOT NULL,
  solution_bengali TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  generated_by TEXT DEFAULT 'ai'
);

CREATE INDEX idx_word_problems_topic ON word_problems(topic_id, difficulty);

-- Context types for word problems
CREATE TABLE IF NOT EXISTS problem_contexts (
  id TEXT PRIMARY KEY,
  name_bengali TEXT NOT NULL,
  name_english TEXT NOT NULL,
  description TEXT NOT NULL,
  examples TEXT
);

INSERT OR IGNORE INTO problem_contexts (id, name_bengali, name_english, description, examples) VALUES
  ('bazaar',    'বাজার',          'Market',        'Shopping, bargaining, price calculations',          'দোকান থেকে কেনাকাটা, দামদর হিসাব'),
  ('rickshaw',  'রিকশা',          'Rickshaw',      'Rickshaw fare, distance, time calculations',        'রিকশা ভাড়া, দূরত্ব হিসাব'),
  ('land',      'জমি',            'Land',          'Land area in bigha, katha, decimal',                'জমির পরিমাপ বিঘা, কাঠা, শতাংশ'),
  ('cricket',   'ক্রিকেট',        'Cricket',       'Cricket scores, averages, statistics',              'ক্রিকেট স্কোর, গড়, পরিসংখ্যান'),
  ('cooking',   'রান্না',          'Cooking',       'Recipe measurements, portions, time',               'রান্নার উপকরণ, পরিমাণ হিসাব'),
  ('school',    'স্কুল',           'School',        'Classroom scenarios, grades, attendance',           'ক্লাসরুম, নম্বর, উপস্থিতি'),
  ('festival',  'উৎসব',           'Festival',      'Festival preparations, decorations, expenses',      'উৎসবের প্রস্তুতি, খরচ হিসাব'),
  ('agriculture', 'কৃষি',         'Agriculture',   'Farming, crop yield, seasonal calculations',        'চাষাবাদ, ফসলের হিসাব');

-- ═══════════════════════════════════════════════════════════════════════════════
-- TOPIC APPLICATIONS (কেন শিখব?)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS topic_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id TEXT NOT NULL UNIQUE,
  title_bengali TEXT NOT NULL,
  description_bengali TEXT NOT NULL,
  real_world_example TEXT NOT NULL,
  profession_bengali TEXT,
  icon TEXT DEFAULT '💡'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DAILY PUZZLES (গণিত ধাঁধা)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_puzzles (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  puzzle_bengali TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation_bengali TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  hint_bengali TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_puzzles_date ON daily_puzzles(date DESC);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  puzzle_id TEXT NOT NULL,
  solved INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 1,
  user_answer TEXT,
  solved_at TEXT,
  time_taken_seconds INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (puzzle_id) REFERENCES daily_puzzles(id),
  UNIQUE(user_id, puzzle_id)
);

CREATE INDEX idx_puzzle_attempts_user ON puzzle_attempts(user_id, solved_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHALLENGE SYSTEM (বন্ধুকে চ্যালেঞ্জ করুন)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  creator_user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  class_id INTEGER NOT NULL,
  topic_id TEXT,
  chapter_id TEXT,
  difficulty TEXT,
  questions TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  public INTEGER DEFAULT 1,
  FOREIGN KEY (creator_user_id) REFERENCES users(id)
);

CREATE INDEX idx_challenges_creator ON challenges(creator_user_id);
CREATE INDEX idx_challenges_class ON challenges(class_id, created_at DESC);
CREATE INDEX idx_challenges_active ON challenges(expires_at) WHERE expires_at > datetime('now');

CREATE TABLE IF NOT EXISTS challenge_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  time_taken_seconds INTEGER,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  answers TEXT,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX idx_challenge_attempts ON challenge_attempts(challenge_id, score DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- FEATURED CONTENT (আজকের প্রশ্ন)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS featured_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  class_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  featured_type TEXT DEFAULT 'daily',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, class_id)
);

CREATE INDEX idx_featured_date ON featured_questions(date DESC, class_id);

CREATE TABLE IF NOT EXISTS featured_question_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  featured_id INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (featured_id) REFERENCES featured_questions(id),
  UNIQUE(user_id, featured_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PROGRESS REPORTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS progress_reports (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  report_data TEXT NOT NULL,
  pdf_path TEXT,
  shared INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_reports_user ON progress_reports(user_id, week_start DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- USER VISUALIZATIONS (GRAPHS & GEOMETRY)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_visualizations (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('graph', 'geometry')),
  title TEXT,
  data TEXT NOT NULL,
  topic_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_visualizations_user ON user_visualizations(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS FOR SOCIAL & ENGAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE VIEW IF NOT EXISTS challenge_leaderboard AS
SELECT
  c.id as challenge_id,
  c.title,
  ca.user_id,
  u.display_name,
  ca.score,
  ca.total,
  ROUND((CAST(ca.score AS REAL) / ca.total) * 100, 2) as percentage,
  ca.time_taken_seconds,
  ca.completed_at,
  ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY ca.score DESC, ca.time_taken_seconds ASC) as rank
FROM challenges c
JOIN challenge_attempts ca ON c.id = ca.challenge_id
JOIN users u ON ca.user_id = u.id;

CREATE VIEW IF NOT EXISTS daily_puzzle_stats AS
SELECT
  dp.date,
  dp.puzzle_bengali,
  dp.difficulty,
  COUNT(pa.id) as total_attempts,
  COUNT(CASE WHEN pa.solved = 1 THEN 1 END) as solved_count,
  ROUND(AVG(pa.time_taken_seconds), 2) as avg_time_seconds
FROM daily_puzzles dp
LEFT JOIN puzzle_attempts pa ON dp.id = pa.puzzle_id
GROUP BY dp.id, dp.date;

CREATE VIEW IF NOT EXISTS user_weekly_summary AS
SELECT
  user_id,
  strftime('%Y-%W', datetime(last_practice_date)) as week,
  COUNT(DISTINCT practice_date) as days_practiced,
  SUM(questions_completed) as total_questions,
  SUM(questions_correct) as total_correct,
  SUM(xp_earned) as total_xp
FROM daily_streaks
GROUP BY user_id, strftime('%Y-%W', datetime(practice_date));
