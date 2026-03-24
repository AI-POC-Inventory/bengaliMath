import type { NavSection } from '../types';
import { toBengaliNumber } from '../utils/bengali';

interface Props {
  selectedClass: number;
  activeSection: NavSection;
  onSectionChange: (s: NavSection) => void;
  onChangeClass: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const navItems: Array<{ id: NavSection; label: string; icon: string }> = [
  { id: 'syllabus', label: 'পাঠ্যক্রম', icon: '📚' },
  { id: 'practice', label: 'অনুশীলন', icon: '✏️' },
  { id: 'doubt', label: 'সন্দেহ সমাধান', icon: '🤖' },
  { id: 'progress', label: 'অগ্রগতি', icon: '📊' },
  { id: 'history', label: 'ইতিহাস', icon: '🕐' },
];

export default function Sidebar({ selectedClass, activeSection, onSectionChange, onChangeClass, darkMode, onToggleDarkMode }: Props) {
  const bg = darkMode ? '#0f172a' : '#1e3a5f';
  const activeBg = darkMode ? '#1e40af' : '#2563eb';
  const hoverBg = darkMode ? '#1e293b' : '#1d4ed8';
  const text = '#e2e8f0';
  const subText = '#94a3b8';

  return (
    <div style={{
      width: '220px',
      minHeight: '100vh',
      background: bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: '0.3rem' }}>📐</div>
        <div style={{ textAlign: 'center', color: text, fontWeight: '700', fontSize: '1.2rem' }}>
          গণিত শিক্ষা
        </div>
      </div>

      {/* Class badge */}
      <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '0.8rem',
          padding: '0.7rem',
          textAlign: 'center',
        }}>
          <div style={{ color: subText, fontSize: '0.75rem', marginBottom: '0.2rem' }}>
            বর্তমান শ্রেণী
          </div>
          <div style={{ color: '#60a5fa', fontWeight: '800', fontSize: '1.5rem' }}>
            শ্রেণী {toBengaliNumber(selectedClass)}
          </div>
        </div>
        <button
          onClick={onChangeClass}
          style={{
            width: '100%',
            marginTop: '0.5rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '0.5rem',
            color: subText,
            padding: '0.4rem',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          শ্রেণী পরিবর্তন
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.5rem' }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.8rem 1rem',
              marginBottom: '0.2rem',
              borderRadius: '0.7rem',
              border: 'none',
              cursor: 'pointer',
              background: activeSection === item.id ? activeBg : 'transparent',
              color: activeSection === item.id ? '#fff' : text,
              fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
              fontSize: '0.95rem',
              fontWeight: activeSection === item.id ? '600' : '400',
              transition: 'all 0.15s',
              textAlign: 'left',
            }}
            onMouseEnter={e => {
              if (activeSection !== item.id) {
                (e.currentTarget as HTMLElement).style.background = hoverBg;
              }
            }}
            onMouseLeave={e => {
              if (activeSection !== item.id) {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Dark mode toggle */}
      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={onToggleDarkMode}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.6rem',
            borderRadius: '0.6rem',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            color: subText,
            cursor: 'pointer',
            fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
            fontSize: '0.85rem',
            transition: 'all 0.2s',
          }}
        >
          <span>{darkMode ? '☀️' : '🌙'}</span>
          <span>{darkMode ? 'আলো মোড' : 'অন্ধকার মোড'}</span>
        </button>
      </div>
    </div>
  );
}
