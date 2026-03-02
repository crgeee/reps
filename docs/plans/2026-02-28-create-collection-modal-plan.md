# Create Collection Modal + Collection-Scoped Topics — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the inline "New collection" form in the dropdown with a two-step modal (pick template → customize), and make the AddTask topic selector use collection-specific topics defined by templates.

**Architecture:** New DB tables (`template_topics`, `collection_topics`) batch-loaded alongside statuses using `ANY()` queries. A new `CreateCollectionModal` component with two internal steps replaces the inline form. AddTask reads topics from the active collection prop — zero additional API calls.

**Tech Stack:** PostgreSQL, Hono, postgres.js, React, TypeScript, Tailwind CSS

**Design doc:** `docs/plans/2026-02-28-create-collection-modal-design.md`

---

### Task 1: DB Migration — collection topics tables

**Files:**
- Create: `db/008-collection-topics.sql`

**Step 1: Write the migration**

```sql
-- Template topics: categories defined per template
CREATE TABLE IF NOT EXISTS template_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES collection_templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  sort_order  INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_template_topics_template ON template_topics(template_id);

-- Collection topics: categories per collection, populated from template on creation
CREATE TABLE IF NOT EXISTS collection_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  sort_order    INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_collection_topics_collection ON collection_topics(collection_id);

-- Relax CHECK constraint on tasks.topic to allow custom topic values
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_topic_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_topic_check CHECK (char_length(topic) > 0 AND char_length(topic) <= 100);

-- =============================================================================
-- Seed template topics for existing system templates
-- =============================================================================

-- Interview Prep topics
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Coding',        '#3b82f6', 0),
  ('System Design', '#8b5cf6', 1),
  ('Behavioral',    '#10b981', 2),
  ('Papers',        '#f59e0b', 3)
) AS t(name, color, sort_order)
WHERE ct.name = 'Interview Prep' AND ct.is_system = true
AND NOT EXISTS (SELECT 1 FROM template_topics WHERE template_id = ct.id);

-- Task Manager topics
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Feature', '#3b82f6', 0),
  ('Bug',     '#ef4444', 1),
  ('Chore',   '#71717a', 2)
) AS t(name, color, sort_order)
WHERE ct.name = 'Task Manager' AND ct.is_system = true
AND NOT EXISTS (SELECT 1 FROM template_topics WHERE template_id = ct.id);

-- Bug Tracker topics
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Frontend', '#3b82f6', 0),
  ('Backend',  '#8b5cf6', 1),
  ('Infra',    '#f59e0b', 2)
) AS t(name, color, sort_order)
WHERE ct.name = 'Bug Tracker' AND ct.is_system = true
AND NOT EXISTS (SELECT 1 FROM template_topics WHERE template_id = ct.id);

-- Learning Tracker topics
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Concept',  '#3b82f6', 0),
  ('Practice', '#f59e0b', 1),
  ('Project',  '#10b981', 2)
) AS t(name, color, sort_order)
WHERE ct.name = 'Learning Tracker' AND ct.is_system = true
AND NOT EXISTS (SELECT 1 FROM template_topics WHERE template_id = ct.id);

-- Reading List topics
INSERT INTO template_topics (template_id, name, color, sort_order)
SELECT ct.id, t.name, t.color, t.sort_order
FROM collection_templates ct
CROSS JOIN (VALUES
  ('Book',    '#8b5cf6', 0),
  ('Paper',   '#f59e0b', 1),
  ('Article', '#3b82f6', 2)
) AS t(name, color, sort_order)
WHERE ct.name = 'Reading List' AND ct.is_system = true
AND NOT EXISTS (SELECT 1 FROM template_topics WHERE template_id = ct.id);
```

**Step 2: Run migration**

Run: `npm run migrate`
Expected: Migration completes without errors.

**Step 3: Verify tables exist**

Run: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM template_topics;"`
Expected: Returns count of seeded rows (14 total across 5 templates).

**Step 4: Commit**

```bash
git add db/008-collection-topics.sql
git commit -m "feat: add template_topics and collection_topics tables with seed data"
```

---

### Task 2: Validation schemas for topics

**Files:**
- Modify: `server/validation.ts`

**Step 1: Add topic schemas**

Add after the `patchCollectionStatusSchema` export (line 73):

```typescript
export const collectionTopicSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const patchCollectionTopicSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
```

**Step 2: Add `templateTopicInput` schema**

Add after `templateStatusInput` (line 96):

```typescript
export const templateTopicInput = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
```

**Step 3: Add `topics` field to `templateSchema`**

In the `templateSchema` object (line 106-127), add after the `tasks` field:

```typescript
topics: z.array(templateTopicInput).max(20).optional(),
```

**Step 4: Relax `topicEnum` to allow custom topic strings**

Change `topicEnum` (line 10) from:

```typescript
export const topicEnum = z.enum(['coding', 'system-design', 'behavioral', 'papers', 'custom']);
```

to:

```typescript
export const topicEnum = z.string().min(1).max(100);
```

**Step 5: Verify build**

Run: `npm run typecheck`
Expected: No type errors.

**Step 6: Commit**

```bash
git add server/validation.ts
git commit -m "feat: add validation schemas for collection and template topics"
```

---

### Task 3: Server — batch-load topics in GET /collections

**Files:**
- Modify: `server/routes/collections.ts`

**Step 1: Add `CollectionTopicRow` interface**

Add after `CollectionStatusRow` interface (line 33):

```typescript
interface CollectionTopicRow {
  id: string;
  collection_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

function topicRowToTopic(row: CollectionTopicRow) {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  };
}
```

**Step 2: Batch-load topics in `GET /collections`**

In the `GET /` handler (lines 58-82), change the status query block to load topics in parallel. Replace lines 67-75 with:

```typescript
  const [statusRows, topicRows] = await Promise.all([
    sql<CollectionStatusRow[]>`
      SELECT * FROM collection_statuses WHERE collection_id = ANY(${collectionIds}) ORDER BY sort_order ASC
    `,
    sql<CollectionTopicRow[]>`
      SELECT * FROM collection_topics WHERE collection_id = ANY(${collectionIds}) ORDER BY sort_order ASC
    `,
  ]);
  const statusesByCollection = new Map<string, ReturnType<typeof statusRowToStatus>[]>();
  for (const sr of statusRows) {
    const list = statusesByCollection.get(sr.collection_id) ?? [];
    list.push(statusRowToStatus(sr));
    statusesByCollection.set(sr.collection_id, list);
  }
  const topicsByCollection = new Map<string, ReturnType<typeof topicRowToTopic>[]>();
  for (const tr of topicRows) {
    const list = topicsByCollection.get(tr.collection_id) ?? [];
    list.push(topicRowToTopic(tr));
    topicsByCollection.set(tr.collection_id, list);
  }
```

Update the response mapping (line 76-80) to include topics:

```typescript
  return c.json(
    rows.map((row) => ({
      ...rowToCollection(row),
      statuses: statusesByCollection.get(row.id) ?? [],
      topics: topicsByCollection.get(row.id) ?? [],
    })),
  );
```

**Step 3: Copy topics in `POST /collections/from-template`**

In the from-template handler (lines 101-167), after loading `templateStatuses` and `templateTasks`, also load template topics. Add after line 133:

```typescript
  const templateTopics = await sql<{ name: string; color: string | null; sort_order: number }[]>`
    SELECT name, color, sort_order FROM template_topics WHERE template_id = ${template.id} ORDER BY sort_order ASC
  `;
```

Inside the transaction, after the status insertion loop and before task insertion (after line 153), add:

```typescript
    const createdTopics = [];
    for (const t of templateTopics) {
      const [topicRow] = await tx<CollectionTopicRow[]>`
        INSERT INTO collection_topics (collection_id, name, color, sort_order)
        VALUES (${col.id}, ${t.name}, ${t.color}, ${t.sort_order})
        RETURNING *
      `;
      createdTopics.push(topicRowToTopic(topicRow));
    }
```

Update the return value (line 163) to include topics:

```typescript
    return { ...rowToCollection(col), statuses: createdStatuses, topics: createdTopics };
```

**Step 4: Add collection topic CRUD routes**

Add before the `export default collections` line. Import `collectionTopicSchema` and `patchCollectionTopicSchema` from validation at the top.

```typescript
// POST /collections/:id/topics
collections.post('/:id/topics', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);
  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const raw = await c.req.json();
  const parsed = collectionTopicSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const [row] = await sql<CollectionTopicRow[]>`
    INSERT INTO collection_topics (collection_id, name, color, sort_order)
    VALUES (${id}, ${body.name}, ${body.color ?? null}, ${body.sortOrder ?? 0})
    RETURNING *
  `;
  return c.json(topicRowToTopic(row), 201);
});

// PATCH /collections/:id/topics/:topicId
collections.patch('/:id/topics/:topicId', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const topicId = c.req.param('topicId');
  if (!validateUuid(id) || !validateUuid(topicId))
    return c.json({ error: 'Invalid ID format' }, 400);
  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const raw = await c.req.json();
  const parsed = patchCollectionTopicSchema.safeParse(raw);
  if (!parsed.success)
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  const body = parsed.data;

  const updates = buildUpdates(body as Record<string, unknown>, {
    name: 'name',
    color: 'color',
    sortOrder: 'sort_order',
  });

  if (Object.keys(updates).length === 0) return c.json({ error: 'No valid fields' }, 400);

  const [row] = await sql<CollectionTopicRow[]>`
    UPDATE collection_topics SET ${sql(updates)}
    WHERE id = ${topicId} AND collection_id = ${id}
    RETURNING *
  `;
  if (!row) return c.json({ error: 'Topic not found' }, 404);
  return c.json(topicRowToTopic(row));
});

// DELETE /collections/:id/topics/:topicId
collections.delete('/:id/topics/:topicId', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const topicId = c.req.param('topicId');
  if (!validateUuid(id) || !validateUuid(topicId))
    return c.json({ error: 'Invalid ID format' }, 400);
  if (!(await verifyCollectionOwnership(id, userId)))
    return c.json({ error: 'Collection not found' }, 404);

  const [row] = await sql<CollectionTopicRow[]>`
    DELETE FROM collection_topics WHERE id = ${topicId} AND collection_id = ${id} RETURNING *
  `;
  if (!row) return c.json({ error: 'Topic not found' }, 404);
  return c.json({ deleted: true, id: topicId });
});
```

**Step 5: Update imports**

At the top of `server/routes/collections.ts`, add `collectionTopicSchema` and `patchCollectionTopicSchema` to the import from `../validation.js`.

**Step 6: Verify build**

Run: `npm run typecheck`
Expected: No type errors.

**Step 7: Commit**

```bash
git add server/routes/collections.ts
git commit -m "feat: batch-load collection topics, copy from template, add CRUD routes"
```

---

### Task 4: Server — batch-load topics in templates routes

**Files:**
- Modify: `server/routes/templates.ts`

**Step 1: Add `TemplateTopicRow` interface and helper**

Add after `TemplateTaskRow` interface (line 45):

```typescript
interface TemplateTopicRow {
  id: string;
  template_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

function topicRowToTopic(row: TemplateTopicRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
  };
}
```

**Step 2: Batch-load topics in `GET /templates`**

In the handler (lines 85-136), update the `Promise.all` at line 101 to include topics:

```typescript
  const [statusRows, taskRows, topicRows] = await Promise.all([
    sql<TemplateStatusRow[]>`
      SELECT * FROM template_statuses
      WHERE template_id = ANY(${templateIds})
      ORDER BY sort_order ASC
    `,
    sql<TemplateTaskRow[]>`
      SELECT * FROM template_tasks
      WHERE template_id = ANY(${templateIds})
      ORDER BY sort_order ASC
    `,
    sql<TemplateTopicRow[]>`
      SELECT * FROM template_topics
      WHERE template_id = ANY(${templateIds})
      ORDER BY sort_order ASC
    `,
  ]);
```

After the `tasksByTemplate` Map building, add:

```typescript
  const topicsByTemplate = new Map<string, ReturnType<typeof topicRowToTopic>[]>();
  for (const tr of topicRows) {
    const list = topicsByTemplate.get(tr.template_id) ?? [];
    list.push(topicRowToTopic(tr));
    topicsByTemplate.set(tr.template_id, list);
  }
```

Update the response mapping to include topics:

```typescript
    rows.map((row) => ({
      ...rowToTemplate(row),
      statuses: statusesByTemplate.get(row.id) ?? [],
      tasks: tasksByTemplate.get(row.id) ?? [],
      topics: topicsByTemplate.get(row.id) ?? [],
    })),
```

**Step 3: Do the same for `GET /templates/admin/all`**

Apply identical changes to the admin endpoint (lines 139-186): add topics to `Promise.all`, build `topicsByTemplate` map, include in response.

**Step 4: Insert topics in `POST /templates`**

In the transaction in the POST handler (lines 210-253), after the tasks insertion loop (after line 250), add:

```typescript
    const topics: ReturnType<typeof topicRowToTopic>[] = [];
    if (body.topics && body.topics.length > 0) {
      for (let i = 0; i < body.topics.length; i++) {
        const t = body.topics[i];
        const [tr] = await tx<TemplateTopicRow[]>`
          INSERT INTO template_topics (template_id, name, color, sort_order)
          VALUES (${row.id}, ${t.name}, ${t.color ?? null}, ${t.sortOrder ?? i})
          RETURNING *
        `;
        topics.push(topicRowToTopic(tr));
      }
    }
```

Update the return value (line 252) to include topics:

```typescript
    return { ...rowToTemplate(row), statuses, tasks, topics };
```

**Step 5: Verify build**

Run: `npm run typecheck`
Expected: No type errors.

**Step 6: Commit**

```bash
git add server/routes/templates.ts
git commit -m "feat: batch-load template topics in GET, insert in POST"
```

---

### Task 5: Frontend types and API client

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`

**Step 1: Add topic types to `types.ts`**

After `CollectionStatus` interface (line 55), add:

```typescript
export interface CollectionTopic {
  id: string;
  collectionId: string;
  name: string;
  color: string | null;
  sortOrder: number;
}
```

After `TemplateStatus` interface (line 63), add:

```typescript
export interface TemplateTopic {
  id: string;
  templateId: string;
  name: string;
  color: string | null;
  sortOrder: number;
}
```

Add `topics` field to `Collection` interface (after `statuses: CollectionStatus[];`):

```typescript
  topics: CollectionTopic[];
```

Add `topics` field to `CollectionTemplate` interface (after `tasks: TemplateTask[];`):

```typescript
  topics: TemplateTopic[];
```

Add `topics` to `CreateTemplateInput` interface (after `tasks?`):

```typescript
  topics?: { name: string; color?: string | null; sortOrder?: number }[];
```

**Step 2: Add topic API functions to `api.ts`**

Add imports for `CollectionTopic` at the top. After the `deleteCollectionStatus` function, add:

```typescript
// Collection Topics

export async function createCollectionTopic(
  collectionId: string,
  input: { name: string; color?: string | null; sortOrder?: number },
): Promise<CollectionTopic> {
  return request<CollectionTopic>(`/collections/${collectionId}/topics`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCollectionTopic(
  collectionId: string,
  topicId: string,
  updates: Partial<{ name: string; color: string | null; sortOrder: number }>,
): Promise<CollectionTopic> {
  return request<CollectionTopic>(`/collections/${collectionId}/topics/${topicId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteCollectionTopic(
  collectionId: string,
  topicId: string,
): Promise<void> {
  await request<unknown>(`/collections/${collectionId}/topics/${topicId}`, { method: 'DELETE' });
}
```

**Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add web/src/types.ts web/src/api.ts
git commit -m "feat: add collection/template topic types and API client functions"
```

---

### Task 6: CreateCollectionModal component

**Files:**
- Create: `web/src/components/CreateCollectionModal.tsx`

**Step 1: Create the component**

Reference `CollectionEditModal.tsx` for modal styling patterns (backdrop, animation classes, responsive rounding, `role="dialog"`, Escape key handling). Reference `CreateFromTemplate.tsx` for the template creation flow. Reference `TemplateCard.tsx` for template card rendering.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { X, ArrowLeft, Plus } from 'lucide-react';
import type { CollectionTemplate, Collection } from '../types';
import { COLOR_SWATCHES } from '../types';
import { getTemplates, createCollection, createCollectionFromTemplate } from '../api';
import TemplateCard from './TemplateCard';

interface CreateCollectionModalProps {
  onCreated: (collection: Collection) => void;
  onClose: () => void;
}

const ICON_OPTIONS = ['', '📚', '💻', '🎯', '🧠', '📝', '🔬', '🎨', '⚡', '🏆', '📊', '🔧'];

export default function CreateCollectionModal({ onCreated, onClose }: CreateCollectionModalProps) {
  const [step, setStep] = useState<'pick' | 'customize'>('pick');
  const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<CollectionTemplate | null>(null);

  // Customize form state
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState<string>(COLOR_SWATCHES[0]);
  const [srEnabled, setSrEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function handleSelectTemplate(template: CollectionTemplate) {
    setSelectedTemplate(template);
    setName(template.name);
    setIcon(template.icon ?? '');
    setColor(template.color ?? COLOR_SWATCHES[0]);
    setSrEnabled(template.srEnabled);
    setError(null);
    setStep('customize');
  }

  function handleSelectBlank() {
    setSelectedTemplate(null);
    setName('');
    setIcon('');
    setColor(COLOR_SWATCHES[0]);
    setSrEnabled(false);
    setError(null);
    setStep('customize');
  }

  function handleBack() {
    setStep('pick');
    setError(null);
  }

  async function handleCreate() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let col: Collection;
      if (selectedTemplate) {
        col = await createCollectionFromTemplate({
          templateId: selectedTemplate.id,
          name: name.trim(),
          color,
        });
      } else {
        col = await createCollection({
          name: name.trim(),
          icon: icon || undefined,
          color,
          srEnabled,
        });
      }
      onCreated(col);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setSubmitting(false);
    }
  }

  const systemTemplates = templates.filter((t) => t.isSystem);
  const userTemplates = templates.filter((t) => !t.isSystem);

  return (
    <div
      className="anim-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create collection"
        className="anim-modal-enter bg-zinc-900 border border-zinc-700 rounded-t-xl sm:rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {step === 'customize' && (
              <button
                onClick={handleBack}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-zinc-100">
              {step === 'pick' ? 'New collection' : selectedTemplate ? `From: ${selectedTemplate.name}` : 'New collection'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'pick' && (
          <div className="space-y-4">
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="bg-zinc-800/50 rounded-xl p-4 h-28 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {userTemplates.length > 0 && (
                  <div>
                    <h3 className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium mb-2">
                      My Templates
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {userTemplates.map((t) => (
                        <TemplateCard key={t.id} template={t} onClick={() => handleSelectTemplate(t)} />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium mb-2">
                    Templates
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {systemTemplates.map((t) => (
                      <TemplateCard key={t.id} template={t} onClick={() => handleSelectTemplate(t)} />
                    ))}
                    <button
                      onClick={handleSelectBlank}
                      className="border-2 border-dashed border-zinc-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-all cursor-pointer min-h-[120px]"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-sm font-medium">Blank</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'customize' && (
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Collection name"
                autoFocus
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Icon */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all ${
                      icon === ic
                        ? 'bg-zinc-700 ring-2 ring-zinc-500 ring-offset-1 ring-offset-zinc-900'
                        : 'bg-zinc-800 hover:bg-zinc-750 border border-zinc-700'
                    }`}
                  >
                    {ic || <span className="text-zinc-500 text-xs">-</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all duration-150 ${
                      color === c
                        ? 'ring-2 ring-zinc-400 ring-offset-2 ring-offset-zinc-900 scale-110'
                        : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* SR toggle */}
            {!selectedTemplate && (
              <label className="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={srEnabled}
                  onChange={(e) => setSrEnabled(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                Spaced repetition
              </label>
            )}

            {/* Template preview: statuses */}
            {selectedTemplate && selectedTemplate.statuses.length > 0 && (
              <div>
                <span className="block text-xs text-zinc-400 mb-1.5 font-medium">Statuses</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.statuses.map((status) => (
                    <span
                      key={status.id}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: status.color ? `${status.color}33` : 'rgba(113, 113, 122, 0.2)',
                        color: status.color ?? '#a1a1aa',
                      }}
                    >
                      {status.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Template preview: topics */}
            {selectedTemplate && selectedTemplate.topics && selectedTemplate.topics.length > 0 && (
              <div>
                <span className="block text-xs text-zinc-400 mb-1.5 font-medium">Topics</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.topics.map((topic) => (
                    <span
                      key={topic.id}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: topic.color ? `${topic.color}33` : 'rgba(113, 113, 122, 0.2)',
                        color: topic.color ?? '#a1a1aa',
                      }}
                    >
                      {topic.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Template preview: starter tasks count */}
            {selectedTemplate && selectedTemplate.tasks.length > 0 && (
              <p className="text-xs text-zinc-500">
                {selectedTemplate.tasks.length} starter {selectedTemplate.tasks.length === 1 ? 'task' : 'tasks'} included
              </p>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Footer */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={!name.trim() || submitting}
                className="bg-zinc-100 text-zinc-900 rounded-lg px-5 py-2 text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                Create
              </button>
              <button
                onClick={onClose}
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add web/src/components/CreateCollectionModal.tsx
git commit -m "feat: add CreateCollectionModal with two-step template selection flow"
```

---

### Task 7: Refactor CollectionSwitcher to use CreateCollectionModal

**Files:**
- Modify: `web/src/components/CollectionSwitcher.tsx`
- Modify: `web/src/App.tsx`

**Step 1: Update CollectionSwitcher**

1. Add import: `import CreateCollectionModal from './CreateCollectionModal';`
2. Remove `onBrowseTemplates` from the props interface and destructuring.
3. Remove these state variables: `creating`, `newName`, `newColor`, `newSrEnabled`, `submitting`, `nameInputRef`.
4. Remove `handleCreate` function.
5. Remove the `useEffect` for focusing `nameInputRef`.
6. Add new state: `const [showCreateModal, setShowCreateModal] = useState(false);`
7. In the `useClickOutside` callback, remove `setCreating(false)`.
8. Replace the entire `<div className="border-t border-zinc-800">` section (lines 152-241) — which contains the "Browse templates" button and the inline creation form — with:

```tsx
          <div className="border-t border-zinc-800">
            <button
              onClick={() => {
                setShowCreateModal(true);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors duration-150"
            >
              <Plus className="w-3 h-3" />
              New collection
            </button>
          </div>
```

9. After the `CollectionEditModal` render block (before closing `</div>`), add:

```tsx
      {showCreateModal && (
        <CreateCollectionModal
          onCreated={(col) => {
            onCollectionCreated(col);
            onChange(col.id);
            setShowCreateModal(false);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
```

**Step 2: Update App.tsx**

Remove `onBrowseTemplates` prop from the `<CollectionSwitcher>` usage (line 318):

```tsx
// Delete this line:
onBrowseTemplates={() => setView('templates')}
```

**Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add web/src/components/CollectionSwitcher.tsx web/src/App.tsx
git commit -m "refactor: replace inline collection form with CreateCollectionModal"
```

---

### Task 8: AddTask — use collection topics

**Files:**
- Modify: `web/src/components/AddTask.tsx`
- Modify: `web/src/App.tsx`

**Step 1: Update AddTask props**

Change the props interface to accept the full collection:

```typescript
import type { Topic, Tag, Collection } from '../types';
import { TOPICS, TOPIC_LABELS } from '../types';

interface AddTaskProps {
  onCreated: () => void;
  availableTags?: Tag[];
  onTagCreated?: (tag: Tag) => void;
  activeCollection?: Collection | null;
}
```

Update destructuring to use `activeCollection` instead of `activeCollectionId`.

**Step 2: Derive topic list from collection**

Inside the component, before the return, compute the topic options:

```typescript
  const collectionTopics = activeCollection?.topics ?? [];
  const useCollectionTopics = collectionTopics.length > 0;
  const topicOptions = useCollectionTopics
    ? collectionTopics.map((t) => ({ value: t.name, label: t.name, color: t.color }))
    : TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t], color: null }));
```

Initialize topic state to the first available option:

Change `const [topic, setTopic] = useState<Topic>('coding');` to:

```typescript
  const defaultTopic = activeCollection?.topics?.[0]?.name ?? 'coding';
  const [topic, setTopic] = useState<string>(defaultTopic);
```

**Step 3: Update the topic button rendering**

Replace the TOPICS mapping in the JSX (lines 77-91) with:

```tsx
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {topicOptions.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTopic(t.value)}
                className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 ${
                  topic === t.value
                    ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
```

**Step 4: Update the createTask call**

Change `collectionId: activeCollectionId ?? undefined` to:

```typescript
      collectionId: activeCollection?.id ?? undefined,
```

**Step 5: Update the `topic` type in createTask**

The `topic` field in `createTask` expects `Topic` type. Since we relaxed the validation to accept any string, update `CreateTaskInput` in `web/src/types.ts` — change `topic: Topic` to `topic: string`.

Also update the `createTask` function in `web/src/api.ts` if it has a type constraint on topic.

Check `server/routes/tasks.ts` — the `topicEnum` validation was already relaxed in Task 2 to `z.string().min(1).max(100)`, so the server accepts any topic string.

**Step 6: Update App.tsx to pass activeCollection**

Find the active collection from state and pass it:

In the AddTask render block (lines 575-585), change:

```tsx
  activeCollectionId={activeCollectionId}
```

to:

```tsx
  activeCollection={collections.find((c) => c.id === activeCollectionId) ?? null}
```

**Step 7: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors.

**Step 8: Commit**

```bash
git add web/src/components/AddTask.tsx web/src/App.tsx web/src/types.ts web/src/api.ts
git commit -m "feat: AddTask uses collection-specific topics when available"
```

---

### Task 9: CollectionEditModal — add topics section

**Files:**
- Modify: `web/src/components/CollectionEditModal.tsx`

**Step 1: Import topic API functions**

Add to the imports from `../api`:

```typescript
import {
  // ...existing imports...
  createCollectionTopic,
  updateCollectionTopic,
  deleteCollectionTopic,
} from '../api';
```

Add type import:

```typescript
import type { Collection, CollectionStatus, CollectionTopic } from '../types';
```

**Step 2: Add topics state**

After the `statuses` state (line 63), add:

```typescript
  const [topics, setTopics] = useState<CollectionTopic[]>(collection.topics ?? []);
  const [topicColorPicker, setTopicColorPicker] = useState<string | null>(null);
```

**Step 3: Add topic CRUD handlers**

After the `handleDeleteStatus` function, add:

```typescript
  async function handleAddTopic() {
    try {
      const created = await createCollectionTopic(collection.id, {
        name: 'New Topic',
        sortOrder: topics.length,
      });
      setTopics((prev) => [...prev, created]);
    } catch {
      // silently fail
    }
  }

  async function handleUpdateTopicName(topicId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const updated = await updateCollectionTopic(collection.id, topicId, { name: trimmed });
      setTopics((prev) => prev.map((t) => (t.id === topicId ? updated : t)));
    } catch {
      // silently fail
    }
  }

  async function handleUpdateTopicColor(topicId: string, newColor: string | null) {
    try {
      const updated = await updateCollectionTopic(collection.id, topicId, { color: newColor });
      setTopics((prev) => prev.map((t) => (t.id === topicId ? updated : t)));
      setTopicColorPicker(null);
    } catch {
      // silently fail
    }
  }

  async function handleDeleteTopic(topicId: string) {
    try {
      await deleteCollectionTopic(collection.id, topicId);
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
    } catch {
      // silently fail
    }
  }
```

**Step 4: Add topics UI section**

After the Custom Statuses `</div>` (line 305) and before the Footer, add:

```tsx
        {/* Topics */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-medium">
            Topics ({topics.length})
          </label>
          <div className="space-y-2">
            {topics.map((topic) => (
              <div key={topic.id} className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() =>
                      setTopicColorPicker(topicColorPicker === topic.id ? null : topic.id)
                    }
                    className="w-5 h-5 rounded-full border border-zinc-600 flex-shrink-0"
                    style={{ backgroundColor: topic.color ?? '#71717a' }}
                  />
                  {topicColorPicker === topic.id && (
                    <div className="absolute top-7 left-0 z-10 bg-zinc-800 border border-zinc-700 rounded-lg p-2 w-48">
                      <SwatchPicker
                        selected={topic.color}
                        onSelect={(c) => handleUpdateTopicColor(topic.id, c)}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  defaultValue={topic.name}
                  onBlur={(e) => handleUpdateTopicName(topic.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
                <button
                  onClick={() => handleDeleteTopic(topic.id)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleAddTopic}
            className="mt-2.5 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add topic
          </button>
        </div>
```

**Step 5: Include topics in the `onSaved` callback**

In `handleSave`, update the `updated` object to include topics:

```typescript
      const updated: Collection = {
        ...collection,
        name: name.trim(),
        icon: icon || undefined,
        color,
        srEnabled,
        statuses,
        topics,
      };
```

**Step 6: Verify build**

Run: `cd web && npx tsc --noEmit`
Expected: No type errors.

**Step 7: Commit**

```bash
git add web/src/components/CollectionEditModal.tsx
git commit -m "feat: add topics section to CollectionEditModal"
```

---

### Task 10: Verify full build and manual smoke test

**Step 1: Full typecheck**

Run: `npm run typecheck && cd web && npx tsc --noEmit`
Expected: No errors.

**Step 2: Full build**

Run: `npm run build`
Expected: Server and web build succeed.

**Step 3: Run linter**

Run: `npm run lint`
Expected: No new lint errors.

**Step 4: Manual smoke test checklist**

Start dev servers: `npm run dev:server` and `npm run dev:web`

1. Open CollectionSwitcher dropdown → "New collection" button visible (no inline form)
2. Click "New collection" → modal opens with template grid + "Blank" card
3. Click a template → step 2 shows name/icon/color/SR + status pills + topic pills
4. Click Back → returns to step 1 (no refetch)
5. Click "Blank" → step 2 shows empty form with SR toggle
6. Create a collection from template → navigates to new collection
7. Open AddTask in the new collection → topic buttons show template topics (not global 5)
8. Switch to "All collections" → AddTask shows global topics
9. Edit collection → Topics section visible, can add/rename/recolor/delete topics
10. Delete a topic → removed from list
11. Create a blank collection → AddTask shows global topics (no collection topics defined)

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify build passes for collection modal + topics feature"
```
