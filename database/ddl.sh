-- Class Table
CREATE TABLE classes (
    id INTEGER PRIMARY KEY,
    name TEXT,
    bengali_name TEXT
);

-- Chapter Table
CREATE TABLE chapters (
    id TEXT PRIMARY KEY,
    class_id INTEGER,
    name TEXT,
    description TEXT,
    FOREIGN KEY(class_id) REFERENCES classes(id)
);

-- Topic Table
CREATE TABLE topics (
    id TEXT PRIMARY KEY,
    chapter_id TEXT,
    name TEXT,
    description TEXT,
    FOREIGN KEY(chapter_id) REFERENCES chapters(id)
);

-- Question Table
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    topic_id TEXT,
    type TEXT,
    text TEXT,
    answer TEXT,
    solution TEXT,
    difficulty TEXT,
    FOREIGN KEY(topic_id) REFERENCES topics(id)
);

-- MCQ Options Table (separate for flexibility)
CREATE TABLE options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT,
    option_text TEXT,
    is_correct INTEGER,
    FOREIGN KEY(question_id) REFERENCES questions(id)
);