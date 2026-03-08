# Browser Notifications Design

**Date:** 2026-03-08
**Approach:** Web Push API + `web-push` library with in-tab fallback

## Overview

Add browser push notifications to reps so users get alerts even when the tab is closed. Uses the Web Push API with VAPID keys, delivered via the `web-push` npm package. All notification types are user-configurable in Settings > Notifications.

## Notification Types

| Type                   | Trigger                                              | Default |
| ---------------------- | ---------------------------------------------------- | ------- |
| Daily briefing         | 8 AM cron (existing)                                 | on      |
| Weekly insight         | Sunday 8 PM cron (existing)                          | on      |
| Reviews due            | 8 AM cron — tasks where `next_review <= today`       | on      |
| Streak milestones      | After review submission, when streak hits milestones | on      |
| AI evaluation complete | After `/agent/evaluate` returns                      | on      |
| Task alerts            | User-set date/time per task                          | on      |

## Database

### New table: `push_subscriptions`

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```

### New table: `task_alerts`

```sql
CREATE TABLE IF NOT EXISTS task_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_at    TIMESTAMPTZ NOT NULL,
  sent        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_task_alerts_pending ON task_alerts(sent, alert_at) WHERE sent = false;
```

### New columns on `users`

```sql
ALTER TABLE users ADD COLUMN notify_review_due  BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN notify_streak      BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN notify_ai_complete BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN notify_task_alerts BOOLEAN DEFAULT true;
```

## Environment Variables

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:you@reps.sh
```

Generate once with `web-push generate-vapid-keys`.

## Server

### New routes: `server/routes/notifications.ts`

```
POST   /notifications/subscribe     — save push subscription {endpoint, keys}
DELETE /notifications/subscribe     — remove subscription by endpoint
GET    /notifications/vapid-key     — return public VAPID key (unauthenticated)
POST   /notifications/test          — send test push to current user

POST   /tasks/:id/alerts            — create alert {alertAt: ISO string}
GET    /tasks/:id/alerts            — list alerts for a task
DELETE /tasks/:id/alerts/:alertId   — remove an alert
```

### Updated `server/agent/notify.ts`

New signature:

```typescript
export async function send(
  userId: string,
  title: string,
  message: string,
  options?: {
    url?: string;
    tag?: string;
  },
): Promise<void>;
```

Delivery logic:

1. Look up `push_subscriptions` for `userId`
2. Send via `web-push` with `Promise.allSettled()`
3. Delete subscriptions that return 404/410
4. Send via Pushover in parallel (if configured)

### New cron: `checkTaskAlerts()`

- Schedule: `* * * * *` (every minute)
- Query: `task_alerts WHERE sent = false AND alert_at <= NOW()`
- Group by `user_id`, send summary if multiple alerts due simultaneously
- Mark `sent = true` after delivery

### Performance

- Composite index `(sent, alert_at)` with partial index `WHERE sent = false` keeps alert query fast
- Index on `push_subscriptions.user_id` for subscription lookup
- Batch sends grouped by user to avoid notification spam
- `Promise.allSettled()` for parallel delivery, one stale subscription doesn't block others
- TTL: 1 hour for task alerts, 4 hours for briefings

### Security

- Zod validation on subscription shape: endpoint must be `https://`
- Allowlist push service domains: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`, `web.push.apple.com`
- Max 10 subscriptions per user
- Task alerts: `alertAt` must be in future and within 1 year, max 20 active alerts per task
- Users can only delete their own subscriptions
- VAPID private key stays server-side only
- `/notifications/vapid-key` is the only unauthenticated notification endpoint

## Frontend

### Service Worker: `web/public/sw.js`

```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'reps', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
```

### Push subscription manager: `web/src/lib/push.ts`

```typescript
export async function subscribeToPush(): Promise<boolean>;
export async function unsubscribeFromPush(): Promise<void>;
export async function isPushSubscribed(): Promise<boolean>;
```

- Registers service worker on first call
- Converts VAPID public key to `Uint8Array` for `applicationServerKey`
- `userVisibleOnly: true`
- POSTs subscription to `/notifications/subscribe`
- Unsubscribe calls `pushSubscription.unsubscribe()` + `DELETE /notifications/subscribe`

### Updated `NotificationSettings.tsx`

```
Notifications
+-- Browser Push
|   +-- Enable/disable toggle (triggers permission prompt + subscribe/unsubscribe)
|   +-- "Test notification" button
|   +-- Status indicator (granted / denied / not supported)
+-- What to notify
    +-- Daily briefing          (existing notifyDaily)
    +-- Weekly insight          (existing notifyWeekly)
    +-- Reviews due             (new notify_review_due)
    +-- Streak milestones       (new notify_streak)
    +-- AI evaluation complete  (new notify_ai_complete)
    +-- Task alerts             (new notify_task_alerts)
```

### Task alerts UX

- Task edit modal gets an "Alerts" section
- "Add reminder" button with date/time picker
- List existing alerts with delete button
- Max 20 per task (server-enforced)

## Dependencies

- `web-push` (npm) — server-side push delivery
- No new frontend dependencies

## Files touched

| File                                                   | Change                             |
| ------------------------------------------------------ | ---------------------------------- |
| `db/`                                                  | New migration for tables + columns |
| `server/agent/notify.ts`                               | Multi-channel, user-aware send     |
| `server/routes/notifications.ts`                       | New file                           |
| `server/routes/tasks.ts`                               | Add alert CRUD endpoints           |
| `server/cron.ts`                                       | Add `checkTaskAlerts()`            |
| `server/index.ts`                                      | Mount notification routes          |
| `web/public/sw.js`                                     | New file                           |
| `web/src/lib/push.ts`                                  | New file                           |
| `web/src/components/settings/NotificationSettings.tsx` | Expand UI                          |
| `web/src/components/TaskEditModal.tsx`                 | Add alerts section                 |
| `web/src/api.ts` or `web/src/api-client.ts`            | Add notification API functions     |
| `web/src/types.ts`                                     | Add alert + subscription types     |
| `.env.example`                                         | Add VAPID vars                     |
