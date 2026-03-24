import { getSessions } from '../utils/storage';
import { getClassData } from '../data/curriculum';
import { toBengaliNumber, toBengaliPercent } from '../utils/bengali';

interface Props {
  classId: number;
  darkMode: boolean;
}

export default function Progress({ classId, darkMode }: Props) {
  const sessions = getSessions().filter(s => s.classId === classId);
  const classData = getClassData(classId);

  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const cardBg = darkMode ? '#1e293b' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const border = darkMode ? '#334155' : '#e2e8f0';

  const totalAttempted = sessions.reduce((a, s) => a + s.total, 0);
  const totalCorrect = sessions.reduce((a, s) => a + s.score, 0);
  const completedSessions = sessions.filter(s => s.completed).length;
  const overallPct = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;

  // Topic breakdown
  const topicStats: Record<string, { attempted: number; correct: number; name: string }> = {};
  for (const session of sessions) {
    for (const sq of session.questions) {
      if (!topicStats[sq.topicId]) {
        // Find topic name
        let topicName = sq.topicId;
        if (classData) {
          for (const ch of classData.chapters) {
            const t = ch.topics.find(t => t.id === sq.topicId);
            if (t) { topicName = t.name; break; }
          }
        }
        topicStats[sq.topicId] = { attempted: 0, correct: 0, name: topicName };
      }
      topicStats[sq.topicId].attempted++;
      if (sq.correct) topicStats[sq.topicId].correct++;
    }
  }

  const getMotivationMsg = (pct: number) => {
    if (pct >= 80) return 'চমৎকার পারফরম্যান্স! 🌟';
    if (pct >= 60) return 'ভালো এগিয়ে যাচ্ছো! ⭐';
    if (pct >= 40) return 'চেষ্টা জারি রাখো! 💪';
    if (pct === 0) return 'অনুশীলন শুরু করো! 📚';
    return 'আরো অনুশীলন দরকার! 📖';
  };

  const summaryItems = [
    { label: 'মোট প্রশ্ন', value: toBengaliNumber(totalAttempted), icon: '❓', color: '#3b82f6' },
    { label: 'সঠিক উত্তর', value: toBengaliNumber(totalCorrect), icon: '✅', color: '#10b981' },
    { label: 'সম্পূর্ণ অনুশীলন', value: toBengaliNumber(completedSessions), icon: '📋', color: '#8b5cf6' },
  ];

  return (
    <div style={{ padding: '2rem', background: bg, minHeight: '100%', fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: '700', color: text, marginBottom: '0.5rem' }}>
        📊 অগ্রগতি
      </h1>
      <p style={{ color: subText, marginBottom: '2rem', fontSize: '0.9rem' }}>
        {classData?.bengaliName} — তোমার সামগ্রিক পারফরম্যান্স
      </p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {summaryItems.map(item => (
          <div key={item.label} style={{
            background: cardBg,
            border: `1px solid ${border}`,
            borderRadius: '1rem',
            padding: '1.3rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>{item.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: item.color, lineHeight: 1 }}>
              {item.value}
            </div>
            <div style={{ color: subText, fontSize: '0.8rem', marginTop: '0.3rem' }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: '1rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <span style={{ color: text, fontWeight: '600', fontSize: '1rem' }}>সামগ্রিক সাফল্যের হার</span>
          <span style={{ color: '#3b82f6', fontWeight: '700', fontSize: '1.2rem' }}>
            {toBengaliPercent(overallPct)}
          </span>
        </div>
        <div style={{ background: border, borderRadius: '1rem', height: '12px', overflow: 'hidden', marginBottom: '0.8rem' }}>
          <div style={{
            width: `${overallPct}%`,
            height: '100%',
            background: overallPct >= 70 ? '#10b981' : overallPct >= 50 ? '#f59e0b' : overallPct > 0 ? '#ef4444' : '#e2e8f0',
            borderRadius: '1rem',
            transition: 'width 1s ease',
          }} />
        </div>
        <p style={{ color: subText, margin: 0, fontSize: '0.9rem' }}>{getMotivationMsg(overallPct)}</p>
      </div>

      {/* Topic-wise breakdown */}
      {Object.keys(topicStats).length > 0 && (
        <div style={{
          background: cardBg,
          border: `1px solid ${border}`,
          borderRadius: '1rem',
          padding: '1.5rem',
        }}>
          <h3 style={{ color: text, fontWeight: '600', fontSize: '1rem', marginBottom: '1.2rem' }}>
            বিষয়ভিত্তিক অগ্রগতি
          </h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {Object.entries(topicStats).map(([id, stats]) => {
              const pct = stats.attempted > 0 ? (stats.correct / stats.attempted) * 100 : 0;
              return (
                <div key={id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ color: text, fontSize: '0.9rem', fontWeight: '500' }}>
                      {stats.name}
                    </span>
                    <span style={{ color: subText, fontSize: '0.85rem' }}>
                      {toBengaliNumber(stats.correct)}/{toBengaliNumber(stats.attempted)} ({toBengaliPercent(pct)})
                    </span>
                  </div>
                  <div style={{ background: border, borderRadius: '1rem', height: '8px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444',
                      borderRadius: '1rem',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div style={{
          background: cardBg,
          border: `1px solid ${border}`,
          borderRadius: '1rem',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <p style={{ color: text, fontSize: '1rem', fontWeight: '600', margin: '0 0 0.5rem' }}>
            এখনো কোনো অনুশীলন করা হয়নি
          </p>
          <p style={{ color: subText, fontSize: '0.9rem', margin: 0 }}>
            অনুশীলন বিভাগে গিয়ে শুরু করো!
          </p>
        </div>
      )}
    </div>
  );
}
