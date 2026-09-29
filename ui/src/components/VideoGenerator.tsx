import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCurriculumClasses, generateVideo, listVideos, getVideo,
  approveVideo, rejectVideo, unpublishVideo, videoUrl,
} from '../api/client';
import type { CurriculumClass, VideoRecord, VideoStatus } from '../api/client';
import { getClassData } from '../data/curriculum';
import type { Chapter } from '../types';
import { adminColors, adminFont, adminBtn, adminInput, adminBadge } from './adminStyles';

interface Props { darkMode: boolean }

const STATUS_LABEL: Record<VideoStatus, string> = {
  generating: 'তৈরি হচ্ছে...', draft: 'প্রস্তুত', approved: 'লাইভ',
  rejected: 'বাতিল', superseded: 'আগের সংস্করণ', failed: 'ব্যর্থ',
};
const STATUS_COLOR: Record<VideoStatus, string> = {
  generating: '#3b82f6', draft: '#f59e0b', approved: '#22c55e',
  rejected: '#ef4444', superseded: '#64748b', failed: '#ef4444',
};
const POLL_INTERVAL_MS = 5000;

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60), s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoGenerator({ darkMode }: Props) {
  const colors = adminColors(darkMode);
  const input = adminInput(colors);

  const [classes, setClasses] = useState<CurriculumClass[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [classId, setClassId] = useState<number | ''>('');
  const [chapterId, setChapterId] = useState('');

  const [versions, setVersions] = useState<VideoRecord[]>([]);
  const [selected, setSelected] = useState<VideoRecord | null>(null);

  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { getCurriculumClasses().then(setClasses).catch(() => {}); }, []);

  useEffect(() => {
    setChapterId(''); setChapters([]);
    if (!classId) return;
    getClassData(classId).then(d => setChapters(d?.chapters ?? [])).catch(() => setChapters([]));
  }, [classId]);

  const refresh = useCallback(async (openId?: string) => {
    if (!classId || !chapterId) { setVersions([]); setSelected(null); return; }
    const rows = await listVideos({ classId, chapterId });
    setVersions(rows);
    const target = openId ?? rows[0]?.id;
    setSelected(target ? await getVideo(target) : null);
  }, [classId, chapterId]);

  useEffect(() => {
    setError(''); setNotice('');
    refresh().catch(err => setError(err?.message || 'ভিডিও লোড করা যায়নি'));
  }, [refresh]);

  // While anything for this chapter is still rendering, poll until it settles
  // (draft/failed) — the Cloud Run Job updates the row outside this session.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const anyGenerating = versions.some(v => v.status === 'generating');
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    if (anyGenerating) {
      pollTimer.current = setInterval(() => { refresh(selected?.id).catch(() => {}); }, POLL_INTERVAL_MS);
    }
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions.map(v => v.status).join(','), refresh]);

  const chapter = chapters.find(c => c.id === chapterId);
  const live = versions.find(v => v.status === 'approved');
  const generating = versions.find(v => v.status === 'generating');

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(''); setNotice('');
    try { await fn(); } catch (err: any) { setError(err?.message || 'কাজটি সম্পন্ন হয়নি'); } finally { setBusy(''); }
  }

  const handleGenerate = () => run('generate', async () => {
    if (!classId) return;
    const row = await generateVideo(classId, chapterId);
    await refresh(row.id);
    setNotice('ভিডিও তৈরি শুরু হয়েছে। এতে কয়েক মিনিট সময় লাগতে পারে — এই পাতা খোলা রাখলে অগ্রগতি নিজে থেকেই আপডেট হবে।');
  });

  const handleApprove = () => run('approve', async () => {
    if (!selected) return;
    const verb = selected.status === 'superseded' ? 'এই আগের সংস্করণটি আবার প্রকাশ করবেন?' : 'এই ভিডিওটি শিক্ষার্থীদের জন্য প্রকাশ করবেন?';
    if (!window.confirm(`${verb}${live && live.id !== selected.id ? '\n(বর্তমান লাইভ ভিডিও আগের সংস্করণে চলে যাবে)' : ''}`)) return;
    await approveVideo(selected.id);
    await refresh(selected.id);
    setNotice('প্রকাশিত হয়েছে — শিক্ষার্থীরা এখন এই ভিডিওটি দেখতে পাবে।');
  });

  const handleReject = () => run('reject', async () => {
    if (!selected || !window.confirm('এই ভিডিওটি বাতিল করবেন?')) return;
    await rejectVideo(selected.id);
    await refresh(selected.id);
  });

  const handleUnpublish = () => run('unpublish', async () => {
    if (!window.confirm('লাইভ ভিডিওটি সরিয়ে নেবেন? শিক্ষার্থীরা আর ভিডিওটি দেখতে পাবে না (সংস্করণটি ইতিহাসে থাকবে)।')) return;
    await unpublishVideo(chapterId);
    await refresh(selected?.id);
    setNotice('ভিডিওটি সরিয়ে নেওয়া হয়েছে।');
  });

  const card: React.CSSProperties = {
    background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1rem',
  };
  const label: React.CSSProperties = { display: 'block', marginBottom: '0.35rem', color: colors.text, fontWeight: 600, fontSize: '0.85rem' };
  const canGenerate = !!chapterId && chapter?.hasLesson && !generating;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: adminFont }}>
      <div style={{ ...card, maxWidth: '760px' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={label}>শ্রেণী *</label>
            <select style={input} value={classId} onChange={e => setClassId(e.target.value ? parseInt(e.target.value) : '')}>
              <option value="">-- শ্রেণী নির্বাচন করুন --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.bengaliName} — {c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: '220px' }}>
            <label style={label}>অধ্যায় *</label>
            <select style={input} value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={!classId}>
              <option value="">-- অধ্যায় নির্বাচন করুন --</option>
              {chapters.map(c => (
                <option key={c.id} value={c.id} disabled={!c.hasLesson}>
                  {c.name}{c.hasVideo ? '  📹' : ''}{!c.hasLesson ? '  (পাঠ নেই)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {chapterId && !chapter?.hasLesson && (
          <div style={{ color: colors.warning, fontSize: '0.85rem', marginBottom: '0.7rem' }}>
            এই অধ্যায়ের কোনো অনুমোদিত পাঠ নেই। ভিডিও তৈরির আগে "পাঠ জেনারেটর" থেকে একটি পাঠ অনুমোদন করুন —
            ভিডিওর কথন (narration) সেই পাঠ থেকেই তৈরি হয়।
          </div>
        )}

        <button style={adminBtn(colors.primary, '#fff', !canGenerate || !!busy)} disabled={!canGenerate || !!busy} onClick={handleGenerate}>
          {generating ? 'তৈরি হচ্ছে...' : 'নতুন ভিডিও তৈরি করুন'}
        </button>
        <span style={{ marginLeft: '0.8rem', color: colors.sub, fontSize: '0.8rem' }}>
          অনুমোদিত পাঠ থেকে বর্ণনাসহ (narration) একটি ভিডিও তৈরি হয় — সময় লাগতে পারে।
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
          <div style={{ ...card, width: '250px', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, color: colors.text, marginBottom: '0.6rem' }}>সংস্করণ</div>
            {versions.length === 0 && <div style={{ color: colors.sub, fontSize: '0.85rem' }}>এই অধ্যায়ের কোনো ভিডিও এখনও তৈরি হয়নি।</div>}
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
                লাইভ ভিডিও সরিয়ে নিন
              </button>
            )}
          </div>

          {selected && (
            <div style={{ ...card, flex: 1, minWidth: '320px' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.9rem' }}>
                <strong style={{ color: colors.text, marginRight: '0.4rem' }}>সংস্করণ {selected.version}</strong>
                <span style={adminBadge(`${STATUS_COLOR[selected.status]}22`, STATUS_COLOR[selected.status])}>{STATUS_LABEL[selected.status]}</span>
                {selected.duration_seconds != null && (
                  <span style={{ color: colors.sub, fontSize: '0.82rem' }}>{formatDuration(selected.duration_seconds)}</span>
                )}
              </div>

              {selected.status === 'generating' && (
                <div style={{ color: colors.sub, fontSize: '0.9rem', padding: '2rem 0', textAlign: 'center' }}>
                  ⏳ ভিডিও তৈরি হচ্ছে — বর্ণনা রেকর্ড ও স্লাইড তৈরি চলছে। এই পাতা খোলা রাখলে প্রতি {POLL_INTERVAL_MS / 1000} সেকেন্ডে অবস্থা আপডেট হবে।
                </div>
              )}

              {selected.status === 'failed' && (
                <div style={{ color: colors.danger, fontSize: '0.9rem', padding: '1rem', background: `${colors.danger}10`, borderRadius: '0.5rem' }}>
                  ভিডিও তৈরি ব্যর্থ হয়েছে: {selected.error || 'অজানা ত্রুটি'}
                </div>
              )}

              {selected.gcs_video_path && (
                <video
                  key={selected.id}
                  controls
                  poster={selected.gcs_thumbnail_path ? videoUrl(selected.gcs_thumbnail_path) : undefined}
                  style={{ width: '100%', maxWidth: '640px', borderRadius: '0.5rem', background: '#000' }}
                >
                  <source src={videoUrl(selected.gcs_video_path)} type="video/mp4" />
                </video>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.2rem', paddingTop: '1rem', borderTop: `1px solid ${colors.border}` }}>
                {selected.status === 'draft' && (
                  <>
                    <button style={adminBtn(colors.success, '#fff', !!busy)} disabled={!!busy} onClick={handleApprove}>অনুমোদন ও প্রকাশ করুন</button>
                    <button style={adminBtn(colors.danger, '#fff', !!busy)} disabled={!!busy} onClick={handleReject}>বাতিল</button>
                  </>
                )}
                {selected.status === 'superseded' && (
                  <button style={adminBtn(colors.success, '#fff', !!busy)} disabled={!!busy} onClick={handleApprove}>এই সংস্করণ আবার প্রকাশ করুন</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
