# MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an MCP server to the reps Hono app so any MCP client can manage tasks, reviews, and AI coaching via Streamable HTTP at `/mcp`.

**Architecture:** Embed MCP server in the existing Hono process using `@modelcontextprotocol/sdk` and `@modelcontextprotocol/hono`. Dedicated MCP API keys (bcrypt-hashed) with capability scoping. Global + per-user feature toggles. Stateless transport.

**Tech Stack:** `@modelcontextprotocol/sdk`, `@modelcontextprotocol/hono`, `bcrypt` (via Node.js `node:crypto` scrypt or `bcryptjs`), Zod v4, postgres.js, Hono

---

### Task 1: Install dependencies and create migration

**Files:**
- Modify: `package.json`
- Create: `db/012-mcp-support.sql`

**Step 1: Install MCP SDK and bcryptjs**

Run:
```bash
npm install @modelcontextprotocol/sdk @modelcontextprotocol/hono bcryptjs
npm install -D @types/bcryptjs
```

**Step 2: Create migration file**

Create `db/012-mcp-support.sql`:

```sql
-- MCP API keys
CREATE TABLE IF NOT EXISTS mcp_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL,
  key_prefix  TEXT NOT NULL,
  scopes      TEXT[] DEFAULT '{read}',
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_keys_user_id ON mcp_keys(user_id);

-- Server settings (key-value)
CREATE TABLE IF NOT EXISTS server_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO server_settings (key, value) VALUES ('mcp_enabled', 'true')
  ON CONFLICT DO NOTHING;

-- Per-user MCP toggle (default off — opt-in)
ALTER TABLE users ADD COLUMN IF NOT EXISTS mcp_enabled BOOLEAN DEFAULT false;

-- MCP audit log
CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id      UUID REFERENCES mcp_keys(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  tool_name   TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_user_id ON mcp_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_created_at ON mcp_audit_log(created_at);
```

**Step 3: Run migration locally**

Run: `npm run migrate`
Expected: `Running 012-mcp-support.sql... Migrations completed successfully (1 applied).`

**Step 4: Commit**

```bash
git add package.json package-lock.json db/012-mcp-support.sql
git commit -m "feat(mcp): add dependencies and DB migration for MCP support"
```

---

### Task 2: MCP key management (crypto + CRUD)

**Files:**
- Create: `server/mcp/keys.ts`

**Step 1: Create key management module**

Create `server/mcp/keys.ts` with these exports:

```typescript
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import sql from '../db/client.js';

const BCRYPT_ROUNDS = 10;
const KEY_TTL_DAYS = 90;

interface McpKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface McpKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function rowToKey(row: McpKeyRow): McpKey {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/** Create a new MCP key. Returns the key object AND the raw key (shown once). */
export async function createMcpKey(
  userId: string,
  name: string,
  scopes: string[] = ['read'],
  ttlDays: number = KEY_TTL_DAYS,
): Promise<{ key: McpKey; rawKey: string }> {
  const raw = `reps_mcp_${randomBytes(32).toString('hex')}`;
  const hash = await bcrypt.hash(raw, BCRYPT_ROUNDS);
  const prefix = raw.slice(0, 16);
  const expiresAt = new Date(Date.now() + ttlDays * 86400_000).toISOString();

  const [row] = await sql<McpKeyRow[]>`
    INSERT INTO mcp_keys (user_id, name, key_hash, key_prefix, scopes, expires_at)
    VALUES (${userId}, ${name}, ${hash}, ${prefix}, ${scopes}, ${expiresAt})
    RETURNING *
  `;

  return { key: rowToKey(row), rawKey: raw };
}

/** List all keys for a user (excludes hash). */
export async function listMcpKeys(userId: string): Promise<McpKey[]> {
  const rows = await sql<McpKeyRow[]>`
    SELECT * FROM mcp_keys WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return rows.map(rowToKey);
}

/** Revoke a key (soft-delete). */
export async function revokeMcpKey(userId: string, keyId: string): Promise<boolean> {
  const [row] = await sql<McpKeyRow[]>`
    UPDATE mcp_keys SET revoked_at = now()
    WHERE id = ${keyId} AND user_id = ${userId} AND revoked_at IS NULL
    RETURNING *
  `;
  return !!row;
}

/**
 * Validate a raw MCP key. Returns userId + keyId + scopes if valid, null otherwise.
 * Checks: not revoked, not expired, bcrypt match.
 */
export async function validateMcpKey(
  rawKey: string,
): Promise<{ userId: string; keyId: string; scopes: string[] } | null> {
  if (!rawKey.startsWith('reps_mcp_')) return null;

  // Fetch all active (non-revoked, non-expired) keys
  const rows = await sql<McpKeyRow[]>`
    SELECT * FROM mcp_keys
    WHERE revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  `;

  for (const row of rows) {
    const match = await bcrypt.compare(rawKey, row.key_hash);
    if (match) {
      // Update last_used_at (fire-and-forget)
      sql`UPDATE mcp_keys SET last_used_at = now() WHERE id = ${row.id}`.catch(() => {});
      return { userId: row.user_id, keyId: row.id, scopes: row.scopes };
    }
  }

  return null;
}
```

**Step 2: Commit**

```bash
git add server/mcp/keys.ts
git commit -m "feat(mcp): add MCP key management module with bcrypt hashing"
```

---

### Task 3: MCP auth middleware and feature toggles

**Files:**
- Create: `server/middleware/mcp-auth.ts`

**Step 1: Create MCP auth middleware**

Create `server/middleware/mcp-auth.ts`:

```typescript
import type { MiddlewareHandler } from 'hono';
import sql from '../db/client.js';
import { validateMcpKey } from '../mcp/keys.js';

/** Check if MCP is globally enabled via server_settings. */
async function isMcpGloballyEnabled(): Promise<boolean> {
  const [row] = await sql<[{ value: boolean }?]>`
    SELECT value FROM server_settings WHERE key = 'mcp_enabled'
  `;
  return row?.value === true;
}

/** Check if MCP is enabled for a specific user. */
async function isMcpEnabledForUser(userId: string): Promise<boolean> {
  const [row] = await sql<[{ mcp_enabled: boolean }?]>`
    SELECT mcp_enabled FROM users WHERE id = ${userId}
  `;
  return row?.mcp_enabled === true;
}

/**
 * MCP-specific auth middleware. Completely separate from REST auth.
 * Sets c.set('userId'), c.set('mcpKeyId'), c.set('mcpScopes').
 */
export const mcpAuthMiddleware: MiddlewareHandler<{
  Variables: { userId: string; mcpKeyId: string; mcpScopes: string[] };
}> = async (c, next) => {
  // 1. Block browser requests (DNS rebinding protection)
  if (c.req.header('origin')) {
    return c.json({ error: 'Browser requests not permitted on MCP endpoint' }, 403);
  }

  // 2. Global toggle
  if (!(await isMcpGloballyEnabled())) {
    return c.json({ error: 'MCP is currently disabled' }, 503);
  }

  // 3. Extract and validate MCP key
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = header.slice(7);
  const result = await validateMcpKey(token);
  if (!result) {
    return c.json({ error: 'Invalid or expired MCP key' }, 401);
  }

  // 4. User-level toggle
  if (!(await isMcpEnabledForUser(result.userId))) {
    return c.json({ error: 'MCP is not enabled for your account' }, 403);
  }

  c.set('userId', result.userId);
  c.set('mcpKeyId', result.keyId);
  c.set('mcpScopes', result.scopes);

  return next();
};

/** Middleware factory to check if the MCP key has a required scope. */
export function requireScope(
  scope: string,
): MiddlewareHandler<{ Variables: { mcpScopes: string[] } }> {
  return async (c, next) => {
    const scopes = c.get('mcpScopes') as string[];
    if (!scopes.includes(scope)) {
      return c.json({ error: `MCP key missing required scope: ${scope}` }, 403);
    }
    return next();
  };
}
```

**Step 2: Commit**

```bash
git add server/middleware/mcp-auth.ts
git commit -m "feat(mcp): add MCP auth middleware with global/user toggles"
```

---

### Task 4: MCP server with task tools

**Files:**
- Create: `server/mcp/tools/tasks.ts`
- Create: `server/mcp/server.ts`

**Step 1: Create task tool handlers**

Create `server/mcp/tools/tasks.ts`. This module exports functions that register task-related tools on an McpServer. Each handler receives `userId` and calls the DB directly (same queries as `server/routes/tasks.ts`, but extracted for reuse).

Tools to register:
- `get-tasks` (scope: read) — list with optional `topic`, `collectionId`, `dueOnly`, `status` filters
- `get-task` (scope: read) — single task by ID with notes and tags
- `create-task` (scope: write) — create with `topic`, `title`, `deadline?`, `description?`, `priority?`, `collectionId?`
- `update-task` (scope: write) — patch any field by `taskId`
- `delete-task` (scope: write) — delete by `taskId`
- `add-note` (scope: write) — add note to task by `taskId` + `text`
- `submit-review` (scope: write) — SM-2 review by `taskId` + `quality` (0-5)

Each tool handler:
1. Uses Zod for `inputSchema`
2. Wraps logic in try/catch
3. Returns `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }` on success
4. Returns `{ isError: true, content: [{ type: 'text', text: errorMessage }] }` on failure
5. All queries include `AND user_id = ${userId}` for multi-tenant scoping

Use `server.registerTool()` (the v2 API, not the deprecated `server.tool()`).

Reuse `calculateSM2` from `../../src/spaced-repetition.js` for the `submit-review` tool — same import the REST route uses.

**Step 2: Create MCP server instance**

Create `server/mcp/server.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerAgentTools } from './tools/agent.js';  // Task 5
import { registerResources } from './resources.js';       // Task 6

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'reps',
    version: '1.0.0',
  });

  registerTaskTools(server);
  // registerAgentTools(server);  // uncomment in Task 5
  // registerResources(server);   // uncomment in Task 6

  return server;
}
```

Note: `registerAgentTools` and `registerResources` are stubbed out — they'll be added in Tasks 5 and 6.

**Step 3: Commit**

```bash
git add server/mcp/tools/tasks.ts server/mcp/server.ts
git commit -m "feat(mcp): add task CRUD and review MCP tools"
```

---

### Task 5: MCP agent tools (AI features)

**Files:**
- Create: `server/mcp/tools/agent.ts`
- Modify: `server/mcp/server.ts` (uncomment registerAgentTools)

**Step 1: Create agent tool handlers**

Create `server/mcp/tools/agent.ts`. Register three tools:

- `generate-question` (scope: ai) — input: `taskId`. Loads task from DB, calls `generateQuestion()` from `server/agent/questions.js`.
- `evaluate-answer` (scope: ai) — input: `taskId`, `answer`. Calls `evaluateAnswer()` from `server/agent/evaluator.js`.
- `get-daily-briefing` (scope: ai) — no input. Calls `dailyBriefing(userId)` from `server/agent/coach.js`.

Same error handling pattern as Task 4. These tools are rate-limited more strictly (handled at the route level in Task 7).

**Step 2: Uncomment registration in server.ts**

In `server/mcp/server.ts`, uncomment `registerAgentTools(server)`.

**Step 3: Commit**

```bash
git add server/mcp/tools/agent.ts server/mcp/server.ts
git commit -m "feat(mcp): add AI agent MCP tools (question, evaluate, briefing)"
```

---

### Task 6: MCP resources

**Files:**
- Create: `server/mcp/resources.ts`
- Modify: `server/mcp/server.ts` (uncomment registerResources)

**Step 1: Create resource registrations**

Create `server/mcp/resources.ts`. Register two resources:

- `reps://topics` — returns the list of valid topic values (`coding`, `system-design`, `behavioral`, `papers`, `custom`) with descriptions. Static content, no DB call needed.
- `reps://stats` — returns user-scoped stats. Query: count tasks by topic, count due today, count overdue, average ease factor. Same queries as `server/routes/stats.ts` uses.

Note: Resources in MCP don't have auth context by default in the same way tools do. Since we're in stateless mode, the resource handler won't have `userId`. Two options:
- Make topics a static resource (no userId needed) and skip stats as a resource (expose it as a read-only tool `get-stats` instead).
- Or use a parameterized resource URI like `reps://users/{userId}/stats`.

**Recommended:** Make `topics` a static resource. Convert `stats` to a `get-stats` tool (scope: read) since it needs user context.

**Step 2: Uncomment in server.ts**

**Step 3: Commit**

```bash
git add server/mcp/resources.ts server/mcp/server.ts
git commit -m "feat(mcp): add MCP resources (topics) and get-stats tool"
```

---

### Task 7: MCP route handler and Hono integration

**Files:**
- Create: `server/mcp/index.ts`
- Modify: `server/index.ts` (mount MCP route)

**Step 1: Create MCP Hono route handler**

Create `server/mcp/index.ts`. This mounts the MCP transport at `/mcp`:

- Import `StreamableHTTPServerTransport` from the SDK (use the web-standard variant for Hono)
- Create the transport in stateless mode (`sessionIdGenerator: undefined`)
- Handle POST `/mcp` — pass request to transport
- Handle GET `/mcp` — return 405 (no SSE in stateless mode)
- Handle DELETE `/mcp` — return 405 (no sessions to teardown)

Wrap the route in a Hono sub-app that applies:
1. `mcpAuthMiddleware` (from Task 3)
2. Body size limit of 100KB
3. Rate limiting: 60 req/min for general tools, 10 req/hour for AI tools

For the rate limiting on AI tools, the simplest approach is to check the tool name in the MCP audit log middleware and enforce a separate counter for `generate-question`, `evaluate-answer`, and `get-daily-briefing`.

**Implementation approach:** Since MCP SDK handles the tool dispatch internally, we can't easily apply per-tool rate limits at the Hono middleware level. Instead:
1. Apply a general 60 req/min rate limit on the `/mcp` route
2. Inside each AI tool handler (Task 5), check a rate limit counter before calling Claude. Use the same in-memory rate limiter pattern from `server/middleware/rate-limit.ts`, keyed by `${keyId}:ai`.

**Step 2: Mount in server/index.ts**

In `server/index.ts`, add the MCP route BEFORE the general auth middleware (since MCP has its own auth):

```typescript
import mcpRoute from './mcp/index.js';

// ... after health check and auth routes, BEFORE authMiddleware ...
app.route('/mcp', mcpRoute);
```

The MCP route must be mounted before `app.use('/*', authMiddleware)` so the REST auth middleware doesn't intercept MCP requests. The MCP route has its own `mcpAuthMiddleware` applied internally.

**Step 3: Verify the server starts**

Run: `npm run dev:server`
Expected: Server starts without errors, `/health` still responds.

**Step 4: Commit**

```bash
git add server/mcp/index.ts server/index.ts
git commit -m "feat(mcp): mount MCP Streamable HTTP route at /mcp"
```

---

### Task 8: MCP audit logging

**Files:**
- Create: `server/mcp/audit.ts`
- Modify: `server/mcp/tools/tasks.ts` (add audit calls)
- Modify: `server/mcp/tools/agent.ts` (add audit calls)

**Step 1: Create audit logging helper**

Create `server/mcp/audit.ts`:

```typescript
import sql from '../db/client.js';

export async function logMcpAudit(
  keyId: string,
  userId: string,
  toolName: string,
  success: boolean,
  error?: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO mcp_audit_log (key_id, user_id, tool_name, success, error)
      VALUES (${keyId}, ${userId}, ${toolName}, ${success}, ${error ?? null})
    `;
  } catch (err) {
    console.error('[mcp-audit] Failed to log:', err);
  }
}
```

**Step 2: Add audit logging to every tool handler**

In each tool handler (tasks.ts, agent.ts), call `logMcpAudit()` after the operation completes (both success and failure paths). The `keyId` and `userId` need to be passed through from the MCP transport context — this requires threading them through the McpServer's tool handler context.

**Approach:** Use a request-scoped context. When the MCP transport handles a request, stash `userId`, `keyId`, and `scopes` in a context object that tool handlers can access. The MCP SDK supports this via the tool handler's second argument (`extra` / `ctx`).

**Step 3: Commit**

```bash
git add server/mcp/audit.ts server/mcp/tools/tasks.ts server/mcp/tools/agent.ts
git commit -m "feat(mcp): add audit logging for all MCP tool invocations"
```

---

### Task 9: MCP key management API routes

**Files:**
- Modify: `server/routes/users.ts` (add MCP key CRUD endpoints)

**Step 1: Add MCP key routes to users.ts**

Add these routes to the existing users router:

```
GET    /users/me/mcp-keys          — list user's MCP keys (excludes hash)
POST   /users/me/mcp-keys          — create key (name, scopes?, ttlDays?) → returns raw key once
DELETE /users/me/mcp-keys/:id      — revoke a key
PATCH  /users/me/mcp                — toggle mcp_enabled for self
```

And admin routes:

```
GET    /users/admin/mcp/settings    — get global MCP enabled status
PATCH  /users/admin/mcp/settings    — toggle global MCP on/off
PATCH  /users/admin/users/:id/mcp   — toggle MCP for a specific user
GET    /users/admin/mcp/audit       — list recent MCP audit log entries
```

All follow existing patterns in `server/routes/users.ts`: Zod validation, userId scoping, admin guard.

**Step 2: Add Zod schemas**

```typescript
const createMcpKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['read', 'write', 'ai'])).min(1).optional(),
  ttlDays: z.number().int().min(1).max(365).optional(),
});

const toggleMcpSchema = z.object({
  enabled: z.boolean(),
});
```

**Step 3: Commit**

```bash
git add server/routes/users.ts
git commit -m "feat(mcp): add MCP key management and admin toggle API routes"
```

---

### Task 10: Update user profile to include mcp_enabled

**Files:**
- Modify: `server/auth/users.ts` (include mcp_enabled in User interface and queries)

**Step 1: Add mcp_enabled to User interface and queries**

In `server/auth/users.ts`:
- Add `mcpEnabled: boolean` to the `User` interface
- Include `mcp_enabled` in the SELECT queries for `getUserById`, `findUserByEmail`, `listUsers`
- Map `mcp_enabled` → `mcpEnabled` in the row-to-object conversion
- Add `mcpEnabled` to `adminUpdateUser` allowed fields

**Step 2: Commit**

```bash
git add server/auth/users.ts
git commit -m "feat(mcp): include mcp_enabled in user profile data"
```

---

### Task 11: Web UI — MCP settings in account settings

**Files:**
- Create: `web/src/components/settings/McpKeysSection.tsx`
- Modify: `web/src/components/settings/SettingsPage.tsx` (or equivalent settings component — add MCP tab/section)
- Modify: `web/src/api.ts` (add MCP key API functions)

**Step 1: Add API functions**

In `web/src/api.ts`, add typed fetch wrappers:
- `listMcpKeys(): Promise<McpKey[]>`
- `createMcpKey(name, scopes?, ttlDays?): Promise<{ key: McpKey; rawKey: string }>`
- `revokeMcpKey(keyId): Promise<void>`
- `toggleMcp(enabled): Promise<void>`

**Step 2: Create McpKeysSection component**

- MCP toggle switch (enable/disable MCP for account)
- When enabled, show key management table:
  - Columns: Name, Prefix, Scopes, Last Used, Expires, Actions
  - "Create Key" button → modal with name input, scope checkboxes, expiration select
  - After creation: show raw key in a copyable field with "This key will only be shown once" warning
  - "Revoke" button per key with confirmation
- When MCP is globally disabled (check from user profile or separate endpoint), show a notice: "MCP is currently disabled by the administrator"

**Step 3: Integrate into settings page**

Add the MCP section to the existing settings page, after sessions or at the bottom.

**Step 4: Commit**

```bash
git add web/src/components/settings/McpKeysSection.tsx web/src/api.ts
git commit -m "feat(mcp): add MCP key management UI in account settings"
```

---

### Task 12: Web UI — Admin MCP controls

**Files:**
- Modify: admin settings component (add global MCP toggle)
- Modify: admin user list component (add per-user MCP toggle column)

**Step 1: Add global MCP toggle to admin settings**

Add a toggle in the admin settings view that calls `PATCH /users/admin/mcp/settings` with `{ enabled: true/false }`.

**Step 2: Add per-user MCP toggle to admin user management**

In the admin user list, add an "MCP" column with a toggle per user. Calls `PATCH /users/admin/users/:id/mcp`.

**Step 3: Add MCP audit log viewer (optional, can be a simple table)**

A collapsible section showing recent MCP audit entries from `GET /users/admin/mcp/audit`.

**Step 4: Commit**

```bash
git commit -m "feat(mcp): add admin MCP controls (global toggle, per-user, audit log)"
```

---

### Task 13: Integration testing with MCP Inspector

**Files:** None (manual testing)

**Step 1: Start the dev server**

Run: `npm run dev:server`

**Step 2: Create an MCP key via the API**

```bash
# Enable MCP for the user first
curl -X PATCH https://localhost:3000/users/me/mcp \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Create a key with all scopes
curl -X POST https://localhost:3000/users/me/mcp-keys \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-key", "scopes": ["read", "write", "ai"]}'
```

Save the `rawKey` from the response.

**Step 3: Test with MCP Inspector**

Run: `npx @modelcontextprotocol/inspector`

Configure it to connect to `http://localhost:3000/mcp` with the Bearer token. Verify:
- Tools list shows all 10 (or 11 with get-stats) tools
- `get-tasks` returns user's tasks
- `create-task` creates a task
- `submit-review` runs SM-2
- `generate-question` returns an AI question (if ANTHROPIC_API_KEY is set)
- Resources show `reps://topics`

**Step 4: Test auth failures**

- Request without Bearer token → 401
- Request with revoked key → 401
- Request with read-only key calling create-task → 403
- Request when MCP globally disabled → 503
- Request with Origin header → 403

**Step 5: Commit any fixes**

```bash
git commit -m "fix(mcp): address issues found during integration testing"
```

---

### Task 14: Documentation and deploy

**Files:**
- Modify: `.env.example` (no new env vars needed, but document MCP)
- Modify: `deploy/deploy.sh` (ensure migration runs — already does)

**Step 1: Verify deploy script runs migration**

The existing `deploy.sh` already runs `npm run migrate`, so the new migration will be applied automatically on deploy. No changes needed.

**Step 2: Build and verify**

Run:
```bash
npm run build:server
npm run build:web
```

Expected: No TypeScript errors. Both build successfully.

**Step 3: Final commit and PR**

```bash
git add -A
git commit -m "feat(mcp): complete MCP server integration"
git push -u origin feat/mcp-server
gh pr create --title "feat: add MCP server support" --body "..."
```

---

## Dependency Order

```
Task 1 (migration + deps)
    ↓
Task 2 (key management)
    ↓
Task 3 (auth middleware)
    ↓
Task 4 (task tools) ──→ Task 5 (agent tools) ──→ Task 6 (resources)
    ↓                                                   ↓
Task 7 (route handler + Hono mount) ←──────────────────┘
    ↓
Task 8 (audit logging)
    ↓
Task 9 (key mgmt API routes) ──→ Task 10 (user profile update)
    ↓                                    ↓
Task 11 (web UI settings) ←────────────┘
    ↓
Task 12 (admin UI)
    ↓
Task 13 (integration testing)
    ↓
Task 14 (docs + deploy)
```
