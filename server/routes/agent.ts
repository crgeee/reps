import { Hono } from "hono";
import sql from "../db/client.js";
import { evaluateAnswer } from "../agent/evaluator.js";
import { generateQuestion } from "../agent/questions.js";
import { summarizePaper } from "../agent/papers.js";
import { dailyBriefing } from "../agent/coach.js";
import type { Task, Note } from "../../src/types.js";

const agent = new Hono();

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

// --- routes ---

agent.post("/evaluate", async (c) => {
  try {
    const body = await c.req.json();
    const { taskId, answer } = body;

    if (!taskId || !answer) {
      return c.json({ error: "taskId and answer are required" }, 400);
    }

    const result = await evaluateAnswer(taskId, answer);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Evaluation failed";
    console.error("[agent/evaluate]", err);
    return c.json({ error: message }, 500);
  }
});

agent.get("/question/:taskId", async (c) => {
  try {
    const taskId = c.req.param("taskId");

    const [taskRow] = await sql<TaskRow[]>`SELECT * FROM tasks WHERE id = ${taskId}`;
    if (!taskRow) {
      return c.json({ error: "Task not found" }, 404);
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
    const message = err instanceof Error ? err.message : "Question generation failed";
    console.error("[agent/question]", err);
    return c.json({ error: message }, 500);
  }
});

agent.post("/summarize/:taskId", async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const summary = await summarizePaper(taskId);
    return c.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summarization failed";
    console.error("[agent/summarize]", err);
    return c.json({ error: message }, 500);
  }
});

agent.post("/briefing", async (c) => {
  try {
    const message = await dailyBriefing();
    return c.json({ message });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "Briefing failed";
    console.error("[agent/briefing]", err);
    return c.json({ error: errMessage }, 500);
  }
});

export default agent;
