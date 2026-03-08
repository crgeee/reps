import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AiProvider = 'anthropic' | 'openai';

export interface AiCredentials {
  provider: AiProvider;
  apiKey: string;
  model?: string;
}

interface CompletionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionOpts {
  credentials: AiCredentials;
  system: string;
  messages: CompletionMessage[];
  maxTokens: number;
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
};

async function callAnthropic(opts: CompletionOpts): Promise<string> {
  const client = new Anthropic({ apiKey: opts.credentials.apiKey });
  const model = opts.credentials.model ?? DEFAULT_MODELS.anthropic;

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages,
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') {
    throw new Error(`Anthropic returned unexpected content type: ${block?.type ?? 'empty'}`);
  }
  return block.text;
}

async function callOpenAI(opts: CompletionOpts): Promise<string> {
  const client = new OpenAI({ apiKey: opts.credentials.apiKey });
  const model = opts.credentials.model ?? DEFAULT_MODELS.openai;

  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens,
    messages: [{ role: 'system' as const, content: opts.system }, ...opts.messages],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(
      `OpenAI returned no content (finish_reason: ${response.choices[0]?.finish_reason ?? 'unknown'})`,
    );
  }
  return content;
}

export async function createCompletion(opts: CompletionOpts): Promise<string> {
  if (!opts.credentials.apiKey) {
    throw new Error('API key is required');
  }

  switch (opts.credentials.provider) {
    case 'anthropic':
      return callAnthropic(opts);
    case 'openai':
      return callOpenAI(opts);
    default:
      throw new Error(`Unsupported AI provider: ${opts.credentials.provider as string}`);
  }
}
