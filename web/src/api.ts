import type {
  Task,
  CreateTaskInput,
  Quality,
  EvaluationResult,
  Collection,
  CollectionStatus,
  Tag,
  StatsOverview,
  Streaks,
  MockSession,
  MockScore,
  Topic,
  MockDifficulty,
  User,
  AdminUser,
  SessionInfo,
  CustomTopic,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// Auth

export async function sendMagicLink(email: string): Promise<void> {
  await request<unknown>('/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function getMe(): Promise<User> {
  return request<User>('/auth/me');
}

export async function logout(): Promise<void> {
  await request<unknown>('/auth/logout', { method: 'POST' });
}

export async function approveDevice(userCode: string): Promise<void> {
  await request<unknown>('/auth/device/approve', {
    method: 'POST',
    body: JSON.stringify({ userCode }),
  });
}

export async function denyDevice(userCode: string): Promise<void> {
  await request<unknown>('/auth/device/deny', {
    method: 'POST',
    body: JSON.stringify({ userCode }),
  });
}

// User Profile

export async function updateProfile(updates: Partial<User>): Promise<User> {
  return request<User>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function getUserSessions(): Promise<SessionInfo[]> {
  return request<SessionInfo[]>('/users/me/sessions');
}

export async function deleteUserSession(sessionId: string): Promise<void> {
  await request<unknown>(`/users/me/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function getCustomTopics(): Promise<CustomTopic[]> {
  return request<CustomTopic[]>('/users/me/topics');
}

export async function createCustomTopic(input: { name: string; color?: string }): Promise<CustomTopic> {
  return request<CustomTopic>('/users/me/topics', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteCustomTopic(id: string): Promise<void> {
  await request<unknown>(`/users/me/topics/${id}`, { method: 'DELETE' });
}

// Admin

export async function getAdminUsers(): Promise<AdminUser[]> {
  return request<AdminUser[]>('/users/admin/users');
}

export async function adminUpdateUser(
  userId: string,
  updates: { isAdmin?: boolean; isBlocked?: boolean },
): Promise<User> {
  return request<User>(`/users/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function getAdminStats(): Promise<{ users: number; tasks: number; activeSessions: number; totalReviews: number }> {
  return request('/users/admin/stats');
}

// Tasks

export async function getTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export async function getDueTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks/due');
}

export async function getTasksByCollection(collectionId: string): Promise<Task[]> {
  return request<Task[]>(`/tasks?collection=${collectionId}`);
}

export async function getDueTasksByCollection(collectionId: string): Promise<Task[]> {
  return request<Task[]>(`/tasks/due?collection=${collectionId}`);
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
  input: { name: string; icon?: string; color?: string; srEnabled?: boolean; sortOrder?: number }
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

export async function createCollectionStatus(
  collectionId: string,
  input: { name: string; color?: string | null; sortOrder?: number }
): Promise<CollectionStatus> {
  return request<CollectionStatus>(`/collections/${collectionId}/statuses`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCollectionStatus(
  collectionId: string,
  statusId: string,
  updates: Partial<{ name: string; color: string | null; sortOrder: number }>
): Promise<CollectionStatus> {
  return request<CollectionStatus>(`/collections/${collectionId}/statuses/${statusId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteCollectionStatus(
  collectionId: string,
  statusId: string
): Promise<void> {
  await request<unknown>(`/collections/${collectionId}/statuses/${statusId}`, { method: 'DELETE' });
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
  const qs = collectionId ? `?collection=${collectionId}` : '';
  return request<StatsOverview>(`/stats/overview${qs}`);
}

export async function getHeatmap(collectionId?: string): Promise<Record<string, number>> {
  const qs = collectionId ? `?collection=${collectionId}` : '';
  return request<Record<string, number>>(`/stats/heatmap${qs}`);
}

export async function getStreaks(collectionId?: string): Promise<Streaks> {
  const qs = collectionId ? `?collection=${collectionId}` : '';
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

// Export & Calendar

export async function getCalendarToken(): Promise<{ token: string | null }> {
  return request<{ token: string | null }>('/export/calendar/token');
}

export async function generateCalendarToken(): Promise<{ token: string; url: string }> {
  return request<{ token: string; url: string }>('/export/calendar/token', {
    method: 'POST',
  });
}

export async function downloadMarkdownExport(): Promise<void> {
  const res = await fetch(`${BASE_URL}/export/tasks.md`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reps-export-${new Date().toISOString().split('T')[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getTaskEventUrl(taskId: string): string {
  return `${BASE_URL}/export/tasks/${taskId}/event.ics`;
}
