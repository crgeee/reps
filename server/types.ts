import type { Logger } from 'pino';

export type AppEnv = {
  Variables: {
    userId: string;
    logger: Logger;
    reqId: string;
  };
};
