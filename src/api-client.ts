import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  loadTasks as localLoadTasks,
  saveTask as localSaveTask,
  deleteTask as localDeleteTask,
  addNote as localAddNote,
} from './store.js';
import type { Task, Note } from './types.js';

const DATA_DIR = join(homedir(), '.reps');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

export interface ApiConfig {
  apiUrl: string;
  apiKey: string;
}

export interface EvaluationResult {
  clarity: number;
  specificity: number;
  missionAlignment: number;
  feedback: string;
  suggestedImprovement: string;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getApiConfig(): ApiConfig | null {
  ensureDataDir();
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw) as ApiConfig;
    if (config.apiUrl && config.apiKey) {
      return config;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveApiConfig(config: ApiConfig): void {
  ensureDataDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function isApiMode(): boolean {
  return getApiConfig() !== null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const config = getApiConfig();
  if (!config) {
    throw new Error('API not configured. Run `reps config` first.');
  }

  const url = `${config.apiUrl.replace(/\/$/, '')}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export function loadTasks(): Task[] {
  if (!isApiMode()) {
    return localLoadTasks();
  }
  // Synchronous local fallback is needed for existing CLI commands that call loadTasks() synchronously.
  // In API mode, we still read from local store for sync compatibility.
  // Use loadTasksAsync() for proper API calls.
  return localLoadTasks();
}

export async function loadTasksAsync(): Promise<Task[]> {
  if (!isApiMode()) {
    return localLoadTasks();
  }
  return apiFetch<Task[]>('/tasks');
}

export function saveTask(task: Task): void {
  if (!isApiMode()) {
    localSaveTask(task);
    return;
  }
  // Synchronous fallback to local store; use saveTaskAsync for API mode.
  localSaveTask(task);
}

export async function saveTaskAsync(task: Task): Promise<void> {
  if (!isApiMode()) {
    localSaveTask(task);
    return;
  }
  // Try PATCH first (update), if 404 then POST (create)
  try {
    await apiFetch(`/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify(task),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('404')) {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      });
    } else {
      throw err;
    }
  }
}

export function deleteTask(id: string): void {
  if (!isApiMode()) {
    localDeleteTask(id);
    return;
  }
  localDeleteTask(id);
}

export async function deleteTaskAsync(id: string): Promise<void> {
  if (!isApiMode()) {
    localDeleteTask(id);
    return;
  }
  await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
}

export function addNote(taskId: string, note: Note): void {
  if (!isApiMode()) {
    localAddNote(taskId, note);
    return;
  }
  localAddNote(taskId, note);
}

export async function addNoteAsync(taskId: string, note: Note): Promise<void> {
  if (!isApiMode()) {
    localAddNote(taskId, note);
    return;
  }
  await apiFetch(`/tasks/${taskId}/notes`, {
    method: 'POST',
    body: JSON.stringify(note),
  });
}

export async function submitReview(
  taskId: string,
  quality: number
): Promise<Task> {
  if (!isApiMode()) {
    throw new Error('submitReview requires API mode. Run `reps config` first.');
  }
  return apiFetch<Task>(`/tasks/${taskId}/review`, {
    method: 'POST',
    body: JSON.stringify({ quality }),
  });
}

export async function syncTasks(tasks: Task[]): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/sync', {
    method: 'POST',
    body: JSON.stringify({ tasks }),
  });
}

export async function getAgentQuestion(taskId: string): Promise<{ question: string }> {
  return apiFetch<{ question: string }>(`/agent/question/${taskId}`);
}

export async function evaluateAnswer(
  taskId: string,
  answer: string
): Promise<EvaluationResult> {
  return apiFetch<EvaluationResult>('/agent/evaluate', {
    method: 'POST',
    body: JSON.stringify({ taskId, answer }),
  });
}

export async function validateApiConnection(): Promise<boolean> {
  try {
    await apiFetch('/tasks');
    return true;
  } catch {
    return false;
  }
}

// Device auth flow (no auth required — uses raw fetch, not apiFetch)
export interface DeviceAuthInitiation {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  expiresIn: number;
}

export interface DeviceAuthPollResult {
  status: 'pending' | 'approved' | 'denied' | 'expired';
  sessionToken?: string;
}

async function deviceFetch<T>(apiUrl: string, path: string, options: RequestInit = {}): Promise<T> {
  const url = `${apiUrl.replace(/\/$/, '')}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

export async function apiDeviceInitiate(apiUrl: string): Promise<DeviceAuthInitiation> {
  return deviceFetch<DeviceAuthInitiation>(apiUrl, '/auth/device/initiate', { method: 'POST' });
}

export async function apiDevicePoll(apiUrl: string, deviceCode: string): Promise<DeviceAuthPollResult> {
  return deviceFetch<DeviceAuthPollResult>(apiUrl, '/auth/device/poll', {
    method: 'POST',
    body: JSON.stringify({ deviceCode }),
  });
}
