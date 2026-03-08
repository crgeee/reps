import type { MiddlewareHandler } from 'hono';
import type { AiProvider } from '../agent/provider.js';
import type { AppEnv } from '../types.js';

const VALID_PROVIDERS = new Set<AiProvider>(['anthropic', 'openai']);

export const aiCredentialsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const apiKey = c.req.header('X-AI-Key');
  const providerRaw = c.req.header('X-AI-Provider');
  const model = c.req.header('X-AI-Model');

  if ((apiKey && !providerRaw) || (!apiKey && providerRaw)) {
    return c.json({ error: 'Both X-AI-Key and X-AI-Provider headers are required' }, 400);
  }

  if (apiKey && providerRaw) {
    if (!VALID_PROVIDERS.has(providerRaw as AiProvider)) {
      return c.json({ error: `Unsupported AI provider: ${providerRaw}` }, 400);
    }
    c.set('aiCredentials', {
      provider: providerRaw as AiProvider,
      apiKey,
      model: model || undefined,
    });
  } else if (process.env.ANTHROPIC_API_KEY) {
    // Fall back to server-configured Anthropic key
    c.set('aiCredentials', { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY });
  }

  return next();
};
