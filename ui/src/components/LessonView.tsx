import { useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';
import type { LessonContent, LessonExample, LessonSection } from '../api/client';

interface Props {
  lesson: LessonContent;
  darkMode: boolean;
  /** Admin preview only: show the "answer re-checked" badge on worked examples. */
  showVerification?: boolean;
}

const font = "'Hind Siliguri', 'Noto Sans Bengali', sans-serif";

function palette(dark: boolean) {
  return {
    card: dark ? '#1e293b' : '#ffffff',
    border: dark ? '#334155' : '#e2e8f0',
    text: dark ? '#e2e8f0' : '#1e293b',
    sub: dark ? '#94a3b8' : '#64748b',
    accent: '#3b82f6',
    good: '#10b981',
    warn: '#f59e0b',
    bad: '#ef4444',
    tint: (c: string) => c + '18',
  };
}
type Palette = ReturnType<typeof palette>;

/** Paragraphs are separated by blank lines in the stored text. */
function Paragraphs({ text, c }: { text: string; c: Palette }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} style={{ margin: '0 0 0.8rem', color: c.text, lineHeight: 1.85, fontSize: '1rem', whiteSpace: 'pre-wrap' }}>{p}</p>
      ))}
    </>
  );
}

function Label({ children, color }: { children: React.ReactNode; color: string }) {
  return <div style={{ fontWeight: 700, fontSize: '0.85rem', color, marginBottom: '0.4rem' }}>{children}</div>;
}

function Example({ ex, n, c, showVerification }: { ex: LessonExample; n: number; c: Palette; showVerification?: boolean }) {
  return (
    <div style={{ border: `1px solid ${c.border}`, borderRadius: '0.7rem', padding: '0.9rem 1rem', marginBottom: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: c.accent, fontSize: '0.85rem' }}>উদাহরণ {toBengaliNumber(n)}</span>
        {showVerification && ex.verified === true && (
          <span style={{ fontSize: '0.72rem', color: c.good, background: c.tint(c.good), padding: '0.1rem 0.5rem', borderRadius: '1rem' }}>✓ উত্তর যাচাইকৃত</span>
        )}
        {showVerification && ex.verified === false && (
          <span style={{ fontSize: '0.72rem', color: c.bad, background: c.tint(c.bad), padding: '0.1rem 0.5rem', borderRadius: '1rem' }}>⚠ যাচাই ব্যর্থ — উত্তর মিলিয়ে দেখুন</span>
        )}
        {showVerification && ex.verified === null && (
          <span style={{ fontSize: '0.72rem', color: c.sub, background: c.tint(c.sub), padding: '0.1rem 0.5rem', borderRadius: '1rem' }}>যাচাই করা হয়নি</span>
        )}
      </div>
      <div style={{ color: c.text, fontWeight: 600, marginBottom: '0.5rem', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{ex.problem}</div>
      {ex.steps.length > 0 && (
        <ol style={{ margin: '0 0 0.5rem', paddingLeft: '1.4rem', color: c.text, lineHeight: 1.8 }}>
          {ex.steps.map((s, i) => <li key={i} style={{ whiteSpace: 'pre-wrap' }}>{s}</li>)}
        </ol>
      )}
      {ex.answer && (
        <div style={{ background: c.tint(c.good), color: c.text, borderRadius: '0.5rem', padding: '0.4rem 0.7rem', fontWeight: 600 }}>
          উত্তর: {ex.answer}
        </div>
      )}
    </div>
  );
}

function QuickCheck({ q, n, c }: { q: { question: string; answer: string }; n: number; c: Palette }) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ color: c.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{toBengaliNumber(n)}. {q.question}</div>
      {shown ? (
        <div style={{ color: c.good, fontWeight: 600, marginTop: '0.2rem' }}>উত্তর: {q.answer}</div>
      ) : (
        <button onClick={() => setShown(true)} style={{
          marginTop: '0.25rem', background: 'transparent', border: `1px solid ${c.border}`, color: c.accent,
          borderRadius: '0.4rem', padding: '0.2rem 0.7rem', cursor: 'pointer', fontFamily: font, fontSize: '0.8rem',
        }}>উত্তর দেখুন</button>
      )}
    </div>
  );
}

function Section({ s, n, open, onToggle, c, showVerification }: {
  s: LessonSection; n: number; open: boolean; onToggle: () => void; c: Palette; showVerification?: boolean;
}) {
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '0.9rem', marginBottom: '0.9rem', overflow: 'hidden' }}>
      <button onClick={onToggle} aria-expanded={open} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.8rem', textAlign: 'left', cursor: 'pointer',
        background: 'transparent', border: 'none', padding: '1rem 1.2rem', fontFamily: font, color: c.text,
      }}>
        <span style={{
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: c.tint(c.accent), color: c.accent, fontWeight: 700,
        }}>{toBengaliNumber(n)}</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: '1.05rem' }}>{s.title}</span>
        <span style={{ color: c.sub }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 1.2rem 1.2rem' }}>
          <Paragraphs text={s.explanation} c={c} />

          {s.keyPoints.length > 0 && (
            <div style={{ background: c.tint(c.accent), borderRadius: '0.6rem', padding: '0.8rem 1rem', margin: '0.4rem 0 1rem' }}>
              <Label color={c.accent}>📌 মনে রাখো</Label>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: c.text, lineHeight: 1.8 }}>
                {s.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}

          {s.examples.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <Label color={c.text}>✏️ চলো উদাহরণ দেখি</Label>
              {s.examples.map((ex, i) => <Example key={i} ex={ex} n={i + 1} c={c} showVerification={showVerification} />)}
            </div>
          )}

          {s.commonMistakes.length > 0 && (
            <div style={{ background: c.tint(c.warn), borderRadius: '0.6rem', padding: '0.8rem 1rem', marginBottom: '1rem' }}>
              <Label color={c.warn}>⚠️ সাধারণ ভুল</Label>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: c.text, lineHeight: 1.8 }}>
                {s.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          {s.quickCheck.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <Label color={c.text}>🧠 নিজে চেষ্টা করো</Label>
              {s.quickCheck.map((q, i) => <QuickCheck key={i} q={q} n={i + 1} c={c} />)}
            </div>
          )}

          {s.takeaway && (
            <div style={{ borderLeft: `4px solid ${c.good}`, paddingLeft: '0.8rem', color: c.text, fontWeight: 600, lineHeight: 1.7 }}>
              মূল কথা: {s.takeaway}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The lesson body. Used by the student syllabus page and the admin preview. */
export default function LessonView({ lesson, darkMode, showVerification }: Props) {
  const c = palette(darkMode);
  const [openSet, setOpenSet] = useState<Set<number>>(new Set([0]));

  function toggle(i: number) {
    setOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }
  const allOpen = openSet.size === lesson.sections.length;

  return (
    <div style={{ fontFamily: font }}>
      {lesson.overview && (
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '0.9rem', padding: '1.1rem 1.3rem', marginBottom: '0.9rem' }}>
          <Label color={c.accent}>📖 এই অধ্যায়ে কী শিখব</Label>
          <Paragraphs text={lesson.overview} c={c} />
          {lesson.prerequisites.length > 0 && (
            <>
              <Label color={c.sub}>শুরুর আগে জেনে নাও</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {lesson.prerequisites.map((p, i) => (
                  <span key={i} style={{ background: c.tint(c.sub), color: c.text, borderRadius: '1rem', padding: '0.2rem 0.7rem', fontSize: '0.85rem' }}>{p}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {lesson.sections.length > 1 && (
        <div style={{ textAlign: 'right', marginBottom: '0.5rem' }}>
          <button
            onClick={() => setOpenSet(allOpen ? new Set() : new Set(lesson.sections.map((_, i) => i)))}
            style={{ background: 'transparent', border: 'none', color: c.accent, cursor: 'pointer', fontFamily: font, fontSize: '0.85rem' }}
          >
            {allOpen ? 'সব বন্ধ করুন' : 'সব খুলুন'}
          </button>
        </div>
      )}

      {lesson.sections.map((s, i) => (
        <Section key={i} s={s} n={i + 1} open={openSet.has(i)} onToggle={() => toggle(i)} c={c} showVerification={showVerification} />
      ))}
    </div>
  );
}
