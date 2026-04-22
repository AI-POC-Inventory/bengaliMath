import { useState, useEffect } from 'react';
import { getClassData } from '../data/curriculum';
import type { ClassData, Topic } from '../types';

interface Props {
  classId: number;
  darkMode: boolean;
}

interface UseCase {
  id: number;
  topic_id: string;
  title_bengali: string;
  description_bengali: string;
  real_world_example: string;
  profession_bengali: string;
  icon: string;
}

export default function UseCaseCards({ classId, darkMode }: Props) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const accent = '#8b5cf6';
  const accentLight = darkMode ? '#6d28d9' : '#a78bfa';

  useEffect(() => {
    loadData();
  }, [classId]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getClassData(classId);
      setClassData(data ?? null);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadUseCase(topicId: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/topic-applications/${topicId}`);

      if (response.status === 404) {
        setUseCase(null);
        return;
      }

      if (!response.ok) throw new Error('Failed to load use case');

      const data = await response.json();
      setUseCase(data);
    } catch (err) {
      console.error('Error loading use case:', err);
      setUseCase(null);
    }
  }

  async function generateUseCase() {
    if (!selectedTopic) {
      alert('অনুগ্রহ করে একটি বিষয় নির্বাচন করুন');
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch('http://localhost:3001/api/topic-applications/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: selectedTopic })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate use case');
      }

      const data = await response.json();
      setUseCase({
        id: 0,
        topic_id: data.topicId,
        title_bengali: data.title,
        description_bengali: data.description,
        real_world_example: data.example,
        profession_bengali: data.profession || '',
        icon: data.icon || '💡'
      });
    } catch (err: any) {
      console.error('Error generating use case:', err);
      alert(err.message || 'তৈরি করতে ব্যর্থ হয়েছে');
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (selectedTopic) {
      loadUseCase(selectedTopic);
    } else {
      setUseCase(null);
    }
  }, [selectedTopic]);

  const topics = selectedChapter
    ? classData?.chapters.find(c => c.id === selectedChapter)?.topics || []
    : [];

  if (loading) {
    return <div style={{ padding: '2rem' }}>লোড হচ্ছে...</div>;
  }

  return (
    <div style={{ padding: '2rem', background: bg, minHeight: '100vh', color: text }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            🤔 কেন শিখব?
          </h1>
          <p style={{ color: subText, fontSize: '1.1rem' }}>
            জানুন কেন এই বিষয়টি আপনার জীবনে গুরুত্বপূর্ণ
          </p>
        </div>

        {/* Selection Panel */}
        <div style={{
          background: cardBg,
          padding: '1.5rem',
          borderRadius: '12px',
          border: `1px solid ${border}`,
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* Chapter Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: subText, fontWeight: 'bold' }}>
                অধ্যায়
              </label>
              <select
                value={selectedChapter}
                onChange={(e) => {
                  setSelectedChapter(e.target.value);
                  setSelectedTopic('');
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${border}`,
                  background: cardBg,
                  color: text,
                  fontSize: '1rem'
                }}
              >
                <option value="">সব অধ্যায়</option>
                {classData?.chapters.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
            </div>

            {/* Topic Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: subText, fontWeight: 'bold' }}>
                বিষয় *
              </label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${border}`,
                  background: cardBg,
                  color: text,
                  fontSize: '1rem'
                }}
              >
                <option value="">বিষয় নির্বাচন করুন</option>
                {topics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Use Case Card */}
        {useCase && (
          <div style={{
            background: `linear-gradient(135deg, ${accentLight} 0%, ${accent} 100%)`,
            padding: '0.15rem',
            borderRadius: '16px',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              background: cardBg,
              padding: '2.5rem',
              borderRadius: '15px',
              position: 'relative'
            }}>
              {/* Icon */}
              <div style={{
                fontSize: '4rem',
                textAlign: 'center',
                marginBottom: '1.5rem'
              }}>
                {useCase.icon}
              </div>

              {/* Title */}
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: '1.5rem',
                background: `linear-gradient(135deg, ${accentLight} 0%, ${accent} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {useCase.title_bengali}
              </h2>

              {/* Description */}
              <div style={{
                background: darkMode ? '#0f172a' : '#f5f3ff',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: accent, fontWeight: 'bold' }}>
                  📚 বাস্তব জীবনে ব্যবহার:
                </h3>
                <p style={{ fontSize: '1.1rem', lineHeight: '1.8' }}>
                  {useCase.description_bengali}
                </p>
              </div>

              {/* Example */}
              <div style={{
                background: darkMode ? '#0f172a' : '#ecfdf5',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>
                  💡 উদাহরণ:
                </h3>
                <p style={{ fontSize: '1.1rem', lineHeight: '1.8', fontStyle: 'italic' }}>
                  "{useCase.real_world_example}"
                </p>
              </div>

              {/* Profession */}
              {useCase.profession_bengali && (
                <div style={{
                  background: darkMode ? '#0f172a' : '#fef3c7',
                  padding: '1rem 1.5rem',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <strong style={{ color: '#f59e0b' }}>👨‍💼 পেশা:</strong>{' '}
                  <span style={{ fontSize: '1.1rem' }}>{useCase.profession_bengali}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Use Case - Generate Button */}
        {!useCase && selectedTopic && !generating && (
          <div style={{
            background: cardBg,
            padding: '3rem',
            borderRadius: '12px',
            border: `1px solid ${border}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💭</div>
            <p style={{ color: subText, marginBottom: '1.5rem', fontSize: '1.1rem' }}>
              এই বিষয়ের জন্য এখনো "কেন শিখব?" তথ্য নেই
            </p>
            <button
              onClick={generateUseCase}
              style={{
                padding: '1rem 2rem',
                background: accent,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ✨ AI দিয়ে তৈরি করুন
            </button>
          </div>
        )}

        {/* Generating State */}
        {generating && (
          <div style={{
            background: cardBg,
            padding: '3rem',
            borderRadius: '12px',
            border: `1px solid ${border}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⏳</div>
            <p style={{ color: subText, fontSize: '1.1rem' }}>তৈরি হচ্ছে...</p>
          </div>
        )}

        {/* Empty State */}
        {!selectedTopic && (
          <div style={{
            background: cardBg,
            padding: '3rem',
            borderRadius: '12px',
            border: `1px solid ${border}`,
            textAlign: 'center',
            color: subText
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👆</div>
            <p style={{ fontSize: '1.1rem' }}>
              উপরে একটি বিষয় নির্বাচন করুন<br />
              "কেন শিখব?" তথ্য দেখতে
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
