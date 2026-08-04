import { useState, useEffect } from 'react';
import type { Chapter, Topic } from '../types';
import { getClassData } from '../data/curriculum';
import { useProgress } from '../hooks/useProgress';

interface MobileHomeProps {
  classId: number;
  darkMode: boolean;
  userName: string;
  onNavigate: (section: string, topicId?: number) => void;
}

interface StatsCardProps {
  icon: string;
  value: string;
  label: string;
  bgColor: string;
  textColor: string;
}

function StatsCard({ icon, value, label, bgColor, textColor }: StatsCardProps) {
  return (
    <div style={{
      backgroundColor: bgColor,
      borderRadius: '16px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: '110px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    }}>
      <div style={{ fontSize: '24px' }}>{icon}</div>
      <div style={{
        fontSize: '24px',
        fontWeight: 700,
        color: textColor,
        fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '14px',
        color: textColor,
        opacity: 0.9,
        fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
      }}>
        {label}
      </div>
    </div>
  );
}

interface TopicCardProps {
  topic: Topic;
  status: 'mastered' | 'in-progress' | 'locked';
  onPress: () => void;
  darkMode: boolean;
}

function TopicCard({ topic, status, onPress, darkMode }: TopicCardProps) {
  const getStatusIcon = () => {
    if (status === 'mastered') return '✓';
    if (status === 'in-progress') return '+';
    return '🔒';
  };

  const getIconBgColor = () => {
    if (status === 'mastered') return '#A7F3D0';
    if (status === 'in-progress') return '#A7F3D0';
    return '#F3F4F6';
  };

  const getIconColor = () => {
    if (status === 'mastered') return '#047857';
    if (status === 'in-progress') return '#047857';
    return '#9CA3AF';
  };

  const bgColor = darkMode ? '#1f2937' : '#FFFFFF';
  const borderColor = darkMode ? '#374151' : '#E5E7EB';
  const textColor = darkMode ? '#F9FAFB' : '#1F2937';
  const subtextColor = darkMode ? '#9CA3AF' : '#6B7280';

  return (
    <button
      onClick={status !== 'locked' ? onPress : undefined}
      disabled={status === 'locked'}
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        cursor: status === 'locked' ? 'not-allowed' : 'pointer',
        opacity: status === 'locked' ? 0.6 : 1,
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
      onMouseEnter={(e) => {
        if (status !== 'locked') {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
      }}
    >
      <div style={{
        width: '48px',
        height: '48px',
        backgroundColor: getIconBgColor(),
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        color: getIconColor(),
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {getStatusIcon()}
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: textColor,
          fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
          marginBottom: '4px',
        }}>
          {topic.name}
        </div>
        <div style={{
          fontSize: '14px',
          color: subtextColor,
          fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
        }}>
          {status === 'mastered' ? 'Number recognition · mastered' :
           status === 'in-progress' ? `${topic.name} · lesson ${topic.id}` :
           topic.name}
        </div>
      </div>
      {status !== 'locked' && (
        <div style={{
          fontSize: '20px',
          color: subtextColor,
          flexShrink: 0,
        }}>
          ›
        </div>
      )}
    </button>
  );
}

export default function MobileHome({ classId, darkMode, userName, onNavigate }: MobileHomeProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const { stats } = useProgress();

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getClassData(classId);
        if (!data) return;

        const allTopics: Topic[] = [];
        data.chapters.forEach((chapter: Chapter) => {
          allTopics.push(...chapter.topics);
        });
        setTopics(allTopics.slice(0, 5));
      } catch (err) {
        console.error('Error loading topics:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [classId]);

  const getTopicStatus = (index: number): 'mastered' | 'in-progress' | 'locked' => {
    if (index === 0) return 'mastered';
    if (index === 1) return 'in-progress';
    return 'locked';
  };

  const bgColor = darkMode ? '#111827' : '#F9FAFB';
  const textColor = darkMode ? '#F9FAFB' : '#1F2937';
  const subtextColor = darkMode ? '#9CA3AF' : '#6B7280';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'শুভ সকাল';
    if (hour < 17) return 'শুভ অপরাহ্ন';
    return 'শুভ সন্ধ্যা';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
      }}>
        লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: bgColor,
      minHeight: 'calc(100vh - 64px)',
      paddingBottom: '80px',
    }}>
      <div style={{
        padding: '24px 20px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}>
          <div>
            <div style={{
              fontSize: '14px',
              color: subtextColor,
              fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
              marginBottom: '4px',
            }}>
              {getGreeting()}
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 700,
              color: textColor,
              fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
            }}>
              Good morning, {userName}
            </div>
          </div>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#A7F3D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 700,
            color: '#047857',
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '32px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          <StatsCard
            icon="🔥"
            value={`${stats.streak} দিন`}
            label="streak"
            bgColor="#FEF3C7"
            textColor="#92400E"
          />
          <StatsCard
            icon="⭐"
            value={`${stats.points}`}
            label="points"
            bgColor="#DBEAFE"
            textColor="#1E40AF"
          />
          <StatsCard
            icon="🎯"
            value={`${stats.dailyProgress}/৫`}
            label="today"
            bgColor="#E0E7FF"
            textColor="#3730A3"
          />
        </div>

        <div style={{
          fontSize: '18px',
          fontWeight: 600,
          color: textColor,
          fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
          marginBottom: '16px',
        }}>
          চলো শিখি (let's learn)
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {topics.map((topic, index) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              status={getTopicStatus(index)}
              onPress={() => onNavigate('practice')}
              darkMode={darkMode}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
