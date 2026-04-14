-- Class Table
CREATE TABLE classes (
    id INTEGER PRIMARY KEY,
    name TEXT,
    bengali_name TEXT
);

-- Chapter Table
CREATE TABLE chapters (
    id TEXT PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id),
    name TEXT,
    description TEXT
);

-- Topic Table
CREATE TABLE topics (
    id TEXT PRIMARY KEY,
    chapter_id TEXT REFERENCES chapters(id),
    name TEXT,
    description TEXT
);

-- Question Table
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    topic_id TEXT REFERENCES topics(id),
    type TEXT,
    text TEXT,
    answer TEXT,
    solution TEXT,
    difficulty TEXT
);

-- MCQ Options Table (separate for flexibility)
CREATE TABLE IF NOT EXISTS options (
    id SERIAL PRIMARY KEY,
    question_id TEXT REFERENCES questions(id),
    option_text TEXT,
    is_correct BOOLEAN
);

-- Preferences Table
-- Stores user/app settings as key-value pairs.
-- Keys used by api.py: class_id, theme, api_key
CREATE TABLE IF NOT EXISTS preferences (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);

INSERT INTO preferences (key, value) VALUES
    ('class_id', ''),
    ('theme',    'light'),
    ('api_key',  '')
ON CONFLICT (key) DO NOTHING;

-- Sessions Table
-- One row per practice session saved by POST /api/sessions
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT        PRIMARY KEY,
    class_id    INTEGER     NOT NULL REFERENCES classes(id),
    chapter_id  TEXT        REFERENCES chapters(id),
    topic_id    TEXT        REFERENCES topics(id),
    difficulty  TEXT        CHECK (difficulty IN ('easy', 'medium', 'hard')),
    date        TIMESTAMPTZ NOT NULL,
    completed   BOOLEAN     NOT NULL DEFAULT FALSE,
    score       INTEGER     NOT NULL DEFAULT 0,
    total       INTEGER     NOT NULL DEFAULT 0
);

-- Session Questions Table
-- One row per question answered inside a session.
-- Deleted and re-inserted on every POST /api/sessions (replace pattern).
CREATE TABLE IF NOT EXISTS session_questions (
    id          BIGSERIAL   PRIMARY KEY,
    session_id  TEXT        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question_id TEXT        NOT NULL REFERENCES questions(id),
    topic_id    TEXT        NOT NULL REFERENCES topics(id),
    chapter_id  TEXT        NOT NULL REFERENCES chapters(id),
    correct     BOOLEAN     NOT NULL DEFAULT FALSE,
    attempted   BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sq_session_id ON session_questions(session_id);