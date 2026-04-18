import { useEffect, useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';

interface Mistake {
  id: number;
  questionId: string;
  questionText: string;
  questionType: string;
  correctAnswer: string;
  difficulty: string;
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  firstAttemptDate: string;
  timesFailed: number;
  lastFailedDate: string;
  mastered: boolean;
  masteredDate: string | null;
}

interface MistakeStats {
  total: number;
  mastered: number;
  pending: number;
  avgAttempts: number;
}

interface TopicStats {
  topicId: string;
  topicName: string;
  mistakeCount: number;
  pending: number;
}

interface Props {
  userId: number;
  darkMode: boolean;
  onRetryQuestion?: (questionId: string) => void;
}

const API_BASE = 'http://localhost:3001';

export default function MistakeNotebook({ userId, darkMode, onRetryQuestion }: Props) {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [stats, setStats] = useState<MistakeStats | null>(null);
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'mastered'>('pending');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [expandedMistake, setExpandedMistake] = useState<number | null>(null);

  const bg = darkMode ? '#1a1a2e' : '#f0f4ff';
  const cardBg = darkMode ? '#16213e' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const borderColor = darkMode ? '#2d3748' : '#e2e8f0';
  const accentBg = darkMode ? '#1a365d' : '#ebf4ff';

  useEffect(() => {
    fetchMistakes();
  }, [userId, filter, selectedTopic]);

  const fetchMistakes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter === 'mastered') params.append('masteredOnly', 'true');
      if (filter === 'pending') params.append('masteredOnly', 'false');
      if (selectedTopic) params.append('topicId', selectedTopic);

      const response = await fetch(`${API_BASE}/api/users/${userId}/mistakes?${params}`);
      if (!response.ok) throw new Error('Failed to fetch mistakes');

      const data = await response.json();
      setMistakes(data.mistakes);
      setStats(data.stats);
      setTopicStats(data.byTopic);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkMastered = async (questionId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/users/${userId}/mistakes/${questionId}/master`, {
        method: 'PUT',
      });

      if (!response.ok) throw new Error('Failed to mark as mastered');
      await fetchMistakes(); // Refresh
    } catch (err) {
      console.error('Error marking as mastered:', err);
    }
  };

  if (loading && mistakes.length === 0) {
    return (
      <div style={{
        minHeight: '400px',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '1rem',
      }}>
        <div style={{ textAlign: 'center', color: text }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
          <p>লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      padding: '2rem',
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '2.5rem' }}>📖</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: text }}>
              ভুলের খাতা
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', color: subText }}>
              আপনার ভুলগুলি থেকে শিখুন এবং উন্নতি করুন
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}>
            <StatCard
              icon="📝"
              label="মোট ভুল"
              value={toBengaliNumber(stats.total)}
              color="#ef4444"
              darkMode={darkMode}
            />
            <StatCard
              icon="⏳"
              label="পর্যালোচনার জন্য"
              value={toBengaliNumber(stats.pending)}
              color="#f97316"
              darkMode={darkMode}
            />
            <StatCard
              icon="✅"
              label="আয়ত্ত করেছেন"
              value={toBengaliNumber(stats.mastered)}
              color="#22c55e"
              darkMode={darkMode}
            />
            <StatCard
              icon="🔁"
              label="গড় চেষ্টা"
              value={toBengaliNumber(Math.round(stats.avgAttempts * 10) / 10)}
              color="#8b5cf6"
              darkMode={darkMode}
            />
          </div>
        )}

        {/* Filters */}
        <div style={{
          background: cardBg,
          borderRadius: '0.75rem',
          padding: '1rem',
          border: `1px solid ${borderColor}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <FilterButton
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              darkMode={darkMode}
            >
              সব ({toBengaliNumber(stats?.total || 0)})
            </FilterButton>
            <FilterButton
              active={filter === 'pending'}
              onClick={() => setFilter('pending')}
              darkMode={darkMode}
            >
              পর্যালোচনা ({toBengaliNumber(stats?.pending || 0)})
            </FilterButton>
            <FilterButton
              active={filter === 'mastered'}
              onClick={() => setFilter('mastered')}
              darkMode={darkMode}
            >
              আয়ত্ত ({toBengaliNumber(stats?.mastered || 0)})
            </FilterButton>
          </div>

          {topicStats.length > 0 && (
            <div style={{ flex: 1, minWidth: '200px' }}>
              <select
                value={selectedTopic || ''}
                onChange={(e) => setSelectedTopic(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${borderColor}`,
                  background: darkMode ? '#0f1419' : '#ffffff',
                  color: text,
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">সব বিষয়</option>
                {topicStats.map(topic => (
                  <option key={topic.topicId} value={topic.topicId}>
                    {topic.topicName} ({toBengaliNumber(topic.mistakeCount)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {mistakes.length === 0 && !loading && (
        <div style={{
          background: cardBg,
          borderRadius: '1rem',
          padding: '3rem',
          textAlign: 'center',
          border: `1px solid ${borderColor}`,
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: text, margin: '0 0 0.5rem' }}>
            {filter === 'pending' ? 'কোনো ভুল পর্যালোচনা করার নেই!' : 'এখনও কোনো ভুল নেই!'}
          </h3>
          <p style={{ fontSize: '1rem', color: subText, margin: 0 }}>
            {filter === 'pending'
              ? 'আপনি সব ভুল আয়ত্ত করেছেন। দুর্দান্ত কাজ!'
              : 'অনুশীলন শুরু করুন এবং আপনার ভুলগুলি এখানে ট্র্যাক করা হবে।'}
          </p>
        </div>
      )}

      {/* Mistakes List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {mistakes.map((mistake) => (
          <div
            key={mistake.id}
            style={{
              background: cardBg,
              borderRadius: '0.75rem',
              border: `1px solid ${borderColor}`,
              overflow: 'hidden',
            }}
          >
            {/* Mistake Header */}
            <div
              style={{
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                background: mistake.mastered ? accentBg : 'transparent',
              }}
              onClick={() => setExpandedMistake(expandedMistake === mistake.id ? null : mistake.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>
                    {mistake.mastered ? '✅' : '📝'}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    background: mistake.difficulty === 'hard' ? '#fca5a5' : mistake.difficulty === 'medium' ? '#fcd34d' : '#86efac',
                    color: mistake.difficulty === 'hard' ? '#7f1d1d' : mistake.difficulty === 'medium' ? '#78350f' : '#064e3b',
                    fontWeight: '600',
                  }}>
                    {mistake.difficulty === 'easy' ? 'সহজ' : mistake.difficulty === 'medium' ? 'মধ্যম' : 'কঠিন'}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: subText }}>
                    {mistake.topicName}
                  </span>
                </div>
                <div style={{ fontSize: '1rem', color: text, fontWeight: '500' }}>
                  {mistake.questionText.substring(0, 100)}
                  {mistake.questionText.length > 100 && '...'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginLeft: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444' }}>
                    {toBengaliNumber(mistake.timesFailed)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: subText }}>
                    বার ভুল
                  </div>
                </div>
                <div style={{ fontSize: '1.25rem', color: subText }}>
                  {expandedMistake === mistake.id ? '▲' : '▼'}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedMistake === mistake.id && (
              <div style={{
                padding: '1.5rem',
                borderTop: `1px solid ${borderColor}`,
                background: darkMode ? '#0f1419' : '#f8fafc',
              }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: subText, margin: '0 0 0.5rem' }}>
                    প্রশ্ন:
                  </h4>
                  <p style={{ fontSize: '1rem', color: text, margin: 0 }}>
                    {mistake.questionText}
                  </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: subText, margin: '0 0 0.5rem' }}>
                    সঠিক উত্তর:
                  </h4>
                  <p style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#22c55e',
                    margin: 0,
                    padding: '0.5rem',
                    background: darkMode ? '#064e3b20' : '#dcfce720',
                    borderRadius: '0.5rem',
                    display: 'inline-block',
                  }}>
                    {mistake.correctAnswer}
                  </p>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}>
                  <InfoItem label="প্রথম ভুল" value={formatDate(mistake.firstAttemptDate)} darkMode={darkMode} />
                  <InfoItem label="শেষ ভুল" value={formatDate(mistake.lastFailedDate)} darkMode={darkMode} />
                  <InfoItem label="অধ্যায়" value={mistake.chapterName} darkMode={darkMode} />
                  {mistake.mastered && mistake.masteredDate && (
                    <InfoItem label="আয়ত্ত করেছেন" value={formatDate(mistake.masteredDate)} darkMode={darkMode} />
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {!mistake.mastered && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkMastered(mistake.questionId);
                        }}
                        style={{
                          padding: '0.625rem 1.25rem',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          background: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        ✅ আয়ত্ত করেছি
                      </button>
                      {onRetryQuestion && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetryQuestion(mistake.questionId);
                          }}
                          style={{
                            padding: '0.625rem 1.25rem',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          🔁 আবার চেষ্টা করুন
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  darkMode,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  darkMode: boolean;
}) {
  const bg = darkMode ? '#16213e' : '#ffffff';
  const borderColor = darkMode ? '#2d3748' : '#e2e8f0';
  const subText = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div style={{
      background: bg,
      borderRadius: '0.75rem',
      padding: '1.25rem',
      border: `1px solid ${borderColor}`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color, marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.875rem', color: subText }}>{label}</div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  darkMode,
  children,
}: {
  active: boolean;
  onClick: () => void;
  darkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        background: active
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : darkMode
          ? '#2d3748'
          : '#e2e8f0',
        color: active ? 'white' : darkMode ? '#e2e8f0' : '#1e293b',
        border: 'none',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = darkMode ? '#374151' : '#cbd5e0';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = darkMode ? '#2d3748' : '#e2e8f0';
        }
      }}
    >
      {children}
    </button>
  );
}

function InfoItem({ label, value, darkMode }: { label: string; value: string; darkMode: boolean }) {
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const text = darkMode ? '#e2e8f0' : '#1e293b';

  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: subText, marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: text }}>
        {value}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  return `${toBengaliNumber(date.getDate())} ${months[date.getMonth()]}, ${toBengaliNumber(date.getFullYear())}`;
}
