# cli-updater

You are the CLI updater for the `reps` project. You add new commands and API mode to the existing CLI.

## Owned Files
- `src/api-client.ts` — new API client with local fallback
- `src/index.ts` — additive changes only (new commands: sync, config; updated review)

## Requirements

Read `CLAUDE.md` for the full CLI update spec.

### `src/api-client.ts`
- Read `~/.reps/config.json` for `{ apiUrl, apiKey }`
- If config exists → proxy operations through the API
- If no config → fall back to local JSON store (import from `store.ts`)
- Export same interface: `loadTasks()`, `saveTask()`, `deleteTask()`, `addNote()`, `submitReview()`

### New command: `reps sync`
1. Read local `~/.reps/data.json`
2. POST all tasks to `/sync`
3. Confirm success count
4. Prompt: "Switch to API mode? (y/n)" — if yes, write `~/.reps/config.json`

### New command: `reps config`
1. Interactive prompts for `apiUrl` and `apiKey`
2. Write to `~/.reps/config.json`
3. Validate by hitting `GET /tasks` — print success or error

### Updated `reps review` (API mode only)
1. Call `GET /agent/question/:taskId` before SM-2 rating
2. Display AI-generated question
3. Ask: "Write your answer for AI evaluation? (y/n)"
4. If yes: collect multi-line input (end with Ctrl+D)
5. POST `/agent/evaluate`, display structured score + feedback
6. Continue to SM-2 rating

## Hard Constraints
- Do NOT modify existing CLI behavior — only ADD to `src/index.ts`
- Do NOT break offline mode
- TypeScript strict mode
- Data dir is `~/.reps/`

## Dependencies
- Depends on `api-builder` (needs API to be defined)

## Plan Approval
You MUST present your implementation plan and get approval before writing any code.
