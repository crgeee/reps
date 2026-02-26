# Feature Expansion Design — reps v2

**Date:** 2026-02-25
**Status:** Approved

---

## Overview

Expand reps from a single-purpose interview prep tracker into a flexible, collection-based task + review system with 8 new features inspired by Todoist, TickTick, Things 3, Anki/RemNote, and LeetCode.

**Design principles:**

- DRY — shared helpers, no duplicated queries or logic
- Reusable — components and API patterns that work across features
- Performance — single-query aggregations, frontend caching, no unnecessary roundtrips

---

## Feature 1: Collections / Workspaces

Top-level grouping that makes reps usable beyond interview prep.

### Schema

```sql
CREATE TABLE IF NOT EXISTS collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  sr_enabled  BOOLEAN DEFAULT true,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_collection ON tasks(collection_id);
```

### Behavior

- Default collection: "Interview Prep" (SR enabled, migrates all existing tasks)
- When `sr_enabled = false`: tasks skip SM-2 fields, review endpoints return 400, mock interview unavailable
- When `sr_enabled = true`: full SM-2 + AI features available
- Dashboard, stats, heatmap all scope to active collection

### API

```
GET    /collections
POST   /collections         — { name, icon?, color?, srEnabled? }
PATCH  /collections/:id     — update any field
DELETE /collections/:id     — cascades task collection_id to NULL

# All task routes accept ?collection=uuid filter
GET    /tasks?collection=uuid
GET    /tasks/due?collection=uuid
```

### Web

- Collection switcher in header (dropdown or sidebar)
- Active collection stored in URL params or localStorage
- All views filter by active collection

---

## Feature 2: Streaks + Review Heatmap

### Schema

```sql
CREATE TABLE IF NOT EXISTS review_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  quality     INT NOT NULL CHECK (quality BETWEEN 0 AND 5),
  reviewed_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_review_events_date ON review_events(reviewed_at);
CREATE INDEX idx_review_events_collection ON review_events(collection_id);
```

Streaks are computed on-the-fly from `review_events` (no separate table — DRY, single source of truth).

### API

```
GET /stats/streaks?collection=uuid
```

Returns:

```json
{
  "currentStreak": 12,
  "longestStreak": 34,
  "lastReviewDate": "2026-02-25"
}
```

```
GET /stats/heatmap?collection=uuid&days=365
```

Returns:

```json
{
  "2026-02-25": 5,
  "2026-02-24": 3
}
```

### Implementation

- `review_events` row inserted as side-effect of `POST /tasks/:id/review` — one INSERT added to existing route
- Streak calculation: single SQL query with `generate_series` and gap detection
- Heatmap: `SELECT reviewed_at, COUNT(*) FROM review_events WHERE reviewed_at >= $1 GROUP BY reviewed_at`

### Web

- `<Heatmap data={Record<string, number>} />` — reusable, accepts any date->count map
- `<StreakBadge current={number} longest={number} />` — shown on dashboard
- Both components are pure/presentational, no data fetching

---

## Feature 3: Focus Timer (Pomodoro)

### Architecture

Pure frontend — no schema changes, no API calls during timing.

### Component

`<FocusTimer duration={number} onComplete={() => void} />`

- Configurable durations: 25, 15, 5 minutes (stored in localStorage)
- Drift-corrected timing using `Date.now()` delta, not raw `setInterval`
- Visual: circular progress ring with countdown
- Audio notification on complete (Web Audio API, no external files)
- Session log in localStorage: `{ date, duration, taskId? }[]`

### Integration

- Available on ReviewSession page during answer writing
- Available on MockInterview page during timed sessions
- Optional — never blocks the user flow

---

## Feature 4: Tags / Labels

### Schema

```sql
CREATE TABLE IF NOT EXISTS tags (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
```

### API

```
GET    /tags
POST   /tags              — { name, color? }
PATCH  /tags/:id          — update name/color
DELETE /tags/:id          — removes from all tasks

# Tag assignment via task endpoints
PATCH  /tasks/:id         — accepts { tagIds: string[] } (replaces all tags)

# Filtering
GET    /tasks?tags=uuid1,uuid2&collection=uuid
```

### Web — Reusable Components

- `<TagPicker selected={string[]} onChange={fn} />` — used in AddTask, TaskList inline edit, filter bar
- `<TagBadge tag={Tag} />` — used everywhere tags are displayed
- Filter bar on TaskList page: collection + tags + topic

---

## Feature 5: Daily Digest Email

### Architecture

Server-side only. New file: `server/agent/email.ts`.

### Shared Data Helper (DRY)

Extract from `coach.ts`:

```typescript
// server/agent/shared.ts
export interface BriefingData {
  dueToday: Task[];
  upcomingDeadlines: Task[];
  streak: { current: number; longest: number };
  weakestTopic: { topic: string; avgEase: number } | null;
}

export async function getDailyBriefingData(collectionId?: string): Promise<BriefingData>;
```

Used by: `dailyBriefing()`, `weeklyInsight()`, `sendDailyDigest()`.

### Email

- Resend SDK: `server/agent/email.ts`
- HTML template: inline styles (email-safe), dark theme
- Content: due reviews, streak, weakest topic, coaching message (reuses Claude output from briefing)
- Env: `RESEND_API_KEY`, `DIGEST_EMAIL_TO`
- Cron: `'0 8 * * *'` — runs after `dailyBriefing()`, shares the same data

### Fallback

If `RESEND_API_KEY` missing, log to console (same pattern as Pushover).

---

## Feature 6: Calendar View

### Architecture

Pure frontend — no new API endpoints. Uses existing `GET /tasks` data.

### Component

`<CalendarView tasks={Task[]} month={Date} onSelectDate={fn} />`

- Month grid with dots/badges for tasks with `nextReview` or `deadline` on that date
- Color-coded by topic (reuses `TOPIC_COLORS`)
- Click date to see task list for that day
- Navigate months with arrows
- Highlights today, overdue dates in red

### Performance

- No extra API calls — filters from already-fetched task array in App state
- Memoized date grouping with `useMemo`

---

## Feature 7: Review Stats Dashboard

### API

```
GET /stats/overview?collection=uuid
```

Returns:

```json
{
  "totalReviews": 142,
  "reviewsByTopic": { "coding": 45, "system-design": 30 },
  "averageEaseByTopic": { "coding": 2.8, "system-design": 2.1 },
  "reviewsLast30Days": 67,
  "heatmap": { "2026-02-25": 5 },
  "streak": { "current": 12, "longest": 34 }
}
```

Single SQL query with CTEs for all aggregations. Reuses streak/heatmap logic from Feature 2.

### Web

Enhanced Progress page:

- Bar chart: reviews by topic (reusable `<BarChart data={Record<string,number>} />`)
- Ease factor as "confidence" indicator per topic
- Heatmap (reused from Feature 2)
- Streak display (reused from Feature 2)

---

## Feature 8: Mock Interview Mode

### Schema

```sql
CREATE TABLE IF NOT EXISTS mock_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  topic         TEXT NOT NULL,
  difficulty    TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  messages      JSONB NOT NULL DEFAULT '[]',
  score         JSONB,
  started_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_mock_sessions_collection ON mock_sessions(collection_id);
```

### Message Format (JSONB)

```json
[
  { "role": "interviewer", "content": "Design a rate limiter..." },
  { "role": "candidate", "content": "I would start by..." },
  { "role": "interviewer", "content": "Good. How would you handle distributed..." }
]
```

### API

```
POST /agent/mock/start     — { topic?, difficulty?, collectionId? }
                            → { sessionId, question }

POST /agent/mock/respond    — { sessionId, answer }
                            → { followUp: string } | { evaluation: MockScore }

GET  /agent/mock/:id        — get session with messages + score
GET  /agent/mock?collection=uuid — list sessions
```

### AI Logic

1. **Start:** Generate opening question based on topic + difficulty. Use `max_tokens: 400`.
2. **Respond (rounds 1-2):** Claude reads full message history, asks a follow-up that probes deeper. `max_tokens: 300`.
3. **Respond (round 3 or user requests eval):** Full evaluation with structured rubric.

System prompt includes: "You are a senior Anthropic interviewer conducting a multi-turn technical interview."

### Interleaving (evidence-based)

"Surprise me" mode:

1. Query tasks with lowest `ease_factor` across all SR-enabled topics
2. Pick topic that hasn't been practiced in the longest time
3. This implements interleaving (43% improvement per Rohrer & Taylor 2007)

### Score Schema

```json
{
  "clarity": 4,
  "depth": 3,
  "correctness": 4,
  "communication": 5,
  "overall": 4,
  "feedback": "Strong foundation but...",
  "strengths": ["Clear structure", "Good trade-off analysis"],
  "improvements": ["Consider edge cases", "Discuss monitoring"]
}
```

### Web

New view: `MockInterview`

- Topic/difficulty selector (or "Surprise me")
- Chat-style interface for Q&A rounds
- Focus timer running alongside (reuses Feature 3)
- Final scorecard with radar chart
- History of past sessions

---

## Agent Ownership

| Agent             | Files Owned                                                   | New Work                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db-architect`    | `server/db/**`, `db/schema.sql`                               | `collections`, `review_events`, `tags`, `task_tags`, `mock_sessions` tables; migration script; add `collection_id` to tasks; indexes                                                         |
| `api-builder`     | `server/routes/**`, `server/middleware/**`, `server/index.ts` | `/collections` CRUD, `/tags` CRUD, `/stats/*` endpoints, tag filtering on tasks, collection filtering on all routes, mock session CRUD endpoints                                             |
| `agent-builder`   | `server/agent/**`, `server/cron.ts`                           | Mock interview AI logic (`server/agent/mock.ts`), daily digest email (`server/agent/email.ts`), shared briefing data helper (`server/agent/shared.ts`), update coach.ts to use shared helper |
| `web-builder`     | `web/**`                                                      | Collection switcher, Heatmap, StreakBadge, FocusTimer, TagPicker, TagBadge, CalendarView, MockInterview view, BarChart, enhanced Progress/Dashboard, filter bar                              |
| `cli-updater`     | `src/api-client.ts`, `src/index.ts`                           | No changes this round                                                                                                                                                                        |
| `deploy-engineer` | `deploy/**`                                                   | No changes this round                                                                                                                                                                        |

## Dependency Order

```
db-architect (schema + migrations)
    |
api-builder (routes depend on schema)
    |
    +---> agent-builder (AI logic uses routes/db)
    |
    +---> web-builder (UI consumes API)
```

## DRY / Reuse Summary

| Pattern                     | Where Reused                                     |
| --------------------------- | ------------------------------------------------ |
| `getDailyBriefingData()`    | `coach.ts`, `email.ts`, `/stats/overview`        |
| `<Heatmap />` component     | Dashboard, Progress page                         |
| `<StreakBadge />` component | Dashboard, Progress page                         |
| `<TagPicker />` component   | AddTask, TaskList, filter bar                    |
| `<TagBadge />` component    | TaskList, Dashboard, ReviewSession               |
| `<FocusTimer />` component  | ReviewSession, MockInterview                     |
| `<BarChart />` component    | Progress page, stats                             |
| Collection scoping          | All routes, all views, all stats                 |
| `review_events` table       | Streaks, heatmap, stats — single source of truth |

## Performance Notes

- Stats endpoints use CTE-based single queries, not N+1
- Heatmap/streak computed server-side, not client-side iteration
- Calendar view uses `useMemo` on already-fetched tasks
- Focus timer uses `Date.now()` delta, no server calls
- Tag filtering via JOIN, indexed on `task_tags`
- Collection filtering indexed on `tasks.collection_id`
- Mock session messages stored as JSONB — single read/write per turn
