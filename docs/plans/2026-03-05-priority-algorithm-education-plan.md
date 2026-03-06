# Priority Algorithm, Educational UX & Marketing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a weighted priority scoring algorithm, educational tooltips + How It Works page, blog, and enhanced login page marketing.

**Architecture:** Server-side priority scoring in `server/lib/priority.ts` attached to task responses. Frontend adds InfoTooltip component, HowItWorks page, Blog pages, and login page enhancements. All new routes registered in router.tsx.

**Tech Stack:** TypeScript, Hono (server), React + Tailwind (frontend), Vitest (tests), postgres.js (DB queries for AI scores)

---

### Task 1: Priority Scoring Module — Tests

**Files:**

- Create: `server/lib/priority.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { calculatePriorityScore, type PriorityFactors } from './priority.js';

describe('calculatePriorityScore', () => {
  const baseTask = {
    nextReview: new Date().toISOString().slice(0, 10),
    deadline: null as string | null,
    easeFactor: 2.5,
    lastReviewed: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString().slice(0, 10),
  };

  it('returns 0 for a task with no urgency signals', () => {
    const task = {
      ...baseTask,
      easeFactor: 3.0,
      lastReviewed: new Date().toISOString().slice(0, 10),
    };
    const result = calculatePriorityScore(task, null);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(20);
  });

  it('scores high for an overdue task', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    const task = {
      ...baseTask,
      nextReview: pastDate.toISOString().slice(0, 10),
    };
    const result = calculatePriorityScore(task, null);
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.factors.overdue_urgency).toBe(100);
  });

  it('scores high when deadline is today', () => {
    const task = {
      ...baseTask,
      deadline: new Date().toISOString().slice(0, 10),
    };
    const result = calculatePriorityScore(task, null);
    expect(result.factors.deadline_pressure).toBe(100);
  });

  it('deadline_pressure is 0 when no deadline', () => {
    const result = calculatePriorityScore(baseTask, null);
    expect(result.factors.deadline_pressure).toBe(0);
  });

  it('difficulty is higher for low ease factor', () => {
    const hard = calculatePriorityScore({ ...baseTask, easeFactor: 1.3 }, null);
    const easy = calculatePriorityScore({ ...baseTask, easeFactor: 3.0 }, null);
    expect(hard.factors.difficulty).toBeGreaterThan(easy.factors.difficulty);
  });

  it('staleness increases with days since last activity', () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 30);
    const stale = calculatePriorityScore(
      { ...baseTask, lastReviewed: staleDate.toISOString().slice(0, 10) },
      null,
    );
    const fresh = calculatePriorityScore(baseTask, null);
    expect(stale.factors.staleness).toBeGreaterThan(fresh.factors.staleness);
  });

  it('factors in AI weakness when scores provided', () => {
    const result = calculatePriorityScore(baseTask, { avgScore: 1.5 });
    expect(result.factors.ai_weakness).toBe(70);
  });

  it('ai_weakness is 0 when no AI data', () => {
    const result = calculatePriorityScore(baseTask, null);
    expect(result.factors.ai_weakness).toBe(0);
  });

  it('score is clamped to 0-100', () => {
    const extreme = new Date();
    extreme.setDate(extreme.getDate() - 100);
    const result = calculatePriorityScore(
      {
        ...baseTask,
        nextReview: extreme.toISOString().slice(0, 10),
        deadline: new Date().toISOString().slice(0, 10),
        easeFactor: 1.3,
        lastReviewed: extreme.toISOString().slice(0, 10),
      },
      { avgScore: 1.0 },
    );
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run server/lib/priority.test.ts`
Expected: FAIL — module not found

---

### Task 2: Priority Scoring Module — Implementation

**Files:**

- Create: `server/lib/priority.ts`

**Step 1: Implement the module**

```typescript
export interface PriorityInput {
  nextReview: string;
  deadline: string | null;
  easeFactor: number;
  lastReviewed: string | null;
  createdAt: string;
}

export interface AiScoreInput {
  avgScore: number; // average of clarity + specificity + missionAlignment (1-5 scale)
}

export interface PriorityFactors {
  overdue_urgency: number;
  deadline_pressure: number;
  difficulty: number;
  staleness: number;
  ai_weakness: number;
}

export interface PriorityResult {
  score: number;
  factors: PriorityFactors;
}

const WEIGHTS = {
  overdue_urgency: 0.3,
  deadline_pressure: 0.25,
  difficulty: 0.2,
  staleness: 0.15,
  ai_weakness: 0.1,
};

function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculatePriorityScore(
  task: PriorityInput,
  aiData: AiScoreInput | null,
): PriorityResult {
  const today = todayStr();

  // Overdue urgency: 0 if not overdue, maxes at ~7 days overdue
  const daysOverdue = Math.max(0, daysBetween(task.nextReview, today));
  const overdue_urgency = clamp(daysOverdue * 15, 0, 100);

  // Deadline pressure: 100 at deadline, 0 if 10+ days away, 0 if no deadline
  let deadline_pressure = 0;
  if (task.deadline) {
    const daysUntil = daysBetween(today, task.deadline);
    deadline_pressure = clamp(100 - daysUntil * 10, 0, 100);
  }

  // Difficulty: inverse of ease factor (1.3 = hardest = 100, 3.0+ = 0)
  const difficulty = clamp(((3.0 - task.easeFactor) / 1.7) * 100, 0, 100);

  // Staleness: days since last activity, maxes at ~30 days
  const lastActivity = task.lastReviewed ?? task.createdAt;
  const daysSinceActivity = Math.max(0, daysBetween(lastActivity, today));
  const staleness = clamp(daysSinceActivity * 3.3, 0, 100);

  // AI weakness: 100 - avgScore * 20 (low AI scores = high priority)
  let ai_weakness = 0;
  if (aiData) {
    ai_weakness = clamp(100 - aiData.avgScore * 20, 0, 100);
  }

  const factors: PriorityFactors = {
    overdue_urgency,
    deadline_pressure,
    difficulty,
    staleness,
    ai_weakness,
  };

  const score = clamp(
    Math.round(
      WEIGHTS.overdue_urgency * overdue_urgency +
        WEIGHTS.deadline_pressure * deadline_pressure +
        WEIGHTS.difficulty * difficulty +
        WEIGHTS.staleness * staleness +
        WEIGHTS.ai_weakness * ai_weakness,
    ),
    0,
    100,
  );

  return { score, factors };
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run server/lib/priority.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add server/lib/priority.ts server/lib/priority.test.ts
git commit -m "feat: add weighted priority scoring algorithm (0-100)"
```

---

### Task 3: Wire Priority Scores into Task API Responses

**Files:**

- Modify: `server/routes/tasks.ts:347-382` (GET /tasks/due) and `server/routes/tasks.ts:385-428` (GET /tasks)

**Step 1: Add AI score query helper to tasks.ts**

At the top of the file after existing imports, add:

```typescript
import { calculatePriorityScore, type PriorityResult } from '../lib/priority.js';
```

Add helper function after the existing helpers:

```typescript
async function fetchAiScores(taskIds: string[]): Promise<Map<string, { avgScore: number }>> {
  const map = new Map<string, { avgScore: number }>();
  if (taskIds.length === 0) return map;

  const rows = await sql<{ task_id: string; avg_score: number }[]>`
    SELECT task_id, AVG(
      (
        COALESCE((output::json->>'clarity')::numeric, 3) +
        COALESCE((output::json->>'specificity')::numeric, 3) +
        COALESCE((output::json->>'missionAlignment')::numeric, 3)
      ) / 3.0
    ) as avg_score
    FROM agent_logs
    WHERE task_id = ANY(${taskIds}) AND type = 'evaluation'
    GROUP BY task_id
  `;

  for (const r of rows) {
    map.set(r.task_id, { avgScore: Number(r.avg_score) });
  }
  return map;
}
```

**Step 2: Modify rowToTask to accept optional priorityScore**

Update the `rowToTask` return type to include `priorityScore?: PriorityResult`.

In GET /tasks and GET /tasks/due, after building the result array, compute priority scores:

```typescript
// After building `result` array:
const aiScores = await fetchAiScores(taskIds);
const withPriority = result.map((t) => ({
  ...t,
  priorityScore: calculatePriorityScore(
    {
      nextReview: t.nextReview,
      deadline: t.deadline ?? null,
      easeFactor: t.easeFactor,
      lastReviewed: t.lastReviewed ?? null,
      createdAt: t.createdAt,
    },
    aiScores.get(t.id) ?? null,
  ),
}));
```

For GET /tasks/due, sort by priority score descending:

```typescript
withPriority.sort((a, b) => b.priorityScore.score - a.priorityScore.score);
return c.json(withPriority);
```

**Step 3: Update the web types**

In `web/src/types.ts`, add to the Task interface:

```typescript
priorityScore?: {
  score: number;
  factors: {
    overdue_urgency: number;
    deadline_pressure: number;
    difficulty: number;
    staleness: number;
    ai_weakness: number;
  };
};
```

**Step 4: Run existing tests**

Run: `npx vitest run server/routes/tasks.test.ts`
Expected: PASS (existing tests should still work since priorityScore is additive)

**Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add server/routes/tasks.ts web/src/types.ts
git commit -m "feat: attach priority scores to task API responses"
```

---

### Task 4: Frontend — Priority Sort Option + Dashboard Priority Column

**Files:**

- Modify: `web/src/hooks/useFilteredTasks.ts`
- Modify: `web/src/components/FilterBar.tsx`
- Modify: `web/src/components/Dashboard.tsx`

**Step 1: Add 'priority' to SortField type**

In `useFilteredTasks.ts`, update the SortField type:

```typescript
export type SortField = 'created' | 'next-review' | 'deadline' | 'ease-factor' | 'priority';
```

Add priority case to `sortTasks`:

```typescript
case 'priority':
  cmp = (a.priorityScore?.score ?? 0) - (b.priorityScore?.score ?? 0);
  break;
```

**Step 2: Add Priority option to FilterBar**

In `FilterBar.tsx`, add to SORT_OPTIONS:

```typescript
{ value: 'priority', label: 'Priority' },
```

**Step 3: Add priority column to Dashboard due table**

In `Dashboard.tsx`, add a priority score badge to each row in the due table. Color-code it: red for 80+, amber for 50-79, green for <50.

```tsx
{
  task.priorityScore && (
    <span
      className={`font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
        task.priorityScore.score >= 80
          ? 'bg-red-500/20 text-red-400'
          : task.priorityScore.score >= 50
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-green-500/20 text-green-400'
      }`}
      title={`Priority: ${task.priorityScore.score}`}
    >
      P{task.priorityScore.score}
    </span>
  );
}
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors

**Step 5: Commit**

```bash
git add web/src/hooks/useFilteredTasks.ts web/src/components/FilterBar.tsx web/src/components/Dashboard.tsx
git commit -m "feat: add priority sort option and priority badges to dashboard"
```

---

### Task 5: InfoTooltip Component

**Files:**

- Create: `web/src/components/InfoTooltip.tsx`

**Step 1: Create the component**

```tsx
import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  content: React.ReactNode;
  learnMoreHref?: string;
}

export default function InfoTooltip({ content, learnMoreHref }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-zinc-600 hover:text-zinc-400 transition-colors"
        aria-label="More info"
        type="button"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 text-[11px] text-zinc-300 leading-relaxed">
          {content}
          {learnMoreHref && (
            <a
              href={learnMoreHref}
              className="block mt-2 text-amber-500/80 hover:text-amber-400 transition-colors"
            >
              Learn more →
            </a>
          )}
        </div>
      )}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/components/InfoTooltip.tsx
git commit -m "feat: add InfoTooltip component for educational popovers"
```

---

### Task 6: Add Tooltips to Dashboard, Review Session, and Topic Progress

**Files:**

- Modify: `web/src/components/Dashboard.tsx`
- Modify: `web/src/components/ReviewSession.tsx`
- Modify: `web/src/components/TopicProgress.tsx`

**Step 1: Dashboard tooltips**

Import InfoTooltip and add next to:

- "Topics" header → EF tooltip: "Ease Factor from SM-2. Starts at 2.5, drops when you struggle, rises when you nail it."
- Priority score badge → Factor breakdown tooltip showing each factor's name and value as small bars

**Step 2: ReviewSession tooltips**

Add tooltips next to:

- SM-2 rating buttons: "SuperMemo-2 quality rating. 0-2: forgot, resets interval. 3: hard. 4: good. 5: perfect."
- AI evaluation scores: "Scored by Claude. Low scores boost this task's priority."

**Step 3: TopicProgress tooltips**

Add tooltip next to:

- Confidence column: "Based on Ease Factor: Strong (2.5+), Moderate (2.0-2.5), Weak (1.5-2.0), Low (<1.5)"

All tooltips include `learnMoreHref="/how-it-works"`.

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors

**Step 5: Commit**

```bash
git add web/src/components/Dashboard.tsx web/src/components/ReviewSession.tsx web/src/components/TopicProgress.tsx
git commit -m "feat: add educational tooltips for SM-2, priority, and AI scores"
```

---

### Task 7: How It Works Page

**Files:**

- Create: `web/src/components/HowItWorks.tsx`
- Modify: `web/src/router.tsx`

**Step 1: Create the HowItWorks component**

Build a static page with 4 sections matching the design doc:

1. Hero: "The Science Behind Your Prep"
2. Spaced Repetition (SM-2) — with CSS-animated interval timeline
3. Priority Scoring — with factor table and stacked bar visual
4. AI Coaching — with feedback loop diagram
5. The Feedback Loop — circular diagram connecting all three

Use existing dark theme styling (zinc-950 bg, amber-500 accents). Include `Footer` component at bottom.

This is a public route (accessible without login) — register it under PublicLayout in router.tsx.

**Step 2: Add route to router.tsx**

```typescript
const HowItWorks = lazy(() => import('./components/HowItWorks'));

// Under PublicLayout children:
{ path: '/how-it-works', element: <Lazy><HowItWorks /></Lazy> },
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors

**Step 4: Commit**

```bash
git add web/src/components/HowItWorks.tsx web/src/router.tsx
git commit -m "feat: add How It Works educational page"
```

---

### Task 8: Blog System + First Post

**Files:**

- Create: `web/src/data/blog-posts.ts`
- Create: `web/src/components/Blog.tsx`
- Create: `web/src/components/BlogPost.tsx`
- Modify: `web/src/router.tsx`

**Step 1: Create blog data**

```typescript
// web/src/data/blog-posts.ts
export interface BlogPostData {
  slug: string;
  title: string;
  date: string;
  summary: string;
  content: string; // markdown-style content rendered as JSX
}

export const blogPosts: BlogPostData[] = [
  {
    slug: 'why-we-built-a-priority-algorithm',
    title: 'Why We Built a Priority Algorithm for Interview Prep',
    date: '2026-03-05',
    summary:
      'Spaced repetition tells you when to review — but not what to work on first. We built a 5-factor scoring system to fix that.',
    content: `...`, // ~500 words, written in step
  },
];
```

**Step 2: Create Blog listing component**

Simple list of posts with title, date, summary, and link to `/blog/:slug`.

**Step 3: Create BlogPost component**

Renders a single post. Uses `useParams` to look up by slug. Renders content as pre-formatted JSX sections (no markdown parser needed — write content as JSX directly).

**Step 4: Add routes**

Both Blog and BlogPost are public routes under PublicLayout:

```typescript
const Blog = lazy(() => import('./components/Blog'));
const BlogPost = lazy(() => import('./components/BlogPost'));

// Under PublicLayout children:
{ path: '/blog', element: <Lazy><Blog /></Lazy> },
{ path: '/blog/:slug', element: <Lazy><BlogPost /></Lazy> },
```

**Step 5: Write the first blog post content**

~500 words covering:

- The problem: SM-2 is great at scheduling but doesn't prioritize between multiple due tasks
- The solution: weighted linear scoring with 5 factors
- The formula with brief explanation of each factor
- How AI evaluation scores feed back into priority
- The reinforcing loop between SM-2, priority, and AI coaching

**Step 6: Run TypeScript check**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors

**Step 7: Commit**

```bash
git add web/src/data/blog-posts.ts web/src/components/Blog.tsx web/src/components/BlogPost.tsx web/src/router.tsx
git commit -m "feat: add blog with first post on priority algorithm"
```

---

### Task 9: Login Page Enhancement

**Files:**

- Modify: `web/src/components/LoginPage.tsx`

**Step 1: Update FEATURES array**

Replace the feature cards content:

```typescript
const FEATURES = [
  {
    icon: Target, // new import from lucide-react
    title: 'Smart Prioritization',
    description:
      'A weighted algorithm scores every task on urgency, difficulty, staleness, and AI feedback. You always know what to work on next.',
  },
  {
    icon: Brain,
    title: 'Spaced Repetition',
    description:
      "SM-2 schedules reviews at the moment you're about to forget. Intervals grow from 1 day to months as you master topics.",
  },
  {
    icon: Sparkles,
    title: 'AI Interview Coach',
    description:
      'Claude generates Anthropic-style questions, evaluates your answers on clarity, specificity, and mission alignment.',
  },
  {
    icon: Plug,
    title: 'Integrate',
    description:
      'Connect Claude Desktop, Claude Code, or any MCP client directly to your prep data.',
  },
];
```

**Step 2: Add "How it works" teaser section below feature cards**

A 3-step horizontal flow: Schedule → Review → Improve, with a "Learn more" link to /how-it-works. Also add a "Blog" link.

**Step 3: Update Footer**

Add "How It Works" and "Blog" links to Footer.tsx.

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors

**Step 5: Commit**

```bash
git add web/src/components/LoginPage.tsx web/src/components/Footer.tsx
git commit -m "feat: enhance login page marketing copy and add how-it-works teaser"
```

---

### Task 10: Update SEO Metadata

**Files:**

- Modify: `web/index.html`

**Step 1: Update meta tags**

Update the description to mention priority scoring:

```html
<meta
  name="description"
  content="Track tasks with smart priority scoring, build recall with SM-2 spaced repetition, and practice with AI-generated interview questions. Open-source productivity tool for software engineers."
/>
```

Update the structured data featureList to include priority scoring:

```json
"featureList": [
  "Weighted priority scoring algorithm",
  "SM-2 spaced repetition scheduling",
  "AI-generated interview questions with evaluation",
  "AI feedback loop that adjusts task priority",
  "Progress tracking with activity heatmap",
  "Collections, boards, and tags",
  "Data export"
]
```

**Step 2: Commit**

```bash
git add web/index.html
git commit -m "feat: update SEO metadata to reflect priority scoring and AI coaching"
```

---

### Task 11: Pre-Push Checks + Final Verification

**Files:** None (verification only)

**Step 1: Run all checks**

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npx tsc --noEmit --project web/tsconfig.json
npx vitest run
```

**Step 2: Fix any issues found**

If format:check fails: `npx prettier --write <files>`
If lint fails: fix the issues
If tsc fails: fix type errors
If tests fail: fix the tests

**Step 3: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve lint/format/type issues from priority feature"
```

**Step 4: Push and create PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat: priority scoring, educational UX, and marketing updates" --body "..."
```
