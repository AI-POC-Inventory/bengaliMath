import { useState } from 'react';
import { getClassData, getAllQuestions } from '../data/curriculum';
import { toBengaliNumber, toBengaliPercent, bengaliOptionLabels } from '../utils/bengali';
import { saveSession } from '../utils/storage';
import type { PracticeSession, SessionQuestion } from '../types';

interface Props {
  classId: number;
  darkMode: boolean;
}

type Stage = 'setup' | 'practicing' | 'results';

interface QuizQuestion {
  question: ReturnType<typeof getAllQuestions>[0]['question'];
  topicId: string;
  chapterId: string;
}

export default function Practice({ classId, darkMode }: Props) {
  const [stage, setStage] = useState<Stage>('setup');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answered, setAnswered] = useState<number | string | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState<SessionQuestion[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [sessionId] = useState(() => Date.now().toString());

  const classData = getClassData(classId);

  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const inputBg = darkMode ? '#0f172a' : '#f1f5f9';

  const topics = selectedChapter
    ? classData?.chapters.find(c => c.id === selectedChapter)?.topics || []
    : [];

  function startPractice() {
    const pool = getAllQuestions(classId, selectedChapter || undefined, selectedTopic || undefined, selectedDifficulty || undefined);
    if (pool.length === 0) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    setQuestions(shuffled.map(q => ({ question: q.question, topicId: q.topicId, chapterId: q.chapterId })));
    setCurrentIdx(0);
    setAnswered(null);
    setShowSolution(false);
    setSessionAnswers([]);
    setStage('practicing');
  }

  function handleAnswer(choice: number | string) {
    if (answered !== null) return;
    setAnswered(choice);
    setShowSolution(true);
    const q = questions[currentIdx];
    const correct = q.question.type === 'mcq'
      ? choice === q.question.answer
      : true; // for short answer, we show the answer
    setSessionAnswers(prev => [...prev, {
      questionId: q.question.id,
      topicId: q.topicId,
      chapterId: q.chapterId,
      correct: correct as boolean,
      attempted: true,
    }]);
  }

  function nextQuestion() {
    if (currentIdx + 1 >= questions.length) {
      finishSession(true);
      return;
    }
    setCurrentIdx(i => i + 1);
    setAnswered(null);
    setShowSolution(false);
  }

  function finishSession(completed: boolean) {
    const correctCount = sessionAnswers.filter(a => a.correct).length;
    const session: PracticeSession = {
      id: sessionId,
      classId,
      chapterId: selectedChapter || undefined,
      topicId: selectedTopic || undefined,
      difficulty: selectedDifficulty || undefined,
      date: new Date().toISOString(),
      questions: sessionAnswers,
      completed,
      score: correctCount,
      total: sessionAnswers.length,
    };
    saveSession(session);
    setStage('results');
  }

  const currentQ = questions[currentIdx];
  const score = sessionAnswers.filter(a => a.correct).length;
  const totalAnswered = sessionAnswers.length;

  const getMotivation = (pct: number) => {
    if (pct >= 90) return 'অসাধারণ! তুমি একজন গণিত চ্যাম্পিয়ন! 🏆';
    if (pct >= 70) return 'খুব ভালো! আরো একটু অনুশীলন করলে পারফেক্ট হবে! ⭐';
    if (pct >= 50) return 'ভালো চেষ্টা! আরো পড়াশোনা করো! 📖';
    return 'চেষ্টা চালিয়ে যাও! পরিশ্রমই সাফল্যের চাবিকাঠি! 💪';
  };

  const selectStyle = {
    width: '100%',
    padding: '0.7rem 1rem',
    borderRadius: '0.6rem',
    border: `1px solid ${border}`,
    background: inputBg,
    color: text,
    fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    fontSize: '0.95rem',
    cursor: 'pointer',
    outline: 'none',
  };

  if (!classData) return null;

  /* SETUP STAGE */
  if (stage === 'setup') return (
    <div style={{ padding: '2rem', background: bg, minHeight: '100%', fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: text, marginBottom: '0.5rem' }}>
        ✏️ অনুশীলন
      </h1>
      <p style={{ color: subText, marginBottom: '2rem', fontSize: '0.9rem' }}>
        প্রশ্নের ধরন বেছে নিন এবং অনুশীলন শুরু করুন
      </p>

      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '1rem', padding: '2rem', maxWidth: '500px' }}>
        <div style={{ marginBottom: '1.2rem' }}>
          <label style={{ display: 'block', color: text, fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
            অধ্যায় (ঐচ্ছিক)
          </label>
          <select
            value={selectedChapter}
            onChange={e => { setSelectedChapter(e.target.value); setSelectedTopic(''); }}
            style={selectStyle as React.CSSProperties}
          >
            <option value="">সব অধ্যায়</option>
            {classData.chapters.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>

        {selectedChapter && (
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', color: text, fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
              বিষয় (ঐচ্ছিক)
            </label>
            <select
              value={selectedTopic}
              onChange={e => setSelectedTopic(e.target.value)}
              style={selectStyle as React.CSSProperties}
            >
              <option value="">সব বিষয়</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: text, fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
            কঠিনতার স্তর (ঐচ্ছিক)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { val: '', label: 'সব' },
              { val: 'easy', label: 'সহজ' },
              { val: 'medium', label: 'মাঝারি' },
              { val: 'hard', label: 'কঠিন' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setSelectedDifficulty(opt.val)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: '0.6rem',
                  border: `2px solid ${selectedDifficulty === opt.val ? '#3b82f6' : border}`,
                  background: selectedDifficulty === opt.val ? '#3b82f620' : 'transparent',
                  color: selectedDifficulty === opt.val ? '#3b82f6' : text,
                  cursor: 'pointer',
                  fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                  fontWeight: selectedDifficulty === opt.val ? '600' : '400',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startPractice}
          style={{
            width: '100%',
            padding: '0.9rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.7rem',
            fontSize: '1rem',
            fontWeight: '600',
            fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
          onMouseLeave={e => (e.currentTarget.style.background = '#3b82f6')}
        >
          অনুশীলন শুরু করুন →
        </button>
      </div>
    </div>
  );

  /* RESULTS STAGE */
  if (stage === 'results') {
    const pct = totalAnswered > 0 ? (score / totalAnswered) * 100 : 0;
    return (
      <div style={{ padding: '2rem', background: bg, minHeight: '100%', fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '1.2rem', padding: '2.5rem', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>
            {pct >= 70 ? '🎉' : pct >= 50 ? '😊' : '💪'}
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '700', color: text, margin: '0 0 1.5rem' }}>
            অনুশীলন সম্পন্ন!
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#10b98120', borderRadius: '0.8rem', padding: '1rem' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#10b981' }}>
                {toBengaliNumber(score)}
              </div>
              <div style={{ color: subText, fontSize: '0.8rem' }}>সঠিক উত্তর</div>
            </div>
            <div style={{ background: '#3b82f620', borderRadius: '0.8rem', padding: '1rem' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#3b82f6' }}>
                {toBengaliNumber(totalAnswered)}
              </div>
              <div style={{ color: subText, fontSize: '0.8rem' }}>মোট প্রশ্ন</div>
            </div>
            <div style={{ background: '#8b5cf620', borderRadius: '0.8rem', padding: '1rem' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#8b5cf6' }}>
                {toBengaliPercent(pct)}
              </div>
              <div style={{ color: subText, fontSize: '0.8rem' }}>স্কোর</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ background: border, borderRadius: '1rem', height: '10px', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`,
              height: '100%',
              background: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444',
              borderRadius: '1rem',
              transition: 'width 0.8s ease',
            }} />
          </div>

          <p style={{ color: text, fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            {getMotivation(pct)}
          </p>

          <button
            onClick={() => { setStage('setup'); setQuestions([]); }}
            style={{
              width: '100%',
              padding: '0.9rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.7rem',
              fontSize: '1rem',
              fontWeight: '600',
              fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
              cursor: 'pointer',
            }}
          >
            নতুন অনুশীলন শুরু করুন
          </button>
        </div>
      </div>
    );
  }

  /* PRACTICING STAGE */
  if (!currentQ) return null;

  const progress = ((currentIdx) / questions.length) * 100;

  return (
    <div style={{ padding: '2rem', background: bg, minHeight: '100%', fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
      {/* Progress */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: subText, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
          <span>প্রশ্ন {toBengaliNumber(currentIdx + 1)} / {toBengaliNumber(questions.length)}</span>
          <span>সঠিক: {toBengaliNumber(score)}</span>
        </div>
        <div style={{ background: border, borderRadius: '1rem', height: '8px', overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: '#3b82f6',
            borderRadius: '1rem',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Question card */}
      <div style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: '1.2rem',
        padding: '2rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{
            background: currentQ.question.difficulty === 'easy' ? '#10b98120' : currentQ.question.difficulty === 'medium' ? '#f59e0b20' : '#ef444420',
            color: currentQ.question.difficulty === 'easy' ? '#10b981' : currentQ.question.difficulty === 'medium' ? '#f59e0b' : '#ef4444',
            padding: '0.2rem 0.7rem',
            borderRadius: '1rem',
            fontSize: '0.8rem',
            fontWeight: '500',
          }}>
            {currentQ.question.difficulty === 'easy' ? 'সহজ' : currentQ.question.difficulty === 'medium' ? 'মাঝারি' : 'কঠিন'}
          </span>
          <span style={{
            background: '#8b5cf620',
            color: '#8b5cf6',
            padding: '0.2rem 0.7rem',
            borderRadius: '1rem',
            fontSize: '0.8rem',
            fontWeight: '500',
          }}>
            {currentQ.question.type === 'mcq' ? 'বহুনির্বাচনী' : 'সংক্ষিপ্ত উত্তর'}
          </span>
        </div>
        <p style={{ fontSize: '1.1rem', color: text, lineHeight: 1.7, margin: 0 }}>
          {currentQ.question.text}
        </p>
      </div>

      {/* Answer options */}
      {currentQ.question.type === 'mcq' && currentQ.question.options ? (
        <div style={{ display: 'grid', gap: '0.7rem', marginBottom: '1.5rem' }}>
          {currentQ.question.options.map((option, idx) => {
            let optBg = darkMode ? '#1e293b' : '#ffffff';
            let optBorder = border;
            let optColor = text;
            if (answered !== null) {
              if (idx === currentQ.question.answer) {
                optBg = '#10b98120'; optBorder = '#10b981'; optColor = '#10b981';
              } else if (idx === answered) {
                optBg = '#ef444420'; optBorder = '#ef4444'; optColor = '#ef4444';
              }
            }
            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={answered !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  padding: '0.9rem 1.2rem',
                  background: optBg,
                  border: `2px solid ${optBorder}`,
                  borderRadius: '0.8rem',
                  cursor: answered !== null ? 'default' : 'pointer',
                  textAlign: 'left',
                  fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                  transition: 'all 0.2s',
                  width: '100%',
                }}
                onMouseEnter={e => {
                  if (answered === null) {
                    (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6';
                  }
                }}
                onMouseLeave={e => {
                  if (answered === null) {
                    (e.currentTarget as HTMLElement).style.borderColor = border;
                  }
                }}
              >
                <span style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: answered !== null && idx === currentQ.question.answer ? '#10b981' : answered !== null && idx === answered ? '#ef4444' : '#3b82f620',
                  color: answered !== null && (idx === currentQ.question.answer || idx === answered) ? 'white' : '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  flexShrink: 0,
                }}>
                  {bengaliOptionLabels[idx]}
                </span>
                <span style={{ color: optColor, fontSize: '1rem' }}>{option}</span>
                {answered !== null && idx === currentQ.question.answer && (
                  <span style={{ marginLeft: 'auto', color: '#10b981', fontSize: '1.2rem' }}>✓</span>
                )}
                {answered !== null && idx === answered && idx !== currentQ.question.answer && (
                  <span style={{ marginLeft: 'auto', color: '#ef4444', fontSize: '1.2rem' }}>✗</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Short answer - show answer directly */
        <div style={{ marginBottom: '1.5rem' }}>
          {answered === null ? (
            <button
              onClick={() => handleAnswer('shown')}
              style={{
                width: '100%',
                padding: '0.9rem',
                background: '#3b82f620',
                border: `2px solid #3b82f6`,
                borderRadius: '0.8rem',
                color: '#3b82f6',
                fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              উত্তর দেখুন
            </button>
          ) : (
            <div style={{
              background: '#10b98120',
              border: `2px solid #10b981`,
              borderRadius: '0.8rem',
              padding: '1rem 1.2rem',
            }}>
              <div style={{ color: '#10b981', fontWeight: '600', marginBottom: '0.3rem', fontSize: '0.9rem' }}>
                উত্তর:
              </div>
              <div style={{ color: text, fontSize: '1rem' }}>
                {currentQ.question.answer as string}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Solution */}
      {showSolution && (
        <div style={{
          background: darkMode ? '#0f2027' : '#f0fdf4',
          border: `1px solid #10b98140`,
          borderRadius: '0.8rem',
          padding: '1.2rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ color: '#10b981', fontWeight: '700', marginBottom: '0.6rem', fontSize: '0.95rem' }}>
            📝 সমাধান:
          </div>
          <pre style={{
            color: text,
            fontSize: '0.9rem',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            margin: 0,
            fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
          }}>
            {currentQ.question.solution}
          </pre>
        </div>
      )}

      {/* Next button */}
      {answered !== null && (
        <button
          onClick={nextQuestion}
          style={{
            width: '100%',
            padding: '0.9rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.7rem',
            fontSize: '1rem',
            fontWeight: '600',
            fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
            cursor: 'pointer',
          }}
        >
          {currentIdx + 1 >= questions.length ? 'ফলাফল দেখুন' : 'পরবর্তী প্রশ্ন →'}
        </button>
      )}
    </div>
  );
}
