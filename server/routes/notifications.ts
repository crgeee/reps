import { Hono } from 'hono';
import { z } from 'zod';
import sql from '../db/client.js';
import { isValidPushEndpoint, sendPushToUser } from '../push/send.js';
import type { AppEnv } from '../types.js';

const notifications = new Hono<AppEnv>();

// --- Validation ---

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

const MAX_SUBSCRIPTIONS_PER_USER = 10;

// --- Subscribe ---

// POST /notifications/subscribe
notifications.post('/subscribe', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const raw = await c.req.json();
  const parsed = subscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const { endpoint, keys } = parsed.data;

  if (!isValidPushEndpoint(endpoint)) {
    return c.json({ error: 'Invalid push endpoint' }, 400);
  }

  // Check subscription limit
  const [countRow] = await sql<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM push_subscriptions WHERE user_id = ${userId}
  `;
  const existing = parseInt(countRow.count, 10);

  // Check if this endpoint already exists for this user (won't count toward limit if updating)
  const [existingSub] = await sql`
    SELECT id FROM push_subscriptions WHERE user_id = ${userId} AND endpoint = ${endpoint}
  `;

  if (!existingSub && existing >= MAX_SUBSCRIPTIONS_PER_USER) {
    return c.json({ error: `Maximum ${MAX_SUBSCRIPTIONS_PER_USER} subscriptions allowed` }, 400);
  }

  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${userId}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = ${keys.p256dh}, auth = ${keys.auth}
  `;

  return c.json({ subscribed: true }, 201);
});

// --- Unsubscribe ---

// DELETE /notifications/subscribe
notifications.delete('/subscribe', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  const raw = await c.req.json();
  const parsed = unsubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  await sql`
    DELETE FROM push_subscriptions WHERE user_id = ${userId} AND endpoint = ${parsed.data.endpoint}
  `;

  return c.json({ unsubscribed: true });
});

// --- Test ---

// POST /notifications/test
notifications.post('/test', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Not authenticated' }, 401);

  await sendPushToUser(userId, {
    title: 'reps',
    body: 'Push notifications are working!',
    url: '/',
    tag: 'test',
  });

  return c.json({ sent: true });
});

export default notifications;
