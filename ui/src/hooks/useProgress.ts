import { useState, useEffect } from 'react';

interface ProgressStats {
  streak: number;
  points: number;
  dailyProgress: number;
  lessonsCompleted: number;
}

export function useProgress() {
  const [stats, setStats] = useState<ProgressStats>({
    streak: 7,
    points: 248,
    dailyProgress: 3,
    lessonsCompleted: 12,
  });

  useEffect(() => {
    const storedStreak = localStorage.getItem('userStreak');
    const storedPoints = localStorage.getItem('userPoints');
    const storedDaily = localStorage.getItem('dailyProgress');
    const storedLessons = localStorage.getItem('lessonsCompleted');

    setStats({
      streak: storedStreak ? parseInt(storedStreak) : 7,
      points: storedPoints ? parseInt(storedPoints) : 248,
      dailyProgress: storedDaily ? parseInt(storedDaily) : 3,
      lessonsCompleted: storedLessons ? parseInt(storedLessons) : 12,
    });

    const lastVisit = localStorage.getItem('lastVisitDate');
    const today = new Date().toDateString();

    if (lastVisit !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastVisit === yesterday.toDateString()) {
        updateStreak(stats.streak + 1);
      } else if (lastVisit !== today) {
        updateStreak(1);
      }

      localStorage.setItem('lastVisitDate', today);
      localStorage.setItem('dailyProgress', '0');
      setStats(prev => ({ ...prev, dailyProgress: 0 }));
    }
  }, []);

  const updateStreak = (newStreak: number) => {
    localStorage.setItem('userStreak', String(newStreak));
    setStats(prev => ({ ...prev, streak: newStreak }));
  };

  const updatePoints = (pointsToAdd: number) => {
    const newPoints = stats.points + pointsToAdd;
    localStorage.setItem('userPoints', String(newPoints));
    setStats(prev => ({ ...prev, points: newPoints }));
  };

  const incrementDailyProgress = () => {
    if (stats.dailyProgress < 5) {
      const newProgress = stats.dailyProgress + 1;
      localStorage.setItem('dailyProgress', String(newProgress));
      setStats(prev => ({ ...prev, dailyProgress: newProgress }));
      updatePoints(10);
    }
  };

  const completeLesson = () => {
    const newLessons = stats.lessonsCompleted + 1;
    localStorage.setItem('lessonsCompleted', String(newLessons));
    setStats(prev => ({ ...prev, lessonsCompleted: newLessons }));
    incrementDailyProgress();
    updatePoints(20);
  };

  return {
    stats,
    updateStreak,
    updatePoints,
    incrementDailyProgress,
    completeLesson,
  };
}
