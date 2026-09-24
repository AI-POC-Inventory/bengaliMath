import type { CSSProperties } from 'react';

// Shared admin styling (same visual language as Admin.tsx / QuestionGenerator.tsx,
// which still carry their own copies -- new admin screens should import from here).

export function adminColors(dark: boolean) {
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
export type AdminColors = ReturnType<typeof adminColors>;

export const adminFont = "'Hind Siliguri', 'Noto Sans Bengali', sans-serif";

export function adminBtn(bg: string, color = '#fff', disabled = false): CSSProperties {
  return {
    background: disabled ? '#94a3b8' : bg, color, border: 'none', borderRadius: '0.4rem',
    padding: '0.45rem 1rem', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: adminFont,
    fontSize: '0.85rem', fontWeight: 600, opacity: disabled ? 0.6 : 1,
  };
}

export function adminInput(colors: AdminColors): CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box', background: colors.inputBg, color: colors.text,
    border: `1px solid ${colors.border}`, borderRadius: '0.4rem',
    padding: '0.45rem 0.6rem', fontFamily: adminFont, fontSize: '0.9rem',
  };
}

export function adminBadge(bg: string, color: string): CSSProperties {
  return { background: bg, color, fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '1rem', fontWeight: 600 };
}
