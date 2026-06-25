-- ═══════════════════════════════════════════════════════════════════════════════
-- Bengali Math - Supabase Migration 003: Chatbot Assistant (standalone)
--
-- The chat tables are declared in 001_initial_schema.sql, but live databases
-- provisioned before the chatbot section was added are missing them (PostgREST
-- error PGRST205: "Could not find the table 'public.chat_quick_actions'").
--
-- This version is self-contained: it does NOT declare foreign keys to `users`
-- or `classes`, so it runs even on databases where those tables were never
-- created (the chat service never writes user_id and treats class_id as a plain
-- integer). Run it in the Supabase SQL editor. It is idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id INTEGER,
  class_id INTEGER NOT NULL,
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
  class_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  question_bengali TEXT NOT NULL,
  icon TEXT DEFAULT '💡',
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_quick_actions_class ON chat_quick_actions(class_id, sort_order);

-- ── Seed quick actions ──────────────────────────────────────────────────────

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

-- ── Refresh PostgREST schema cache so the new tables are visible immediately ──
NOTIFY pgrst, 'reload schema';
