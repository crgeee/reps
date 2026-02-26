import cron from 'node-cron';
import sql from './db/client.js';
import { dailyBriefing, weeklyInsight } from './agent/coach.js';
import { sendDailyDigest } from './agent/email.js';
import { cleanExpiredSessions } from './auth/sessions.js';
import { cleanExpiredDeviceCodes } from './auth/device-flow.js';

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
    console.log('[cron] Running daily briefings...');
    try {
      const users = await getNotifiableUsers('notify_daily');
      for (const user of users) {
        try {
          await dailyBriefing(user.id);
          await sendDailyDigest(user.id, user.email);
        } catch (err) {
          console.error(`[cron] Daily briefing failed for user ${user.id}:`, err);
        }
      }
      console.log(`[cron] Daily briefings complete for ${users.length} user(s).`);
    } catch (err) {
      console.error('[cron] Daily briefing batch failed:', err);
    }
  });

  // Weekly insight at 8:00 PM every Sunday
  cron.schedule('0 20 * * 0', async () => {
    console.log('[cron] Running weekly insights...');
    try {
      const users = await getNotifiableUsers('notify_weekly');
      for (const user of users) {
        try {
          await weeklyInsight(user.id);
        } catch (err) {
          console.error(`[cron] Weekly insight failed for user ${user.id}:`, err);
        }
      }
      console.log(`[cron] Weekly insights complete for ${users.length} user(s).`);
    } catch (err) {
      console.error('[cron] Weekly insight batch failed:', err);
    }
  });

  // Session + device code cleanup at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      const sessionCount = await cleanExpiredSessions();
      const deviceCount = await cleanExpiredDeviceCodes();
      console.log(
        `[cron] Cleaned ${sessionCount} expired sessions, ${deviceCount} expired device codes.`,
      );
    } catch (err) {
      console.error('[cron] Session cleanup failed:', err);
    }
  });

  console.log(
    '[cron] Scheduled: daily briefing + digest (8:00 AM), weekly insight (Sun 8:00 PM), session cleanup (3:00 AM)',
  );
}
