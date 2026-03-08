import cron from 'node-cron';
import sql from './db/client.js';
import { dailyBriefing, weeklyInsight } from './agent/coach.js';
import { sendDailyDigest } from './agent/email.js';
import { cleanExpiredSessions } from './auth/sessions.js';
import { cleanExpiredDeviceCodes } from './auth/device-flow.js';
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

export function startCronJobs(): void {
  // Daily briefing + email digest at 8:00 AM every day
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running daily briefings');
    try {
      const serverKey = process.env.ANTHROPIC_API_KEY;
      const credentials: AiCredentials | undefined = serverKey
        ? { provider: 'anthropic', apiKey: serverKey }
        : undefined;
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
    } catch (err) {
      logger.error({ err }, 'Daily briefing batch failed');
    }
  });

  // Weekly insight at 8:00 PM every Sunday
  cron.schedule('0 20 * * 0', async () => {
    logger.info('Running weekly insights');
    try {
      const serverKey = process.env.ANTHROPIC_API_KEY;
      const credentials: AiCredentials | undefined = serverKey
        ? { provider: 'anthropic', apiKey: serverKey }
        : undefined;
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
      logger.info({ sessionCount, deviceCount }, 'Cleaned expired sessions and device codes');
    } catch (err) {
      logger.error({ err }, 'Session cleanup failed');
    }
  });

  logger.info(
    'Scheduled: daily briefing + digest (8:00 AM), weekly insight (Sun 8:00 PM), session cleanup (3:00 AM)',
  );
}
