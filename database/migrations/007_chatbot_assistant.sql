-- Migration 007: Bengali Chatbot Assistant
-- Creates tables for persistent chat conversations

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHAT CONVERSATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  class_id INTEGER NOT NULL,
  title TEXT, -- Auto-generated or user-set conversation title
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_archived INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id, updated_at DESC);
CREATE INDEX idx_chat_conversations_class ON chat_conversations(class_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHAT MESSAGES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  tokens_used INTEGER, -- Optional: track token usage
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at ASC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHAT QUICK ACTIONS / SUGGESTED QUESTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_quick_actions (
  id TEXT PRIMARY KEY,
  class_id INTEGER NOT NULL,
  category TEXT NOT NULL, -- 'homework', 'concept', 'practice', 'exam'
  question_bengali TEXT NOT NULL,
  icon TEXT DEFAULT '💡',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- Seed some default quick actions
INSERT OR IGNORE INTO chat_quick_actions (id, class_id, category, question_bengali, icon, sort_order) VALUES
  -- Homework help (for all classes)
  ('qa_homework_1', 5, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_homework_2', 6, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_homework_3', 7, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_homework_4', 8, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_homework_5', 9, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),
  ('qa_homework_6', 10, 'homework', 'আমার হোমওয়ার্ক সমস্যা সমাধান করতে সাহায্য করো', '📝', 10),

  -- Concept explanation
  ('qa_concept_1', 5, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_concept_2', 6, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_concept_3', 7, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_concept_4', 8, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_concept_5', 9, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),
  ('qa_concept_6', 10, 'concept', 'এই বিষয়টি সহজ ভাষায় ব্যাখ্যা করো', '💡', 20),

  -- Practice
  ('qa_practice_1', 5, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_practice_2', 6, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_practice_3', 7, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_practice_4', 8, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_practice_5', 9, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),
  ('qa_practice_6', 10, 'practice', 'এই বিষয়ে আমাকে একটি চর্চার প্রশ্ন দাও', '🎯', 30),

  -- Exam preparation
  ('qa_exam_1', 5, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),
  ('qa_exam_2', 6, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),
  ('qa_exam_3', 7, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),
  ('qa_exam_4', 8, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),
  ('qa_exam_5', 9, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40),
  ('qa_exam_6', 10, 'exam', 'পরীক্ষার জন্য গুরুত্বপূর্ণ টপিক কী কী?', '📚', 40);

CREATE INDEX idx_chat_quick_actions_class ON chat_quick_actions(class_id, sort_order);
