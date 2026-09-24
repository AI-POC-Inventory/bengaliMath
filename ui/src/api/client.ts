import type { PracticeSession, DoubtEntry } from '../types';

export const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  ?? 'http://localhost:3001/api';

// Base URL for the standalone Gemini chat service (Python/Flask, deployed
// separately on Cloud Run). The Gemini API key lives server-side as an env var.
// Use VITE_CHAT_API_BASE_URL when provided (and non-empty — an unset GitHub
// Actions variable expands to ''), otherwise fall back to the deployed service
// in production builds and localhost during local dev.
const CHAT_BASE_DEFAULT = import.meta.env.PROD
  ? 'https://bengali-math-chat-989713142030.asia-south1.run.app'
  : 'http://localhost:8080';

const _rawChatBase = (import.meta.env.VITE_CHAT_API_BASE_URL as string | undefined)?.trim();
export const CHAT_BASE = (_rawChatBase ? _rawChatBase.replace(/\/$/, '') : CHAT_BASE_DEFAULT);

// Base URL for the curriculum API (Python/Flask, service/db, Supabase-backed).
// This is also where the admin question generator lives (see below) -- it
// needs to be the Supabase-connected service, not the SQLite `BASE` above.
// Same env var ui/src/data/curriculum.ts already reads.
//
// Region matters: bengali-math-api is deployed in BOTH us-central1 (older,
// created 2026-04-14, no question-generator routes) and asia-south1 (created
// 2026-06-26, has them, and matches the chat service's region above). The
// production default must be asia-south1 or /classes and
// /api/admin/questions/* 404.
const CURRICULUM_BASE_DEFAULT = import.meta.env.PROD
  ? 'https://bengali-math-api-989713142030.asia-south1.run.app'
  : 'http://localhost:5000';

const _rawCurriculumBase = (import.meta.env.VITE_CURRICULUM_API_URL as string | undefined)?.trim();
export const CURRICULUM_BASE = (_rawCurriculumBase ? _rawCurriculumBase.replace(/\/$/, '') : CURRICULUM_BASE_DEFAULT);

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

// ── Question Generator ──────────────────────────────────────────────────────
// Talks to CURRICULUM_BASE (service/db, Supabase), not BASE (SQLite) — the
// generator's staging table and the live `questions` table it approves into
// both live in Supabase, the same database service/db/curriculam_reader.py
// reads for the student-facing app.

export interface CurriculumClass { id: number; name: string; bengaliName: string }

export interface DifficultyMix { easy: number; medium: number; hard: number }
export type QuestionType = 'mcq' | 'short' | 'mixed';
export type StagingStatus = 'pending' | 'approved' | 'rejected';

export interface StagedQuestion {
  id: string;
  batch_id: string;
  class_id: number;
  chapter_id: string;
  topic_id: string;
  type: 'mcq' | 'short';
  text: string;
  answer: string;
  solution: string;
  difficulty: 'easy' | 'medium' | 'hard';
  options: string[] | null;
  status: StagingStatus;
  possible_duplicate_of: string | null;
  similarity_score: number | null;
  source_chunk_ids: string[] | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface GenerateQuestionsResult {
  batchId: string;
  candidates: StagedQuestion[];
  auditUri: string | null;
}

export const getCurriculumClasses = () =>
  fetchJSON<CurriculumClass[]>(`${CURRICULUM_BASE}/classes`);

export const generateQuestions = (params: {
  classId: number; chapterId: string; topicId: string; count: number;
  difficultyMix: DifficultyMix; questionType: QuestionType;
}) =>
  fetchJSON<GenerateQuestionsResult>(`${CURRICULUM_BASE}/api/admin/questions/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classId: params.classId, chapterId: params.chapterId, topicId: params.topicId,
      count: params.count, difficultyMix: params.difficultyMix, questionType: params.questionType,
    }),
  });

export const getStagingQuestions = (filter: {
  batchId?: string; classId?: number; chapterId?: string; topicId?: string; status?: StagingStatus;
} = {}) => {
  const params = new URLSearchParams();
  if (filter.batchId)   params.set('batchId', filter.batchId);
  if (filter.classId)   params.set('classId', String(filter.classId));
  if (filter.chapterId) params.set('chapterId', filter.chapterId);
  if (filter.topicId)   params.set('topicId', filter.topicId);
  if (filter.status)    params.set('status', filter.status);
  return fetchJSON<StagedQuestion[]>(`${CURRICULUM_BASE}/api/admin/questions/staging?${params}`);
};

export const approveStaged = (id: string) =>
  fetchJSON<{ ok: boolean; detail: string }>(
    `${CURRICULUM_BASE}/api/admin/questions/staging/${id}/approve`, { method: 'POST' });

export const rejectStaged = (id: string) =>
  fetchJSON<{ ok: boolean; detail: string }>(
    `${CURRICULUM_BASE}/api/admin/questions/staging/${id}/reject`, { method: 'POST' });

interface BatchResult { results: Record<string, { ok: boolean; detail: string }>; failed: number }

export const batchApproveStaged = (ids: string[]) =>
  fetchJSON<BatchResult & { approved: number }>(
    `${CURRICULUM_BASE}/api/admin/questions/staging/batch-approve`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });

export const batchRejectStaged = (ids: string[]) =>
  fetchJSON<BatchResult & { rejected: number }>(
    `${CURRICULUM_BASE}/api/admin/questions/staging/batch-reject`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });

// ── Chapter lessons ───────────────────────────────────────────────────────────
// Generated -> reviewed/edited -> approved in Admin ("পাঠ জেনারেটর"); the live
// lesson lives in chapters.details and students read it through the existing
// GET /chapter endpoint. Content shape is validated server-side
// (service/db/lesson_generator.py: validate_content).

export interface LessonExample {
  problem: string; steps: string[]; answer: string;
  verified: boolean | null;   // true = independently re-solved OK, false = disagreed, null = not checked
}
export interface LessonSection {
  title: string; explanation: string; keyPoints: string[]; examples: LessonExample[];
  commonMistakes: string[]; quickCheck: { question: string; answer: string }[]; takeaway: string;
}
export interface LessonContent {
  version: number; overview: string; prerequisites: string[]; sections: LessonSection[];
}

export type LessonStatus = 'draft' | 'approved' | 'rejected' | 'superseded';

/** A row of generated_lessons. The list endpoint omits content/source_chunk_ids. */
export interface LessonRecord {
  id: string; class_id: number; chapter_id: string; version: number; status: LessonStatus;
  model: string | null; created_at: string; updated_at: string; reviewed_at: string | null;
  content?: LessonContent; source_chunk_ids?: string[] | null;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const generateLesson = (classId: number, chapterId: string) =>
  fetchJSON<LessonRecord>(`${CURRICULUM_BASE}/api/admin/lessons/generate`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ classId, chapterId }) });

export const listLessons = (filter: { classId?: number; chapterId?: string; status?: LessonStatus } = {}) => {
  const params = new URLSearchParams();
  if (filter.classId)   params.set('classId', String(filter.classId));
  if (filter.chapterId) params.set('chapterId', filter.chapterId);
  if (filter.status)    params.set('status', filter.status);
  return fetchJSON<LessonRecord[]>(`${CURRICULUM_BASE}/api/admin/lessons?${params}`);
};

export const getLesson = (id: string) =>
  fetchJSON<LessonRecord>(`${CURRICULUM_BASE}/api/admin/lessons/${id}`);

export const updateLesson = (id: string, content: LessonContent) =>
  fetchJSON<LessonRecord>(`${CURRICULUM_BASE}/api/admin/lessons/${id}`,
    { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ content }) });

export const approveLesson = (id: string) =>
  fetchJSON<{ ok: boolean }>(`${CURRICULUM_BASE}/api/admin/lessons/${id}/approve`, { method: 'POST' });

export const rejectLesson = (id: string) =>
  fetchJSON<LessonRecord>(`${CURRICULUM_BASE}/api/admin/lessons/${id}/reject`, { method: 'POST' });

export const cloneLesson = (id: string) =>
  fetchJSON<LessonRecord>(`${CURRICULUM_BASE}/api/admin/lessons/${id}/clone`, { method: 'POST' });

export const unpublishLesson = (chapterId: string) =>
  fetchJSON<{ ok: boolean }>(`${CURRICULUM_BASE}/api/admin/lessons/chapter/${chapterId}/unpublish`, { method: 'POST' });

/** Student read: the live (approved) lesson for a chapter, or null if none is published. */
export async function getChapterLesson(classId: number, chapterId: string): Promise<LessonContent | null> {
  const chapter = await fetchJSON<{ details?: LessonContent | null } | null>(
    `${CURRICULUM_BASE}/chapter?classId=${classId}&chapterId=${encodeURIComponent(chapterId)}`);
  return chapter?.details ?? null;
}

// ── Mistakes ──────────────────────────────────────────────────────────────────
export function recordMistake(userId: number, questionId: string, topicId: string, chapterId: string): Promise<void> {
  return fetchJSON(`${BASE.replace('/api', '')}/api/users/${userId}/mistakes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, topicId, chapterId }),
  });
}

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