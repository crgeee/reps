# Export & Calendar Integrations Design

**Date:** 2026-02-25
**Status:** Draft

## Problem

reps tracks review dates via SM-2 spaced repetition, but these dates live only inside the app. Users can't see upcoming reviews alongside their other calendar commitments, and there's no way to export task data for use in other tools.

No competing app (Anki, RemNote, LeetCode, Pramp) offers iCal feeds. SpaceRep is the only spaced repetition tool with Google Calendar integration (via OAuth). This is a differentiation opportunity.

## Scope

Read-only sync out — reps remains the source of truth. Four features:

1. **iCal subscription feed** — subscribable URL for all review dates
2. **Per-task .ics download** — create a calendar event from any task
3. **Bulk Markdown export** — download all tasks + notes as .md
4. **Per-task clipboard copy** — copy formatted task text

## Design

### API Endpoints

New route file: `server/routes/export.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/export/calendar/:token.ics` | Token-in-URL | iCal feed (all incomplete tasks' next_review dates) |
| `GET` | `/export/tasks/:id/event.ics` | Bearer | Single task .ics download |
| `GET` | `/export/tasks.md` | Bearer | Bulk Markdown export |
| `POST` | `/export/calendar/token` | Bearer | Generate/regenerate subscription token |
| `GET` | `/export/calendar/token` | Bearer | Get current token |

### iCal Feed (`/export/calendar/:token.ics`)

- No Bearer auth — calendar apps can't send headers
- Auth via 64-char hex token in URL path
- Returns `Content-Type: text/calendar`
- Each incomplete task with `next_review` becomes an all-day VEVENT
- `UID: {task.id}@reps-prep.duckdns.org` for stable dedup
- `SUMMARY: Review: {title}`
- `DESCRIPTION: Topic: {topic}\nReps: {repetitions}\nEase: {easeFactor}`
- `VALARM` 15-minute display reminder
- Calendar apps poll this URL periodically — events update as SM-2 recalculates

### Per-task .ics (`/export/tasks/:id/event.ics`)

- Bearer auth (normal)
- Single VEVENT for that task's `next_review`
- `Content-Disposition: attachment; filename="review-{slug}.ics"`

### Markdown Export (`/export/tasks.md`)

- Bearer auth
- Tasks grouped by topic, sorted by `next_review`
- Includes notes with timestamps, SM-2 stats
- `Content-Disposition: attachment; filename="reps-export-{date}.md"`

### Token Management

- Single active token at a time
- `POST /export/calendar/token` — generates new token, deletes old
- `GET /export/calendar/token` — returns current token or null

### Database

One new table:

```sql
CREATE TABLE IF NOT EXISTS calendar_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

New migration file in `server/db/migrations/`.

### Frontend

New "Export & Integrations" view (`web/src/components/ExportView.tsx`):

- Calendar subscription section:
  - "Generate Subscribe URL" button (calls `POST /export/calendar/token`)
  - Displays `webcal://reps-prep.duckdns.org/export/calendar/{token}.ics`
  - Copy button for the URL
  - Brief instructions for Apple Calendar / Google Calendar
  - "Regenerate" button to invalidate old URL

- Markdown export section:
  - "Download Markdown" button (triggers GET /export/tasks.md)

Per-task actions on TaskCard:
- "Add to Calendar" icon — downloads .ics
- "Copy" icon — copies formatted text to clipboard

Navigation: Add 'export' to View type, add to MORE_NAV array.

### iCal Generation

Hand-rolled (no library). Utility functions in export route:

```typescript
function generateVEvent(task: Task): string
function generateCalendar(tasks: Task[]): string
function formatIcsDate(dateStr: string): string  // YYYY-MM-DD → YYYYMMDD
```

All-day events: `DTSTART;VALUE=DATE:20260226` (no time component).

### Clipboard Format

```
Rate Limiter Design
Topic: coding | Next Review: 2026-02-26
Ease: 2.5 | Reps: 3

Notes:
- Implement token bucket algorithm
- Consider sliding window approach
```

## Non-Goals

- Google Calendar OAuth (future feature)
- Apple Notes direct integration (no API exists)
- CalDAV server (overkill)
- Two-way sync
- CSV export
