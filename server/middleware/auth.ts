import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { validateSession } from "../auth/sessions.js";

const LEGACY_USER_ID = process.env.LEGACY_USER_ID;

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // 1. Check session cookie
  const sessionCookie = getCookie(c, "reps_session");
  if (sessionCookie) {
    const session = await validateSession(sessionCookie);
    if (session) {
      c.set("userId", session.userId);
      return next();
    }
  }

  // 2. Check Bearer token (session token or legacy API key)
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);

    // Try session token first (64 hex chars)
    if (/^[0-9a-f]{64}$/i.test(token)) {
      const session = await validateSession(token);
      if (session) {
        c.set("userId", session.userId);
        return next();
      }
    }

    // 3. Fall back to legacy API_KEY
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      const tokenBuf = Buffer.from(token);
      const keyBuf = Buffer.from(apiKey);

      if (tokenBuf.length === keyBuf.length && timingSafeEqual(tokenBuf, keyBuf)) {
        if (LEGACY_USER_ID) {
          c.set("userId", LEGACY_USER_ID);
        }
        return next();
      }
    }
  }

  return c.json({ error: "Not authenticated" }, 401);
};
