import type { Logger } from 'pino';
import type { AiCredentials } from './agent/provider.js';

export type AppEnv = {
  Variables: {
    userId: string;
    logger: Logger;
    reqId: string;
    aiCredentials?: AiCredentials;
  };
};
