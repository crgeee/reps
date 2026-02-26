import { Hono } from "hono";
import { z } from "zod";
import sql from "../db/client.js";
import { getUserById, updateUserProfile, adminUpdateUser } from "../auth/users.js";
import { getUserSessions, deleteSession } from "../auth/sessions.js";
import { validateUuid } from "../validation.js";

type AppEnv = { Variables: { userId: string } };
const users = new Hono<AppEnv>();

// --- Validation ---

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

const updateProfileSchema = z.object({
  displayName: z.string().max(100).nullable().optional(),
  timezone: z.string().max(100).refine((tz) => VALID_TIMEZONES.has(tz), { message: "Invalid timezone" }).optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
  notifyDaily: z.boolean().optional(),
  notifyWeekly: z.boolean().optional(),
  dailyReviewGoal: z.number().int().min(1).max(50).optional(),
});

const createTopicSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

// --- Profile ---

// GET /users/me
users.get("/me", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const user = await getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

// PATCH /users/me
users.patch("/me", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const raw = await c.req.json();
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  const user = await updateUserProfile(userId, parsed.data);
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

// --- Sessions ---

// GET /users/me/sessions
users.get("/me/sessions", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const sessions = await getUserSessions(userId);
  return c.json(sessions);
});

// DELETE /users/me/sessions/:id
users.delete("/me/sessions/:id", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const sessionId = c.req.param("id");
  if (!validateUuid(sessionId)) return c.json({ error: "Invalid ID format" }, 400);

  // Verify session belongs to user
  const sessions = await getUserSessions(userId);
  const found = sessions.find((s) => s.id === sessionId);
  if (!found) return c.json({ error: "Session not found" }, 404);

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
users.get("/me/topics", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const rows = await sql<CustomTopicRow[]>`
    SELECT * FROM custom_topics WHERE user_id = ${userId} ORDER BY name ASC
  `;
  return c.json(rows.map((r) => ({ id: r.id, name: r.name, color: r.color })));
});

// POST /users/me/topics
users.post("/me/topics", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const raw = await c.req.json();
  const parsed = createTopicSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  const [row] = await sql<CustomTopicRow[]>`
    INSERT INTO custom_topics (user_id, name, color)
    VALUES (${userId}, ${parsed.data.name}, ${parsed.data.color ?? null})
    RETURNING *
  `;
  return c.json({ id: row.id, name: row.name, color: row.color }, 201);
});

// DELETE /users/me/topics/:id
users.delete("/me/topics/:id", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const id = c.req.param("id");
  if (!validateUuid(id)) return c.json({ error: "Invalid ID format" }, 400);

  const [row] = await sql<CustomTopicRow[]>`
    DELETE FROM custom_topics WHERE id = ${id} AND user_id = ${userId} RETURNING *
  `;
  if (!row) return c.json({ error: "Topic not found" }, 404);
  return c.json({ deleted: true, id });
});

// --- Admin routes ---

// GET /users/admin/users — list all users with task counts and last active (admin only)
users.get("/admin/users", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const user = await getUserById(userId);
  if (!user?.isAdmin) return c.json({ error: "Forbidden" }, 403);

  const rows = await sql<Array<{
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
  }>>`
    SELECT u.*,
      COALESCE(t.cnt, 0)::text AS task_count,
      s.last_active_at
    FROM users u
    LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM tasks GROUP BY user_id) t ON t.user_id = u.id
    LEFT JOIN (SELECT user_id, MAX(last_used_at) AS last_active_at FROM sessions GROUP BY user_id) s ON s.user_id = u.id
    ORDER BY u.created_at ASC
  `;

  return c.json(rows.map((r) => ({
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
  })));
});

const adminUpdateSchema = z.object({
  isAdmin: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
});

// PATCH /users/admin/users/:id — toggle admin/blocked (admin only)
users.patch("/admin/users/:id", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const currentUser = await getUserById(userId);
  if (!currentUser?.isAdmin) return c.json({ error: "Forbidden" }, 403);

  const targetId = c.req.param("id");
  if (!validateUuid(targetId)) return c.json({ error: "Invalid ID format" }, 400);

  if (targetId === userId) return c.json({ error: "Cannot modify your own account" }, 400);

  const raw = await c.req.json();
  const parsed = adminUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  const updated = await adminUpdateUser(targetId, parsed.data);
  if (!updated) return c.json({ error: "User not found" }, 404);

  return c.json(updated);
});

// GET /users/admin/stats — basic admin stats (admin only)
users.get("/admin/stats", async (c) => {
  const userId = c.get("userId") as string;
  if (!userId) return c.json({ error: "Not authenticated" }, 401);

  const user = await getUserById(userId);
  if (!user?.isAdmin) return c.json({ error: "Forbidden" }, 403);

  const [counts] = await sql<[{
    user_count: string;
    task_count: string;
    session_count: string;
    review_count: string;
  }]>`
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

export default users;
