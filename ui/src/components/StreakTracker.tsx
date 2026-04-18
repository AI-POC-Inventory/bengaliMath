import { useEffect, useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  isActive: boolean;
  recentActivity: Array<{
    date: string;
    questionsCompleted: number;
    questionsCorrect: number;
    xpEarned: number;
    sessionCount: number;
  }>;
}

interface Props {
  userId: number;
  darkMode: boolean;
  compact?: boolean;
}

const API_BASE = 'http://localhost:3001';

const BENGALI_DAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
const BENGALI_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export default function StreakTracker({ userId, darkMode, compact = false }: Props) {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bg = darkMode ? '#16213e' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const borderColor = darkMode ? '#2d3748' : '#e2e8f0';
  const activeBg = darkMode ? '#1a365d' : '#ebf4ff';

  useEffect(() => {
    fetchStreak();
  }, [userId]);

  const fetchStreak = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/users/${userId}/streak`);
      if (!response.ok) throw new Error('Failed to fetch streak');
      const streakData = await response.json();
      setData(streakData);
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

  if (error || !data) {
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
      </div>
    );
  }

  // Generate calendar grid for last 30 days
  const generateCalendar = () => {
    const calendar = [];
    const today = new Date();
    const activityMap = new Map(
      data.recentActivity.map(day => [day.date, day])
    );

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const activity = activityMap.get(dateStr);

      calendar.push({
        date: dateStr,
        day: date.getDate(),
        dayOfWeek: BENGALI_DAYS[date.getDay()],
        hasActivity: !!activity,
        activity,
        isToday: dateStr === today.toISOString().split('T')[0],
      });
    }

    return calendar;
  };

  const calendar = generateCalendar();

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
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: data.isActive ? '#fef3c7' : '#fee2e2',
          borderRadius: '0.5rem',
        }}>
          <span style={{ fontSize: '1.5rem' }}>{data.isActive ? '🔥' : '💤'}</span>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: data.isActive ? '#f97316' : '#ef4444' }}>
              {toBengaliNumber(data.currentStreak)}
            </div>
            <div style={{ fontSize: '0.75rem', color: subText }}>দিন</div>
          </div>
        </div>
        <div style={{ flex: 1, color: text }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
            {data.isActive ? 'স্ট্রীক চালু আছে!' : 'স্ট্রীক বন্ধ'}
          </div>
          <div style={{ fontSize: '0.75rem', color: subText }}>
            সর্বোচ্চ: {toBengaliNumber(data.longestStreak)} দিন
          </div>
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
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '3rem' }}>{data.isActive ? '🔥' : '💤'}</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: text }}>
              দৈনিক স্ট্রীক
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', color: subText }}>
              {data.isActive ? 'চমৎকার! চালিয়ে যান!' : 'আবার শুরু করুন!'}
            </p>
          </div>
        </div>

        {/* Streak Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
        }}>
          <div style={{
            background: activeBg,
            borderRadius: '0.75rem',
            padding: '1.25rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: data.isActive ? '#f97316' : '#64748b' }}>
              {toBengaliNumber(data.currentStreak)}
            </div>
            <div style={{ fontSize: '0.875rem', color: subText, marginTop: '0.5rem' }}>
              বর্তমান স্ট্রীক
            </div>
          </div>
          <div style={{
            background: activeBg,
            borderRadius: '0.75rem',
            padding: '1.25rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#eab308' }}>
              {toBengaliNumber(data.longestStreak)}
            </div>
            <div style={{ fontSize: '0.875rem', color: subText, marginTop: '0.5rem' }}>
              সর্বোচ্চ স্ট্রীক
            </div>
          </div>
        </div>
      </div>

      {/* Motivation Message */}
      {!data.isActive && data.lastPracticeDate && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#78350f',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>💡</span>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                আজ অনুশীলন করুন!
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                স্ট্রীক বজায় রাখতে প্রতিদিন অনুশীলন করুন
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: text, marginBottom: '1rem' }}>
          গত ৩০ দিনের কার্যকলাপ
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.5rem',
        }}>
          {calendar.map((day, index) => (
            <CalendarDay
              key={day.date}
              day={day.day}
              dayOfWeek={day.dayOfWeek}
              hasActivity={day.hasActivity}
              isToday={day.isToday}
              activity={day.activity}
              darkMode={darkMode}
              showLabel={index % 7 === 0}
            />
          ))}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          marginTop: '1.5rem',
          fontSize: '0.75rem',
          color: subText,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              background: darkMode ? '#2d3748' : '#e2e8f0',
            }} />
            <span>অনুশীলন নেই</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              background: '#86efac',
            }} />
            <span>অনুশীলন করেছেন</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              background: '#4ade80',
              border: '2px solid #22c55e',
            }} />
            <span>আজ</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Stats */}
      {data.recentActivity.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', color: text, marginBottom: '0.75rem' }}>
            সাম্প্রতিক কার্যকলাপ
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.recentActivity.slice(0, 5).map((activity) => {
              const date = new Date(activity.date);
              const accuracy = Math.round((activity.questionsCorrect / activity.questionsCompleted) * 100);

              return (
                <div
                  key={activity.date}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: activeBg,
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <div style={{ color: text }}>
                    <span style={{ fontWeight: '600' }}>
                      {toBengaliNumber(date.getDate())} {BENGALI_MONTHS[date.getMonth()]}
                    </span>
                    <span style={{ color: subText, marginLeft: '0.5rem' }}>
                      ({BENGALI_DAYS[date.getDay()]})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ color: subText }}>
                      {toBengaliNumber(activity.questionsCompleted)} প্রশ্ন
                    </span>
                    <span style={{
                      color: accuracy >= 80 ? '#22c55e' : accuracy >= 60 ? '#eab308' : '#ef4444',
                      fontWeight: '600',
                    }}>
                      {toBengaliNumber(accuracy)}%
                    </span>
                    <span style={{ color: '#8b5cf6', fontWeight: '600' }}>
                      +{toBengaliNumber(activity.xpEarned)} XP
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarDay({
  day,
  dayOfWeek,
  hasActivity,
  isToday,
  activity,
  darkMode,
  showLabel,
}: {
  day: number;
  dayOfWeek: string;
  hasActivity: boolean;
  isToday: boolean;
  activity?: any;
  darkMode: boolean;
  showLabel: boolean;
}) {
  const bg = hasActivity
    ? isToday
      ? '#4ade80'
      : '#86efac'
    : darkMode
    ? '#2d3748'
    : '#e2e8f0';

  const border = isToday ? '2px solid #22c55e' : 'none';
  const text = hasActivity ? '#064e3b' : darkMode ? '#94a3b8' : '#64748b';

  const title = activity
    ? `${activity.questionsCompleted} প্রশ্ন, ${activity.questionsCorrect} সঠিক, ${activity.xpEarned} XP`
    : 'অনুশীলন নেই';

  return (
    <div
      title={title}
      style={{
        position: 'relative',
        aspectRatio: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        borderRadius: '0.375rem',
        border,
        cursor: hasActivity ? 'pointer' : 'default',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={(e) => {
        if (hasActivity) e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {showLabel && (
        <div style={{
          position: 'absolute',
          top: '-1.25rem',
          fontSize: '0.625rem',
          color: darkMode ? '#94a3b8' : '#64748b',
        }}>
          {dayOfWeek}
        </div>
      )}
      <span style={{ fontSize: '0.75rem', fontWeight: hasActivity ? '700' : '400', color: text }}>
        {toBengaliNumber(day)}
      </span>
    </div>
  );
}
