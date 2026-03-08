# Learning Tracks — Design Document

## Overview

Add interactive "Learning Tracks" to reps.sh — a learn-by-doing experience similar to GreatFrontEnd/HackerRank where users work through structured exercises with real code execution and AI evaluation. Flask/Python is the first track, with the system designed to support any technology.

## Goals

- Learn technologies by doing: small problems, mini app development, knowledge questions
- In-browser code editor with real server-side execution (Docker-sandboxed)
- AI-generated exercises within a pre-built topic progression
- SM-2 spaced repetition at the module level for review
- Auth-gated — only authenticated users can access execution

## Non-Goals

- Multi-user scaling (this is a personal tool)
- Full IDE features (debugging, LSP, etc.)
- Pre-recorded video content

---

## Data Model

### New Tables

```sql
CREATE TABLE tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE modules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id       UUID REFERENCES tracks(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  sort_order     INT NOT NULL,
  prerequisites  UUID[] DEFAULT '{}',  -- module IDs
  concepts       TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(track_id, slug)
);

CREATE TABLE user_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  module_id     UUID REFERENCES modules(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'active', 'completed')),
  repetitions   INT DEFAULT 0,
  interval      INT DEFAULT 1,
  ease_factor   FLOAT DEFAULT 2.5,
  next_review   DATE,
  last_reviewed DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_id)
);

CREATE TABLE exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     UUID REFERENCES modules(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('code', 'knowledge', 'mini-app')),
  prompt        TEXT NOT NULL,
  starter_code  TEXT,
  test_code     TEXT,           -- optional: when present, Docker runner asserts against it
  difficulty    INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  generated_by  TEXT NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'manual')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   UUID REFERENCES exercises(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  user_code     TEXT NOT NULL,
  stdout        TEXT,
  stderr        TEXT,
  passed        BOOLEAN,
  ai_feedback   TEXT,
  score         INT CHECK (score BETWEEN 1 AND 5),
  execution_ms  INT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_modules_track_order ON modules(track_id, sort_order);
CREATE INDEX idx_user_progress_user_module ON user_progress(user_id, module_id);
CREATE INDEX idx_exercises_module ON exercises(module_id);
CREATE INDEX idx_submissions_exercise ON submissions(exercise_id);
CREATE INDEX idx_submissions_user ON submissions(user_id);
```

### Key Design Decisions

- SM-2 lives on `user_progress` per module (not per exercise) — you review modules, exercises are generated fresh each time
- `test_code` on exercises is optional — when present, Docker runner asserts against it; when absent, AI evaluates
- `user_id` references existing `users` table for auth gating

---

## Content Structure

### Track: Flask

Pre-built module progression (exercises AI-generated within each):

| Order | Module | Concepts | Exercise Types |
|-------|--------|----------|----------------|
| 1 | Hello Flask | App creation, running server, basic routes | code, knowledge |
| 2 | Routing | URL parameters, methods, URL building | code, knowledge |
| 3 | Templates | Jinja2, template inheritance, filters | code, mini-app |
| 4 | Forms & Input | Request data, form handling, validation | code, knowledge |
| 5 | Database | SQLAlchemy basics, models, CRUD | code, mini-app |
| 6 | Auth | Sessions, login/logout, decorators | code, mini-app |
| 7 | REST APIs | JSON responses, request parsing, error handling | code, knowledge |
| 8 | Blueprints | App structure, blueprint registration | code, mini-app |
| 9 | Testing | pytest, test client, fixtures | code |
| 10 | Deployment | Gunicorn, config management, production patterns | knowledge, mini-app |

Each module has ~5-8 exercises. Modules unlock sequentially (prerequisites enforced).

### Adding New Tracks

To add a new track (e.g., Kubernetes, GraphQL):
1. Insert track + modules into DB (migration or seed script)
2. Create a Docker base image for the technology
3. No code changes needed — exercise generation is AI-driven based on module concepts

---

## Code Execution Architecture

### Docker Setup

**Base image** (`reps-runner-python`):
```dockerfile
FROM python:3.12-slim@sha256:<pinned-digest>
RUN pip install --no-cache-dir flask==3.1 sqlalchemy pytest
RUN useradd -m -u 1000 runner
USER runner
WORKDIR /app
```

- Pin base image by digest, not tag
- Pre-install common libraries — no `pip install` at runtime
- Non-root user inside container

### Execution Command

```bash
docker run --rm \
  --network=none \
  --memory=128m \
  --cpus=0.5 \
  --read-only \
  --tmpfs /tmp:size=10m,noexec,nosuid \
  --no-new-privileges \
  --cap-drop=ALL \
  --pids-limit=50 \
  --ulimit nproc=64:64 \
  --ulimit fsize=10485760:10485760 \
  --security-opt=seccomp=default \
  --user 1000:1000 \
  -v /tmp/reps-code-<uuid>/code.py:/app/code.py:ro \
  reps-runner-python \
  timeout 30 python /app/code.py
```

### Execution Flow

```
Client submits code
    → API validates (auth + zod + size limit)
    → Check execution queue (max 1 concurrent, reject with 429 if busy)
    → Write code to temp file
    → Spawn Docker container
    → Capture stdout/stderr (cap at 64KB)
    → HTML-escape output before returning
    → Kill container after 30s timeout
    → Clean up temp file
    → If test_code exists: compare output
    → If no test_code: send to AI evaluator
    → Save submission to DB
    → Return result to client
```

### Concurrency Control

- **Max 1 concurrent execution** — use an in-memory semaphore in the Node process
- If busy, return `429 Too Many Requests` with `Retry-After: 5` header
- No warm container pool needed for single-user (cold start is ~1-2s, acceptable)

### Circuit Breaker

- Track consecutive execution failures
- If 5 failures within 1 minute, pause execution for 5 minutes
- Return `503 Service Unavailable` during cooldown
- Reset counter on successful execution

---

## Security

### Code Execution Sandbox

| Protection | Implementation |
|-----------|---------------|
| Network isolation | `--network=none` |
| Memory limit | `--memory=128m` |
| CPU limit | `--cpus=0.5` |
| Read-only filesystem | `--read-only` + small tmpfs |
| No privilege escalation | `--no-new-privileges`, `--cap-drop=ALL` |
| Process limit | `--pids-limit=50` |
| File size limit | `--ulimit fsize=10MB` |
| Time limit | `timeout 30` inside container + `docker kill` at 35s from host |
| Seccomp | Default Docker seccomp profile |
| Non-root | `--user 1000:1000` |
| Code mounted read-only | `-v ...:/app/code.py:ro` |

### API Security

- All routes behind existing Bearer token auth
- Input validation with zod on all endpoints
- Code submission body size limit: 64KB
- Rate limit for execution endpoint: 10/min (nginx zone)
- HTML-escape all Docker output before returning to client (XSS prevention)
- Separate AI system prompts for exercise generation vs answer evaluation (prompt injection prevention)

### Docker Host Security

- Docker socket accessible only to `chris` user (docker group)
- No `--privileged` flag, ever
- No volume mounts to sensitive host paths
- Temp files in `/tmp/reps-code-<uuid>/`, cleaned up after each execution

---

## Infrastructure Requirements (Hetzner VPS)

### Current State

| Resource | Value |
|----------|-------|
| CPU | 3 vCPUs (AMD EPYC) |
| RAM | 3.7GB total, ~3GB available |
| Disk | 75GB, 4% used |
| Swap | None |
| Docker | Not installed |

### Pre-requisites (before deploying this feature)

1. **Add swap (safety net against OOM):**
   ```bash
   fallocate -l 2G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```

2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   usermod -aG docker chris
   ```

3. **Build and pull base image:**
   ```bash
   docker build -t reps-runner-python -f deploy/Dockerfile.runner-python .
   ```

4. **Add Docker cleanup cron:**
   ```bash
   # /etc/cron.d/reps-docker-cleanup
   0 3 * * * chris docker system prune -f >> /var/log/reps/docker-cleanup.log 2>&1
   ```

5. **Add container sweeper (catch orphans):**
   ```bash
   # /etc/cron.d/reps-container-sweeper
   */5 * * * * chris docker ps -q --filter "ancestor=reps-runner-python" --filter "status=running" | xargs -r docker kill >> /var/log/reps/container-sweeper.log 2>&1
   ```

### Resource Budget

| Component | RAM | CPU |
|-----------|-----|-----|
| Node.js (reps) | ~140MB | <1% idle |
| PostgreSQL | ~100MB | <1% idle |
| Nginx | ~10MB | <1% |
| Docker daemon | ~50MB | <1% idle |
| Docker container (during execution) | 128MB max | 0.5 CPU max |
| **Total peak** | **~430MB** | **~0.6 CPU** |
| **Available** | **3GB+** | **3 CPUs** |

Plenty of headroom. Single concurrent execution ensures this stays safe.

---

## API Routes

### New Routes (`server/routes/learn.ts`)

```
GET    /learn/tracks                    — list all tracks
GET    /learn/tracks/:slug              — track details with modules
GET    /learn/tracks/:slug/progress     — user progress for track
GET    /learn/modules/:id               — module details with exercises
POST   /learn/modules/:id/start         — unlock/activate module
POST   /learn/modules/:id/review        — SM-2 review of module (body: { quality: 0-5 })
POST   /learn/exercises/generate        — AI-generate exercise for module (body: { moduleId, difficulty? })
POST   /learn/exercises/:id/submit      — submit code/answer (body: { code })
POST   /learn/exercises/:id/run         — execute code only, no evaluation (body: { code })
GET    /learn/submissions/:exerciseId   — submission history for exercise
```

### Nginx Addition

```nginx
# Learning tracks — code execution (strict rate limit)
location /api/learn/ {
    limit_req zone=agent burst=5 nodelay;  # reuse agent zone (2r/s)
    proxy_pass http://reps_backend/learn/;
    # ... same proxy headers ...
    proxy_read_timeout 45s;  # allow for Docker execution time
}
```

---

## AI Integration

### Exercise Generation

**System prompt (generation):**
> You are a programming instructor creating exercises for learning {track.title}.
> The student is working on the module "{module.title}" which covers: {module.concepts}.
> Generate a {type} exercise at difficulty level {difficulty}/3.
>
> For code exercises: include a clear problem statement, starter code, and test assertions.
> For knowledge exercises: ask a specific conceptual question with a definitive answer.
> For mini-app exercises: describe a small application to build with clear requirements.
>
> Return JSON: { prompt, starterCode?, testCode?, hints: string[] }

`max_tokens: 500`

### Answer Evaluation

**System prompt (evaluation — separate from generation to prevent prompt injection):**
> You are a programming instructor evaluating a student's code for a {track.title} exercise.
>
> Exercise: {exercise.prompt}
> Student's code: {submission.userCode}
> Execution output: {stdout/stderr}
> Test results: {pass/fail details}
>
> Score the submission on: correctness (1-5), code quality (1-5), completeness (1-5).
> Return JSON: { correctness, codeQuality, completeness, feedback, hints: string[] }

`max_tokens: 600`

### Pre-generation

- When a user starts a module, pre-generate the next 2-3 exercises and store in DB
- This avoids AI latency when the user clicks "Next Exercise"

---

## Frontend

### New Views

| View | Route | Description |
|------|-------|-------------|
| Track List | `/learn` | Grid of available tracks with progress indicators |
| Track Detail | `/learn/:slug` | Module list with lock/active/completed states |
| Exercise View | `/learn/:slug/:moduleSlug` | Split pane: editor + output/feedback |
| Module Review | `/learn/:slug/:moduleSlug/review` | SM-2 review flow for completed modules |

### Exercise View Layout

```
┌─────────────────────────────────────────────────────┐
│ Module: Routing          Exercise 3/8     ● ● ● ○ ○ │
├───────────────────────────┬─────────────────────────┤
│                           │ Output                  │
│  Monaco Editor            │                         │
│                           │ > Hello, World!         │
│  from flask import Flask  │ > Tests: 2/2 passed     │
│  app = Flask(__name__)    │                         │
│                           ├─────────────────────────┤
│  @app.route('/')          │ AI Feedback             │
│  def hello():             │                         │
│      return 'Hello!'      │ Correctness: 5/5        │
│                           │ Code Quality: 4/5       │
│                           │ "Good use of..."        │
│                           │                         │
├───────────────────────────┴─────────────────────────┤
│  [Run Code]              [Submit for Evaluation]     │
└─────────────────────────────────────────────────────┘
```

### Monaco Editor

- Lazy-loaded (it's ~2MB)
- Python syntax highlighting and basic autocomplete
- Debounce "Run Code" button (prevent spamming, 2s cooldown)
- Show execution status (queued, running, complete)

---

## CSP Update

The Content-Security-Policy header needs updating for Monaco editor:
- Add `'unsafe-eval'` to `script-src` (already present)
- Monaco loads workers via blob URLs — add `blob:` to `worker-src`

---

## Feature Flag

Gate the entire feature behind a feature flag:
- Server: check `FEATURE_LEARNING_TRACKS=true` env var, return 404 if disabled
- Frontend: conditionally render "Learn" nav item based on `/learn/tracks` response

---

## Admin Settings

Add a "Learning Tracks" section to the existing admin/settings page:

### Admin Panel Fields

| Setting | Type | Description |
|---------|------|-------------|
| Feature enabled | Toggle | Enable/disable learning tracks (maps to `FEATURE_LEARNING_TRACKS` env var) |
| Max execution time | Number (seconds) | Docker container timeout, default 30s |
| Max memory | Number (MB) | Docker container memory limit, default 128MB |
| Max concurrent executions | Number | Execution queue limit, default 1 |
| Circuit breaker threshold | Number | Consecutive failures before pause, default 5 |
| Circuit breaker cooldown | Number (minutes) | Pause duration after threshold hit, default 5 |
| Docker image | Text (read-only) | Current runner image and digest |
| Execution stats | Read-only | Today's executions, success rate, avg execution time |

### Admin API Routes

```
GET    /admin/learn/stats       — execution stats, queue status, circuit breaker state
POST   /admin/learn/config      — update runtime config (timeout, memory, etc.)
GET    /admin/learn/submissions  — recent submissions with execution details (paginated)
POST   /admin/learn/tracks       — create/seed a new track
DELETE /admin/learn/tracks/:id   — remove a track
```

### Settings Storage

Runtime config stored in a `settings` table (key-value):
```sql
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Settings loaded into memory on startup, updated via admin API without restart.

---

## Logging & Observability

### Execution Logging

Every code execution is logged with structured data (via existing Pino logger):

```typescript
// On execution start
logger.info({ executionId, exerciseId, moduleSlug, trackSlug }, 'code-execution:start');

// On execution complete
logger.info({
  executionId,
  exerciseId,
  durationMs,
  exitCode,
  outputBytes: stdout.length + stderr.length,
  passed,
  containerId,
}, 'code-execution:complete');

// On execution failure
logger.error({
  executionId,
  exerciseId,
  error: err.message,
  durationMs,
  containerId,
}, 'code-execution:error');

// Circuit breaker state changes
logger.warn({ consecutiveFailures, cooldownMinutes }, 'code-execution:circuit-breaker:open');
logger.info({}, 'code-execution:circuit-breaker:closed');
```

### Queue Logging

```typescript
// Queue full — request rejected
logger.warn({ queueSize, maxConcurrent }, 'code-execution:queue:full');

// Execution queued
logger.info({ executionId, queuePosition }, 'code-execution:queue:enqueued');
```

### AI Logging

Extend existing `agent_logs` table for learning track AI calls:

```typescript
// Exercise generation
logger.info({ moduleId, exerciseType, difficulty, durationMs }, 'learn:exercise:generated');

// Evaluation
logger.info({ exerciseId, submissionId, score, durationMs }, 'learn:evaluation:complete');

// AI failure (parse error, timeout, etc.)
logger.error({ moduleId, error: err.message, rawResponse }, 'learn:ai:error');
```

### Docker Daemon Monitoring

Add a periodic health check (every 60s) that logs Docker daemon status:

```typescript
logger.info({
  dockerRunning: boolean,
  containersActive: number,
  diskUsage: string,      // from docker system df
  imagePresent: boolean,  // reps-runner-python exists
}, 'docker:health');
```

### Log Aggregation

All learning track logs use the `learn:` or `code-execution:` prefix for easy filtering:
- `grep "code-execution:" /var/log/reps/app.log` — all execution events
- `grep "circuit-breaker:" /var/log/reps/app.log` — circuit breaker events
- `grep "learn:ai:" /var/log/reps/app.log` — AI-related events

### Alerts

Log patterns that should trigger attention (via existing log monitoring or future alerting):
- `code-execution:circuit-breaker:open` — executions paused
- `docker:health` with `dockerRunning: false` — Docker daemon down
- `code-execution:error` count > 10 in 5 minutes — something is wrong
- `learn:ai:error` — AI evaluation failures

---

## Testing Strategy

- Unit tests for execution queue, circuit breaker, output sanitization
- Integration tests for Docker execution (can run locally with Docker)
- API tests for all `/learn/*` routes
- Admin API tests for config updates and stats
- Frontend: manual testing for Monaco editor integration
