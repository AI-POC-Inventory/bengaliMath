/**
 * XP (Experience Points) Management Utilities
 * Helper functions for calculating, formatting, and managing user XP
 */

const API_BASE = 'http://localhost:3001';

// XP calculation constants
export const XP_PER_CORRECT_ANSWER = 10;
export const XP_PERFECT_BONUS_MULTIPLIER = 2;
export const XP_STREAK_BONUS_PERCENTAGE = 0.1; // 10% bonus per day
export const XP_FIRST_TRY_BONUS = 5;

/**
 * Level definitions (from database)
 */
export const LEVELS = [
  { level: 1, nameBengali: 'শিক্ষার্থী', nameEnglish: 'Learner', xpRequired: 0, icon: '🌱' },
  { level: 2, nameBengali: 'উদ্যমী', nameEnglish: 'Enthusiast', xpRequired: 100, icon: '🌿' },
  { level: 3, nameBengali: 'চর্চাকারী', nameEnglish: 'Practitioner', xpRequired: 300, icon: '🌾' },
  { level: 4, nameBengali: 'দক্ষ', nameEnglish: 'Skilled', xpRequired: 600, icon: '🌳' },
  { level: 5, nameBengali: 'পারদর্শী', nameEnglish: 'Proficient', xpRequired: 1000, icon: '🎯' },
  { level: 6, nameBengali: 'বিশেষজ্ঞ', nameEnglish: 'Expert', xpRequired: 1500, icon: '⭐' },
  { level: 7, nameBengali: 'পণ্ডিত', nameEnglish: 'Scholar', xpRequired: 2100, icon: '📚' },
  { level: 8, nameBengali: 'গণিতবিদ', nameEnglish: 'Mathematician', xpRequired: 2800, icon: '🏆' },
  { level: 9, nameBengali: 'মহাগণিতবিদ', nameEnglish: 'Grand Master', xpRequired: 3600, icon: '👑' },
  { level: 10, nameBengali: 'কিংবদন্তি', nameEnglish: 'Legend', xpRequired: 5000, icon: '💎' },
];

/**
 * Calculate XP for a practice session
 */
export function calculateSessionXP(params: {
  questionsCompleted: number;
  questionsCorrect: number;
  isPerfect?: boolean;
  isFirstTry?: boolean;
  currentStreak?: number;
}): {
  baseXP: number;
  perfectBonus: number;
  firstTryBonus: number;
  streakBonus: number;
  totalXP: number;
  breakdown: Array<{ label: string; amount: number }>;
} {
  const { questionsCompleted, questionsCorrect, isPerfect, isFirstTry, currentStreak = 0 } = params;

  // Base XP
  const baseXP = questionsCorrect * XP_PER_CORRECT_ANSWER;

  // Perfect score bonus
  const perfectBonus =
    isPerfect && questionsCompleted > 0 ? questionsCompleted * XP_PERFECT_BONUS_MULTIPLIER : 0;

  // First try bonus (all questions correct on first attempt)
  const firstTryBonus = isFirstTry && isPerfect ? XP_FIRST_TRY_BONUS * questionsCompleted : 0;

  // Streak bonus (bonus based on current streak)
  const streakMultiplier = Math.min(currentStreak * XP_STREAK_BONUS_PERCENTAGE, 0.5); // Max 50% bonus
  const streakBonus = Math.floor((baseXP + perfectBonus) * streakMultiplier);

  const totalXP = baseXP + perfectBonus + firstTryBonus + streakBonus;

  const breakdown = [
    { label: 'সঠিক উত্তর', amount: baseXP },
    ...(perfectBonus > 0 ? [{ label: 'নিখুঁত স্কোর', amount: perfectBonus }] : []),
    ...(firstTryBonus > 0 ? [{ label: 'প্রথম চেষ্টা', amount: firstTryBonus }] : []),
    ...(streakBonus > 0 ? [{ label: 'স্ট্রীক বোনাস', amount: streakBonus }] : []),
  ];

  return {
    baseXP,
    perfectBonus,
    firstTryBonus,
    streakBonus,
    totalXP,
    breakdown,
  };
}

/**
 * Get level info for a given XP amount
 */
export function getLevelForXP(xp: number): {
  level: number;
  name: string;
  icon: string;
} {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) {
      return {
        level: LEVELS[i].level,
        name: LEVELS[i].nameBengali,
        icon: LEVELS[i].icon,
      };
    }
  }

  return {
    level: 1,
    name: LEVELS[0].nameBengali,
    icon: LEVELS[0].icon,
  };
}

/**
 * Get progress to next level
 */
export function getProgressToNextLevel(currentXP: number): {
  currentLevel: number;
  currentLevelName: string;
  nextLevel: number | null;
  nextLevelName: string | null;
  nextLevelIcon: string | null;
  xpInCurrentLevel: number;
  xpRequiredForNext: number | null;
  percentageComplete: number;
  isMaxLevel: boolean;
} {
  const currentLevel = getLevelForXP(currentXP);
  const currentLevelIndex = LEVELS.findIndex((l) => l.level === currentLevel.level);
  const nextLevelData = LEVELS[currentLevelIndex + 1];

  const currentLevelXP = LEVELS[currentLevelIndex].xpRequired;
  const xpInCurrentLevel = currentXP - currentLevelXP;

  if (!nextLevelData) {
    // Max level reached
    return {
      currentLevel: currentLevel.level,
      currentLevelName: currentLevel.name,
      nextLevel: null,
      nextLevelName: null,
      nextLevelIcon: null,
      xpInCurrentLevel,
      xpRequiredForNext: null,
      percentageComplete: 100,
      isMaxLevel: true,
    };
  }

  const xpRequiredForNext = nextLevelData.xpRequired - currentLevelXP;
  const percentageComplete = Math.min((xpInCurrentLevel / xpRequiredForNext) * 100, 100);

  return {
    currentLevel: currentLevel.level,
    currentLevelName: currentLevel.name,
    nextLevel: nextLevelData.level,
    nextLevelName: nextLevelData.nameBengali,
    nextLevelIcon: nextLevelData.icon,
    xpInCurrentLevel,
    xpRequiredForNext,
    percentageComplete,
    isMaxLevel: false,
  };
}

/**
 * Check if XP gain will result in level up
 */
export function willLevelUp(currentXP: number, xpToAdd: number): {
  willLevelUp: boolean;
  oldLevel: number;
  newLevel: number | null;
  levelsGained: number;
} {
  const oldLevel = getLevelForXP(currentXP).level;
  const newLevel = getLevelForXP(currentXP + xpToAdd).level;

  return {
    willLevelUp: newLevel > oldLevel,
    oldLevel,
    newLevel: newLevel > oldLevel ? newLevel : null,
    levelsGained: newLevel - oldLevel,
  };
}

/**
 * Format XP amount with K/M suffix
 */
export function formatXP(xp: number): string {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M`;
  }
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toString();
}

/**
 * Get XP gain reason in Bengali
 */
export function getXPReasonText(reason: string): string {
  const reasons: Record<string, string> = {
    question_correct: 'সঠিক উত্তর',
    perfect_score: 'নিখুঁত স্কোর',
    first_try: 'প্রথম চেষ্টা',
    streak_bonus: 'স্ট্রীক বোনাস',
    practice_session: 'অনুশীলন',
    daily_puzzle: 'দৈনিক ধাঁধা',
    challenge_complete: 'চ্যালেঞ্জ সম্পূর্ণ',
  };

  return reasons[reason] || reason;
}

/**
 * Get motivational message based on XP progress
 */
export function getXPMotivationMessage(progress: number): string {
  if (progress >= 90) {
    return 'প্রায় পৌঁছে গেছেন! 🎯';
  }
  if (progress >= 75) {
    return 'দারুণ অগ্রগতি! 🌟';
  }
  if (progress >= 50) {
    return 'অর্ধেক পথ পার হয়েছে! 💪';
  }
  if (progress >= 25) {
    return 'চমৎকার শুরু! ✨';
  }
  return 'চালিয়ে যান! 🚀';
}

/**
 * Estimate time to next level (based on average daily XP)
 */
export function estimateTimeToNextLevel(params: {
  currentXP: number;
  averageDailyXP: number;
}): {
  days: number;
  message: string;
} | null {
  const { currentXP, averageDailyXP } = params;
  const progress = getProgressToNextLevel(currentXP);

  if (progress.isMaxLevel || !progress.xpRequiredForNext || averageDailyXP === 0) {
    return null;
  }

  const xpRemaining = progress.xpRequiredForNext - progress.xpInCurrentLevel;
  const daysEstimated = Math.ceil(xpRemaining / averageDailyXP);

  let message = '';
  if (daysEstimated === 0) {
    message = 'আজই পৌঁছে যাবেন!';
  } else if (daysEstimated === 1) {
    message = 'কাল পৌঁছে যাবেন!';
  } else if (daysEstimated <= 7) {
    message = `আরও ${daysEstimated} দিনে পৌঁছবেন`;
  } else if (daysEstimated <= 30) {
    message = `প্রায় ${Math.ceil(daysEstimated / 7)} সপ্তাহ বাকি`;
  } else {
    message = `প্রায় ${Math.ceil(daysEstimated / 30)} মাস বাকি`;
  }

  return { days: daysEstimated, message };
}

/**
 * Get all level milestones
 */
export function getAllLevelMilestones() {
  return LEVELS.map((level) => ({
    level: level.level,
    name: level.nameBengali,
    nameEnglish: level.nameEnglish,
    xpRequired: level.xpRequired,
    icon: level.icon,
  }));
}

/**
 * Calculate XP needed to reach a specific level
 */
export function getXPNeededForLevel(targetLevel: number, currentXP: number): number {
  const levelData = LEVELS.find((l) => l.level === targetLevel);
  if (!levelData) return 0;

  return Math.max(0, levelData.xpRequired - currentXP);
}
