import sql from "../db/client.js";
import type { Task } from "../../src/types.js";

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
}

export interface BriefingData {
  dueToday: Task[];
  upcomingDeadlines: Task[];
  streak: { current: number; longest: number };
  weakestTopic: { topic: string; avgEase: number } | null;
}

function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

function mapTaskRow(row: TaskRow): Task {
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
    notes: [],
  };
}

export async function getDailyBriefingData(collectionId?: string, userId?: string): Promise<BriefingData> {
  const todayStr = today();
  const deadlineCutoff = new Date();
  deadlineCutoff.setDate(deadlineCutoff.getDate() + 7);
  const deadlineStr = deadlineCutoff.toISOString().split("T")[0]!;
  const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;
  const userFilter = userId ? sql`AND user_id = ${userId}` : sql``;

  const dueTasks = await sql<TaskRow[]>`
    SELECT * FROM tasks
    WHERE next_review <= ${todayStr} AND completed = false ${collectionFilter} ${userFilter}
    ORDER BY next_review ASC
  `;

  const upcomingDeadlines = await sql<TaskRow[]>`
    SELECT * FROM tasks
    WHERE deadline IS NOT NULL AND deadline <= ${deadlineStr} AND completed = false ${collectionFilter} ${userFilter}
    ORDER BY deadline ASC
  `;

  // Streak: count consecutive distinct reviewed_at days going back from today
  let streakCount = 0;
  try {
    const [streakRow] = await sql<[{ cnt: string }]>`
      WITH dates AS (
        SELECT DISTINCT reviewed_at FROM review_events WHERE 1=1 ${collectionFilter} ${userFilter} ORDER BY reviewed_at DESC
      )
      SELECT COUNT(*)::text AS cnt FROM dates
    `;
    streakCount = parseInt(streakRow?.cnt ?? "0", 10);
  } catch (err) {
    console.warn("[shared] streak query failed:", err);
    streakCount = 0;
  }

  // Weakest topic by average ease_factor
  const weakest = await sql<{ topic: string; avg_ease: string }[]>`
    SELECT topic, ROUND(AVG(ease_factor)::numeric, 2)::text AS avg_ease
    FROM tasks WHERE completed = false ${collectionFilter} ${userFilter}
    GROUP BY topic ORDER BY AVG(ease_factor) ASC LIMIT 1
  `;

  return {
    dueToday: dueTasks.map(mapTaskRow),
    upcomingDeadlines: upcomingDeadlines.map(mapTaskRow),
    streak: { current: streakCount, longest: streakCount },
    weakestTopic: weakest[0]
      ? { topic: weakest[0].topic, avgEase: parseFloat(weakest[0].avg_ease) }
      : null,
  };
}
