import type { Task, CreateTaskInput, Quality, EvaluationResult } from './types';

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
