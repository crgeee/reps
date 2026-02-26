# Board View & Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a kanban board view with drag-and-drop status changes and a shared filter/sort bar across list and board views.

**Architecture:** New `status` TEXT column on `tasks` table with CHECK constraint. Board view uses `@dnd-kit` for drag-and-drop between status columns. A shared `FilterBar` component provides topic, status, due date, search, and sort controls to both BoardView and TaskList. A shared `useFilteredTasks` hook centralizes all filtering/sorting logic (DRY). A shared `TaskCard` component renders task cards in both views (DRY).

**Tech Stack:** React 19, @dnd-kit/core + @dnd-kit/sortable, Tailwind CSS v4, postgres.js, Zod

---

### Task 1: Database Migration — Add `status` Column

**Files:**
- Create: `db/002_add_status.sql`
- Modify: `server/db/migrate.ts:9-14` (load multiple SQL files)

**Step 1: Create migration SQL file**

Create `db/002_add_status.sql`:
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo'
  CHECK (status IN ('todo', 'in-progress', 'review', 'done'));

UPDATE tasks SET status = 'done' WHERE completed = true;
```

**Step 2: Update migrate.ts to run all SQL files in order**

Modify `server/db/migrate.ts` to glob `db/*.sql` sorted by filename and execute each:

```typescript
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, "../../db");

async function migrate(): Promise<void> {
  console.log("Running migrations...");

  try {
    const files = readdirSync(dbDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      console.log(`  Running ${file}...`);
      const content = readFileSync(resolve(dbDir, file), "utf-8");
      await sql.unsafe(content);
    }

    console.log("Migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
```

**Step 3: Run migration locally**

Run: `npm run migrate`
Expected: `Running schema.sql... Running 002_add_status.sql... Migrations completed successfully.`

**Step 4: Commit**

```bash
git add db/002_add_status.sql server/db/migrate.ts
git commit -m "feat: add status column to tasks table with migration"
```

---

### Task 2: Server — Add `status` to Validation, Types, and Row Mapping

**Files:**
- Modify: `server/validation.ts` (add statusEnum)
- Modify: `server/routes/tasks.ts:26-36` (add status to patchTaskSchema, createTaskSchema, fieldMap, TaskRow, rowToTask)
- Modify: `src/types.ts` (add TaskStatus type and status field to Task)
- Modify: `web/src/types.ts` (add TaskStatus type and status field to Task)

**Step 1: Add statusEnum to server/validation.ts**

Add after line 11:
```typescript
export const statusEnum = z.enum(["todo", "in-progress", "review", "done"]);
```

**Step 2: Update server/routes/tasks.ts**

Add `status` to imports from validation:
```typescript
import { validateUuid, dateStr, topicEnum, statusEnum, uuidStr } from "../validation.js";
```

Add `status` to `createTaskSchema`:
```typescript
status: statusEnum.optional(),
```

Add `status` to `patchTaskSchema`:
```typescript
status: statusEnum.optional(),
```

Add `status` to `TaskRow` interface:
```typescript
status: string;
```

Add `status` to `fieldMap` in PATCH handler:
```typescript
status: "status",
```

Add `status` to `rowToTask`:
```typescript
status: row.status as Task["status"],
```

Add `status` to POST `/tasks` INSERT:
```sql
INSERT INTO tasks (id, topic, title, completed, deadline, repetitions, interval, ease_factor, next_review, last_reviewed, created_at, status)
VALUES (..., ${body.status ?? "todo"})
```

Add `status` to `/sync` INSERT and ON CONFLICT:
```sql
status = EXCLUDED.status
```

**Step 3: Update src/types.ts**

Add after Topic type:
```typescript
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
```

Add to Task interface:
```typescript
status: TaskStatus;
```

**Step 4: Update web/src/types.ts**

Add after Topic type:
```typescript
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
```

Add to Task interface:
```typescript
status: TaskStatus;
```

Add constants:
```typescript
export const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  'todo': 'Todo',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done',
};
```

**Step 5: Verify server builds**

Run: `npm run build:server`
Expected: No errors.

**Step 6: Commit**

```bash
git add server/validation.ts server/routes/tasks.ts src/types.ts web/src/types.ts
git commit -m "feat: add status field to task types, validation, and API"
```

---

### Task 3: Install @dnd-kit Dependencies

**Files:**
- Modify: `web/package.json`

**Step 1: Install packages**

```bash
cd web && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "feat: add @dnd-kit dependencies for board drag-and-drop"
```

Note: if there's a root lockfile instead, adjust accordingly.

---

### Task 4: Shared Filter Hook — `useFilteredTasks`

**Files:**
- Create: `web/src/hooks/useFilteredTasks.ts`

This hook centralizes all filtering/sorting logic so both BoardView and TaskList use the same code (DRY).

**Step 1: Create the hook**

```typescript
import { useMemo, useState, useCallback } from 'react';
import type { Task, Topic, TaskStatus } from '../types';

export type DueFilter = 'all' | 'overdue' | 'today' | 'this-week' | 'no-deadline';
export type SortField = 'created' | 'next-review' | 'deadline' | 'ease-factor';
export type SortDir = 'asc' | 'desc';

export interface FilterState {
  topic: Topic | 'all';
  status: TaskStatus | 'all';
  due: DueFilter;
  search: string;
  sortField: SortField;
  sortDir: SortDir;
}

const DEFAULT_FILTERS: FilterState = {
  topic: 'all',
  status: 'all',
  due: 'all',
  search: '',
  sortField: 'created',
  sortDir: 'desc',
};

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function endOfWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()));
  return d.toISOString().split('T')[0];
}

function matchesDue(task: Task, due: DueFilter): boolean {
  const today = todayStr();
  switch (due) {
    case 'all': return true;
    case 'overdue': return task.nextReview < today && !task.completed;
    case 'today': return task.nextReview === today;
    case 'this-week': return task.nextReview >= today && task.nextReview <= endOfWeekStr();
    case 'no-deadline': return !task.deadline;
  }
}

function sortTasks(tasks: Task[], field: SortField, dir: SortDir): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'created': cmp = a.createdAt.localeCompare(b.createdAt); break;
      case 'next-review': cmp = a.nextReview.localeCompare(b.nextReview); break;
      case 'deadline': cmp = (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'); break;
      case 'ease-factor': cmp = a.easeFactor - b.easeFactor; break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export function useFilteredTasks(tasks: Task[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const filtered = useMemo(() => {
    let result = tasks;

    if (filters.topic !== 'all') {
      result = result.filter((t) => t.topic === filters.topic);
    }
    if (filters.status !== 'all') {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters.due !== 'all') {
      result = result.filter((t) => matchesDue(t, filters.due));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }

    return sortTasks(result, filters.sortField, filters.sortDir);
  }, [tasks, filters]);

  return { filters, setFilter, resetFilters, filtered };
}
```

**Step 2: Commit**

```bash
git add web/src/hooks/useFilteredTasks.ts
git commit -m "feat: add useFilteredTasks hook for shared filter/sort logic"
```

---

### Task 5: Shared FilterBar Component

**Files:**
- Create: `web/src/components/FilterBar.tsx`

**Step 1: Create FilterBar**

```typescript
import type { Topic, TaskStatus } from '../types';
import { TOPICS, TOPIC_LABELS, STATUSES, STATUS_LABELS } from '../types';
import type { FilterState, DueFilter, SortField } from '../hooks/useFilteredTasks';

interface FilterBarProps {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  hideStatus?: boolean;
}

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'this-week', label: 'This Week' },
  { value: 'no-deadline', label: 'No Deadline' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'created', label: 'Created' },
  { value: 'next-review', label: 'Next Review' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'ease-factor', label: 'Ease Factor' },
];

export default function FilterBar({ filters, setFilter, resetFilters, hideStatus }: FilterBarProps) {
  const hasActiveFilters = filters.topic !== 'all' || filters.status !== 'all' ||
    filters.due !== 'all' || filters.search !== '' || filters.sortField !== 'created';

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text"
        value={filters.search}
        onChange={(e) => setFilter('search', e.target.value)}
        placeholder="Search tasks..."
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
      />

      <div className="flex flex-wrap items-center gap-3">
        {/* Topic chips */}
        <ChipGroup
          label="Topic"
          value={filters.topic}
          options={[{ value: 'all' as const, label: 'All' }, ...TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t] }))]}
          onChange={(v) => setFilter('topic', v as Topic | 'all')}
        />

        {/* Status chips (hidden on board) */}
        {!hideStatus && (
          <ChipGroup
            label="Status"
            value={filters.status}
            options={[{ value: 'all' as const, label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
            onChange={(v) => setFilter('status', v as TaskStatus | 'all')}
          />
        )}

        {/* Due date chips */}
        <ChipGroup
          label="Due"
          value={filters.due}
          options={DUE_OPTIONS}
          onChange={(v) => setFilter('due', v as DueFilter)}
        />

        {/* Sort */}
        <div className="flex items-center gap-1 ml-auto">
          <select
            value={filters.sortField}
            onChange={(e) => setFilter('sortField', e.target.value as SortField)}
            className="bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 px-2 py-1.5 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setFilter('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc')}
            className="text-zinc-500 hover:text-zinc-300 px-1.5 py-1 text-xs"
            title={filters.sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {filters.sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button onClick={resetFilters} className="text-xs text-zinc-500 hover:text-zinc-300">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-zinc-600 uppercase tracking-wider mr-1">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            value === o.value
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/components/FilterBar.tsx
git commit -m "feat: add shared FilterBar component"
```

---

### Task 6: Shared TaskCard Component

**Files:**
- Create: `web/src/components/TaskCard.tsx`

Extract the task card rendering used by both TaskList and BoardView (DRY).

**Step 1: Create TaskCard**

```typescript
import { useState } from 'react';
import type { Task } from '../types';
import { TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { updateTask, deleteTask, addNote } from '../api';

interface TaskCardProps {
  task: Task;
  onRefresh: () => void;
  compact?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export default function TaskCard({ task, onRefresh, compact, dragHandleProps }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleMarkDone() {
    setSubmitting(true);
    try {
      await updateTask(task.id, { completed: !task.completed });
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return;
    setSubmitting(true);
    try {
      await deleteTask(task.id);
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddNote() {
    const text = noteInput.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await addNote(task.id, text);
      setNoteInput('');
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-3 p-3" {...dragHandleProps}>
        <button
          onClick={handleMarkDone}
          disabled={submitting}
          className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            task.completed ? 'bg-green-600 border-green-600' : 'border-zinc-600 hover:border-zinc-400'
          }`}
        >
          {task.completed && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <button onClick={() => setExpanded(!expanded)} className="flex-1 text-left min-w-0">
          <span className={`text-sm font-medium truncate block ${task.completed ? 'line-through text-zinc-500' : ''}`}>
            {task.title}
          </span>
        </button>

        {!compact && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 flex-shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${TOPIC_COLORS[task.topic]}`} />
            <span>{TOPIC_LABELS[task.topic]}</span>
            {task.deadline && <span>Due: {task.deadline}</span>}
          </div>
        )}

        {compact && (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TOPIC_COLORS[task.topic]}`} />
        )}

        <button
          onClick={handleDelete}
          disabled={submitting}
          className="text-zinc-700 hover:text-red-400 transition-colors p-0.5 flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Meta row */}
      {!compact && (
        <div className="px-3 pb-2 flex gap-3 text-[10px] text-zinc-600">
          <span>Review: {task.nextReview}</span>
          <span>EF: {task.easeFactor.toFixed(1)}</span>
          <span>Reps: {task.repetitions}</span>
        </div>
      )}

      {expanded && (
        <div className="border-t border-zinc-800 p-3 space-y-2">
          {task.notes.length > 0 ? (
            task.notes.map((note) => (
              <div key={note.id} className="text-xs text-zinc-400 bg-zinc-800/50 rounded p-2">
                <p className="whitespace-pre-wrap">{note.text}</p>
                <p className="text-[10px] text-zinc-600 mt-1">{note.createdAt}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-600">No notes yet.</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="Add a note..."
              className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={handleAddNote}
              disabled={submitting}
              className="px-3 py-1.5 bg-zinc-700 text-zinc-200 text-xs rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/components/TaskCard.tsx
git commit -m "feat: add shared TaskCard component"
```

---

### Task 7: Refactor TaskList to Use Shared Components

**Files:**
- Modify: `web/src/components/TaskList.tsx` (rewrite to use FilterBar, useFilteredTasks, TaskCard)

**Step 1: Rewrite TaskList.tsx**

```typescript
import type { Task, Topic } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { useFilteredTasks } from '../hooks/useFilteredTasks';
import FilterBar from './FilterBar';
import TaskCard from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  onRefresh: () => void;
}

export default function TaskList({ tasks, onRefresh }: TaskListProps) {
  const { filters, setFilter, resetFilters, filtered } = useFilteredTasks(tasks);

  const grouped = TOPICS.reduce<Record<Topic, Task[]>>((acc, topic) => {
    const topicTasks = filtered.filter((t) => t.topic === topic);
    if (topicTasks.length > 0) acc[topic] = topicTasks;
    return acc;
  }, {} as Record<Topic, Task[]>);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>

      <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} />

      {Object.entries(grouped).length === 0 && (
        <p className="text-zinc-500 py-12 text-center">No tasks found.</p>
      )}

      {Object.entries(grouped).map(([topic, topicTasks]) => (
        <div key={topic}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${TOPIC_COLORS[topic as Topic]}`} />
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {TOPIC_LABELS[topic as Topic]}
            </h2>
            <span className="text-xs text-zinc-600">{topicTasks.length}</span>
          </div>
          <div className="space-y-2">
            {topicTasks.map((task) => (
              <TaskCard key={task.id} task={task} onRefresh={onRefresh} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Verify web builds**

Run: `cd web && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add web/src/components/TaskList.tsx
git commit -m "refactor: TaskList uses shared FilterBar, useFilteredTasks, TaskCard"
```

---

### Task 8: Board View Component

**Files:**
- Create: `web/src/components/BoardView.tsx`

**Step 1: Create BoardView**

```typescript
import { useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { Task, TaskStatus } from '../types';
import { STATUSES, STATUS_LABELS } from '../types';
import { useFilteredTasks } from '../hooks/useFilteredTasks';
import FilterBar from './FilterBar';
import TaskCard from './TaskCard';
import { updateTask } from '../api';

interface BoardViewProps {
  tasks: Task[];
  onRefresh: () => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': 'border-zinc-700',
  'in-progress': 'border-blue-800',
  'review': 'border-amber-800',
  'done': 'border-green-800',
};

function SortableCard({ task, onRefresh }: { task: Task; onRefresh: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        onRefresh={onRefresh}
        compact
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export default function BoardView({ tasks, onRefresh }: BoardViewProps) {
  const { filters, setFilter, resetFilters, filtered } = useFilteredTasks(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columns = STATUSES.reduce<Record<TaskStatus, Task[]>>((acc, status) => {
    acc[status] = filtered.filter((t) => t.status === status);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target status: either dropped on a column or on a card in a column
    let targetStatus: TaskStatus | undefined;

    if (STATUSES.includes(over.id as TaskStatus)) {
      targetStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }

    if (!targetStatus || targetStatus === task.status) return;

    // Optimistic update + API call
    try {
      await updateTask(taskId, { status: targetStatus });
      onRefresh();
    } catch {
      onRefresh(); // revert on failure
    }
  }, [tasks, onRefresh]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Board</h1>

      <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} hideStatus />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4 min-h-[60vh]">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={columns[status]}
              onRefresh={onRefresh}
              color={STATUS_COLORS[status]}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} onRefresh={() => {}} compact />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  status,
  tasks,
  onRefresh,
  color,
}: {
  status: TaskStatus;
  tasks: Task[];
  onRefresh: () => void;
  color: string;
}) {
  const { setNodeRef } = useSortable({ id: status, data: { type: 'column' } });

  return (
    <div ref={setNodeRef} className={`border-t-2 ${color} bg-zinc-900/30 rounded-lg p-3 space-y-2`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-400">{STATUS_LABELS[status]}</h3>
        <span className="text-xs text-zinc-600">{tasks.length}</span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableCard key={task.id} task={task} onRefresh={onRefresh} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <p className="text-xs text-zinc-700 text-center py-8">Drop here</p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/components/BoardView.tsx
git commit -m "feat: add BoardView component with @dnd-kit drag-and-drop"
```

---

### Task 9: Wire Board View into App.tsx

**Files:**
- Modify: `web/src/App.tsx` (add 'board' view type and nav item, import BoardView)

**Step 1: Update App.tsx**

Add `'board'` to the View type:
```typescript
type View = 'dashboard' | 'tasks' | 'board' | 'review' | 'add' | 'progress';
```

Add to NAV_ITEMS after tasks:
```typescript
{ view: 'board', label: 'Board' },
```

Add import:
```typescript
import BoardView from './components/BoardView';
```

Add render case after TaskList:
```typescript
{view === 'board' && <BoardView tasks={tasks} onRefresh={fetchData} />}
```

**Step 2: Update `api.ts` to include status in `updateTask`**

The `updateTask` function already sends arbitrary `Partial<Task>`, so `{ status: 'in-progress' }` will work. No changes needed since `Task` type now includes `status`.

**Step 3: Verify full build**

Run: `cd web && npx vite build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add web/src/App.tsx
git commit -m "feat: wire BoardView into App nav and routing"
```

---

### Task 10: Run Migration on Hetzner and Deploy

**Step 1: Push all changes**

```bash
git push origin HEAD
```

**Step 2: Deploy to Hetzner**

```bash
ssh hetzner "cd /var/www/reps && git pull && npm ci && cd web && npm ci && cd .. && npm run migrate && npm run build && pm2 restart reps"
```

**Step 3: Verify**

Visit https://reps-prep.duckdns.org — confirm Board nav item appears, columns render, drag-and-drop works.

**Step 4: Commit any follow-up fixes if needed.**

---

## Dependency Order

```
Task 1 (migration)
  ↓
Task 2 (types + server)
  ↓
Task 3 (install @dnd-kit)   ← can parallel with Task 4
  ↓
Task 4 (useFilteredTasks hook)
  ↓
Task 5 (FilterBar)
  ↓
Task 6 (TaskCard)
  ↓
Task 7 (refactor TaskList)  ← can parallel with Task 8
  ↓
Task 8 (BoardView)
  ↓
Task 9 (wire into App.tsx)
  ↓
Task 10 (deploy)
```
