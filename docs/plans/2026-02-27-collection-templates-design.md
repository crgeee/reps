# Collection Templates Design

## Problem

Every new collection starts with the same 4 generic statuses (todo, in-progress, review, done) regardless of its intended use case. Users must manually reconfigure statuses, toggle SR, and figure out the right workflow on their own. The app serves two distinct use cases — task management and interview prep — but provides no guided onboarding for either.

## Solution

A full-screen template gallery that lets users create collections pre-configured for specific workflows. Templates define statuses, SR settings, default view preference, and sample starter tasks. System templates are seeded; users can save 1 custom template (admins unlimited).

## Database Schema

### New tables

```sql
-- Migration: 00X-collection-templates.sql

CREATE TABLE collection_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  color         TEXT,
  sr_enabled    BOOLEAN DEFAULT false,
  default_view  TEXT DEFAULT 'list' CHECK (default_view IN ('list', 'board')),
  is_system     BOOLEAN DEFAULT false,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE template_statuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID REFERENCES collection_templates(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  sort_order    INT DEFAULT 0
);

CREATE TABLE template_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID REFERENCES collection_templates(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  status_name   TEXT NOT NULL,
  topic         TEXT DEFAULT 'custom',
  sort_order    INT DEFAULT 0
);
```

### Alter existing table

```sql
ALTER TABLE collections ADD COLUMN default_view TEXT DEFAULT 'list';
```

### System template seed data

| Template | SR | View | Statuses | Sample Tasks |
|---|---|---|---|---|
| Interview Prep | on | board | todo, studying, practicing, confident, mastered | "System design: URL shortener", "Behavioral: conflict resolution", "LeetCode: sliding window" |
| Task Manager | off | list | backlog, todo, in-progress, done | "Set up project structure", "Write documentation", "Review pull requests" |
| Bug Tracker | off | board | triage, investigating, fixing, in-review, verified, closed | "Login page 500 error", "Dark mode contrast issue" |
| Learning Tracker | on | board | to-learn, learning, practicing, mastered | "TypeScript generics", "React Server Components" |
| Reading List | off | list | to-read, reading, taking-notes, finished | "Designing Data-Intensive Applications", "Clean Architecture" |

## API Routes

### Template CRUD

```
GET    /templates                    — list all visible templates (system + user's own)
POST   /templates                    — create custom template (max 1 per non-admin user)
PATCH  /templates/:id                — update own template (or any if admin)
DELETE /templates/:id                — delete own template (or any if admin)
```

### Collection creation from template

```
POST   /collections/from-template    — body: { templateId, name?, color? }
```

Single-transaction endpoint that:
1. Loads template + statuses + tasks
2. Creates collection (user can override name/color)
3. Bulk-inserts statuses from template_statuses
4. Bulk-inserts sample tasks from template_tasks with correct status mapping
5. Returns new collection with nested statuses

### Admin routes

```
GET    /admin/templates              — list all templates (system + all users')
DELETE /admin/templates/:id          — delete any template
PATCH  /admin/templates/:id          — edit any template
```

## Template limit enforcement

- **System templates** (`is_system = true`): seeded on migration, visible to all users, only admins can modify/delete
- **User templates** (`is_system = false`): max 1 per user, enforced at API level on POST
- **Admin users** (`is_admin = true`): unlimited custom templates, full CRUD on all templates including system ones

## Frontend

### New view: Template Gallery (`#templates`)

Added to the `View` union type and hash routing.

**Layout:**
- Header: "Start a new collection" with subtitle
- Card grid: 2-col mobile, 3-col desktop
- Each card displays: icon, name, description, colored status chips, SR badge, view indicator, sample task count
- "Start from scratch" card at the bottom (muted style, opens blank create form)
- "My Template" section above system templates if user has one

**Card click flow:**
1. Click template card
2. Quick customize overlay: pre-filled name, color picker, "Create" button
3. `POST /collections/from-template`
4. Navigate to new collection with its default view active

### Entry points

- CollectionSwitcher "+" dropdown: "Browse templates" link at bottom
- Empty state (0 collections): redirect to template gallery
- Direct URL: `#templates`

### Save as template

- New button in CollectionEditModal: "Save as template"
- Captures current statuses + up to 3 tasks
- `POST /templates`
- Error if non-admin user already has 1 custom template

### Collection default_view

- New `default_view` field on collections (persisted from template on creation)
- When switching to a collection, UI defaults to its `default_view` (list or board)
- User can still toggle freely; the default is just the initial state

## Validation (zod)

```typescript
const templateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  srEnabled: z.boolean().optional(),
  defaultView: z.enum(['list', 'board']).optional(),
  statuses: z.array(z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })).min(1).max(20),
  tasks: z.array(z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(2000).optional(),
    statusName: z.string().min(1).max(100),
    topic: z.string().max(100).optional(),
  })).max(10).optional(),
});

const fromTemplateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});
```

## File ownership

| Component | Files |
|---|---|
| DB migration | `db/00X-collection-templates.sql` |
| Server routes | `server/routes/templates.ts` |
| Server route (from-template) | `server/routes/collections.ts` (add endpoint) |
| Web types | `web/src/types.ts` (add Template types) |
| Web API client | `web/src/api.ts` (add template methods) |
| Gallery component | `web/src/components/TemplateGallery.tsx` |
| Template card | `web/src/components/TemplateCard.tsx` |
| Create overlay | `web/src/components/CreateFromTemplate.tsx` |
| App routing | `web/src/App.tsx` (add view + nav entry) |
| CollectionSwitcher | `web/src/components/CollectionSwitcher.tsx` (add link) |
| CollectionEditModal | `web/src/components/CollectionEditModal.tsx` (save as template) |
