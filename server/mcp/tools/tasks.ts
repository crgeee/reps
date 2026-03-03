import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { v4 as uuidv4 } from 'uuid';
import sql from '../../db/client.js';
import { calculateSM2 } from '../../../src/spaced-repetition.js';
import type { Task, Note, Quality } from '../../../src/types.js';
import { logMcpAudit } from '../audit.js';

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

function toDateStr(val: string | Date | null | undefined): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return val.slice(0, 10);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    text: row.text,
    createdAt: toDateStr(row.created_at)!,
  };
}

function rowToTask(
  row: TaskRow,
  notes: Note[],
  tags: { id: string; name: string; color: string | null }[] = [],
) {
  return {
    id: row.id,
    topic: row.topic,
    title: row.title,
    completed: row.completed,
    status: row.status,
    deadline: toDateStr(row.deadline),
    repetitions: row.repetitions,
    interval: row.interval,
    easeFactor: row.ease_factor,
    nextReview: toDateStr(row.next_review)!,
    lastReviewed: toDateStr(row.last_reviewed),
    createdAt: toDateStr(row.created_at)!,
    collectionId: row.collection_id,
    description: row.description ?? undefined,
    priority: row.priority,
    notes,
    tags,
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

async function fetchTagsByTaskIds(
  taskIds: string[],
): Promise<Map<string, { id: string; name: string; color: string | null }[]>> {
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

// --- MCP tool helpers ---

function success(result: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}

function error(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_TOPICS = ['coding', 'system-design', 'behavioral', 'papers', 'custom'] as const;
const VALID_STATUSES = ['todo', 'in-progress', 'done'] as const;

// --- scope enforcement ---

function checkScope(scopes: string[], required: string) {
  if (!scopes.includes(required)) {
    return error(`MCP key missing required scope: ${required}`);
  }
  return null;
}

// --- tool registration ---

export function registerTaskTools(
  server: McpServer,
  userId: string,
  keyId: string,
  scopes: string[],
): void {
  // 1. get-tasks
  server.tool(
    'get-tasks',
    'List tasks with optional filters',
    {
      topic: z.enum(VALID_TOPICS).optional().describe('Filter by topic'),
      collectionId: z.string().regex(UUID_RE).optional().describe('Filter by collection ID'),
      dueOnly: z.boolean().optional().describe('Only return tasks due for review'),
      status: z.enum(VALID_STATUSES).optional().describe('Filter by status'),
    },
    async ({ topic, collectionId, dueOnly, status }) => {
      const denied = checkScope(scopes, 'read');
      if (denied) return denied;
      try {
        const filters = [sql`user_id = ${userId}`];

        if (topic) filters.push(sql`topic = ${topic}`);
        if (collectionId) filters.push(sql`collection_id = ${collectionId}`);
        if (dueOnly) filters.push(sql`next_review <= ${today()} AND completed = false`);
        if (status) filters.push(sql`status = ${status}`);

        const where = filters.reduce((acc, f, i) => (i === 0 ? f : sql`${acc} AND ${f}`));

        const rows = await sql<
          TaskRow[]
        >`SELECT * FROM tasks WHERE ${where} ORDER BY created_at DESC`;

        const taskIds = rows.map((r) => r.id);
        const noteRows =
          taskIds.length > 0
            ? await sql<
                NoteRow[]
              >`SELECT * FROM notes WHERE task_id = ANY(${taskIds}) ORDER BY created_at ASC`
            : [];

        const notesByTask = groupNotes(noteRows);
        const tagsByTask = await fetchTagsByTaskIds(taskIds);

        const result = rows.map((r) =>
          rowToTask(r, notesByTask.get(r.id) ?? [], tagsByTask.get(r.id) ?? []),
        );

        await logMcpAudit(keyId, userId, 'get-tasks', true);
        return success(result);
      } catch (err) {
        await logMcpAudit(keyId, userId, 'get-tasks', false, String(err));
        return error(`Failed to list tasks: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // 2. get-task
  server.tool(
    'get-task',
    'Get a single task by ID with notes and tags',
    {
      taskId: z.string().regex(UUID_RE).describe('Task UUID'),
    },
    async ({ taskId }) => {
      const denied = checkScope(scopes, 'read');
      if (denied) return denied;
      try {
        const [row] = await sql<
          TaskRow[]
        >`SELECT * FROM tasks WHERE id = ${taskId} AND user_id = ${userId}`;
        if (!row) return error('Task not found');

        const noteRows = await sql<
          NoteRow[]
        >`SELECT * FROM notes WHERE task_id = ${taskId} ORDER BY created_at ASC`;
        const tagsByTask = await fetchTagsByTaskIds([taskId]);

        await logMcpAudit(keyId, userId, 'get-task', true);
        return success(rowToTask(row, noteRows.map(rowToNote), tagsByTask.get(taskId) ?? []));
      } catch (err) {
        await logMcpAudit(keyId, userId, 'get-task', false, String(err));
        return error(`Failed to get task: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // 3. create-task
  server.tool(
    'create-task',
    'Create a new task',
    {
      topic: z.enum(VALID_TOPICS).describe('Task topic'),
      title: z.string().describe('Task title'),
      deadline: z.string().optional().describe('Deadline date (YYYY-MM-DD)'),
      description: z.string().optional().describe('Task description'),
      priority: z.enum(['none', 'low', 'medium', 'high']).optional().describe('Task priority'),
      collectionId: z.string().regex(UUID_RE).optional().describe('Collection UUID'),
    },
    async ({ topic, title, deadline, description, priority, collectionId }) => {
      const denied = checkScope(scopes, 'write');
      if (denied) return denied;
      try {
        const id = uuidv4();
        const now = today();

        const [row] = await sql<TaskRow[]>`
          INSERT INTO tasks (id, topic, title, completed, status, deadline, repetitions, interval, ease_factor, next_review, last_reviewed, created_at, collection_id, description, priority, user_id)
          VALUES (
            ${id},
            ${topic},
            ${title},
            false,
            'todo',
            ${deadline ?? null},
            0,
            1,
            2.5,
            ${now},
            ${null},
            ${now},
            ${collectionId ?? null},
            ${description ?? null},
            ${priority ?? 'none'},
            ${userId}
          )
          RETURNING *
        `;

        await logMcpAudit(keyId, userId, 'create-task', true);
        return success(rowToTask(row, []));
      } catch (err) {
        await logMcpAudit(keyId, userId, 'create-task', false, String(err));
        return error(`Failed to create task: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // 4. update-task
  server.tool(
    'update-task',
    'Update an existing task',
    {
      taskId: z.string().regex(UUID_RE).describe('Task UUID'),
      topic: z.enum(VALID_TOPICS).optional().describe('Task topic'),
      title: z.string().optional().describe('Task title'),
      completed: z.boolean().optional().describe('Completion status'),
      status: z.enum(VALID_STATUSES).optional().describe('Task status'),
      deadline: z.string().nullable().optional().describe('Deadline date (YYYY-MM-DD)'),
      description: z.string().nullable().optional().describe('Task description'),
      priority: z.enum(['none', 'low', 'medium', 'high']).optional().describe('Task priority'),
      collectionId: z.string().regex(UUID_RE).nullable().optional().describe('Collection UUID'),
    },
    async ({ taskId, ...fields }) => {
      const denied = checkScope(scopes, 'write');
      if (denied) return denied;
      try {
        const fieldMap: Record<string, string> = {
          topic: 'topic',
          title: 'title',
          completed: 'completed',
          status: 'status',
          deadline: 'deadline',
          description: 'description',
          priority: 'priority',
          collectionId: 'collection_id',
        };

        const updates: Record<string, unknown> = {};
        for (const [camel, snake] of Object.entries(fieldMap)) {
          if (camel in fields && fields[camel as keyof typeof fields] !== undefined) {
            updates[snake] = fields[camel as keyof typeof fields];
          }
        }

        // Keep completed and status in sync
        if ('status' in updates && !('completed' in updates)) {
          updates['completed'] = updates['status'] === 'done';
        }
        if ('completed' in updates && !('status' in updates)) {
          updates['status'] = updates['completed'] ? 'done' : 'todo';
        }

        if (Object.keys(updates).length === 0) {
          return error('No fields to update');
        }

        const [row] = await sql<TaskRow[]>`
          UPDATE tasks SET ${sql(updates)}
          WHERE id = ${taskId} AND user_id = ${userId}
          RETURNING *
        `;

        if (!row) return error('Task not found');

        const noteRows = await sql<
          NoteRow[]
        >`SELECT * FROM notes WHERE task_id = ${taskId} ORDER BY created_at ASC`;
        const tagsByTask = await fetchTagsByTaskIds([taskId]);

        await logMcpAudit(keyId, userId, 'update-task', true);
        return success(rowToTask(row, noteRows.map(rowToNote), tagsByTask.get(taskId) ?? []));
      } catch (err) {
        await logMcpAudit(keyId, userId, 'update-task', false, String(err));
        return error(`Failed to update task: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // 5. delete-task
  server.tool(
    'delete-task',
    'Delete a task by ID',
    {
      taskId: z.string().regex(UUID_RE).describe('Task UUID'),
    },
    async ({ taskId }) => {
      const denied = checkScope(scopes, 'write');
      if (denied) return denied;
      try {
        const [row] = await sql<
          TaskRow[]
        >`DELETE FROM tasks WHERE id = ${taskId} AND user_id = ${userId} RETURNING *`;
        if (!row) return error('Task not found');

        await logMcpAudit(keyId, userId, 'delete-task', true);
        return success({ deleted: true, id: taskId });
      } catch (err) {
        await logMcpAudit(keyId, userId, 'delete-task', false, String(err));
        return error(`Failed to delete task: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // 6. add-note
  server.tool(
    'add-note',
    'Add a note to a task',
    {
      taskId: z.string().regex(UUID_RE).describe('Task UUID'),
      text: z.string().describe('Note text'),
    },
    async ({ taskId, text }) => {
      const denied = checkScope(scopes, 'write');
      if (denied) return denied;
      try {
        // Verify task exists and belongs to user
        const [task] = await sql<
          TaskRow[]
        >`SELECT id FROM tasks WHERE id = ${taskId} AND user_id = ${userId}`;
        if (!task) return error('Task not found');

        const now = today();
        const [row] = await sql<NoteRow[]>`
          INSERT INTO notes (task_id, text, created_at)
          VALUES (${taskId}, ${text}, ${now})
          RETURNING *
        `;

        await logMcpAudit(keyId, userId, 'add-note', true);
        return success(rowToNote(row));
      } catch (err) {
        await logMcpAudit(keyId, userId, 'add-note', false, String(err));
        return error(`Failed to add note: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  // 7. submit-review
  server.tool(
    'submit-review',
    'Submit an SM-2 spaced repetition review for a task',
    {
      taskId: z.string().regex(UUID_RE).describe('Task UUID'),
      quality: z
        .number()
        .int()
        .min(0)
        .max(5)
        .describe('Review quality (0-5): 0=complete blackout, 5=perfect recall'),
    },
    async ({ taskId, quality }) => {
      const denied = checkScope(scopes, 'write');
      if (denied) return denied;
      try {
        const [taskRow] = await sql<
          TaskRow[]
        >`SELECT * FROM tasks WHERE id = ${taskId} AND user_id = ${userId}`;
        if (!taskRow) return error('Task not found');

        const noteRows = await sql<
          NoteRow[]
        >`SELECT * FROM notes WHERE task_id = ${taskId} ORDER BY created_at ASC`;
        const currentTask = rowToTask(taskRow, noteRows.map(rowToNote)) as unknown as Task;

        const sm2 = calculateSM2(currentTask, quality as Quality);

        const [updated] = await sql<TaskRow[]>`
          UPDATE tasks SET
            repetitions = ${sm2.repetitions},
            interval = ${sm2.interval},
            ease_factor = ${sm2.easeFactor},
            next_review = ${sm2.nextReview},
            last_reviewed = ${today()}
          WHERE id = ${taskId}
          RETURNING *
        `;

        // Insert review event for streaks/heatmap tracking
        await sql`
          INSERT INTO review_events (task_id, collection_id, quality, reviewed_at, user_id)
          VALUES (${taskId}, ${taskRow.collection_id ?? null}, ${quality}, ${today()}, ${userId})
        `;

        const tagsByTask = await fetchTagsByTaskIds([taskId]);

        await logMcpAudit(keyId, userId, 'submit-review', true);
        return success(rowToTask(updated, noteRows.map(rowToNote), tagsByTask.get(taskId) ?? []));
      } catch (err) {
        await logMcpAudit(keyId, userId, 'submit-review', false, String(err));
        return error(
          `Failed to submit review: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );
}
