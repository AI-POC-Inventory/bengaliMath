import { getClassData } from '../data/curriculum';
import { toBengaliNumber } from '../utils/bengali';
import type {ClassData,Chapter, Topic } from '../types';
import { useEffect, useState } from 'react';

interface Props {
  classId: number;
  darkMode: boolean;
}

export default function Syllabus({ classId, darkMode }: Props) {
  console.log("Rendering Syllabus with classId:", classId, "and darkMode:", darkMode);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getClassData(classId);
        setClassData(data ?? null);

      } catch (err) {
        console.error("Error loading class data:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [classId]);
  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading syllabus...</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', color: 'red' }}>{error}</div>;
  }

  if (!classData) {
    return <div style={{ padding: '2rem' }}>No data found</div>;
  }
  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const accent = '#3b82f6';

  if (!classData) return null;
  return (
    <div style={{ padding: '2rem', minHeight: '100%', background: bg, fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        {selectedChapter && (
          <button
            onClick={() => setSelectedChapter(null)}
            style={{
              background: darkMode ? '#334155' : '#e2e8f0',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              color: text,
              fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            ← পেছনে
          </button>
        )}
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: text, margin: 0 }}>
            📚 পাঠ্যক্রম
          </h1>
          <p style={{ color: subText, margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
            <p style={{ color: subText, margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
              {classData.bengaliName} • {toBengaliNumber(classData?.chapters?.length ?? 0)}টি অধ্যায়
            </p>
          </p>
        </div>
      </div>

      {!selectedChapter ? (
        /* Chapter list */
        <div style={{ display: 'grid', gap: '1rem' }}>
          {classData.chapters.map((chapter, idx) => (
            <div
              key={chapter.id}
              onClick={() => setSelectedChapter(chapter)}
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: '1rem',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = accent;
                (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = border;
                (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '0.8rem',
                background: accent + '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '1.4rem',
                fontWeight: '700',
                color: accent,
              }}>
                {toBengaliNumber(idx + 1)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: text, fontSize: '1.05rem' }}>
                  {chapter.name}
                </div>
                <div style={{ color: subText, fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  {chapter.description}
                </div>
                <div style={{ color: accent, fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  {toBengaliNumber(chapter.topics.length)}টি বিষয়
                </div>
              </div>
              <div style={{ color: subText, fontSize: '1.2rem' }}>›</div>
            </div>
          ))}
        </div>
      ) : (
        /* Topics in chapter */
        <div>
          <div style={{
            background: accent + '15',
            border: `1px solid ${accent}30`,
            borderRadius: '1rem',
            padding: '1.2rem 1.5rem',
            marginBottom: '1.5rem',
          }}>
            <h2 style={{ color: accent, fontWeight: '700', fontSize: '1.3rem', margin: '0 0 0.3rem' }}>
              {selectedChapter.name}
            </h2>
            <p style={{ color: subText, margin: 0, fontSize: '0.9rem' }}>
              {selectedChapter.description}
            </p>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {selectedChapter.topics.map((topic: Topic, idx: number) => (
              <div
                key={topic.id}
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: '0.9rem',
                  padding: '1.3rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#10b981' + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    color: '#10b981',
                  }}>
                    {toBengaliNumber(idx + 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: text, fontSize: '1rem' }}>
                      {topic.name}
                    </div>
                    <div style={{ color: subText, fontSize: '0.85rem', marginTop: '0.3rem' }}>
                      {topic.description}
                    </div>
                    <div style={{
                      marginTop: '0.6rem',
                      display: 'flex',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}>
                      <span style={{
                        background: '#3b82f6' + '20',
                        color: '#3b82f6',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '1rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                      }}>
                        {toBengaliNumber(topic.questions.length)}টি প্রশ্ন
                      </span>
                      <span style={{
                        background: '#8b5cf6' + '20',
                        color: '#8b5cf6',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '1rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                      }}>
                        {toBengaliNumber(topic.questions.filter(q => q.type === 'mcq').length)} MCQ
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
