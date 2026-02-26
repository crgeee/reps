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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]!;

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
      (SELECT COUNT(*) FROM filtered_events WHERE reviewed_at >= ${thirtyDaysAgoStr}::date)::text AS reviews_last_30,
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

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0]!;

  const rows = await sql<{ date: string; count: string }[]>`
    SELECT reviewed_at::text AS date, COUNT(*)::text AS count
    FROM review_events
    WHERE reviewed_at >= ${cutoffStr}::date
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

  // Get distinct review dates in descending order
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
  const todayStr = new Date().toISOString().split("T")[0]!;

  // Calculate current streak — starts from today or yesterday
  let currentStreak = 0;
  let checkDate = new Date(todayStr);

  if (dates[0] === todayStr) {
    currentStreak = 1;
  } else {
    const yesterday = new Date(todayStr);
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

  // Calculate longest streak across all history
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
