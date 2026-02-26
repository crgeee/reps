import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { validateSession } from "../auth/sessions.js";

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

  // 2. Check Bearer token (session token from CLI device auth)
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    const session = await validateSession(token);
    if (session) {
      c.set("userId", session.userId);
      return next();
    }
  }

  return c.json({ error: "Not authenticated" }, 401);
};
