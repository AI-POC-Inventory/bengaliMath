-- ═══════════════════════════════════════════════════════════════════════════════
-- Bengali Math - Supabase Migration 002: Seed Data
-- Initial data for levels, badges, contexts, and quick actions
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEVELS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO levels (level, name_bengali, name_english, xp_required, icon) VALUES
  (1,  'শিক্ষার্থী',        'Learner',          0,      '🌱'),
  (2,  'উদ্যমী',           'Enthusiast',       100,    '🌿'),
  (3,  'চর্চাকারী',        'Practitioner',     300,    '🌾'),
  (4,  'দক্ষ',             'Skilled',          600,    '🌳'),
  (5,  'পারদর্শী',         'Proficient',       1000,   '🎯'),
  (6,  'বিশেষজ্ঞ',         'Expert',           1500,   '⭐'),
  (7,  'পণ্ডিত',          'Scholar',          2100,   '📚'),
  (8,  'গণিতবিদ',         'Mathematician',    2800,   '🏆'),
  (9,  'মহাগণিতবিদ',      'Grand Master',     3600,   '👑'),
  (10, 'কিংবদন্তি',       'Legend',           5000,   '💎')
ON CONFLICT (level) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- BADGES
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO badges (id, name_bengali, name_english, description_bengali, description_english, icon, category, requirement_type, requirement_value, sort_order) VALUES
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
  ('weekend_warrior', 'সাপ্তাহান্ত যোদ্ধা', 'Weekend Warrior',   'সপ্তাহান্তে ৫০+ প্রশ্ন করুন',          'Complete 50+ questions on weekend',      '🎮',  'special', 'weekend_questions', 50, 52)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PROBLEM CONTEXTS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO problem_contexts (id, name_bengali, name_english, description, icon) VALUES
  ('bazaar', 'বাজার', 'Market', 'বাজারে কেনাকাটা সংক্রান্ত সমস্যা', '🛒'),
  ('rickshaw', 'রিকশা', 'Rickshaw', 'রিকশা ভাড়া ও দূরত্ব সংক্রান্ত', '🛺'),
  ('land', 'জমি', 'Land', 'জমির পরিমাপ ও হিসাব', '🏞️'),
  ('sports', 'খেলাধুলা', 'Sports', 'ক্রিকেট, ফুটবল ইত্যাদি', '⚽'),
  ('festival', 'উৎসব', 'Festival', 'পূজা, ঈদ ইত্যাদি উৎসবের হিসাব', '🎊'),
  ('school', 'স্কুল', 'School', 'স্কুল ও শিক্ষা সংক্রান্ত', '🏫'),
  ('food', 'খাবার', 'Food', 'খাবার ও রান্না সংক্রান্ত', '🍛'),
  ('travel', 'ভ্রমণ', 'Travel', 'ভ্রমণ ও যাতায়াত', '🚂'),
  ('money', 'টাকাপয়সা', 'Money', 'ব্যাংক, সঞ্চয় ও সুদ', '💰'),
  ('general', 'সাধারণ', 'General', 'সাধারণ বাস্তব জীবনের সমস্যা', '📋')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHAT QUICK ACTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO chat_quick_actions (id, class_id, category, question_bengali, icon, sort_order) VALUES
  -- Class 5
  ('qa_homework_5', 5, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_concept_5', 5, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_practice_5', 5, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_exam_5', 5, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),

  -- Class 6
  ('qa_homework_6', 6, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_concept_6', 6, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_practice_6', 6, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_exam_6', 6, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),

  -- Class 7
  ('qa_homework_7', 7, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_concept_7', 7, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_practice_7', 7, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_exam_7', 7, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),

  -- Class 8
  ('qa_homework_8', 8, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_concept_8', 8, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_practice_8', 8, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_exam_8', 8, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),

  -- Class 9
  ('qa_homework_9', 9, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_concept_9', 9, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_practice_9', 9, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_exam_9', 9, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),

  -- Class 10
  ('qa_homework_10', 10, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_concept_10', 10, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_practice_10', 10, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_exam_10', 10, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40)
ON CONFLICT (id) DO NOTHING;
