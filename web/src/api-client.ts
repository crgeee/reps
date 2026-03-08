import { getAiConfig } from './ai-config';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

const AI_PATH_PREFIXES = ['/agent/', '/learn/', '/mock/'];

function shouldAttachAiHeaders(path: string): boolean {
  return AI_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const aiHeaders: Record<string, string> = {};
  if (shouldAttachAiHeaders(path)) {
    const aiConfig = getAiConfig();
    if (aiConfig && aiConfig.storageMode !== 'server') {
      aiHeaders['X-AI-Key'] = aiConfig.apiKey;
      aiHeaders['X-AI-Provider'] = aiConfig.provider;
      if (aiConfig.model) aiHeaders['X-AI-Model'] = aiConfig.model;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...aiHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${body}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Expected JSON response but got ${contentType || 'unknown content type'} (${res.status})`,
    );
  }

  return res.json() as Promise<T>;
}

export { BASE_URL };
