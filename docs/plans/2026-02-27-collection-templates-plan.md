# Collection Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a template gallery that lets users create pre-configured collections with custom statuses, default views, and sample tasks.

**Architecture:** DB-backed templates (3 new tables + 1 ALTER). Server routes for full CRUD + a transactional `from-template` endpoint. Full-screen gallery view in the frontend. Template tasks are fully editable. Users get 1 custom template; admins unlimited.

**Tech Stack:** PostgreSQL, Hono, Zod, React, Tailwind CSS, postgres.js

**Design doc:** `docs/plans/2026-02-27-collection-templates-design.md`

---

## Parallelization Map

Tasks 1-3 can run in parallel (DB, server validation, frontend types).
Task 4 depends on 1+2 (server routes need DB + validation).
Task 5 depends on 4 (from-template endpoint needs template routes).
Task 6 depends on 3 (frontend API client needs types).
Tasks 7-9 depend on 6 (UI components need API client).
Task 10 depends on 7-9 (App.tsx wiring needs components).
Task 11 depends on 10 (admin panel needs everything working).
Task 12 depends on all (save-as-template needs full flow).

```
[1: Migration] ──┐
[2: Validation] ──┼→ [4: Server routes] → [5: from-template endpoint] ─┐
[3: Types+API] ──→ [6: API client] → [7: TemplateCard] ─┐             │
                                      [8: CreateFromTemplate] ─┤        │
                                      [9: TemplateGallery] ────┤        │
                                                                ↓        ↓
                                              [10: App.tsx wiring + CollectionSwitcher]
                                                                ↓
                                              [11: Admin template management]
                                                                ↓
                                              [12: Save as template]
                                                                ↓
                                              [13: Build + verify]
```

---

### Task 0: Performance — Reduce API Calls + Code Splitting

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/api.ts`
- Modify: `web/vite.config.ts`

This task runs independently before/alongside the template work.

**Step 1: Remove `getDueTasks()` call — derive due tasks client-side**

In `web/src/App.tsx`, remove `getDueTasks()` from the parallel `Promise.all()` fetch. Instead, derive due tasks from the tasks array:

```typescript
// Remove: const dueTasks = await getDueTasks();
// Replace with client-side derivation:
const today = new Date().toISOString().split('T')[0];
const dueTasks = tasks.filter(t => !t.completed && t.nextReview <= today);
```

Update the state: remove `dueTasks` as separate state, compute it with `useMemo` from `tasks`.

Also remove or deprecate the `getDueTasks()` export from `api.ts` (leave the server endpoint for CLI use).

This drops page load from 5 parallel API calls to 4: `getTasks`, `getCollections`, `getTags`, + `getStreaks` (Dashboard-only).

**Step 2: Add Vite code splitting**

In `web/vite.config.ts`, add manual chunk splitting:

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  server: {
    proxy: { ... },
  },
});
```

**Step 3: Add lazy loading for non-default views**

In `App.tsx`, use `React.lazy` for views that aren't the default:

```typescript
const ReviewSession = lazy(() => import('./components/ReviewSession'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const ExportView = lazy(() => import('./components/ExportView'));
const TemplateGallery = lazy(() => import('./components/TemplateGallery'));
```

Wrap lazy components in `<Suspense fallback={<LoadingSpinner />}>`.

**Step 4: Verify lucide-react tree-shaking**

Run `npm run build:web` and check the output chunk sizes. Named imports like `import { Home } from 'lucide-react'` should tree-shake correctly with Vite/Rollup. If the lucide chunk is still large (>50KB), switch to `lucide-react/dist/esm/icons/*` deep imports.

**Step 5: Add ETag middleware for API responses**

Create `server/middleware/etag.ts` — a Hono middleware that:
1. Intercepts GET responses
2. Computes a hash of the JSON response body (use `crypto.createHash('md5')`)
3. Sets `ETag` header with the hash
4. Checks incoming `If-None-Match` header — if it matches, return `304 Not Modified` with empty body
5. Sets `Cache-Control: no-cache` (forces revalidation but allows conditional requests)

```typescript
import { createHash } from 'crypto';
import type { MiddlewareHandler } from 'hono';

export const etag: MiddlewareHandler = async (c, next) => {
  await next();

  if (c.req.method !== 'GET' || c.res.status !== 200) return;

  const body = await c.res.text();
  const hash = `"${createHash('md5').update(body).digest('hex')}"`;

  c.res = new Response(body, c.res);
  c.res.headers.set('ETag', hash);
  c.res.headers.set('Cache-Control', 'no-cache');

  const ifNoneMatch = c.req.header('If-None-Match');
  if (ifNoneMatch === hash) {
    c.res = new Response(null, { status: 304, headers: { ETag: hash } });
  }
};
```

Register in `server/index.ts` after auth middleware but before routes:

```typescript
import { etag } from './middleware/etag.js';
app.use('/*', etag);
```

**Step 6: Add static asset caching to Nginx**

Add to the `location /` block in `deploy/nginx.conf`:

```nginx
# Hashed assets (Vite generates content-hashed filenames)
location ~* \.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$ {
    root /var/www/reps/web/dist;
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}
```

This is safe because Vite's build output uses content-hashed filenames (e.g. `index-abc123.js`), so a new deploy generates new filenames automatically.

**Step 7: Add template-specific caching**

For `GET /templates`, system templates rarely change. Add `Cache-Control: public, max-age=300` (5 min) on the templates route. The ETag middleware handles revalidation after expiry.

In `server/routes/templates.ts`, add to the GET handler response:

```typescript
c.header('Cache-Control', 'public, max-age=300');
```

**Step 8: Commit**

```bash
git add server/middleware/etag.ts server/index.ts deploy/nginx.conf web/src/App.tsx web/src/api.ts web/vite.config.ts
git commit -m "perf: add ETag caching, static asset headers, code splitting, reduce API calls"
```

---

### Task 1: Database Migration

**Files:**
- Create: `db/007-collection-templates.sql`

**Step 1: Write the migration**

```sql
-- Collection templates
CREATE TABLE collection_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  color         TEXT,
  sr_enabled    BOOLEAN DEFAULT false,
  default_view  TEXT DEFAULT 'list' CHECK (default_view IN ('list', 'board')),
  is_system     BOOLEAN DEFAULT false,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Template statuses
CREATE TABLE template_statuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID REFERENCES collection_templates(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  sort_order    INT DEFAULT 0
);

-- Template tasks (editable sample tasks)
CREATE TABLE template_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID REFERENCES collection_templates(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  status_name   TEXT NOT NULL,
  topic         TEXT DEFAULT 'custom',
  sort_order    INT DEFAULT 0
);

-- Add default_view to existing collections table
ALTER TABLE collections ADD COLUMN IF NOT EXISTS default_view TEXT DEFAULT 'list';

-- Seed system templates
-- Interview Prep
WITH t AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES ('Interview Prep', 'Track technical interview preparation with spaced repetition', '🎯', '#8b5cf6', true, 'board', true)
  RETURNING id
)
INSERT INTO template_statuses (template_id, name, color, sort_order)
SELECT t.id, s.name, s.color, s.sort_order FROM t,
(VALUES ('todo', '#71717a', 0), ('studying', '#3b82f6', 1), ('practicing', '#f59e0b', 2), ('confident', '#10b981', 3), ('mastered', '#8b5cf6', 4)) AS s(name, color, sort_order);

WITH t AS (SELECT id FROM collection_templates WHERE name = 'Interview Prep' AND is_system = true LIMIT 1)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT t.id, s.title, s.description, s.status_name, s.topic, s.sort_order FROM t,
(VALUES
  ('System design: URL shortener', 'Design a URL shortening service like bit.ly. Consider scale, storage, and caching.', 'todo', 'system-design', 0),
  ('Behavioral: conflict resolution', 'Prepare a STAR-format story about resolving a technical disagreement.', 'todo', 'behavioral', 1),
  ('LeetCode: sliding window', 'Practice sliding window pattern problems. Focus on variable-size windows.', 'todo', 'coding', 2)
) AS s(title, description, status_name, topic, sort_order);

-- Task Manager
WITH t AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES ('Task Manager', 'Simple task tracking with backlog and progress stages', '✅', '#3b82f6', false, 'list', true)
  RETURNING id
)
INSERT INTO template_statuses (template_id, name, color, sort_order)
SELECT t.id, s.name, s.color, s.sort_order FROM t,
(VALUES ('backlog', '#71717a', 0), ('todo', '#3b82f6', 1), ('in-progress', '#f59e0b', 2), ('done', '#22c55e', 3)) AS s(name, color, sort_order);

WITH t AS (SELECT id FROM collection_templates WHERE name = 'Task Manager' AND is_system = true LIMIT 1)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT t.id, s.title, s.description, s.status_name, s.topic, s.sort_order FROM t,
(VALUES
  ('Set up project structure', 'Create directory layout and initial configuration files.', 'backlog', 'custom', 0),
  ('Write documentation', 'Add README and inline docs for the main modules.', 'backlog', 'custom', 1),
  ('Review pull requests', 'Go through open PRs and leave review comments.', 'todo', 'custom', 2)
) AS s(title, description, status_name, topic, sort_order);

-- Bug Tracker
WITH t AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES ('Bug Tracker', 'Track bugs from triage through verification with a Kanban board', '🐛', '#ef4444', false, 'board', true)
  RETURNING id
)
INSERT INTO template_statuses (template_id, name, color, sort_order)
SELECT t.id, s.name, s.color, s.sort_order FROM t,
(VALUES ('triage', '#71717a', 0), ('investigating', '#3b82f6', 1), ('fixing', '#f59e0b', 2), ('in-review', '#8b5cf6', 3), ('verified', '#10b981', 4), ('closed', '#22c55e', 5)) AS s(name, color, sort_order);

WITH t AS (SELECT id FROM collection_templates WHERE name = 'Bug Tracker' AND is_system = true LIMIT 1)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT t.id, s.title, s.description, s.status_name, s.topic, s.sort_order FROM t,
(VALUES
  ('Login page 500 error', 'Users report intermittent 500 errors on the login page under load.', 'triage', 'custom', 0),
  ('Dark mode contrast issue', 'Some text is unreadable in dark mode due to low contrast ratios.', 'triage', 'custom', 1)
) AS s(title, description, status_name, topic, sort_order);

-- Learning Tracker
WITH t AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES ('Learning Tracker', 'Track skills and topics you are learning with spaced repetition', '📚', '#10b981', true, 'board', true)
  RETURNING id
)
INSERT INTO template_statuses (template_id, name, color, sort_order)
SELECT t.id, s.name, s.color, s.sort_order FROM t,
(VALUES ('to-learn', '#71717a', 0), ('learning', '#3b82f6', 1), ('practicing', '#f59e0b', 2), ('mastered', '#22c55e', 3)) AS s(name, color, sort_order);

WITH t AS (SELECT id FROM collection_templates WHERE name = 'Learning Tracker' AND is_system = true LIMIT 1)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT t.id, s.title, s.description, s.status_name, s.topic, s.sort_order FROM t,
(VALUES
  ('TypeScript generics', 'Understand conditional types, mapped types, and generic constraints.', 'to-learn', 'custom', 0),
  ('React Server Components', 'Learn the RSC architecture, streaming, and when to use client vs server.', 'to-learn', 'custom', 1)
) AS s(title, description, status_name, topic, sort_order);

-- Reading List
WITH t AS (
  INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system)
  VALUES ('Reading List', 'Track books and articles with reading progress', '📖', '#f59e0b', false, 'list', true)
  RETURNING id
)
INSERT INTO template_statuses (template_id, name, color, sort_order)
SELECT t.id, s.name, s.color, s.sort_order FROM t,
(VALUES ('to-read', '#71717a', 0), ('reading', '#3b82f6', 1), ('taking-notes', '#f59e0b', 2), ('finished', '#22c55e', 3)) AS s(name, color, sort_order);

WITH t AS (SELECT id FROM collection_templates WHERE name = 'Reading List' AND is_system = true LIMIT 1)
INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
SELECT t.id, s.title, s.description, s.status_name, s.topic, s.sort_order FROM t,
(VALUES
  ('Designing Data-Intensive Applications', 'Martin Kleppmann. Covers distributed systems, replication, partitioning.', 'to-read', 'papers', 0),
  ('Clean Architecture', 'Robert C. Martin. Software design principles and architecture patterns.', 'to-read', 'papers', 1)
) AS s(title, description, status_name, topic, sort_order);
```

**Step 2: Commit**

```bash
git add db/007-collection-templates.sql
git commit -m "feat: add collection templates migration with seed data"
```

---

### Task 2: Zod Validation Schemas

**Files:**
- Modify: `server/validation.ts`

**Step 1: Add template schemas after existing schemas**

Add these schemas to `server/validation.ts` after the existing `mockRespondSchema`:

```typescript
export const templateStatusInput = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const templateTaskInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  statusName: z.string().min(1).max(100),
  topic: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const templateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  srEnabled: z.boolean().optional(),
  defaultView: z.enum(['list', 'board']).optional(),
  statuses: z.array(templateStatusInput).min(1).max(20),
  tasks: z.array(templateTaskInput).max(10).optional(),
});

export const patchTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  srEnabled: z.boolean().optional(),
  defaultView: z.enum(['list', 'board']).optional(),
});

export const patchTemplateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  statusName: z.string().min(1).max(100).optional(),
  topic: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const fromTemplateSchema = z.object({
  templateId: z.string().regex(UUID_RE),
  name: z.string().min(1).max(200).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});
```

**Step 2: Commit**

```bash
git add server/validation.ts
git commit -m "feat: add zod schemas for collection templates"
```

---

### Task 3: Frontend Types + API Client

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`

**Step 1: Add template types to `web/src/types.ts`**

Add after the `CollectionStatus` interface:

```typescript
export interface TemplateStatus {
  id: string;
  templateId: string;
  name: string;
  color: string | null;
  sortOrder: number;
}

export interface TemplateTask {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  statusName: string;
  topic: string;
  sortOrder: number;
}

export interface CollectionTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  srEnabled: boolean;
  defaultView: 'list' | 'board';
  isSystem: boolean;
  userId: string | null;
  createdAt: string;
  statuses: TemplateStatus[];
  tasks: TemplateTask[];
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  srEnabled?: boolean;
  defaultView?: 'list' | 'board';
  statuses: { name: string; color?: string | null; sortOrder?: number }[];
  tasks?: { title: string; description?: string; statusName: string; topic?: string; sortOrder?: number }[];
}

export interface CreateFromTemplateInput {
  templateId: string;
  name?: string;
  color?: string;
}
```

**Step 2: Add API methods to `web/src/api.ts`**

Add these functions (follow existing pattern of typed `request<T>` calls):

```typescript
// Templates
export async function getTemplates(): Promise<CollectionTemplate[]> {
  return request<CollectionTemplate[]>('/templates');
}

export async function createTemplate(input: CreateTemplateInput): Promise<CollectionTemplate> {
  return request<CollectionTemplate>('/templates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTemplate(id: string, updates: Partial<CreateTemplateInput>): Promise<CollectionTemplate> {
  return request<CollectionTemplate>(`/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await request<unknown>(`/templates/${id}`, { method: 'DELETE' });
}

// Template tasks CRUD
export async function createTemplateTask(templateId: string, input: { title: string; description?: string; statusName: string; topic?: string; sortOrder?: number }): Promise<TemplateTask> {
  return request<TemplateTask>(`/templates/${templateId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTemplateTask(templateId: string, taskId: string, updates: Partial<{ title: string; description: string | null; statusName: string; topic: string; sortOrder: number }>): Promise<TemplateTask> {
  return request<TemplateTask>(`/templates/${templateId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteTemplateTask(templateId: string, taskId: string): Promise<void> {
  await request<unknown>(`/templates/${templateId}/tasks/${taskId}`, { method: 'DELETE' });
}

// Create collection from template
export async function createCollectionFromTemplate(input: CreateFromTemplateInput): Promise<Collection> {
  return request<Collection>('/collections/from-template', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Admin template management
export async function getAdminTemplates(): Promise<CollectionTemplate[]> {
  return request<CollectionTemplate[]>('/admin/templates');
}

export async function adminDeleteTemplate(id: string): Promise<void> {
  await request<unknown>(`/admin/templates/${id}`, { method: 'DELETE' });
}
```

**Step 3: Commit**

```bash
git add web/src/types.ts web/src/api.ts
git commit -m "feat: add template types and API client methods"
```

---

### Task 4: Server Routes — Template CRUD

**Files:**
- Create: `server/routes/templates.ts`
- Modify: `server/index.ts` (register route)

**Step 1: Create `server/routes/templates.ts`**

Follow the exact pattern from `server/routes/collections.ts`:

```typescript
import { Hono } from 'hono';
import sql from '../db/client.js';
import {
  validateUuid,
  buildUpdates,
  templateSchema,
  patchTemplateSchema,
  templateTaskInput,
  patchTemplateTaskSchema,
} from '../validation.js';
import { getUserById } from '../auth/users.js';

type AppEnv = { Variables: { userId: string } };
const templates = new Hono<AppEnv>();

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sr_enabled: boolean;
  default_view: string;
  is_system: boolean;
  user_id: string | null;
  created_at: string;
}

interface TemplateStatusRow {
  id: string;
  template_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

interface TemplateTaskRow {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  status_name: string;
  topic: string;
  sort_order: number;
}

function rowToTemplate(row: TemplateRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    srEnabled: row.sr_enabled,
    defaultView: row.default_view,
    isSystem: row.is_system,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

function statusRowToStatus(row: TemplateStatusRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  };
}

function taskRowToTask(row: TemplateTaskRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    description: row.description,
    statusName: row.status_name,
    topic: row.topic,
    sortOrder: row.sort_order,
  };
}

async function loadTemplateWithChildren(templateId: string) {
  const statusRows = await sql<TemplateStatusRow[]>`
    SELECT * FROM template_statuses WHERE template_id = ${templateId} ORDER BY sort_order ASC
  `;
  const taskRows = await sql<TemplateTaskRow[]>`
    SELECT * FROM template_tasks WHERE template_id = ${templateId} ORDER BY sort_order ASC
  `;
  return {
    statuses: statusRows.map(statusRowToStatus),
    tasks: taskRows.map(taskRowToTask),
  };
}

// GET /templates — list system templates + user's own
templates.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await sql<TemplateRow[]>`
    SELECT * FROM collection_templates
    WHERE is_system = true OR user_id = ${userId}
    ORDER BY is_system DESC, created_at ASC
  `;

  const templateIds = rows.map((r) => r.id);
  const allStatuses = templateIds.length > 0
    ? await sql<TemplateStatusRow[]>`SELECT * FROM template_statuses WHERE template_id = ANY(${templateIds}) ORDER BY sort_order ASC`
    : [];
  const allTasks = templateIds.length > 0
    ? await sql<TemplateTaskRow[]>`SELECT * FROM template_tasks WHERE template_id = ANY(${templateIds}) ORDER BY sort_order ASC`
    : [];

  const statusesByTemplate = new Map<string, ReturnType<typeof statusRowToStatus>[]>();
  for (const sr of allStatuses) {
    const list = statusesByTemplate.get(sr.template_id) ?? [];
    list.push(statusRowToStatus(sr));
    statusesByTemplate.set(sr.template_id, list);
  }
  const tasksByTemplate = new Map<string, ReturnType<typeof taskRowToTask>[]>();
  for (const tr of allTasks) {
    const list = tasksByTemplate.get(tr.template_id) ?? [];
    list.push(taskRowToTask(tr));
    tasksByTemplate.set(tr.template_id, list);
  }

  return c.json(rows.map((row) => ({
    ...rowToTemplate(row),
    statuses: statusesByTemplate.get(row.id) ?? [],
    tasks: tasksByTemplate.get(row.id) ?? [],
  })));
});

// POST /templates — create custom template (max 1 for non-admin)
templates.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const raw = await c.req.json();
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  // Check limit for non-admin users
  const user = await getUserById(userId);
  if (!user?.isAdmin) {
    const [existing] = await sql<{ count: string }[]>`
      SELECT COUNT(*) as count FROM collection_templates WHERE user_id = ${userId} AND is_system = false
    `;
    if (parseInt(existing.count, 10) >= 1) {
      return c.json({ error: 'Non-admin users can create at most 1 custom template' }, 403);
    }
  }

  const result = await sql.begin(async (tx) => {
    const [row] = await tx<TemplateRow[]>`
      INSERT INTO collection_templates (name, description, icon, color, sr_enabled, default_view, is_system, user_id)
      VALUES (${body.name}, ${body.description ?? null}, ${body.icon ?? null}, ${body.color ?? null}, ${body.srEnabled ?? false}, ${body.defaultView ?? 'list'}, false, ${userId})
      RETURNING *
    `;

    for (const [i, s] of body.statuses.entries()) {
      await tx`
        INSERT INTO template_statuses (template_id, name, color, sort_order)
        VALUES (${row.id}, ${s.name}, ${s.color ?? null}, ${s.sortOrder ?? i})
      `;
    }

    if (body.tasks) {
      for (const [i, t] of body.tasks.entries()) {
        await tx`
          INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
          VALUES (${row.id}, ${t.title}, ${t.description ?? null}, ${t.statusName}, ${t.topic ?? 'custom'}, ${t.sortOrder ?? i})
        `;
      }
    }

    return row;
  });

  const children = await loadTemplateWithChildren(result.id);
  return c.json({ ...rowToTemplate(result), ...children }, 201);
});

// PATCH /templates/:id — update own template (or any if admin)
templates.patch('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const raw = await c.req.json();
  const parsed = patchTemplateSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const user = await getUserById(userId);
  const isAdmin = user?.isAdmin ?? false;
  const ownerWhere = isAdmin ? sql`` : sql`AND user_id = ${userId}`;

  const updates = buildUpdates(body as Record<string, unknown>, {
    name: 'name',
    description: 'description',
    icon: 'icon',
    color: 'color',
    srEnabled: 'sr_enabled',
    defaultView: 'default_view',
  });

  if (Object.keys(updates).length === 0) return c.json({ error: 'No valid fields' }, 400);

  const [row] = await sql<TemplateRow[]>`
    UPDATE collection_templates SET ${sql(updates)} WHERE id = ${id} ${ownerWhere} RETURNING *
  `;
  if (!row) return c.json({ error: 'Template not found' }, 404);

  const children = await loadTemplateWithChildren(row.id);
  return c.json({ ...rowToTemplate(row), ...children });
});

// DELETE /templates/:id — delete own template (or any if admin)
templates.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const user = await getUserById(userId);
  const isAdmin = user?.isAdmin ?? false;
  const ownerWhere = isAdmin ? sql`` : sql`AND user_id = ${userId} AND is_system = false`;

  const [row] = await sql<TemplateRow[]>`
    DELETE FROM collection_templates WHERE id = ${id} ${ownerWhere} RETURNING *
  `;
  if (!row) return c.json({ error: 'Template not found' }, 404);
  return c.json({ deleted: true, id });
});

// --- Template Tasks CRUD ---

// POST /templates/:id/tasks
templates.post('/:id/tasks', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const user = await getUserById(userId);
  const isAdmin = user?.isAdmin ?? false;
  const ownerWhere = isAdmin ? sql`` : sql`AND user_id = ${userId}`;

  const [template] = await sql<TemplateRow[]>`SELECT id FROM collection_templates WHERE id = ${id} ${ownerWhere}`;
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const raw = await c.req.json();
  const parsed = templateTaskInput.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const [row] = await sql<TemplateTaskRow[]>`
    INSERT INTO template_tasks (template_id, title, description, status_name, topic, sort_order)
    VALUES (${id}, ${body.title}, ${body.description ?? null}, ${body.statusName}, ${body.topic ?? 'custom'}, ${body.sortOrder ?? 0})
    RETURNING *
  `;
  return c.json(taskRowToTask(row), 201);
});

// PATCH /templates/:id/tasks/:taskId
templates.patch('/:id/tasks/:taskId', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const taskId = c.req.param('taskId');
  if (!validateUuid(id) || !validateUuid(taskId)) return c.json({ error: 'Invalid ID format' }, 400);

  const user = await getUserById(userId);
  const isAdmin = user?.isAdmin ?? false;
  const ownerWhere = isAdmin ? sql`` : sql`AND user_id = ${userId}`;

  const [template] = await sql<TemplateRow[]>`SELECT id FROM collection_templates WHERE id = ${id} ${ownerWhere}`;
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const raw = await c.req.json();
  const parsed = patchTemplateTaskSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const updates = buildUpdates(body as Record<string, unknown>, {
    title: 'title',
    description: 'description',
    statusName: 'status_name',
    topic: 'topic',
    sortOrder: 'sort_order',
  });

  if (Object.keys(updates).length === 0) return c.json({ error: 'No valid fields' }, 400);

  const [row] = await sql<TemplateTaskRow[]>`
    UPDATE template_tasks SET ${sql(updates)} WHERE id = ${taskId} AND template_id = ${id} RETURNING *
  `;
  if (!row) return c.json({ error: 'Template task not found' }, 404);
  return c.json(taskRowToTask(row));
});

// DELETE /templates/:id/tasks/:taskId
templates.delete('/:id/tasks/:taskId', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const taskId = c.req.param('taskId');
  if (!validateUuid(id) || !validateUuid(taskId)) return c.json({ error: 'Invalid ID format' }, 400);

  const user = await getUserById(userId);
  const isAdmin = user?.isAdmin ?? false;
  const ownerWhere = isAdmin ? sql`` : sql`AND user_id = ${userId}`;

  const [template] = await sql<TemplateRow[]>`SELECT id FROM collection_templates WHERE id = ${id} ${ownerWhere}`;
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const [row] = await sql<TemplateTaskRow[]>`
    DELETE FROM template_tasks WHERE id = ${taskId} AND template_id = ${id} RETURNING *
  `;
  if (!row) return c.json({ error: 'Template task not found' }, 404);
  return c.json({ deleted: true, id: taskId });
});

// --- Admin routes ---

// GET /admin/templates
templates.get('/admin/all', async (c) => {
  const userId = c.get('userId') as string;
  const user = await getUserById(userId);
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const rows = await sql<TemplateRow[]>`
    SELECT * FROM collection_templates ORDER BY is_system DESC, created_at ASC
  `;
  const templateIds = rows.map((r) => r.id);
  const allStatuses = templateIds.length > 0
    ? await sql<TemplateStatusRow[]>`SELECT * FROM template_statuses WHERE template_id = ANY(${templateIds}) ORDER BY sort_order ASC`
    : [];
  const allTasks = templateIds.length > 0
    ? await sql<TemplateTaskRow[]>`SELECT * FROM template_tasks WHERE template_id = ANY(${templateIds}) ORDER BY sort_order ASC`
    : [];

  const statusesByTemplate = new Map<string, ReturnType<typeof statusRowToStatus>[]>();
  for (const sr of allStatuses) {
    const list = statusesByTemplate.get(sr.template_id) ?? [];
    list.push(statusRowToStatus(sr));
    statusesByTemplate.set(sr.template_id, list);
  }
  const tasksByTemplate = new Map<string, ReturnType<typeof taskRowToTask>[]>();
  for (const tr of allTasks) {
    const list = tasksByTemplate.get(tr.template_id) ?? [];
    list.push(taskRowToTask(tr));
    tasksByTemplate.set(tr.template_id, list);
  }

  return c.json(rows.map((row) => ({
    ...rowToTemplate(row),
    statuses: statusesByTemplate.get(row.id) ?? [],
    tasks: tasksByTemplate.get(row.id) ?? [],
  })));
});

export default templates;
```

**Step 2: Register in `server/index.ts`**

Add import: `import templates from './routes/templates.js';`

Add route mount after the collections route: `app.route('/templates', templates);`

**Step 3: Commit**

```bash
git add server/routes/templates.ts server/index.ts
git commit -m "feat: add template CRUD server routes with task editing"
```

---

### Task 5: From-Template Endpoint

**Files:**
- Modify: `server/routes/collections.ts`

**Step 1: Add the `POST /from-template` endpoint**

Add to `server/routes/collections.ts` after the existing `POST /` route. Import `fromTemplateSchema` from validation. This endpoint creates a collection + statuses + tasks in a single transaction.

```typescript
// POST /collections/from-template
collections.post('/from-template', async (c) => {
  const userId = c.get('userId') as string;
  const raw = await c.req.json();
  const parsed = fromTemplateSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  // Load template
  const [template] = await sql<{
    id: string; name: string; description: string | null; icon: string | null;
    color: string | null; sr_enabled: boolean; default_view: string; is_system: boolean; user_id: string | null;
  }[]>`
    SELECT * FROM collection_templates WHERE id = ${body.templateId}
    AND (is_system = true OR user_id = ${userId})
  `;
  if (!template) return c.json({ error: 'Template not found' }, 404);

  const templateStatuses = await sql<{ name: string; color: string | null; sort_order: number }[]>`
    SELECT name, color, sort_order FROM template_statuses WHERE template_id = ${template.id} ORDER BY sort_order ASC
  `;
  const templateTasks = await sql<{ title: string; description: string | null; status_name: string; topic: string; sort_order: number }[]>`
    SELECT title, description, status_name, topic, sort_order FROM template_tasks WHERE template_id = ${template.id} ORDER BY sort_order ASC
  `;

  const result = await sql.begin(async (tx) => {
    // Create collection
    const collName = body.name ?? template.name;
    const collColor = body.color ?? template.color;
    const [col] = await tx<CollectionRow[]>`
      INSERT INTO collections (name, icon, color, sr_enabled, default_view, sort_order, user_id)
      VALUES (${collName}, ${template.icon}, ${collColor}, ${template.sr_enabled}, ${template.default_view}, 0, ${userId ?? null})
      RETURNING *
    `;

    // Create statuses
    const createdStatuses = [];
    for (const s of templateStatuses) {
      const [statusRow] = await tx<CollectionStatusRow[]>`
        INSERT INTO collection_statuses (collection_id, name, color, sort_order)
        VALUES (${col.id}, ${s.name}, ${s.color}, ${s.sort_order})
        RETURNING *
      `;
      createdStatuses.push(statusRowToStatus(statusRow));
    }

    // Create sample tasks
    const firstStatus = templateStatuses[0]?.name ?? 'todo';
    const today = new Date().toISOString().split('T')[0];
    for (const t of templateTasks) {
      await tx`
        INSERT INTO tasks (id, topic, title, description, status, collection_id, next_review, created_at, user_id)
        VALUES (gen_random_uuid(), ${t.topic}, ${t.title}, ${t.description}, ${t.status_name}, ${col.id}, ${today}, ${today}, ${userId ?? null})
      `;
    }

    return { ...rowToCollection(col), defaultView: col.default_view ?? 'list', statuses: createdStatuses };
  });

  return c.json(result, 201);
});
```

Note: The `collections` table now has `default_view` — update the `CollectionRow` interface and `rowToCollection` function to include it. Also update the `PATCH` route's `buildUpdates` fieldMap to include `defaultView: 'default_view'`.

**Step 2: Update `CollectionRow` interface and converter**

In the same file, add `default_view: string | null;` to `CollectionRow` and `defaultView: row.default_view ?? 'list'` to `rowToCollection`.

**Step 3: Import `fromTemplateSchema` at the top**

Add to the import from `../validation.js`.

**Step 4: Commit**

```bash
git add server/routes/collections.ts
git commit -m "feat: add POST /collections/from-template transactional endpoint"
```

---

### Task 6: Update Frontend Collection Type

**Files:**
- Modify: `web/src/types.ts`

**Step 1: Add `defaultView` to Collection interface**

```typescript
export interface Collection {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  srEnabled: boolean;
  defaultView?: 'list' | 'board';  // NEW
  sortOrder: number;
  createdAt: string;
  statuses: CollectionStatus[];
}
```

**Step 2: Commit**

```bash
git add web/src/types.ts
git commit -m "feat: add defaultView to Collection type"
```

---

### Task 7: TemplateCard Component

**Files:**
- Create: `web/src/components/TemplateCard.tsx`

**Step 1: Create the component**

A card that displays a template's preview: icon, name, description, colored status chips, SR badge, view indicator, task count. Receives `template` and `onClick` props. Use Tailwind dark theme consistent with existing components.

Layout:
- Top: icon (large emoji) + name
- Middle: description text (zinc-400, 2-line clamp)
- Status chips row: small colored pills with status names
- Bottom row: SR badge if enabled, view type icon (list/board), "{n} starter tasks" label
- Entire card clickable, hover state with border highlight

Follow the visual style of existing card components in the project.

**Step 2: Commit**

```bash
git add web/src/components/TemplateCard.tsx
git commit -m "feat: add TemplateCard component"
```

---

### Task 8: CreateFromTemplate Modal Component

**Files:**
- Create: `web/src/components/CreateFromTemplate.tsx`

**Step 1: Create the component**

A modal/overlay that appears when a template card is clicked. Props: `template: CollectionTemplate`, `onCreated: (collection: Collection) => void`, `onClose: () => void`.

Layout:
- Template icon + name as header
- Name input (pre-filled with template name, editable)
- Color picker (8 swatches, pre-filled with template color)
- Preview section: list of statuses that will be created + count of sample tasks
- "Create Collection" button (primary) + "Cancel" button
- Loading state while POST is in flight
- On success: call `onCreated` with the returned collection

Use the same modal backdrop pattern as `CollectionEditModal` (fixed overlay, centered card, click-outside to close).

**Step 2: Commit**

```bash
git add web/src/components/CreateFromTemplate.tsx
git commit -m "feat: add CreateFromTemplate modal component"
```

---

### Task 9: TemplateGallery View Component

**Files:**
- Create: `web/src/components/TemplateGallery.tsx`

**Step 1: Create the component**

Full-screen gallery view. Props: `onCollectionCreated: (collection: Collection) => void`, `onNavigate: (view: string) => void`, `user: User`.

Layout:
- Header: "Start a new collection" h1 + "Choose a template or start from scratch" subtitle
- If user has a custom template: "My Templates" section header + card
- "Templates" section header + grid of system template cards
- Grid: 1-col on mobile, 2-col on sm, 3-col on lg
- "Start from scratch" card at the end (dashed border, muted, plus icon, opens the existing inline create form or navigates to a blank collection creation)
- Fetches templates from `GET /templates` on mount
- Loading skeleton while fetching
- On template card click: open CreateFromTemplate modal
- On successful creation: call `onCollectionCreated` then `onNavigate('tasks')`

**Step 2: Commit**

```bash
git add web/src/components/TemplateGallery.tsx
git commit -m "feat: add TemplateGallery view component"
```

---

### Task 10: Wire Up App.tsx + CollectionSwitcher

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/CollectionSwitcher.tsx`

**Step 1: Add `templates` to the View type and routing in App.tsx**

- Add `'templates'` to the `View` union type
- Add `'templates'` to the `VALID_VIEWS` set
- Add conditional render: `{view === 'templates' && <TemplateGallery ... />}`
- Import `TemplateGallery`
- Pass required props: `onCollectionCreated`, `onNavigate: setView`, `user`

**Step 2: Update CollectionSwitcher to add "Browse templates" link**

In the dropdown, after the collection list and before/after the inline create form, add:

```tsx
<button
  onClick={() => {
    onBrowseTemplates();
    setOpen(false);
  }}
  className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-2"
>
  <LayoutTemplate className="w-4 h-4" />
  Browse templates
</button>
```

Add `onBrowseTemplates: () => void` to the component props. In App.tsx, pass `onBrowseTemplates={() => setView('templates')}`.

**Step 3: Handle empty state**

When `collections.length === 0` and user is authenticated, consider auto-navigating to `#templates` or showing a prominent CTA in Dashboard.

**Step 4: Wire default_view on collection switch**

When `activeId` changes to a collection with `defaultView === 'board'`, set the layout mode to board view. This requires checking where the layout toggle state lives and integrating.

**Step 5: Commit**

```bash
git add web/src/App.tsx web/src/components/CollectionSwitcher.tsx
git commit -m "feat: wire template gallery into app routing and collection switcher"
```

---

### Task 11: Admin Template Management

**Files:**
- Modify: `web/src/components/Settings.tsx`

**Step 1: Add template management section to admin panel**

In the existing admin panel section of Settings.tsx (inside the `{user.isAdmin && ...}` block), add a "Templates" subsection:

- Fetch all templates via `getAdminTemplates()` on mount (alongside existing admin data fetches)
- Display each template as a row: icon, name, system/user badge, owner email (if user-created), status count, task count
- Delete button per template (with confirmation)
- System templates show a "System" badge and delete requires extra confirmation

Follow the existing admin user list pattern for styling.

**Step 2: Commit**

```bash
git add web/src/components/Settings.tsx
git commit -m "feat: add admin template management to settings panel"
```

---

### Task 12: Save As Template

**Files:**
- Modify: `web/src/components/CollectionEditModal.tsx`

**Step 1: Add "Save as Template" button**

In the CollectionEditModal, add a button after the existing form fields (before the delete section):

- Button text: "Save as Template"
- On click: gather current collection's statuses + first 3 tasks
- POST to `/templates` with collection data mapped to template format
- Success: show toast/notification "Template saved!"
- Error: if 403 (limit reached), show "You can only save 1 custom template. Delete your existing one first."
- Disabled state while saving

The button should call `createTemplate()` from api.ts with:
```typescript
{
  name: collection.name,
  description: null,
  icon: collection.icon,
  color: collection.color,
  srEnabled: collection.srEnabled,
  defaultView: collection.defaultView ?? 'list',
  statuses: collection.statuses.map(s => ({ name: s.name, color: s.color, sortOrder: s.sortOrder })),
  tasks: tasks.slice(0, 3).map((t, i) => ({ title: t.title, description: t.description, statusName: t.status, topic: t.topic, sortOrder: i })),
}
```

Note: This requires the modal to receive `tasks` for the current collection as a prop (or fetch them).

**Step 2: Commit**

```bash
git add web/src/components/CollectionEditModal.tsx
git commit -m "feat: add save-as-template to collection edit modal"
```

---

### Task 13: Build + Verify

**Step 1: Run typecheck**

```bash
npm run typecheck
```

Fix any type errors.

**Step 2: Run lint**

```bash
npm run lint
```

Fix any lint issues.

**Step 3: Run format**

```bash
npx prettier --write "server/**/*.ts" "web/src/**/*.{ts,tsx}"
```

**Step 4: Build server**

```bash
npm run build:server
```

**Step 5: Build web**

```bash
npm run build:web
```

**Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build and lint issues for collection templates"
```

**Step 7: Create PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat: collection template gallery" --body "..."
```
