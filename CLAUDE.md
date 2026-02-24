# reps — AI-powered interview prep tracker

## Overview

`reps` is a personal CLI + web app for tracking technical interview prep with spaced repetition, AI coaching, and phone notifications. The developer is a staff TypeScript engineer — skip explanations, just build clean code.

The name "reps" is a double meaning: "getting your reps in" (training) and the `repetitions` field in the SM-2 spaced repetition algorithm the app is built on.

---

## What Already Exists (do not break)

A working TypeScript CLI at `src/` with:

- `src/index.ts` — Commander CLI (dashboard, add, list, done, note, review, delete, status, seed, info)
- `src/types.ts` — Task, Note, Store, Topic, Quality types
- `src/store.ts` — local JSON store at `~/.reps/data.json`
- `src/spaced-repetition.ts` — SM-2 algorithm
- `src/display.ts` — chalk terminal rendering

Tasks have: id, topic (coding/system-design/behavioral/papers/custom), title, notes[], completed, deadline, and SM-2 fields (repetitions, interval, easeFactor, nextReview, lastReviewed, createdAt).

---

## Target Stack

| Layer           | Technology                                                      |
| --------------- | --------------------------------------------------------------- |
| VPS             | Hetzner Ubuntu 24.04 (single box, no k8s, no serverless)        |
| API             | Hono + Node.js on port 3000                                     |
| DB              | PostgreSQL (local on box)                                       |
| Frontend        | React + Vite SPA                                                |
| Reverse proxy   | Nginx (SSL via Certbot)                                         |
| Process manager | pm2                                                             |
| AI              | Anthropic SDK (`@anthropic-ai/sdk`), model: `claude-sonnet-4-6` |
| Notifications   | Pushover (iOS push) with console fallback                       |
| Email           | Resend for daily digest                                         |
| DB client       | postgres.js (no ORM)                                            |

---

## Directory Structure

```
reps/
├── src/                        # existing CLI (keep as-is)
├── server/
│   ├── index.ts                # Hono app entrypoint
│   ├── db/
│   │   ├── client.ts           # postgres.js singleton
│   │   └── migrate.ts          # run schema migrations
│   ├── routes/
│   │   ├── tasks.ts
│   │   └── agent.ts
│   ├── agent/
│   │   ├── coach.ts            # dailyBriefing, weeklyInsight
│   │   ├── questions.ts        # generateQuestion
│   │   ├── evaluator.ts        # evaluateAnswer
│   │   ├── papers.ts           # summarizePaper
│   │   └── notify.ts           # Pushover abstraction
│   ├── cron.ts                 # node-cron job setup
│   └── middleware/
│       └── auth.ts             # API key check
├── web/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api.ts              # typed fetch wrapper
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── ReviewSession.tsx
│   │   │   ├── AddTask.tsx
│   │   │   └── TopicProgress.tsx
│   │   └── types.ts
│   ├── index.html
│   └── vite.config.ts
├── db/
│   └── schema.sql
├── deploy/
│   ├── nginx.conf
│   ├── ecosystem.config.js
│   └── deploy.sh
├── .claude/
│   └── agents/                 # agent team definitions (see below)
├── .env.example
├── CLAUDE.md                   # this file
├── tsconfig.json
└── package.json
```

---

## PostgreSQL Schema (`db/schema.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY,
  topic         TEXT NOT NULL CHECK (topic IN ('coding','system-design','behavioral','papers','custom')),
  title         TEXT NOT NULL,
  completed     BOOLEAN DEFAULT false,
  deadline      DATE,
  repetitions   INT DEFAULT 0,
  interval      INT DEFAULT 1,
  ease_factor   FLOAT DEFAULT 2.5,
  next_review   DATE NOT NULL,
  last_reviewed DATE,
  created_at    DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL, -- 'daily_briefing' | 'weekly_insight' | 'evaluation' | 'question' | 'paper_summary'
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  input       TEXT,
  output      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## API Routes

All routes require `Authorization: Bearer <API_KEY>` header.

### `server/routes/tasks.ts`

```
GET    /tasks              — list all tasks with notes joined
POST   /tasks              — create task
PATCH  /tasks/:id          — update task (any field)
DELETE /tasks/:id          — delete task
POST   /tasks/:id/notes    — add note
POST   /tasks/:id/review   — body: { quality: 0-5 } — runs SM-2, returns updated task
GET    /tasks/due          — next_review <= today AND completed = false
POST   /sync               — bulk upsert (CLI migration)
```

> SM-2 logic already exists in `src/spaced-repetition.ts` — import and reuse it, do not duplicate.

### `server/routes/agent.ts`

```
POST /agent/evaluate          — body: { taskId, answer } → Claude feedback
GET  /agent/question/:taskId  — generate interview question for task
POST /agent/summarize/:taskId — fetch URL from notes, summarize, save back
POST /agent/briefing          — manually trigger daily briefing (for testing)
```

---

## Agent Module (`server/agent/`)

### `notify.ts`

Pushover transport. Falls back to `console.log` if env vars missing.
Env vars: `PUSHOVER_USER_KEY`, `PUSHOVER_API_TOKEN`

```typescript
export async function send(title: string, message: string): Promise<void>;
```

### `coach.ts`

**`dailyBriefing()`**

1. Query tasks due for review + tasks with deadline within 7 days
2. Call Claude: _"You are a technical interview coach. The candidate is preparing for a software engineer role at Anthropic. Given these due review items and upcoming deadlines, write a 3-sentence motivating and specific coaching message for today. Be direct, not cheesy."_
3. Send via `notify.ts` with title `"reps — daily briefing"`
4. Log to `agent_logs`

**`weeklyInsight()`**

1. Query last 30 days of review history (last_reviewed, repetitions, ease_factor by topic)
2. Call Claude to identify the weakest topic and suggest one concrete focus for the week
3. Send via `notify.ts` with title `"reps — weekly insight"`
4. Log to `agent_logs`

### `questions.ts`

`generateQuestion(task)` — generate a realistic Anthropic-style interview question by topic:

| Topic           | Style                                       |
| --------------- | ------------------------------------------- |
| `coding`        | Specific problem framing with constraints   |
| `system-design` | System to design with scale requirements    |
| `behavioral`    | STAR-format prompt tied to AI safety values |
| `papers`        | Discussion question about the paper content |

`max_tokens: 300`

### `evaluator.ts`

`evaluateAnswer(taskId, answer)`:

1. Load task + notes from DB
2. System prompt: _"You are a senior Anthropic interviewer. Score on: clarity (1-5), specificity (1-5), mission alignment with AI safety (1-5). For behavioral questions check STAR format. Return JSON only: `{ clarity, specificity, missionAlignment, feedback, suggestedImprovement }`"_
3. Parse JSON defensively
4. Save feedback as a note on the task
5. Log to `agent_logs`

`max_tokens: 800`

```typescript
export interface EvaluationResult {
  clarity: number;
  specificity: number;
  missionAlignment: number;
  feedback: string;
  suggestedImprovement: string;
}
```

### `papers.ts`

`summarizePaper(taskId)`:

1. Find first URL in task notes
2. Fetch the URL content
3. Prompt: _"Summarize this paper for an engineer preparing for an Anthropic interview. Return JSON only: `{ summary: string (5 bullets), talkingPoints: string[] (3 items), keyTerms: string[] }`"_
4. Save summary as a new note on the task
5. Log to `agent_logs`

`max_tokens: 1000`

---

## Cron Jobs (`server/cron.ts`)

```typescript
// node-cron schedule:
// '0 8 * * *'   → dailyBriefing()
// '0 20 * * 0'  → weeklyInsight()
```

---

## CLI Updates (additive to existing `src/`)

### `src/api-client.ts` (new)

- Reads `~/.reps/config.json` for `{ apiUrl, apiKey }`
- If config exists → proxy all store operations through the API
- If no config → fall back to local JSON store (offline mode)
- Exports same interface as `store.ts`: `loadTasks()`, `saveTask()`, `deleteTask()`, `addNote()`, `submitReview()`

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
2. Display AI-generated question prominently
3. Ask: "Write your answer for AI evaluation? (y/n)"
4. If yes: collect multi-line input (end with Ctrl+D)
5. POST `/agent/evaluate`, display structured score + feedback
6. Continue to SM-2 rating as normal

---

## Web UI (`web/src/`)

Clean, minimal. Tailwind CSS utility classes only.

| View           | Description                                                                      |
| -------------- | -------------------------------------------------------------------------------- |
| Dashboard      | Progress bars by topic, due count, overdue alert, "Start Review" CTA             |
| Task list      | Grouped by topic, expandable notes, inline "Mark done" and "Add note"            |
| Review session | Card flow: task title → AI question → textarea → evaluate → scores → SM-2 rating |
| Add task       | Topic select, title, deadline, note                                              |
| Progress       | Bar chart per topic, last reviewed, ease factor as confidence indicator          |

API base URL from `import.meta.env.VITE_API_URL`. Use plain fetch + useEffect or TanStack Query.

---

## Deployment (`deploy/`)

### `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: "reps",
      script: "dist/server/index.js",
      env: { NODE_ENV: "production" },
    },
  ],
};
```

### `nginx.conf`

- Serve `web/dist` as static files on port 80/443
- Proxy `/api/*`, `/tasks/*`, `/agent/*` → `localhost:3000`
- SSL via Certbot — include commented setup instructions

### `deploy.sh`

```bash
#!/bin/bash
set -e
git pull
npm ci
npm run migrate
npm run build:server
npm run build:web
pm2 restart reps
echo "reps deployed ✓"
```

---

## Environment Variables (`.env.example`)

```
DATABASE_URL=postgresql://reps:password@localhost:5432/reps
API_KEY=your-secret-key-here
ANTHROPIC_API_KEY=sk-ant-...
PUSHOVER_USER_KEY=
PUSHOVER_API_TOKEN=
RESEND_API_KEY=
PORT=3000
```

---

## `package.json` Scripts

```json
{
  "scripts": {
    "build:server": "tsc --project tsconfig.server.json",
    "build:web": "cd web && vite build",
    "build": "npm run build:server && npm run build:web",
    "migrate": "ts-node server/db/migrate.ts",
    "dev:server": "ts-node-dev server/index.ts",
    "dev:web": "cd web && vite",
    "start": "node dist/server/index.js"
  }
}
```

---

## Hard Constraints

- TypeScript throughout, strict mode
- `postgres.js` for all DB — no Prisma, no Drizzle
- No auth library — Bearer token middleware only
- Reuse `src/spaced-repetition.ts` SM-2 on the server — do not duplicate
- All Claude calls use `claude-sonnet-4-6`
- Always request JSON output from Claude where structured data is needed, parse defensively with try/catch, never let a Claude failure crash a request
- Do not modify existing `src/` CLI files — only add to them
- Data dir is `~/.reps/`

---

## Agent Team Setup

Enable agent teams in `.claude/settings.json`:

```json
{
  "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
}
```

### Initialization prompt (run this first, before spawning the team)

```
Read CLAUDE.md. Before writing any implementation code:
1. Create all directories from the directory structure
2. Create package.json with all dependencies
3. Create tsconfig.json and tsconfig.server.json
4. Create .env.example, .gitignore, and all placeholder files
5. Copy existing CLI src/ files (they already exist — do not overwrite)
6. Commit the scaffold

Then create an agent team to implement reps using the .claude/agents/
definitions. Require plan approval before any teammate makes file changes.
```

### Agent File Ownership

> These boundaries prevent merge conflicts when agents work in parallel.

| Agent             | Owns                                                          |
| ----------------- | ------------------------------------------------------------- |
| `db-architect`    | `server/db/**`, `db/schema.sql`                               |
| `api-builder`     | `server/routes/**`, `server/middleware/**`, `server/index.ts` |
| `agent-builder`   | `server/agent/**`, `server/cron.ts`                           |
| `cli-updater`     | `src/api-client.ts`, `src/index.ts` (additive only)           |
| `web-builder`     | `web/**`                                                      |
| `deploy-engineer` | `deploy/**`, `nginx.conf`                                     |

### Dependency order (agents must respect this)

```
db-architect
    ↓
api-builder  ←────────────────┐
    ↓                         │
agent-builder   cli-updater   web-builder
                              │
                         deploy-engineer (last)
```
