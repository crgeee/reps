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

export interface Store {
  tasks: Task[];
}
