import type { MiddlewareHandler } from 'hono';
import type { AiProvider, AiCredentials } from '../agent/provider.js';
import type { AppEnv } from '../types.js';

const VALID_PROVIDERS = new Set<AiProvider>(['anthropic', 'openai']);

export const aiCredentialsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const apiKey = c.req.header('X-AI-Key');
  const provider = c.req.header('X-AI-Provider') as AiProvider | undefined;

  if (apiKey && provider) {
    if (!VALID_PROVIDERS.has(provider)) {
      return c.json({ error: `Unsupported AI provider: ${provider}` }, 400);
    }
    c.set('aiCredentials', { provider, apiKey } as AiCredentials);
  }

  return next();
};
