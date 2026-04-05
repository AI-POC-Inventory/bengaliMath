import type { PracticeSession, DoubtEntry } from '../types';

const BASE = 'http://localhost:3001/api';

// ── Internal helper ───────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Preferences ───────────────────────────────────────────────────────────────
// Flask routes: GET /api/preferences  →  get_preferences()
//               PUT /api/preferences  →  set_preference()

export interface Preferences {
  classId: number | null;
  theme: 'light' | 'dark';
  apiKey: string;
}

export function getPreferences(): Promise<Preferences> {
  console.log("Fetching preferences from server...");
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
// Flask routes: GET    /api/sessions          →  getSessions()
//               POST   /api/sessions          →  saveSession()
//               DELETE /api/sessions/<id>     →  deleteSession()

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
// Flask routes: GET    /api/doubts            →  getDoubts()
//               POST   /api/doubts            →  saveDoubt()
//               DELETE /api/doubts/<id>       →  deleteDoubt()

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

// ── Admin: Curriculum CRUD ────────────────────────────────────────────────────

export interface AdminClass    { id: number; name: string; bengaliName: string }
export interface AdminChapter  { id: string; classId: number; name: string; description: string }
export interface AdminTopic    { id: string; chapterId: string; name: string; description: string }
export interface AdminQuestion {
  id: string; topicId: string; type: 'mcq' | 'short';
  text: string; answer: string; solution: string;
  difficulty: 'easy' | 'medium' | 'hard'; options: string[];
}

// Classes
export const getAdminClasses = () => fetchJSON<AdminClass[]>(`${BASE}/admin/classes`);
export const createAdminClass = (c: AdminClass) =>
  fetchJSON(`${BASE}/admin/classes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
export const updateAdminClass = (id: number, c: Omit<AdminClass, 'id'>) =>
  fetchJSON(`${BASE}/admin/classes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
export const deleteAdminClass = (id: number) =>
  fetchJSON(`${BASE}/admin/classes/${id}`, { method: 'DELETE' });

// Chapters
export const getAdminChapters = (classId: number) =>
  fetchJSON<AdminChapter[]>(`${BASE}/admin/chapters?classId=${classId}`);
export const createAdminChapter = (c: AdminChapter) =>
  fetchJSON(`${BASE}/admin/chapters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
export const updateAdminChapter = (id: string, c: Omit<AdminChapter, 'id' | 'classId'>) =>
  fetchJSON(`${BASE}/admin/chapters/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
export const deleteAdminChapter = (id: string) =>
  fetchJSON(`${BASE}/admin/chapters/${id}`, { method: 'DELETE' });

// Topics
export const getAdminTopics = (chapterId: string) =>
  fetchJSON<AdminTopic[]>(`${BASE}/admin/topics?chapterId=${chapterId}`);
export const createAdminTopic = (t: AdminTopic) =>
  fetchJSON(`${BASE}/admin/topics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
export const updateAdminTopic = (id: string, t: Omit<AdminTopic, 'id' | 'chapterId'>) =>
  fetchJSON(`${BASE}/admin/topics/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
export const deleteAdminTopic = (id: string) =>
  fetchJSON(`${BASE}/admin/topics/${id}`, { method: 'DELETE' });

// Questions
export const getAdminQuestions = (filter: { topicId?: string; chapterId?: string; classId?: number }) => {
  const params = new URLSearchParams();
  if (filter.topicId)   params.set('topicId', filter.topicId);
  if (filter.chapterId) params.set('chapterId', filter.chapterId);
  if (filter.classId)   params.set('classId', String(filter.classId));
  return fetchJSON<AdminQuestion[]>(`${BASE}/admin/questions?${params}`);
};
export const createAdminQuestion = (q: AdminQuestion) =>
  fetchJSON(`${BASE}/admin/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
export const updateAdminQuestion = (id: string, q: Omit<AdminQuestion, 'id' | 'topicId'>) =>
  fetchJSON(`${BASE}/admin/questions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
export const deleteAdminQuestion = (id: string) =>
  fetchJSON(`${BASE}/admin/questions/${id}`, { method: 'DELETE' });

// ── Anthropic streaming proxy ─────────────────────────────────────────────────
// Flask route:  POST /api/doubts/ask          →  askDoubt()

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