import { useState, useEffect } from 'react';
import { getClassData } from '../data/curriculum';
import type { ClassData, Chapter } from '../types';

interface Props {
  classId: number;
  darkMode: boolean;
}

interface ProblemContext {
  id: string;
  name_bengali: string;
  name_english: string;
  description: string;
}

interface WordProblem {
  id: string;
  problem: string;
  answer: string;
  solution_steps: string[];
  contextType: string;
  difficulty: string;
}

export default function WordProblemGenerator({ classId, darkMode }: Props) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [contexts, setContexts] = useState<ProblemContext[]>([]);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedContext, setSelectedContext] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentProblem, setCurrentProblem] = useState<WordProblem | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const accent = '#10b981';

  useEffect(() => {
    loadData();
  }, [classId]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getClassData(classId);
      setClassData(data ?? null);

      // Load contexts
      const response = await fetch('http://localhost:3001/api/word-problems/contexts');
      const contextsData = await response.json();
      setContexts(contextsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function generateProblem() {
    if (!selectedTopic) {
      alert('অনুগ্রহ করে একটি বিষয় নির্বাচন করুন');
      return;
    }

    setGenerating(true);
    setCurrentProblem(null);
    setShowSolution(false);
    setUserAnswer('');
    setSubmitted(false);

    try {
      const response = await fetch('http://localhost:3001/api/word-problems/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: selectedTopic,
          chapterId: selectedChapter,
          classId,
          contextType: selectedContext || undefined,
          difficulty
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate problem');
      }

      const problem = await response.json();
      setCurrentProblem(problem);
    } catch (err: any) {
      console.error('Error generating problem:', err);
      alert(err.message || 'সমস্যা তৈরি করতে ব্যর্থ হয়েছে');
    } finally {
      setGenerating(false);
    }
  }

  function handleSubmitAnswer() {
    setSubmitted(true);
    setShowSolution(true);
  }

  const topics = selectedChapter
    ? classData?.chapters.find(c => c.id === selectedChapter)?.topics || []
    : [];

  if (loading) {
    return <div style={{ padding: '2rem' }}>লোড হচ্ছে...</div>;
  }

  return (
    <div style={{ padding: '2rem', background: bg, minHeight: '100vh', color: text }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            📚 বাস্তব জীবনের সমস্যা
          </h1>
          <p style={{ color: subText }}>
            বাংলাদেশী প্রেক্ষাপটে গণিতের বাস্তব সমস্যা সমাধান করুন
          </p>
        </div>

        {/* Selection Panel */}
        <div style={{
          background: cardBg,
          padding: '1.5rem',
          borderRadius: '12px',
          border: `1px solid ${border}`,
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>সমস্যা তৈরি করুন</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* Chapter Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: subText }}>
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
                  color: text
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
              <label style={{ display: 'block', marginBottom: '0.5rem', color: subText }}>
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
                  color: text
                }}
              >
                <option value="">বিষয় নির্বাচন করুন</option>
                {topics.map(topic => (
                  <option key={topic.id} value={topic.id}>{topic.name}</option>
                ))}
              </select>
            </div>

            {/* Context Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: subText }}>
                প্রসঙ্গ
              </label>
              <select
                value={selectedContext}
                onChange={(e) => setSelectedContext(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${border}`,
                  background: cardBg,
                  color: text
                }}
              >
                <option value="">যেকোনো প্রসঙ্গ</option>
                {contexts.map(ctx => (
                  <option key={ctx.id} value={ctx.id}>
                    {ctx.name_bengali} ({ctx.name_english})
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: subText }}>
                কঠিনতা
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${border}`,
                  background: cardBg,
                  color: text
                }}
              >
                <option value="easy">সহজ</option>
                <option value="medium">মাঝারি</option>
                <option value="hard">কঠিন</option>
              </select>
            </div>
          </div>

          <button
            onClick={generateProblem}
            disabled={generating || !selectedTopic}
            style={{
              width: '100%',
              padding: '1rem',
              background: accent,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: generating || !selectedTopic ? 'not-allowed' : 'pointer',
              opacity: generating || !selectedTopic ? 0.5 : 1
            }}
          >
            {generating ? '⏳ তৈরি হচ্ছে...' : '✨ নতুন সমস্যা তৈরি করুন'}
          </button>
        </div>

        {/* Problem Display */}
        {currentProblem && (
          <div style={{
            background: cardBg,
            padding: '2rem',
            borderRadius: '12px',
            border: `1px solid ${border}`,
            marginBottom: '1.5rem'
          }}>
            <div style={{
              background: darkMode ? '#0f172a' : '#f0fdf4',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: accent }}>
                📝 সমস্যা
              </h3>
              <p style={{ fontSize: '1.1rem', lineHeight: '1.8' }}>
                {currentProblem.problem}
              </p>
            </div>

            {/* Answer Input */}
            {!submitted && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  আপনার উত্তর:
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="উত্তর লিখুন..."
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: `1px solid ${border}`,
                      background: cardBg,
                      color: text,
                      fontSize: '1rem'
                    }}
                  />
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!userAnswer.trim()}
                    style={{
                      padding: '0.75rem 2rem',
                      background: accent,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: !userAnswer.trim() ? 'not-allowed' : 'pointer',
                      opacity: !userAnswer.trim() ? 0.5 : 1
                    }}
                  >
                    জমা দিন
                  </button>
                </div>
              </div>
            )}

            {/* Correct Answer */}
            {submitted && (
              <div style={{
                background: darkMode ? '#0f172a' : '#fef3c7',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <strong>সঠিক উত্তর:</strong> {currentProblem.answer}
              </div>
            )}

            {/* Solution Toggle */}
            <button
              onClick={() => setShowSolution(!showSolution)}
              style={{
                padding: '0.75rem 1.5rem',
                background: darkMode ? '#334155' : '#e2e8f0',
                color: text,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              {showSolution ? '🙈 সমাধান লুকান' : '👁️ সমাধান দেখুন'}
            </button>

            {/* Solution Steps */}
            {showSolution && (
              <div style={{
                background: darkMode ? '#0f172a' : '#eff6ff',
                padding: '1.5rem',
                borderRadius: '8px'
              }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: accent }}>
                  📖 সমাধান পদ্ধতি:
                </h4>
                <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
                  {currentProblem.solution_steps.map((step, idx) => (
                    <li key={idx} style={{ marginBottom: '0.5rem' }}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        {!currentProblem && !generating && (
          <div style={{
            background: cardBg,
            padding: '2rem',
            borderRadius: '12px',
            border: `1px solid ${border}`,
            textAlign: 'center',
            color: subText
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎯</div>
            <p>উপরে আপনার পছন্দের বিষয় এবং প্রসঙ্গ নির্বাচন করুন,<br />তারপর সমস্যা তৈরি করুন বোতামে ক্লিক করুন।</p>
          </div>
        )}
      </div>
    </div>
  );
}
