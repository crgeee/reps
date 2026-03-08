import type { MiddlewareHandler } from 'hono';
import type { AiProvider } from '../agent/provider.js';
import type { AppEnv } from '../types.js';
import { getDecryptedAiKey } from '../auth/ai-keys.js';

const VALID_PROVIDERS = new Set<AiProvider>(['anthropic', 'openai']);

export const aiCredentialsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const apiKey = c.req.header('X-AI-Key');
  const providerRaw = c.req.header('X-AI-Provider');
  const model = c.req.header('X-AI-Model');

  if ((apiKey && !providerRaw) || (!apiKey && providerRaw)) {
    return c.json({ error: 'Both X-AI-Key and X-AI-Provider headers are required' }, 400);
  }

  // 1. Client-provided headers (browser mode)
  if (apiKey && providerRaw) {
    if (!VALID_PROVIDERS.has(providerRaw as AiProvider)) {
      return c.json({ error: `Unsupported AI provider: ${providerRaw}` }, 400);
    }
    c.set('aiCredentials', {
      provider: providerRaw as AiProvider,
      apiKey,
      model: model || undefined,
    });
  } else {
    // 2. DB-stored key (server mode)
    const userId = c.get('userId');
    if (userId) {
      const dbKey = await getDecryptedAiKey(userId);
      if (dbKey) {
        c.set('aiCredentials', {
          provider: dbKey.provider,
          apiKey: dbKey.apiKey,
          model: dbKey.model || undefined,
        });
      }
    }

    // 3. Server admin fallback
    if (!c.get('aiCredentials') && process.env.ANTHROPIC_API_KEY) {
      c.set('aiCredentials', { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  return next();
};
