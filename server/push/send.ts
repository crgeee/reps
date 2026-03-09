import webpush from 'web-push';
import sql from '../db/client.js';
import { logger } from '../logger.js';

const KNOWN_PUSH_DOMAINS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'notify.windows.com',
  'web.push.apple.com',
];

let vapidInitialized = false;

function ensureVapidInitialized(): boolean {
  if (vapidInitialized) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;

  if (!publicKey || !privateKey || !email) {
    logger.debug('VAPID env vars not set — web-push disabled');
    return false;
  }

  webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
  vapidInitialized = true;
  return true;
}

export function isValidPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;

    return KNOWN_PUSH_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushOptions {
  ttl?: number;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  options?: PushOptions,
): Promise<void> {
  if (!ensureVapidInitialized()) {
    logger.debug({ userId }, 'Skipping web-push — VAPID not configured');
    return;
  }

  const subscriptions = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
    SELECT id, endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = ${userId}
  `;

  if (subscriptions.length === 0) {
    logger.debug({ userId }, 'No push subscriptions found for user');
    return;
  }

  const ttl = options?.ttl ?? 3600;
  const payloadString = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadString,
        { TTL: ttl },
      ),
    ),
  );

  const expiredIds: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number };
      const statusCode = err.statusCode;

      if (statusCode === 404 || statusCode === 410) {
        expiredIds.push(subscriptions[i].id);
        logger.info(
          { subscriptionId: subscriptions[i].id, statusCode },
          'Removing expired push subscription',
        );
      } else {
        logger.error(
          { subscriptionId: subscriptions[i].id, err: result.reason },
          'Failed to send web-push notification',
        );
      }
    }
  }

  if (expiredIds.length > 0) {
    try {
      await sql`DELETE FROM push_subscriptions WHERE id = ANY(${expiredIds})`;
    } catch (err) {
      logger.error({ err, expiredIds }, 'Failed to delete expired push subscriptions');
    }
  }
}
