import { getAiConfig } from './ai-config';
import type {
  Track,
  TrackDetail,
  ModuleProgress,
  ModuleWithProgress,
  Exercise,
  ExecutionResult,
  Submission,
  LearnStats,
  LearnConfig,
} from './learn-types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const aiHeaders: Record<string, string> = {};
  const aiConfig = getAiConfig();
  if (aiConfig) {
    aiHeaders['X-AI-Key'] = aiConfig.apiKey;
    aiHeaders['X-AI-Provider'] = aiConfig.provider;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...aiHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Expected JSON response but got ${contentType || 'unknown content type'} (${res.status})`,
    );
  }

  return res.json() as Promise<T>;
}

// --- Tracks ---

export async function getTracks(): Promise<Track[]> {
  return request<Track[]>('/learn/tracks');
}

export async function getTrack(slug: string): Promise<TrackDetail> {
  return request<TrackDetail>(`/learn/tracks/${slug}`);
}

// --- Modules ---

export async function startModule(moduleId: string): Promise<ModuleProgress> {
  return request<ModuleProgress>(`/learn/modules/${moduleId}/start`, {
    method: 'POST',
  });
}

export async function reviewModule(moduleId: string, quality: number): Promise<ModuleProgress> {
  return request<ModuleProgress>(`/learn/modules/${moduleId}/review`, {
    method: 'POST',
    body: JSON.stringify({ quality }),
  });
}

export async function getModule(
  moduleId: string,
): Promise<ModuleWithProgress & { exercises: Exercise[] }> {
  return request<ModuleWithProgress & { exercises: Exercise[] }>(`/learn/modules/${moduleId}`);
}

// --- Exercises ---

export async function generateExercise(
  moduleId: string,
  options?: { difficulty?: number; type?: string },
): Promise<Exercise> {
  return request<Exercise>('/learn/exercises/generate', {
    method: 'POST',
    body: JSON.stringify({ moduleId, ...options }),
  });
}

export async function runCode(exerciseId: string, code: string): Promise<ExecutionResult> {
  return request<ExecutionResult>(`/learn/exercises/${exerciseId}/run`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function submitCode(exerciseId: string, code: string): Promise<Submission> {
  return request<Submission>(`/learn/exercises/${exerciseId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

// --- Submissions ---

export async function getSubmissions(exerciseId: string, offset?: number): Promise<Submission[]> {
  const qs = offset ? `?offset=${offset}` : '';
  return request<Submission[]>(`/learn/submissions/${exerciseId}${qs}`);
}

// --- Admin ---

export async function getLearnStats(): Promise<LearnStats> {
  return request<LearnStats>('/admin/learn/stats');
}

export async function getLearnConfig(): Promise<LearnConfig> {
  return request<LearnConfig>('/admin/learn/config');
}

export async function updateLearnConfig(config: LearnConfig): Promise<{ updated: number }> {
  return request<{ updated: number }>('/admin/learn/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}
