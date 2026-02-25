import type { MiddlewareHandler } from "hono";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return c.json({ error: "Server misconfigured: API_KEY not set" }, 500);
  }

  const header = c.req.header("Authorization");

  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const token = header.slice(7);

  if (token !== apiKey) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  await next();
};
