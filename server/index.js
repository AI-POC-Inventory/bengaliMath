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
const DB_PATH = process.env.DB_PATH ?? join(__dirname, '..', 'database', 'bengali_curriculam.db');

const db = new Database(DB_PATH);
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

// ── Admin: Classes ────────────────────────────────────────────────────────────
app.get('/api/admin/classes', (_req, res) => {
  const rows = db.prepare('SELECT * FROM classes ORDER BY id').all();
  res.json(rows.map(r => ({ id: r.id, name: r.name, bengaliName: r.bengali_name })));
});

app.post('/api/admin/classes', (req, res) => {
  const { id, name, bengaliName } = req.body;
  db.prepare('INSERT OR REPLACE INTO classes (id, name, bengali_name) VALUES (?, ?, ?)').run(id, name, bengaliName);
  res.json({ ok: true });
});

app.put('/api/admin/classes/:id', (req, res) => {
  const { name, bengaliName } = req.body;
  db.prepare('UPDATE classes SET name=?, bengali_name=? WHERE id=?').run(name, bengaliName, parseInt(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/admin/classes/:id', (req, res) => {
  db.prepare('DELETE FROM classes WHERE id=?').run(parseInt(req.params.id));
  res.json({ ok: true });
});

// ── Admin: Chapters ───────────────────────────────────────────────────────────
app.get('/api/admin/chapters', (req, res) => {
  const classId = req.query.classId ? parseInt(req.query.classId) : null;
  const rows = classId
    ? db.prepare('SELECT * FROM chapters WHERE class_id=? ORDER BY id').all(classId)
    : db.prepare('SELECT * FROM chapters ORDER BY id').all();
  res.json(rows.map(r => ({ id: r.id, classId: r.class_id, name: r.name, description: r.description })));
});

app.post('/api/admin/chapters', (req, res) => {
  const { id, classId, name, description } = req.body;
  db.prepare('INSERT OR REPLACE INTO chapters (id, class_id, name, description) VALUES (?, ?, ?, ?)').run(id, classId, name, description ?? '');
  res.json({ ok: true });
});

app.put('/api/admin/chapters/:id', (req, res) => {
  const { name, description } = req.body;
  db.prepare('UPDATE chapters SET name=?, description=? WHERE id=?').run(name, description ?? '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/chapters/:id', (req, res) => {
  db.prepare('DELETE FROM chapters WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Admin: Topics ─────────────────────────────────────────────────────────────
app.get('/api/admin/topics', (req, res) => {
  const chapterId = req.query.chapterId ?? null;
  const rows = chapterId
    ? db.prepare('SELECT * FROM topics WHERE chapter_id=? ORDER BY id').all(chapterId)
    : db.prepare('SELECT * FROM topics ORDER BY id').all();
  res.json(rows.map(r => ({ id: r.id, chapterId: r.chapter_id, name: r.name, description: r.description })));
});

app.post('/api/admin/topics', (req, res) => {
  const { id, chapterId, name, description } = req.body;
  db.prepare('INSERT OR REPLACE INTO topics (id, chapter_id, name, description) VALUES (?, ?, ?, ?)').run(id, chapterId, name, description ?? '');
  res.json({ ok: true });
});

app.put('/api/admin/topics/:id', (req, res) => {
  const { name, description } = req.body;
  db.prepare('UPDATE topics SET name=?, description=? WHERE id=?').run(name, description ?? '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/topics/:id', (req, res) => {
  db.prepare('DELETE FROM topics WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Admin: Questions ──────────────────────────────────────────────────────────
app.get('/api/admin/questions', (req, res) => {
  const { topicId, chapterId, classId } = req.query;
  let stmt, params;

  if (topicId) {
    stmt = `SELECT q.*, GROUP_CONCAT(o.option_text, '||') as options_raw
            FROM questions q LEFT JOIN options o ON o.question_id=q.id
            WHERE q.topic_id=? GROUP BY q.id ORDER BY q.id`;
    params = [topicId];
  } else if (chapterId) {
    stmt = `SELECT q.*, GROUP_CONCAT(o.option_text, '||') as options_raw
            FROM questions q JOIN topics t ON q.topic_id=t.id
            LEFT JOIN options o ON o.question_id=q.id
            WHERE t.chapter_id=? GROUP BY q.id ORDER BY q.id`;
    params = [chapterId];
  } else if (classId) {
    stmt = `SELECT q.*, GROUP_CONCAT(o.option_text, '||') as options_raw
            FROM questions q JOIN topics t ON q.topic_id=t.id
            JOIN chapters c ON t.chapter_id=c.id
            LEFT JOIN options o ON o.question_id=q.id
            WHERE c.class_id=? GROUP BY q.id ORDER BY q.id`;
    params = [parseInt(classId)];
  } else {
    stmt = `SELECT q.*, GROUP_CONCAT(o.option_text, '||') as options_raw
            FROM questions q LEFT JOIN options o ON o.question_id=q.id
            GROUP BY q.id ORDER BY q.id`;
    params = [];
  }

  const rows = db.prepare(stmt).all(...params);
  res.json(rows.map(r => ({
    id:         r.id,
    topicId:    r.topic_id,
    type:       r.type,
    text:       r.text,
    answer:     r.answer,
    solution:   r.solution,
    difficulty: r.difficulty,
    options:    r.options_raw ? r.options_raw.split('||') : [],
  })));
});

app.post('/api/admin/questions', (req, res) => {
  const { id, topicId, type, text, answer, solution, difficulty, options } = req.body;
  db.prepare(`INSERT OR REPLACE INTO questions (id, topic_id, type, text, answer, solution, difficulty)
              VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, topicId, type, text, String(answer), solution, difficulty);
  db.prepare('DELETE FROM options WHERE question_id=?').run(id);
  if (type === 'mcq' && Array.isArray(options)) {
    const ins = db.prepare('INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)');
    options.forEach((opt, i) => ins.run(id, opt, i === parseInt(answer) ? 1 : 0));
  }
  res.json({ ok: true });
});

app.put('/api/admin/questions/:id', (req, res) => {
  const { type, text, answer, solution, difficulty, options } = req.body;
  db.prepare(`UPDATE questions SET type=?, text=?, answer=?, solution=?, difficulty=? WHERE id=?`)
    .run(type, text, String(answer), solution, difficulty, req.params.id);
  db.prepare('DELETE FROM options WHERE question_id=?').run(req.params.id);
  if (type === 'mcq' && Array.isArray(options)) {
    const ins = db.prepare('INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)');
    options.forEach((opt, i) => ins.run(req.params.id, opt, i === parseInt(answer) ? 1 : 0));
  }
  res.json({ ok: true });
});

app.delete('/api/admin/questions/:id', (req, res) => {
  db.prepare('DELETE FROM options WHERE question_id=?').run(req.params.id);
  db.prepare('DELETE FROM questions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Bengali Math API server → http://localhost:${PORT}`);
});
