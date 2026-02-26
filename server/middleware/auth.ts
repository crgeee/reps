import type { MiddlewareHandler } from "hono";
import { getCookie, deleteCookie } from "hono/cookie";
import { validateSession, deleteSession } from "../auth/sessions.js";
import { getUserById } from "../auth/users.js";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  let sessionId: string | undefined;
  let userId: string | undefined;

  // 1. Check session cookie
  const sessionCookie = getCookie(c, "reps_session");
  if (sessionCookie) {
    const session = await validateSession(sessionCookie);
    if (session) {
      sessionId = session.id;
      userId = session.userId;
    }
  }

  // 2. Check Bearer token (session token from CLI device auth)
  if (!userId) {
    const header = c.req.header("Authorization");
    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7);
      const session = await validateSession(token);
      if (session) {
        sessionId = session.id;
        userId = session.userId;
      }
    }
  }

  if (!userId || !sessionId) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  // 3. Check if user is blocked
  const user = await getUserById(userId);
  if (user?.isBlocked) {
    await deleteSession(sessionId);
    deleteCookie(c, "reps_session");
    return c.json({ error: "Account blocked" }, 403);
  }

  c.set("userId", userId);
  return next();
};
