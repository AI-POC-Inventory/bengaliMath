-- Migration 001: Gamification Features
-- Creates tables for user profiles, streaks, badges, XP/levels, and leaderboard

-- ═══════════════════════════════════════════════════════════════════════════════
-- USER PROFILES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  class_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active TEXT NOT NULL DEFAULT (datetime('now')),
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  streak_count INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_practice_date TEXT,
  avatar_url TEXT DEFAULT 'default'
);

CREATE INDEX idx_users_class ON users(class_id);
CREATE INDEX idx_users_last_active ON users(last_active);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DAILY STREAKS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  practice_date TEXT NOT NULL,
  questions_completed INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, practice_date)
);

CREATE INDEX idx_streaks_user_date ON daily_streaks(user_id, practice_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- XP & LEVELS SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS levels (
  level INTEGER PRIMARY KEY,
  name_bengali TEXT NOT NULL,
  name_english TEXT NOT NULL,
  xp_required INTEGER NOT NULL,
  icon TEXT NOT NULL
);

-- Seed level data
INSERT OR IGNORE INTO levels (level, name_bengali, name_english, xp_required, icon) VALUES
  (1,  'শিক্ষার্থী',        'Learner',          0,      '🌱'),
  (2,  'উদ্যমী',           'Enthusiast',       100,    '🌿'),
  (3,  'চর্চাকারী',        'Practitioner',     300,    '🌾'),
  (4,  'দক্ষ',             'Skilled',          600,    '🌳'),
  (5,  'পারদর্শী',         'Proficient',       1000,   '🎯'),
  (6,  'বিশেষজ্ঞ',         'Expert',           1500,   '⭐'),
  (7,  'পণ্ডিত',          'Scholar',          2100,   '📚'),
  (8,  'গণিতবিদ',         'Mathematician',    2800,   '🏆'),
  (9,  'মহাগণিতবিদ',      'Grand Master',     3600,   '👑'),
  (10, 'কিংবদন্তি',       'Legend',           5000,   '💎');

CREATE TABLE IF NOT EXISTS xp_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_xp_user ON xp_transactions(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- BADGES & ACHIEVEMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

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

-- Seed badge data
INSERT OR IGNORE INTO badges (id, name_bengali, name_english, description_bengali, description_english, icon, category, requirement_type, requirement_value, sort_order) VALUES
  -- Streak badges
  ('streak_3',    '৩ দিনের যোদ্ধা',       '3-Day Warrior',      '৩ দিন একটানা চর্চা করুন',              'Practice for 3 days straight',           '🔥',  'streak', 'streak_days', 3,   10),
  ('streak_7',    '৭ দিনের যোদ্ধা',       '7-Day Warrior',      '৭ দিন একটানা চর্চা করুন',              'Practice for 7 days straight',           '🔥🔥', 'streak', 'streak_days', 7,   11),
  ('streak_30',   'মাসব্যাপী যোদ্ধা',     'Month Warrior',      '৩০ দিন একটানা চর্চা করুন',             'Practice for 30 days straight',          '🔥🔥🔥','streak', 'streak_days', 30,  12),
  ('streak_100',  'শতদিনের কিংবদন্তি',   '100-Day Legend',     '১০০ দিন একটানা চর্চা করুন',            'Practice for 100 days straight',         '💯',  'streak', 'streak_days', 100, 13),

  -- Topic mastery badges
  ('master_algebra',     'বীজগণিত বিশেষজ্ঞ',    'Algebra Expert',     'বীজগণিত বিষয়ে ৮০% নম্বর পান',          'Score 80%+ in Algebra',                  '🎓',  'mastery', 'topic_score', 80,  20),
  ('master_geometry',    'জ্যামিতি বিশেষজ্ঞ',    'Geometry Expert',    'জ্যামিতি বিষয়ে ৮০% নম্বর পান',         'Score 80%+ in Geometry',                 '📐',  'mastery', 'topic_score', 80,  21),
  ('master_arithmetic',  'পাটিগণিত বিশেষজ্ঞ',   'Arithmetic Expert',  'পাটিগণিত বিষয়ে ৮০% নম্বর পান',        'Score 80%+ in Arithmetic',               '🔢',  'mastery', 'topic_score', 80,  22),

  -- Practice badges
  ('questions_50',   '৫০ প্রশ্ন',          '50 Questions',       '৫০টি প্রশ্নের উত্তর দিন',              'Answer 50 questions',                    '📝',  'practice', 'total_questions', 50,   30),
  ('questions_100',  '১০০ প্রশ্ন',         '100 Questions',      '১০০টি প্রশ্নের উত্তর দিন',             'Answer 100 questions',                   '📚',  'practice', 'total_questions', 100,  31),
  ('questions_500',  '৫০০ প্রশ্ন',         '500 Questions',      '৫০০টি প্রশ্নের উত্তর দিন',             'Answer 500 questions',                   '🎯',  'practice', 'total_questions', 500,  32),
  ('questions_1000', '১০০০ প্রশ্ন চ্যাম্পিয়ন', '1000Q Champion', '১০০০টি প্রশ্নের উত্তর দিন',            'Answer 1000 questions',                  '🏆',  'practice', 'total_questions', 1000, 33),

  -- Perfect score badges
  ('perfect_10',  '১০/১০ নিখুঁত',        'Perfect 10',         '১০টি প্রশ্নে ১০০% পান',                'Score 100% on 10 questions',             '✨',  'perfect', 'perfect_sessions', 1,   40),
  ('perfect_streak_5', '৫ নিখুঁত সেশন',  '5 Perfect Sessions', '৫টি সেশনে ১০০% পান',                   'Score 100% in 5 sessions',               '⭐',  'perfect', 'perfect_sessions', 5,   41),

  -- Special badges
  ('early_bird',     'ভোরের পাখি',        'Early Bird',         'সকাল ৬টার আগে চর্চা করুন',             'Practice before 6 AM',                   '🌅',  'special', 'early_practice', 1,     50),
  ('night_owl',      'নিশাচর পাখি',       'Night Owl',          'রাত ১০টার পরে চর্চা করুন',             'Practice after 10 PM',                   '🦉',  'special', 'late_practice', 1,      51),
  ('weekend_warrior', 'সাপ্তাহান্ত যোদ্ধা', 'Weekend Warrior',   'সপ্তাহান্তে ৫০+ প্রশ্ন করুন',          'Complete 50+ questions on weekend',      '🎮',  'special', 'weekend_questions', 50, 52);

CREATE TABLE IF NOT EXISTS user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  progress INTEGER DEFAULT 100,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEADERBOARD
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS leaderboard_weekly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  total_xp INTEGER NOT NULL DEFAULT 0,
  questions_attempted INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_leaderboard_week_class ON leaderboard_weekly(week_start, class_id, total_xp DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS FOR CONVENIENCE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE VIEW IF NOT EXISTS user_stats AS
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
GROUP BY u.id;
