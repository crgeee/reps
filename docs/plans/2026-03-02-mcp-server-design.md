# MCP Server Integration — Design Doc

**Date:** 2026-03-02
**Status:** Approved

## Overview

Add an MCP (Model Context Protocol) server to reps, embedded in the existing Hono app at `/mcp` using Streamable HTTP transport. Any MCP client (Claude Desktop, Claude Code, etc.) can connect with a dedicated MCP API key to manage interview prep tasks, run reviews, and trigger AI coaching features.

## Architecture

```
Claude Desktop / Claude Code / any MCP client
        │
        ▼
  POST/GET/DELETE /mcp  (Streamable HTTP, stateless)
        │
        ├─ DNS rebinding guard (block Origin header)
        ├─ MCP key auth (bcrypt-hashed, separate from REST auth)
        ├─ Global toggle check (server_settings.mcp_enabled)
        ├─ User toggle check (users.mcp_enabled)
        │
        ├─ MCP Tools ──→ sql (postgres.js direct)
        │             ──→ agent functions (coach, evaluator, questions, papers)
        │             ──→ calculateSM2
        │
        └─ MCP Resources (read-only reference data)
```

**Transport:** Stateless Streamable HTTP — no session tracking, each request is independent. Correct for request/response tool invocations; no need for server-push SSE.

**Embedding:** MCP server runs inside the existing Hono process. Tool handlers call DB and agent functions directly — no internal HTTP round-trips. Acceptable at current scale (single VPS, single user). If multi-user load grows, can be split to a separate pm2 process later.

## New Files

| File                            | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `server/mcp/server.ts`          | McpServer instance + all tool/resource registrations |
| `server/mcp/tools/tasks.ts`     | Task CRUD tool handlers                              |
| `server/mcp/tools/reviews.ts`   | SM-2 review tool handler                             |
| `server/mcp/tools/agent.ts`     | AI coaching/eval/question tool handlers              |
| `server/mcp/resources.ts`       | Resource registrations (topics, stats)               |
| `server/mcp/index.ts`           | Hono route handler mounting the MCP transport        |
| `server/middleware/mcp-auth.ts` | MCP-specific auth middleware (separate from REST)    |

## Database Changes

### New table: `mcp_keys`

```sql
CREATE TABLE IF NOT EXISTS mcp_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,              -- user label, e.g. "Claude Code laptop"
  key_hash    TEXT NOT NULL,              -- bcrypt hash of the API key
  key_prefix  TEXT NOT NULL,              -- first 8 chars for display ("reps_mc_...")
  scopes      TEXT[] DEFAULT '{read}',    -- capability scoping
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,               -- default 90 days from creation
  revoked_at  TIMESTAMPTZ,               -- soft-revoke (null = active)
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Scopes:** `read` (get-tasks, get-task, resources), `write` (create/update/delete tasks, add-note, submit-review), `ai` (generate-question, evaluate-answer, get-daily-briefing). Default: `{read}`.

### New table: `server_settings`

```sql
CREATE TABLE IF NOT EXISTS server_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO server_settings (key, value) VALUES ('mcp_enabled', 'true')
  ON CONFLICT DO NOTHING;
```

### Alter `users` table

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS mcp_enabled BOOLEAN DEFAULT false;
```

Users must opt-in — MCP access is not granted by default.

### New table: `mcp_audit_log`

```sql
CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id      UUID REFERENCES mcp_keys(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  tool_name   TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

## Authentication

**Dedicated MCP auth middleware** — completely separate from REST session/device auth.

1. Extract Bearer token from `Authorization` header
2. Look up all non-revoked, non-expired `mcp_keys` for any user
3. Bcrypt-compare the token against `key_hash` (constant-time)
4. If match: check `users.mcp_enabled` for that user → 403 if disabled
5. Set `userId` in Hono context
6. Update `last_used_at` on the key (fire-and-forget, non-blocking)

**REST routes never check `mcp_keys`. MCP routes never check sessions/device tokens.** No fallthrough between auth systems.

### Key Generation Flow

1. User enables MCP in account settings (sets `users.mcp_enabled = true`)
2. User clicks "Create MCP Key", enters a name
3. Server generates 32-byte random key, prefixed `reps_mcp_`
4. Server stores bcrypt hash + first 8 chars as prefix
5. Key shown once in copy-to-clipboard UI
6. Default expiration: 90 days (configurable at creation)

## Feature Toggles

### Global Toggle (Admin)

- `server_settings` row with key `mcp_enabled`
- Checked on every MCP request (no caching — single-row lookup, negligible cost)
- When `false`: `/mcp` returns 503 Service Unavailable for all users
- Managed via admin portal settings UI

### Per-User Toggle

- `users.mcp_enabled` boolean, default `false`
- When `false`: user's MCP keys rejected with 403, but keys are preserved
- Managed by user in account settings, or by admin in user management

### Middleware Chain (order matters)

1. DNS rebinding guard → reject if `Origin` header present
2. Global toggle check → 503 if MCP disabled
3. Body size limit → 100KB for MCP payloads
4. MCP key auth → resolve userId or 401
5. User toggle check → 403 if user MCP disabled
6. Scope check → 403 if tool requires scope the key doesn't have
7. Rate limit check → 429 if exceeded
8. MCP transport handler → dispatch to tool/resource

## Tools (10 semantic tools)

### Task Management (scope: `read` / `write`)

| Tool            | Scope | Description                         | Key Inputs                                                                  |
| --------------- | ----- | ----------------------------------- | --------------------------------------------------------------------------- |
| `get-tasks`     | read  | List tasks with optional filters    | `topic?`, `collectionId?`, `dueOnly?`, `status?`                            |
| `get-task`      | read  | Get single task with notes and tags | `taskId`                                                                    |
| `create-task`   | write | Create a new prep task              | `topic`, `title`, `deadline?`, `description?`, `priority?`, `collectionId?` |
| `update-task`   | write | Update any task fields              | `taskId`, plus any patchable field                                          |
| `delete-task`   | write | Delete a task                       | `taskId`                                                                    |
| `add-note`      | write | Add a note to a task                | `taskId`, `text`                                                            |
| `submit-review` | write | Run SM-2 quality rating             | `taskId`, `quality` (0-5)                                                   |

### AI Features (scope: `ai`)

| Tool                 | Scope | Description                                  | Key Inputs         |
| -------------------- | ----- | -------------------------------------------- | ------------------ |
| `generate-question`  | ai    | Generate AI interview question for a task    | `taskId`           |
| `evaluate-answer`    | ai    | Get AI feedback on an answer                 | `taskId`, `answer` |
| `get-daily-briefing` | ai    | Trigger and return today's coaching briefing | (none)             |

All tool handlers:

- Validate inputs with Zod schemas
- Wrap logic in try/catch, return `{ isError: true, content: [...] }` on failure
- Are user-scoped (all queries filtered by `userId` from auth context)
- Log to `mcp_audit_log`

## Resources (read-only)

| Resource | URI             | Description                                                  |
| -------- | --------------- | ------------------------------------------------------------ |
| `topics` | `reps://topics` | List of valid topic values with descriptions                 |
| `stats`  | `reps://stats`  | Current review stats, streaks, topic breakdown (user-scoped) |

## Rate Limiting

Two-tier system per MCP key:

| Tier    | Limit       | Applies To                                                   |
| ------- | ----------- | ------------------------------------------------------------ |
| General | 60 req/min  | All CRUD tools + resources                                   |
| AI      | 10 req/hour | `generate-question`, `evaluate-answer`, `get-daily-briefing` |

Daily cost ceiling: if a key triggers >50 Claude API calls in 24 hours, auto-disable the key and notify admin via existing notification system.

## Security Measures

1. **Bcrypt key hashing** (cost 10+) — protects against DB leak
2. **Separate auth paths** — MCP and REST auth never mix
3. **DNS rebinding protection** — reject requests with `Origin` header on `/mcp`
4. **CORS exclusion** — `/mcp` not included in CORS config
5. **Capability scoping** — keys default to read-only, explicit opt-in for write/ai
6. **100KB body limit** — MCP payloads are small
7. **Zod validation** — every tool input validated before processing
8. **Prompt injection mitigation** — user input delimited with XML tags in Claude prompts
9. **No toggle caching** — global/user toggles read from DB every request
10. **Audit logging** — every tool invocation logged with key ID, success/failure

## Client Configuration

### Claude Code (`~/.claude/mcp.json` or `.mcp.json`)

```json
{
  "mcpServers": {
    "reps": {
      "type": "streamable-http",
      "url": "https://reps.sh/mcp",
      "headers": {
        "Authorization": "Bearer reps_mcp_..."
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

Same format as above.

**Security note:** Config files contain plaintext keys. Users should set file permissions to `600` and ensure these files are in `.gitignore`.

## Web UI Changes

### Account Settings — MCP Section

- Toggle: "Enable MCP access" (controls `users.mcp_enabled`)
- Only visible when global MCP is enabled
- Key management table: name, prefix, scopes, last used, expires, created
- "Create Key" button → modal: name, scope checkboxes, expiration select → shows key once
- "Revoke" button per key (soft-delete via `revoked_at`)

### Admin Portal — MCP Settings

- Global toggle: "Enable MCP for all users"
- Per-user MCP toggle in user management view
- MCP audit log viewer (recent tool invocations)

## Dependencies

```
@modelcontextprotocol/sdk
@modelcontextprotocol/hono
```

Both added to `package.json`. Zod v4 already installed.

## Out of Scope

- Stateful sessions / SSE streaming (not needed for current tool set)
- MCP prompts primitive (no use case yet — tools cover everything)
- MCP client functionality (reps consuming external MCP servers)
- OAuth 2.0 / PKCE auth flow (Bearer token is sufficient for now)
