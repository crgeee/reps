import { Hono } from 'hono';
import { z } from 'zod';
import { getUserById } from '../auth/users.js';
import { searchLogs, getLogStats, getRequestTrace } from '../lib/log-reader.js';
import type { Logger } from 'pino';

type AppEnv = { Variables: { userId: string; logger: Logger; reqId: string } };
const logs = new Hono<AppEnv>();

// Admin gate middleware
logs.use('*', async (c, next) => {
  const user = await getUserById(c.get('userId'));
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);
  await next();
});

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters', details: parsed.error.issues }, 400);
  }

  try {
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
  } catch (err) {
    c.get('logger').error({ err }, 'Failed to search logs');
    return c.json({ error: 'Failed to read logs' }, 500);
  }
});

// GET /logs/stats — aggregated stats
logs.get('/stats', async (c) => {
  const hoursParam = new URL(c.req.url).searchParams.get('hours') ?? '24';
  const hours = parseInt(hoursParam, 10);
  if (Number.isNaN(hours) || hours < 1 || hours > 720) {
    return c.json({ error: 'hours must be between 1 and 720' }, 400);
  }

  try {
    const stats = await getLogStats(hours);
    return c.json(stats);
  } catch (err) {
    c.get('logger').error({ err }, 'Failed to get log stats');
    return c.json({ error: 'Failed to read log stats' }, 500);
  }
});

// GET /logs/request/:requestId — full trace for one request
logs.get('/request/:requestId', async (c) => {
  const requestId = c.req.param('requestId');
  if (!uuidRegex.test(requestId)) {
    return c.json({ error: 'Invalid request ID format' }, 400);
  }

  try {
    const entries = await getRequestTrace(requestId);
    return c.json({ entries });
  } catch (err) {
    c.get('logger').error({ err }, 'Failed to get request trace');
    return c.json({ error: 'Failed to read request trace' }, 500);
  }
});

export default logs;
