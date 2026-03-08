export type AiProvider = 'anthropic' | 'openai';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model?: string;
}

const STORAGE_KEY = 'reps_ai_config';

export function getAiConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.provider && parsed?.apiKey) {
      return { provider: parsed.provider, apiKey: parsed.apiKey, model: parsed.model };
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
