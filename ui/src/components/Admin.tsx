import { useState, useEffect, useCallback } from 'react';
import {
  getAdminClasses, createAdminClass, updateAdminClass, deleteAdminClass,
  getAdminChapters, createAdminChapter, updateAdminChapter, deleteAdminChapter,
  getAdminTopics, createAdminTopic, updateAdminTopic, deleteAdminTopic,
  getAdminQuestions, createAdminQuestion, updateAdminQuestion, deleteAdminQuestion,
  getPreferences, setPreference,
} from '../api/client';
import type {
  AdminClass, AdminChapter, AdminTopic, AdminQuestion,
} from '../api/client';

interface Props { darkMode: boolean }

type Tab = 'structure' | 'questions' | 'settings';

// ── Shared styles ──────────────────────────────────────────────────────────────

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
    inputBg:   dark ? '#0f172a' : '#f8fafc',
  };
}

const font = "'Hind Siliguri', 'Noto Sans Bengali', sans-serif";

function btn(bg: string, color = '#fff'): React.CSSProperties {
  return {
    background: bg, color, border: 'none', borderRadius: '0.4rem',
    padding: '0.35rem 0.8rem', cursor: 'pointer', fontFamily: font,
    fontSize: '0.82rem', fontWeight: 600,
  };
}

function inputStyle(colors: ReturnType<typeof useColors>): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    background: colors.inputBg, color: colors.text,
    border: `1px solid ${colors.border}`, borderRadius: '0.4rem',
    padding: '0.45rem 0.6rem', fontFamily: font, fontSize: '0.9rem',
  };
}

// ── Tiny modal ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, colors }: {
  title: string; onClose: () => void;
  children: React.ReactNode; colors: ReturnType<typeof useColors>;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: colors.surface, borderRadius: '0.75rem', padding: '1.5rem',
        width: '520px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h3 style={{ margin: 0, color: colors.text, fontFamily: font }}>{title}</h3>
          <button onClick={onClose} style={{ ...btn('#6b7280'), padding: '0.2rem 0.6rem' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Structure Tab ─────────────────────────────────────────────────────────────

function StructureTab({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [classes, setClasses]     = useState<AdminClass[]>([]);
  const [chapters, setChapters]   = useState<AdminChapter[]>([]);
  const [topics, setTopics]       = useState<AdminTopic[]>([]);
  const [selClass, setSelClass]   = useState<AdminClass | null>(null);
  const [selChapter, setSelChapter] = useState<AdminChapter | null>(null);

  // modal state
  const [modal, setModal] = useState<
    | { kind: 'class';   item?: AdminClass }
    | { kind: 'chapter'; item?: AdminChapter }
    | { kind: 'topic';   item?: AdminTopic }
    | null
  >(null);
  const [saving, setSaving] = useState(false);

  // form fields
  const [fId, setFId]           = useState('');
  const [fName, setFName]       = useState('');
  const [fBengali, setFBengali] = useState('');
  const [fDesc, setFDesc]       = useState('');

  const loadClasses = useCallback(() =>
    getAdminClasses().then(setClasses).catch(() => {}), []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  function selectClass(c: AdminClass) {
    setSelClass(c); setSelChapter(null); setTopics([]);
    getAdminChapters(c.id).then(setChapters).catch(() => {});
  }

  function selectChapter(ch: AdminChapter) {
    setSelChapter(ch);
    getAdminTopics(ch.id).then(setTopics).catch(() => {});
  }

  function openNew(kind: 'class' | 'chapter' | 'topic') {
    setFId(''); setFName(''); setFBengali(''); setFDesc('');
    setModal({ kind });
  }

  function openEdit(item: AdminClass | AdminChapter | AdminTopic) {
    if ('bengaliName' in item) {
      setFId(String(item.id)); setFName(item.name); setFBengali(item.bengaliName);
      setModal({ kind: 'class', item });
    } else if ('classId' in item) {
      setFId(item.id); setFName(item.name); setFDesc(item.description ?? '');
      setModal({ kind: 'chapter', item });
    } else {
      setFId(item.id); setFName(item.name); setFDesc(item.description ?? '');
      setModal({ kind: 'topic', item });
    }
  }

  async function handleSave() {
    if (!modal || !fName.trim()) return;
    setSaving(true);
    try {
      if (modal.kind === 'class') {
        const id = parseInt(fId);
        if (modal.item) await updateAdminClass(id, { name: fName, bengaliName: fBengali });
        else            await createAdminClass({ id, name: fName, bengaliName: fBengali });
        await loadClasses();
      } else if (modal.kind === 'chapter' && selClass) {
        if (modal.item) await updateAdminChapter(modal.item.id, { name: fName, description: fDesc });
        else            await createAdminChapter({ id: fId, classId: selClass.id, name: fName, description: fDesc });
        const chs = await getAdminChapters(selClass.id);
        setChapters(chs);
      } else if (modal.kind === 'topic' && selChapter) {
        if (modal.item) await updateAdminTopic(modal.item.id, { name: fName, description: fDesc });
        else            await createAdminTopic({ id: fId, chapterId: selChapter.id, name: fName, description: fDesc });
        const tops = await getAdminTopics(selChapter.id);
        setTopics(tops);
      }
      setModal(null);
    } finally { setSaving(false); }
  }

  async function handleDelete(kind: 'class' | 'chapter' | 'topic', id: string | number) {
    if (!confirm('মুছে দিতে চান? এটি সমস্ত সাব-আইটেম মুছে ফেলবে।')) return;
    if (kind === 'class') {
      await deleteAdminClass(id as number); await loadClasses();
      setSelClass(null); setChapters([]); setTopics([]);
    } else if (kind === 'chapter') {
      await deleteAdminChapter(id as string);
      if (selClass) { const chs = await getAdminChapters(selClass.id); setChapters(chs); }
      setSelChapter(null); setTopics([]);
    } else {
      await deleteAdminTopic(id as string);
      if (selChapter) { const tops = await getAdminTopics(selChapter.id); setTopics(tops); }
    }
  }

  const colStyle: React.CSSProperties = {
    flex: 1, background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: '0.6rem', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  };
  const colHead: React.CSSProperties = {
    padding: '0.75rem 1rem', borderBottom: `1px solid ${colors.border}`,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: colors.bg,
  };
  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.55rem 1rem', cursor: 'pointer', gap: '0.5rem',
    background: active ? (colors.primary + '20') : 'transparent',
    borderLeft: active ? `3px solid ${colors.primary}` : '3px solid transparent',
    transition: 'background 0.1s',
  });

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Classes column */}
      <div style={colStyle}>
        <div style={colHead}>
          <span style={{ fontWeight: 700, color: colors.text }}>শ্রেণী</span>
          <button style={btn(colors.primary)} onClick={() => openNew('class')}>+ যোগ করুন</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {classes.map(c => (
            <div key={c.id} style={rowStyle(selClass?.id === c.id)} onClick={() => selectClass(c)}>
              <div>
                <div style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>{c.name}</div>
                <div style={{ color: colors.sub, fontSize: '0.8rem' }}>{c.bengaliName}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button style={btn('#64748b')} onClick={e => { e.stopPropagation(); openEdit(c); }}>সম্পাদনা</button>
                <button style={btn(colors.danger)} onClick={e => { e.stopPropagation(); handleDelete('class', c.id); }}>মুছুন</button>
              </div>
            </div>
          ))}
          {classes.length === 0 && (
            <div style={{ padding: '1rem', color: colors.sub, fontSize: '0.85rem', textAlign: 'center' }}>
              কোনো শ্রেণী নেই
            </div>
          )}
        </div>
      </div>

      {/* Chapters column */}
      <div style={colStyle}>
        <div style={colHead}>
          <span style={{ fontWeight: 700, color: colors.text }}>অধ্যায়</span>
          {selClass && (
            <button style={btn(colors.primary)} onClick={() => openNew('chapter')}>+ যোগ করুন</button>
          )}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!selClass && (
            <div style={{ padding: '1rem', color: colors.sub, fontSize: '0.85rem', textAlign: 'center' }}>
              বাম দিক থেকে শ্রেণী নির্বাচন করুন
            </div>
          )}
          {chapters.map(ch => (
            <div key={ch.id} style={rowStyle(selChapter?.id === ch.id)} onClick={() => selectChapter(ch)}>
              <div>
                <div style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>{ch.name}</div>
                {ch.description && <div style={{ color: colors.sub, fontSize: '0.8rem' }}>{ch.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button style={btn('#64748b')} onClick={e => { e.stopPropagation(); openEdit(ch); }}>সম্পাদনা</button>
                <button style={btn(colors.danger)} onClick={e => { e.stopPropagation(); handleDelete('chapter', ch.id); }}>মুছুন</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topics column */}
      <div style={colStyle}>
        <div style={colHead}>
          <span style={{ fontWeight: 700, color: colors.text }}>বিষয়</span>
          {selChapter && (
            <button style={btn(colors.primary)} onClick={() => openNew('topic')}>+ যোগ করুন</button>
          )}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!selChapter && (
            <div style={{ padding: '1rem', color: colors.sub, fontSize: '0.85rem', textAlign: 'center' }}>
              মাঝ থেকে অধ্যায় নির্বাচন করুন
            </div>
          )}
          {topics.map(t => (
            <div key={t.id} style={rowStyle(false)}>
              <div>
                <div style={{ color: colors.text, fontWeight: 600, fontSize: '0.9rem' }}>{t.name}</div>
                {t.description && <div style={{ color: colors.sub, fontSize: '0.8rem' }}>{t.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button style={btn('#64748b')} onClick={() => openEdit(t)}>সম্পাদনা</button>
                <button style={btn(colors.danger)} onClick={() => handleDelete('topic', t.id)}>মুছুন</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={
            modal.kind === 'class'   ? (modal.item ? 'শ্রেণী সম্পাদনা' : 'নতুন শ্রেণী') :
            modal.kind === 'chapter' ? (modal.item ? 'অধ্যায় সম্পাদনা' : 'নতুন অধ্যায়') :
                                       (modal.item ? 'বিষয় সম্পাদনা' : 'নতুন বিষয়')
          }
          onClose={() => setModal(null)}
          colors={colors}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {!modal.item && (
              <div>
                <label style={{ color: colors.sub, fontSize: '0.82rem' }}>
                  {modal.kind === 'class' ? 'ID (সংখ্যা, যেমন: 5)' : 'ID (যেমন: 5-1 বা 5-1-1)'}
                </label>
                <input style={inputStyle(colors)} value={fId} onChange={e => setFId(e.target.value)} />
              </div>
            )}
            <div>
              <label style={{ color: colors.sub, fontSize: '0.82rem' }}>নাম (ইংরেজি)</label>
              <input style={inputStyle(colors)} value={fName} onChange={e => setFName(e.target.value)} />
            </div>
            {modal.kind === 'class' && (
              <div>
                <label style={{ color: colors.sub, fontSize: '0.82rem' }}>নাম (বাংলা)</label>
                <input style={inputStyle(colors)} value={fBengali} onChange={e => setFBengali(e.target.value)} />
              </div>
            )}
            {(modal.kind === 'chapter' || modal.kind === 'topic') && (
              <div>
                <label style={{ color: colors.sub, fontSize: '0.82rem' }}>বিবরণ</label>
                <input style={inputStyle(colors)} value={fDesc} onChange={e => setFDesc(e.target.value)} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button style={btn('#6b7280')} onClick={() => setModal(null)}>বাতিল</button>
              <button style={btn(colors.primary)} onClick={handleSave} disabled={saving}>
                {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Questions Tab ─────────────────────────────────────────────────────────────

const EMPTY_Q: Omit<AdminQuestion, 'id' | 'topicId'> = {
  type: 'mcq', text: '', answer: '0', solution: '',
  difficulty: 'easy', options: ['', '', '', ''],
};

function QuestionForm({
  value, onChange, colors,
}: {
  value: Omit<AdminQuestion, 'id' | 'topicId'>;
  onChange: (v: Omit<AdminQuestion, 'id' | 'topicId'>) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const inp = inputStyle(colors);
  const ta: React.CSSProperties = { ...inp, resize: 'vertical', minHeight: '80px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ color: colors.sub, fontSize: '0.82rem' }}>ধরন</label>
          <select style={inp} value={value.type}
            onChange={e => onChange({ ...value, type: e.target.value as 'mcq' | 'short', answer: '0' })}>
            <option value="mcq">MCQ</option>
            <option value="short">সংক্ষিপ্ত উত্তর</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ color: colors.sub, fontSize: '0.82rem' }}>কঠিনতা</label>
          <select style={inp} value={value.difficulty}
            onChange={e => onChange({ ...value, difficulty: e.target.value as AdminQuestion['difficulty'] })}>
            <option value="easy">সহজ</option>
            <option value="medium">মাঝারি</option>
            <option value="hard">কঠিন</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ color: colors.sub, fontSize: '0.82rem' }}>প্রশ্ন</label>
        <textarea style={ta} value={value.text}
          onChange={e => onChange({ ...value, text: e.target.value })} />
      </div>

      {value.type === 'mcq' ? (
        <div>
          <label style={{ color: colors.sub, fontSize: '0.82rem' }}>বিকল্পসমূহ (সঠিক উত্তরটি চিহ্নিত করুন)</label>
          {value.options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
              <input
                type="radio"
                name="correct"
                checked={value.answer === String(i)}
                onChange={() => onChange({ ...value, answer: String(i) })}
                style={{ accentColor: colors.primary }}
              />
              <input
                style={{ ...inp, flex: 1 }}
                placeholder={`বিকল্প ${i + 1}`}
                value={opt}
                onChange={e => {
                  const opts = [...value.options];
                  opts[i] = e.target.value;
                  onChange({ ...value, options: opts });
                }}
              />
            </div>
          ))}
          <button
            style={{ ...btn('#64748b'), marginTop: '0.5rem' }}
            onClick={() => onChange({ ...value, options: [...value.options, ''] })}
          >+ বিকল্প যোগ করুন</button>
        </div>
      ) : (
        <div>
          <label style={{ color: colors.sub, fontSize: '0.82rem' }}>সঠিক উত্তর</label>
          <input style={inp} value={value.answer}
            onChange={e => onChange({ ...value, answer: e.target.value })} />
        </div>
      )}

      <div>
        <label style={{ color: colors.sub, fontSize: '0.82rem' }}>সমাধান / ব্যাখ্যা</label>
        <textarea style={{ ...ta, minHeight: '100px' }} value={value.solution}
          onChange={e => onChange({ ...value, solution: e.target.value })} />
      </div>
    </div>
  );
}

function QuestionsTab({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [classes, setClasses]   = useState<AdminClass[]>([]);
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [topics, setTopics]     = useState<AdminTopic[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);

  const [selClassId, setSelClassId]   = useState<number | ''>('');
  const [selChapterId, setSelChapterId] = useState('');
  const [selTopicId, setSelTopicId]   = useState('');

  const [modal, setModal] = useState<{ item?: AdminQuestion; topicId: string } | null>(null);
  const [form, setForm]   = useState<Omit<AdminQuestion, 'id' | 'topicId'>>(EMPTY_Q);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAdminClasses().then(setClasses).catch(() => {}); }, []);

  useEffect(() => {
    if (!selClassId) { setChapters([]); setSelChapterId(''); return; }
    getAdminChapters(selClassId).then(setChapters).catch(() => {});
    setSelChapterId(''); setSelTopicId('');
  }, [selClassId]);

  useEffect(() => {
    if (!selChapterId) { setTopics([]); setSelTopicId(''); return; }
    getAdminTopics(selChapterId).then(setTopics).catch(() => {});
    setSelTopicId('');
  }, [selChapterId]);

  useEffect(() => {
    if (!selClassId) { setQuestions([]); return; }
    const filter = selTopicId   ? { topicId: selTopicId } :
                   selChapterId ? { chapterId: selChapterId } :
                                  { classId: selClassId as number };
    getAdminQuestions(filter).then(setQuestions).catch(() => {});
  }, [selClassId, selChapterId, selTopicId]);

  function refreshQuestions() {
    if (!selClassId) return;
    const filter = selTopicId   ? { topicId: selTopicId } :
                   selChapterId ? { chapterId: selChapterId } :
                                  { classId: selClassId as number };
    getAdminQuestions(filter).then(setQuestions).catch(() => {});
  }

  function openNew() {
    if (!selTopicId) return alert('প্রশ্ন যোগ করতে একটি বিষয় নির্বাচন করুন।');
    setForm({ ...EMPTY_Q });
    setModal({ topicId: selTopicId });
  }

  function openEdit(q: AdminQuestion) {
    setForm({ type: q.type, text: q.text, answer: q.answer, solution: q.solution, difficulty: q.difficulty, options: q.options });
    setModal({ item: q, topicId: q.topicId });
  }

  async function handleSave() {
    if (!modal || !form.text.trim()) return;
    setSaving(true);
    try {
      if (modal.item) {
        await updateAdminQuestion(modal.item.id, form);
      } else {
        await createAdminQuestion({ ...form, id: `q-${Date.now()}`, topicId: modal.topicId });
      }
      setModal(null); refreshQuestions();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('এই প্রশ্নটি মুছে দিতে চান?')) return;
    await deleteAdminQuestion(id);
    refreshQuestions();
  }

  const sel = inputStyle(colors);
  const diffColor = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Filters */}
      <div style={{
        background: colors.surface, border: `1px solid ${colors.border}`,
        borderRadius: '0.6rem', padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={{ color: colors.sub, fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>শ্রেণী</label>
          <select style={sel} value={selClassId} onChange={e => setSelClassId(e.target.value ? parseInt(e.target.value) : '')}>
            <option value="">-- শ্রেণী নির্বাচন --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={{ color: colors.sub, fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>অধ্যায়</label>
          <select style={sel} value={selChapterId} onChange={e => setSelChapterId(e.target.value)} disabled={!selClassId}>
            <option value="">-- সব অধ্যায় --</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '140px' }}>
          <label style={{ color: colors.sub, fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>বিষয়</label>
          <select style={sel} value={selTopicId} onChange={e => setSelTopicId(e.target.value)} disabled={!selChapterId}>
            <option value="">-- সব বিষয় --</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button style={btn(colors.primary)} onClick={openNew}>+ নতুন প্রশ্ন</button>
        </div>
      </div>

      {/* Question list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {!selClassId && (
          <div style={{ textAlign: 'center', color: colors.sub, padding: '3rem', fontSize: '0.9rem' }}>
            উপরে একটি শ্রেণী নির্বাচন করুন
          </div>
        )}
        {selClassId && questions.length === 0 && (
          <div style={{ textAlign: 'center', color: colors.sub, padding: '3rem', fontSize: '0.9rem' }}>
            কোনো প্রশ্ন পাওয়া যায়নি
          </div>
        )}
        {questions.map((q, i) => (
          <div key={q.id} style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: '0.6rem', padding: '0.9rem 1rem',
            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
          }}>
            <div style={{
              minWidth: '28px', height: '28px', borderRadius: '50%', background: colors.primary + '20',
              color: colors.primary, fontSize: '0.8rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: colors.text, fontSize: '0.9rem', marginBottom: '0.4rem' }}>{q.text}</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  background: q.type === 'mcq' ? '#3b82f620' : '#8b5cf620',
                  color: q.type === 'mcq' ? '#3b82f6' : '#8b5cf6',
                  fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '1rem',
                }}>
                  {q.type === 'mcq' ? 'MCQ' : 'সংক্ষিপ্ত'}
                </span>
                <span style={{
                  background: diffColor[q.difficulty] + '20',
                  color: diffColor[q.difficulty],
                  fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '1rem',
                }}>
                  {q.difficulty === 'easy' ? 'সহজ' : q.difficulty === 'medium' ? 'মাঝারি' : 'কঠিন'}
                </span>
                <span style={{ color: colors.sub, fontSize: '0.75rem' }}>ID: {q.id}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
              <button style={btn('#64748b')} onClick={() => openEdit(q)}>সম্পাদনা</button>
              <button style={btn(colors.danger)} onClick={() => handleDelete(q.id)}>মুছুন</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={modal.item ? 'প্রশ্ন সম্পাদনা' : 'নতুন প্রশ্ন'}
          onClose={() => setModal(null)}
          colors={colors}
        >
          <QuestionForm value={form} onChange={setForm} colors={colors} />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button style={btn('#6b7280')} onClick={() => setModal(null)}>বাতিল</button>
            <button style={btn(colors.primary)} onClick={handleSave} disabled={saving}>
              {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [apiKey, setApiKey]     = useState('');
  const [showKey, setShowKey]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    getPreferences().then(p => setApiKey(p.apiKey ?? '')).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await setPreference('api_key', apiKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  const card: React.CSSProperties = {
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: '0.6rem', padding: '1.5rem', maxWidth: '480px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={card}>
        <h3 style={{ margin: '0 0 0.5rem', color: colors.text, fontFamily: font, fontWeight: 700 }}>
          Anthropic API কী
        </h3>
        <p style={{ margin: '0 0 1rem', color: colors.sub, fontSize: '0.85rem' }}>
          AI দিয়ে সন্দেহ সমাধান করতে একটি বৈধ Anthropic API কী প্রয়োজন।
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            style={{ ...inputStyle(colors), flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
          <button style={btn('#64748b')} onClick={() => setShowKey(v => !v)}>
            {showKey ? 'লুকান' : 'দেখুন'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
          <button style={btn(colors.primary)} onClick={handleSave} disabled={saving}>
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </button>
          {saved && (
            <span style={{ color: colors.success, fontSize: '0.85rem' }}>সংরক্ষিত হয়েছে!</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Admin component ───────────────────────────────────────────────────────

export default function Admin({ darkMode }: Props) {
  const colors = useColors(darkMode);
  const [tab, setTab] = useState<Tab>('structure');

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'structure', label: 'পাঠ্যক্রম কাঠামো' },
    { id: 'questions', label: 'প্রশ্ন ব্যবস্থাপনা' },
    { id: 'settings',  label: 'সেটিংস' },
  ];

  return (
    <div style={{
      padding: '1.5rem', minHeight: '100vh', background: colors.bg,
      fontFamily: font, display: 'flex', flexDirection: 'column', gap: '1rem',
    }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, color: colors.text, fontSize: '1.4rem', fontWeight: 800 }}>
          প্রশাসন প্যানেল
        </h2>
        <p style={{ margin: '0.25rem 0 0', color: colors.sub, fontSize: '0.85rem' }}>
          পাঠ্যক্রম, প্রশ্ন এবং সেটিংস পরিচালনা করুন
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.25rem',
        borderBottom: `2px solid ${colors.border}`, paddingBottom: '0',
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: font, fontSize: '0.9rem', fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? colors.primary : colors.sub,
              padding: '0.6rem 1.2rem',
              borderBottom: tab === t.id ? `2px solid ${colors.primary}` : '2px solid transparent',
              marginBottom: '-2px', transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tab === 'structure' && <StructureTab colors={colors} />}
        {tab === 'questions' && <QuestionsTab colors={colors} />}
        {tab === 'settings'  && <SettingsTab  colors={colors} />}
      </div>
    </div>
  );
}
