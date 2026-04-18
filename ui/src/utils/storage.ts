import type { PracticeSession, DoubtEntry } from '../types';

export interface User {
  id: number;
  username: string;
  displayName: string;
  classId: number;
  totalXp: number;
  currentLevel: number;
  streakCount: number;
  longestStreak: number;
  avatarUrl: string;
}

const KEYS = {
  CLASS: 'ganit_class',
  THEME: 'ganit_theme',
  SESSIONS: 'ganit_sessions',
  DOUBTS: 'ganit_doubts',
  API_KEY: 'ganit_api_key',
  USER: 'ganit_user',
};

export function getSelectedClass(): number | null {
  const v = localStorage.getItem(KEYS.CLASS);
  return v ? parseInt(v) : null;
}

export function setSelectedClass(classId: number): void {
  localStorage.setItem(KEYS.CLASS, String(classId));
}

export function getTheme(): 'light' | 'dark' {
  return (localStorage.getItem(KEYS.THEME) as 'light' | 'dark') || 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(KEYS.THEME, theme);
}

export function getSessions(): PracticeSession[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SESSIONS) || '[]');
  } catch { return []; }
}

export function saveSession(session: PracticeSession): void {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

export function getDoubtHistory(): DoubtEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.DOUBTS) || '[]');
  } catch { return []; }
}

export function saveDoubt(entry: DoubtEntry): void {
  const history = getDoubtHistory();
  history.unshift(entry);
  localStorage.setItem(KEYS.DOUBTS, JSON.stringify(history));
}

export function getApiKey(): string {
  return localStorage.getItem(KEYS.API_KEY) || '';
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEYS.API_KEY, key);
}

export function getCurrentUser(): User | null {
  try {
    const userStr = localStorage.getItem(KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User): void {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export function clearCurrentUser(): void {
  localStorage.removeItem(KEYS.USER);
}
