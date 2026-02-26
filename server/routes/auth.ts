import { Hono } from 'hono';
import { z } from 'zod';
import { sendMagicLink, verifyMagicLink } from '../auth/magic-link.js';
import { deleteSessionByToken } from '../auth/sessions.js';
import {
  initiateDeviceAuth,
  pollDeviceAuth,
  approveDeviceAuth,
  denyDeviceAuth,
} from '../auth/device-flow.js';
import { getUserById } from '../auth/users.js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { authMiddleware } from '../middleware/auth.js';

type AppEnv = { Variables: { userId: string } };
const auth = new Hono<AppEnv>();

const SESSION_COOKIE = 'reps_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const emailSchema = z.object({
  email: z.string().email().max(320),
});

const devicePollSchema = z.object({
  deviceCode: z.string().min(1),
});

const userCodeSchema = z.object({
  userCode: z.string().min(1).max(20),
});

// --- Public routes (no auth required) ---

// POST /auth/magic-link — always returns 200 (enumeration protection)
auth.post('/magic-link', async (c) => {
  const raw = await c.req.json();
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Invalid email' }, 400);
  }

  try {
    await sendMagicLink(parsed.data.email);
  } catch (err) {
    console.error('[auth] sendMagicLink error:', err);
  }

  return c.json({ message: 'If an account exists, a magic link has been sent.' });
});

// GET /auth/verify?token=xxx — validates, creates session, sets cookie, redirects
auth.get('/verify', async (c) => {
  const token = c.req.query('token');
  if (!token) {
    return c.json({ error: 'Missing token' }, 400);
  }

  const userAgent = c.req.header('User-Agent');
  const ipAddress = c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP');

  const result = await verifyMagicLink(token, userAgent, ipAddress ?? undefined);
  if (!result) {
    const appUrl = process.env.APP_URL ?? 'https://reps-prep.duckdns.org';
    return c.redirect(`${appUrl}/#login?error=invalid`);
  }

  setCookie(c, SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  const appUrl = process.env.APP_URL ?? 'https://reps-prep.duckdns.org';
  return c.redirect(`${appUrl}/`);
});

// POST /auth/device/initiate — CLI starts device auth flow
auth.post('/device/initiate', async (c) => {
  const result = await initiateDeviceAuth();
  return c.json(result);
});

// POST /auth/device/poll — CLI polls for approval
auth.post('/device/poll', async (c) => {
  const raw = await c.req.json();
  const parsed = devicePollSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Invalid device code' }, 400);
  }

  const result = await pollDeviceAuth(parsed.data.deviceCode);
  return c.json(result);
});

// POST /auth/logout — clears cookie, deletes session
auth.post('/logout', async (c) => {
  const sessionToken = getCookie(c, SESSION_COOKIE);
  if (sessionToken) {
    await deleteSessionByToken(sessionToken);
  }

  // Also check Bearer token
  const header = c.req.header('Authorization');
  if (header?.startsWith('Bearer ')) {
    const bearerToken = header.slice(7);
    // Only delete if it looks like a session token (64 hex chars), not a legacy API key
    if (/^[0-9a-f]{64}$/i.test(bearerToken)) {
      await deleteSessionByToken(bearerToken);
    }
  }

  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ message: 'Logged out' });
});

// --- Protected routes (auth required) ---
// These routes are mounted before the global auth middleware,
// so we apply it explicitly here.

// GET /auth/me — current user profile
auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await getUserById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json(user);
});

// POST /auth/device/approve — user approves CLI device code
auth.post('/device/approve', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const raw = await c.req.json();
  const parsed = userCodeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Invalid user code' }, 400);
  }

  const ipAddress = c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP');
  const success = await approveDeviceAuth(
    parsed.data.userCode,
    userId,
    undefined,
    ipAddress ?? undefined,
  );

  if (!success) {
    return c.json({ error: 'Invalid or expired code' }, 400);
  }

  return c.json({ message: 'Device approved' });
});

// POST /auth/device/deny — user denies CLI device code
auth.post('/device/deny', authMiddleware, async (c) => {
  const raw = await c.req.json();
  const parsed = userCodeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Invalid user code' }, 400);
  }

  const success = await denyDeviceAuth(parsed.data.userCode);
  if (!success) {
    return c.json({ error: 'Invalid or expired code' }, 400);
  }

  return c.json({ message: 'Device denied' });
});

export default auth;
