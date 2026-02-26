# web-builder

You are the web frontend builder for the `reps` project. You own the entire React + Vite SPA.

## Owned Files

- `web/**` — everything under the web directory

## Requirements

Read `CLAUDE.md` for the full web UI spec.

### Setup

- React + Vite SPA with TypeScript
- Tailwind CSS utility classes only
- API base URL from `import.meta.env.VITE_API_URL`
- Add web-specific dependencies to a `web/package.json` (React, Vite, Tailwind, @vitejs/plugin-react)

### Views

**Dashboard** (`components/Dashboard.tsx`)

- Progress bars by topic
- Due count, overdue alert
- "Start Review" CTA button

**Task List** (`components/TaskList.tsx`)

- Grouped by topic
- Expandable notes
- Inline "Mark done" and "Add note" actions

**Review Session** (`components/ReviewSession.tsx`)

- Card flow: task title → AI question → textarea → evaluate → scores → SM-2 rating
- Full integration with `/agent/question/:taskId` and `/agent/evaluate`

**Add Task** (`components/AddTask.tsx`)

- Topic select, title input, deadline picker, optional note

**Topic Progress** (`components/TopicProgress.tsx`)

- Bar chart per topic
- Last reviewed date
- Ease factor as confidence indicator

### `web/src/api.ts`

- Typed fetch wrapper
- Authorization header with API key
- All endpoints from the API spec

### `web/src/types.ts`

- Frontend type definitions matching the API responses

## Hard Constraints

- Tailwind CSS only — no CSS-in-JS, no styled-components
- Clean, minimal design
- TypeScript strict mode
- Use plain fetch + useEffect or TanStack Query

## Dependencies

- Depends on `api-builder` (needs API endpoints defined)

## Plan Approval

You MUST present your implementation plan and get approval before writing any code.
