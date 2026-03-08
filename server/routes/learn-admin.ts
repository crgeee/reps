import { Hono } from 'hono';
import { z } from 'zod';
import sql from '../db/client.js';
import { getUserById } from '../auth/users.js';
import { validateUuid } from '../validation.js';
import type { AppEnv } from '../types.js';

const learnAdmin = new Hono<AppEnv>();

// Admin gate middleware
learnAdmin.use('*', async (c, next) => {
  const user = await getUserById(c.get('userId'));
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);
  await next();
});

// --- validation schemas ---

const configSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

const createTrackSchema = z.object({
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

// --- routes ---

// GET /stats — execution stats
learnAdmin.get('/stats', async (c) => {
  const today = new Date().toISOString().split('T')[0];

  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at::date = ${today}::date)::int AS executions_today,
      COUNT(*)::int AS executions_total,
      COALESCE(AVG(execution_ms) FILTER (WHERE execution_ms IS NOT NULL), 0)::float AS avg_execution_ms,
      CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE (COUNT(*) FILTER (WHERE passed = true)::float / COUNT(*)::float * 100)
      END AS success_rate
    FROM submissions
  `;

  return c.json({
    executionsToday: stats.executions_today,
    executionsTotal: stats.executions_total,
    avgExecutionMs: Math.round(stats.avg_execution_ms as number),
    successRate: Math.round((stats.success_rate as number) * 100) / 100,
  });
});

// GET /config — list all learn.* settings
learnAdmin.get('/config', async (c) => {
  const rows = await sql`
    SELECT key, value FROM settings WHERE key LIKE 'learn.%'
  `;

  const config: Record<string, unknown> = {};
  for (const row of rows) {
    const key = (row.key as string).replace('learn.', '');
    config[key] = row.value;
  }

  return c.json(config);
});

// POST /config — upsert learn.* settings
learnAdmin.post('/config', async (c) => {
  const raw = await c.req.json();
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const entries = Object.entries(parsed.data);
  for (const [key, value] of entries) {
    const fullKey = `learn.${key}`;
    await sql`
      INSERT INTO settings (key, value)
      VALUES (${fullKey}, ${JSON.stringify(value)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}::jsonb, updated_at = now()
    `;
  }

  return c.json({ updated: entries.length });
});

// GET /submissions — recent submissions (paginated) with joins
learnAdmin.get('/submissions', async (c) => {
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10) || 20));
  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0);

  const rows = await sql`
    SELECT
      s.id,
      e.prompt AS exercise_prompt,
      e.type AS exercise_type,
      m.title AS module_name,
      t.title AS track_name,
      s.passed,
      s.score,
      s.execution_ms,
      s.created_at
    FROM submissions s
    JOIN exercises e ON e.id = s.exercise_id
    JOIN modules m ON m.id = e.module_id
    JOIN tracks t ON t.id = m.track_id
    ORDER BY s.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return c.json(
    rows.map((r) => ({
      id: r.id,
      exercisePrompt: r.exercise_prompt,
      exerciseType: r.exercise_type,
      moduleName: r.module_name,
      trackName: r.track_name,
      passed: r.passed,
      score: r.score,
      executionMs: r.execution_ms,
      createdAt: String(r.created_at),
    })),
  );
});

// POST /tracks — create a new track
learnAdmin.post('/tracks', async (c) => {
  const raw = await c.req.json();
  const parsed = createTrackSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const { slug, title, description } = parsed.data;

  const [existing] = await sql`SELECT id FROM tracks WHERE slug = ${slug}`;
  if (existing) {
    return c.json({ error: 'Track with this slug already exists' }, 409);
  }

  const [track] = await sql`
    INSERT INTO tracks (slug, title, description)
    VALUES (${slug}, ${title}, ${description ?? null})
    RETURNING *
  `;

  return c.json(
    {
      id: track.id,
      slug: track.slug,
      title: track.title,
      description: track.description,
      createdAt: String(track.created_at),
    },
    201,
  );
});

// DELETE /tracks/:id — delete a track
learnAdmin.delete('/tracks/:id', async (c) => {
  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid track ID' }, 400);

  const [deleted] = await sql`DELETE FROM tracks WHERE id = ${id} RETURNING id`;
  if (!deleted) {
    return c.json({ error: 'Track not found' }, 404);
  }

  return c.json({ deleted: true });
});

export default learnAdmin;
