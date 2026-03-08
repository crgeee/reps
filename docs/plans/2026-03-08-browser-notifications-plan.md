# Browser Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Web Push browser notifications with granular user preferences and per-task custom alerts.

**Architecture:** Service worker receives push events and shows native browser notifications. Server uses `web-push` library to send VAPID-authenticated messages. Push subscriptions stored per-user/per-device in PostgreSQL. Existing Pushover channel continues in parallel.

**Tech Stack:** `web-push` (server), Web Push API + Service Worker (browser), Hono routes, postgres.js, Zod validation

---

### Task 1: Database migration

**Files:**

- Create: `db/020-browser-notifications.sql`

**Step 1: Write the migration**

```sql
-- Push subscriptions (one per device per user)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Task-specific alerts
CREATE TABLE IF NOT EXISTS task_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_at    TIMESTAMPTZ NOT NULL,
  sent        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_task_alerts_pending ON task_alerts(sent, alert_at) WHERE sent = false;

-- Granular notification preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_review_due  BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_streak      BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_ai_complete BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_task_alerts BOOLEAN DEFAULT true;
```

**Step 2: Run migration locally**

Run: `npm run migrate`
Expected: Migration 020 applies without errors.

**Step 3: Commit**

```bash
git add db/020-browser-notifications.sql
git commit -m "feat: add push_subscriptions, task_alerts tables and notification prefs"
```

---

### Task 2: Install `web-push` and generate VAPID keys

**Files:**

- Modify: `package.json`
- Modify: `.env.example`

**Step 1: Install dependency**

Run: `npm install web-push`
Run: `npm install -D @types/web-push` (if types not bundled — check first)

**Step 2: Generate VAPID keys**

Run: `npx web-push generate-vapid-keys`

Save output to local `.env`:

```
VAPID_PUBLIC_KEY=<generated public key>
VAPID_PRIVATE_KEY=<generated private key>
VAPID_EMAIL=mailto:chris@reps.sh
```

**Step 3: Update `.env.example`**

Add at the end of `/Users/christophergonzalez/Projects/artagon/reps/.env.example`:

```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:you@reps.sh
```

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: add web-push dependency and VAPID env vars"
```

---

### Task 3: Server — push delivery module

**Files:**

- Create: `server/push/send.ts`
- Modify: `server/agent/notify.ts` (at `/Users/christophergonzalez/Projects/artagon/reps/server/agent/notify.ts`)

**Step 1: Create `server/push/send.ts`**

This module handles all web-push delivery logic.

```typescript
import webpush from 'web-push';
import sql from '../db/client.js';
import { logger } from '../logger.js';

const ALLOWED_PUSH_DOMAINS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'notify.windows.com',
  'web.push.apple.com',
];

let initialized = false;

function ensureInitialized(): boolean {
  if (initialized) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;
  if (!publicKey || !privateKey || !email) {
    return false;
  }
  webpush.setVapidDetails(email, publicKey, privateKey);
  initialized = true;
  return true;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function isValidPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_PUSH_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
  options?: { ttl?: number },
): Promise<void> {
  if (!ensureInitialized()) {
    logger.info({ userId, title: payload.title }, 'Web push not configured, skipping');
    return;
  }

  const subscriptions = await sql<PushSubscriptionRow[]>`
    SELECT id, endpoint, p256dh, auth FROM push_subscriptions
    WHERE user_id = ${userId}
  `;

  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const ttl = options?.ttl ?? 3600;

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: ttl, urgency: 'normal' },
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
          logger.info({ subId: sub.id }, 'Removed expired push subscription');
        } else {
          throw err;
        }
      }
    }),
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    logger.warn(
      { userId, failures: failures.length, total: subscriptions.length },
      'Some push notifications failed',
    );
  }
}
```

**Step 2: Update `server/agent/notify.ts`**

Replace the existing file to become multi-channel and user-aware. The new `send()` calls both web-push and Pushover in parallel.

Replace the full contents of `server/agent/notify.ts` with:

```typescript
import { logger } from '../logger.js';
import { sendPushToUser } from '../push/send.js';

const PUSHOVER_API = 'https://api.pushover.net/1/messages.json';

async function sendPushover(title: string, message: string): Promise<void> {
  const userKey = process.env.PUSHOVER_USER_KEY;
  const apiToken = process.env.PUSHOVER_API_TOKEN;

  if (!userKey || !apiToken) return;

  try {
    const res = await fetch(PUSHOVER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: apiToken, user: userKey, title, message }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, 'Pushover error');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to send Pushover notification');
  }
}

export async function send(
  userId: string,
  title: string,
  message: string,
  options?: { url?: string; tag?: string; ttl?: number },
): Promise<void> {
  await Promise.allSettled([
    sendPushToUser(
      userId,
      { title, body: message, url: options?.url, tag: options?.tag },
      { ttl: options?.ttl },
    ),
    sendPushover(title, message),
  ]);

  logger.info({ userId, title }, 'Notification sent');
}
```

**Step 3: Update all callers of `send()` to pass `userId`**

Search for all imports of `send` from `notify.ts`. The main callers are in `server/agent/coach.ts`. Each call to `send(title, message)` must become `send(userId, title, message)`. The `coach.ts` functions already receive `userId` as a parameter.

Run: `grep -rn "from.*notify" server/` to find all callers and update them.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add server/push/send.ts server/agent/notify.ts server/agent/coach.ts
git commit -m "feat: multi-channel push delivery (web-push + pushover)"
```

---

### Task 4: Server — notification routes

**Files:**

- Create: `server/routes/notifications.ts`
- Modify: `server/index.ts` (mount route at line 113)

**Step 1: Create `server/routes/notifications.ts`**

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import sql from '../db/client.js';
import { isValidPushEndpoint, sendPushToUser } from '../push/send.js';
import type { AppEnv } from '../types.js';

const MAX_SUBSCRIPTIONS_PER_USER = 10;

const notifications = new Hono<AppEnv>();

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// POST /notifications/subscribe
notifications.post('/subscribe', async (c) => {
  const userId = c.get('userId') as string;
  const raw = await c.req.json();
  const parsed = subscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const { endpoint, keys } = parsed.data;

  if (!isValidPushEndpoint(endpoint)) {
    return c.json({ error: 'Invalid push service endpoint' }, 400);
  }

  // Check subscription limit
  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM push_subscriptions WHERE user_id = ${userId}
  `;
  if (parseInt(count, 10) >= MAX_SUBSCRIPTIONS_PER_USER) {
    return c.json({ error: 'Too many subscriptions (max 10)' }, 400);
  }

  // Upsert — same endpoint updates keys
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${userId}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = ${keys.p256dh}, auth = ${keys.auth}
  `;

  return c.json({ subscribed: true }, 201);
});

// DELETE /notifications/subscribe
notifications.delete('/subscribe', async (c) => {
  const userId = c.get('userId') as string;
  const raw = await c.req.json();
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(raw);

  await sql`
    DELETE FROM push_subscriptions WHERE user_id = ${userId} AND endpoint = ${endpoint}
  `;

  return c.json({ unsubscribed: true });
});

// GET /notifications/vapid-key — public, no auth needed
// Note: This route is mounted BEFORE auth middleware in server/index.ts
notifications.get('/vapid-key', (c) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return c.json({ error: 'Push not configured' }, 503);
  return c.json({ publicKey: key });
});

// POST /notifications/test
notifications.post('/test', async (c) => {
  const userId = c.get('userId') as string;
  await sendPushToUser(userId, {
    title: 'reps',
    body: 'Push notifications are working!',
    url: '/',
    tag: 'test',
  });
  return c.json({ sent: true });
});

export default notifications;
```

**Step 2: Mount in `server/index.ts`**

Add import at line 27 (after `import learnAdmin`):

```typescript
import notifications from './routes/notifications.js';
```

Mount the VAPID key endpoint BEFORE auth middleware (after line 87, before line 90):

```typescript
// Push notification VAPID key — public endpoint
app.get('/notifications/vapid-key', notifications.routes[2].handler); // or extract handler
```

Actually, simpler approach — mount the whole route after auth middleware and add a separate unauthenticated route:

After line 84 (after calendar feed, before auth middleware):

```typescript
// VAPID public key — no auth needed
app.get('/notifications/vapid-key', (c) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return c.json({ error: 'Push not configured' }, 503);
  return c.json({ publicKey: key });
});
```

After line 113 (with other protected routes):

```typescript
app.route('/notifications', notifications);
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add server/routes/notifications.ts server/index.ts
git commit -m "feat: add push subscription and notification routes"
```

---

### Task 5: Server — task alert CRUD and cron

**Files:**

- Modify: `server/routes/tasks.ts` (add alert endpoints)
- Modify: `server/cron.ts`

**Step 1: Add alert routes to `server/routes/tasks.ts`**

Add these routes at the end of the file, before the `export default`:

```typescript
// --- Task Alerts ---

const createAlertSchema = z.object({
  alertAt: z.string().datetime(),
});

const MAX_ALERTS_PER_TASK = 20;

// POST /tasks/:id/alerts
tasks.post('/:id/alerts', async (c) => {
  const userId = c.get('userId') as string;
  const taskId = c.req.param('id');
  if (!validateUuid(taskId)) return c.json({ error: 'Invalid ID' }, 400);

  const raw = await c.req.json();
  const parsed = createAlertSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const alertAt = new Date(parsed.data.alertAt);
  const now = new Date();
  if (alertAt <= now) return c.json({ error: 'Alert time must be in the future' }, 400);

  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  if (alertAt > oneYearFromNow) return c.json({ error: 'Alert time must be within 1 year' }, 400);

  // Verify task belongs to user
  const [task] = await sql`SELECT id FROM tasks WHERE id = ${taskId} AND user_id = ${userId}`;
  if (!task) return c.json({ error: 'Task not found' }, 404);

  // Check alert limit
  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM task_alerts WHERE task_id = ${taskId} AND sent = false
  `;
  if (parseInt(count, 10) >= MAX_ALERTS_PER_TASK) {
    return c.json({ error: `Max ${MAX_ALERTS_PER_TASK} active alerts per task` }, 400);
  }

  const [alert] = await sql`
    INSERT INTO task_alerts (task_id, user_id, alert_at)
    VALUES (${taskId}, ${userId}, ${alertAt.toISOString()})
    RETURNING id, task_id, user_id, alert_at, sent, created_at
  `;

  return c.json(alert, 201);
});

// GET /tasks/:id/alerts
tasks.get('/:id/alerts', async (c) => {
  const userId = c.get('userId') as string;
  const taskId = c.req.param('id');
  if (!validateUuid(taskId)) return c.json({ error: 'Invalid ID' }, 400);

  const alerts = await sql`
    SELECT id, task_id, alert_at, sent, created_at
    FROM task_alerts
    WHERE task_id = ${taskId} AND user_id = ${userId}
    ORDER BY alert_at ASC
  `;

  return c.json(alerts);
});

// DELETE /tasks/:id/alerts/:alertId
tasks.delete('/:id/alerts/:alertId', async (c) => {
  const userId = c.get('userId') as string;
  const taskId = c.req.param('id');
  const alertId = c.req.param('alertId');
  if (!validateUuid(taskId) || !validateUuid(alertId)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const [deleted] = await sql`
    DELETE FROM task_alerts
    WHERE id = ${alertId} AND task_id = ${taskId} AND user_id = ${userId}
    RETURNING id
  `;

  if (!deleted) return c.json({ error: 'Alert not found' }, 404);
  return c.json({ deleted: true, id: alertId });
});
```

**Step 2: Add `checkTaskAlerts()` to `server/cron.ts`**

Add import at top:

```typescript
import { send } from './agent/notify.js';
```

Add this function before `startCronJobs()`:

```typescript
interface DueAlert {
  id: string;
  user_id: string;
  task_id: string;
  task_title: string;
}

async function checkTaskAlerts(): Promise<void> {
  const dueAlerts = await sql<DueAlert[]>`
    SELECT ta.id, ta.user_id, ta.task_id, t.title AS task_title
    FROM task_alerts ta
    JOIN tasks t ON t.id = ta.task_id
    WHERE ta.sent = false AND ta.alert_at <= NOW()
    LIMIT 100
  `;

  if (dueAlerts.length === 0) return;

  // Group by user to batch notifications
  const byUser = new Map<string, DueAlert[]>();
  for (const alert of dueAlerts) {
    const list = byUser.get(alert.user_id) ?? [];
    list.push(alert);
    byUser.set(alert.user_id, list);
  }

  for (const [userId, alerts] of byUser) {
    try {
      if (alerts.length === 1) {
        const a = alerts[0];
        await send(userId, 'reps — reminder', a.task_title, {
          url: `/tasks?highlight=${a.task_id}`,
          tag: 'task-alert',
          ttl: 3600,
        });
      } else {
        const titles = alerts.map((a) => a.task_title).join(', ');
        await send(userId, 'reps — reminders', `${alerts.length} tasks: ${titles}`, {
          url: '/tasks',
          tag: 'task-alert',
          ttl: 3600,
        });
      }
    } catch (err) {
      logger.error({ err, userId }, 'Failed to send task alerts');
    }
  }

  // Mark all as sent
  const alertIds = dueAlerts.map((a) => a.id);
  await sql`UPDATE task_alerts SET sent = true WHERE id = ANY(${alertIds})`;

  logger.info({ count: dueAlerts.length }, 'Task alerts processed');
}
```

Add cron schedule inside `startCronJobs()`, after the session cleanup block (after line 85):

```typescript
// Check task alerts every minute
cron.schedule('* * * * *', async () => {
  try {
    await checkTaskAlerts();
  } catch (err) {
    logger.error({ err }, 'Task alert check failed');
  }
});
```

Update the log message at the end to include the new cron.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add server/routes/tasks.ts server/cron.ts
git commit -m "feat: task alert CRUD endpoints and alert cron job"
```

---

### Task 6: Server — update user preferences

**Files:**

- Modify: `server/routes/users.ts` (lines 18-33, update schema)
- Modify: `server/auth/users.ts` (lines 89-115, update `updateUserProfile`)

**Step 1: Add new fields to `updateProfileSchema` in `server/routes/users.ts`**

Add after line 27 (`notifyWeekly: z.boolean().optional(),`):

```typescript
  notifyReviewDue: z.boolean().optional(),
  notifyStreak: z.boolean().optional(),
  notifyAiComplete: z.boolean().optional(),
  notifyTaskAlerts: z.boolean().optional(),
```

**Step 2: Add new fields to `updateUserProfile` in `server/auth/users.ts`**

Add to the `updates` parameter type (after `notifyWeekly`):

```typescript
    notifyReviewDue?: boolean;
    notifyStreak?: boolean;
    notifyAiComplete?: boolean;
    notifyTaskAlerts?: boolean;
```

Add to `fieldMap` (after `notifyWeekly: 'notify_weekly'`):

```typescript
    notifyReviewDue: 'notify_review_due',
    notifyStreak: 'notify_streak',
    notifyAiComplete: 'notify_ai_complete',
    notifyTaskAlerts: 'notify_task_alerts',
```

**Step 3: Add fields to `User` interface and `UserRow` interface and `rowToUser` in `server/auth/users.ts`**

In `User` interface (after `notifyWeekly`):

```typescript
notifyReviewDue: boolean;
notifyStreak: boolean;
notifyAiComplete: boolean;
notifyTaskAlerts: boolean;
```

In `UserRow` interface (after `notify_weekly`):

```typescript
notify_review_due: boolean;
notify_streak: boolean;
notify_ai_complete: boolean;
notify_task_alerts: boolean;
```

In `rowToUser` (after `notifyWeekly`):

```typescript
    notifyReviewDue: row.notify_review_due,
    notifyStreak: row.notify_streak,
    notifyAiComplete: row.notify_ai_complete,
    notifyTaskAlerts: row.notify_task_alerts,
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add server/routes/users.ts server/auth/users.ts
git commit -m "feat: add granular notification preference fields"
```

---

### Task 7: Frontend — service worker

**Files:**

- Create: `web/public/sw.js`

**Step 1: Create the service worker**

```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'reps', {
      body: data.body,
      icon: '/reps-192.png',
      badge: '/reps-72.png',
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    }),
  );
});
```

Note: Check if `reps-192.png` and `reps-72.png` exist in `web/public/`. If not, use whatever icon files exist or skip the icon/badge fields for now.

**Step 2: Commit**

```bash
git add web/public/sw.js
git commit -m "feat: add push notification service worker"
```

---

### Task 8: Frontend — push subscription manager

**Files:**

- Create: `web/src/lib/push.ts`

**Step 1: Create the push subscription manager**

```typescript
import { request } from '../api-client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getVapidKey(): Promise<string | null> {
  try {
    const { publicKey } = await request<{ publicKey: string }>('/notifications/vapid-key');
    return publicKey;
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const vapidKey = await getVapidKey();
  if (!vapidKey) return false;

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  const json = subscription.toJSON();
  await request('/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });

  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;

  await subscription.unsubscribe();

  try {
    await request('/notifications/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // Server cleanup is best-effort
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
```

**Step 2: Commit**

```bash
git add web/src/lib/push.ts
git commit -m "feat: add push subscription manager"
```

---

### Task 9: Frontend — update types and API functions

**Files:**

- Modify: `web/src/types.ts` (lines 236-255, User interface)
- Modify: `web/src/api.ts`

**Step 1: Add fields to `User` interface in `web/src/types.ts`**

After `notifyWeekly: boolean;` (line 246), add:

```typescript
notifyReviewDue: boolean;
notifyStreak: boolean;
notifyAiComplete: boolean;
notifyTaskAlerts: boolean;
```

Add new `TaskAlert` interface (after the `User` interface, around line 256):

```typescript
export interface TaskAlert {
  id: string;
  taskId: string;
  alertAt: string;
  sent: boolean;
  createdAt: string;
}
```

**Step 2: Add API functions in `web/src/api.ts`**

Add at the end of the file:

```typescript
// Notifications

export async function testPushNotification(): Promise<void> {
  await request<unknown>('/notifications/test', { method: 'POST' });
}

// Task Alerts

export async function getTaskAlerts(taskId: string): Promise<TaskAlert[]> {
  return request<TaskAlert[]>(`/tasks/${taskId}/alerts`);
}

export async function createTaskAlert(taskId: string, alertAt: string): Promise<TaskAlert> {
  return request<TaskAlert>(`/tasks/${taskId}/alerts`, {
    method: 'POST',
    body: JSON.stringify({ alertAt }),
  });
}

export async function deleteTaskAlert(taskId: string, alertId: string): Promise<void> {
  await request<unknown>(`/tasks/${taskId}/alerts/${alertId}`, { method: 'DELETE' });
}
```

Add `TaskAlert` to the type imports at the top.

**Step 3: Verify frontend TypeScript compiles**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors.

**Step 4: Commit**

```bash
git add web/src/types.ts web/src/api.ts
git commit -m "feat: add notification types and API functions"
```

---

### Task 10: Frontend — expanded NotificationSettings

**Files:**

- Modify: `web/src/components/settings/NotificationSettings.tsx`

**Step 1: Rewrite `NotificationSettings.tsx`**

Replace the full contents. The new version adds:

- Browser push enable/disable toggle with permission status
- Test notification button
- Granular notification type toggles

```tsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { User } from '../../types';
import { useAutoSave } from '../../hooks/useAutoSave';
import { testPushNotification } from '../../api';
import {
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
  isPushSupported,
  getPushPermission,
} from '../../lib/push';
import SaveIndicator from '../SaveIndicator';
import { SectionHeader, ToggleRow } from './shared';

interface Props {
  user: User;
  onProfileUpdate: (updates: Partial<User>) => Promise<void>;
}

export default function NotificationSettings({ user, onProfileUpdate }: Props) {
  const [notifyDaily, setNotifyDaily] = useState(user.notifyDaily);
  const [notifyWeekly, setNotifyWeekly] = useState(user.notifyWeekly);
  const [notifyReviewDue, setNotifyReviewDue] = useState(user.notifyReviewDue);
  const [notifyStreak, setNotifyStreak] = useState(user.notifyStreak);
  const [notifyAiComplete, setNotifyAiComplete] = useState(user.notifyAiComplete);
  const [notifyTaskAlerts, setNotifyTaskAlerts] = useState(user.notifyTaskAlerts);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(
    'default',
  );
  const [pushLoading, setPushLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    setPushPermission(getPushPermission());
    isPushSubscribed().then(setPushEnabled);
  }, []);

  const handlePushToggle = useCallback(async (enabled: boolean) => {
    setPushLoading(true);
    try {
      if (enabled) {
        const success = await subscribeToPush();
        setPushEnabled(success);
        setPushPermission(getPushPermission());
      } else {
        await unsubscribeFromPush();
        setPushEnabled(false);
      }
    } finally {
      setPushLoading(false);
    }
  }, []);

  const handleTestPush = useCallback(async () => {
    setTestSending(true);
    try {
      await testPushNotification();
    } finally {
      setTestSending(false);
    }
  }, []);

  const autoSaveValues = useMemo(
    () => ({
      notifyDaily,
      notifyWeekly,
      notifyReviewDue,
      notifyStreak,
      notifyAiComplete,
      notifyTaskAlerts,
    }),
    [notifyDaily, notifyWeekly, notifyReviewDue, notifyStreak, notifyAiComplete, notifyTaskAlerts],
  );

  const handleAutoSave = useCallback(
    async (values: typeof autoSaveValues) => {
      await onProfileUpdate(values);
    },
    [onProfileUpdate],
  );

  const { status, error } = useAutoSave({
    values: autoSaveValues,
    onSave: handleAutoSave,
    delay: 800,
  });

  const supported = isPushSupported();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader icon="bell" title="Notifications" />
        <SaveIndicator status={status} error={error} />
      </div>

      {/* Browser Push */}
      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Browser Push</h3>
        {!supported ? (
          <p className="text-sm text-zinc-500">
            Push notifications are not supported in this browser.
          </p>
        ) : pushPermission === 'denied' ? (
          <p className="text-sm text-red-400">
            Notifications blocked. Enable them in your browser settings.
          </p>
        ) : (
          <>
            <ToggleRow
              label="Enable push notifications"
              description="Receive alerts even when this tab is closed"
              checked={pushEnabled}
              onChange={handlePushToggle}
              disabled={pushLoading}
            />
            {pushEnabled && (
              <button
                onClick={handleTestPush}
                disabled={testSending}
                className="text-sm text-blue-400 hover:text-blue-300 disabled:text-zinc-600"
              >
                {testSending ? 'Sending...' : 'Send test notification'}
              </button>
            )}
          </>
        )}
      </div>

      {/* What to notify */}
      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">What to notify</h3>
        <ToggleRow
          label="Daily briefing"
          description="Morning coaching message with your due reviews"
          checked={notifyDaily}
          onChange={setNotifyDaily}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="Weekly insight"
          description="Weekly analysis of your weakest topic"
          checked={notifyWeekly}
          onChange={setNotifyWeekly}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="Reviews due"
          description="Alert when tasks are due for review"
          checked={notifyReviewDue}
          onChange={setNotifyReviewDue}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="Streak milestones"
          description="Celebrate when you hit review streaks"
          checked={notifyStreak}
          onChange={setNotifyStreak}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="AI evaluation complete"
          description="Notify when AI finishes scoring your answer"
          checked={notifyAiComplete}
          onChange={setNotifyAiComplete}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="Task alerts"
          description="Custom reminders you set on individual tasks"
          checked={notifyTaskAlerts}
          onChange={setNotifyTaskAlerts}
        />
      </div>
    </div>
  );
}
```

**Step 2: Check if `ToggleRow` supports `disabled` prop**

Read `web/src/components/settings/shared.tsx` and check the `ToggleRow` interface. If it doesn't accept `disabled`, add it.

**Step 3: Verify frontend TypeScript compiles**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors.

**Step 4: Commit**

```bash
git add web/src/components/settings/NotificationSettings.tsx
git commit -m "feat: expanded notification settings with push toggle and granular prefs"
```

---

### Task 11: Frontend — task alerts in TaskEditModal

**Files:**

- Modify: `web/src/components/TaskEditModal.tsx`

**Step 1: Read `TaskEditModal.tsx` fully to understand structure**

Identify the exact insertion point for the alerts section (after notes, before SM-2 info).

**Step 2: Add alerts section**

Add state and effects for loading/creating/deleting alerts:

```typescript
const [alerts, setAlerts] = useState<TaskAlert[]>([]);
const [alertDate, setAlertDate] = useState('');
const [alertTime, setAlertTime] = useState('');
const [alertLoading, setAlertLoading] = useState(false);

useEffect(() => {
  if (task?.id) {
    getTaskAlerts(task.id)
      .then(setAlerts)
      .catch(() => {});
  }
}, [task?.id]);

const handleAddAlert = async () => {
  if (!task || !alertDate || !alertTime) return;
  setAlertLoading(true);
  try {
    const alertAt = new Date(`${alertDate}T${alertTime}`).toISOString();
    const alert = await createTaskAlert(task.id, alertAt);
    setAlerts((prev) => [...prev, alert].sort((a, b) => a.alertAt.localeCompare(b.alertAt)));
    setAlertDate('');
    setAlertTime('');
  } finally {
    setAlertLoading(false);
  }
};

const handleDeleteAlert = async (alertId: string) => {
  if (!task) return;
  await deleteTaskAlert(task.id, alertId);
  setAlerts((prev) => prev.filter((a) => a.id !== alertId));
};
```

Add this JSX block in the appropriate location inside the modal body:

```tsx
{
  /* Task Alerts */
}
<div className="space-y-2">
  <label className="text-sm font-medium text-zinc-400">Reminders</label>
  {alerts
    .filter((a) => !a.sent)
    .map((alert) => (
      <div
        key={alert.id}
        className="flex items-center justify-between text-sm bg-zinc-800/50 rounded px-3 py-2"
      >
        <span className="text-zinc-300">{new Date(alert.alertAt).toLocaleString()}</span>
        <button
          onClick={() => handleDeleteAlert(alert.id)}
          className="text-zinc-500 hover:text-red-400"
        >
          Remove
        </button>
      </div>
    ))}
  <div className="flex gap-2">
    <input
      type="date"
      value={alertDate}
      onChange={(e) => setAlertDate(e.target.value)}
      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
    />
    <input
      type="time"
      value={alertTime}
      onChange={(e) => setAlertTime(e.target.value)}
      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
    />
    <button
      onClick={handleAddAlert}
      disabled={!alertDate || !alertTime || alertLoading}
      className="text-sm text-blue-400 hover:text-blue-300 disabled:text-zinc-600"
    >
      Add
    </button>
  </div>
</div>;
```

**Step 3: Add imports**

Add to the imports:

```typescript
import type { TaskAlert } from '../types';
import { getTaskAlerts, createTaskAlert, deleteTaskAlert } from '../api';
```

**Step 4: Verify frontend TypeScript compiles**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors.

**Step 5: Commit**

```bash
git add web/src/components/TaskEditModal.tsx
git commit -m "feat: add task alert management to task edit modal"
```

---

### Task 12: Integration — wire up review-due and AI-complete notifications

**Files:**

- Modify: `server/cron.ts` (add review-due notifications to daily briefing cron)
- Modify: `server/routes/agent.ts` (send notification after AI evaluation)

**Step 1: Add review-due push to daily briefing cron**

In the daily briefing cron handler (after line 46 in `server/cron.ts`), add:

```typescript
// Send review-due push notification if user has it enabled
// (daily briefing already covers the content, but this is the push channel)
```

Actually, the daily briefing already sends via `notify.ts` which now pushes to all channels. The review-due notification should be a separate lightweight push for users who want it but not the full AI briefing. Add a new block inside the 8 AM cron:

```typescript
// Review-due push notifications (separate from AI briefing)
const reviewDueUsers = await sql<{ id: string }[]>`
      SELECT DISTINCT u.id FROM users u
      JOIN tasks t ON t.user_id = u.id
      WHERE u.notify_review_due = true AND u.email_verified = true
        AND t.next_review <= CURRENT_DATE AND t.completed = false
    `;
for (const user of reviewDueUsers) {
  try {
    const [{ count }] = await sql<[{ count: string }]>`
          SELECT COUNT(*)::text AS count FROM tasks
          WHERE user_id = ${user.id} AND next_review <= CURRENT_DATE AND completed = false
        `;
    const n = parseInt(count, 10);
    if (n > 0) {
      await send(
        user.id,
        'reps — reviews due',
        `You have ${n} task${n === 1 ? '' : 's'} due for review`,
        {
          url: '/tasks?filter=due',
          tag: 'review-due',
          ttl: 14400,
        },
      );
    }
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Review-due notification failed');
  }
}
```

**Step 2: Add AI-complete push in `server/routes/agent.ts`**

Find the `POST /agent/evaluate` handler. After the evaluation succeeds and is saved, add:

```typescript
import { send } from '../agent/notify.js';

// After saving evaluation result:
// Check if user wants AI completion notifications
const [userPrefs] = await sql<[{ notify_ai_complete: boolean }]>`
  SELECT notify_ai_complete FROM users WHERE id = ${userId}
`;
if (userPrefs?.notify_ai_complete) {
  await send(userId, 'reps — evaluation ready', `Your answer for "${task.title}" has been scored`, {
    url: `/tasks?highlight=${taskId}`,
    tag: 'ai-complete',
    ttl: 3600,
  });
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add server/cron.ts server/routes/agent.ts
git commit -m "feat: wire up review-due and AI-complete push notifications"
```

---

### Task 13: Pre-push checks and final verification

**Step 1: Run all pre-push checks**

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npx tsc --noEmit --project web/tsconfig.json
```

Fix any issues found.

**Step 2: Run the dev server and test manually**

```bash
npm run dev:server &
npm run dev:web &
```

1. Open browser, go to Settings > Notifications
2. Enable push — should see permission prompt
3. Grant permission — toggle should stay on
4. Click "Send test notification" — should receive browser notification
5. Open a task, add a reminder for 1 minute from now — should receive alert
6. Disable push — unsubscribe should work

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint and type errors from notification feature"
```

---

### Task 14: Deploy

**Step 1: Add VAPID env vars to production server**

```bash
ssh hetzner "cd /var/www/reps && npx web-push generate-vapid-keys"
```

Add the output to `/var/www/reps/.env`:

```
VAPID_PUBLIC_KEY=<key>
VAPID_PRIVATE_KEY=<key>
VAPID_EMAIL=mailto:chris@reps.sh
```

**Step 2: Deploy**

```bash
ssh hetzner "cd /var/www/reps && bash deploy/deploy.sh"
```

This runs the migration, builds server + web, and restarts pm2.

**Step 3: Verify in production**

1. Visit https://reps.sh/settings
2. Enable push notifications
3. Send test notification
4. Verify it arrives
