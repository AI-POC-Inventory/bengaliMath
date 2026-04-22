import { useState, useEffect } from 'react';

interface Props {
  darkMode: boolean;
}

interface Puzzle {
  id: string;
  puzzle_date: string;
  puzzle_bengali: string;
  hint_bengali?: string;
  difficulty: string;
}

interface PuzzleResult {
  correct: boolean;
  answer: string;
  explanation: string;
}

export default function DailyPuzzle({ darkMode }: Props) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<PuzzleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const accent = '#f59e0b';
  const accentLight = darkMode ? '#d97706' : '#fbbf24';

  useEffect(() => {
    loadTodaysPuzzle();
  }, []);

  async function loadTodaysPuzzle() {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/daily-puzzle/today');
      const data = await response.json();

      if (data.puzzle) {
        setPuzzle(data.puzzle);
      } else {
        setPuzzle(null);
      }
    } catch (err) {
      console.error('Error loading puzzle:', err);
    } finally {
      setLoading(false);
    }
  }

  async function generateTodaysPuzzle(difficulty: string = 'medium') {
    setGenerating(true);

    try {
      const response = await fetch('http://localhost:3001/api/daily-puzzle/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          difficulty
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate puzzle');
      }

      const data = await response.json();
      setPuzzle({
        id: data.id,
        puzzle_date: data.date,
        puzzle_bengali: data.puzzle,
        hint_bengali: data.hint,
        difficulty: data.difficulty || difficulty
      });
    } catch (err: any) {
      console.error('Error generating puzzle:', err);
      alert(err.message || 'ধাঁধা তৈরি করতে ব্যর্থ হয়েছে');
    } finally {
      setGenerating(false);
    }
  }

  async function submitAnswer() {
    if (!puzzle || !userAnswer.trim()) return;

    try {
      const response = await fetch('http://localhost:3001/api/daily-puzzle/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId: puzzle.id,
          userAnswer: userAnswer.trim()
        })
      });

      if (!response.ok) throw new Error('Failed to submit answer');

      const data = await response.json();
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting answer:', err);
      alert('উত্তর জমা দিতে ব্যর্থ হয়েছে');
    }
  }

  function resetPuzzle() {
    setUserAnswer('');
    setShowHint(false);
    setSubmitted(false);
    setResult(null);
  }

  const difficultyColor = {
    easy: '#10b981',
    medium: '#f59e0b',
    hard: '#ef4444'
  };

  const difficultyBengali = {
    easy: 'সহজ',
    medium: 'মাঝারি',
    hard: 'কঠিন'
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', background: bg, minHeight: '100vh', color: text }}>
        <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⏳</div>
          <p>লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', background: bg, minHeight: '100vh', color: text }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            🧩 আজকের গণিত ধাঁধা
          </h1>
          <p style={{ color: subText, fontSize: '1.1rem' }}>
            প্রতিদিন একটি নতুন চ্যালেঞ্জ — আপনার চিন্তা শক্তি পরীক্ষা করুন!
          </p>
        </div>

        {/* Puzzle Card */}
        {puzzle && (
          <div style={{
            background: `linear-gradient(135deg, ${accentLight} 0%, ${accent} 100%)`,
            padding: '0.15rem',
            borderRadius: '16px',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              background: cardBg,
              padding: '2rem',
              borderRadius: '15px'
            }}>
              {/* Difficulty Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  background: difficultyColor[puzzle.difficulty as keyof typeof difficultyColor] || '#gray',
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold'
                }}>
                  {difficultyBengali[puzzle.difficulty as keyof typeof difficultyBengali] || puzzle.difficulty}
                </div>
                <div style={{ color: subText }}>
                  📅 {new Date(puzzle.puzzle_date).toLocaleDateString('bn-BD')}
                </div>
              </div>

              {/* Puzzle Question */}
              <div style={{
                background: darkMode ? '#0f172a' : '#fef3c7',
                padding: '2rem',
                borderRadius: '12px',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '1rem' }}>🤔</div>
                <p style={{ fontSize: '1.3rem', lineHeight: '1.8', textAlign: 'center', fontWeight: 'bold' }}>
                  {puzzle.puzzle_bengali}
                </p>
              </div>

              {/* Hint Section */}
              {puzzle.hint_bengali && !submitted && (
                <div style={{ marginBottom: '1.5rem' }}>
                  {!showHint ? (
                    <button
                      onClick={() => setShowHint(true)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: darkMode ? '#334155' : '#e2e8f0',
                        color: text,
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      💡 সংকেত দেখুন
                    </button>
                  ) : (
                    <div style={{
                      background: darkMode ? '#0f172a' : '#dbeafe',
                      padding: '1rem 1.5rem',
                      borderRadius: '8px'
                    }}>
                      <strong style={{ color: '#3b82f6' }}>💡 সংকেত:</strong>{' '}
                      <span style={{ fontSize: '1.1rem' }}>{puzzle.hint_bengali}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Answer Input */}
              {!submitted && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    আপনার উত্তর:
                  </label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <input
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && submitAnswer()}
                      placeholder="উত্তর লিখুন..."
                      style={{
                        flex: 1,
                        padding: '1rem',
                        borderRadius: '8px',
                        border: `1px solid ${border}`,
                        background: cardBg,
                        color: text,
                        fontSize: '1.1rem'
                      }}
                    />
                    <button
                      onClick={submitAnswer}
                      disabled={!userAnswer.trim()}
                      style={{
                        padding: '1rem 2.5rem',
                        background: accent,
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        cursor: !userAnswer.trim() ? 'not-allowed' : 'pointer',
                        opacity: !userAnswer.trim() ? 0.5 : 1
                      }}
                    >
                      জমা দিন
                    </button>
                  </div>
                </div>
              )}

              {/* Result */}
              {submitted && result && (
                <div>
                  {/* Correct/Incorrect Banner */}
                  <div style={{
                    background: result.correct
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                    color: 'white',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                      {result.correct ? '🎉' : '😔'}
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      {result.correct ? 'অভিনন্দন! সঠিক উত্তর!' : 'দুঃখিত, ভুল উত্তর!'}
                    </h3>
                    <p style={{ fontSize: '1.1rem' }}>সঠিক উত্তর: {result.answer}</p>
                  </div>

                  {/* Explanation */}
                  <div style={{
                    background: darkMode ? '#0f172a' : '#eff6ff',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    marginBottom: '1.5rem'
                  }}>
                    <h4 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#3b82f6', fontWeight: 'bold' }}>
                      📖 ব্যাখ্যা:
                    </h4>
                    <p style={{ fontSize: '1.1rem', lineHeight: '1.8' }}>
                      {result.explanation}
                    </p>
                  </div>

                  {/* Try Again Button */}
                  <button
                    onClick={resetPuzzle}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: darkMode ? '#334155' : '#e2e8f0',
                      color: text,
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    🔄 আবার চেষ্টা করুন
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Puzzle - Generate */}
        {!puzzle && !generating && (
          <div style={{
            background: cardBg,
            padding: '3rem',
            borderRadius: '12px',
            border: `1px solid ${border}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎲</div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>আজকের ধাঁধা এখনো তৈরি হয়নি</h2>
            <p style={{ color: subText, marginBottom: '2rem', fontSize: '1.1rem' }}>
              কঠিনতা নির্বাচন করুন এবং আজকের ধাঁধা তৈরি করুন
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => generateTodaysPuzzle('easy')}
                style={{
                  padding: '1rem 2rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                ✨ সহজ ধাঁধা
              </button>
              <button
                onClick={() => generateTodaysPuzzle('medium')}
                style={{
                  padding: '1rem 2rem',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                ✨ মাঝারি ধাঁধা
              </button>
              <button
                onClick={() => generateTodaysPuzzle('hard')}
                style={{
                  padding: '1rem 2rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                ✨ কঠিন ধাঁধা
              </button>
            </div>
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
            <p style={{ color: subText, fontSize: '1.1rem' }}>ধাঁধা তৈরি হচ্ছে...</p>
          </div>
        )}
      </div>
    </div>
  );
}
