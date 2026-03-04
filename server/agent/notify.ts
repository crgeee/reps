import { logger } from '../logger.js';

const PUSHOVER_API = 'https://api.pushover.net/1/messages.json';

export async function send(title: string, message: string): Promise<void> {
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
