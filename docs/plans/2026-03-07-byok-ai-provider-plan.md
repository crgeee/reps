# BYOK AI Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users bring their own Anthropic or OpenAI API key, stored client-side only (localStorage), sent per-request, with an extensible provider abstraction.

**Architecture:** A `createCompletion()` function replaces all direct Anthropic SDK usage. Frontend stores keys in localStorage and attaches them as headers on `/agent/*` requests. Server extracts keys from headers, passes them to agent modules, never persists them. Cron jobs (dailyBriefing, weeklyInsight) will use existing non-AI fallbacks since they run without a user request.

**Tech Stack:** Anthropic SDK, OpenAI SDK, Hono middleware, React + localStorage

---

### Task 1: Install OpenAI SDK

**Files:**

- Modify: `package.json`

**Step 1: Install the package**

Run: `npm install openai`

**Step 2: Verify installation**

Run: `npm ls openai`
Expected: `openai@x.x.x`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add openai SDK dependency for BYOK provider support"
```

---

### Task 2: Create provider abstraction (`server/agent/provider.ts`)

**Files:**

- Create: `server/agent/provider.ts`
- Test: `server/agent/__tests__/provider.test.ts`

**Step 1: Write the failing test**

Create `server/agent/__tests__/provider.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createCompletion, type AiCredentials } from '../provider.js';

describe('createCompletion', () => {
  it('throws on unsupported provider', async () => {
    const creds: AiCredentials = { provider: 'gemini' as any, apiKey: 'test' };
    await expect(
      createCompletion({
        credentials: creds,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 10,
      }),
    ).rejects.toThrow('Unsupported AI provider: gemini');
  });

  it('throws on empty API key', async () => {
    const creds: AiCredentials = { provider: 'anthropic', apiKey: '' };
    await expect(
      createCompletion({
        credentials: creds,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 10,
      }),
    ).rejects.toThrow('API key is required');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run server/agent/__tests__/provider.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `server/agent/provider.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AiProvider = 'anthropic' | 'openai';

export interface AiCredentials {
  provider: AiProvider;
  apiKey: string;
}

interface CompletionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionOpts {
  credentials: AiCredentials;
  model?: string;
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
  const model = opts.model ?? DEFAULT_MODELS.anthropic;

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const block = response.content[0];
  return block?.type === 'text' ? block.text : '';
}

async function callOpenAI(opts: CompletionOpts): Promise<string> {
  const client = new OpenAI({ apiKey: opts.credentials.apiKey });
  const model = opts.model ?? DEFAULT_MODELS.openai;

  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens,
    messages: [
      { role: 'system', content: opts.system },
      ...opts.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
  });

  return response.choices[0]?.message?.content ?? '';
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
      throw new Error(`Unsupported AI provider: ${opts.credentials.provider}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run server/agent/__tests__/provider.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/agent/provider.ts server/agent/__tests__/provider.test.ts
git commit -m "feat: add createCompletion provider abstraction for BYOK support"
```

---

### Task 3: Add AI credentials to Hono context and CORS

**Files:**

- Modify: `server/types.ts` — add `aiCredentials` to `AppEnv.Variables`
- Create: `server/middleware/ai-credentials.ts` — extract `X-AI-Key` / `X-AI-Provider` headers
- Modify: `server/index.ts` — mount middleware on `/agent/*`, add headers to CORS allowHeaders
- Modify: `server/routes/agent.ts` — read credentials from context, pass to agent functions

**Step 1: Update AppEnv types**

Modify `server/types.ts`:

```typescript
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
```

**Step 2: Create AI credentials middleware**

Create `server/middleware/ai-credentials.ts`:

```typescript
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
```

**Step 3: Mount middleware and update CORS**

Modify `server/index.ts`:

Add import:

```typescript
import { aiCredentialsMiddleware } from './middleware/ai-credentials.js';
```

Update CORS `allowHeaders` to include `'X-AI-Key'` and `'X-AI-Provider'`:

```typescript
allowHeaders: ['Authorization', 'Content-Type', 'X-AI-Key', 'X-AI-Provider'],
```

Add after auth middleware, before agent rate limiter:

```typescript
// Extract AI credentials from headers (BYOK)
app.use('/agent/*', aiCredentialsMiddleware);
```

**Step 4: Add test endpoint for key validation**

Add to `server/routes/agent.ts`:

```typescript
agent.get('/test-key', async (c) => {
  const credentials = c.get('aiCredentials');
  if (!credentials) {
    return c.json({ error: 'No AI key configured', code: 'AI_NOT_CONFIGURED' }, 401);
  }

  try {
    const { createCompletion } = await import('../agent/provider.js');
    await createCompletion({
      credentials,
      system: 'Reply with exactly: ok',
      messages: [{ role: 'user', content: 'test' }],
      maxTokens: 5,
    });
    return c.json({ status: 'ok', provider: credentials.provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: `Key validation failed: ${message}`, code: 'AI_KEY_INVALID' }, 401);
  }
});
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add server/types.ts server/middleware/ai-credentials.ts server/index.ts server/routes/agent.ts
git commit -m "feat: add AI credentials middleware for BYOK header extraction"
```

---

### Task 4: Refactor agent modules to use `createCompletion()`

**Files:**

- Modify: `server/agent/evaluator.ts`
- Modify: `server/agent/questions.ts`
- Modify: `server/agent/papers.ts`
- Modify: `server/agent/coach.ts`
- Modify: `server/agent/mock.ts`
- Modify: `server/routes/agent.ts` — pass credentials to all agent function calls

Each agent module currently does:

```typescript
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();
const MODEL = 'claude-sonnet-4-6';
// ...
const response = await anthropic.messages.create({ model: MODEL, ... });
```

Replace with:

```typescript
import { createCompletion, type AiCredentials } from './provider.js';
// ...
const text = await createCompletion({ credentials, system: ..., messages: [...], maxTokens: ... });
```

**Step 1: Refactor `evaluator.ts`**

- Remove `Anthropic` import and `anthropic` / `MODEL` constants
- Add `credentials: AiCredentials` parameter to `evaluateAnswer()`
- Replace `anthropic.messages.create()` call with `createCompletion()`
- The response parsing already extracts text — `createCompletion()` returns text directly, so simplify

Key change to function signature:

```typescript
export async function evaluateAnswer(
  taskId: string,
  answer: string,
  credentials: AiCredentials,
): Promise<EvaluationResult> {
```

Replace the Claude call block (lines 70-75) with:

```typescript
const text = await createCompletion({
  credentials,
  system: systemPrompt,
  messages: [{ role: 'user', content: userPrompt }],
  maxTokens: 800,
});
```

Then update the parsing to use `text` directly (remove the `response.content[0]` extraction).

**Step 2: Refactor `questions.ts`**

Same pattern — add `credentials: AiCredentials` parameter to `generateQuestion()`, replace SDK call:

```typescript
export async function generateQuestion(task: Task, credentials: AiCredentials): Promise<string> {
```

Replace lines 33-38 with:

```typescript
const question = await createCompletion({
  credentials,
  system: topicPrompt,
  messages: [{ role: 'user', content: userPrompt }],
  maxTokens: 300,
});
```

**Step 3: Refactor `papers.ts`**

Same pattern — add `credentials: AiCredentials` parameter to `summarizePaper()`:

```typescript
export async function summarizePaper(taskId: string, credentials: AiCredentials): Promise<PaperSummary> {
```

Replace lines 111-116 with:

```typescript
const text = await createCompletion({
  credentials,
  system: systemPrompt,
  messages: [{ role: 'user', content: userPrompt }],
  maxTokens: 1000,
});
```

**Step 4: Refactor `coach.ts`**

Both `dailyBriefing()` and `weeklyInsight()` need optional credentials. When missing (cron context), use the existing fallback messages.

```typescript
export async function dailyBriefing(userId?: string, credentials?: AiCredentials): Promise<string> {
```

Wrap the Claude call in a credentials check:

```typescript
if (credentials) {
  const response = await createCompletion({ credentials, system: ..., messages: [...], maxTokens: 300 });
  message = response;
} else {
  message = `You have ${data.dueToday.length} review(s) due and ${data.upcomingDeadlines.length} upcoming deadline(s). Check your reps dashboard.`;
}
```

Same pattern for `weeklyInsight()`.

**Step 5: Refactor `mock.ts`**

Add `credentials: AiCredentials` to `startMockInterview()` and `respondToMock()`:

```typescript
export async function startMockInterview(
  topic: string,
  difficulty: string,
  collectionId?: string,
  userId?: string,
  credentials?: AiCredentials,
): Promise<{ sessionId: string; question: string }> {
```

And:

```typescript
export async function respondToMock(
  sessionId: string,
  answer: string,
  credentials?: AiCredentials,
): Promise<{ followUp?: string; evaluation?: MockScore }> {
```

If `credentials` is undefined, use the existing hardcoded fallback strings.

**Step 6: Update `server/routes/agent.ts` to pass credentials**

For every route handler, extract credentials from context and pass to agent functions:

```typescript
agent.post('/evaluate', async (c) => {
  const credentials = c.get('aiCredentials');
  if (!credentials) {
    return c.json({ error: 'AI key required', code: 'AI_NOT_CONFIGURED' }, 401);
  }
  // ...
  const result = await evaluateAnswer(parsed.data.taskId, parsed.data.answer, credentials);
  // ...
});
```

Add a helper at the top of the file:

```typescript
import type { AiCredentials } from '../agent/provider.js';

function requireAiCredentials(c: Context<AppEnv>): AiCredentials {
  const credentials = c.get('aiCredentials');
  if (!credentials) {
    throw new AiNotConfiguredError();
  }
  return credentials;
}

class AiNotConfiguredError extends Error {
  constructor() {
    super('AI key required');
  }
}
```

Update every handler that needs AI: `/evaluate`, `/question/:taskId`, `/summarize/:taskId`, `/briefing`, `/mock/start`, `/mock/respond`. The `/mock` GET list and `/mock/:id` GET endpoints don't use AI, so leave them unchanged.

For `/briefing`, pass credentials through:

```typescript
const message = await dailyBriefing(userId, credentials);
```

Update the main catch blocks to check for `AiNotConfiguredError`:

```typescript
} catch (err) {
  if (err instanceof AiNotConfiguredError) {
    return c.json({ error: 'AI key required', code: 'AI_NOT_CONFIGURED' }, 401);
  }
  // ... existing error handling
}
```

**Step 7: Update cron.ts**

The cron jobs call `dailyBriefing(userId)` and `weeklyInsight(userId)` without credentials. Since we made credentials optional in step 4, these will use the non-AI fallback messages. No changes needed to `cron.ts` itself.

**Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 9: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 10: Commit**

```bash
git add server/agent/evaluator.ts server/agent/questions.ts server/agent/papers.ts server/agent/coach.ts server/agent/mock.ts server/routes/agent.ts
git commit -m "refactor: agent modules use createCompletion with BYOK credentials"
```

---

### Task 5: Frontend — localStorage helpers and API header injection

**Files:**

- Create: `web/src/ai-config.ts` — localStorage read/write helpers
- Modify: `web/src/api.ts` — attach AI headers on `/agent/*` requests

**Step 1: Create `web/src/ai-config.ts`**

```typescript
export type AiProvider = 'anthropic' | 'openai';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
}

const STORAGE_KEY = 'reps_ai_config';

export function getAiConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.provider && parsed?.apiKey) {
      return { provider: parsed.provider, apiKey: parsed.apiKey };
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
```

**Step 2: Modify `web/src/api.ts` to attach AI headers**

Update the `request()` function to inject headers for agent routes:

```typescript
import { getAiConfig } from './ai-config';
```

In the `request()` function, before the fetch call, add:

```typescript
const aiHeaders: Record<string, string> = {};
if (path.startsWith('/agent/')) {
  const aiConfig = getAiConfig();
  if (aiConfig) {
    aiHeaders['X-AI-Key'] = aiConfig.apiKey;
    aiHeaders['X-AI-Provider'] = aiConfig.provider;
  }
}
```

Then include in the fetch call:

```typescript
headers: {
  'Content-Type': 'application/json',
  ...aiHeaders,
  ...options.headers,
},
```

**Step 3: Add `testAiKey` API function**

Add to `web/src/api.ts`:

```typescript
export async function testAiKey(): Promise<{ status: string; provider: string }> {
  return request<{ status: string; provider: string }>('/agent/test-key');
}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors

**Step 5: Commit**

```bash
git add web/src/ai-config.ts web/src/api.ts
git commit -m "feat: localStorage AI config helpers and automatic header injection"
```

---

### Task 6: Frontend — AI Settings component

**Files:**

- Create: `web/src/components/settings/AiSettings.tsx`
- Modify: `web/src/components/Settings.tsx` — add AI tab
- Modify: `web/src/components/settings/shared.tsx` — add sparkles icon

**Step 1: Add sparkles icon to shared.tsx**

Add to `SECTION_ICONS` in `web/src/components/settings/shared.tsx`:

```typescript
sparkles: (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
  />
),
```

**Step 2: Create `AiSettings.tsx`**

Create `web/src/components/settings/AiSettings.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { getAiConfig, setAiConfig, clearAiConfig, type AiProvider } from '../../ai-config';
import { testAiKey } from '../../api';
import { SectionHeader } from './shared';

const PROVIDER_OPTIONS: { value: AiProvider; label: string; description: string }[] = [
  { value: 'anthropic', label: 'Anthropic', description: 'Claude (claude-sonnet-4-6)' },
  { value: 'openai', label: 'OpenAI', description: 'GPT-4o' },
];

export default function AiSettings() {
  const existing = getAiConfig();
  const [provider, setProvider] = useState<AiProvider>(existing?.provider ?? 'anthropic');
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [saved, setSaved] = useState(!!existing);

  function handleSave() {
    if (!apiKey.trim()) return;
    setAiConfig({ provider, apiKey: apiKey.trim() });
    setSaved(true);
    setTestStatus('idle');
  }

  function handleClear() {
    clearAiConfig();
    setApiKey('');
    setSaved(false);
    setTestStatus('idle');
    setTestError('');
  }

  async function handleTest() {
    if (!apiKey.trim()) return;
    // Save first so the header injection picks it up
    setAiConfig({ provider, apiKey: apiKey.trim() });
    setSaved(true);
    setTestStatus('testing');
    setTestError('');

    try {
      await testAiKey();
      setTestStatus('success');
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Test failed');
    }
  }

  // Mask the key for display
  function maskedKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••' + key.slice(-4);
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon="sparkles" title="AI Provider" />

      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-5">
        <p className="text-sm text-zinc-400">
          Connect your own AI provider to enable question generation, answer evaluation, and mock
          interviews. Your API key is stored in your browser only and never saved on our servers.
        </p>

        {/* Provider selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400">Provider</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setProvider(opt.value);
                  setSaved(false);
                  setTestStatus('idle');
                }}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  provider === opt.value
                    ? 'border-zinc-500 bg-zinc-800'
                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                }`}
              >
                <p className="text-sm font-medium text-zinc-200">{opt.label}</p>
                <p className="text-xs text-zinc-500">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* API Key input */}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-400">API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setSaved(false);
              setTestStatus('idle');
            }}
            placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono text-sm"
          />
        </label>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={!apiKey.trim() || testStatus === 'testing'}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testStatus === 'testing' ? 'Testing...' : 'Save & Test Key'}
          </button>
          {saved && (
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-red-400 transition-colors"
            >
              Remove Key
            </button>
          )}
        </div>

        {/* Status messages */}
        {testStatus === 'success' && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Key verified — AI features are active
          </div>
        )}
        {testStatus === 'error' && (
          <div className="text-sm text-red-400">
            <p>Key validation failed</p>
            {testError && <p className="text-xs text-red-400/70 mt-1">{testError}</p>}
          </div>
        )}

        {/* Privacy notice */}
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">
            Your API key is stored in your browser's local storage and sent directly with each AI
            request. It is never saved to our database or accessible to server administrators.
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Add AI tab to Settings.tsx**

Modify `web/src/components/Settings.tsx`:

Add import:

```typescript
import AiSettings from './settings/AiSettings';
```

Add to the `SettingsTab` type:

```typescript
type SettingsTab = 'general' | 'ai' | 'notifications' | 'account' | 'integrations' | 'admin';
```

Add to the `TABS` array (after 'general'):

```typescript
{
  id: 'ai',
  label: 'AI Provider',
  icon: (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  ),
},
```

Add to the `renderTab()` switch:

```typescript
case 'ai':
  return <AiSettings />;
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors

**Step 5: Commit**

```bash
git add web/src/components/settings/AiSettings.tsx web/src/components/Settings.tsx web/src/components/settings/shared.tsx
git commit -m "feat: AI Provider settings UI with BYOK key management"
```

---

### Task 7: Frontend — First-use prompt modal

**Files:**

- Create: `web/src/components/AiKeyModal.tsx`
- Modify: `web/src/components/ReviewSession.tsx` — replace `AiErrorNotice` with modal trigger

**Step 1: Create `AiKeyModal.tsx`**

Create `web/src/components/AiKeyModal.tsx`:

```typescript
import { useState } from 'react';
import { setAiConfig, type AiProvider } from '../ai-config';
import { testAiKey } from '../api';

interface Props {
  onClose: () => void;
  onConfigured: () => void;
}

export default function AiKeyModal({ onClose, onConfigured }: Props) {
  const [provider, setProvider] = useState<AiProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!apiKey.trim()) return;
    setAiConfig({ provider, apiKey: apiKey.trim() });
    setStatus('testing');
    setError('');

    try {
      await testAiKey();
      onConfigured();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Validation failed');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Connect AI Provider</h2>
          <p className="text-sm text-zinc-400 mt-1">
            AI features require your own API key. It's stored in your browser only.
          </p>
        </div>

        {/* Provider buttons */}
        <div className="grid grid-cols-2 gap-2">
          {(['anthropic', 'openai'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                provider === p
                  ? 'border-zinc-500 bg-zinc-800'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <p className="text-sm font-medium text-zinc-200">
                {p === 'anthropic' ? 'Anthropic' : 'OpenAI'}
              </p>
              <p className="text-xs text-zinc-500">
                {p === 'anthropic' ? 'Claude' : 'GPT-4o'}
              </p>
            </button>
          ))}
        </div>

        {/* Key input */}
        <input
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setStatus('idle');
          }}
          placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-sm"
        />

        {status === 'error' && (
          <p className="text-sm text-red-400">{error || 'Key validation failed'}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!apiKey.trim() || status === 'testing'}
            className="flex-1 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'testing' ? 'Verifying...' : 'Connect'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-zinc-600 text-center">
          Your key is stored in your browser only, never on our servers.
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Update `ReviewSession.tsx`**

Replace the `AiErrorNotice` component and its usage. When an AI call returns `AI_NOT_CONFIGURED`, show the modal instead of the static notice.

Replace the existing `AiErrorNotice` function (lines 32-45) with:

```typescript
import AiKeyModal from './AiKeyModal';
import { hasAiConfig } from '../ai-config';

// Inside the component, add state:
const [showAiModal, setShowAiModal] = useState(false);
```

Replace `isAiKeyError` check usage — wherever `AiErrorNotice` is rendered, instead show a button that opens the modal:

```typescript
{isAiKeyError(error) && !hasAiConfig() && (
  <button
    onClick={() => setShowAiModal(true)}
    className="text-sm text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
  >
    Connect AI provider to enable this feature
  </button>
)}

{showAiModal && (
  <AiKeyModal
    onClose={() => setShowAiModal(false)}
    onConfigured={() => {
      setShowAiModal(false);
      // Retry the AI action that triggered the modal
    }}
  />
)}
```

The exact placement depends on the current `AiErrorNotice` usage locations — read the full component at implementation time to find all occurrences.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors

**Step 4: Commit**

```bash
git add web/src/components/AiKeyModal.tsx web/src/components/ReviewSession.tsx
git commit -m "feat: first-use AI key modal on AI_NOT_CONFIGURED errors"
```

---

### Task 8: Verify end-to-end and clean up

**Files:**

- Verify: all existing tests pass
- Verify: TypeScript compiles for both server and web
- Verify: lint and format pass
- Remove: old `AiErrorNotice` component and `isAiKeyError` from ReviewSession if fully replaced

**Step 1: Run all checks**

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npx tsc --noEmit --project web/tsconfig.json
npx vitest run
```

Expected: All pass

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: cleanup and verify BYOK AI provider integration"
```

---

### Task 9: Create PR

**Step 1: Push and create PR**

```bash
git push -u origin feat/byok-ai-provider
gh pr create --title "feat: BYOK AI provider with client-side key storage" --body "$(cat <<'EOF'
## Summary
- Users can bring their own Anthropic or OpenAI API key
- Keys stored in browser localStorage only — never persisted server-side
- New AI Provider settings page with provider selection, key input, and test button
- First-use modal when AI features are attempted without a key configured
- Extensible provider abstraction (`createCompletion()`) for adding future providers
- Cron jobs gracefully degrade to non-AI fallback messages

## Test plan
- [ ] Configure Anthropic key in Settings > AI Provider, verify "Save & Test Key" succeeds
- [ ] Configure OpenAI key, verify test succeeds
- [ ] Remove key, attempt AI feature, verify modal appears
- [ ] Configure key via modal, verify AI features work immediately after
- [ ] Clear localStorage, verify AI features show AI_NOT_CONFIGURED
- [ ] Verify key is NOT in any network request body (only in X-AI-Key header)
- [ ] Verify all non-AI features work without any key configured
- [ ] Run existing test suite

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
