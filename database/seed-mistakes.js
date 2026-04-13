/**
 * Seed Sample Mistakes for Testing
 * Creates sample mistake records for the test user
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'bengali_curriculam.db');

console.log('🌱 Seeding sample mistakes for Mistake Notebook');
console.log('===============================================\n');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

try {
  // Get the test user
  const user = db.prepare('SELECT * FROM users WHERE id = 1').get();

  if (!user) {
    console.log('❌ No user found! Please create a user first.');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.username}\n`);

  // Get some random questions from the database with difficulty
  const questions = db.prepare(`
    SELECT q.id, q.topic_id, t.chapter_id, q.difficulty
    FROM questions q
    JOIN topics t ON q.topic_id = t.id
    WHERE q.difficulty IS NOT NULL
    LIMIT 10
  `).all();

  if (questions.length === 0) {
    console.log('❌ No questions found in database!');
    process.exit(1);
  }

  console.log(`📝 Creating mistake records...`);

  const today = new Date();
  let mistakesCreated = 0;
  let reviewsCreated = 0;

  // Create mistakes with varying fail counts
  for (let i = 0; i < Math.min(questions.length, 8); i++) {
    const question = questions[i];
    const timesFailed = Math.floor(Math.random() * 5) + 1;
    const daysAgo = Math.floor(Math.random() * 10) + 1;

    const firstDate = new Date(today);
    firstDate.setDate(firstDate.getDate() - daysAgo);
    const firstDateStr = firstDate.toISOString().split('T')[0];

    const lastDate = new Date(today);
    lastDate.setDate(lastDate.getDate() - Math.floor(Math.random() * 3));
    const lastDateStr = lastDate.toISOString().split('T')[0];

    // Randomly mark some as mastered
    const mastered = i < 3 ? 1 : 0;
    const masteredDate = mastered
      ? new Date(today.setDate(today.getDate() - 1)).toISOString().split('T')[0]
      : null;

    try {
      // Check if mistake already exists
      let mistakeRecordId;
      const existing = db.prepare('SELECT * FROM mistake_records WHERE user_id = ? AND question_id = ?').get(user.id, question.id);

      if (existing) {
        // Update existing
        db.prepare(`
          UPDATE mistake_records
          SET times_failed = ?, last_failed_date = ?, mastered = ?, mastered_date = ?
          WHERE user_id = ? AND question_id = ?
        `).run(timesFailed, lastDateStr, mastered, masteredDate, user.id, question.id);
        mistakeRecordId = existing.id;
      } else {
        // Insert new
        const result = db.prepare(`
          INSERT INTO mistake_records
            (user_id, question_id, chapter_id, topic_id, difficulty, first_attempt_date, times_failed, last_failed_date, mastered, mastered_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          user.id,
          question.id,
          question.chapter_id,
          question.topic_id,
          question.difficulty,
          firstDateStr,
          timesFailed,
          lastDateStr,
          mastered,
          masteredDate
        );
        mistakeRecordId = result.lastInsertRowid;
      }

      console.log(`  ✓ Mistake: ${question.id} (${timesFailed} fails${mastered ? ', mastered' : ''})`);
      mistakesCreated++;

      // Add to review schedule if not mastered
      if (!mastered && mistakeRecordId) {
        const intervalDays = [1, 3, 7][Math.floor(Math.random() * 3)];
        const nextReview = new Date(today);
        nextReview.setDate(nextReview.getDate() + (Math.random() < 0.5 ? -1 : intervalDays));

        // Check if review schedule exists
        const existingReview = db.prepare('SELECT * FROM review_schedule WHERE user_id = ? AND question_id = ?').get(user.id, question.id);

        if (existingReview) {
          db.prepare(`
            UPDATE review_schedule
            SET next_review_date = ?, interval_days = ?
            WHERE user_id = ? AND question_id = ?
          `).run(nextReview.toISOString().split('T')[0], intervalDays, user.id, question.id);
        } else {
          db.prepare(`
            INSERT INTO review_schedule
              (user_id, question_id, mistake_record_id, next_review_date, interval_days, ease_factor)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            user.id,
            question.id,
            mistakeRecordId,
            nextReview.toISOString().split('T')[0],
            intervalDays,
            2.5
          );
        }

        reviewsCreated++;
      }
    } catch (err) {
      console.log(`  ⚠️  Could not create mistake for ${question.id}: ${err.message}`);
    }
  }

  console.log('\n===============================================');
  console.log('✨ Sample mistakes seeded successfully!');
  console.log('===============================================\n');
  console.log(`Mistakes created: ${mistakesCreated}`);
  console.log(`  - Mastered: 3`);
  console.log(`  - Pending: ${mistakesCreated - 3}`);
  console.log(`Review schedule entries: ${reviewsCreated}`);
  console.log('\nYou can now test the Mistake Notebook!');
  console.log('  - View mistakes: GET /api/users/1/mistakes');
  console.log('  - View due reviews: GET /api/users/1/reviews/due');
  console.log('\n');

} catch (error) {
  console.error('❌ Error seeding mistakes:', error.message);
  process.exit(1);
} finally {
  db.close();
}
