import { Hono } from 'hono';
import { z } from 'zod';
import { getUserById } from '../auth/users.js';
import { searchLogs, getLogStats, getRequestTrace } from '../lib/log-reader.js';
import type { Logger } from 'pino';

type AppEnv = { Variables: { userId: string; logger: Logger; reqId: string } };
const logs = new Hono<AppEnv>();

const querySchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
  path: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// GET /logs — paginated log entries
logs.get('/', async (c) => {
  const user = await getUserById(c.get('userId'));
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters', details: parsed.error.issues }, 400);
  }

  const { page, limit, ...filters } = parsed.data;
  const allEntries = await searchLogs({ ...filters, limit: page * limit });
  const start = (page - 1) * limit;
  const entries = allEntries.slice(start, start + limit);

  return c.json({
    entries,
    page,
    limit,
    total: allEntries.length,
    hasMore: allEntries.length >= page * limit,
  });
});

// GET /logs/stats — aggregated stats
logs.get('/stats', async (c) => {
  const user = await getUserById(c.get('userId'));
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const hours = parseInt(new URL(c.req.url).searchParams.get('hours') ?? '24', 10);
  const stats = await getLogStats(Math.min(Math.max(hours, 1), 720));
  return c.json(stats);
});

// GET /logs/request/:requestId — full trace for one request
logs.get('/request/:requestId', async (c) => {
  const user = await getUserById(c.get('userId'));
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const requestId = c.req.param('requestId');
  const entries = await getRequestTrace(requestId);
  return c.json({ entries });
});

export default logs;
