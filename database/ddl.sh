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
CREATE TABLE options (
    id SERIAL PRIMARY KEY,
    question_id TEXT REFERENCES questions(id),
    option_text TEXT,
    is_correct BOOLEAN
);