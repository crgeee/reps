# Learning Tracks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add interactive "Learning Tracks" to reps.sh — learn-by-doing with in-browser code editor, Docker-sandboxed execution, and AI evaluation. Flask/Python first track.

**Architecture:** New DB tables (tracks, modules, exercises, submissions, user_progress, settings), new Hono route group at `/learn/*`, Docker container execution service, Monaco editor frontend with split-pane exercise view. SM-2 reused at module level. Feature-flagged behind `FEATURE_LEARNING_TRACKS` env var.

**Tech Stack:** Hono, postgres.js, Zod, Docker (child_process spawn), Monaco Editor (@monaco-editor/react), existing Pino logger, existing auth middleware, existing AI provider abstraction.

---

### Task 1: Database Migration — Core Tables

**Files:**
- Create: `db/015-learning-tracks.sql`

**Step 1: Write the migration SQL**

Create `db/015-learning-tracks.sql`:

```sql
CREATE TABLE IF NOT EXISTS tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id       UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  sort_order     INT NOT NULL,
  prerequisites  UUID[] DEFAULT '{}',
  concepts       TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(track_id, slug)
);

CREATE TABLE IF NOT EXISTS user_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id     UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'active', 'completed')),
  repetitions   INT DEFAULT 0,
  interval      INT DEFAULT 1,
  ease_factor   FLOAT DEFAULT 2.5,
  next_review   DATE,
  last_reviewed DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

CREATE TABLE IF NOT EXISTS exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('code', 'knowledge', 'mini-app')),
  prompt        TEXT NOT NULL,
  starter_code  TEXT,
  test_code     TEXT,
  difficulty    INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  generated_by  TEXT NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'manual')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_code     TEXT NOT NULL,
  stdout        TEXT,
  stderr        TEXT,
  passed        BOOLEAN,
  ai_feedback   TEXT,
  score         INT CHECK (score BETWEEN 1 AND 5),
  execution_ms  INT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_modules_track_order ON modules(track_id, sort_order);
CREATE INDEX idx_user_progress_user_module ON user_progress(user_id, module_id);
CREATE INDEX idx_exercises_module ON exercises(module_id);
CREATE INDEX idx_submissions_exercise ON submissions(exercise_id);
CREATE INDEX idx_submissions_user ON submissions(user_id, created_at DESC);
```

**Step 2: Run migration locally**

Run: `npm run migrate`
Expected: Migration applies successfully.

**Step 3: Commit**

```bash
git add db/015-learning-tracks.sql
git commit -m "feat: add learning tracks database schema"
```

---

### Task 2: Seed Flask Track Data

**Files:**
- Create: `db/016-seed-flask-track.sql`

**Step 1: Write the seed migration**

Create `db/016-seed-flask-track.sql`:

```sql
INSERT INTO tracks (id, slug, title, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'flask', 'Flask', 'Learn Flask by building — routes, templates, databases, APIs, and deployment.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO modules (id, track_id, slug, title, description, sort_order, concepts) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'hello-flask',  'Hello Flask',    'Create your first Flask app, run the dev server, understand the request-response cycle.', 1,  ARRAY['Flask', 'app factory', 'development server', 'WSGI', 'request-response cycle']),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'routing',      'Routing',        'URL rules, dynamic segments, HTTP methods, URL building with url_for.', 2,  ARRAY['@app.route', 'URL parameters', 'converters', 'HTTP methods', 'url_for']),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'templates',    'Templates',      'Jinja2 templating, template inheritance, filters, and macros.', 3,  ARRAY['Jinja2', 'render_template', 'template inheritance', 'filters', 'macros', 'autoescape']),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'forms-input',  'Forms & Input',  'Handle form submissions, access request data, validate user input.', 4,  ARRAY['request.form', 'request.args', 'request.json', 'file uploads', 'flash messages']),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'database',     'Database',       'SQLAlchemy basics, define models, perform CRUD operations, run migrations.', 5,  ARRAY['Flask-SQLAlchemy', 'db.Model', 'db.session', 'CRUD', 'relationships', 'Flask-Migrate']),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'auth',         'Authentication', 'User sessions, login/logout, password hashing, login_required decorator.', 6,  ARRAY['Flask-Login', 'sessions', 'werkzeug.security', 'login_required', 'current_user']),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'rest-apis',    'REST APIs',      'Build JSON APIs, handle request parsing, error responses, and status codes.', 7,  ARRAY['jsonify', 'request.get_json', 'abort', 'error handlers', 'HTTP status codes']),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'blueprints',   'Blueprints',     'Organize large apps with blueprints, register URL prefixes, share templates.', 8,  ARRAY['Blueprint', 'register_blueprint', 'url_prefix', 'blueprint templates', 'app factory pattern']),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'testing',      'Testing',        'Write tests with pytest, use the test client, fixtures, and test configuration.', 9,  ARRAY['pytest', 'app.test_client', 'fixtures', 'test config', 'coverage']),
  ('b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', 'deployment',   'Deployment',     'Production setup with Gunicorn, environment config, logging, and common patterns.', 10, ARRAY['gunicorn', 'config classes', 'environment variables', 'logging', 'error pages'])
ON CONFLICT DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('learn.maxExecutionTime', '30'),
  ('learn.maxMemoryMb', '128'),
  ('learn.maxConcurrent', '1'),
  ('learn.circuitBreakerThreshold', '5'),
  ('learn.circuitBreakerCooldownMin', '5'),
  ('learn.featureEnabled', 'true')
ON CONFLICT (key) DO NOTHING;
```

**Step 2: Run migration**

Run: `npm run migrate`

**Step 3: Commit**

```bash
git add db/016-seed-flask-track.sql
git commit -m "feat: seed Flask track with modules and default settings"
```

---

### Task 3: Docker Runner Infrastructure

**Files:**
- Create: `deploy/Dockerfile.runner-python`
- Create: `server/learn/docker-runner.ts`
- Create: `server/learn/docker-runner.test.ts`

**Step 1: Write the Dockerfile**

Create `deploy/Dockerfile.runner-python`:

```dockerfile
FROM python:3.12-slim@sha256:af4e85f1cac90dd3771e47292ea7c8a9830abfabbe4faa5c53f158854c2e819d

RUN pip install --no-cache-dir flask==3.1.1 sqlalchemy==2.0.41 pytest==8.3.5 \
    && useradd -m -u 1000 runner

USER runner
WORKDIR /app

CMD ["python", "/app/code.py"]
```

**Step 2: Write the failing tests**

Create `server/learn/docker-runner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

import { ExecutionQueue, CircuitBreaker, sanitizeOutput } from './docker-runner.js';

describe('ExecutionQueue', () => {
  let queue: ExecutionQueue;

  beforeEach(() => {
    queue = new ExecutionQueue({ maxConcurrent: 1 });
  });

  it('tracks active execution count', () => {
    expect(queue.activeCount).toBe(0);
  });

  it('reports isBusy when at max concurrent', () => {
    expect(queue.isBusy).toBe(false);
    queue.acquire();
    expect(queue.isBusy).toBe(true);
  });

  it('releases slots', () => {
    queue.acquire();
    queue.release();
    expect(queue.isBusy).toBe(false);
  });
});

describe('CircuitBreaker', () => {
  it('opens after consecutive failures', () => {
    const breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 1000 });
    expect(breaker.isOpen).toBe(false);
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen).toBe(true);
  });

  it('resets on success', () => {
    const breaker = new CircuitBreaker({ threshold: 3, cooldownMs: 1000 });
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    expect(breaker.isOpen).toBe(false);
  });
});

describe('sanitizeOutput', () => {
  it('escapes HTML entities', () => {
    expect(sanitizeOutput('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('truncates output exceeding max length', () => {
    const long = 'a'.repeat(70000);
    const result = sanitizeOutput(long, 65536);
    expect(result.length).toBeLessThanOrEqual(65536 + 50);
    expect(result).toContain('[truncated]');
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run server/learn/docker-runner.test.ts`
Expected: FAIL — module not found.

**Step 4: Implement the Docker runner**

Create `server/learn/docker-runner.ts`:

```typescript
import { spawn } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

export interface QueueConfig {
  maxConcurrent: number;
}

export class ExecutionQueue {
  private active = 0;
  private max: number;

  constructor(config: QueueConfig) {
    this.max = config.maxConcurrent;
  }

  get activeCount(): number {
    return this.active;
  }

  get isBusy(): boolean {
    return this.active >= this.max;
  }

  acquire(): boolean {
    if (this.isBusy) return false;
    this.active++;
    return true;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
  }
}

export interface CircuitBreakerConfig {
  threshold: number;
  cooldownMs: number;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private threshold: number;
  private cooldownMs: number;

  constructor(config: CircuitBreakerConfig) {
    this.threshold = config.threshold;
    this.cooldownMs = config.cooldownMs;
  }

  get isOpen(): boolean {
    if (this.failures < this.threshold) return false;
    if (this.openedAt && Date.now() - this.openedAt > this.cooldownMs) {
      this.failures = 0;
      this.openedAt = null;
      return false;
    }
    return true;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.openedAt = Date.now();
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }
}

export function sanitizeOutput(output: string, maxLength = 65536): string {
  let sanitized = output
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '\n[truncated]';
  }

  return sanitized;
}

export interface RunCodeOptions {
  code: string;
  timeoutSeconds?: number;
  memoryMb?: number;
  image?: string;
}

export async function runCode(options: RunCodeOptions): Promise<ExecutionResult> {
  const {
    code,
    timeoutSeconds = 30,
    memoryMb = 128,
    image = 'reps-runner-python',
  } = options;

  const executionId = randomUUID();
  const codeDir = join(tmpdir(), `reps-code-${executionId}`);
  const codePath = join(codeDir, 'code.py');

  await mkdir(codeDir, { recursive: true });
  await writeFile(codePath, code, 'utf-8');

  const start = Date.now();

  try {
    return await new Promise<ExecutionResult>((resolve) => {
      const args = [
        'run', '--rm',
        '--network=none',
        `--memory=${memoryMb}m`,
        '--cpus=0.5',
        '--read-only',
        '--tmpfs', '/tmp:size=10m,noexec,nosuid',
        '--no-new-privileges',
        '--cap-drop=ALL',
        '--pids-limit=50',
        '--ulimit', 'nproc=64:64',
        '--ulimit', 'fsize=10485760:10485760',
        '--security-opt=seccomp=default',
        '--user', '1000:1000',
        '-v', `${codePath}:/app/code.py:ro`,
        image,
        'timeout', String(timeoutSeconds), 'python', '/app/code.py',
      ];

      const proc = spawn('docker', args);
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      proc.stdout.on('data', (data: Buffer) => {
        if (stdout.length < 65536) stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        if (stderr.length < 65536) stderr += data.toString();
      });

      const killTimer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
      }, (timeoutSeconds + 5) * 1000);

      proc.on('close', (exitCode) => {
        clearTimeout(killTimer);
        if (exitCode === 124) timedOut = true;
        resolve({
          stdout: sanitizeOutput(stdout),
          stderr: sanitizeOutput(stderr),
          exitCode: exitCode ?? 1,
          durationMs: Date.now() - start,
          timedOut,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(killTimer);
        resolve({
          stdout: '',
          stderr: sanitizeOutput(err.message),
          exitCode: 1,
          durationMs: Date.now() - start,
          timedOut: false,
        });
      });
    });
  } finally {
    await rm(codeDir, { recursive: true, force: true }).catch(() => {});
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run server/learn/docker-runner.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add deploy/Dockerfile.runner-python server/learn/docker-runner.ts server/learn/docker-runner.test.ts
git commit -m "feat: add Docker code runner with queue, circuit breaker, and output sanitization"
```

---

### Task 4: Learning Tracks API — Read Routes

**Files:**
- Create: `server/routes/learn.ts`
- Create: `server/routes/learn.test.ts`
- Modify: `server/index.ts` (add route registration)

**Step 1: Write the failing tests**

Create `server/routes/learn.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ default: vi.fn() }));

import { toTrack, toModule, toProgress } from './learn.js';

describe('toTrack', () => {
  it('converts DB row to Track', () => {
    const row = { id: '123', slug: 'flask', title: 'Flask', description: 'Learn Flask', image_url: null, created_at: '2026-01-01', module_count: '10' };
    const result = toTrack(row);
    expect(result).toEqual({ id: '123', slug: 'flask', title: 'Flask', description: 'Learn Flask', imageUrl: null, createdAt: '2026-01-01', moduleCount: 10 });
  });
});

describe('toModule', () => {
  it('converts DB row to Module', () => {
    const row = { id: '456', track_id: '123', slug: 'routing', title: 'Routing', description: 'URL rules', sort_order: 2, prerequisites: [], concepts: ['routes', 'url_for'], created_at: '2026-01-01' };
    const result = toModule(row);
    expect(result).toEqual({ id: '456', trackId: '123', slug: 'routing', title: 'Routing', description: 'URL rules', sortOrder: 2, prerequisites: [], concepts: ['routes', 'url_for'], createdAt: '2026-01-01' });
  });
});

describe('toProgress', () => {
  it('converts DB row to UserProgress', () => {
    const row = { id: '789', user_id: 'u1', module_id: '456', status: 'active', repetitions: 2, interval: 6, ease_factor: 2.5, next_review: '2026-01-07', last_reviewed: '2026-01-01', created_at: '2026-01-01' };
    const result = toProgress(row);
    expect(result).toEqual({ id: '789', userId: 'u1', moduleId: '456', status: 'active', repetitions: 2, interval: 6, easeFactor: 2.5, nextReview: '2026-01-07', lastReviewed: '2026-01-01', createdAt: '2026-01-01' });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run server/routes/learn.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the routes**

Create `server/routes/learn.ts` — full Hono router with:
- Feature flag middleware checking `settings` table for `learn.featureEnabled`
- `GET /tracks` — list all tracks with module count
- `GET /tracks/:slug` — track detail with modules and user progress
- `GET /tracks/:slug/progress` — user progress for a track
- `POST /modules/:id/start` — unlock a module (check prerequisites)
- `POST /modules/:id/review` — SM-2 review (imports `calculateSM2` from `../../src/spaced-repetition.js`)
- `GET /modules/:id` — module detail with exercises
- `GET /submissions/:exerciseId` — submission history
- Export converter functions: `toTrack`, `toModule`, `toProgress`

See Task 4 in the full plan content above for complete implementation.

**Step 4: Register routes in `server/index.ts`**

After the existing route registrations (find `app.route('/agent', agent)` or similar), add:

```typescript
import learn from './routes/learn.js';
app.route('/learn', learn);
```

**Step 5: Run tests**

Run: `npx vitest run server/routes/learn.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add server/routes/learn.ts server/routes/learn.test.ts server/index.ts
git commit -m "feat: add learning tracks API routes (tracks, modules, progress)"
```

---

### Task 5: Exercise Generation & Code Execution Routes

**Files:**
- Modify: `server/routes/learn.ts` (add exercise generation, run, submit routes)

**Step 1: Add routes to `server/routes/learn.ts`**

Add before `export default learn`:
- `POST /exercises/generate` — AI-generated exercise using BYOK credentials and `createCompletion` from `../agent/provider.js`
- `POST /exercises/:id/run` — run code in Docker (no evaluation), uses ExecutionQueue and CircuitBreaker singletons
- `POST /exercises/:id/submit` — run code + AI evaluation, save submission to DB

All routes include structured logging with `code-execution:` and `learn:` prefixes.

See Task 5 in the full plan content above for complete implementation.

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add server/routes/learn.ts
git commit -m "feat: add exercise generation, code execution, and submission routes"
```

---

### Task 6: Admin Settings Routes

**Files:**
- Create: `server/routes/learn-admin.ts`
- Modify: `server/index.ts` (register admin routes)

**Step 1: Implement admin routes**

Create `server/routes/learn-admin.ts`:
- `GET /stats` — execution stats (today, total, avg time, success rate)
- `GET /config` — current settings (all `learn.*` keys)
- `POST /config` — update settings
- `GET /submissions` — recent submissions with exercise/module/track details (paginated)
- `POST /tracks` — create a new track
- `DELETE /tracks/:id` — delete a track

See Task 6 in the full plan content above for complete implementation.

**Step 2: Register in `server/index.ts`**

```typescript
import learnAdmin from './routes/learn-admin.js';
app.route('/admin/learn', learnAdmin);
```

**Step 3: Commit**

```bash
git add server/routes/learn-admin.ts server/index.ts
git commit -m "feat: add admin routes for learning tracks config and stats"
```

---

### Task 7: Nginx Configuration Update

**Files:**
- Modify: `deploy/nginx.conf`

**Step 1: Add location blocks**

After the existing `/api/agent/` location block, add:
- `/api/learn/` — proxied to backend with `proxy_read_timeout 45s` for Docker execution, reuses `agent` rate limit zone
- `/api/admin/learn/` — proxied to backend with standard rate limits

**Step 2: Update CSP header**

Add `worker-src 'self' blob:` to the Content-Security-Policy for Monaco editor workers.

**Step 3: Commit**

```bash
git add deploy/nginx.conf
git commit -m "feat: add nginx config for learning tracks and Monaco CSP"
```

---

### Task 8: Frontend — API Layer & Types

**Files:**
- Create: `web/src/learn-types.ts`
- Create: `web/src/learn-api.ts`

**Step 1: Create types**

Create `web/src/learn-types.ts` with: `Track`, `Module`, `ModuleProgress`, `TrackDetail`, `Exercise`, `ExecutionResult`, `AiFeedback`, `Submission`, `LearnStats`.

**Step 2: Create API layer**

Create `web/src/learn-api.ts` with typed fetch wrapper using existing BYOK pattern (`X-AI-Key`, `X-AI-Provider` headers from localStorage). Exports: `getTracks`, `getTrack`, `startModule`, `reviewModule`, `generateExercise`, `runCode`, `submitCode`, `getSubmissions`, `getLearnStats`, `getLearnConfig`, `updateLearnConfig`.

See Task 8 in the full plan content above for complete implementation.

**Step 3: Commit**

```bash
git add web/src/learn-types.ts web/src/learn-api.ts
git commit -m "feat: add learning tracks frontend types and API layer"
```

---

### Task 9: Frontend — Track List Page

**Files:**
- Create: `web/src/components/learn/TrackList.tsx`

**Step 1: Implement the track list view**

Grid of tracks with progress indicators, using `getTracks()`. Each track links to `/learn/:slug`. Uses `BookOpen` icon, zinc/blue color scheme matching existing UI.

See Task 9 in the full plan content above for complete implementation.

**Step 2: Commit**

```bash
git add web/src/components/learn/TrackList.tsx
git commit -m "feat: add TrackList page component"
```

---

### Task 10: Frontend — Track Detail Page

**Files:**
- Create: `web/src/components/learn/TrackDetail.tsx`

**Step 1: Implement the track detail view**

Module list with lock/active/completed states. Progress bar showing completion. Module cards with concepts, status icons, and click-to-unlock/navigate. Uses `getTrack()` and `startModule()`.

See Task 10 in the full plan content above for complete implementation.

**Step 2: Commit**

```bash
git add web/src/components/learn/TrackDetail.tsx
git commit -m "feat: add TrackDetail page with module progression"
```

---

### Task 11: Frontend — Exercise View with Monaco Editor

**Files:**
- Create: `web/src/components/learn/ExerciseView.tsx`

**Step 1: Install Monaco editor**

```bash
cd web && npm install @monaco-editor/react && cd ..
```

**Step 2: Implement exercise view**

Split-pane layout: Monaco editor (left) + output/feedback (right). Features:
- Lazy-loaded Monaco with Python syntax highlighting
- "Run Code" button with 2s debounce cooldown
- "Submit" button for AI evaluation
- Output panel showing stdout/stderr/exit code/timing
- AI feedback panel with correctness/quality/completeness scores
- Hints toggle
- "New Exercise" button to generate another
- Error states for queue full (429) and circuit breaker (503)

See Task 11 in the full plan content above for complete implementation.

**Step 3: Commit**

```bash
git add web/src/components/learn/ExerciseView.tsx
git commit -m "feat: add ExerciseView with Monaco editor and split-pane output"
```

---

### Task 12: Frontend — Route Registration & Navigation

**Files:**
- Modify: `web/src/router.tsx` (add learn routes)
- Modify: `web/src/layouts/ProtectedLayout.tsx` (add nav item)

**Step 1: Add lazy imports and routes to `web/src/router.tsx`**

```typescript
const TrackList = lazy(() => import('./components/learn/TrackList.js'));
const TrackDetail = lazy(() => import('./components/learn/TrackDetail.js'));
const ExerciseView = lazy(() => import('./components/learn/ExerciseView.js'));
```

Add routes inside protected layout children:
```typescript
{ path: '/learn', element: <TrackList /> },
{ path: '/learn/:slug', element: <TrackDetail /> },
{ path: '/learn/:slug/:moduleSlug/exercise', element: <ExerciseView /> },
```

**Step 2: Add "Learn" nav item to `ProtectedLayout.tsx`**

Add `{ to: '/learn', icon: BookOpen, label: 'Learn' }` to the navigation items array. Import `BookOpen` from `lucide-react`.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project web/tsconfig.json`
Expected: No errors.

**Step 4: Commit**

```bash
git add web/src/router.tsx web/src/layouts/ProtectedLayout.tsx
git commit -m "feat: add Learn routes and navigation item"
```

---

### Task 13: Frontend — Admin Settings Section

**Files:**
- Modify: `web/src/components/settings/AdminSettings.tsx`

**Step 1: Add learning tracks admin section**

Add a "Learning Tracks" section with:
- Stats display (executions today, total, avg time, success rate) from `getLearnStats()`
- Config fields: feature enabled toggle, max execution time, max memory, max concurrent
- Save button calling `updateLearnConfig()`

Match existing settings component patterns.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project web/tsconfig.json`

**Step 3: Commit**

```bash
git add web/src/components/settings/AdminSettings.tsx
git commit -m "feat: add learning tracks admin settings section"
```

---

### Task 14: Hetzner VPS Preparation Script

**Files:**
- Create: `deploy/setup-docker.sh`
- Create: `deploy/Dockerfile.runner-python` (if not already created in Task 3)

**Step 1: Write the setup script**

Create `deploy/setup-docker.sh` that:
1. Adds 2GB swap if not present
2. Installs Docker if not installed
3. Builds the `reps-runner-python` image
4. Adds Docker cleanup cron (`0 3 * * *`)
5. Adds container sweeper cron (`*/5 * * * *`)
6. Adds `FEATURE_LEARNING_TRACKS=true` to `.env` if not present

See Task 14 in the full plan content above for complete implementation.

**Step 2: Make executable and commit**

```bash
chmod +x deploy/setup-docker.sh
git add deploy/setup-docker.sh
git commit -m "feat: add Docker setup script for Hetzner VPS"
```

---

### Task 15: Integration Testing & Pre-push Checks

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Run linting and formatting**

```bash
npm run format:check
npm run lint
```

Fix any issues found.

**Step 3: Run TypeScript checks**

```bash
npx tsc --noEmit
npx tsc --noEmit --project web/tsconfig.json
```

Expected: No errors.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and type errors"
```

---

### Task 16: Create Pull Request

**Step 1: Push branch**

```bash
git push -u origin feat/learning-tracks
```

**Step 2: Create PR**

```bash
gh pr create --title "feat: add interactive Learning Tracks with Docker code execution" --body "$(cat <<'EOF'
## Summary

- Adds Learning Tracks feature to reps.sh — learn technologies by doing
- Flask/Python as first track with 10 structured modules
- In-browser Monaco code editor with Docker-sandboxed Python execution
- AI-generated exercises with structured evaluation and feedback
- SM-2 spaced repetition at the module level
- Admin settings for execution config, stats, and feature toggle
- Security: network isolation, memory/CPU/PID limits, output sanitization, circuit breaker
- Nginx rate limiting and CSP updates for Monaco
- Hetzner VPS setup script (swap, Docker, cleanup crons)

## Test plan

- [ ] Run migration locally, verify tables created
- [ ] Start dev server, navigate to /learn, see Flask track
- [ ] Click into Flask track, see 10 modules with locked/active states
- [ ] Start first module, verify it unlocks
- [ ] Generate an exercise, see prompt and starter code
- [ ] Write code in Monaco editor, click Run, see output
- [ ] Click Submit, see AI evaluation with scores
- [ ] Check admin settings page shows execution stats
- [ ] Run `npx vitest run` — all tests pass
- [ ] Run `npx tsc --noEmit` — no type errors
- [ ] Run Docker setup script on Hetzner (after merge)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
