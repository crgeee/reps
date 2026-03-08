import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { logger } from './logger.js';
import type { AppEnv } from './types.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimiter } from './middleware/rate-limit.js';
import { aiCredentialsMiddleware } from './middleware/ai-credentials.js';
import { etag } from './middleware/etag.js';
import { requestLogger } from './middleware/logger.js';
import authRoutes from './routes/auth.js';
import tasks from './routes/tasks.js';
import agent from './routes/agent.js';
import collections from './routes/collections.js';
import templates from './routes/templates.js';
import tags from './routes/tags.js';
import statsRoutes from './routes/stats.js';
import usersRoutes from './routes/users.js';
import { calendarFeed, exportRoutes } from './routes/export.js';
import logsRoutes from './routes/logs.js';
import learn from './routes/learn.js';
import mcpRoute from './mcp/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

// Import and start cron jobs
import { startCronJobs } from './cron.js';
startCronJobs();

const app = new Hono<AppEnv>();

// CORS — restrict to configured domain, enable credentials for cookies
const corsOrigin = process.env.APP_URL ?? 'http://localhost:5173';
app.use(
  '/*',
  cors({
    origin: [corsOrigin],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-AI-Key', 'X-AI-Provider'],
    credentials: true,
    maxAge: 86400,
  }),
);

// Global error handler — catches JSON parse errors from c.req.json()
app.onError((err, c) => {
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const log = c.get('logger') ?? logger;
  log.error(
    {
      userId: c.get('userId') ?? 'anonymous',
      error: err.message,
      stack: err.stack,
    },
    'Unhandled error',
  );
  return c.json({ error: 'Internal server error' }, 500);
});

// Body size limit — 1MB default
app.use('/*', bodyLimit({ maxSize: 1024 * 1024 }));

// Structured request logging
app.use('/*', requestLogger);

// Global rate limit — 100 req/min
app.use('/*', rateLimiter(100, 60_000));

// Health check (no auth required)
app.get('/health', (c) => c.json({ status: 'ok', version: pkg.version }));

// Auth routes — BEFORE auth middleware (public endpoints)
app.route('/auth', authRoutes);

// Calendar feed — token-based auth, no Bearer header (calendar apps can't send it)
app.route('/export', calendarFeed);

// MCP endpoint — own auth middleware, before REST auth middleware
app.route('/mcp', mcpRoute);

// Apply auth middleware to all protected routes
app.use('/*', authMiddleware);

// ETag caching for GET responses
app.use('/*', etag);

// Extract AI credentials from BYOK headers
app.use('/agent/*', aiCredentialsMiddleware);

// Stricter rate limit for agent routes — 10 req/min
app.use('/agent/*', rateLimiter(10, 60_000));

// Mount protected routes
app.route('/tasks', tasks);
app.route('/agent', agent);
app.route('/collections', collections);
app.route('/templates', templates);
app.route('/tags', tags);
app.route('/stats', statsRoutes);
app.route('/users', usersRoutes);
app.route('/export', exportRoutes);
app.route('/logs', logsRoutes);
app.route('/learn', learn);

const port = parseInt(process.env.PORT || '3000', 10);

serve({ fetch: app.fetch, port }, () => {
  logger.info({ port }, 'reps server listening');
});

export default app;
