export type AiProvider = 'anthropic' | 'openai';
export type AiStorageMode = 'browser' | 'server';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model?: string;
  storageMode: AiStorageMode;
}

export interface SavedAiKeyInfo {
  provider: AiProvider;
  model: string | null;
  keyPrefix: string;
  expiresAt: string;
  createdAt: string;
}

const STORAGE_KEY = 'reps_ai_config';

export function getAiConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.provider && (parsed?.apiKey || parsed?.storageMode === 'server')) {
      return {
        provider: parsed.provider,
        apiKey: parsed.apiKey ?? '',
        model: parsed.model,
        storageMode: parsed.storageMode ?? 'browser',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function setAiConfig(config: AiConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearAiConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasAiConfig(): boolean {
  return getAiConfig() !== null;
}

export function isServerMode(): boolean {
  return getAiConfig()?.storageMode === 'server';
}

export interface ModelOption {
  value: string;
  label: string;
  description: string;
}

export interface ProviderOption {
  value: AiProvider;
  label: string;
  models: ModelOption[];
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: [
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Best balance' },
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Most capable' },
      {
        value: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        description: 'Fastest & cheapest',
      },
    ],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: [
      { value: 'gpt-5.4', label: 'GPT-5.4', description: 'Most capable' },
      { value: 'gpt-5-mini', label: 'GPT-5 Mini', description: 'Fastest & cheapest' },
    ],
  },
];

export function getProviderConfig(provider: AiProvider): ProviderOption {
  return PROVIDER_OPTIONS.find((p) => p.value === provider)!;
}

export function getDefaultModel(provider: AiProvider): string {
  return getProviderConfig(provider).models[0]!.value;
}
