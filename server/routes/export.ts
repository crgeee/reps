import { Hono } from 'hono';
import { randomBytes } from 'node:crypto';
import sql from '../db/client.js';
import { validateUuid } from '../validation.js';

// --- iCal helpers ---

function formatIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

interface TaskRow {
  id: string;
  topic: string;
  title: string;
  completed: boolean;
  next_review: string;
  ease_factor: number;
  repetitions: number;
  deadline: string | null;
}

interface NoteRow {
  task_id: string;
  text: string;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function generateVEvent(task: TaskRow): string {
  const dtstart = formatIcsDate(task.next_review);
  const description = `Topic: ${task.topic} | EF: ${task.ease_factor.toFixed(1)} | Reps: ${task.repetitions}`;
  return [
    'BEGIN:VEVENT',
    `UID:${task.id}@reps`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `SUMMARY:${escapeIcsText(task.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Review: ${escapeIcsText(task.title)}`,
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n');
}

function generateCalendar(tasks: TaskRow[]): string {
  const events = tasks.map(generateVEvent).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//reps//interview-prep//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:reps — Review Schedule',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

// --- Public routes (no auth — token-based) ---

export const calendarFeed = new Hono();

const TOKEN_RE = /^[0-9a-f]{64}$/;

calendarFeed.get('/calendar/:filename', async (c) => {
  const filename = c.req.param('filename');
  if (!filename.endsWith('.ics')) {
    return c.text('Not found', 404);
  }
  const token = filename.slice(0, -4);
  if (!TOKEN_RE.test(token)) {
    return c.text('Invalid token', 400);
  }

  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM calendar_tokens WHERE token = ${token}
  `;
  if (!row) {
    return c.text('Invalid token', 401);
  }

  const tasks = await sql<TaskRow[]>`
    SELECT id, topic, title, completed, next_review, ease_factor, repetitions, deadline
    FROM tasks
    WHERE completed = false
    ORDER BY next_review ASC
  `;

  const ics = generateCalendar(tasks);
  return c.body(ics, 200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="reps.ics"',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
});

// --- Authed routes ---

export const exportRoutes = new Hono();

// GET /export/tasks/:id/event.ics — single task download
exportRoutes.get('/tasks/:id/event.ics', async (c) => {
  const id = c.req.param('id').replace(/\.ics$/, '');
  if (!validateUuid(id)) return c.text('Invalid ID', 400);

  const [task] = await sql<TaskRow[]>`
    SELECT id, topic, title, completed, next_review, ease_factor, repetitions, deadline
    FROM tasks WHERE id = ${id}
  `;
  if (!task) return c.text('Task not found', 404);

  const ics = generateCalendar([task]);
  return c.body(ics, 200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="reps-${id.slice(0, 8)}.ics"`,
  });
});

// GET /export/tasks.md — markdown export of all tasks
exportRoutes.get('/tasks.md', async (c) => {
  const tasks = await sql<TaskRow[]>`
    SELECT id, topic, title, completed, next_review, ease_factor, repetitions, deadline
    FROM tasks ORDER BY topic, created_at DESC
  `;

  const taskIds = tasks.map((t) => t.id);
  const noteRows =
    taskIds.length > 0
      ? await sql<NoteRow[]>`
        SELECT task_id, text FROM notes
        WHERE task_id = ANY(${taskIds})
        ORDER BY created_at ASC
      `
      : [];

  const notesByTask = new Map<string, string[]>();
  for (const n of noteRows) {
    const arr = notesByTask.get(n.task_id) ?? [];
    arr.push(n.text);
    notesByTask.set(n.task_id, arr);
  }

  const byTopic = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const arr = byTopic.get(t.topic) ?? [];
    arr.push(t);
    byTopic.set(t.topic, arr);
  }

  const lines: string[] = [
    `# reps — Export`,
    ``,
    `*Generated ${new Date().toISOString().split('T')[0]}*`,
    ``,
  ];

  for (const [topic, topicTasks] of byTopic) {
    lines.push(`## ${topic}`);
    lines.push('');
    for (const t of topicTasks) {
      const status = t.completed ? 'x' : ' ';
      lines.push(`- [${status}] **${t.title}**`);
      lines.push(
        `  - Next review: ${t.next_review} | EF: ${t.ease_factor.toFixed(1)} | Reps: ${t.repetitions}`,
      );
      if (t.deadline) lines.push(`  - Deadline: ${t.deadline}`);
      const notes = notesByTask.get(t.id);
      if (notes && notes.length > 0) {
        for (const note of notes) {
          lines.push(`  - ${note.replace(/\n/g, ' ')}`);
        }
      }
    }
    lines.push('');
  }

  const md = lines.join('\n');
  return c.body(md, 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="reps-export-${new Date().toISOString().split('T')[0]}.md"`,
  });
});

// POST /export/calendar/token — generate new subscription token
exportRoutes.post('/calendar/token', async (c) => {
  const token = randomBytes(32).toString('hex');

  // Delete any existing tokens (single-user app, one token at a time)
  await sql`DELETE FROM calendar_tokens`;

  await sql`
    INSERT INTO calendar_tokens (token) VALUES (${token})
  `;

  const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? 'localhost:3000';
  const url = `webcal://${host}/export/calendar/${token}.ics`;

  return c.json({ token, url });
});

// GET /export/calendar/token — get current token
exportRoutes.get('/calendar/token', async (c) => {
  const [row] = await sql<{ token: string }[]>`
    SELECT token FROM calendar_tokens ORDER BY created_at DESC LIMIT 1
  `;

  if (!row) {
    return c.json({ token: null });
  }

  const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? 'localhost:3000';
  const url = `webcal://${host}/export/calendar/${row.token}.ics`;

  return c.json({ token: row.token, url });
});
