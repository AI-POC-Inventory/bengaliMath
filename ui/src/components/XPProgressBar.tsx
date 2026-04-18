import { useEffect, useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';

interface XPProgressData {
  user: {
    totalXp: number;
    currentLevel: number;
    levelName: string;
  };
  progress: {
    nextLevel: {
      level: number;
      name: string;
      icon: string;
    } | null;
    xpProgress: {
      current: number;
      required: number;
    } | null;
  };
}

interface Props {
  userId: number;
  darkMode: boolean;
  compact?: boolean;
  showDetails?: boolean;
  onLevelUp?: (newLevel: number) => void;
}

const API_BASE = 'http://localhost:3001';

export default function XPProgressBar({
  userId,
  darkMode,
  compact = false,
  showDetails = true,
  onLevelUp,
}: Props) {
  const [data, setData] = useState<XPProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animateProgress, setAnimateProgress] = useState(false);
  const [previousLevel, setPreviousLevel] = useState<number | null>(null);

  const bg = darkMode ? '#16213e' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const borderColor = darkMode ? '#2d3748' : '#e2e8f0';
  const progressBg = darkMode ? '#2d3748' : '#e2e8f0';

  useEffect(() => {
    fetchXPProgress();

    // Refresh every 30 seconds
    const interval = setInterval(fetchXPProgress, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (data && previousLevel && data.user.currentLevel > previousLevel) {
      onLevelUp?.(data.user.currentLevel);
    }
  }, [data?.user.currentLevel]);

  const fetchXPProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/users/${userId}/stats`);
      if (!response.ok) throw new Error('Failed to fetch XP progress');
      const stats = await response.json();

      if (data) {
        setPreviousLevel(data.user.currentLevel);
      }

      setData(stats);
      setError(null);

      // Trigger progress animation
      setAnimateProgress(true);
      setTimeout(() => setAnimateProgress(false), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{
        background: bg,
        borderRadius: compact ? '0.5rem' : '0.75rem',
        padding: compact ? '0.75rem' : '1rem',
        textAlign: 'center',
        color: subText,
        fontSize: '0.875rem',
      }}>
        লোড হচ্ছে...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        background: bg,
        borderRadius: compact ? '0.5rem' : '0.75rem',
        padding: compact ? '0.75rem' : '1rem',
        textAlign: 'center',
        color: subText,
        fontSize: '0.875rem',
      }}>
        XP লোড করতে সমস্যা
      </div>
    );
  }

  const { user, progress } = data;
  const percentage = progress.xpProgress
    ? Math.min((progress.xpProgress.current / progress.xpProgress.required) * 100, 100)
    : 100;

  // Compact mode - minimal display
  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: bg,
        borderRadius: '0.5rem',
        padding: '0.5rem 0.75rem',
        border: `1px solid ${borderColor}`,
      }}>
        <div style={{
          fontSize: '1.25rem',
          lineHeight: 1,
        }}>
          {progress.nextLevel?.icon || '⭐'}
        </div>
        <div style={{ flex: 1, minWidth: '100px' }}>
          <div style={{
            fontSize: '0.75rem',
            color: subText,
            marginBottom: '0.25rem',
          }}>
            লেভেল {toBengaliNumber(user.currentLevel)}
          </div>
          <div style={{
            width: '100%',
            height: '6px',
            background: progressBg,
            borderRadius: '999px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              transition: animateProgress ? 'width 0.5s ease-out' : 'none',
              borderRadius: '999px',
            }} />
          </div>
        </div>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#8b5cf6',
        }}>
          {toBengaliNumber(user.totalXp)}
        </div>
      </div>
    );
  }

  // Full display mode
  return (
    <div style={{
      background: bg,
      borderRadius: '0.75rem',
      padding: '1.5rem',
      border: `1px solid ${borderColor}`,
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem', lineHeight: 1 }}>
            {progress.nextLevel?.icon || '👑'}
          </span>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: text }}>
              লেভেল {toBengaliNumber(user.currentLevel)}
            </div>
            <div style={{ fontSize: '0.875rem', color: subText }}>
              {user.levelName}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
            {toBengaliNumber(user.totalXp)}
          </div>
          <div style={{ fontSize: '0.75rem', color: subText }}>
            মোট XP
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: showDetails ? '1rem' : 0 }}>
        <div style={{
          width: '100%',
          height: '12px',
          background: progressBg,
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            transition: animateProgress ? 'width 0.5s ease-out' : 'width 0.3s ease',
            borderRadius: '999px',
            position: 'relative',
          }}>
            {/* Shine effect */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%)',
              borderRadius: '999px',
            }} />
          </div>
        </div>

        {progress.xpProgress && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '0.5rem',
            fontSize: '0.875rem',
            color: subText,
          }}>
            <span>
              {toBengaliNumber(progress.xpProgress.current)} XP
            </span>
            <span>
              {toBengaliNumber(progress.xpProgress.required)} XP
            </span>
          </div>
        )}
      </div>

      {/* Next Level Info */}
      {showDetails && progress.nextLevel && progress.xpProgress && (
        <div style={{
          background: darkMode ? '#1a365d' : '#f0f4ff',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>{progress.nextLevel.icon}</span>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: text }}>
                পরবর্তী: লেভেল {toBengaliNumber(progress.nextLevel.level)}
              </div>
              <div style={{ fontSize: '0.75rem', color: subText }}>
                {progress.nextLevel.name}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#667eea' }}>
              {toBengaliNumber(progress.xpProgress.required - progress.xpProgress.current)}
            </div>
            <div style={{ fontSize: '0.75rem', color: subText }}>
              XP বাকি
            </div>
          </div>
        </div>
      )}

      {/* Max Level Reached */}
      {!progress.nextLevel && (
        <div style={{
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          textAlign: 'center',
          color: '#78350f',
          fontWeight: '600',
        }}>
          🏆 সর্বোচ্চ লেভেল পৌঁছেছেন! 🏆
        </div>
      )}
    </div>
  );
}

// Export a hook for easy XP updates
export function useXPProgress(userId: number) {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);

  const fetchProgress = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users/${userId}/stats`);
      const stats = await response.json();
      setXp(stats.user.totalXp);
      setLevel(stats.user.currentLevel);
    } catch (error) {
      console.error('Failed to fetch XP progress:', error);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [userId]);

  return { xp, level, refresh: fetchProgress };
}
