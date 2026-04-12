import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

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

// ── User Profile System ───────────────────────────────────────────────────
app.post('/api/users', (req, res) => {
  const { username, displayName, classId } = req.body;

  if (!username || !displayName || !classId) {
    return res.status(400).json({ error: 'username, displayName, and classId are required' });
  }

  try {
    // Check if user already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (existingUser) {
      // Update last_active and return existing user
      db.prepare('UPDATE users SET last_active = datetime("now") WHERE id = ?').run(existingUser.id);
      return res.json({
        id: existingUser.id,
        username: existingUser.username,
        displayName: existingUser.display_name,
        classId: existingUser.class_id,
        totalXp: existingUser.total_xp,
        currentLevel: existingUser.current_level,
        streakCount: existingUser.streak_count,
        longestStreak: existingUser.longest_streak,
        avatarUrl: existingUser.avatar_url,
      });
    }

    // Create new user
    const result = db.prepare(`
      INSERT INTO users (username, display_name, class_id, created_at, last_active)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).run(username, displayName, classId);

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      id: newUser.id,
      username: newUser.username,
      displayName: newUser.display_name,
      classId: newUser.class_id,
      totalXp: newUser.total_xp,
      currentLevel: newUser.current_level,
      streakCount: newUser.streak_count,
      longestStreak: newUser.longest_streak,
      avatarUrl: newUser.avatar_url,
    });
  } catch (error) {
    console.error('Error creating/logging in user:', error);
    res.status(500).json({ error: 'Failed to create/login user' });
  }
});

app.get('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      classId: user.class_id,
      createdAt: user.created_at,
      lastActive: user.last_active,
      totalXp: user.total_xp,
      currentLevel: user.current_level,
      streakCount: user.streak_count,
      longestStreak: user.longest_streak,
      lastPracticeDate: user.last_practice_date,
      avatarUrl: user.avatar_url,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const { displayName, avatarUrl } = req.body;

  try {
    const updates = [];
    const params = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      params.push(displayName);
    }

    if (avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      params.push(avatarUrl);
    }

    updates.push('last_active = datetime("now")');

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      displayName: updatedUser.display_name,
      classId: updatedUser.class_id,
      totalXp: updatedUser.total_xp,
      currentLevel: updatedUser.current_level,
      streakCount: updatedUser.streak_count,
      longestStreak: updatedUser.longest_streak,
      avatarUrl: updatedUser.avatar_url,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.get('/api/users/:id/stats', (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    // Get user with level info using the view
    const userStats = db.prepare('SELECT * FROM user_stats WHERE id = ?').get(userId);

    if (!userStats) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent badges (last 5)
    const recentBadges = db.prepare(`
      SELECT b.id, b.name_bengali, b.name_english, b.icon, ub.earned_at
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = ?
      ORDER BY ub.earned_at DESC
      LIMIT 5
    `).all(userId);

    // Get next level info
    const nextLevel = db.prepare('SELECT * FROM levels WHERE level = ?').get(userStats.current_level + 1);

    // Calculate XP progress to next level
    const currentLevelXp = db.prepare('SELECT xp_required FROM levels WHERE level = ?').get(userStats.current_level);
    const xpProgress = nextLevel
      ? {
          current: userStats.total_xp - (currentLevelXp?.xp_required || 0),
          required: nextLevel.xp_required - (currentLevelXp?.xp_required || 0),
        }
      : null;

    // Get recent streak activity (last 7 days)
    const recentActivity = db.prepare(`
      SELECT practice_date, questions_completed, questions_correct, xp_earned
      FROM daily_streaks
      WHERE user_id = ?
      ORDER BY practice_date DESC
      LIMIT 7
    `).all(userId);

    res.json({
      user: {
        id: userStats.id,
        username: userStats.username,
        displayName: userStats.display_name,
        classId: userStats.class_id,
        totalXp: userStats.total_xp,
        currentLevel: userStats.current_level,
        levelName: userStats.level_name,
        streakCount: userStats.streak_count,
        longestStreak: userStats.longest_streak,
      },
      stats: {
        badgesEarned: userStats.badges_earned,
        daysPracticed: userStats.days_practiced,
        totalQuestions: userStats.total_questions,
      },
      progress: {
        nextLevel: nextLevel ? {
          level: nextLevel.level,
          name: nextLevel.name_bengali,
          icon: nextLevel.icon,
        } : null,
        xpProgress,
      },
      recentBadges,
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// ── Streak Management ─────────────────────────────────────────────────────────
app.get('/api/users/:id/streak', (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const user = db.prepare('SELECT streak_count, longest_streak, last_practice_date FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get last 30 days of activity for calendar
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const recentActivity = db.prepare(`
      SELECT practice_date, questions_completed, questions_correct, xp_earned, session_count
      FROM daily_streaks
      WHERE user_id = ? AND practice_date >= ?
      ORDER BY practice_date DESC
    `).all(userId, startDate);

    // Check if streak is still active (practiced today or yesterday)
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const isActive = user.last_practice_date === today || user.last_practice_date === yesterdayStr;

    res.json({
      currentStreak: user.streak_count,
      longestStreak: user.longest_streak,
      lastPracticeDate: user.last_practice_date,
      isActive,
      recentActivity: recentActivity.map(day => ({
        date: day.practice_date,
        questionsCompleted: day.questions_completed,
        questionsCorrect: day.questions_correct,
        xpEarned: day.xp_earned,
        sessionCount: day.session_count,
      })),
    });
  } catch (error) {
    console.error('Error fetching streak:', error);
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

app.post('/api/users/:id/streak/record', (req, res) => {
  const userId = parseInt(req.params.id);
  const { questionsCompleted, questionsCorrect, xpEarned } = req.body;

  if (!questionsCompleted || questionsCorrect === undefined || !xpEarned) {
    return res.status(400).json({ error: 'questionsCompleted, questionsCorrect, and xpEarned are required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if already recorded today
    const todayRecord = db.prepare('SELECT * FROM daily_streaks WHERE user_id = ? AND practice_date = ?').get(userId, today);

    if (todayRecord) {
      // Update existing record
      db.prepare(`
        UPDATE daily_streaks
        SET questions_completed = questions_completed + ?,
            questions_correct = questions_correct + ?,
            xp_earned = xp_earned + ?,
            session_count = session_count + 1
        WHERE user_id = ? AND practice_date = ?
      `).run(questionsCompleted, questionsCorrect, xpEarned, userId, today);
    } else {
      // Create new record
      db.prepare(`
        INSERT INTO daily_streaks (user_id, practice_date, questions_completed, questions_correct, xp_earned, session_count)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(userId, today, questionsCompleted, questionsCorrect, xpEarned);
    }

    // Calculate new streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = 1;
    let currentDate = yesterday;

    // Count consecutive days backwards from yesterday
    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const record = db.prepare('SELECT * FROM daily_streaks WHERE user_id = ? AND practice_date = ?').get(userId, dateStr);

      if (!record) break;

      newStreak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Update user streak
    const longestStreak = Math.max(user.longest_streak, newStreak);

    db.prepare(`
      UPDATE users
      SET streak_count = ?,
          longest_streak = ?,
          last_practice_date = ?,
          total_xp = total_xp + ?,
          last_active = datetime('now')
      WHERE id = ?
    `).run(newStreak, longestStreak, today, xpEarned, userId);

    // Add XP transaction
    db.prepare(`
      INSERT INTO xp_transactions (user_id, amount, reason, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(userId, xpEarned, 'practice_session');

    // Check for level up
    const updatedUser = db.prepare('SELECT total_xp, current_level FROM users WHERE id = ?').get(userId);
    const nextLevel = db.prepare('SELECT level FROM levels WHERE xp_required <= ? ORDER BY level DESC LIMIT 1').get(updatedUser.total_xp);

    if (nextLevel && nextLevel.level > updatedUser.current_level) {
      db.prepare('UPDATE users SET current_level = ? WHERE id = ?').run(nextLevel.level, userId);
    }

    // Check for streak badges
    const newBadges = [];
    const streakBadges = [
      { id: 'streak_3', threshold: 3 },
      { id: 'streak_7', threshold: 7 },
      { id: 'streak_30', threshold: 30 },
      { id: 'streak_100', threshold: 100 },
    ];

    for (const badge of streakBadges) {
      if (newStreak >= badge.threshold) {
        const alreadyHas = db.prepare('SELECT * FROM user_badges WHERE user_id = ? AND badge_id = ?').get(userId, badge.id);
        if (!alreadyHas) {
          db.prepare(`
            INSERT INTO user_badges (user_id, badge_id, earned_at)
            VALUES (?, ?, datetime('now'))
          `).run(userId, badge.id);

          const badgeInfo = db.prepare('SELECT name_bengali, icon FROM badges WHERE id = ?').get(badge.id);
          if (badgeInfo) {
            newBadges.push({ id: badge.id, ...badgeInfo });
          }
        }
      }
    }

    res.json({
      ok: true,
      streak: newStreak,
      longestStreak,
      newBadges,
      leveledUp: nextLevel && nextLevel.level > updatedUser.current_level,
      newLevel: nextLevel ? nextLevel.level : updatedUser.current_level,
    });
  } catch (error) {
    console.error('Error recording streak:', error);
    res.status(500).json({ error: 'Failed to record streak' });
  }
});

// ── Curriculum Reading Endpoints ──────────────────────────────────────────────
app.get('/class/:classId', (req, res) => {
  const classId = parseInt(req.params.classId);

  // Get class info
  const cls = db.prepare('SELECT id, name, bengali_name FROM classes WHERE id = ?').get(classId);
  if (!cls) {
    return res.status(404).json({ error: 'Class not found' });
  }

  const classData = {
    id: cls.id,
    name: cls.name,
    bengaliName: cls.bengali_name,
    chapters: []
  };

  // Get chapters for this class
  const chapters = db.prepare('SELECT id, name, description FROM chapters WHERE class_id = ?').all(classId);

  for (const chapter of chapters) {
    const chapterData = {
      id: chapter.id,
      name: chapter.name,
      description: chapter.description,
      topics: []
    };

    // Get topics for this chapter
    const topics = db.prepare('SELECT id, name, description FROM topics WHERE chapter_id = ?').all(chapter.id);

    for (const topic of topics) {
      const topicData = {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        questions: []
      };

      // Get questions for this topic
      const questions = db.prepare('SELECT id, type, text, answer, solution, difficulty FROM questions WHERE topic_id = ?').all(topic.id);

      for (const question of questions) {
        const questionData = {
          id: question.id,
          type: question.type,
          text: question.text,
          answer: question.answer,
          solution: question.solution,
          difficulty: question.difficulty
        };

        // Get options for MCQ
        const options = db.prepare('SELECT option_text FROM options WHERE question_id = ? ORDER BY id').all(question.id);
        if (options.length > 0) {
          questionData.options = options.map(o => o.option_text);
        }

        topicData.questions.push(questionData);
      }

      chapterData.topics.push(topicData);
    }

    classData.chapters.push(chapterData);
  }

  res.json(classData);
});

app.get('/chapter', (req, res) => {
  const classId = parseInt(req.query.classId);
  const chapterId = req.query.chapterId;

  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ? AND class_id = ?').get(chapterId, classId);

  if (!chapter) {
    return res.status(404).json({ error: 'Chapter not found' });
  }

  res.json(chapter);
});

app.get('/topic', (req, res) => {
  const classId = parseInt(req.query.classId);
  const topicId = req.query.topicId;

  const topic = db.prepare(`
    SELECT t.*, c.id as chapter_id
    FROM topics t
    JOIN chapters c ON t.chapter_id = c.id
    WHERE t.id = ? AND c.class_id = ?
  `).get(topicId, classId);

  if (!topic) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  res.json(topic);
});

app.get('/questions', (req, res) => {
  const classId = parseInt(req.query.classId);
  const chapterId = req.query.chapterId;
  const topicId = req.query.topicId;
  const difficulty = req.query.difficulty;

  let query = `
    SELECT q.*, t.id as topic_id, c.id as chapter_id
    FROM questions q
    JOIN topics t ON q.topic_id = t.id
    JOIN chapters c ON t.chapter_id = c.id
    WHERE c.class_id = ?
  `;

  const params = [classId];

  if (chapterId) {
    query += ' AND c.id = ?';
    params.push(chapterId);
  }

  if (topicId) {
    query += ' AND t.id = ?';
    params.push(topicId);
  }

  if (difficulty) {
    query += ' AND q.difficulty = ?';
    params.push(difficulty);
  }

  const rows = db.prepare(query).all(...params);

  const result = rows.map(row => ({
    question: {
      id: row.id,
      type: row.type,
      text: row.text,
      answer: row.answer,
      solution: row.solution,
      difficulty: row.difficulty
    },
    topicId: row.topic_id,
    chapterId: row.chapter_id
  }));

  res.json(result);
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

// ── PDF Upload and Processing ─────────────────────────────────────────────────
const upload = multer({
  dest: join(__dirname, '..', 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.post('/api/admin/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { classId, chapterId, topicId, provider } = req.body;

    if (!classId || !chapterId || !topicId) {
      return res.status(400).json({
        error: 'Missing required fields: classId, chapterId, topicId'
      });
    }

    const pdfPath = req.file.path;
    const processorPath = join(__dirname, '..', 'service', 'content', 'extractor', 'process_pdf.py');

    // Build command
    const providerArg = provider ? ` ${provider}` : '';
    const command = `python "${processorPath}" "${pdfPath}" ${classId} ${chapterId} ${topicId}${providerArg}`;

    console.log('Executing:', command);

    // Execute Python script
    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stdout) {
      console.error('PDF Processing Error:', stderr);
      return res.status(500).json({
        error: 'PDF processing failed',
        details: stderr
      });
    }

    // Parse result
    const result = JSON.parse(stdout);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'PDF processing failed'
      });
    }

    // Save questions to database
    const insertQuestion = db.prepare(`
      INSERT INTO questions (id, topic_id, type, text, answer, solution, difficulty)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertOption = db.prepare(`
      INSERT INTO options (question_id, option_text, is_correct)
      VALUES (?, ?, ?)
    `);

    let savedCount = 0;
    for (const question of result.questions) {
      try {
        insertQuestion.run(
          question.id,
          question.topic_id,
          question.type,
          question.text,
          question.answer,
          question.solution,
          question.difficulty
        );

        // Insert options if MCQ
        if (question.type === 'mcq' && question.options) {
          question.options.forEach((optionText, index) => {
            insertOption.run(
              question.id,
              optionText,
              index === parseInt(question.answer) ? 1 : 0
            );
          });
        }

        savedCount++;
      } catch (dbError) {
        console.error('Error saving question:', question.id, dbError.message);
        // Continue with other questions
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      message: `Successfully processed PDF and saved ${savedCount} questions`,
      extracted: result.count,
      saved: savedCount,
      extractedData: result.extracted_data
    });

  } catch (error) {
    console.error('PDF Upload Error:', error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to process PDF',
      details: error.message
    });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Bengali Math API server → http://localhost:${PORT}`);
});
