export interface Question {
  id: string;
  type: 'mcq' | 'short';
  text: string;
  options?: string[];
  answer: number | string; // index for mcq, text for short
  solution: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  questions: Question[];
}

export interface Chapter {
  id: string;
  name: string;
  description: string;
  topics: Topic[];
}

export interface ClassData {
  id: number;
  name: string;
  bengaliName: string;
  chapters: Chapter[];
}

export interface SessionQuestion {
  questionId: string;
  topicId: string;
  chapterId: string;
  correct: boolean;
  attempted: boolean;
}

export interface PracticeSession {
  id: string;
  classId: number;
  chapterId?: string;
  topicId?: string;
  difficulty?: string;
  date: string;
  questions: SessionQuestion[];
  completed: boolean;
  score: number;
  total: number;
}

export interface DoubtEntry {
  id: string;
  classId: number;
  question: string;
  topic?: string;
  response: string;
  date: string;
}

export type NavSection = 'syllabus' | 'practice' | 'doubt' | 'progress' | 'history';
