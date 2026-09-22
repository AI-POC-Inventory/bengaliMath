import { useState, useEffect, useCallback } from 'react';
import {
  getCurriculumClasses, generateQuestions, getStagingQuestions,
  approveStaged, rejectStaged, batchApproveStaged, batchRejectStaged,
} from '../api/client';
import type {
  CurriculumClass, DifficultyMix, QuestionType, StagingStatus, StagedQuestion,
} from '../api/client';
import { getClassData } from '../data/curriculum';
import type { Chapter, Topic } from '../types';

interface Props { darkMode: boolean }

// ── Shared styles (mirrors Admin.tsx exactly — same visual language) ──────

function useColors(dark: boolean) {
  return {
    bg:        dark ? '#0f172a' : '#f8fafc',
    surface:   dark ? '#1e293b' : '#ffffff',
    border:    dark ? '#334155' : '#e2e8f0',
    text:      dark ? '#f1f5f9' : '#1e293b',
    sub:       dark ? '#94a3b8' : '#64748b',
    primary:   '#2563eb',
    danger:    '#ef4444',
    success:   '#22c55e',
    warning:   '#f59e0b',
    inputBg:   dark ? '#0f172a' : '#f8fafc',
  };
}

const font = "'Hind Siliguri', 'Noto Sans Bengali', sans-serif";

function btn(bg: string, color = '#fff', disabled = false): React.CSSProperties {
  return {
    background: disabled ? '#94a3b8' : bg, color, border: 'none', borderRadius: '0.4rem',
    padding: '0.45rem 1rem', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: font,
    fontSize: '0.85rem', fontWeight: 600, opacity: disabled ? 0.6 : 1,
  };
}

function inputStyle(colors: ReturnType<typeof useColors>): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box', background: colors.inputBg, color: colors.text,
    border: `1px solid ${colors.border}`, borderRadius: '0.4rem',
    padding: '0.45rem 0.6rem', fontFamily: font, fontSize: '0.9rem',
  };
}

const DIFF_COLOR = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' } as const;
const DIFF_LABEL = { easy: 'সহজ', medium: 'মাঝারি', hard: 'কঠিন' } as const;
const STATUS_LABEL: Record<StagingStatus, string> = { pending: 'অপেক্ষমাণ', approved: 'অনুমোদিত', rejected: 'বাতিল' };

function badge(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '1rem', fontWeight: 600 };
}

// ── Generate view ───────────────────────────────────────────────────────────

function GenerateView({ colors, onGenerated }: {
  colors: ReturnType<typeof useColors>;
  onGenerated: (batchId: string) => void;
}) {
  const [classes, setClasses] = useState<CurriculumClass[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [classId, setClassId] = useState<number | ''>('');
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');

  const [count, setCount] = useState(20);
  const [mix, setMix] = useState<DifficultyMix>({ easy: 30, medium: 50, hard: 20 });
  const [qType, setQType] = useState<QuestionType>('mcq');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getCurriculumClasses().then(setClasses).catch(() => {}); }, []);

  useEffect(() => {
    setChapterId(''); setTopicId(''); setChapters([]); setTopics([]);
    if (!classId) return;
    getClassData(classId).then(data => setChapters(data?.chapters ?? [])).catch(() => setChapters([]));
  }, [classId]);

  useEffect(() => {
    setTopicId('');
    const chapter = chapters.find(c => c.id === chapterId);
    setTopics(chapter?.topics ?? []);
  }, [chapterId, chapters]);

  const mixSum = mix.easy + mix.medium + mix.hard;
  const mixValid = mixSum === 100;
  const canGenerate = !!classId && !!chapterId && !!topicId && count >= 1 && count <= 100 && mixValid && !loading;

  function setMixField(field: keyof DifficultyMix, value: number) {
    setMix(prev => ({ ...prev, [field]: Math.max(0, Math.min(100, value)) }));
  }

  async function handleGenerate() {
    if (!canGenerate || !classId) return;
    setLoading(true); setError('');
    try {
      const result = await generateQuestions({ classId, chapterId, topicId, count, difficultyMix: mix, questionType: qType });
      onGenerated(result.batchId);
    } catch (err: any) {
      setError(err?.message || 'প্রশ্ন তৈরি করা যায়নি');
    } finally {
      setLoading(false);
    }
  }

  const sel = inputStyle(colors);
  const card: React.CSSProperties = {
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '640px',
  };
  const label: React.CSSProperties = { display: 'block', marginBottom: '0.35rem', color: colors.text, fontWeight: 600, fontSize: '0.85rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={card}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={label}>শ্রেণী (Class) *</label>
          <select style={sel} value={classId} onChange={e => setClassId(e.target.value ? parseInt(e.target.value) : '')}>
            <option value="">-- শ্রেণী নির্বাচন করুন --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.bengaliName} — {c.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={label}>অধ্যায় (Chapter) *</label>
            <select style={sel} value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={!classId}>
              <option value="">-- অধ্যায় নির্বাচন করুন --</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>বিষয় (Topic) *</label>
            <select style={sel} value={topicId} onChange={e => setTopicId(e.target.value)} disabled={!chapterId}>
              <option value="">-- বিষয় নির্বাচন করুন --</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={label}>প্রশ্নের সংখ্যা (সর্বোচ্চ ১০০) *</label>
            <input
              type="number" min={1} max={100} style={sel} value={count}
              onChange={e => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>প্রশ্নের ধরন</label>
            <select style={sel} value={qType} onChange={e => setQType(e.target.value as QuestionType)}>
              <option value="mcq">MCQ</option>
              <option value="short">সংক্ষিপ্ত উত্তর</option>
              <option value="mixed">মিশ্র (৭০% MCQ)</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '0.4rem' }}>
          <label style={label}>কঠিনতার অনুপাত (শতাংশ, যোগফল ১০০ হতে হবে)</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {(['easy', 'medium', 'hard'] as const).map(level => (
              <div key={level} style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: DIFF_COLOR[level] }} />
                  <span style={{ fontSize: '0.78rem', color: colors.sub }}>{DIFF_LABEL[level]}</span>
                </div>
                <input
                  type="number" min={0} max={100} style={sel} value={mix[level]}
                  onChange={e => setMixField(level, parseInt(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.78rem', marginTop: '0.35rem', color: mixValid ? colors.success : colors.danger }}>
            যোগফল: {mixSum}% {mixValid ? '✓' : '(১০০% হতে হবে)'}
          </div>
        </div>

        {error && (
          <div style={{
            background: `${colors.danger}15`, border: `1px solid ${colors.danger}`, borderRadius: '0.4rem',
            padding: '0.75rem', margin: '0.75rem 0', color: colors.danger, fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}

        <button style={{ ...btn(colors.primary, '#fff', !canGenerate), marginTop: '0.5rem' }}
          onClick={handleGenerate} disabled={!canGenerate}>
          {loading ? 'তৈরি হচ্ছে... (কয়েক মিনিট সময় লাগতে পারে)' : 'প্রশ্ন তৈরি করুন'}
        </button>
      </div>
    </div>
  );
}

// ── Review view ───────────────────────────────────────────────────────────

function ReviewCard({ q, checked, onToggle, onApprove, onReject, colors }: {
  q: StagedQuestion; checked: boolean; onToggle: () => void;
  onApprove: () => void; onReject: () => void; colors: ReturnType<typeof useColors>;
}) {
  const isPending = q.status === 'pending';
  return (
    <div style={{
      background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '0.6rem',
      padding: '0.9rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
      opacity: isPending ? 1 : 0.7,
    }}>
      {isPending && (
        <input type="checkbox" checked={checked} onChange={onToggle} style={{ marginTop: '0.3rem', accentColor: colors.primary }} />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span style={badge(q.type === 'mcq' ? '#3b82f620' : '#8b5cf620', q.type === 'mcq' ? '#3b82f6' : '#8b5cf6')}>
            {q.type === 'mcq' ? 'MCQ' : 'সংক্ষিপ্ত'}
          </span>
          <span style={badge(`${DIFF_COLOR[q.difficulty]}20`, DIFF_COLOR[q.difficulty])}>{DIFF_LABEL[q.difficulty]}</span>
          <span style={badge(colors.border, colors.sub)}>{STATUS_LABEL[q.status]}</span>
          {q.possible_duplicate_of && (
            <span style={badge(`${colors.warning}20`, colors.warning)} title={`মিল থাকা প্রশ্ন ID: ${q.possible_duplicate_of}`}>
              ⚠ সম্ভাব্য পুনরাবৃত্তি ({Math.round((q.similarity_score ?? 0) * 100)}%)
            </span>
          )}
        </div>

        <div style={{ color: colors.text, fontSize: '0.92rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>{q.text}</div>

        {q.type === 'mcq' && q.options && (
          <div style={{ marginBottom: '0.5rem' }}>
            {q.options.map((opt, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0', fontSize: '0.85rem',
                color: String(idx) === q.answer ? colors.success : colors.text,
                fontWeight: String(idx) === q.answer ? 600 : 400,
              }}>
                <span style={{ minWidth: '18px' }}>({idx + 1})</span>
                <span>{opt}</span>
                {String(idx) === q.answer && <span>✓</span>}
              </div>
            ))}
          </div>
        )}
        {q.type === 'short' && (
          <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: colors.sub }}>উত্তর: </span>
            <span style={{ color: colors.success, fontWeight: 600 }}>{q.answer}</span>
          </div>
        )}

        {q.solution && (
          <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '0.4rem', padding: '0.6rem', fontSize: '0.82rem', color: colors.text, whiteSpace: 'pre-wrap' }}>
            {q.solution}
          </div>
        )}
      </div>

      {isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flexShrink: 0 }}>
          <button style={btn(colors.success)} onClick={onApprove}>অনুমোদন</button>
          <button style={btn(colors.danger)} onClick={onReject}>বাতিল</button>
        </div>
      )}
    </div>
  );
}

function ReviewView({ colors, batchId }: { colors: ReturnType<typeof useColors>; batchId: string }) {
  const [status, setStatus] = useState<StagingStatus | 'all'>('pending');
  const [items, setItems] = useState<StagedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getStagingQuestions({ batchId, status: status === 'all' ? undefined : status })
      .then(rows => { setItems(rows); setSelected(new Set()); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [batchId, status]);

  useEffect(() => { load(); }, [load]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function approveOne(id: string) { setBusy(true); try { await approveStaged(id); load(); } finally { setBusy(false); } }
  async function rejectOne(id: string) { setBusy(true); try { await rejectStaged(id); load(); } finally { setBusy(false); } }

  async function approveSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    try { await batchApproveStaged([...selected]); load(); } finally { setBusy(false); }
  }
  async function rejectSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    try { await batchRejectStaged([...selected]); load(); } finally { setBusy(false); }
  }
  async function approveAllPending() {
    const ids = items.filter(i => i.status === 'pending').map(i => i.id);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length}টি প্রশ্ন অনুমোদন করতে চান?`)) return;
    setBusy(true);
    try { await batchApproveStaged(ids); load(); } finally { setBusy(false); }
  }
  async function rejectAllPending() {
    const ids = items.filter(i => i.status === 'pending').map(i => i.id);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length}টি প্রশ্ন বাতিল করতে চান?`)) return;
    setBusy(true);
    try { await batchRejectStaged(ids); load(); } finally { setBusy(false); }
  }

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const tabs: Array<{ id: StagingStatus | 'all'; label: string }> = [
    { id: 'pending', label: 'অপেক্ষমাণ' }, { id: 'approved', label: 'অনুমোদিত' },
    { id: 'rejected', label: 'বাতিল' }, { id: 'all', label: 'সব' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setStatus(t.id)}
              style={btn(status === t.id ? colors.primary : '#64748b')}>
              {t.label}
            </button>
          ))}
        </div>
        {status === 'pending' && pendingCount > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button style={btn(colors.success, '#fff', busy || selected.size === 0)} onClick={approveSelected} disabled={busy || selected.size === 0}>
              নির্বাচিত অনুমোদন ({selected.size})
            </button>
            <button style={btn(colors.danger, '#fff', busy || selected.size === 0)} onClick={rejectSelected} disabled={busy || selected.size === 0}>
              নির্বাচিত বাতিল ({selected.size})
            </button>
            <button style={btn(colors.success, '#fff', busy)} onClick={approveAllPending} disabled={busy}>সব অনুমোদন করুন</button>
            <button style={btn(colors.danger, '#fff', busy)} onClick={rejectAllPending} disabled={busy}>সব বাতিল করুন</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {loading && <div style={{ textAlign: 'center', color: colors.sub, padding: '2rem' }}>লোড হচ্ছে...</div>}
        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', color: colors.sub, padding: '3rem', fontSize: '0.9rem' }}>কোনো প্রশ্ন পাওয়া যায়নি</div>
        )}
        {!loading && items.map(q => (
          <ReviewCard key={q.id} q={q} checked={selected.has(q.id)} onToggle={() => toggle(q.id)}
            onApprove={() => approveOne(q.id)} onReject={() => rejectOne(q.id)} colors={colors} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function QuestionGenerator({ darkMode }: Props) {
  const colors = useColors(darkMode);
  const [subTab, setSubTab] = useState<'generate' | 'review'>('generate');
  const [batchId, setBatchId] = useState<string>('');

  function handleGenerated(newBatchId: string) {
    setBatchId(newBatchId);
    setSubTab('review');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', fontFamily: font }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => setSubTab('generate')} style={{ ...btn(subTab === 'generate' ? colors.primary : '#64748b'), fontWeight: subTab === 'generate' ? 700 : 400 }}>
          তৈরি করুন
        </button>
        <button onClick={() => setSubTab('review')} disabled={!batchId}
          style={{ ...btn(subTab === 'review' ? colors.primary : '#64748b', '#fff', !batchId), fontWeight: subTab === 'review' ? 700 : 400 }}>
          পর্যালোচনা {batchId && `(${batchId.split('_')[1]})`}
        </button>
      </div>

      {subTab === 'generate' && <GenerateView colors={colors} onGenerated={handleGenerated} />}
      {subTab === 'review' && batchId && <ReviewView colors={colors} batchId={batchId} />}
    </div>
  );
}
