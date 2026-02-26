import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error("FATAL: API_KEY environment variable is not set");
    return c.json({ error: "Internal server error" }, 500);
  }

  const header = c.req.header("Authorization");

  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const token = header.slice(7);
  const tokenBuf = Buffer.from(token);
  const keyBuf = Buffer.from(apiKey);

  if (tokenBuf.length !== keyBuf.length || !timingSafeEqual(tokenBuf, keyBuf)) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  await next();
};
