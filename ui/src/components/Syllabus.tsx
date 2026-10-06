import { getClassData } from '../data/curriculum';
import { getChapterLesson, getChapterVideo } from '../api/client';
import type { LessonContent, ChapterVideo } from '../api/client';
import { toBengaliNumber } from '../utils/bengali';
import type {ClassData,Chapter } from '../types';
import { useEffect, useState } from 'react';
import LessonView from './LessonView';

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

  // The lesson is fetched only when a chapter that has one is opened (it is
  // deliberately not part of the /class payload -- see GET /chapter).
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState(false);

  useEffect(() => {
    setLesson(null);
    setLessonError(false);
    if (!selectedChapter?.hasLesson) return;
    let cancelled = false;
    setLessonLoading(true);
    getChapterLesson(classId, selectedChapter.id)
      .then(l => { if (!cancelled) setLesson(l); })
      .catch(() => { if (!cancelled) setLessonError(true); })
      .finally(() => { if (!cancelled) setLessonLoading(false); });
    return () => { cancelled = true; };
  }, [classId, selectedChapter]);

  // Same on-demand pattern as the lesson: fetched only when a chapter that
  // has one is opened.
  const [video, setVideo] = useState<ChapterVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    setVideo(null);
    if (!selectedChapter?.hasVideo) return;
    let cancelled = false;
    setVideoLoading(true);
    getChapterVideo(classId, selectedChapter.id)
      .then(v => { if (!cancelled) setVideo(v); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setVideoLoading(false); });
    return () => { cancelled = true; };
  }, [classId, selectedChapter]);

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
                {(chapter.hasLesson || chapter.hasVideo) && (
                  <div style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>
                    {chapter.hasLesson && <span style={{ color: '#10b981' }}>📖 পাঠ আছে</span>}
                    {chapter.hasLesson && chapter.hasVideo && <span style={{ margin: '0 0.4rem' }}> </span>}
                    {chapter.hasVideo && <span style={{ color: '#3b82f6' }}>📹 ভিডিও আছে</span>}
                  </div>
                )}
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

          {selectedChapter.hasVideo && (
            <div style={{ marginBottom: '1.5rem' }}>
              {videoLoading && <div style={{ color: subText, padding: '1rem 0' }}>ভিডিও লোড হচ্ছে...</div>}
              {video && (
                <video
                  controls
                  poster={video.thumbnailUrl ?? undefined}
                  style={{ width: '100%', maxWidth: '720px', borderRadius: '0.9rem', background: '#000', display: 'block' }}
                >
                  <source src={video.url} type="video/mp4" />
                </video>
              )}
            </div>
          )}

          {selectedChapter.hasLesson && (
            <div style={{ marginBottom: '2rem' }}>
              {lessonLoading && <div style={{ color: subText, padding: '1rem 0' }}>পাঠ লোড হচ্ছে...</div>}
              {lessonError && (
                <div style={{ color: subText, padding: '1rem 0' }}>পাঠটি এখন দেখানো যাচ্ছে না। একটু পরে আবার চেষ্টা করো।</div>
              )}
              {lesson && <LessonView lesson={lesson} darkMode={darkMode} />}
            </div>
          )}

          {/* Student view shows only the generated lesson + video for this chapter --
              the exercise/topic list (question bank) is deliberately not shown here;
              students practice it via the "অনুশীলন" section instead. */}
          {!selectedChapter.hasLesson && !selectedChapter.hasVideo && (
            <div style={{
              background: cardBg, border: `1px solid ${border}`, borderRadius: '0.9rem',
              padding: '2rem', textAlign: 'center', color: subText,
            }}>
              এই অধ্যায়ের পাঠ বা ভিডিও এখনও প্রস্তুত হয়নি।
            </div>
          )}
        </div>
      )}
    </div>
  );
}
