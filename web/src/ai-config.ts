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

export const PROVIDER_OPTIONS: {
  value: AiProvider;
  label: string;
  description: string;
}[] = [
  { value: 'anthropic', label: 'Anthropic', description: 'Claude (claude-sonnet-4-6)' },
  { value: 'openai', label: 'OpenAI', description: 'GPT-4o' },
];
