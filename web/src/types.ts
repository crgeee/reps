export type Topic = 'coding' | 'system-design' | 'behavioral' | 'papers' | 'custom';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  topic: Topic;
  title: string;
  notes: Note[];
  completed: boolean;
  status: TaskStatus;
  deadline?: string;
  repetitions: number;
  interval: number;
  easeFactor: number;
  nextReview: string;
  lastReviewed?: string;
  createdAt: string;
  collectionId?: string;
  tags?: Tag[];
}

export interface Collection {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  srEnabled: boolean;
  sortOrder: number;
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
  collectionId?: string;
  tagIds?: string[];
}

export interface ReviewInput {
  quality: Quality;
}

export type MockDifficulty = 'easy' | 'medium' | 'hard';

export interface MockMessage {
  role: 'interviewer' | 'candidate';
  content: string;
}

export interface MockScore {
  clarity: number;
  depth: number;
  correctness: number;
  communication: number;
  overall: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface MockSession {
  id: string;
  collectionId?: string;
  topic: Topic;
  difficulty: MockDifficulty;
  messages: MockMessage[];
  score?: MockScore;
  startedAt: string;
  completedAt?: string;
}

export interface StatsOverview {
  totalReviews: number;
  reviewsLast30Days: number;
  reviewsByTopic: Record<Topic, number>;
  averageEaseByTopic: Record<Topic, number>;
}

export interface Streaks {
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
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

export const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  'todo': 'Todo',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done',
};
