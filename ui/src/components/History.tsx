import { useState } from 'react';
import { getSessions, getDoubtHistory } from '../utils/storage';
import { toBengaliNumber, toBengaliPercent, toBengaliDate } from '../utils/bengali';

interface Props {
  classId: number;
  darkMode: boolean;
}

export default function History({ classId, darkMode }: Props) {
  const [tab, setTab] = useState<'practice' | 'doubt'>('practice');
  const sessions = getSessions().filter(s => s.classId === classId);
  const doubts = getDoubtHistory().filter(d => d.classId === classId);

  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const activeTab = '#3b82f6';

  return (
    <div style={{ padding: '2rem', background: bg, minHeight: '100%', fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: text, marginBottom: '0.5rem' }}>
        🕐 ইতিহাস
      </h1>
      <p style={{ color: subText, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        তোমার সব কার্যক্রমের রেকর্ড
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', background: cardBg, border: `1px solid ${border}`, borderRadius: '0.8rem', padding: '0.3rem', width: 'fit-content' }}>
        {(['practice', 'doubt'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '0.5rem 1.2rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              background: tab === t ? activeTab : 'transparent',
              color: tab === t ? 'white' : subText,
              fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
              fontWeight: tab === t ? '600' : '400',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            {t === 'practice' ? `✏️ অনুশীলন (${toBengaliNumber(sessions.length)})` : `🤖 সন্দেহ (${toBengaliNumber(doubts.length)})`}
          </button>
        ))}
      </div>

      {tab === 'practice' && (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {sessions.length === 0 ? (
            <EmptyState text="কোনো অনুশীলন ইতিহাস নেই" darkMode={darkMode} />
          ) : (
            sessions.map(session => {
              const pct = session.total > 0 ? (session.score / session.total) * 100 : 0;
              return (
                <div key={session.id} style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: '0.9rem',
                  padding: '1.2rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <div>
                      <div style={{ color: text, fontWeight: '600', fontSize: '0.95rem' }}>
                        {toBengaliDate(session.date)}
                      </div>
                      <div style={{ color: subText, fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        {session.total > 0 ? `${toBengaliNumber(session.score)}/${toBengaliNumber(session.total)} সঠিক • ${toBengaliPercent(pct)}` : 'শুরু করা হয়নি'}
                      </div>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.7rem',
                      borderRadius: '1rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: session.completed ? '#10b98120' : '#f59e0b20',
                      color: session.completed ? '#10b981' : '#f59e0b',
                    }}>
                      {session.completed ? 'সম্পূর্ণ' : 'অসম্পূর্ণ'}
                    </span>
                  </div>
                  {session.total > 0 && (
                    <div style={{ background: border, borderRadius: '1rem', height: '6px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444',
                        borderRadius: '1rem',
                      }} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'doubt' && (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {doubts.length === 0 ? (
            <EmptyState text="কোনো সন্দেহ ইতিহাস নেই" darkMode={darkMode} />
          ) : (
            doubts.map(entry => (
              <div key={entry.id} style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: '0.9rem',
                padding: '1.2rem',
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  {entry.topic && (
                    <span style={{
                      background: '#3b82f620',
                      color: '#3b82f6',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.4rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                    }}>{entry.topic}</span>
                  )}
                  <span style={{ color: subText, fontSize: '0.78rem', marginLeft: 'auto' }}>
                    {toBengaliDate(entry.date)}
                  </span>
                </div>
                <p style={{ color: text, fontWeight: '500', fontSize: '0.9rem', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
                  <span style={{ color: subText, fontSize: '0.8rem' }}>প্রশ্ন: </span>
                  {entry.question}
                </p>
                <p style={{
                  color: subText,
                  fontSize: '0.83rem',
                  margin: 0,
                  lineHeight: 1.6,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}>
                  <span style={{ color: subText, fontSize: '0.8rem' }}>উত্তর: </span>
                  {entry.response.slice(0, 200)}{entry.response.length > 200 ? '...' : ''}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text, darkMode }: { text: string; darkMode: boolean }) {
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const border = darkMode ? '#334155' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${border}`,
      borderRadius: '1rem',
      padding: '3rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>📭</div>
      <p style={{ color: textColor, fontWeight: '600', margin: '0 0 0.3rem', fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>{text}</p>
      <p style={{ color: subText, fontSize: '0.85rem', margin: 0, fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>শুরু করো আর ইতিহাস তৈরি করো!</p>
    </div>
  );
}
