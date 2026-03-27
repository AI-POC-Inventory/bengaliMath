import type { PracticeSession, DoubtEntry } from '../types';

const BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Preferences ───────────────────────────────────────────────────────────────
export interface Preferences {
  classId: number | null;
  theme: 'light' | 'dark';
  apiKey: string;
}

export function getPreferences(): Promise<Preferences> {
  return fetchJSON<Preferences>(`${BASE}/preferences`);
}

export function setPreference(key: string, value: string): Promise<void> {
  return fetchJSON(`${BASE}/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export function getSessions(classId: number): Promise<PracticeSession[]> {
  return fetchJSON<PracticeSession[]>(`${BASE}/sessions?classId=${classId}`);
}

export function saveSession(session: PracticeSession): Promise<void> {
  return fetchJSON(`${BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
}

export function deleteSession(id: string): Promise<void> {
  return fetchJSON(`${BASE}/sessions/${id}`, { method: 'DELETE' });
}

// ── Doubts ────────────────────────────────────────────────────────────────────
export function getDoubts(classId: number): Promise<DoubtEntry[]> {
  return fetchJSON<DoubtEntry[]>(`${BASE}/doubts?classId=${classId}`);
}

export function saveDoubt(entry: DoubtEntry): Promise<void> {
  return fetchJSON(`${BASE}/doubts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
}

export function deleteDoubt(id: string): Promise<void> {
  return fetchJSON(`${BASE}/doubts/${id}`, { method: 'DELETE' });
}

// ── Anthropic streaming proxy ─────────────────────────────────────────────────
export async function* askDoubt(
  classId: number,
  question: string,
  topic: string,
): AsyncGenerator<string> {
  const res = await fetch(`${BASE}/doubts/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, question, topic }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = JSON.parse(line.slice(6));
      if (data.done) return;
      if (data.error) throw new Error(data.error);
      if (data.text) yield data.text as string;
    }
  }
}
