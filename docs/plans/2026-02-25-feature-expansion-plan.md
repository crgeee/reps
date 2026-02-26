# Feature Expansion Implementation Plan — reps v2

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add collections, streaks/heatmap, focus timer, tags, daily digest email, calendar view, review stats, and mock interview mode to reps.

**Architecture:** Additive changes to existing Hono API + React SPA. New tables + columns in PostgreSQL. New routes mounted alongside existing ones. Shared server helpers (DRY). Reusable frontend components. No changes to existing CLI files.

**Tech Stack:** TypeScript, Hono, postgres.js, React, Tailwind CSS, Anthropic SDK, Resend, node-cron

---

## Agent Assignments

Each task below is tagged with its agent owner. Agents work on their own files only.

### Dependency Order
```
Task 1 (db-architect) → Task 2 (api-builder) → Tasks 3-6 run in parallel
                                                  ├── Task 3 (agent-builder)
                                                  ├── Task 4 (web-builder)
                                                  └── Task 5 (api-builder — stats)
Task 6 (agent-builder — mock AI) depends on Task 5
Task 7 (web-builder — mock UI) depends on Task 6
```

---

## Task 1: Schema Migration — `db-architect`

**Files:**
- Create: `db/002-feature-expansion.sql`
- Modify: `server/validation.ts` (add new zod schemas)

**Step 1: Create migration file `db/002-feature-expansion.sql`**

```sql
-- Collections
CREATE TABLE IF NOT EXISTS collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  sr_enabled  BOOLEAN DEFAULT true,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Add collection_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_collection ON tasks(collection_id);

-- Seed default collection and assign existing tasks
INSERT INTO collections (id, name, icon, sr_enabled, sort_order)
VALUES ('00000000-0000-0000-0000-000000000001', 'Interview Prep', NULL, true, 0)
ON CONFLICT (id) DO NOTHING;

UPDATE tasks SET collection_id = '00000000-0000-0000-0000-000000000001' WHERE collection_id IS NULL;

-- Review events (single source of truth for streaks + heatmap)
CREATE TABLE IF NOT EXISTS review_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  quality       INT NOT NULL CHECK (quality BETWEEN 0 AND 5),
  reviewed_at   DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_review_events_date ON review_events(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_review_events_collection ON review_events(collection_id);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE,
  color TEXT
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- Mock interview sessions
CREATE TABLE IF NOT EXISTS mock_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  topic         TEXT NOT NULL,
  difficulty    TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  messages      JSONB NOT NULL DEFAULT '[]',
  score         JSONB,
  started_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mock_sessions_collection ON mock_sessions(collection_id);
```

**Step 2: Run migration to verify it works**

Run: `npm run migrate`
Expected: "Running 002-feature-expansion.sql... Migrations completed successfully."

**Step 3: Add new validation schemas to `server/validation.ts`**

Add after existing exports:

```typescript
export const collectionSchema = z.object({
  name: z.string().min(1).max(200),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  srEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const patchCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  icon: z.string().max(10).nullable().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  srEnabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export const patchTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
});

export const mockStartSchema = z.object({
  topic: topicEnum.optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  collectionId: uuidStr.optional(),
});

export const mockRespondSchema = z.object({
  sessionId: uuidStr,
  answer: z.string().min(1).max(10000),
});

export const difficultyEnum = z.enum(["easy", "medium", "hard"]);
```

**Step 4: Commit**

```bash
git add db/002-feature-expansion.sql server/validation.ts
git commit -m "feat: add schema for collections, review_events, tags, mock_sessions"
```

---

## Task 2: Collection + Tag + Stats Routes — `api-builder`

**Files:**
- Create: `server/routes/collections.ts`
- Create: `server/routes/tags.ts`
- Create: `server/routes/stats.ts`
- Modify: `server/routes/tasks.ts` — add collection filtering, tag support, review_events INSERT
- Modify: `server/index.ts` — mount new routes

### Step 1: Create `server/routes/collections.ts`

```typescript
import { Hono } from "hono";
import sql from "../db/client.js";
import { validateUuid, collectionSchema, patchCollectionSchema } from "../validation.js";

const collections = new Hono();

interface CollectionRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sr_enabled: boolean;
  sort_order: number;
  created_at: string;
}

function rowToCollection(row: CollectionRow) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    srEnabled: row.sr_enabled,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// GET /collections
collections.get("/", async (c) => {
  const rows = await sql<CollectionRow[]>`
    SELECT * FROM collections ORDER BY sort_order ASC, created_at ASC
  `;
  return c.json(rows.map(rowToCollection));
});

// POST /collections
collections.post("/", async (c) => {
  const raw = await c.req.json();
  const parsed = collectionSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  const body = parsed.data;

  const [row] = await sql<CollectionRow[]>`
    INSERT INTO collections (name, icon, color, sr_enabled, sort_order)
    VALUES (${body.name}, ${body.icon ?? null}, ${body.color ?? null}, ${body.srEnabled ?? true}, ${body.sortOrder ?? 0})
    RETURNING *
  `;
  return c.json(rowToCollection(row), 201);
});

// PATCH /collections/:id
collections.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const raw = await c.req.json();
  const parsed = patchCollectionSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  const body = parsed.data;

  const fieldMap: Record<string, string> = {
    name: "name",
    icon: "icon",
    color: "color",
    srEnabled: "sr_enabled",
    sortOrder: "sort_order",
  };

  const updates: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in body) updates[snake] = (body as Record<string, unknown>)[camel];
  }

  if (Object.keys(updates).length === 0) return c.json({ error: "No valid fields" }, 400);

  const [row] = await sql<CollectionRow[]>`
    UPDATE collections SET ${sql(updates)} WHERE id = ${id} RETURNING *
  `;
  if (!row) return c.json({ error: "Collection not found" }, 404);
  return c.json(rowToCollection(row));
});

// DELETE /collections/:id
collections.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);

  const [row] = await sql<CollectionRow[]>`DELETE FROM collections WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ error: "Collection not found" }, 404);

  return c.json({ deleted: true, id });
});

export default collections;
```

### Step 2: Create `server/routes/tags.ts`

```typescript
import { Hono } from "hono";
import sql from "../db/client.js";
import { validateUuid, tagSchema, patchTagSchema } from "../validation.js";

const tags = new Hono();

interface TagRow { id: string; name: string; color: string | null; }

function rowToTag(row: TagRow) {
  return { id: row.id, name: row.name, color: row.color };
}

tags.get("/", async (c) => {
  const rows = await sql<TagRow[]>`SELECT * FROM tags ORDER BY name ASC`;
  return c.json(rows.map(rowToTag));
});

tags.post("/", async (c) => {
  const raw = await c.req.json();
  const parsed = tagSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);

  const [row] = await sql<TagRow[]>`
    INSERT INTO tags (name, color) VALUES (${parsed.data.name}, ${parsed.data.color ?? null}) RETURNING *
  `;
  return c.json(rowToTag(row), 201);
});

tags.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const raw = await c.req.json();
  const parsed = patchTagSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if (Object.keys(updates).length === 0) return c.json({ error: "No valid fields" }, 400);

  const [row] = await sql<TagRow[]>`UPDATE tags SET ${sql(updates)} WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ error: "Tag not found" }, 404);
  return c.json(rowToTag(row));
});

tags.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const [row] = await sql<TagRow[]>`DELETE FROM tags WHERE id = ${id} RETURNING *`;
  if (!row) return c.json({ error: "Tag not found" }, 404);
  return c.json({ deleted: true, id });
});

export default tags;
```

### Step 3: Create `server/routes/stats.ts`

```typescript
import { Hono } from "hono";
import sql from "../db/client.js";
import { validateUuid } from "../validation.js";

const stats = new Hono();

// GET /stats/overview?collection=uuid
stats.get("/overview", async (c) => {
  const collectionId = c.req.query("collection");
  if (collectionId && !validateUuid(collectionId)) {
    return c.json({ error: "Invalid collection ID" }, 400);
  }

  const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;

  // Single CTE query for all stats
  const [result] = await sql<[{
    total_reviews: string;
    reviews_last_30: string;
    reviews_by_topic: string;
    avg_ease_by_topic: string;
  }]>`
    WITH filtered_events AS (
      SELECT * FROM review_events WHERE 1=1 ${collectionFilter}
    ),
    filtered_tasks AS (
      SELECT * FROM tasks WHERE 1=1 ${collectionFilter}
    )
    SELECT
      (SELECT COUNT(*) FROM filtered_events)::text AS total_reviews,
      (SELECT COUNT(*) FROM filtered_events WHERE reviewed_at >= CURRENT_DATE - 30)::text AS reviews_last_30,
      (SELECT COALESCE(json_object_agg(t.topic, t.cnt), '{}')
       FROM (SELECT topic, COUNT(*)::int AS cnt FROM filtered_events fe
             JOIN tasks tk ON tk.id = fe.task_id
             GROUP BY topic) t
      )::text AS reviews_by_topic,
      (SELECT COALESCE(json_object_agg(topic, avg_ef), '{}')
       FROM (SELECT topic, ROUND(AVG(ease_factor)::numeric, 2)::float AS avg_ef
             FROM filtered_tasks WHERE completed = false
             GROUP BY topic) t
      )::text AS avg_ease_by_topic
  `;

  return c.json({
    totalReviews: parseInt(result.total_reviews, 10),
    reviewsLast30Days: parseInt(result.reviews_last_30, 10),
    reviewsByTopic: JSON.parse(result.reviews_by_topic),
    averageEaseByTopic: JSON.parse(result.avg_ease_by_topic),
  });
});

// GET /stats/heatmap?collection=uuid&days=365
stats.get("/heatmap", async (c) => {
  const collectionId = c.req.query("collection");
  const days = Math.min(parseInt(c.req.query("days") ?? "365", 10), 365);
  if (collectionId && !validateUuid(collectionId)) {
    return c.json({ error: "Invalid collection ID" }, 400);
  }

  const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;

  const rows = await sql<{ date: string; count: string }[]>`
    SELECT reviewed_at::text AS date, COUNT(*)::text AS count
    FROM review_events
    WHERE reviewed_at >= CURRENT_DATE - ${days}
    ${collectionFilter}
    GROUP BY reviewed_at
    ORDER BY reviewed_at
  `;

  const heatmap: Record<string, number> = {};
  for (const r of rows) heatmap[r.date] = parseInt(r.count, 10);
  return c.json(heatmap);
});

// GET /stats/streaks?collection=uuid
stats.get("/streaks", async (c) => {
  const collectionId = c.req.query("collection");
  if (collectionId && !validateUuid(collectionId)) {
    return c.json({ error: "Invalid collection ID" }, 400);
  }

  const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;

  // Get distinct review dates
  const rows = await sql<{ review_date: string }[]>`
    SELECT DISTINCT reviewed_at::text AS review_date
    FROM review_events
    WHERE 1=1 ${collectionFilter}
    ORDER BY review_date DESC
  `;

  if (rows.length === 0) {
    return c.json({ currentStreak: 0, longestStreak: 0, lastReviewDate: null });
  }

  const dates = rows.map((r) => r.review_date);
  const today = new Date().toISOString().split("T")[0]!;

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = new Date(today);

  // Allow today or yesterday as starting point
  if (dates[0] === today) {
    currentStreak = 1;
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dates[0] === yesterday.toISOString().split("T")[0]) {
      currentStreak = 1;
      checkDate = yesterday;
    }
  }

  if (currentStreak > 0) {
    const dateSet = new Set(dates);
    for (let i = 1; ; i++) {
      const prev = new Date(checkDate);
      prev.setDate(prev.getDate() - i);
      const prevStr = prev.toISOString().split("T")[0]!;
      if (dateSet.has(prevStr)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 1;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const curr = new Date(dates[i]!);
    const prev = new Date(dates[i - 1]!);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 1;
    }
  }

  return c.json({
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastReviewDate: dates[0],
  });
});

export default stats;
```

### Step 4: Modify `server/routes/tasks.ts` — add collection filter, tags, review_events

Add to the existing `POST /tasks/:id/review` handler, after the `UPDATE tasks SET...` query, add:

```typescript
// Insert review event for streaks/heatmap tracking
await sql`
  INSERT INTO review_events (task_id, collection_id, quality, reviewed_at)
  VALUES (${id}, ${taskRow.collection_id ?? null}, ${quality}, ${today()})
`;
```

Add collection filtering to `GET /tasks`:

```typescript
// At start of GET / handler:
const collectionId = c.req.query("collection");
if (collectionId && !validateUuid(collectionId)) return c.json({ error: "Invalid collection ID" }, 400);
const collectionFilter = collectionId
  ? sql`WHERE collection_id = ${collectionId}`
  : sql``;

// Replace the SELECT:
const rows = await sql<TaskRow[]>`SELECT * FROM tasks ${collectionFilter} ORDER BY created_at DESC`;
```

Same pattern for `GET /tasks/due` — add `AND collection_id = ${collectionId}` when present.

Add tag joining to task responses — after fetching tasks, also fetch their tags:

```typescript
// After fetching taskIds
const tagRows = taskIds.length > 0
  ? await sql<{ task_id: string; tag_id: string; name: string; color: string | null }[]>`
    SELECT tt.task_id, t.id AS tag_id, t.name, t.color
    FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
    WHERE tt.task_id = ANY(${taskIds})
  `
  : [];

const tagsByTask = new Map<string, { id: string; name: string; color: string | null }[]>();
for (const tr of tagRows) {
  const arr = tagsByTask.get(tr.task_id) ?? [];
  arr.push({ id: tr.tag_id, name: tr.name, color: tr.color });
  tagsByTask.set(tr.task_id, arr);
}
```

Include tags in task response and add `collectionId` field.

Add `tagIds` support to `PATCH /tasks/:id`:

```typescript
// After normal field updates, handle tagIds
if (Array.isArray(raw.tagIds)) {
  // Delete existing tags
  await sql`DELETE FROM task_tags WHERE task_id = ${id}`;
  // Insert new tags
  for (const tagId of raw.tagIds) {
    if (validateUuid(tagId)) {
      await sql`INSERT INTO task_tags (task_id, tag_id) VALUES (${id}, ${tagId}) ON CONFLICT DO NOTHING`;
    }
  }
}
```

Add `collection_id` to `POST /tasks` — accept `collectionId` in body, INSERT it.

Add tag filter to `GET /tasks?tags=uuid1,uuid2`:

```typescript
const tagFilter = c.req.query("tags");
if (tagFilter) {
  const tagIds = tagFilter.split(",").filter(validateUuid);
  if (tagIds.length > 0) {
    // Filter to tasks that have ALL specified tags
    rows = rows.filter(r => {
      const taskTags = tagsByTask.get(r.id) ?? [];
      return tagIds.every(tid => taskTags.some(t => t.id === tid));
    });
  }
}
```

### Step 5: Modify `server/index.ts` — mount new routes

```typescript
import collections from "./routes/collections.js";
import tags from "./routes/tags.js";
import statsRoutes from "./routes/stats.js";

// After existing route mounts:
app.route("/collections", collections);
app.route("/tags", tags);
app.route("/stats", statsRoutes);
```

### Step 6: Commit

```bash
git add server/routes/collections.ts server/routes/tags.ts server/routes/stats.ts server/routes/tasks.ts server/index.ts
git commit -m "feat: add collection, tag, and stats routes with collection filtering"
```

---

## Task 3: Shared Briefing Helper + Email + Mock AI — `agent-builder`

**Files:**
- Create: `server/agent/shared.ts`
- Create: `server/agent/email.ts`
- Create: `server/agent/mock.ts`
- Modify: `server/agent/coach.ts` — use shared helper
- Modify: `server/cron.ts` — add email cron

### Step 1: Create `server/agent/shared.ts`

```typescript
import sql from "../db/client.js";
import type { Task, Note } from "../../src/types.js";

interface TaskRow {
  id: string; topic: string; title: string; completed: boolean;
  deadline: string | null; repetitions: number; interval: number;
  ease_factor: number; next_review: string; last_reviewed: string | null;
  created_at: string; collection_id: string | null;
}

interface NoteRow { id: string; task_id: string; text: string; created_at: string; }

export interface BriefingData {
  dueToday: Task[];
  upcomingDeadlines: Task[];
  streak: { current: number; longest: number };
  weakestTopic: { topic: string; avgEase: number } | null;
}

function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

export async function getDailyBriefingData(collectionId?: string): Promise<BriefingData> {
  const todayStr = today();
  const deadlineCutoff = new Date();
  deadlineCutoff.setDate(deadlineCutoff.getDate() + 7);
  const deadlineStr = deadlineCutoff.toISOString().split("T")[0]!;
  const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;

  const dueTasks = await sql<TaskRow[]>`
    SELECT * FROM tasks
    WHERE next_review <= ${todayStr} AND completed = false ${collectionFilter}
    ORDER BY next_review ASC
  `;

  const upcomingDeadlines = await sql<TaskRow[]>`
    SELECT * FROM tasks
    WHERE deadline IS NOT NULL AND deadline <= ${deadlineStr} AND completed = false ${collectionFilter}
    ORDER BY deadline ASC
  `;

  // Streak (simplified — just current)
  const [streakRow] = await sql<[{ cnt: string }]>`
    WITH dates AS (
      SELECT DISTINCT reviewed_at FROM review_events WHERE 1=1 ${collectionFilter} ORDER BY reviewed_at DESC
    )
    SELECT COUNT(*)::text AS cnt FROM dates
  `;
  const streakCount = parseInt(streakRow?.cnt ?? "0", 10);

  // Weakest topic
  const weakest = await sql<{ topic: string; avg_ease: string }[]>`
    SELECT topic, ROUND(AVG(ease_factor)::numeric, 2)::text AS avg_ease
    FROM tasks WHERE completed = false ${collectionFilter}
    GROUP BY topic ORDER BY AVG(ease_factor) ASC LIMIT 1
  `;

  const mapTask = (row: TaskRow): Task => ({
    id: row.id, topic: row.topic as Task["topic"], title: row.title,
    completed: row.completed, deadline: row.deadline ?? undefined,
    repetitions: row.repetitions, interval: row.interval, easeFactor: row.ease_factor,
    nextReview: row.next_review, lastReviewed: row.last_reviewed ?? undefined,
    createdAt: row.created_at, notes: [],
  });

  return {
    dueToday: dueTasks.map(mapTask),
    upcomingDeadlines: upcomingDeadlines.map(mapTask),
    streak: { current: streakCount, longest: streakCount },
    weakestTopic: weakest[0] ? { topic: weakest[0].topic, avgEase: parseFloat(weakest[0].avg_ease) } : null,
  };
}
```

### Step 2: Refactor `server/agent/coach.ts` to use shared helper

Replace the inline query logic in `dailyBriefing()` with:

```typescript
import { getDailyBriefingData } from "./shared.js";

export async function dailyBriefing(): Promise<string> {
  const data = await getDailyBriefingData();

  const dueList = data.dueToday.length > 0
    ? data.dueToday.map((t) => `- [${t.topic}] ${t.title} (due: ${t.nextReview})`).join("\n")
    : "No reviews due today.";

  const deadlineList = data.upcomingDeadlines.length > 0
    ? data.upcomingDeadlines.map((t) => `- [${t.topic}] ${t.title} (deadline: ${t.deadline})`).join("\n")
    : "No upcoming deadlines.";

  // ... rest of the function stays the same, using dueList/deadlineList in the prompt
```

### Step 3: Create `server/agent/email.ts`

```typescript
import { Resend } from "resend";
import { getDailyBriefingData } from "./shared.js";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendDailyDigest(): Promise<void> {
  const client = getResend();
  const to = process.env.DIGEST_EMAIL_TO;
  if (!client || !to) {
    console.log("[email] Resend not configured, skipping daily digest");
    return;
  }

  const data = await getDailyBriefingData();

  const dueList = data.dueToday.length > 0
    ? data.dueToday.map((t) => `<li><strong>[${t.topic}]</strong> ${t.title}</li>`).join("")
    : "<li>No reviews due today!</li>";

  const streakText = data.streak.current > 0
    ? `You're on a ${data.streak.current}-day streak!`
    : "Start a new streak today!";

  const weakestText = data.weakestTopic
    ? `Your weakest area is <strong>${data.weakestTopic.topic}</strong> (avg ease: ${data.weakestTopic.avgEase}).`
    : "";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #18181b; color: #e4e4e7; padding: 32px; border-radius: 12px;">
      <h1 style="font-size: 24px; margin: 0 0 8px;">reps — daily digest</h1>
      <p style="color: #a1a1aa; margin: 0 0 24px;">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>

      <div style="background: #27272a; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 18px;">${streakText}</p>
      </div>

      <h2 style="font-size: 16px; color: #a1a1aa; margin: 0 0 8px;">Due for Review (${data.dueToday.length})</h2>
      <ul style="padding-left: 20px; margin: 0 0 16px;">${dueList}</ul>

      ${weakestText ? `<p style="color: #fbbf24; margin: 16px 0;">${weakestText}</p>` : ""}

      <p style="color: #71717a; font-size: 12px; margin-top: 24px;">Sent from reps — your interview prep tracker</p>
    </div>
  `;

  try {
    await client.emails.send({
      from: "reps <noreply@reps-prep.duckdns.org>",
      to,
      subject: `reps: ${data.dueToday.length} review${data.dueToday.length === 1 ? "" : "s"} due today`,
      html,
    });
    console.log("[email] Daily digest sent");
  } catch (err) {
    console.error("[email] Failed to send daily digest:", err);
  }
}
```

### Step 4: Create `server/agent/mock.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";
import sql from "../db/client.js";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-6";

interface MockSession {
  id: string;
  collectionId: string | null;
  topic: string;
  difficulty: string;
  messages: { role: "interviewer" | "candidate"; content: string }[];
  score: MockScore | null;
  startedAt: string;
  completedAt: string | null;
}

export interface MockScore {
  clarity: number;
  depth: number;
  correctness: number;
  communication: number;
  overall: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface SessionRow {
  id: string;
  collection_id: string | null;
  topic: string;
  difficulty: string;
  messages: string;
  score: string | null;
  started_at: string;
  completed_at: string | null;
}

function rowToSession(row: SessionRow): MockSession {
  return {
    id: row.id,
    collectionId: row.collection_id,
    topic: row.topic,
    difficulty: row.difficulty,
    messages: typeof row.messages === "string" ? JSON.parse(row.messages) : row.messages,
    score: row.score ? (typeof row.score === "string" ? JSON.parse(row.score) : row.score) : null,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

const TOPIC_PROMPTS: Record<string, string> = {
  coding: "Ask a specific coding problem with constraints. Frame it like an Anthropic engineer would — focus on algorithmic thinking, edge cases, and clean design.",
  "system-design": "Ask a system design question with specific scale requirements. Frame it like an Anthropic architect would — emphasize reliability, scalability, and trade-offs.",
  behavioral: "Ask a behavioral interview question in STAR format tied to Anthropic's AI safety values. Focus on leadership, impact, and ethical decision-making.",
  papers: "Ask a discussion question about a recent AI/ML paper relevant to Anthropic's mission. Focus on practical implications and safety considerations.",
  custom: "Ask a thoughtful technical interview question appropriate for a senior software engineer.",
};

const DIFFICULTY_MODIFIERS: Record<string, string> = {
  easy: "Keep it at a mid-level engineer level. Straightforward with clear constraints.",
  medium: "Target senior engineer level. Include nuance and require trade-off analysis.",
  hard: "Target staff+ engineer level. Require deep expertise, handle ambiguity, and explore edge cases.",
};

export async function startMockInterview(
  topic: string,
  difficulty: string,
  collectionId?: string,
): Promise<{ sessionId: string; question: string }> {
  const topicPrompt = TOPIC_PROMPTS[topic] ?? TOPIC_PROMPTS.custom!;
  const difficultyMod = DIFFICULTY_MODIFIERS[difficulty] ?? DIFFICULTY_MODIFIERS.medium!;

  let question: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: `You are a senior Anthropic interviewer conducting a mock technical interview. ${difficultyMod} Generate a single interview question only — no preamble, no "Here's a question for you", just the question itself.`,
      messages: [{ role: "user", content: topicPrompt }],
    });
    question = response.content[0]?.type === "text" ? response.content[0].text : "Tell me about a challenging technical problem you've solved recently.";
  } catch (err) {
    console.error("[mock] Failed to generate question:", err);
    question = "Tell me about a challenging technical problem you've solved recently.";
  }

  const messages = [{ role: "interviewer" as const, content: question }];

  const [row] = await sql<SessionRow[]>`
    INSERT INTO mock_sessions (collection_id, topic, difficulty, messages)
    VALUES (${collectionId ?? null}, ${topic}, ${difficulty}, ${JSON.stringify(messages)})
    RETURNING *
  `;

  await sql`INSERT INTO agent_logs (type, input, output) VALUES ('mock_question', ${topic}, ${question})`;

  return { sessionId: row.id, question };
}

export async function respondToMock(
  sessionId: string,
  answer: string,
): Promise<{ followUp?: string; evaluation?: MockScore }> {
  const [row] = await sql<SessionRow[]>`SELECT * FROM mock_sessions WHERE id = ${sessionId}`;
  if (!row) throw new Error("Session not found");

  const session = rowToSession(row);
  const messages = [...session.messages, { role: "candidate" as const, content: answer }];

  // Count candidate responses to decide if we should evaluate
  const candidateResponses = messages.filter((m) => m.role === "candidate").length;
  const shouldEvaluate = candidateResponses >= 3;

  if (shouldEvaluate) {
    // Final evaluation
    const conversationText = messages
      .map((m) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.content}`)
      .join("\n\n");

    let score: MockScore;
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: `You are a senior Anthropic interviewer. Evaluate this mock interview. Return JSON only with this exact schema:
{ "clarity": 1-5, "depth": 1-5, "correctness": 1-5, "communication": 1-5, "overall": 1-5, "feedback": "string", "strengths": ["string"], "improvements": ["string"] }`,
        messages: [{ role: "user", content: conversationText }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
      score = JSON.parse(text);
    } catch (err) {
      console.error("[mock] Evaluation failed:", err);
      score = {
        clarity: 3, depth: 3, correctness: 3, communication: 3, overall: 3,
        feedback: "Unable to generate detailed evaluation. Review your answers for completeness.",
        strengths: ["Completed the interview"], improvements: ["Try again for a detailed evaluation"],
      };
    }

    await sql`
      UPDATE mock_sessions
      SET messages = ${JSON.stringify(messages)}::jsonb, score = ${JSON.stringify(score)}::jsonb, completed_at = now()
      WHERE id = ${sessionId}
    `;

    await sql`INSERT INTO agent_logs (type, input, output) VALUES ('mock_evaluation', ${sessionId}, ${JSON.stringify(score)})`;

    return { evaluation: score };
  }

  // Follow-up question
  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.content}`)
    .join("\n\n");

  let followUp: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: "You are a senior Anthropic interviewer conducting a mock interview. Based on the candidate's response, ask a probing follow-up question that goes deeper. Just the question, no preamble.",
      messages: [{ role: "user", content: conversationText }],
    });
    followUp = response.content[0]?.type === "text" ? response.content[0].text : "Can you elaborate on that?";
  } catch (err) {
    console.error("[mock] Follow-up failed:", err);
    followUp = "Can you elaborate on your approach and discuss potential trade-offs?";
  }

  messages.push({ role: "interviewer", content: followUp });

  await sql`UPDATE mock_sessions SET messages = ${JSON.stringify(messages)}::jsonb WHERE id = ${sessionId}`;

  return { followUp };
}

export async function getInterleaveTopicForMock(collectionId?: string): Promise<string> {
  const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;

  // Pick the topic with lowest average ease factor that hasn't been practiced recently
  const [row] = await sql<{ topic: string }[]>`
    SELECT topic FROM tasks
    WHERE completed = false ${collectionFilter}
    GROUP BY topic
    ORDER BY AVG(ease_factor) ASC, MAX(last_reviewed) ASC NULLS FIRST
    LIMIT 1
  `;

  return row?.topic ?? "coding";
}

export async function getMockSession(sessionId: string): Promise<MockSession | null> {
  const [row] = await sql<SessionRow[]>`SELECT * FROM mock_sessions WHERE id = ${sessionId}`;
  return row ? rowToSession(row) : null;
}

export async function listMockSessions(collectionId?: string): Promise<MockSession[]> {
  const collectionFilter = collectionId ? sql`WHERE collection_id = ${collectionId}` : sql``;
  const rows = await sql<SessionRow[]>`
    SELECT * FROM mock_sessions ${collectionFilter} ORDER BY started_at DESC LIMIT 50
  `;
  return rows.map(rowToSession);
}
```

### Step 5: Update `server/cron.ts` — add email digest

```typescript
import { sendDailyDigest } from "./agent/email.js";

// Inside startCronJobs(), add after dailyBriefing schedule:
cron.schedule("0 8 * * *", async () => {
  console.log("[cron] Sending daily digest email...");
  try {
    await sendDailyDigest();
    console.log("[cron] Daily digest sent.");
  } catch (err) {
    console.error("[cron] Daily digest failed:", err);
  }
});
```

### Step 6: Add mock routes to `server/routes/agent.ts`

```typescript
import { startMockInterview, respondToMock, getMockSession, listMockSessions, getInterleaveTopicForMock } from "../agent/mock.js";
import { mockStartSchema, mockRespondSchema } from "../validation.js";

// POST /agent/mock/start
agent.post("/mock/start", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = mockStartSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);

    let topic = parsed.data.topic;
    if (!topic) {
      topic = await getInterleaveTopicForMock(parsed.data.collectionId) as any;
    }

    const result = await startMockInterview(
      topic!,
      parsed.data.difficulty ?? "medium",
      parsed.data.collectionId,
    );
    return c.json(result);
  } catch (err) {
    console.error("[agent/mock/start]", err);
    return c.json({ error: "Failed to start mock interview" }, 500);
  }
});

// POST /agent/mock/respond
agent.post("/mock/respond", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = mockRespondSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);

    const result = await respondToMock(parsed.data.sessionId, parsed.data.answer);
    return c.json(result);
  } catch (err) {
    console.error("[agent/mock/respond]", err);
    return c.json({ error: "Failed to process response" }, 500);
  }
});

// GET /agent/mock/:id
agent.get("/mock/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID" }, 400);
  const session = await getMockSession(id);
  if (!session) return c.json({ error: "Session not found" }, 404);
  return c.json(session);
});

// GET /agent/mock
agent.get("/mock", async (c) => {
  const collectionId = c.req.query("collection");
  const sessions = await listMockSessions(collectionId);
  return c.json(sessions);
});
```

### Step 7: Commit

```bash
git add server/agent/shared.ts server/agent/email.ts server/agent/mock.ts server/agent/coach.ts server/cron.ts server/routes/agent.ts
git commit -m "feat: add shared briefing helper, email digest, mock interview AI"
```

---

## Task 4: Frontend Types + API Client Updates — `web-builder`

**Files:**
- Modify: `web/src/types.ts` — add Collection, Tag, MockSession types
- Modify: `web/src/api.ts` — add new API calls

### Step 1: Update `web/src/types.ts`

Add after existing types:

```typescript
export interface Collection {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  srEnabled: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface MockMessage {
  role: 'interviewer' | 'candidate';
  content: string;
}

export interface MockScore {
  clarity: number;
  depth: number;
  correctness: number;
  communication: number;
  overall: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface MockSession {
  id: string;
  collectionId: string | null;
  topic: string;
  difficulty: string;
  messages: MockMessage[];
  score: MockScore | null;
  startedAt: string;
  completedAt: string | null;
}

export interface StatsOverview {
  totalReviews: number;
  reviewsLast30Days: number;
  reviewsByTopic: Record<string, number>;
  averageEaseByTopic: Record<string, number>;
}

export interface Streaks {
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
}
```

Also update the `Task` interface to include:

```typescript
export interface Task {
  // ... existing fields ...
  collectionId?: string;
  tags?: Tag[];
}
```

### Step 2: Update `web/src/api.ts`

Add new API calls:

```typescript
import type { Collection, Tag, MockSession, MockScore, StatsOverview, Streaks } from './types';

// Collections
export async function getCollections(): Promise<Collection[]> {
  return request<Collection[]>('/collections');
}

export async function createCollection(input: { name: string; icon?: string; color?: string; srEnabled?: boolean }): Promise<Collection> {
  return request<Collection>('/collections', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateCollection(id: string, updates: Partial<Collection>): Promise<Collection> {
  return request<Collection>(`/collections/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export async function deleteCollection(id: string): Promise<void> {
  await request<unknown>(`/collections/${id}`, { method: 'DELETE' });
}

// Tags
export async function getTags(): Promise<Tag[]> {
  return request<Tag[]>('/tags');
}

export async function createTag(input: { name: string; color?: string }): Promise<Tag> {
  return request<Tag>('/tags', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateTag(id: string, updates: Partial<Tag>): Promise<Tag> {
  return request<Tag>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export async function deleteTag(id: string): Promise<void> {
  await request<unknown>(`/tags/${id}`, { method: 'DELETE' });
}

// Stats
export async function getStatsOverview(collectionId?: string): Promise<StatsOverview> {
  const q = collectionId ? `?collection=${collectionId}` : '';
  return request<StatsOverview>(`/stats/overview${q}`);
}

export async function getHeatmap(collectionId?: string, days = 365): Promise<Record<string, number>> {
  const params = new URLSearchParams();
  if (collectionId) params.set('collection', collectionId);
  params.set('days', String(days));
  return request<Record<string, number>>(`/stats/heatmap?${params}`);
}

export async function getStreaks(collectionId?: string): Promise<Streaks> {
  const q = collectionId ? `?collection=${collectionId}` : '';
  return request<Streaks>(`/stats/streaks${q}`);
}

// Mock Interview
export async function startMockInterview(input: { topic?: string; difficulty?: string; collectionId?: string }): Promise<{ sessionId: string; question: string }> {
  return request<{ sessionId: string; question: string }>('/agent/mock/start', {
    method: 'POST', body: JSON.stringify(input),
  });
}

export async function respondToMock(sessionId: string, answer: string): Promise<{ followUp?: string; evaluation?: MockScore }> {
  return request<{ followUp?: string; evaluation?: MockScore }>('/agent/mock/respond', {
    method: 'POST', body: JSON.stringify({ sessionId, answer }),
  });
}

export async function getMockSessions(collectionId?: string): Promise<MockSession[]> {
  const q = collectionId ? `?collection=${collectionId}` : '';
  return request<MockSession[]>(`/agent/mock${q}`);
}

// Collection-scoped task fetches
export async function getTasksByCollection(collectionId: string): Promise<Task[]> {
  return request<Task[]>(`/tasks?collection=${collectionId}`);
}

export async function getDueTasksByCollection(collectionId: string): Promise<Task[]> {
  return request<Task[]>(`/tasks/due?collection=${collectionId}`);
}
```

### Step 3: Commit

```bash
git add web/src/types.ts web/src/api.ts
git commit -m "feat: add frontend types and API client for collections, tags, stats, mock"
```

---

## Task 5: Frontend — Reusable Components — `web-builder`

**Files:**
- Create: `web/src/components/Heatmap.tsx`
- Create: `web/src/components/StreakBadge.tsx`
- Create: `web/src/components/FocusTimer.tsx`
- Create: `web/src/components/TagPicker.tsx`
- Create: `web/src/components/TagBadge.tsx`
- Create: `web/src/components/BarChart.tsx`
- Create: `web/src/components/CalendarView.tsx`
- Create: `web/src/components/CollectionSwitcher.tsx`
- Create: `web/src/components/ScoreCard.tsx` (extract from ReviewSession)

Each component should be:
- Self-contained, no internal data fetching (pure/presentational)
- Accept props with TypeScript interfaces
- Tailwind CSS only
- Memoized where it matters (`useMemo` for expensive computations)

Key implementation notes for each:

**`Heatmap`**: CSS grid, 53 columns (weeks) x 7 rows (days). Color scale: zinc-800 (0) → green shades (1-max). Tooltip on hover with date + count.

**`StreakBadge`**: Simple stat display — flame icon + current streak number + "longest: N" subtitle.

**`FocusTimer`**: `useState` for remaining time, `useRef` for interval. Drift correction: store `startTime` and compute remaining from `Date.now()`. Circular SVG progress ring. Audio beep via `AudioContext` on complete. Configurable duration buttons.

**`TagPicker`**: Dropdown with color dots. Search/filter input. "Create new" option at bottom. Used in AddTask and TaskList.

**`TagBadge`**: Inline pill with color dot and name. Small variant for lists, regular for detail views.

**`BarChart`**: Horizontal bars. Accepts `Record<string, number>`. Color per bar. Animated width transition.

**`CalendarView`**: Month grid. Navigation arrows. Dots for tasks on each date. Red highlight for overdue. Click handler per date. `useMemo` for date grouping.

**`CollectionSwitcher`**: Dropdown in header. Shows collection name + color dot. "Manage collections" link. onChange propagates to App state.

**`ScoreCard`**: Extract existing `ScoreCard` from ReviewSession.tsx into shared component (used by ReviewSession and MockInterview).

### Commit after all components

```bash
git add web/src/components/
git commit -m "feat: add reusable UI components — heatmap, timer, tags, calendar, charts"
```

---

## Task 6: Frontend — New Views + Updated Views — `web-builder`

**Files:**
- Create: `web/src/components/MockInterview.tsx`
- Modify: `web/src/components/Dashboard.tsx` — add streak, heatmap, collection scope
- Modify: `web/src/components/TopicProgress.tsx` — add stats, heatmap, bar chart
- Modify: `web/src/components/AddTask.tsx` — add tag picker, collection
- Modify: `web/src/components/TaskList.tsx` — add tag badges, tag filter
- Modify: `web/src/components/ReviewSession.tsx` — add focus timer, extract ScoreCard
- Modify: `web/src/App.tsx` — add collection state, new nav items, new views

### `MockInterview.tsx` key structure:

```
States: idle → questioning → answering → followUp (repeat) → evaluation → done

idle: Topic picker + difficulty selector + "Surprise me" button
questioning: Shows interviewer question + FocusTimer
answering: Textarea + submit
followUp: Shows follow-up question, back to answering
evaluation: Score radar + feedback + strengths/improvements
done: History of past sessions
```

### `App.tsx` updates:

- Add `collections` state, `activeCollectionId` state
- Fetch collections on mount
- Pass `activeCollectionId` to all views
- Add 'mock' and 'calendar' to `View` type
- Add `CollectionSwitcher` to header
- New nav items: Calendar, Mock Interview

### Commits after each view update

```bash
git add web/src/components/MockInterview.tsx
git commit -m "feat: add mock interview view with multi-turn AI simulation"

git add web/src/components/Dashboard.tsx web/src/components/TopicProgress.tsx
git commit -m "feat: enhance dashboard and progress with streaks, heatmap, stats"

git add web/src/components/AddTask.tsx web/src/components/TaskList.tsx web/src/components/ReviewSession.tsx
git commit -m "feat: add tags, focus timer, collection support to existing views"

git add web/src/App.tsx
git commit -m "feat: add collection switcher, calendar and mock nav to App"
```

---

## Task 7: Integration Testing — all agents

**Step 1: Verify migration**

Run: `npm run migrate`
Expected: Both SQL files execute successfully.

**Step 2: Verify server starts**

Run: `npm run dev:server`
Expected: "reps server listening on port 3000" + cron schedule log.

**Step 3: Test new endpoints**

```bash
# Collections
curl -s -H "Authorization: Bearer $API_KEY" http://localhost:3000/collections | jq
curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Work","srEnabled":false}' http://localhost:3000/collections | jq

# Tags
curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"graphs","color":"#3b82f6"}' http://localhost:3000/tags | jq

# Stats
curl -s -H "Authorization: Bearer $API_KEY" http://localhost:3000/stats/overview | jq
curl -s -H "Authorization: Bearer $API_KEY" http://localhost:3000/stats/heatmap | jq
curl -s -H "Authorization: Bearer $API_KEY" http://localhost:3000/stats/streaks | jq

# Mock (requires ANTHROPIC_API_KEY)
curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"topic":"coding","difficulty":"medium"}' http://localhost:3000/agent/mock/start | jq
```

**Step 4: Verify frontend builds**

Run: `cd web && npx vite build`
Expected: Build succeeds with no TypeScript errors.

**Step 5: Typecheck**

Run: `npm run typecheck`
Expected: No errors.

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: reps v2 — collections, streaks, tags, timer, calendar, mock interviews, email digest"
```

---

## Summary of All New Files

```
db/002-feature-expansion.sql          # Task 1
server/routes/collections.ts          # Task 2
server/routes/tags.ts                 # Task 2
server/routes/stats.ts                # Task 2
server/agent/shared.ts                # Task 3
server/agent/email.ts                 # Task 3
server/agent/mock.ts                  # Task 3
web/src/components/Heatmap.tsx        # Task 5
web/src/components/StreakBadge.tsx     # Task 5
web/src/components/FocusTimer.tsx     # Task 5
web/src/components/TagPicker.tsx      # Task 5
web/src/components/TagBadge.tsx       # Task 5
web/src/components/BarChart.tsx       # Task 5
web/src/components/CalendarView.tsx   # Task 5
web/src/components/CollectionSwitcher.tsx  # Task 5
web/src/components/ScoreCard.tsx      # Task 5
web/src/components/MockInterview.tsx  # Task 6
```

## Modified Files

```
server/validation.ts                  # Task 1
server/routes/tasks.ts                # Task 2
server/index.ts                       # Task 2
server/routes/agent.ts                # Task 3
server/agent/coach.ts                 # Task 3
server/cron.ts                        # Task 3
web/src/types.ts                      # Task 4
web/src/api.ts                        # Task 4
web/src/components/Dashboard.tsx      # Task 6
web/src/components/TopicProgress.tsx  # Task 6
web/src/components/AddTask.tsx        # Task 6
web/src/components/TaskList.tsx       # Task 6
web/src/components/ReviewSession.tsx  # Task 6
web/src/App.tsx                       # Task 6
```
