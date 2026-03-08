import cron from 'node-cron';
import sql from './db/client.js';
import { dailyBriefing, weeklyInsight } from './agent/coach.js';
import { sendDailyDigest } from './agent/email.js';
import { cleanExpiredSessions } from './auth/sessions.js';
import { cleanExpiredDeviceCodes } from './auth/device-flow.js';
import { cleanExpiredAiKeys } from './auth/ai-keys.js';
import { send } from './agent/notify.js';
import { logger } from './logger.js';
import type { AiCredentials } from './agent/provider.js';

interface NotifiableUser {
  id: string;
  email: string;
  notify_daily: boolean;
  notify_weekly: boolean;
}

async function getNotifiableUsers(
  field: 'notify_daily' | 'notify_weekly',
): Promise<NotifiableUser[]> {
  return sql<NotifiableUser[]>`
    SELECT id, email, notify_daily, notify_weekly FROM users
    WHERE ${sql(field)} = true AND email_verified = true
  `;
}

function getServerCredentials(): AiCredentials | undefined {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? { provider: 'anthropic', apiKey: key } : undefined;
}

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
        await send(userId, 'reps — reminder', alerts[0].task_title, {
          url: `/tasks?highlight=${alerts[0].task_id}`,
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

  const alertIds = dueAlerts.map((a) => a.id);
  await sql`UPDATE task_alerts SET sent = true WHERE id = ANY(${alertIds})`;
  logger.info({ count: dueAlerts.length }, 'Task alerts processed');
}

export function startCronJobs(): void {
  // Daily briefing + email digest at 8:00 AM every day
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running daily briefings');
    try {
      const credentials = getServerCredentials();
      const users = await getNotifiableUsers('notify_daily');
      for (const user of users) {
        try {
          await dailyBriefing(user.id, credentials);
          await sendDailyDigest(user.id, user.email);
        } catch (err) {
          logger.error({ err, userId: user.id }, 'Daily briefing failed for user');
        }
      }
      logger.info({ count: users.length }, 'Daily briefings complete');

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
    } catch (err) {
      logger.error({ err }, 'Daily briefing batch failed');
    }
  });

  // Weekly insight at 8:00 PM every Sunday
  cron.schedule('0 20 * * 0', async () => {
    logger.info('Running weekly insights');
    try {
      const credentials = getServerCredentials();
      const users = await getNotifiableUsers('notify_weekly');
      for (const user of users) {
        try {
          await weeklyInsight(user.id, credentials);
        } catch (err) {
          logger.error({ err, userId: user.id }, 'Weekly insight failed for user');
        }
      }
      logger.info({ count: users.length }, 'Weekly insights complete');
    } catch (err) {
      logger.error({ err }, 'Weekly insight batch failed');
    }
  });

  // Session + device code cleanup at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      const sessionCount = await cleanExpiredSessions();
      const deviceCount = await cleanExpiredDeviceCodes();
      const aiKeyCount = await cleanExpiredAiKeys();
      logger.info(
        { sessionCount, deviceCount, aiKeyCount },
        'Cleaned expired sessions, device codes, and AI keys',
      );
    } catch (err) {
      logger.error({ err }, 'Cleanup failed');
    }
  });

  // Check task alerts every minute
  cron.schedule('* * * * *', async () => {
    try {
      await checkTaskAlerts();
    } catch (err) {
      logger.error({ err }, 'Task alert check failed');
    }
  });

  logger.info(
    'Scheduled: daily briefing + digest (8:00 AM), weekly insight (Sun 8:00 PM), session cleanup (3:00 AM), task alerts (every min)',
  );
}
