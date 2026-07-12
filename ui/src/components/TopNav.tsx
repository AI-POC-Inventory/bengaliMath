import { useState } from 'react';
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
  { id: 'word-problems', label: 'বাস্তব সমস্যা', icon: '🎯' },
  { id: 'use-cases', label: 'কেন শিখব?', icon: '💡' },
  { id: 'daily-puzzle', label: 'আজকের ধাঁধা', icon: '🧩' },
  { id: 'doubt', label: 'সন্দেহ সমাধান', icon: '🤖' },
  { id: 'chat', label: 'চ্যাট সহায়ক', icon: '💬' },
  { id: 'progress', label: 'অগ্রগতি', icon: '📊' },
  { id: 'history', label: 'ইতিহাস', icon: '🕐' },
  { id: 'admin', label: 'প্রশাসন', icon: '⚙️' },
];

const FONT = "'Hind Siliguri', 'Noto Sans Bengali', sans-serif";
const BAR_HEIGHT = 56;

/**
 * Mobile top navigation: a compact sticky app bar plus a drop-down menu.
 * Frees the full screen width for content (replaces the wide left sidebar).
 */
export default function TopNav({
  selectedClass,
  activeSection,
  onSectionChange,
  onChangeClass,
  darkMode,
  onToggleDarkMode,
}: Props) {
  const [open, setOpen] = useState(false);

  const bg = darkMode ? '#0f172a' : '#1e3a5f';
  const activeBg = darkMode ? '#1e40af' : '#2563eb';
  const text = '#e2e8f0';
  const subText = '#94a3b8';

  const activeItem = navItems.find(i => i.id === activeSection);

  function pick(id: NavSection) {
    onSectionChange(id);
    setOpen(false);
  }

  const actionBtn: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.7rem',
    borderRadius: '0.6rem',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)',
    color: subText,
    cursor: 'pointer',
    fontFamily: FONT,
    fontSize: '0.85rem',
  };

  return (
    <>
      {/* App bar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 0.9rem',
          height: `${BAR_HEIGHT}px`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <span style={{ fontSize: '1.4rem' }}>📐</span>
          <span
            style={{
              color: text,
              fontWeight: 700,
              fontSize: '1.05rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {activeItem ? `${activeItem.icon} ${activeItem.label}` : 'গণিত শিক্ষা'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: '#60a5fa',
              fontWeight: 700,
              fontSize: '0.85rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '1rem',
              whiteSpace: 'nowrap',
            }}
          >
            শ্রেণী {toBengaliNumber(selectedClass)}
          </span>
          <button
            aria-label="মেনু"
            onClick={() => setOpen(o => !o)}
            style={{
              background: 'transparent',
              border: 'none',
              color: text,
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0.25rem 0.4rem',
            }}
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Drop-down menu */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: `${BAR_HEIGHT}px 0 0 0`,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 90,
            }}
          />
          <nav
            style={{
              position: 'fixed',
              top: `${BAR_HEIGHT}px`,
              left: 0,
              right: 0,
              zIndex: 95,
              background: bg,
              maxHeight: `calc(100vh - ${BAR_HEIGHT}px)`,
              overflowY: 'auto',
              padding: '0.7rem',
              boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
              fontFamily: FONT,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
              {navItems.map(item => {
                const active = item.id === activeSection;
                return (
                  <button
                    key={item.id}
                    onClick={() => pick(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.85rem 0.9rem',
                      borderRadius: '0.7rem',
                      border: 'none',
                      cursor: 'pointer',
                      background: active ? activeBg : 'rgba(255,255,255,0.06)',
                      color: active ? '#fff' : text,
                      fontFamily: FONT,
                      fontSize: '0.9rem',
                      fontWeight: active ? 600 : 400,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.7rem' }}>
              <button
                onClick={() => {
                  onChangeClass();
                  setOpen(false);
                }}
                style={actionBtn}
              >
                🔄 শ্রেণী পরিবর্তন
              </button>
              <button onClick={onToggleDarkMode} style={actionBtn}>
                {darkMode ? '☀️ আলো মোড' : '🌙 অন্ধকার মোড'}
              </button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
