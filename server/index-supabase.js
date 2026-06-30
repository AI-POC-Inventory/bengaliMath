import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ── Supabase setup ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Connected to Supabase');

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// ── Preferences ───────────────────────────────────────────────────────────────
app.get('/api/preferences', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('preferences')
      .select('key, value');

    if (error) throw error;

    const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));
    res.json({
      classId: map.class_id && map.class_id !== '' ? parseInt(map.class_id) : null,
      theme: map.theme || 'light',
      apiKey: map.api_key || '',
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

app.put('/api/preferences', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });

    const { error } = await supabase
      .from('preferences')
      .upsert({ key, value: String(value ?? '') }, { onConflict: 'key' });

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating preference:', error);
    res.status(500).json({ error: 'Failed to update preference' });
  }
});

// ── Sessions ──────────────────────────────────────────────────────────────────
app.get('/api/sessions', async (req, res) => {
  try {
    const classId = req.query.classId ? parseInt(req.query.classId) : null;

    let query = supabase
      .from('sessions')
      .select(`
        *,
        session_questions (*)
      `)
      .order('date', { ascending: false });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const sessions = (data || []).map(s => ({
      id: s.id,
      classId: s.class_id,
      chapterId: s.chapter_id ?? undefined,
      topicId: s.topic_id ?? undefined,
      difficulty: s.difficulty ?? undefined,
      date: s.date,
      completed: Boolean(s.completed),
      score: s.score,
      total: s.total,
      questions: (s.session_questions || []).map(q => ({
        questionId: q.question_id,
        topicId: q.topic_id,
        chapterId: q.chapter_id,
        correct: Boolean(q.correct),
        attempted: Boolean(q.attempted),
      })),
    }));

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const s = req.body;

    // Insert/update session
    const { error: sessionError } = await supabase
      .from('sessions')
      .upsert({
        id: s.id,
        class_id: s.classId,
        chapter_id: s.chapterId ?? null,
        topic_id: s.topicId ?? null,
        difficulty: s.difficulty ?? null,
        date: s.date,
        completed: s.completed,
        score: s.score,
        total: s.total,
      }, { onConflict: 'id' });

    if (sessionError) throw sessionError;

    // Delete existing questions for this session
    await supabase
      .from('session_questions')
      .delete()
      .eq('session_id', s.id);

    // Insert new questions
    if (s.questions && s.questions.length > 0) {
      const questions = s.questions.map(q => ({
        session_id: s.id,
        question_id: q.questionId,
        topic_id: q.topicId,
        chapter_id: q.chapterId,
        correct: q.correct,
        attempted: q.attempted,
      }));

      const { error: questionsError } = await supabase
        .from('session_questions')
        .insert(questions);

      if (questionsError) throw questionsError;
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ── Doubts ────────────────────────────────────────────────────────────────────
app.get('/api/doubts', async (req, res) => {
  try {
    const classId = req.query.classId ? parseInt(req.query.classId) : null;

    let query = supabase
      .from('doubts')
      .select('*')
      .order('date', { ascending: false });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json((data || []).map(d => ({
      id: d.id,
      classId: d.class_id,
      question: d.question,
      topic: d.topic ?? undefined,
      response: d.response,
      date: d.date,
    })));
  } catch (error) {
    console.error('Error fetching doubts:', error);
    res.status(500).json({ error: 'Failed to fetch doubts' });
  }
});

app.post('/api/doubts', async (req, res) => {
  try {
    const d = req.body;
    const { error } = await supabase
      .from('doubts')
      .upsert({
        id: d.id,
        class_id: d.classId,
        question: d.question,
        topic: d.topic ?? null,
        response: d.response,
        date: d.date,
      }, { onConflict: 'id' });

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving doubt:', error);
    res.status(500).json({ error: 'Failed to save doubt' });
  }
});

app.delete('/api/doubts/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('doubts')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting doubt:', error);
    res.status(500).json({ error: 'Failed to delete doubt' });
  }
});

// ── Bengali Chatbot Assistant ─────────────────────────────────────────────────

// Get all conversations for a user/class
app.get('/api/chat/conversations', async (req, res) => {
  try {
    const { classId, userId } = req.query;

    let query = supabase
      .from('chat_conversations')
      .select(`
        *,
        chat_messages (id)
      `)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (classId) {
      query = query.eq('class_id', parseInt(classId));
    }

    if (userId) {
      query = query.eq('user_id', parseInt(userId));
    }

    const { data, error } = await query;
    if (error) throw error;

    const result = (data || []).map(conv => ({
      id: conv.id,
      userId: conv.user_id,
      classId: conv.class_id,
      title: conv.title,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      messageCount: conv.chat_messages?.length || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a conversation
app.get('/api/chat/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json((data || []).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      tokensUsed: m.tokens_used,
    })));
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create a new conversation
app.post('/api/chat/conversations', async (req, res) => {
  try {
    const { classId, userId, title } = req.body;

    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: userId || null,
        class_id: classId,
        title: title || 'নতুন কথোপকথন',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      id: data.id,
      userId: data.user_id,
      classId: data.class_id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      messageCount: 0,
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Send a message and get AI response (streaming)
app.post('/api/chat/conversations/:id/messages', async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { message, classId } = req.body;

    if (!message || !classId) {
      return res.status(400).json({ error: 'message and classId are required' });
    }

    // Get API key
    const { data: prefData } = await supabase
      .from('preferences')
      .select('value')
      .eq('key', 'api_key')
      .single();

    if (!prefData?.value) {
      return res.status(400).json({ error: 'API key not configured' });
    }

    // Verify conversation exists
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Save user message
    const { data: userMessage, error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
      })
      .select()
      .single();

    if (userMsgError) throw userMsgError;

    // Get conversation history (last 10 messages for context)
    const { data: history, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .lt('id', userMessage.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (historyError) throw historyError;

    // Build message array (reverse to get chronological order)
    const messages = (history || []).reverse().map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Stream response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const classNames = { 5: 'পঞ্চম', 6: 'ষষ্ঠ', 7: 'সপ্তম', 8: 'অষ্টম', 9: 'নবম', 10: 'দশম' };
    const client = new Anthropic({ apiKey: prefData.value });

    let fullResponse = '';

    try {
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `তুমি একজন সহায়ক বাংলা গণিত শিক্ষক সহকারী। তুমি ${classNames[classId] ?? ''} শ্রেণীর পশ্চিমবঙ্গ বোর্ড (WBBSE) এর ছাত্রছাত্রীদের সাহায্য করো।

তোমার কাজ:
- সবসময় বাংলায় উত্তর দাও
- গণিতের সমস্যা সমাধানে ধাপে ধাপে সাহায্য করো
- ধারণা সহজ ভাষায় ব্যাখ্যা করো
- উৎসাহজনক ও বন্ধুত্বপূর্ণ ভঙ্গিতে কথা বলো
- প্রয়োজনে উদাহরণ দাও
- শিক্ষার্থীকে নিজে চিন্তা করতে উৎসাহিত করো, সরাসরি উত্তর না দিয়ে

তুমি একজন সহায়ক বন্ধুর মতো, শুধু একজন শিক্ষক নয়।`,
        messages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullResponse += event.delta.text;
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }

      // Save assistant response
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullResponse,
        });

      // Update conversation updated_at and generate title if needed
      const updateData = { updated_at: new Date().toISOString() };

      if (!conversation.title || conversation.title === 'নতুন কথোপকথন') {
        // Generate title from first user message (first 50 chars)
        updateData.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      }

      await supabase
        .from('chat_conversations')
        .update(updateData)
        .eq('id', conversationId);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Chat message error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
});

// Delete a conversation
app.delete('/api/chat/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete (archive)
    const { error } = await supabase
      .from('chat_conversations')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Get quick actions for a class
app.get('/api/chat/quick-actions', async (req, res) => {
  try {
    const { classId } = req.query;

    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const { data, error } = await supabase
      .from('chat_quick_actions')
      .select('*')
      .eq('class_id', parseInt(classId))
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.json((data || []).map(a => ({
      id: a.id,
      category: a.category,
      question: a.question_bengali,
      icon: a.icon,
    })));
  } catch (error) {
    console.error('Error fetching quick actions:', error);
    res.status(500).json({ error: 'Failed to fetch quick actions' });
  }
});

// ── Curriculum Reading Endpoints ──────────────────────────────────────────────
app.get('/class/:classId', async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);

    // Get class info
    const { data: cls, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();

    if (classError) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get full curriculum structure with nested queries
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select(`
        *,
        topics (
          *,
          questions (
            *,
            options (*)
          )
        )
      `)
      .eq('class_id', classId);

    if (chaptersError) throw chaptersError;

    const classData = {
      id: cls.id,
      name: cls.name,
      bengaliName: cls.bengali_name,
      chapters: (chapters || []).map(chapter => ({
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        topics: (chapter.topics || []).map(topic => ({
          id: topic.id,
          name: topic.name,
          description: topic.description,
          questions: (topic.questions || []).map(question => ({
            id: question.id,
            type: question.type,
            text: question.text,
            answer: question.answer,
            solution: question.solution,
            difficulty: question.difficulty,
            options: (question.options || []).map(o => o.option_text),
          })),
        })),
      })),
    };

    res.json(classData);
  } catch (error) {
    console.error('Error fetching class data:', error);
    res.status(500).json({ error: 'Failed to fetch class data' });
  }
});

// ── Anthropic proxy (streaming) ───────────────────────────────────────────────
app.post('/api/doubts/ask', async (req, res) => {
  try {
    const { classId, question, topic } = req.body;

    const { data: apiKeyData } = await supabase
      .from('preferences')
      .select('value')
      .eq('key', 'api_key')
      .single();

    if (!apiKeyData?.value) {
      return res.status(400).json({ error: 'API key not configured' });
    }

    const classNames = { 5: 'পঞ্চম', 6: 'ষষ্ঠ', 7: 'সপ্তম', 8: 'অষ্টম', 9: 'নবম', 10: 'দশম' };
    const userMessage = topic?.trim()
      ? `বিষয়: ${topic}\n\nপ্রশ্ন: ${question}`
      : `প্রশ্ন: ${question}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client = new Anthropic({ apiKey: apiKeyData.value });
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: `তুমি একজন অভিজ্ঞ বাংলা মাধ্যম গণিত শিক্ষক। পশ্চিমবঙ্গ বোর্ড (WBBSE)-এর ${classNames[classId] ?? ''} শ্রেণীর ছাত্রছাত্রীদের গণিতের প্রশ্নের সমাধান করো।\n\nসবসময় বাংলায় উত্তর দাও। ধাপে ধাপে সহজ ভাষায় বোঝাও। প্রয়োজনে সূত্র ও উদাহরণ ব্যবহার করো।`,
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✨ Bengali Math API server (Supabase) → http://localhost:${PORT}`);
});
