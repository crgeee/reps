export type Topic = 'coding' | 'system-design' | 'behavioral' | 'papers' | 'custom';
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  topic: Topic;
  title: string;
  notes: Note[];
  completed: boolean;
  deadline?: string;
  repetitions: number;
  interval: number;
  easeFactor: number;
  nextReview: string;
  lastReviewed?: string;
  createdAt: string;
}

export interface EvaluationResult {
  clarity: number;
  specificity: number;
  missionAlignment: number;
  feedback: string;
  suggestedImprovement: string;
}

export interface CreateTaskInput {
  topic: Topic;
  title: string;
  deadline?: string;
  note?: string;
}

export interface ReviewInput {
  quality: Quality;
}

export const TOPICS: Topic[] = ['coding', 'system-design', 'behavioral', 'papers', 'custom'];

export const TOPIC_LABELS: Record<Topic, string> = {
  coding: 'Coding',
  'system-design': 'System Design',
  behavioral: 'Behavioral',
  papers: 'Papers',
  custom: 'Custom',
};

export const TOPIC_COLORS: Record<Topic, string> = {
  coding: 'bg-blue-500',
  'system-design': 'bg-purple-500',
  behavioral: 'bg-green-500',
  papers: 'bg-amber-500',
  custom: 'bg-slate-500',
};
