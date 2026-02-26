import { Hono } from 'hono';
import sql from '../db/client.js';
import { validateUuid } from '../validation.js';

type AppEnv = { Variables: { userId: string } };
const stats = new Hono<AppEnv>();

// GET /stats/overview?collection=uuid
stats.get('/overview', async (c) => {
  try {
    const userId = c.get('userId') as string;
    const collectionId = c.req.query('collection');
    if (collectionId && !validateUuid(collectionId)) {
      return c.json({ error: 'Invalid collection ID' }, 400);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userFilter = userId ? sql`AND re.user_id = ${userId}` : sql``;
    const taskUserFilter = userId ? sql`AND user_id = ${userId}` : sql``;
    const collectionFilter = collectionId ? sql`AND re.collection_id = ${collectionId}` : sql``;
    const taskCollectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;

    const [counts] = await sql<[{ total: string; last30: string }]>`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE reviewed_at >= ${thirtyDaysAgo})::text AS last30
      FROM review_events re WHERE 1=1 ${userFilter} ${collectionFilter}
    `;
    const totalReviews = parseInt(counts.total, 10);
    const reviewsLast30 = parseInt(counts.last30, 10);

    const topicRows = await sql<{ topic: string; cnt: string }[]>`
      SELECT tk.topic, COUNT(*)::text AS cnt
      FROM review_events re JOIN tasks tk ON tk.id = re.task_id
      WHERE 1=1 ${userFilter} ${collectionFilter}
      GROUP BY tk.topic
    `;
    const reviewsByTopic: Record<string, number> = {};
    for (const r of topicRows) reviewsByTopic[r.topic] = parseInt(r.cnt, 10);

    const easeRows = await sql<{ topic: string; avg_ef: string }[]>`
      SELECT topic, ROUND(AVG(ease_factor)::numeric, 2)::text AS avg_ef
      FROM tasks WHERE completed = false ${taskUserFilter} ${taskCollectionFilter}
      GROUP BY topic
    `;
    const averageEaseByTopic: Record<string, number> = {};
    for (const r of easeRows) averageEaseByTopic[r.topic] = parseFloat(r.avg_ef);

    return c.json({
      totalReviews,
      reviewsLast30Days: reviewsLast30,
      reviewsByTopic,
      averageEaseByTopic,
    });
  } catch (err) {
    console.error('[stats/overview]', err);
    return c.json({
      totalReviews: 0,
      reviewsLast30Days: 0,
      reviewsByTopic: {},
      averageEaseByTopic: {},
    });
  }
});

// GET /stats/heatmap?collection=uuid&days=365
stats.get('/heatmap', async (c) => {
  try {
    const userId = c.get('userId') as string;
    const collectionId = c.req.query('collection');
    const days = Math.min(parseInt(c.req.query('days') ?? '365', 10), 365);
    if (collectionId && !validateUuid(collectionId)) {
      return c.json({ error: 'Invalid collection ID' }, 400);
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const userFilter = userId ? sql`AND user_id = ${userId}` : sql``;
    const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;

    const rows = await sql<{ date: string; count: string }[]>`
      SELECT reviewed_at::text AS date, COUNT(*)::text AS count
      FROM review_events
      WHERE reviewed_at >= ${cutoff} ${userFilter} ${collectionFilter}
      GROUP BY reviewed_at ORDER BY reviewed_at
    `;

    const heatmap: Record<string, number> = {};
    for (const r of rows) heatmap[r.date] = parseInt(r.count, 10);
    return c.json(heatmap);
  } catch (err) {
    console.error('[stats/heatmap]', err);
    return c.json({});
  }
});

// GET /stats/streaks?collection=uuid
stats.get('/streaks', async (c) => {
  try {
    const userId = c.get('userId') as string;
    const collectionId = c.req.query('collection');
    if (collectionId && !validateUuid(collectionId)) {
      return c.json({ error: 'Invalid collection ID' }, 400);
    }

    const userFilter = userId ? sql`AND user_id = ${userId}` : sql``;
    const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;

    const rows = await sql<{ review_date: string }[]>`
      SELECT DISTINCT reviewed_at::text AS review_date
      FROM review_events WHERE 1=1 ${userFilter} ${collectionFilter}
      ORDER BY review_date DESC
    `;

    if (rows.length === 0) {
      return c.json({ currentStreak: 0, longestStreak: 0, lastReviewDate: null });
    }

    const dates = rows.map((r) => r.review_date);
    const todayStr = new Date().toISOString().split('T')[0]!;

    let currentStreak = 0;
    let checkDate = new Date(todayStr);

    if (dates[0] === todayStr) {
      currentStreak = 1;
    } else {
      const yesterday = new Date(todayStr);
      yesterday.setDate(yesterday.getDate() - 1);
      if (dates[0] === yesterday.toISOString().split('T')[0]) {
        currentStreak = 1;
        checkDate = yesterday;
      }
    }

    if (currentStreak > 0) {
      const dateSet = new Set(dates);
      for (let i = 1; ; i++) {
        const prev = new Date(checkDate);
        prev.setDate(prev.getDate() - i);
        const prevStr = prev.toISOString().split('T')[0]!;
        if (dateSet.has(prevStr)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

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
  } catch (err) {
    console.error('[stats/streaks]', err);
    return c.json({ currentStreak: 0, longestStreak: 0, lastReviewDate: null });
  }
});

export default stats;
