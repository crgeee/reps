import { createMiddleware } from 'hono/factory';
import { logger as rootLogger } from '../logger.js';

type Env = { Variables: { logger: typeof rootLogger; reqId: string } };

export const requestLogger = createMiddleware<Env>(async (c, next) => {
  const reqId = crypto.randomUUID();
  const start = Date.now();

  const childLogger = rootLogger.child({
    reqId,
    method: c.req.method,
    path: c.req.path,
  });

  c.set('logger', childLogger);
  c.set('reqId', reqId);
  c.header('X-Request-Id', reqId);

  try {
    await next();
  } finally {
    const latency = Date.now() - start;
    const status = c.res.status;
    const logData = { status, latency };

    if (status >= 500) {
      childLogger.error(logData, 'request completed');
    } else if (status >= 400) {
      childLogger.warn(logData, 'request completed');
    } else {
      childLogger.info(logData, 'request completed');
    }
  }
});
