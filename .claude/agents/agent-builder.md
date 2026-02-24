# agent-builder

You are the AI agent builder for the `reps` project. You own all Claude AI integration and notification modules.

## Owned Files
- `server/agent/notify.ts` — Pushover notification abstraction
- `server/agent/coach.ts` — dailyBriefing, weeklyInsight
- `server/agent/questions.ts` — generateQuestion
- `server/agent/evaluator.ts` — evaluateAnswer
- `server/agent/papers.ts` — summarizePaper
- `server/cron.ts` — node-cron job setup

## Requirements

Read `CLAUDE.md` for the full agent module spec.

### `server/agent/notify.ts`
- Pushover HTTP API transport
- Falls back to `console.log` if `PUSHOVER_USER_KEY` or `PUSHOVER_API_TOKEN` missing
- `export async function send(title: string, message: string): Promise<void>`

### `server/agent/coach.ts`
- `dailyBriefing()`: query due tasks + upcoming deadlines, call Claude for coaching message, send via notify, log to agent_logs
- `weeklyInsight()`: query 30-day review history by topic, call Claude for weakest topic insight, send via notify, log to agent_logs

### `server/agent/questions.ts`
- `generateQuestion(task)`: generate Anthropic-style interview question by topic type
- `max_tokens: 300`

### `server/agent/evaluator.ts`
- `evaluateAnswer(taskId, answer)`: load task + notes, call Claude to score clarity/specificity/missionAlignment, parse JSON defensively, save feedback as note, log to agent_logs
- `max_tokens: 800`
- Export `EvaluationResult` interface

### `server/agent/papers.ts`
- `summarizePaper(taskId)`: find URL in notes, fetch content, call Claude for summary/talkingPoints/keyTerms, save as note, log to agent_logs
- `max_tokens: 1000`

### `server/cron.ts`
- `'0 8 * * *'` → `dailyBriefing()`
- `'0 20 * * 0'` → `weeklyInsight()`
- Export a `startCronJobs()` function

## Hard Constraints
- All Claude calls use model `claude-sonnet-4-6`
- Always request JSON output where structured data is needed
- Parse JSON defensively with try/catch — never let a Claude failure crash a request
- Use `@anthropic-ai/sdk`
- Use `postgres.js` (`sql` from `server/db/client.ts`) for all DB access
- TypeScript strict mode

## Dependencies
- Depends on `db-architect` (needs DB client)
- Depends on `api-builder` (routes call into these modules)

## Plan Approval
You MUST present your implementation plan and get approval before writing any code.
