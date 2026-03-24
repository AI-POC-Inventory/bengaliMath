import { toBengaliNumber } from '../utils/bengali';

interface Props {
  onSelect: (classId: number) => void;
  darkMode: boolean;
}

const classes = [5, 6, 7, 8, 9, 10];
const classNames = ['পঞ্চম', 'ষষ্ঠ', 'সপ্তম', 'অষ্টম', 'নবম', 'দশম'];
const classColors = [
  '#4f46e5', '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626'
];

export default function ClassSelection({ onSelect, darkMode }: Props) {
  const bg = darkMode ? '#1a1a2e' : '#f0f4ff';
  const cardBg = darkMode ? '#16213e' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>📐</div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: text, margin: '0 0 0.5rem' }}>
          গণিত শিক্ষা
        </h1>
        <p style={{ fontSize: '1.1rem', color: subText, margin: 0 }}>
          পশ্চিমবঙ্গ বোর্ড (WBBSE) — গণিত শিক্ষার সেরা সঙ্গী
        </p>
      </div>

      <h2 style={{ fontSize: '1.4rem', color: text, marginBottom: '1.5rem', fontWeight: '600' }}>
        আপনার শ্রেণী বেছে নিন
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.5rem',
        maxWidth: '700px',
        width: '100%',
      }}>
        {classes.map((cls, idx) => (
          <button
            key={cls}
            onClick={() => onSelect(cls)}
            style={{
              background: cardBg,
              border: `3px solid ${classColors[idx]}`,
              borderRadius: '1.2rem',
              padding: '2rem 1rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: darkMode ? '0 4px 15px rgba(0,0,0,0.4)' : '0 4px 15px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLElement).style.background = classColors[idx] + '15';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.background = cardBg;
            }}
          >
            <span style={{ fontSize: '2.5rem', fontWeight: '800', color: classColors[idx] }}>
              {toBengaliNumber(cls)}
            </span>
            <span style={{ fontSize: '1rem', color: text, fontWeight: '600' }}>
              {classNames[idx]} শ্রেণী
            </span>
            <span style={{ fontSize: '0.8rem', color: subText }}>
              Class {toBengaliNumber(cls)}
            </span>
          </button>
        ))}
      </div>

      <p style={{ marginTop: '2rem', color: subText, fontSize: '0.9rem' }}>
        সম্পূর্ণ বাংলায় • WBBSE পাঠ্যক্রম অনুযায়ী
      </p>
    </div>
  );
}
