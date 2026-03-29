import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// ── Database setup ────────────────────────────────────────────────────────────
DB_PATH = "D:\\Sujit\\AiML\\AITech\\academy\\beangali-board\\bengaliMath\\database\\bengali_curriculam.db"

// const db = new Database(join(__dirname, 'database.sqlite'));
const db = new Database(DBPATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS preferences (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT    PRIMARY KEY,
    class_id    INTEGER NOT NULL,
    chapter_id  TEXT,
    topic_id    TEXT,
    difficulty  TEXT,
    date        TEXT    NOT NULL,
    completed   INTEGER NOT NULL DEFAULT 0,
    score       INTEGER NOT NULL DEFAULT 0,
    total       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS session_questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,
    question_id TEXT    NOT NULL,
    topic_id    TEXT    NOT NULL,
    chapter_id  TEXT    NOT NULL,
    correct     INTEGER NOT NULL DEFAULT 0,
    attempted   INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS doubts (
    id        TEXT    PRIMARY KEY,
    class_id  INTEGER NOT NULL,
    question  TEXT    NOT NULL,
    topic     TEXT,
    response  TEXT    NOT NULL,
    date      TEXT    NOT NULL
  );
`);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Preferences ───────────────────────────────────────────────────────────────
app.get('/api/preferences', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM preferences').all();
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    classId: map.class_id && map.class_id !== '' ? parseInt(map.class_id) : null,
    theme:   map.theme || 'light',
    apiKey:  map.api_key || '',
  });
});

app.put('/api/preferences', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  db.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)').run(key, String(value ?? ''));
  res.json({ ok: true });
});

// ── Sessions ──────────────────────────────────────────────────────────────────
app.get('/api/sessions', (req, res) => {
  const classId = req.query.classId ? parseInt(req.query.classId) : null;
  const rows = classId
    ? db.prepare('SELECT * FROM sessions WHERE class_id = ? ORDER BY date DESC').all(classId)
    : db.prepare('SELECT * FROM sessions ORDER BY date DESC').all();

  const sessions = rows.map(s => {
    const questions = db.prepare('SELECT * FROM session_questions WHERE session_id = ?').all(s.id);
    return {
      id:         s.id,
      classId:    s.class_id,
      chapterId:  s.chapter_id  ?? undefined,
      topicId:    s.topic_id    ?? undefined,
      difficulty: s.difficulty  ?? undefined,
      date:       s.date,
      completed:  Boolean(s.completed),
      score:      s.score,
      total:      s.total,
      questions:  questions.map(q => ({
        questionId: q.question_id,
        topicId:    q.topic_id,
        chapterId:  q.chapter_id,
        correct:    Boolean(q.correct),
        attempted:  Boolean(q.attempted),
      })),
    };
  });

  res.json(sessions);
});

app.post('/api/sessions', (req, res) => {
  const s = req.body;
  db.prepare(`
    INSERT OR REPLACE INTO sessions
      (id, class_id, chapter_id, topic_id, difficulty, date, completed, score, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    s.id, s.classId, s.chapterId ?? null, s.topicId ?? null,
    s.difficulty ?? null, s.date, s.completed ? 1 : 0, s.score, s.total,
  );

  db.prepare('DELETE FROM session_questions WHERE session_id = ?').run(s.id);
  const insertQ = db.prepare(`
    INSERT INTO session_questions (session_id, question_id, topic_id, chapter_id, correct, attempted)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const q of (s.questions ?? [])) {
    insertQ.run(s.id, q.questionId, q.topicId, q.chapterId, q.correct ? 1 : 0, q.attempted ? 1 : 0);
  }

  res.json({ ok: true });
});

app.delete('/api/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Doubts ────────────────────────────────────────────────────────────────────
app.get('/api/doubts', (req, res) => {
  const classId = req.query.classId ? parseInt(req.query.classId) : null;
  const rows = classId
    ? db.prepare('SELECT * FROM doubts WHERE class_id = ? ORDER BY date DESC').all(classId)
    : db.prepare('SELECT * FROM doubts ORDER BY date DESC').all();

  res.json(rows.map(d => ({
    id:       d.id,
    classId:  d.class_id,
    question: d.question,
    topic:    d.topic ?? undefined,
    response: d.response,
    date:     d.date,
  })));
});

app.post('/api/doubts', (req, res) => {
  const d = req.body;
  db.prepare(`
    INSERT OR REPLACE INTO doubts (id, class_id, question, topic, response, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(d.id, d.classId, d.question, d.topic ?? null, d.response, d.date);
  res.json({ ok: true });
});

app.delete('/api/doubts/:id', (req, res) => {
  db.prepare('DELETE FROM doubts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Anthropic proxy (streaming) ───────────────────────────────────────────────
app.post('/api/doubts/ask', async (req, res) => {
  const { classId, question, topic } = req.body;
  const apiKeyRow = db.prepare("SELECT value FROM preferences WHERE key = 'api_key'").get();

  if (!apiKeyRow?.value) {
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

  try {
    const client = new Anthropic({ apiKey: apiKeyRow.value });
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  }

  res.end();
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Bengali Math API server → http://localhost:${PORT}`);
});
