import type { MiddlewareHandler } from 'hono';

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 300_000).unref();

function isRateLimited(key: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { timestamps: [now] });
    return false;
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  if (entry.timestamps.length >= maxRequests) return true;

  entry.timestamps.push(now);
  return false;
}

export function rateLimiter(maxRequests: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const key = c.req.header('Authorization') ?? c.req.header('x-forwarded-for') ?? 'global';
    const prefix = `${maxRequests}:${windowMs}:`;

    if (isRateLimited(prefix + key, windowMs, maxRequests)) {
      return c.json({ error: 'Too many requests' }, 429);
    }

    await next();
  };
}
