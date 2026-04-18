/**
 * Seed Test Data for User Profile System
 * Adds sample XP, streaks, and badges to demonstrate the gamification features
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'bengali_curriculam.db');

console.log('🌱 Seeding test data for User Profile System');
console.log('==============================================\n');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

try {
  // Get the test user (should be ID 1)
  const user = db.prepare('SELECT * FROM users WHERE id = 1').get();

  if (!user) {
    console.log('❌ No user found! Please create a user first.');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.username} (${user.display_name})\n`);

  // Add some daily streaks (last 7 days)
  console.log('📊 Adding daily streak data...');
  const today = new Date();
  const streakData = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const questionsCompleted = 10 + Math.floor(Math.random() * 10);
    const questionsCorrect = Math.floor(questionsCompleted * (0.7 + Math.random() * 0.2));
    const xpEarned = questionsCorrect * 10;

    streakData.push({
      date: dateStr,
      completed: questionsCompleted,
      correct: questionsCorrect,
      xp: xpEarned,
    });

    db.prepare(`
      INSERT OR REPLACE INTO daily_streaks
        (user_id, practice_date, questions_completed, questions_correct, xp_earned, session_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, dateStr, questionsCompleted, questionsCorrect, xpEarned, 1);

    console.log(`  ${dateStr}: ${questionsCompleted} questions, ${questionsCorrect} correct, ${xpEarned} XP`);
  }

  // Calculate total XP
  const totalXp = streakData.reduce((sum, day) => sum + day.xp, 0);

  // Determine level based on XP
  const level = db.prepare('SELECT level FROM levels WHERE xp_required <= ? ORDER BY level DESC LIMIT 1').get(totalXp);
  const currentLevel = level ? level.level : 1;

  // Update user with XP, level, and streak
  db.prepare(`
    UPDATE users
    SET total_xp = ?,
        current_level = ?,
        streak_count = 7,
        longest_streak = 7,
        last_practice_date = ?
    WHERE id = ?
  `).run(totalXp, currentLevel, streakData[streakData.length - 1].date, user.id);

  console.log(`\n✅ Updated user: Total XP = ${totalXp}, Level = ${currentLevel}, Streak = 7 days\n`);

  // Add XP transactions
  console.log('💰 Adding XP transactions...');
  for (const day of streakData) {
    db.prepare(`
      INSERT INTO xp_transactions (user_id, amount, reason, created_at)
      VALUES (?, ?, ?, ?)
    `).run(user.id, day.xp, 'question_correct', day.date);
  }
  console.log(`  Added ${streakData.length} XP transactions\n`);

  // Award some badges
  console.log('🏆 Awarding badges...');
  const badgesToAward = ['streak_3', 'streak_7', 'questions_50'];

  for (const badgeId of badgesToAward) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO user_badges (user_id, badge_id, earned_at)
        VALUES (?, ?, datetime('now'))
      `).run(user.id, badgeId);

      const badge = db.prepare('SELECT name_bengali, icon FROM badges WHERE id = ?').get(badgeId);
      if (badge) {
        console.log(`  ${badge.icon} ${badge.name_bengali}`);
      }
    } catch (err) {
      console.log(`  ⚠️  Could not award badge: ${badgeId}`);
    }
  }

  console.log('\n==============================================');
  console.log('✨ Test data seeded successfully!');
  console.log('==============================================\n');
  console.log('You can now test the user profile system with:');
  console.log('  User ID: 1');
  console.log(`  Total XP: ${totalXp}`);
  console.log(`  Level: ${currentLevel}`);
  console.log('  Streak: 7 days');
  console.log(`  Badges: ${badgesToAward.length}`);
  console.log('\n');

} catch (error) {
  console.error('❌ Error seeding data:', error.message);
  process.exit(1);
} finally {
  db.close();
}
