/**
 * Streak Management Utilities
 * Helper functions for recording and managing user streaks
 */

const API_BASE = 'http://localhost:3001';

export interface StreakRecordResult {
  ok: boolean;
  streak: number;
  longestStreak: number;
  newBadges: Array<{
    id: string;
    name_bengali: string;
    icon: string;
  }>;
  leveledUp: boolean;
  newLevel: number;
}

/**
 * Record a practice session and update streak
 * Automatically awards XP and checks for badges
 */
export async function recordPracticeSession(
  userId: number,
  questionsCompleted: number,
  questionsCorrect: number
): Promise<StreakRecordResult> {
  // Calculate XP (10 XP per correct answer)
  const xpEarned = questionsCorrect * 10;

  // Add bonus XP for perfect scores
  const isPerfect = questionsCompleted === questionsCorrect && questionsCompleted > 0;
  const bonusXP = isPerfect ? Math.floor(questionsCompleted * 2) : 0;
  const totalXP = xpEarned + bonusXP;

  const response = await fetch(`${API_BASE}/api/users/${userId}/streak/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionsCompleted,
      questionsCorrect,
      xpEarned: totalXP,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to record practice session');
  }

  return response.json();
}

/**
 * Get current streak information for a user
 */
export async function getStreakInfo(userId: number) {
  const response = await fetch(`${API_BASE}/api/users/${userId}/streak`);

  if (!response.ok) {
    throw new Error('Failed to fetch streak info');
  }

  return response.json();
}

/**
 * Check if user has practiced today
 */
export async function hasPracticedToday(userId: number): Promise<boolean> {
  try {
    const streak = await getStreakInfo(userId);
    const today = new Date().toISOString().split('T')[0];
    return streak.lastPracticeDate === today;
  } catch {
    return false;
  }
}

/**
 * Get streak status message in Bengali
 */
export function getStreakMessage(streak: number, isActive: boolean): string {
  if (!isActive) {
    return 'স্ট্রীক বন্ধ হয়ে গেছে। আবার শুরু করুন!';
  }

  if (streak === 1) {
    return 'দুর্দান্ত শুরু! চালিয়ে যান!';
  }

  if (streak < 7) {
    return `চমৎকার! ${streak} দিনের স্ট্রীক!`;
  }

  if (streak < 30) {
    return `অসাধারণ! ${streak} দিনের স্ট্রীক! 🔥`;
  }

  if (streak < 100) {
    return `আশ্চর্যজনক! ${streak} দিনের স্ট্রীক! 🔥🔥`;
  }

  return `অবিশ্বাস্য! ${streak} দিনের স্ট্রীক! আপনি কিংবদন্তি! 🔥🔥🔥`;
}

/**
 * Calculate next streak milestone
 */
export function getNextMilestone(currentStreak: number): { milestone: number; message: string } {
  const milestones = [
    { value: 3, message: '৩ দিনের যোদ্ধা ব্যাজ পাবেন' },
    { value: 7, message: '৭ দিনের যোদ্ধা ব্যাজ পাবেন' },
    { value: 30, message: 'মাসব্যাপী যোদ্ধা ব্যাজ পাবেন' },
    { value: 100, message: 'শতদিনের কিংবদন্তি ব্যাজ পাবেন' },
  ];

  for (const milestone of milestones) {
    if (currentStreak < milestone.value) {
      return { milestone: milestone.value, message: milestone.message };
    }
  }

  return { milestone: currentStreak + 100, message: 'চালিয়ে যান!' };
}
