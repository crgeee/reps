import type {
  Task,
  CreateTaskInput,
  Quality,
  EvaluationResult,
  Collection,
  Tag,
  StatsOverview,
  Streaks,
  MockSession,
  MockScore,
  Topic,
  MockDifficulty,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

function getApiKey(): string {
  return localStorage.getItem('reps_api_key') ?? '';
}

export function setApiKey(key: string): void {
  localStorage.setItem('reps_api_key', key);
}

export function getStoredApiKey(): string {
  return getApiKey();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// Tasks

export async function getTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export async function getDueTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks/due');
}

export async function getTasksByCollection(collectionId: string): Promise<Task[]> {
  return request<Task[]>(`/tasks?collectionId=${collectionId}`);
}

export async function getDueTasksByCollection(collectionId: string): Promise<Task[]> {
  return request<Task[]>(`/tasks/due?collectionId=${collectionId}`);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await request<unknown>(`/tasks/${id}`, { method: 'DELETE' });
}

export async function addNote(taskId: string, text: string): Promise<void> {
  await request<unknown>(`/tasks/${taskId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function submitReview(taskId: string, quality: Quality): Promise<Task> {
  return request<Task>(`/tasks/${taskId}/review`, {
    method: 'POST',
    body: JSON.stringify({ quality }),
  });
}

// Collections

export async function getCollections(): Promise<Collection[]> {
  return request<Collection[]>('/collections');
}

export async function createCollection(
  input: Omit<Collection, 'id' | 'createdAt'>
): Promise<Collection> {
  return request<Collection>('/collections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCollection(
  id: string,
  updates: Partial<Collection>
): Promise<Collection> {
  return request<Collection>(`/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteCollection(id: string): Promise<void> {
  await request<unknown>(`/collections/${id}`, { method: 'DELETE' });
}

// Tags

export async function getTags(): Promise<Tag[]> {
  return request<Tag[]>('/tags');
}

export async function createTag(input: Omit<Tag, 'id'>): Promise<Tag> {
  return request<Tag>('/tags', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTag(id: string, updates: Partial<Tag>): Promise<Tag> {
  return request<Tag>(`/tags/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteTag(id: string): Promise<void> {
  await request<unknown>(`/tags/${id}`, { method: 'DELETE' });
}

// Stats

export async function getStatsOverview(collectionId?: string): Promise<StatsOverview> {
  const qs = collectionId ? `?collectionId=${collectionId}` : '';
  return request<StatsOverview>(`/stats/overview${qs}`);
}

export async function getHeatmap(collectionId?: string): Promise<Record<string, number>> {
  const qs = collectionId ? `?collectionId=${collectionId}` : '';
  return request<Record<string, number>>(`/stats/heatmap${qs}`);
}

export async function getStreaks(collectionId?: string): Promise<Streaks> {
  const qs = collectionId ? `?collectionId=${collectionId}` : '';
  return request<Streaks>(`/stats/streaks${qs}`);
}

// Mock interviews

export async function startMockInterview(
  topic: Topic,
  difficulty: MockDifficulty
): Promise<MockSession> {
  return request<MockSession>('/mock/sessions', {
    method: 'POST',
    body: JSON.stringify({ topic, difficulty }),
  });
}

export async function respondToMock(
  sessionId: string,
  answer: string
): Promise<{ followUp?: string; score?: MockScore; done: boolean }> {
  return request<{ followUp?: string; score?: MockScore; done: boolean }>(
    `/mock/sessions/${sessionId}/respond`,
    {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }
  );
}

export async function getMockSessions(): Promise<MockSession[]> {
  return request<MockSession[]>('/mock/sessions');
}

// Agent

export async function getQuestion(taskId: string): Promise<{ question: string }> {
  return request<{ question: string }>(`/agent/question/${taskId}`);
}

export async function evaluateAnswer(
  taskId: string,
  answer: string
): Promise<EvaluationResult> {
  return request<EvaluationResult>('/agent/evaluate', {
    method: 'POST',
    body: JSON.stringify({ taskId, answer }),
  });
}

export async function summarizePaper(taskId: string): Promise<void> {
  await request<unknown>(`/agent/summarize/${taskId}`, { method: 'POST' });
}

export async function triggerBriefing(): Promise<{ message: string }> {
  return request<{ message: string }>('/agent/briefing', { method: 'POST' });
}
