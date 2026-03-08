# BYOK AI Provider — Design

## Summary

Allow users to bring their own Anthropic or OpenAI API key. Keys stored client-side only (localStorage), sent per-request via headers. Server uses the key transiently, never persists it. Extensible provider abstraction for adding future providers.

## Architecture

A single `createCompletion()` function replaces all direct Anthropic SDK usage on the server. It accepts provider, API key, model, system prompt, messages, and max tokens — then dispatches to the right SDK.

### Data Flow

1. User enters API key + provider in Settings UI (or via first-use prompt)
2. Key stored in `localStorage` only — never sent to server for storage
3. Frontend attaches `X-AI-Key` and `X-AI-Provider` headers on all `/agent/*` requests
4. Server middleware extracts these, passes them through to agent modules
5. `createCompletion()` instantiates the right SDK client per-request using the provided key
6. If no key headers present → return `AI_NOT_CONFIGURED` error (fully BYOK, no fallback)

## Provider Abstraction (`server/agent/provider.ts`)

```typescript
interface CompletionOpts {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model?: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
}

function createCompletion(opts: CompletionOpts): Promise<string>;
```

- Anthropic: `@anthropic-ai/sdk`, default model `claude-sonnet-4-6`
- OpenAI: `openai` SDK, default model `gpt-4o`
- Adding a provider = adding a case + installing the SDK

## Server Changes

- **New middleware**: extract `X-AI-Key` / `X-AI-Provider` from request headers, attach to Hono context. If missing on `/agent/*` routes, return 401 with `AI_NOT_CONFIGURED`.
- **Agent modules**: refactor all 5 modules (coach, evaluator, questions, papers, mock) to accept `{ provider, apiKey }` and call `createCompletion()` instead of `new Anthropic()`.
- **Cron jobs** (dailyBriefing, weeklyInsight): skip AI calls unless admin key configured later. Use existing non-AI fallback messages.

## Frontend Changes

- **New `AiSettings.tsx`** — provider select (Anthropic/OpenAI), masked key input, "Test Key" button, clear key button, reassurance copy
- **`api.ts`**: attach `X-AI-Key` / `X-AI-Provider` headers from localStorage on `/agent/*` requests
- **First-use prompt**: modal with setup form when AI feature returns `AI_NOT_CONFIGURED`
- **Settings page**: add AI Provider section

## Decisions

- **Fully BYOK**: no server-side fallback key (architecture supports adding admin key later)
- **Client-side storage only**: localStorage, never persisted server-side
- **Thin adapter (not strategy pattern)**: `createCompletion()` function with provider cases
- **Both providers day one**: Anthropic + OpenAI
- **Extensible**: adding a provider = adding a case to `createCompletion()`

## What Stays the Same

- All non-AI features work without a key
- Agent logging to `agent_logs` table unchanged
- Prompt content, max tokens, JSON parsing unchanged
- System prompts and prompt injection protections unchanged
