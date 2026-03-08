import { describe, it, expect } from 'vitest';
import { createCompletion, type AiCredentials } from '../provider.js';

describe('createCompletion', () => {
  const baseOpts = {
    system: 'You are a test assistant.',
    messages: [{ role: 'user' as const, content: 'Hello' }],
    maxTokens: 100,
  };

  it('throws for unsupported provider', async () => {
    const credentials = { provider: 'gemini', apiKey: 'test-key' } as unknown as AiCredentials;

    await expect(createCompletion({ ...baseOpts, credentials })).rejects.toThrow(
      'Unsupported AI provider: gemini',
    );
  });

  it('throws when API key is empty', async () => {
    const credentials: AiCredentials = { provider: 'anthropic', apiKey: '' };

    await expect(createCompletion({ ...baseOpts, credentials })).rejects.toThrow(
      'API key is required',
    );
  });
});
