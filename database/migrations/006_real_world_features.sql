-- Real-world Connection Features Migration

-- Word Problems with local context
CREATE TABLE IF NOT EXISTS word_problems (
  id              TEXT PRIMARY KEY,
  topic_id        TEXT NOT NULL,
  class_id        INTEGER NOT NULL,
  chapter_id      TEXT NOT NULL,
  problem_text    TEXT NOT NULL,
  context_type    TEXT NOT NULL, -- 'bazaar', 'rickshaw', 'land', 'sports', 'festival', etc.
  answer          TEXT NOT NULL,
  solution_steps  TEXT, -- JSON array of solution steps in Bengali
  difficulty      TEXT NOT NULL DEFAULT 'medium', -- 'easy', 'medium', 'hard'
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE INDEX idx_word_problems_topic ON word_problems(topic_id);
CREATE INDEX idx_word_problems_class ON word_problems(class_id);
CREATE INDEX idx_word_problems_context ON word_problems(context_type);

-- "কেন শিখব?" (Why should I learn?) cards
CREATE TABLE IF NOT EXISTS use_case_cards (
  id              TEXT PRIMARY KEY,
  topic_id        TEXT NOT NULL,
  class_id        INTEGER NOT NULL,
  chapter_id      TEXT NOT NULL,
  title           TEXT NOT NULL, -- Short Bengali title
  description     TEXT NOT NULL, -- Real-life use case in Bengali
  example         TEXT NOT NULL, -- Concrete example
  icon            TEXT, -- emoji or icon name
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE INDEX idx_use_case_cards_topic ON use_case_cards(topic_id);
CREATE INDEX idx_use_case_cards_class ON use_case_cards(class_id);

-- Daily Math Puzzles (গণিত ধাঁধা)
CREATE TABLE IF NOT EXISTS daily_puzzles (
  id              TEXT PRIMARY KEY,
  puzzle_date     TEXT NOT NULL UNIQUE, -- YYYY-MM-DD format
  puzzle_text     TEXT NOT NULL, -- Puzzle question in Bengali
  answer          TEXT NOT NULL,
  hint            TEXT, -- Optional hint in Bengali
  explanation     TEXT, -- How to solve in Bengali
  difficulty      TEXT NOT NULL DEFAULT 'medium',
  category        TEXT, -- 'logic', 'arithmetic', 'pattern', 'riddle', etc.
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_daily_puzzles_date ON daily_puzzles(puzzle_date);

-- User attempts for daily puzzles
CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_id       TEXT NOT NULL,
  attempted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  solved          INTEGER NOT NULL DEFAULT 0, -- 0 = not solved, 1 = solved
  attempts_count  INTEGER NOT NULL DEFAULT 1,
  time_taken      INTEGER, -- seconds taken to solve (optional)
  FOREIGN KEY (puzzle_id) REFERENCES daily_puzzles(id)
);

CREATE INDEX idx_puzzle_attempts_puzzle ON puzzle_attempts(puzzle_id);
CREATE INDEX idx_puzzle_attempts_date ON puzzle_attempts(attempted_at);

-- Word problem user attempts
CREATE TABLE IF NOT EXISTS word_problem_attempts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id      TEXT NOT NULL,
  attempted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  user_answer     TEXT,
  correct         INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (problem_id) REFERENCES word_problems(id)
);

CREATE INDEX idx_word_problem_attempts_problem ON word_problem_attempts(problem_id);
