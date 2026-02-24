import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Store, Task, Note } from './types.js';

const DATA_DIR = join(homedir(), '.reps');
const DATA_FILE = join(DATA_DIR, 'data.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadStore(): Store {
  ensureDataDir();
  if (!existsSync(DATA_FILE)) {
    return { tasks: [] };
  }
  const raw = readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as Store;
}

export function saveStore(store: Store): void {
  ensureDataDir();
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

export function loadTasks(): Task[] {
  return loadStore().tasks;
}

export function saveTask(task: Task): void {
  const store = loadStore();
  const idx = store.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    store.tasks[idx] = task;
  } else {
    store.tasks.push(task);
  }
  saveStore(store);
}

export function deleteTask(id: string): void {
  const store = loadStore();
  store.tasks = store.tasks.filter((t) => t.id !== id);
  saveStore(store);
}

export function addNote(taskId: string, note: Note): void {
  const store = loadStore();
  const task = store.tasks.find((t) => t.id === taskId);
  if (task) {
    task.notes.push(note);
    saveStore(store);
  }
}
