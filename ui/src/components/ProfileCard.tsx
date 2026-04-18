import { useEffect, useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';

interface UserStats {
  user: {
    id: number;
    username: string;
    displayName: string;
    classId: number;
    totalXp: number;
    currentLevel: number;
    levelName: string;
    streakCount: number;
    longestStreak: number;
  };
  stats: {
    badgesEarned: number;
    daysPracticed: number;
    totalQuestions: number;
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
  recentBadges: Array<{
    id: string;
    name_bengali: string;
    name_english: string;
    icon: string;
    earned_at: string;
  }>;
  recentActivity: Array<{
    practice_date: string;
    questions_completed: number;
    questions_correct: number;
    xp_earned: number;
  }>;
}

interface Props {
  userId: number;
  darkMode: boolean;
  compact?: boolean;
}

const API_BASE = 'http://localhost:3001';

export default function ProfileCard({ userId, darkMode, compact = false }: Props) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bg = darkMode ? '#16213e' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const borderColor = darkMode ? '#2d3748' : '#e2e8f0';
  const accentBg = darkMode ? '#1a365d' : '#ebf4ff';

  useEffect(() => {
    fetchUserStats();
  }, [userId]);

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/users/${userId}/stats`);
      if (!response.ok) throw new Error('Failed to fetch user stats');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: bg,
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center',
        color: text,
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
        <p>লোড হচ্ছে...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{
        background: bg,
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center',
        color: text,
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
        <p>তথ্য লোড করতে সমস্যা হয়েছে</p>
        <button
          onClick={fetchUserStats}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

  const { user, stats: userStats, progress, recentBadges } = stats;
  const xpPercentage = progress.xpProgress
    ? (progress.xpProgress.current / progress.xpProgress.required) * 100
    : 0;

  if (compact) {
    return (
      <div style={{
        background: bg,
        borderRadius: '0.75rem',
        padding: '1rem',
        border: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: 'white',
        }}>
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: text, fontWeight: '600' }}>
            {user.displayName}
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: subText }}>
            লেভেল {toBengaliNumber(user.currentLevel)} • {user.levelName} • {toBengaliNumber(user.totalXp)} XP
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: accentBg,
          borderRadius: '0.5rem',
        }}>
          <span style={{ fontSize: '1.25rem' }}>🔥</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f97316' }}>
            {toBengaliNumber(user.streakCount)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: bg,
      borderRadius: '1rem',
      padding: '2rem',
      border: `1px solid ${borderColor}`,
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          fontWeight: 'bold',
          color: 'white',
        }}>
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.75rem', color: text, fontWeight: '700' }}>
            {user.displayName}
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', color: subText }}>
            @{user.username}
          </p>
        </div>
      </div>

      {/* Level Progress */}
      <div style={{
        background: accentBg,
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>{progress.nextLevel?.icon || '🏆'}</span>
            <span style={{ fontSize: '1.1rem', fontWeight: '600', color: text }}>
              লেভেল {toBengaliNumber(user.currentLevel)} - {user.levelName}
            </span>
          </div>
          <span style={{ fontSize: '0.875rem', color: subText }}>
            {toBengaliNumber(user.totalXp)} XP
          </span>
        </div>
        {progress.xpProgress && (
          <>
            <div style={{
              width: '100%',
              height: '8px',
              background: darkMode ? '#2d3748' : '#cbd5e0',
              borderRadius: '999px',
              overflow: 'hidden',
              marginBottom: '0.5rem',
            }}>
              <div style={{
                width: `${Math.min(xpPercentage, 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: subText, textAlign: 'center' }}>
              {toBengaliNumber(progress.xpProgress.current)} / {toBengaliNumber(progress.xpProgress.required)} XP পরবর্তী লেভেলের জন্য
            </p>
          </>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <StatCard
          icon="🔥"
          label="স্ট্রীক"
          value={toBengaliNumber(user.streakCount)}
          darkMode={darkMode}
          accent="#f97316"
        />
        <StatCard
          icon="🏆"
          label="সর্বোচ্চ স্ট্রীক"
          value={toBengaliNumber(user.longestStreak)}
          darkMode={darkMode}
          accent="#eab308"
        />
        <StatCard
          icon="🎖️"
          label="ব্যাজ"
          value={toBengaliNumber(userStats.badgesEarned)}
          darkMode={darkMode}
          accent="#8b5cf6"
        />
        <StatCard
          icon="📊"
          label="মোট প্রশ্ন"
          value={toBengaliNumber(userStats.totalQuestions || 0)}
          darkMode={darkMode}
          accent="#06b6d4"
        />
      </div>

      {/* Recent Badges */}
      {recentBadges.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1rem', color: text, fontWeight: '600', marginBottom: '0.75rem' }}>
            সাম্প্রতিক ব্যাজ
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {recentBadges.map((badge) => (
              <div
                key={badge.id}
                title={badge.name_bengali}
                style={{
                  padding: '0.75rem',
                  background: accentBg,
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  border: `1px solid ${borderColor}`,
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{badge.icon}</span>
                <span style={{ fontSize: '0.875rem', color: text }}>{badge.name_bengali}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  darkMode,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  darkMode: boolean;
  accent: string;
}) {
  const bg = darkMode ? '#1a365d' : '#f7fafc';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div style={{
      background: bg,
      borderRadius: '0.75rem',
      padding: '1rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: '700', color: accent, marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.875rem', color: subText }}>{label}</div>
    </div>
  );
}
