import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import sql from "../db/client.js";
import { calculateSM2 } from "../../src/spaced-repetition.js";
import { validateUuid, buildUpdates, dateStr, topicEnum, uuidStr, statusEnum, priorityEnum } from "../validation.js";
import type { Task, Note, Quality } from "../../src/types.js";

const tasks = new Hono();

// --- validation schemas ---

const createTaskSchema = z.object({
  topic: topicEnum,
  title: z.string().min(1).max(500),
  completed: z.boolean().optional(),
  status: statusEnum.optional(),
  deadline: dateStr.nullable().optional(),
  repetitions: z.number().int().min(0).max(1000).optional(),
  interval: z.number().int().min(1).max(365).optional(),
  easeFactor: z.number().min(1.3).max(5.0).optional(),
  nextReview: dateStr.optional(),
  lastReviewed: dateStr.nullable().optional(),
  createdAt: dateStr.optional(),
  collectionId: uuidStr.nullable().optional(),
  tagIds: z.array(uuidStr).optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: priorityEnum.optional(),
});

const patchTaskSchema = z.object({
  topic: topicEnum.optional(),
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  status: statusEnum.optional(),
  deadline: dateStr.nullable().optional(),
  repetitions: z.number().int().min(0).max(1000).optional(),
  interval: z.number().int().min(1).max(365).optional(),
  easeFactor: z.number().min(1.3).max(5.0).optional(),
  nextReview: dateStr.optional(),
  lastReviewed: dateStr.nullable().optional(),
  tagIds: z.array(uuidStr).optional(),
  collectionId: uuidStr.nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: priorityEnum.optional(),
});

const addNoteSchema = z.object({
  text: z.string().min(1).max(10000),
});

const reviewSchema = z.object({
  quality: z.number().int().min(0).max(5),
});

const syncTaskSchema = z.object({
  id: uuidStr,
  topic: topicEnum,
  title: z.string().min(1).max(500),
  completed: z.boolean(),
  status: statusEnum.optional(),
  deadline: z.string().nullable().optional(),
  repetitions: z.number().int().min(0),
  interval: z.number().int().min(1),
  easeFactor: z.number().min(1.3).max(5.0),
  nextReview: z.string(),
  lastReviewed: z.string().nullable().optional(),
  createdAt: z.string(),
  notes: z.array(z.object({
    id: z.string(),
    text: z.string().max(10000),
    createdAt: z.string(),
  })).optional(),
});

const syncSchema = z.array(syncTaskSchema).max(500);

// --- helpers ---

interface TaskRow {
  id: string;
  topic: string;
  title: string;
  completed: boolean;
  status: string;
  deadline: string | null;
  repetitions: number;
  interval: number;
  ease_factor: number;
  next_review: string;
  last_reviewed: string | null;
  created_at: string;
  collection_id: string | null;
  description: string | null;
  priority: string;
}

interface NoteRow {
  id: string;
  task_id: string;
  text: string;
  created_at: string;
}

interface TagRow {
  task_id: string;
  tag_id: string;
  name: string;
  color: string | null;
}

function rowToTask(
  row: TaskRow,
  notes: Note[],
  tags: { id: string; name: string; color: string | null }[] = []
): Task & { collectionId: string | null; description?: string; priority: string; tags: { id: string; name: string; color: string | null }[] } {
  return {
    id: row.id,
    topic: row.topic as Task["topic"],
    title: row.title,
    completed: row.completed,
    status: row.status as Task["status"],
    deadline: row.deadline ?? undefined,
    repetitions: row.repetitions,
    interval: row.interval,
    easeFactor: row.ease_factor,
    nextReview: row.next_review,
    lastReviewed: row.last_reviewed ?? undefined,
    createdAt: row.created_at,
    collectionId: row.collection_id,
    description: row.description ?? undefined,
    priority: row.priority,
    notes,
    tags,
  };
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
  };
}

function groupNotes(noteRows: NoteRow[]): Map<string, Note[]> {
  const notesByTask = new Map<string, Note[]>();
  for (const nr of noteRows) {
    const arr = notesByTask.get(nr.task_id) ?? [];
    arr.push(rowToNote(nr));
    notesByTask.set(nr.task_id, arr);
  }
  return notesByTask;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

async function fetchTagsByTaskIds(taskIds: string[]): Promise<Map<string, { id: string; name: string; color: string | null }[]>> {
  const tagsByTask = new Map<string, { id: string; name: string; color: string | null }[]>();
  if (taskIds.length === 0) return tagsByTask;

  const tagRows = await sql<TagRow[]>`
    SELECT tt.task_id, t.id AS tag_id, t.name, t.color
    FROM task_tags tt JOIN tags t ON t.id = tt.tag_id
    WHERE tt.task_id = ANY(${taskIds})
  `;

  for (const tr of tagRows) {
    const arr = tagsByTask.get(tr.task_id) ?? [];
    arr.push({ id: tr.tag_id, name: tr.name, color: tr.color });
    tagsByTask.set(tr.task_id, arr);
  }

  return tagsByTask;
}

// --- routes ---

// GET /tasks/due must be registered before /tasks/:id to avoid route collision
tasks.get("/due", async (c) => {
  const collectionId = c.req.query("collection");
  if (collectionId && !validateUuid(collectionId)) {
    return c.json({ error: "Invalid collection ID" }, 400);
  }

  const collectionFilter = collectionId
    ? sql`AND collection_id = ${collectionId}`
    : sql``;

  const rows = await sql<TaskRow[]>`
    SELECT * FROM tasks
    WHERE next_review <= ${today()} AND completed = false
    ${collectionFilter}
    ORDER BY next_review ASC
  `;

  const taskIds = rows.map((r) => r.id);
  const noteRows =
    taskIds.length > 0
      ? await sql<NoteRow[]>`SELECT * FROM notes WHERE task_id = ANY(${taskIds}) ORDER BY created_at ASC`
      : [];

  const notesByTask = groupNotes(noteRows);

  const tagsByTask = await fetchTagsByTaskIds(taskIds);

  const result = rows.map((r) =>
    rowToTask(r, notesByTask.get(r.id) ?? [], tagsByTask.get(r.id) ?? [])
  );
  return c.json(result);
});

// GET /tasks
tasks.get("/", async (c) => {
  const collectionId = c.req.query("collection");
  if (collectionId && !validateUuid(collectionId)) {
    return c.json({ error: "Invalid collection ID" }, 400);
  }

  const collectionFilter = collectionId
    ? sql`WHERE collection_id = ${collectionId}`
    : sql``;

  const rawRows = await sql<TaskRow[]>`SELECT * FROM tasks ${collectionFilter} ORDER BY created_at DESC`;

  const taskIds = rawRows.map((r) => r.id);
  const noteRows = taskIds.length > 0
    ? await sql<NoteRow[]>`SELECT * FROM notes WHERE task_id = ANY(${taskIds}) ORDER BY created_at ASC`
    : [];

  const notesByTask = groupNotes(noteRows);

  const tagsByTask = await fetchTagsByTaskIds(taskIds);

  // Tag filtering — keep tasks that have ALL specified tags
  const tagFilter = c.req.query("tags");
  let filteredRows: TaskRow[] = [...rawRows];
  if (tagFilter) {
    const filterTagIds = tagFilter.split(",").filter(validateUuid);
    if (filterTagIds.length > 0) {
      filteredRows = filteredRows.filter((r) => {
        const taskTags = tagsByTask.get(r.id) ?? [];
        return filterTagIds.every((tid) => taskTags.some((t) => t.id === tid));
      });
    }
  }

  const result = filteredRows.map((r) =>
    rowToTask(r, notesByTask.get(r.id) ?? [], tagsByTask.get(r.id) ?? [])
  );
  return c.json(result);
});

// POST /tasks
tasks.post("/", async (c) => {
  const raw = await c.req.json();
  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }
  const body = parsed.data;
  const id = uuidv4();
  const now = today();

  const [row] = await sql<TaskRow[]>`
    INSERT INTO tasks (id, topic, title, completed, status, deadline, repetitions, interval, ease_factor, next_review, last_reviewed, created_at, collection_id, description, priority)
    VALUES (
      ${id},
      ${body.topic},
      ${body.title},
      ${body.completed ?? false},
      ${body.status ?? "todo"},
      ${body.deadline ?? null},
      ${body.repetitions ?? 0},
      ${body.interval ?? 1},
      ${body.easeFactor ?? 2.5},
      ${body.nextReview ?? now},
      ${body.lastReviewed ?? null},
      ${body.createdAt ?? now},
      ${body.collectionId ?? null},
      ${body.description ?? null},
      ${body.priority ?? "none"}
    )
    RETURNING *
  `;

  // Insert initial tags if provided
  const tagIds = body.tagIds ?? [];
  if (tagIds.length > 0) {
    await sql`
      INSERT INTO task_tags (task_id, tag_id)
      SELECT ${id}, unnest(${tagIds}::uuid[])
      ON CONFLICT DO NOTHING
    `;
  }

  const tags = tagIds.length > 0
    ? await sql<{ id: string; name: string; color: string | null }[]>`
        SELECT t.id, t.name, t.color FROM tags t WHERE t.id = ANY(${tagIds})
      `
    : [];

  return c.json(rowToTask(row, [], tags), 201);
});

// PATCH /tasks/:id
tasks.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const raw = await c.req.json();
  const parsed = patchTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }
  const body = parsed.data;

  // Build dynamic SET clause from provided fields
  const updates = buildUpdates(body as Record<string, unknown>, {
    topic: "topic",
    title: "title",
    completed: "completed",
    status: "status",
    deadline: "deadline",
    repetitions: "repetitions",
    interval: "interval",
    easeFactor: "ease_factor",
    nextReview: "next_review",
    lastReviewed: "last_reviewed",
    collectionId: "collection_id",
    description: "description",
    priority: "priority",
  });

  // Keep completed and status in sync
  if ("status" in updates && !("completed" in updates)) {
    updates["completed"] = updates["status"] === "done";
  }
  if ("completed" in updates && !("status" in updates)) {
    updates["status"] = updates["completed"] ? "done" : "todo";
  }

  // Only run UPDATE if there are scalar fields to update
  let row: TaskRow | undefined;
  if (Object.keys(updates).length > 0) {
    const [updated] = await sql<TaskRow[]>`
      UPDATE tasks SET ${sql(updates as Record<string, unknown>)}
      WHERE id = ${id}
      RETURNING *
    `;
    if (!updated) {
      return c.json({ error: "Task not found" }, 404);
    }
    row = updated;
  } else {
    // No scalar updates — just verify task exists
    const [existing] = await sql<TaskRow[]>`SELECT * FROM tasks WHERE id = ${id}`;
    if (!existing) {
      return c.json({ error: "Task not found" }, 404);
    }
    row = existing;
  }

  // Handle tag replacement if tagIds provided
  if (Array.isArray(body.tagIds)) {
    const validTagIds = body.tagIds.filter(validateUuid);
    await sql`DELETE FROM task_tags WHERE task_id = ${id}`;
    if (validTagIds.length > 0) {
      await sql`
        INSERT INTO task_tags (task_id, tag_id)
        SELECT ${id}, unnest(${validTagIds}::uuid[])
        ON CONFLICT DO NOTHING
      `;
    }
  }

  // Fetch notes and tags for the task
  const noteRows = await sql<NoteRow[]>`SELECT * FROM notes WHERE task_id = ${id} ORDER BY created_at ASC`;
  const notes = noteRows.map(rowToNote);
  const tagsByTask = await fetchTagsByTaskIds([id]);

  return c.json(rowToTask(row, notes, tagsByTask.get(id) ?? []));
});

// DELETE /tasks/:id
tasks.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);

  const [row] = await sql<TaskRow[]>`DELETE FROM tasks WHERE id = ${id} RETURNING *`;

  if (!row) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ deleted: true, id });
});

// POST /tasks/:id/notes
tasks.post("/:id/notes", async (c) => {
  const taskId = c.req.param("id");
  if (!validateUuid(taskId)) return c.json({ error: "Invalid ID format" }, 400);
  const raw = await c.req.json();
  const parsed = addNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  // Verify task exists
  const [task] = await sql<TaskRow[]>`SELECT id FROM tasks WHERE id = ${taskId}`;
  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const now = today();

  const [row] = await sql<NoteRow[]>`
    INSERT INTO notes (task_id, text, created_at)
    VALUES (${taskId}, ${parsed.data.text}, ${now})
    RETURNING *
  `;

  return c.json(rowToNote(row), 201);
});

// POST /tasks/:id/review
tasks.post("/:id/review", async (c) => {
  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);
  const raw = await c.req.json();
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "quality must be an integer 0-5" }, 400);
  }
  const quality = parsed.data.quality as Quality;

  // Load current task
  const [taskRow] = await sql<TaskRow[]>`SELECT * FROM tasks WHERE id = ${id}`;
  if (!taskRow) {
    return c.json({ error: "Task not found" }, 404);
  }

  // Convert to Task shape for calculateSM2
  const noteRows = await sql<NoteRow[]>`SELECT * FROM notes WHERE task_id = ${id} ORDER BY created_at ASC`;
  const currentTask = rowToTask(taskRow, noteRows.map(rowToNote));

  const sm2 = calculateSM2(currentTask, quality);

  const [updated] = await sql<TaskRow[]>`
    UPDATE tasks SET
      repetitions = ${sm2.repetitions},
      interval = ${sm2.interval},
      ease_factor = ${sm2.easeFactor},
      next_review = ${sm2.nextReview},
      last_reviewed = ${today()}
    WHERE id = ${id}
    RETURNING *
  `;

  // Insert review event for streaks/heatmap tracking
  await sql`
    INSERT INTO review_events (task_id, collection_id, quality, reviewed_at)
    VALUES (${id}, ${taskRow.collection_id ?? null}, ${quality}, ${today()})
  `;

  const tagsByTask = await fetchTagsByTaskIds([id]);

  return c.json(rowToTask(updated, noteRows.map(rowToNote), tagsByTask.get(id) ?? []));
});

// POST /sync — bulk upsert from CLI
tasks.post("/sync", async (c) => {
  const raw = await c.req.json();
  const arr = Array.isArray(raw) ? raw : raw.tasks;
  const parsed = syncSchema.safeParse(arr);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }
  const incomingTasks = parsed.data;

  let upserted = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sql.begin(async (tx: any) => {
    for (const t of incomingTasks) {
      await tx`
        INSERT INTO tasks (id, topic, title, completed, status, deadline, repetitions, interval, ease_factor, next_review, last_reviewed, created_at)
        VALUES (
          ${t.id},
          ${t.topic},
          ${t.title},
          ${t.completed},
          ${t.status ?? "todo"},
          ${t.deadline ?? null},
          ${t.repetitions},
          ${t.interval},
          ${t.easeFactor},
          ${t.nextReview},
          ${t.lastReviewed ?? null},
          ${t.createdAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          topic = EXCLUDED.topic,
          title = EXCLUDED.title,
          completed = EXCLUDED.completed,
          status = EXCLUDED.status,
          deadline = EXCLUDED.deadline,
          repetitions = EXCLUDED.repetitions,
          interval = EXCLUDED.interval,
          ease_factor = EXCLUDED.ease_factor,
          next_review = EXCLUDED.next_review,
          last_reviewed = EXCLUDED.last_reviewed
      `;

      if (t.notes && t.notes.length > 0) {
        await Promise.all(t.notes.map((n) =>
          tx`
            INSERT INTO notes (id, task_id, text, created_at)
            VALUES (${n.id}, ${t.id}, ${n.text}, ${n.createdAt})
            ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text
          `
        ));
      }

      upserted++;
    }
  });

  return c.json({ upserted });
});

export default tasks;
