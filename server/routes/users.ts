import { Hono } from 'hono';
import { z } from 'zod';
import sql from '../db/client.js';
import { getUserById, updateUserProfile, adminUpdateUser } from '../auth/users.js';
import { getUserSessions, deleteSession } from '../auth/sessions.js';
import { validateUuid } from '../validation.js';
import { createMcpKey, listMcpKeys, revokeMcpKey } from '../mcp/keys.js';
import { saveAiKey, getAiKeyInfo, deleteAiKey } from '../auth/ai-keys.js';
import { isEncryptionAvailable } from '../auth/encryption.js';
import type { AppEnv } from '../types.js';

const users = new Hono<AppEnv>();

// --- Validation ---

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

const updateProfileSchema = z.object({
  displayName: z.string().max(100).nullable().optional(),
  timezone: z
    .string()
    .max(100)
    .refine((tz) => VALID_TIMEZONES.has(tz), { message: 'Invalid timezone' })
    .optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
  notifyDaily: z.boolean().optional(),
  notifyWeekly: z.boolean().optional(),
  dailyReviewGoal: z.number().int().min(1).max(50).optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  startOfWeek: z.number().int().min(0).max(1).optional(),
  language: z.enum(['en']).optional(),
});

const createTopicSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});

// --- Profile ---

// GET /users/me
users.get('/me', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const user = await getUserById(userId);
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

// PATCH /users/me
users.patch('/me', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const raw = await c.req.json();
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const user = await updateUserProfile(userId, parsed.data);
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

// --- Sessions ---

// GET /users/me/sessions
users.get('/me/sessions', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const sessions = await getUserSessions(userId);
  return c.json(sessions);
});

// DELETE /users/me/sessions/:id
users.delete('/me/sessions/:id', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const sessionId = c.req.param('id');
  if (!validateUuid(sessionId)) return c.json({ error: 'Invalid ID format' }, 400);

  // Verify session belongs to user
  const sessions = await getUserSessions(userId);
  const found = sessions.find((s) => s.id === sessionId);
  if (!found) return c.json({ error: 'Session not found' }, 404);

  await deleteSession(sessionId);
  return c.json({ deleted: true, id: sessionId });
});

// --- Custom Topics ---

interface CustomTopicRow {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
}

// GET /users/me/topics
users.get('/me/topics', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const rows = await sql<CustomTopicRow[]>`
    SELECT * FROM custom_topics WHERE user_id = ${userId} ORDER BY name ASC
  `;
  return c.json(rows.map((r) => ({ id: r.id, name: r.name, color: r.color })));
});

// POST /users/me/topics
users.post('/me/topics', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const raw = await c.req.json();
  const parsed = createTopicSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const [row] = await sql<CustomTopicRow[]>`
    INSERT INTO custom_topics (user_id, name, color)
    VALUES (${userId}, ${parsed.data.name}, ${parsed.data.color ?? null})
    RETURNING *
  `;
  return c.json({ id: row.id, name: row.name, color: row.color }, 201);
});

// DELETE /users/me/topics/:id
users.delete('/me/topics/:id', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const id = c.req.param('id');
  if (!validateUuid(id)) return c.json({ error: 'Invalid ID format' }, 400);

  const [row] = await sql<CustomTopicRow[]>`
    DELETE FROM custom_topics WHERE id = ${id} AND user_id = ${userId} RETURNING *
  `;
  if (!row) return c.json({ error: 'Topic not found' }, 404);
  return c.json({ deleted: true, id });
});

// --- AI Key Storage ---

const saveAiKeySchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  apiKey: z.string().min(1).max(256),
  model: z.string().nullish(),
  expiryDays: z.union([z.literal(30), z.literal(90), z.literal(365)]),
});

// GET /users/me/ai-key
users.get('/me/ai-key', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const info = await getAiKeyInfo(userId);
  if (!info) return c.json({ error: 'No saved AI key' }, 404);
  return c.json(info);
});

// POST /users/me/ai-key
users.post('/me/ai-key', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  if (!isEncryptionAvailable()) {
    return c.json({ error: 'Server-side key storage is not configured' }, 503);
  }

  const raw = await c.req.json();
  const parsed = saveAiKeySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const { provider, apiKey, model, expiryDays } = parsed.data;
  const info = await saveAiKey(userId, provider, apiKey, model ?? null, expiryDays);
  return c.json(info, 201);
});

// DELETE /users/me/ai-key
users.delete('/me/ai-key', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const deleted = await deleteAiKey(userId);
  if (!deleted) return c.json({ error: 'No saved AI key' }, 404);
  return c.json({ deleted: true });
});

// GET /users/me/ai-key/status — check if encryption is available
users.get('/me/ai-key/status', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  return c.json({ encryptionAvailable: isEncryptionAvailable() });
});

// --- Admin routes ---

// GET /users/admin/users — list all users with task counts and last active (admin only)
users.get('/admin/users', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const user = await getUserById(userId);
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const rows = await sql<
    Array<{
      id: string;
      email: string;
      display_name: string | null;
      email_verified: boolean;
      is_admin: boolean;
      is_blocked: boolean;
      timezone: string;
      theme: string;
      notify_daily: boolean;
      notify_weekly: boolean;
      daily_review_goal: number;
      created_at: string;
      updated_at: string;
      task_count: string;
      last_active_at: string | null;
    }>
  >`
    SELECT u.*,
      COALESCE(t.cnt, 0)::text AS task_count,
      s.last_active_at
    FROM users u
    LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM tasks GROUP BY user_id) t ON t.user_id = u.id
    LEFT JOIN (SELECT user_id, MAX(last_used_at) AS last_active_at FROM sessions GROUP BY user_id) s ON s.user_id = u.id
    ORDER BY u.created_at ASC
  `;

  return c.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      emailVerified: r.email_verified,
      isAdmin: r.is_admin,
      isBlocked: r.is_blocked,
      timezone: r.timezone,
      theme: r.theme,
      notifyDaily: r.notify_daily,
      notifyWeekly: r.notify_weekly,
      dailyReviewGoal: r.daily_review_goal,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      taskCount: parseInt(r.task_count, 10),
      lastActiveAt: r.last_active_at,
    })),
  );
});

const adminUpdateSchema = z.object({
  isAdmin: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
});

// PATCH /users/admin/users/:id — toggle admin/blocked (admin only)
users.patch('/admin/users/:id', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const currentUser = await getUserById(userId);
  if (!currentUser?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const targetId = c.req.param('id');
  if (!validateUuid(targetId)) return c.json({ error: 'Invalid ID format' }, 400);

  if (targetId === userId) return c.json({ error: 'Cannot modify your own account' }, 400);

  const raw = await c.req.json();
  const parsed = adminUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const updated = await adminUpdateUser(targetId, parsed.data);
  if (!updated) return c.json({ error: 'User not found' }, 404);

  return c.json(updated);
});

// GET /users/admin/stats — basic admin stats (admin only)
users.get('/admin/stats', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const user = await getUserById(userId);
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const [counts] = await sql<
    [
      {
        user_count: string;
        task_count: string;
        session_count: string;
        review_count: string;
      },
    ]
  >`
    SELECT
      (SELECT COUNT(*)::text FROM users) AS user_count,
      (SELECT COUNT(*)::text FROM tasks) AS task_count,
      (SELECT COUNT(*)::text FROM sessions WHERE expires_at > now()) AS session_count,
      (SELECT COUNT(*)::text FROM review_events) AS review_count
  `;

  return c.json({
    users: parseInt(counts.user_count, 10),
    tasks: parseInt(counts.task_count, 10),
    activeSessions: parseInt(counts.session_count, 10),
    totalReviews: parseInt(counts.review_count, 10),
  });
});

// --- MCP Key Management (user routes) ---

const createMcpKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z
    .array(z.enum(['read', 'write', 'ai']))
    .min(1)
    .optional(),
  ttlDays: z.number().int().min(1).max(365).optional(),
});

const toggleMcpSchema = z.object({
  enabled: z.boolean(),
});

// GET /users/me/mcp-keys — list user's MCP keys
users.get('/me/mcp-keys', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const keys = await listMcpKeys(userId);
  return c.json(keys);
});

// POST /users/me/mcp-keys — create a new MCP key
users.post('/me/mcp-keys', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const raw = await c.req.json();
  const parsed = createMcpKeySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const { name, scopes, ttlDays } = parsed.data;
  const result = await createMcpKey(userId, name, scopes ?? ['read'], ttlDays);
  return c.json(result, 201);
});

// DELETE /users/me/mcp-keys/:id — revoke an MCP key
users.delete('/me/mcp-keys/:id', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const keyId = c.req.param('id');
  if (!validateUuid(keyId)) return c.json({ error: 'Invalid ID format' }, 400);

  const revoked = await revokeMcpKey(userId, keyId);
  if (!revoked) return c.json({ error: 'Key not found or already revoked' }, 404);
  return c.json({ deleted: true, id: keyId });
});

// PATCH /users/me/mcp — toggle mcp_enabled for self
users.patch('/me/mcp', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const raw = await c.req.json();
  const parsed = toggleMcpSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  await sql`UPDATE users SET mcp_enabled = ${parsed.data.enabled} WHERE id = ${userId}`;
  return c.json({ enabled: parsed.data.enabled });
});

// --- MCP Admin Routes ---

// GET /users/admin/mcp/settings — get global MCP enabled status
users.get('/admin/mcp/settings', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const user = await getUserById(userId);
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const [row] = await sql`SELECT value FROM server_settings WHERE key = 'mcp_enabled'`;
  return c.json({ enabled: row?.value === true });
});

// PATCH /users/admin/mcp/settings — toggle global MCP on/off
users.patch('/admin/mcp/settings', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const user = await getUserById(userId);
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const raw = await c.req.json();
  const parsed = toggleMcpSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  await sql`UPDATE server_settings SET value = ${JSON.stringify(parsed.data.enabled)} WHERE key = 'mcp_enabled'`;
  return c.json({ enabled: parsed.data.enabled });
});

// PATCH /users/admin/users/:id/mcp — toggle MCP for a specific user
users.patch('/admin/users/:id/mcp', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const currentUser = await getUserById(userId);
  if (!currentUser?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const targetId = c.req.param('id');
  if (!validateUuid(targetId)) return c.json({ error: 'Invalid ID format' }, 400);

  const raw = await c.req.json();
  const parsed = toggleMcpSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const [updated] =
    await sql`UPDATE users SET mcp_enabled = ${parsed.data.enabled} WHERE id = ${targetId} RETURNING id`;
  if (!updated) return c.json({ error: 'User not found' }, 404);

  return c.json({ userId: targetId, mcpEnabled: parsed.data.enabled });
});

// GET /users/admin/mcp/audit — list recent MCP audit log entries (last 100)
users.get('/admin/mcp/audit', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const user = await getUserById(userId);
  if (!user?.isAdmin) return c.json({ error: 'Forbidden' }, 403);

  const rows = await sql`
    SELECT al.*, mk.name as key_name
    FROM mcp_audit_log al
    LEFT JOIN mcp_keys mk ON mk.id = al.key_id
    ORDER BY al.created_at DESC
    LIMIT 100
  `;
  return c.json(rows);
});

export default users;
