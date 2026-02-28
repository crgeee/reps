import { createHash } from 'crypto';
import type { MiddlewareHandler } from 'hono';

export const etag: MiddlewareHandler = async (c, next) => {
  await next();

  if (c.req.method !== 'GET' || c.res.status !== 200) return;

  const body = await c.res.text();
  const hash = `"${createHash('md5').update(body).digest('hex')}"`;

  const ifNoneMatch = c.req.header('If-None-Match');
  if (ifNoneMatch === hash) {
    c.res = new Response(null, { status: 304, headers: { ETag: hash } });
    return;
  }

  c.res = new Response(body, c.res);
  c.res.headers.set('ETag', hash);
  c.res.headers.set('Cache-Control', 'no-cache');
};
