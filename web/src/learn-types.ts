export interface Track {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  moduleCount: number;
}

export interface Module {
  id: string;
  trackId: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  prerequisites: string[];
  concepts: string[];
  createdAt: string;
}

export type ModuleStatus = 'locked' | 'active' | 'completed';
export type ExerciseType = 'code' | 'knowledge' | 'mini-app';
export type ExerciseDifficulty = 1 | 2 | 3;

export interface ModuleProgress {
  id: string;
  userId: string;
  moduleId: string;
  status: ModuleStatus;
  repetitions: number;
  interval: number;
  easeFactor: number;
  nextReview: string | null;
  lastReviewed: string | null;
  createdAt: string;
}

export interface ModuleWithProgress extends Module {
  progress: ModuleProgress | null;
}

export interface TrackDetail extends Track {
  modules: ModuleWithProgress[];
}

export interface Exercise {
  id: string;
  moduleId: string;
  type: ExerciseType;
  prompt: string;
  starterCode: string | null;
  testCode: string | null;
  difficulty: ExerciseDifficulty;
  generatedBy: 'ai' | 'manual';
  createdAt: string;
  hints?: string[];
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

export interface AiFeedback {
  correctness: number;
  codeQuality: number;
  completeness: number;
  feedback: string;
  hints: string[];
}

export interface Submission {
  id: string;
  exerciseId: string;
  userId: string;
  userCode: string;
  stdout: string | null;
  stderr: string | null;
  passed: boolean | null;
  aiFeedback: string | null;
  score: number | null;
  executionMs: number | null;
  createdAt: string;
}

export interface LearnStats {
  executionsToday: number;
  executionsTotal: number;
  avgExecutionMs: number;
  successRate: number;
}

export type LearnConfig = Record<string, string | number | boolean>;
