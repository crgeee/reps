import { Hono } from 'hono';
import { z } from 'zod';
import sql from '../db/client.js';
import { evaluateAnswer } from '../agent/evaluator.js';
import { generateQuestion } from '../agent/questions.js';
import { summarizePaper } from '../agent/papers.js';
import { dailyBriefing } from '../agent/coach.js';
import {
  startMockInterview,
  respondToMock,
  getMockSession,
  listMockSessions,
  getInterleaveTopicForMock,
} from '../agent/mock.js';
import { validateUuid, uuidStr, mockStartSchema, mockRespondSchema } from '../validation.js';
import type { Task, Note } from '../../src/types.js';

type AppEnv = { Variables: { userId: string } };
const agent = new Hono<AppEnv>();

const evaluateSchema = z.object({
  taskId: uuidStr,
  answer: z.string().min(1).max(10000),
});

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
    topic: row.topic as Task['topic'],
    title: row.title,
    completed: row.completed,
    status: row.status as Task['status'],
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

// --- routes ---

agent.post('/evaluate', async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = evaluateSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const result = await evaluateAnswer(parsed.data.taskId, parsed.data.answer);
    return c.json(result);
  } catch (err) {
    console.error('[agent/evaluate]', err);
    return c.json({ error: 'Evaluation failed' }, 500);
  }
});

agent.get('/question/:taskId', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    if (!validateUuid(taskId)) return c.json({ error: 'Invalid ID format' }, 400);

    const userId = c.get('userId') as string;
    const userWhere = userId ? sql`AND user_id = ${userId}` : sql``;
    const [taskRow] = await sql<TaskRow[]>`SELECT * FROM tasks WHERE id = ${taskId} ${userWhere}`;
    if (!taskRow) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const noteRows = await sql<NoteRow[]>`
      SELECT * FROM notes WHERE task_id = ${taskId} ORDER BY created_at ASC
    `;
    const notes: Note[] = noteRows.map((n) => ({
      id: n.id,
      text: n.text,
      createdAt: n.created_at,
    }));

    const task = rowToTask(taskRow, notes);
    const question = await generateQuestion(task);

    return c.json({ question });
  } catch (err) {
    console.error('[agent/question]', err);
    return c.json({ error: 'Question generation failed' }, 500);
  }
});

agent.post('/summarize/:taskId', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    if (!validateUuid(taskId)) return c.json({ error: 'Invalid ID format' }, 400);
    const summary = await summarizePaper(taskId);
    return c.json(summary);
  } catch (err) {
    console.error('[agent/summarize]', err);
    return c.json({ error: 'Summarization failed' }, 500);
  }
});

agent.post('/briefing', async (c) => {
  try {
    const userId = c.get('userId') as string;
    const message = await dailyBriefing(userId);
    return c.json({ message });
  } catch (err) {
    console.error('[agent/briefing]', err);
    return c.json({ error: 'Briefing failed' }, 500);
  }
});

// --- mock interview routes ---

// POST /agent/mock/start
agent.post('/mock/start', async (c) => {
  try {
    const userId = c.get('userId') as string;
    const raw = await c.req.json();
    const parsed = mockStartSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    // "surprise me" mode: no topic provided → pick weakest topic
    const topic =
      parsed.data.topic ?? (await getInterleaveTopicForMock(parsed.data.collectionId, userId));
    const difficulty = parsed.data.difficulty ?? 'medium';

    const result = await startMockInterview(topic, difficulty, parsed.data.collectionId, userId);
    return c.json(result, 201);
  } catch (err) {
    console.error('[agent/mock/start]', err);
    return c.json({ error: 'Failed to start mock interview' }, 500);
  }
});

// POST /agent/mock/respond
agent.post('/mock/respond', async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = mockRespondSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
    }

    const result = await respondToMock(parsed.data.sessionId, parsed.data.answer);
    return c.json(result);
  } catch (err) {
    console.error('[agent/mock/respond]', err);
    return c.json({ error: 'Failed to process response' }, 500);
  }
});

// GET /agent/mock — list sessions, optional ?collection=uuid filter
agent.get('/mock', async (c) => {
  try {
    const collectionId = c.req.query('collection');
    if (collectionId && !validateUuid(collectionId)) {
      return c.json({ error: 'Invalid collection ID format' }, 400);
    }
    const userId = c.get('userId') as string;
    const sessions = await listMockSessions(collectionId, userId);
    return c.json(sessions);
  } catch (err) {
    console.error('[agent/mock list]', err);
    return c.json({ error: 'Failed to list mock sessions' }, 500);
  }
});

// GET /agent/mock/:id — must come after /mock to avoid ambiguity
agent.get('/mock/:id', async (c) => {
  try {
    const id = c.req.param('id');
    if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

    const userId = c.get('userId') as string;
    const session = await getMockSession(id, userId);
    if (!session) return c.json({ error: 'Session not found' }, 404);

    return c.json(session);
  } catch (err) {
    console.error('[agent/mock/:id]', err);
    return c.json({ error: 'Failed to get mock session' }, 500);
  }
});

export default agent;
