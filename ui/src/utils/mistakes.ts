/**
 * Mistake Tracking Utilities
 * Helper functions for recording and managing user mistakes
 */

const API_BASE = 'http://localhost:3001';

export interface MistakeRecord {
  questionId: string;
  topicId: string;
  chapterId: string;
}

export interface MistakeStats {
  total: number;
  mastered: number;
  pending: number;
  avgAttempts: number;
}

/**
 * Record a mistake when user answers incorrectly
 */
export async function recordMistake(
  userId: number,
  mistake: MistakeRecord
): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/api/users/${userId}/mistakes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mistake),
  });

  if (!response.ok) {
    throw new Error('Failed to record mistake');
  }

  return response.json();
}

/**
 * Mark a mistake as mastered
 */
export async function markMistakeMastered(
  userId: number,
  questionId: string
): Promise<{ ok: boolean; nextReviewInterval?: number }> {
  const response = await fetch(
    `${API_BASE}/api/users/${userId}/mistakes/${questionId}/master`,
    {
      method: 'PUT',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to mark mistake as mastered');
  }

  return response.json();
}

/**
 * Get all mistakes for a user
 */
export async function getMistakes(
  userId: number,
  filters?: {
    topicId?: string;
    chapterId?: string;
    masteredOnly?: boolean;
  }
) {
  const params = new URLSearchParams();
  if (filters?.topicId) params.append('topicId', filters.topicId);
  if (filters?.chapterId) params.append('chapterId', filters.chapterId);
  if (filters?.masteredOnly !== undefined) {
    params.append('masteredOnly', String(filters.masteredOnly));
  }

  const response = await fetch(
    `${API_BASE}/api/users/${userId}/mistakes?${params}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch mistakes');
  }

  return response.json();
}

/**
 * Get due reviews (spaced repetition)
 */
export async function getDueReviews(userId: number) {
  const response = await fetch(`${API_BASE}/api/users/${userId}/reviews/due`);

  if (!response.ok) {
    throw new Error('Failed to fetch due reviews');
  }

  return response.json();
}

/**
 * Check if a specific question is a known mistake
 */
export async function isKnownMistake(
  userId: number,
  questionId: string
): Promise<boolean> {
  try {
    const data = await getMistakes(userId);
    return data.mistakes.some(
      (m: any) => m.questionId === questionId && !m.mastered
    );
  } catch {
    return false;
  }
}

/**
 * Get mistake rate for a specific topic
 */
export async function getTopicMistakeRate(
  userId: number,
  topicId: string
): Promise<{
  mistakeCount: number;
  masteredCount: number;
  pendingCount: number;
}> {
  try {
    const data = await getMistakes(userId, { topicId });
    return {
      mistakeCount: data.stats.total,
      masteredCount: data.stats.mastered,
      pendingCount: data.stats.pending,
    };
  } catch {
    return { mistakeCount: 0, masteredCount: 0, pendingCount: 0 };
  }
}

/**
 * Get most problematic topics (highest mistake rate)
 */
export async function getProblematicTopics(
  userId: number,
  limit: number = 5
): Promise<
  Array<{
    topicId: string;
    topicName: string;
    mistakeCount: number;
    pending: number;
  }>
> {
  try {
    const data = await getMistakes(userId);
    return data.byTopic.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Calculate learning progress based on mistakes
 */
export function calculateLearningProgress(stats: MistakeStats): {
  totalMistakes: number;
  masteryRate: number;
  improvementNeeded: number;
  progressLevel: 'beginner' | 'learning' | 'proficient' | 'expert';
} {
  const totalMistakes = stats.total;
  const masteryRate = totalMistakes > 0 ? (stats.mastered / totalMistakes) * 100 : 0;
  const improvementNeeded = stats.pending;

  let progressLevel: 'beginner' | 'learning' | 'proficient' | 'expert';
  if (masteryRate >= 90) {
    progressLevel = 'expert';
  } else if (masteryRate >= 70) {
    progressLevel = 'proficient';
  } else if (masteryRate >= 40) {
    progressLevel = 'learning';
  } else {
    progressLevel = 'beginner';
  }

  return {
    totalMistakes,
    masteryRate,
    improvementNeeded,
    progressLevel,
  };
}

/**
 * Get Bengali message for learning progress
 */
export function getProgressMessage(
  progressLevel: 'beginner' | 'learning' | 'proficient' | 'expert'
): string {
  const messages = {
    beginner: 'শুরু করছেন! চালিয়ে যান এবং ভুলগুলি পর্যালোচনা করুন।',
    learning: 'চমৎকার অগ্রগতি! আরও অনুশীলন করুন।',
    proficient: 'দুর্দান্ত! আপনি ভালো করছেন।',
    expert: 'অসাধারণ! আপনি বিশেষজ্ঞ হয়ে উঠছেন! 🏆',
  };

  return messages[progressLevel];
}

/**
 * Estimate time to master all pending mistakes
 */
export function estimateTimeToMaster(
  pendingCount: number,
  dailyReviewRate: number = 5
): {
  days: number;
  message: string;
} {
  if (pendingCount === 0) {
    return { days: 0, message: 'সব ভুল আয়ত্ত করেছেন!' };
  }

  if (dailyReviewRate === 0) {
    return { days: 0, message: 'নিয়মিত পর্যালোচনা শুরু করুন' };
  }

  const days = Math.ceil(pendingCount / dailyReviewRate);

  let message = '';
  if (days === 1) {
    message = 'আজই সম্পূর্ণ হবে!';
  } else if (days <= 7) {
    message = `প্রায় ${days} দিনে সম্পূর্ণ হবে`;
  } else if (days <= 30) {
    message = `প্রায় ${Math.ceil(days / 7)} সপ্তাহে সম্পূর্ণ হবে`;
  } else {
    message = `প্রায় ${Math.ceil(days / 30)} মাসে সম্পূর্ণ হবে`;
  }

  return { days, message };
}

/**
 * Get recommendation for what to review next
 */
export async function getReviewRecommendation(
  userId: number
): Promise<{
  dueCount: number;
  oldestMistakes: number;
  hardestTopic: string | null;
  recommendation: string;
}> {
  try {
    const [dueData, mistakesData] = await Promise.all([
      getDueReviews(userId),
      getMistakes(userId, { masteredOnly: false }),
    ]);

    const dueCount = dueData.dueCount;
    const oldestMistakes = mistakesData.mistakes
      .filter((m: any) => !m.mastered)
      .sort(
        (a: any, b: any) =>
          new Date(a.firstAttemptDate).getTime() -
          new Date(b.firstAttemptDate).getTime()
      )
      .slice(0, 5).length;

    const hardestTopic =
      mistakesData.byTopic.length > 0
        ? mistakesData.byTopic[0].topicName
        : null;

    let recommendation = '';
    if (dueCount > 0) {
      recommendation = `আজ ${dueCount}টি প্রশ্ন পর্যালোচনা করার সময় এসেছে।`;
    } else if (oldestMistakes > 0) {
      recommendation = `পুরানো ভুলগুলি পর্যালোচনা করুন।`;
    } else if (hardestTopic) {
      recommendation = `"${hardestTopic}" বিষয়ে ফোকাস করুন।`;
    } else {
      recommendation = 'চমৎকার! সব ভুল আয়ত্ত করেছেন।';
    }

    return {
      dueCount,
      oldestMistakes,
      hardestTopic,
      recommendation,
    };
  } catch {
    return {
      dueCount: 0,
      oldestMistakes: 0,
      hardestTopic: null,
      recommendation: 'তথ্য লোড করতে সমস্যা হয়েছে',
    };
  }
}
