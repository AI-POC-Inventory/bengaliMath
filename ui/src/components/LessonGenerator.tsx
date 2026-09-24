import { useState, useEffect, useCallback } from 'react';
import {
  getCurriculumClasses, generateLesson, listLessons, getLesson, updateLesson,
  approveLesson, rejectLesson, cloneLesson, unpublishLesson,
} from '../api/client';
import type { CurriculumClass, LessonContent, LessonRecord, LessonSection, LessonStatus } from '../api/client';
import { getClassData } from '../data/curriculum';
import type { Chapter } from '../types';
import LessonView from './LessonView';
import { adminColors, adminFont, adminBtn, adminInput, adminBadge } from './adminStyles';
import type { AdminColors } from './adminStyles';

interface Props { darkMode: boolean }

const STATUS_LABEL: Record<LessonStatus, string> = {
  draft: 'খসড়া', approved: 'লাইভ', rejected: 'বাতিল', superseded: 'আগের সংস্করণ',
};
const STATUS_COLOR: Record<LessonStatus, string> = {
  draft: '#f59e0b', approved: '#22c55e', rejected: '#ef4444', superseded: '#64748b',
};

const EMPTY_SECTION: LessonSection = {
  title: '', explanation: '', keyPoints: [], examples: [], commonMistakes: [], quickCheck: [], takeaway: '',
};

const failedExamples = (c: LessonContent) =>
  c.sections.reduce((n, s) => n + s.examples.filter(e => e.verified === false).length, 0);

// ── Editor building blocks ─────────────────────────────────────────────────

function Field({ label, colors, children }: { label: string; colors: AdminColors; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.7rem' }}>
      <label style={{ display: 'block', marginBottom: '0.25rem', color: colors.sub, fontWeight: 600, fontSize: '0.78rem' }}>{label}</label>
      {children}
    </div>
  );
}

/** Textarea bound to a string[] (one entry per line). Empty lines are kept while
 *  typing and dropped by the server on save. */
function LinesField({ label, value, onChange, colors, rows = 3 }: {
  label: string; value: string[]; onChange: (v: string[]) => void; colors: AdminColors; rows?: number;
}) {
  return (
    <Field label={`${label} (প্রতি লাইনে একটি)`} colors={colors}>
      <textarea style={{ ...adminInput(colors), resize: 'vertical' }} rows={rows}
        value={value.join('\n')} onChange={e => onChange(e.target.value.split('\n'))} />
    </Field>
  );
}

function SectionEditor({ s, n, total, onChange, onMove, onRemove, colors }: {
  s: LessonSection; n: number; total: number; colors: AdminColors;
  onChange: (s: LessonSection) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void;
}) {
  const input = adminInput(colors);
  const set = <K extends keyof LessonSection>(key: K, value: LessonSection[K]) => onChange({ ...s, [key]: value });
  const small = { ...adminBtn('#64748b'), padding: '0.2rem 0.6rem', fontSize: '0.75rem' };

  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: '0.6rem', padding: '1rem', marginBottom: '1rem', background: colors.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.7rem' }}>
        <strong style={{ color: colors.text, flex: 1 }}>অংশ {n}</strong>
        <button style={small} disabled={n === 1} onClick={() => onMove(-1)}>↑</button>
        <button style={small} disabled={n === total} onClick={() => onMove(1)}>↓</button>
        <button style={{ ...small, background: colors.danger }} onClick={onRemove}>মুছুন</button>
      </div>

      <Field label="শিরোনাম *" colors={colors}>
        <input style={input} value={s.title} onChange={e => set('title', e.target.value)} />
      </Field>
      <Field label="ব্যাখ্যা * (অনুচ্ছেদের মাঝে ফাঁকা লাইন)" colors={colors}>
        <textarea style={{ ...input, resize: 'vertical' }} rows={8} value={s.explanation} onChange={e => set('explanation', e.target.value)} />
      </Field>
      <LinesField label="মনে রাখো" value={s.keyPoints} onChange={v => set('keyPoints', v)} colors={colors} />

      <div style={{ marginBottom: '0.7rem' }}>
        <div style={{ color: colors.sub, fontWeight: 600, fontSize: '0.78rem', marginBottom: '0.3rem' }}>উদাহরণ</div>
        {s.examples.map((ex, i) => (
          <div key={i} style={{ border: `1px dashed ${colors.border}`, borderRadius: '0.5rem', padding: '0.7rem', marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>উদাহরণ {i + 1}</span>
              {ex.verified === false && <span style={adminBadge(`${colors.danger}20`, colors.danger)}>⚠ যাচাই ব্যর্থ</span>}
              {ex.verified === true && <span style={adminBadge(`${colors.success}20`, colors.success)}>✓ যাচাইকৃত</span>}
              <button style={{ ...adminBtn(colors.danger), padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                onClick={() => set('examples', s.examples.filter((_, j) => j !== i))}>মুছুন</button>
            </div>
            <Field label="সমস্যা" colors={colors}>
              <textarea style={{ ...input, resize: 'vertical' }} rows={2} value={ex.problem}
                onChange={e => set('examples', s.examples.map((x, j) => j === i ? { ...x, problem: e.target.value, verified: null } : x))} />
            </Field>
            <LinesField label="ধাপ" value={ex.steps} colors={colors} rows={4}
              onChange={v => set('examples', s.examples.map((x, j) => j === i ? { ...x, steps: v, verified: null } : x))} />
            <Field label="উত্তর" colors={colors}>
              <input style={input} value={ex.answer}
                onChange={e => set('examples', s.examples.map((x, j) => j === i ? { ...x, answer: e.target.value, verified: null } : x))} />
            </Field>
          </div>
        ))}
        <button style={adminBtn('#64748b')}
          onClick={() => set('examples', [...s.examples, { problem: '', steps: [], answer: '', verified: null }])}>+ উদাহরণ যোগ করুন</button>
      </div>

      <LinesField label="সাধারণ ভুল" value={s.commonMistakes} onChange={v => set('commonMistakes', v)} colors={colors} />

      <div style={{ marginBottom: '0.7rem' }}>
        <div style={{ color: colors.sub, fontWeight: 600, fontSize: '0.78rem', marginBottom: '0.3rem' }}>নিজে চেষ্টা করো (প্রশ্ন ও উত্তর)</div>
        {s.quickCheck.map((q, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <input style={{ ...input, flex: 2 }} placeholder="প্রশ্ন" value={q.question}
              onChange={e => set('quickCheck', s.quickCheck.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} />
            <input style={{ ...input, flex: 1 }} placeholder="উত্তর" value={q.answer}
              onChange={e => set('quickCheck', s.quickCheck.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))} />
            <button style={{ ...adminBtn(colors.danger), padding: '0.2rem 0.6rem' }}
              onClick={() => set('quickCheck', s.quickCheck.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button style={adminBtn('#64748b')} onClick={() => set('quickCheck', [...s.quickCheck, { question: '', answer: '' }])}>+ প্রশ্ন যোগ করুন</button>
      </div>

      <Field label="মূল কথা (এক বাক্যে)" colors={colors}>
        <input style={input} value={s.takeaway} onChange={e => set('takeaway', e.target.value)} />
      </Field>
    </div>
  );
}

function LessonEditor({ content, onChange, colors }: {
  content: LessonContent; onChange: (c: LessonContent) => void; colors: AdminColors;
}) {
  const setSection = (i: number, s: LessonSection) =>
    onChange({ ...content, sections: content.sections.map((x, j) => j === i ? s : x) });
  const move = (i: number, dir: -1 | 1) => {
    const arr = [...content.sections];
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    onChange({ ...content, sections: arr });
  };

  return (
    <div>
      <Field label="ভূমিকা (এই অধ্যায়ে কী শিখব)" colors={colors}>
        <textarea style={{ ...adminInput(colors), resize: 'vertical' }} rows={4}
          value={content.overview} onChange={e => onChange({ ...content, overview: e.target.value })} />
      </Field>
      <LinesField label="শুরুর আগে জেনে নাও" value={content.prerequisites} colors={colors}
        onChange={v => onChange({ ...content, prerequisites: v })} />

      {content.sections.map((s, i) => (
        <SectionEditor key={i} s={s} n={i + 1} total={content.sections.length} colors={colors}
          onChange={ns => setSection(i, ns)} onMove={dir => move(i, dir)}
          onRemove={() => onChange({ ...content, sections: content.sections.filter((_, j) => j !== i) })} />
      ))}
      <button style={adminBtn(colors.primary)}
        onClick={() => onChange({ ...content, sections: [...content.sections, { ...EMPTY_SECTION }] })}>+ নতুন অংশ যোগ করুন</button>
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function LessonGenerator({ darkMode }: Props) {
  const colors = adminColors(darkMode);
  const input = adminInput(colors);

  const [classes, setClasses] = useState<CurriculumClass[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [classId, setClassId] = useState<number | ''>('');
  const [chapterId, setChapterId] = useState('');

  const [versions, setVersions] = useState<LessonRecord[]>([]);
  const [selected, setSelected] = useState<LessonRecord | null>(null);
  const [draft, setDraft] = useState<LessonContent | null>(null);   // working copy of selected.content
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const [busy, setBusy] = useState('');          // label of the running action, '' = idle
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { getCurriculumClasses().then(setClasses).catch(() => {}); }, []);

  useEffect(() => {
    setChapterId(''); setChapters([]);
    if (!classId) return;
    getClassData(classId).then(d => setChapters(d?.chapters ?? [])).catch(() => setChapters([]));
  }, [classId]);

  const refresh = useCallback(async (openId?: string) => {
    if (!classId || !chapterId) { setVersions([]); setSelected(null); setDraft(null); return; }
    const rows = await listLessons({ classId, chapterId });
    setVersions(rows);
    const target = openId ?? rows[0]?.id;
    if (target) {
      const full = await getLesson(target);
      setSelected(full); setDraft(full.content ?? null);
      setMode(full.status === 'draft' ? 'edit' : 'preview');
    } else {
      setSelected(null); setDraft(null);
    }
  }, [classId, chapterId]);

  useEffect(() => {
    setError(''); setNotice('');
    refresh().catch(err => setError(err?.message || 'পাঠ লোড করা যায়নি'));
  }, [refresh]);

  const isDraft = selected?.status === 'draft';
  const dirty = !!(selected && draft && JSON.stringify(draft) !== JSON.stringify(selected.content));
  const live = versions.find(v => v.status === 'approved');
  const failed = draft ? failedExamples(draft) : 0;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(''); setNotice('');
    try { await fn(); } catch (err: any) { setError(err?.message || 'কাজটি সম্পন্ন হয়নি'); } finally { setBusy(''); }
  }

  const handleGenerate = () => run('generate', async () => {
    if (!classId) return;
    const row = await generateLesson(classId, chapterId);
    await refresh(row.id);
    setNotice('নতুন খসড়া তৈরি হয়েছে। প্রকাশের আগে ভালোভাবে পড়ে দেখুন।');
  });

  const save = async (): Promise<boolean> => {
    if (!selected || !draft) return false;
    const saved = await updateLesson(selected.id, draft);
    setSelected(saved); setDraft(saved.content ?? draft);
    return true;
  };

  const handleSave = () => run('save', async () => { await save(); setNotice('সংরক্ষণ করা হয়েছে।'); });

  const handleApprove = () => run('approve', async () => {
    if (!selected) return;
    const warn = failed > 0
      ? `${failed}টি উদাহরণের উত্তর যাচাইয়ে মেলেনি।\n\n`
      : '';
    const verb = selected.status === 'superseded' ? 'এই আগের সংস্করণটি আবার প্রকাশ করবেন?' : 'এই পাঠটি শিক্ষার্থীদের জন্য প্রকাশ করবেন?';
    if (!window.confirm(`${warn}${verb}${live && live.id !== selected.id ? '\n(বর্তমান লাইভ পাঠ আগের সংস্করণে চলে যাবে)' : ''}`)) return;
    if (isDraft && dirty) await save();
    await approveLesson(selected.id);
    await refresh(selected.id);
    setNotice('প্রকাশিত হয়েছে — শিক্ষার্থীরা এখন এই পাঠটি দেখতে পাবে।');
  });

  const handleReject = () => run('reject', async () => {
    if (!selected || !window.confirm('এই খসড়াটি বাতিল করবেন?')) return;
    await rejectLesson(selected.id);
    await refresh(selected.id);
  });

  const handleClone = () => run('clone', async () => {
    if (!selected) return;
    const row = await cloneLesson(selected.id);
    await refresh(row.id);
    setNotice('নতুন খসড়া তৈরি হয়েছে — এখানে সম্পাদনা করুন।');
  });

  const handleUnpublish = () => run('unpublish', async () => {
    if (!window.confirm('লাইভ পাঠটি সরিয়ে নেবেন? শিক্ষার্থীরা আর পাঠটি দেখতে পাবে না (সংস্করণটি ইতিহাসে থাকবে)।')) return;
    await unpublishLesson(chapterId);
    await refresh(selected?.id);
    setNotice('পাঠটি সরিয়ে নেওয়া হয়েছে।');
  });

  const card: React.CSSProperties = {
    background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1rem',
  };
  const generating = busy === 'generate';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: adminFont }}>
      {/* Chapter picker + generate */}
      <div style={{ ...card, maxWidth: '760px' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <Field label="শ্রেণী *" colors={colors}>
              <select style={input} value={classId} onChange={e => setClassId(e.target.value ? parseInt(e.target.value) : '')}>
                <option value="">-- শ্রেণী নির্বাচন করুন --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.bengaliName} — {c.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ flex: 2, minWidth: '220px' }}>
            <Field label="অধ্যায় *" colors={colors}>
              <select style={input} value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={!classId}>
                <option value="">-- অধ্যায় নির্বাচন করুন --</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.name}{c.hasLesson ? '  📖' : ''}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <button style={adminBtn(colors.primary, '#fff', !chapterId || !!busy)} disabled={!chapterId || !!busy} onClick={handleGenerate}>
          {generating ? 'পাঠ তৈরি হচ্ছে... (১-২ মিনিট সময় লাগতে পারে)' : 'নতুন পাঠ তৈরি করুন'}
        </button>
        <span style={{ marginLeft: '0.8rem', color: colors.sub, fontSize: '0.8rem' }}>
          পাঠ্যবইয়ের বিষয়বস্তু থেকে খসড়া তৈরি হয় — প্রকাশের আগে আপনি দেখে নেবেন।
        </span>
      </div>

      {error && (
        <div style={{ background: `${colors.danger}15`, border: `1px solid ${colors.danger}`, borderRadius: '0.4rem', padding: '0.75rem', marginBottom: '1rem', color: colors.danger, fontSize: '0.85rem' }}>{error}</div>
      )}
      {notice && (
        <div style={{ background: `${colors.success}15`, border: `1px solid ${colors.success}`, borderRadius: '0.4rem', padding: '0.75rem', marginBottom: '1rem', color: colors.text, fontSize: '0.85rem' }}>{notice}</div>
      )}

      {chapterId && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Version history */}
          <div style={{ ...card, width: '250px', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, color: colors.text, marginBottom: '0.6rem' }}>সংস্করণ</div>
            {versions.length === 0 && <div style={{ color: colors.sub, fontSize: '0.85rem' }}>এই অধ্যায়ের কোনো পাঠ এখনও তৈরি হয়নি।</div>}
            {versions.map(v => (
              <div key={v.id} onClick={() => !busy && run('open', () => refresh(v.id))} style={{
                border: `1px solid ${selected?.id === v.id ? colors.primary : colors.border}`, borderRadius: '0.5rem',
                padding: '0.55rem 0.7rem', marginBottom: '0.5rem', cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: colors.text, fontWeight: 600, fontSize: '0.88rem' }}>সংস্করণ {v.version}</span>
                  <span style={adminBadge(`${STATUS_COLOR[v.status]}22`, STATUS_COLOR[v.status])}>{STATUS_LABEL[v.status]}</span>
                </div>
                <div style={{ color: colors.sub, fontSize: '0.72rem', marginTop: '0.2rem' }}>{new Date(v.created_at).toLocaleString('bn-IN')}</div>
              </div>
            ))}
            {live && (
              <button style={{ ...adminBtn(colors.danger), width: '100%', marginTop: '0.4rem' }} disabled={!!busy} onClick={handleUnpublish}>
                লাইভ পাঠ সরিয়ে নিন
              </button>
            )}
          </div>

          {/* Editor / preview */}
          {selected && draft && (
            <div style={{ ...card, flex: 1, minWidth: '320px' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.9rem' }}>
                <strong style={{ color: colors.text, marginRight: '0.4rem' }}>সংস্করণ {selected.version}</strong>
                <span style={adminBadge(`${STATUS_COLOR[selected.status]}22`, STATUS_COLOR[selected.status])}>{STATUS_LABEL[selected.status]}</span>
                {failed > 0 && <span style={adminBadge(`${colors.danger}20`, colors.danger)}>⚠ {failed}টি উদাহরণ যাচাই ব্যর্থ</span>}
                <span style={{ flex: 1 }} />
                {isDraft && (
                  <>
                    <button style={adminBtn(mode === 'edit' ? colors.primary : '#64748b')} onClick={() => setMode('edit')}>সম্পাদনা</button>
                    <button style={adminBtn(mode === 'preview' ? colors.primary : '#64748b')} onClick={() => setMode('preview')}>প্রিভিউ</button>
                  </>
                )}
              </div>

              {isDraft && mode === 'edit'
                ? <LessonEditor content={draft} onChange={setDraft} colors={colors} />
                : <LessonView lesson={draft} darkMode={darkMode} showVerification />}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.2rem', paddingTop: '1rem', borderTop: `1px solid ${colors.border}` }}>
                {isDraft && (
                  <>
                    <button style={adminBtn(colors.success, '#fff', !!busy)} disabled={!!busy} onClick={handleApprove}>
                      {dirty ? 'সংরক্ষণ করে প্রকাশ করুন' : 'অনুমোদন ও প্রকাশ করুন'}
                    </button>
                    <button style={adminBtn(colors.primary, '#fff', !dirty || !!busy)} disabled={!dirty || !!busy} onClick={handleSave}>সংরক্ষণ</button>
                    <button style={adminBtn(colors.danger, '#fff', !!busy)} disabled={!!busy} onClick={handleReject}>বাতিল</button>
                  </>
                )}
                {selected.status === 'superseded' && (
                  <button style={adminBtn(colors.success, '#fff', !!busy)} disabled={!!busy} onClick={handleApprove}>এই সংস্করণ আবার প্রকাশ করুন</button>
                )}
                {!isDraft && (
                  <button style={adminBtn(colors.primary, '#fff', !!busy)} disabled={!!busy} onClick={handleClone}>কপি করে নতুন খসড়া</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
