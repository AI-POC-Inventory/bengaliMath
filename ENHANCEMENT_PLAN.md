# Bengali Math - Comprehensive Enhancement Plan

## Overview
This document outlines the implementation plan for adding engagement, gamification, learning quality, visual/interactive features, and social motivation to the Bengali Math application.

---

## Phase 1: Engagement & Gamification

### 1.1 Database Schema Extensions

```sql
-- User profiles table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  class_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_active TEXT NOT NULL,
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  streak_count INTEGER DEFAULT 0,
  last_practice_date TEXT,
  avatar_url TEXT
);

-- Streaks tracking
CREATE TABLE IF NOT EXISTS daily_streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  practice_date TEXT NOT NULL,
  questions_completed INTEGER NOT NULL,
  xp_earned INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, practice_date)
);

-- Badges & achievements
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name_bengali TEXT NOT NULL,
  name_english TEXT NOT NULL,
  description_bengali TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL, -- 'streak', 'mastery', 'practice', 'special'
  requirement_type TEXT NOT NULL, -- 'streak_days', 'topic_mastery', 'total_questions', etc.
  requirement_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id),
  UNIQUE(user_id, badge_id)
);

-- XP & Levels
CREATE TABLE IF NOT EXISTS xp_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL, -- 'question_correct', 'streak_bonus', 'daily_puzzle', etc.
  session_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS levels (
  level INTEGER PRIMARY KEY,
  name_bengali TEXT NOT NULL,
  name_english TEXT NOT NULL,
  xp_required INTEGER NOT NULL,
  icon TEXT NOT NULL
);

-- Leaderboard (materialized view approach)
CREATE TABLE IF NOT EXISTS leaderboard_weekly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,
  total_xp INTEGER NOT NULL,
  questions_correct INTEGER NOT NULL,
  rank INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, week_start)
);
```

### 1.2 API Endpoints

**User Management:**
- `POST /api/users` - Create/login user
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `GET /api/users/:id/stats` - Get comprehensive stats

**Streaks:**
- `GET /api/users/:id/streak` - Get current streak info
- `POST /api/users/:id/streak/record` - Record daily practice

**Badges:**
- `GET /api/badges` - Get all available badges
- `GET /api/users/:id/badges` - Get user's earned badges
- `POST /api/users/:id/badges/check` - Check and award new badges

**XP & Levels:**
- `POST /api/users/:id/xp/add` - Add XP to user
- `GET /api/levels` - Get all level definitions
- `GET /api/users/:id/progress` - Get level progress

**Leaderboard:**
- `GET /api/leaderboard/weekly/:classId` - Get weekly leaderboard
- `GET /api/leaderboard/all-time/:classId` - Get all-time leaderboard

### 1.3 UI Components

**New Components:**
- `StreakTracker.tsx` - Daily streak display with flame icon
- `BadgeGallery.tsx` - Badge collection display
- `XPProgressBar.tsx` - XP and level progress
- `Leaderboard.tsx` - Weekly rankings
- `ProfileCard.tsx` - User profile with stats

---

## Phase 2: Learning Quality

### 2.1 Database Schema Extensions

```sql
-- Concept cards
CREATE TABLE IF NOT EXISTS concept_cards (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  title_bengali TEXT NOT NULL,
  formula TEXT NOT NULL,
  explanation_bengali TEXT NOT NULL,
  example TEXT,
  image_url TEXT
);

-- Mistake notebook
CREATE TABLE IF NOT EXISTS mistake_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  first_attempt_date TEXT NOT NULL,
  times_failed INTEGER DEFAULT 1,
  last_failed_date TEXT NOT NULL,
  mastered INTEGER DEFAULT 0,
  mastered_date TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, question_id)
);

-- Spaced repetition schedule
CREATE TABLE IF NOT EXISTS review_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  next_review_date TEXT NOT NULL,
  interval_days INTEGER NOT NULL, -- 1, 3, 7, 14, 30
  ease_factor REAL DEFAULT 2.5,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, question_id)
);

-- Performance tracking for adaptive difficulty
CREATE TABLE IF NOT EXISTS performance_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  total_attempted INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  avg_time_seconds REAL,
  last_updated TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, topic_id, difficulty)
);
```

### 2.2 API Endpoints

**Concept Cards:**
- `GET /api/concept-cards/:topicId` - Get cards for topic
- `POST /api/concept-cards/:id/review` - Mark card as reviewed

**Mistake Notebook:**
- `GET /api/users/:id/mistakes` - Get all mistakes
- `GET /api/users/:id/mistakes/:topicId` - Get mistakes by topic
- `POST /api/users/:id/mistakes/record` - Record a mistake
- `PUT /api/users/:id/mistakes/:questionId/master` - Mark as mastered

**Spaced Repetition:**
- `GET /api/users/:id/reviews/due` - Get questions due for review
- `POST /api/users/:id/reviews/update` - Update review schedule after attempt

**Adaptive Difficulty:**
- `GET /api/users/:id/recommended-difficulty/:topicId` - Get recommended difficulty
- `POST /api/users/:id/performance/update` - Update performance stats

### 2.3 UI Components

**New Components:**
- `ConceptCardViewer.tsx` - Flashcard-style formula review
- `MistakeNotebook.tsx` - View and retry mistakes
- `ReviewSchedule.tsx` - Daily review tasks
- `DifficultyRecommendation.tsx` - Shows recommended difficulty

---

## Phase 3: Visual & Interactive

### 3.1 Database Schema Extensions

```sql
-- Store user-created graphs and geometry
CREATE TABLE IF NOT EXISTS user_visualizations (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'graph', 'geometry'
  data TEXT NOT NULL, -- JSON data
  topic_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Solution steps for step revealer
CREATE TABLE IF NOT EXISTS solution_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_text_bengali TEXT NOT NULL,
  hint_bengali TEXT,
  UNIQUE(question_id, step_number)
);
```

### 3.2 Libraries Needed

- **Graph Plotter:** Use `recharts` or `plotly.js` for interactive graphs
- **Geometry Canvas:** Use `konva` or `fabric.js` for drawing
- **Math Rendering:** Use `katex` or `mathjax` for formulas

### 3.3 UI Components

**New Components:**
- `GraphPlotter.tsx` - Interactive coordinate plane
- `GeometryCanvas.tsx` - Drawing tool for shapes
- `StepRevealer.tsx` - Progressive solution display

---

## Phase 4: Real-world Connection

### 4.1 Database Schema Extensions

```sql
-- Word problems with local context
CREATE TABLE IF NOT EXISTS word_problems (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  problem_bengali TEXT NOT NULL,
  context_type TEXT NOT NULL, -- 'bazaar', 'rickshaw', 'land', 'cricket', etc.
  difficulty TEXT NOT NULL,
  solution TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Why learn this cards
CREATE TABLE IF NOT EXISTS topic_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id TEXT NOT NULL,
  title_bengali TEXT NOT NULL,
  description_bengali TEXT NOT NULL,
  real_world_example TEXT NOT NULL,
  icon TEXT,
  UNIQUE(topic_id)
);

-- Daily puzzles
CREATE TABLE IF NOT EXISTS daily_puzzles (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  puzzle_bengali TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation_bengali TEXT NOT NULL,
  difficulty TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  puzzle_id TEXT NOT NULL,
  solved INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  solved_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, puzzle_id)
);
```

### 4.2 API Endpoints

**Word Problems:**
- `POST /api/word-problems/generate` - AI-generate word problem
- `GET /api/word-problems/:topicId` - Get existing word problems

**Topic Applications:**
- `GET /api/topics/:id/applications` - Get "why learn this?" content

**Daily Puzzles:**
- `GET /api/puzzles/today` - Get today's puzzle
- `POST /api/users/:id/puzzles/:puzzleId/attempt` - Submit puzzle attempt
- `GET /api/users/:id/puzzles/history` - Get puzzle history

### 4.3 UI Components

**New Components:**
- `WordProblemGenerator.tsx` - AI-generated word problems
- `TopicApplicationCard.tsx` - Real-world use cases
- `DailyPuzzle.tsx` - Featured daily puzzle

---

## Phase 5: Social & Motivation

### 5.1 Database Schema Extensions

```sql
-- Challenge system
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  creator_user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  topic_id TEXT,
  difficulty TEXT,
  questions TEXT NOT NULL, -- JSON array of question IDs
  created_at TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY (creator_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS challenge_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(challenge_id, user_id)
);

-- Question of the day
CREATE TABLE IF NOT EXISTS featured_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  question_id TEXT NOT NULL,
  class_id INTEGER NOT NULL
);

-- Progress reports
CREATE TABLE IF NOT EXISTS progress_reports (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  report_data TEXT NOT NULL, -- JSON with all stats
  pdf_path TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 5.2 API Endpoints

**Challenges:**
- `POST /api/challenges` - Create challenge
- `GET /api/challenges/:id` - Get challenge details
- `POST /api/challenges/:id/attempt` - Submit challenge attempt
- `GET /api/challenges/:id/results` - Get challenge leaderboard

**Featured Content:**
- `GET /api/featured/question-of-day/:classId` - Get today's featured question

**Reports:**
- `POST /api/reports/generate/:userId` - Generate weekly report
- `GET /api/reports/:userId/latest` - Get latest report
- `GET /api/reports/:id/pdf` - Download PDF

### 5.3 UI Components

**New Components:**
- `ChallengeCreator.tsx` - Create and share challenges
- `ChallengeView.tsx` - Take a challenge
- `QuestionOfTheDay.tsx` - Featured question display
- `ProgressReport.tsx` - Weekly progress view
- `ReportPDFGenerator.tsx` - PDF export functionality

---

## Implementation Strategy

### Priority Order (Recommended)

**Week 1-2: Foundation**
1. User profile system
2. Streak tracker
3. XP & levels
4. Mistake notebook

**Week 3-4: Gamification**
5. Badges & achievements
6. Leaderboard
7. Question of the day

**Week 5-6: Learning Features**
8. Concept cards
9. Spaced repetition
10. Adaptive difficulty
11. Step revealer

**Week 7-8: Interactive Features**
12. Graph plotter
13. Geometry canvas
14. Word problem generator

**Week 9-10: Social Features**
15. Daily puzzles
16. Challenge system
17. Progress reports
18. "Why learn this?" cards

---

## Technical Considerations

### Performance
- Use indexes on frequently queried columns (user_id, date fields)
- Implement pagination for leaderboards and history
- Cache daily content (puzzle, featured question)
- Lazy load visual components

### Data Migration
- Create migration scripts for existing users
- Backfill historical session data into new tables
- Preserve existing preferences and history

### Security
- Validate challenge links to prevent manipulation
- Rate limit AI generation endpoints
- Sanitize user-generated content
- Implement proper CORS for share links

### Localization
- All UI text in Bengali
- Support for Bengali numerals (optional)
- Date formatting in Bengali locale

---

## Success Metrics

### Engagement
- Daily active users (DAU)
- Average streak length
- Session duration
- Completion rate per session

### Learning
- Improvement in topic mastery over time
- Reduction in repeated mistakes
- Adaptive difficulty progression

### Social
- Challenge participation rate
- Report shares
- Leaderboard engagement

---

## Next Steps

1. Review and approve this plan
2. Set up development environment
3. Create database migrations
4. Implement Phase 1 (Gamification)
5. Test with sample users
6. Iterate based on feedback
