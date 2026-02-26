import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import sql from "../db/client.js";
import { calculateSM2 } from "../../src/spaced-repetition.js";
import { validateUuid, dateStr, topicEnum, uuidStr } from "../validation.js";
import type { Task, Note, Quality } from "../../src/types.js";

const tasks = new Hono();

// --- validation schemas ---

const createTaskSchema = z.object({
  topic: topicEnum,
  title: z.string().min(1).max(500),
  completed: z.boolean().optional(),
  deadline: dateStr.nullable().optional(),
  repetitions: z.number().int().min(0).max(1000).optional(),
  interval: z.number().int().min(1).max(365).optional(),
  easeFactor: z.number().min(1.3).max(5.0).optional(),
  nextReview: dateStr.optional(),
  lastReviewed: dateStr.nullable().optional(),
  createdAt: dateStr.optional(),
});

const patchTaskSchema = z.object({
  topic: topicEnum.optional(),
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  deadline: dateStr.nullable().optional(),
  repetitions: z.number().int().min(0).max(1000).optional(),
  interval: z.number().int().min(1).max(365).optional(),
  easeFactor: z.number().min(1.3).max(5.0).optional(),
  nextReview: dateStr.optional(),
  lastReviewed: dateStr.nullable().optional(),
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
  deadline: string | null;
  repetitions: number;
  interval: number;
  ease_factor: number;
  next_review: string;
  last_reviewed: string | null;
  created_at: string;
}

interface NoteRow {
  id: string;
  task_id: string;
  text: string;
  created_at: string;
}

function rowToTask(row: TaskRow, notes: Note[]): Task {
  return {
    id: row.id,
    topic: row.topic as Task["topic"],
    title: row.title,
    completed: row.completed,
    deadline: row.deadline ?? undefined,
    repetitions: row.repetitions,
    interval: row.interval,
    easeFactor: row.ease_factor,
    nextReview: row.next_review,
    lastReviewed: row.last_reviewed ?? undefined,
    createdAt: row.created_at,
    notes,
  };
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
  };
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// --- routes ---

// GET /tasks/due must be registered before /tasks/:id to avoid route collision
tasks.get("/due", async (c) => {
  const rows = await sql<TaskRow[]>`
    SELECT * FROM tasks
    WHERE next_review <= ${today()} AND completed = false
    ORDER BY next_review ASC
  `;

  const taskIds = rows.map((r) => r.id);
  const noteRows =
    taskIds.length > 0
      ? await sql<NoteRow[]>`SELECT * FROM notes WHERE task_id = ANY(${taskIds}) ORDER BY created_at ASC`
      : [];

  const notesByTask = new Map<string, Note[]>();
  for (const nr of noteRows) {
    const arr = notesByTask.get(nr.task_id) ?? [];
    arr.push(rowToNote(nr));
    notesByTask.set(nr.task_id, arr);
  }

  const result = rows.map((r) => rowToTask(r, notesByTask.get(r.id) ?? []));
  return c.json(result);
});

// GET /tasks
tasks.get("/", async (c) => {
  const rows = await sql<TaskRow[]>`SELECT * FROM tasks ORDER BY created_at DESC`;

  const noteRows = await sql<NoteRow[]>`SELECT * FROM notes ORDER BY created_at ASC`;

  const notesByTask = new Map<string, Note[]>();
  for (const nr of noteRows) {
    const arr = notesByTask.get(nr.task_id) ?? [];
    arr.push(rowToNote(nr));
    notesByTask.set(nr.task_id, arr);
  }

  const result = rows.map((r) => rowToTask(r, notesByTask.get(r.id) ?? []));
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
    INSERT INTO tasks (id, topic, title, completed, deadline, repetitions, interval, ease_factor, next_review, last_reviewed, created_at)
    VALUES (
      ${id},
      ${body.topic},
      ${body.title},
      ${body.completed ?? false},
      ${body.deadline ?? null},
      ${body.repetitions ?? 0},
      ${body.interval ?? 1},
      ${body.easeFactor ?? 2.5},
      ${body.nextReview ?? now},
      ${body.lastReviewed ?? null},
      ${body.createdAt ?? now}
    )
    RETURNING *
  `;

  return c.json(rowToTask(row, []), 201);
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
  const fieldMap: Record<string, string> = {
    topic: "topic",
    title: "title",
    completed: "completed",
    deadline: "deadline",
    repetitions: "repetitions",
    interval: "interval",
    easeFactor: "ease_factor",
    nextReview: "next_review",
    lastReviewed: "last_reviewed",
  };

  const updates: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in body) {
      updates[snake] = (body as Record<string, unknown>)[camel];
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  // postgres.js dynamic update
  const [row] = await sql<TaskRow[]>`
    UPDATE tasks SET ${sql(updates as Record<string, unknown>)}
    WHERE id = ${id}
    RETURNING *
  `;

  if (!row) {
    return c.json({ error: "Task not found" }, 404);
  }

  // Fetch notes for the task
  const noteRows = await sql<NoteRow[]>`SELECT * FROM notes WHERE task_id = ${id} ORDER BY created_at ASC`;
  const notes = noteRows.map(rowToNote);

  return c.json(rowToTask(row, notes));
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

  return c.json(rowToTask(updated, noteRows.map(rowToNote)));
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

  for (const t of incomingTasks) {
    await sql`
      INSERT INTO tasks (id, topic, title, completed, deadline, repetitions, interval, ease_factor, next_review, last_reviewed, created_at)
      VALUES (
        ${t.id},
        ${t.topic},
        ${t.title},
        ${t.completed},
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
        deadline = EXCLUDED.deadline,
        repetitions = EXCLUDED.repetitions,
        interval = EXCLUDED.interval,
        ease_factor = EXCLUDED.ease_factor,
        next_review = EXCLUDED.next_review,
        last_reviewed = EXCLUDED.last_reviewed
    `;

    // Sync notes
    if (t.notes && t.notes.length > 0) {
      for (const n of t.notes) {
        await sql`
          INSERT INTO notes (id, task_id, text, created_at)
          VALUES (${n.id}, ${t.id}, ${n.text}, ${n.createdAt})
          ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text
        `;
      }
    }

    upserted++;
  }

  return c.json({ upserted });
});

export default tasks;
