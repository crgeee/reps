import { logger } from '../logger.js';
import { sendPushToUser } from '../push/send.js';

const PUSHOVER_API = 'https://api.pushover.net/1/messages.json';

interface SendOptions {
  url?: string;
  tag?: string;
  ttl?: number;
}

async function sendPushover(title: string, message: string): Promise<void> {
  const userKey = process.env.PUSHOVER_USER_KEY;
  const apiToken = process.env.PUSHOVER_API_TOKEN;

  if (!userKey || !apiToken) {
    logger.info({ title, message }, 'Notification fallback (no Pushover configured)');
    return;
  }

  try {
    const res = await fetch(PUSHOVER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: apiToken,
        user: userKey,
        title,
        message,
      }),
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
  options?: SendOptions,
): Promise<void> {
  const results = await Promise.allSettled([
    sendPushToUser(
      userId,
      {
        title,
        body: message,
        url: options?.url,
        tag: options?.tag,
      },
      { ttl: options?.ttl },
    ),
    sendPushover(title, message),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error({ err: result.reason }, 'Notification channel failed');
    }
  }

  logger.info({ userId, title }, 'Notification sent');
}
