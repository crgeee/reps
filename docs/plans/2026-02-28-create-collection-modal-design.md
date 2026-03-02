# Create Collection Modal + Collection-Scoped Topics

**Date**: 2026-02-28

## Problem

1. "New collection" uses an inline form crammed inside a dropdown — no room for template selection, icon picker, or topic configuration.
2. AddTask always shows the global 5 topics regardless of collection context. A Bug Tracker collection shouldn't offer "Behavioral" as a topic.

## Solution

### A. CreateCollectionModal — two-step modal

Replace the inline creation form in `CollectionSwitcher` with a proper modal.

**Step 1 — Pick starting point**
- Fetch templates on mount (same `getTemplates()` call)
- Grid of `TemplateCard` components + a dashed "Blank collection" card
- System templates and user templates in separate sections

**Step 2 — Customize**
- Name (pre-filled from template or empty)
- Icon picker (12 emoji options, reuse from CollectionEditModal)
- Color swatches
- SR toggle
- Preview: status pills + topic pills from template (read-only)
- Back button to step 1, Create button to submit

**API calls** (both exist already):
- Blank → `createCollection()`
- From template → `createCollectionFromTemplate()`

**CollectionSwitcher changes**:
- Remove inline form state: `creating`, `newName`, `newColor`, `newSrEnabled`, `submitting`, the form JSX, `nameInputRef`
- Merge "Browse templates" and "New collection" into a single "New collection" button that opens the modal
- Remove `onBrowseTemplates` prop

### B. Collection-scoped topics

**DB schema** (new migration `008-collection-topics.sql`):

```sql
CREATE TABLE IF NOT EXISTS template_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES collection_templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  sort_order  INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_template_topics_template ON template_topics(template_id);

CREATE TABLE IF NOT EXISTS collection_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  sort_order    INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_collection_topics_collection ON collection_topics(collection_id);

-- Relax the CHECK constraint on tasks.topic to allow custom values
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_topic_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_topic_check CHECK (char_length(topic) > 0 AND char_length(topic) <= 100);
```

Seed template topics:

| Template         | Topics                                  |
|------------------|-----------------------------------------|
| Interview Prep   | Coding, System Design, Behavioral, Papers |
| Task Manager     | Feature, Bug, Chore                     |
| Bug Tracker      | Frontend, Backend, Infra                |
| Learning Tracker | Concept, Practice, Project              |
| Reading List     | Book, Paper, Article                    |

**Server changes**:

1. `GET /collections` — batch-load `collection_topics` with `ANY()` alongside statuses (single extra query, same pattern). Add `topics` array to response.
2. `POST /collections/from-template` — copy `template_topics` → `collection_topics` inside the existing transaction.
3. `GET /templates` — batch-load `template_topics` alongside statuses/tasks. Add `topics` array to response.
4. `POST /templates` — accept `topics` array in body, insert into `template_topics`.
5. New routes on collections:
   - `POST /collections/:id/topics` — add a topic
   - `PATCH /collections/:id/topics/:topicId` — rename/recolor
   - `DELETE /collections/:id/topics/:topicId` — remove

**Performance notes**:
- `GET /collections` adds ONE batch query (`WHERE collection_id = ANY(ids)`) — no N+1
- `GET /templates` same pattern — one batch query for topics
- `CreateCollectionModal` fetches templates once on open, not on every render
- Collection topics are already in memory on the `Collection` object fetched at app startup — AddTask reads from props, zero additional API calls
- Template list is cached in modal state across step navigation (no refetch on back)

**Frontend types** (additions):

```typescript
// Add to Collection
interface Collection {
  // ... existing fields
  topics: CollectionTopic[];
}

interface CollectionTopic {
  id: string;
  collectionId: string;
  name: string;
  color: string | null;
  sortOrder: number;
}

// Add to CollectionTemplate
interface CollectionTemplate {
  // ... existing fields
  topics: TemplateTopic[];
}

interface TemplateTopic {
  id: string;
  templateId: string;
  name: string;
  color: string | null;
  sortOrder: number;
}
```

**AddTask changes**:
- Accept `activeCollection: Collection | null` prop (instead of just `activeCollectionId`)
- If `activeCollection?.topics.length > 0` → render those as topic buttons
- Otherwise → fall back to global `TOPICS`
- Topic value stored on task is the topic `name` string (matches existing behavior)

**CollectionEditModal changes**:
- Add "Topics" section below statuses (same UI pattern: editable name, color dot, delete, add)
- CRUD via new collection topic endpoints

## Files changed

| File | Change |
|------|--------|
| `db/008-collection-topics.sql` | New migration |
| `server/routes/collections.ts` | Batch-load topics in GET, copy in from-template, new CRUD routes |
| `server/routes/templates.ts` | Batch-load topics in GET, accept in POST |
| `server/validation.ts` | Add topic schemas |
| `web/src/types.ts` | Add CollectionTopic, TemplateTopic interfaces; extend Collection/Template |
| `web/src/api.ts` | Add topic CRUD functions |
| `web/src/components/CreateCollectionModal.tsx` | New — two-step modal |
| `web/src/components/CollectionSwitcher.tsx` | Remove inline form, add modal trigger |
| `web/src/components/CollectionEditModal.tsx` | Add topics section |
| `web/src/components/AddTask.tsx` | Use collection topics when available |
| `web/src/App.tsx` | Pass activeCollection to AddTask, remove onBrowseTemplates wiring |
