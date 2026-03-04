# React Router v7 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hash-based routing with React Router v7 using nested layouts, protected routes, and clean URLs.

**Architecture:** `createBrowserRouter` with two layout shells — `ProtectedLayout` (auth guard + header/nav/data fetching + `<Outlet>`) and `PublicLayout` (minimal footer wrapper + `<Outlet>`). All navigation callbacks (`onNavigate`, `onStartReview`, hash manipulation) replaced with `useNavigate()` and `<Link>`.

**Tech Stack:** react-router v7, React 19

---

### Task 1: Install react-router

**Files:**

- Modify: `web/package.json`

**Step 1: Install dependency**

Run: `cd web && npm install react-router`

**Step 2: Verify install**

Run: `cd web && node -e "require('react-router')"`
Expected: No error

**Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore: install react-router v7"
```

---

### Task 2: Create PublicLayout

**Files:**

- Create: `web/src/layouts/PublicLayout.tsx`

**Step 1: Create the layout**

```tsx
// web/src/layouts/PublicLayout.tsx
import { Outlet } from 'react-router';
import Footer from '../components/Footer';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/layouts/PublicLayout.tsx
git commit -m "feat: add PublicLayout with Outlet"
```

---

### Task 3: Create ProtectedLayout

Extract the entire authenticated shell from `App.tsx` (header, desktop nav, mobile nav, bottom nav, data fetching, collection switching, error/loading states) into a layout component that uses `<Outlet />` for page content.

**Files:**

- Create: `web/src/layouts/ProtectedLayout.tsx`

**Step 1: Create the layout**

This is the biggest piece. The layout must:

1. Call `useAuth()` — if `authLoading`, show spinner. If `!isAuthenticated`, `<Navigate to="/login" />`.
2. Fetch tasks, collections, tags on mount (same logic as current `App.tsx` lines 152-210).
3. Derive `dueTasks`, `filteredTasks`, `filteredDueTasks`, `activeStatuses`, `activeStatusOptions` (same as current App.tsx lines 221-249).
4. Render the full header (logo, CollectionSwitcher, desktop nav, add/github/coffee/settings/signout buttons, mobile hamburger menu) — copy directly from App.tsx lines 298-565.
5. Render `<main>` with error banner + loading spinner + `<Outlet context={...} />` passing down: `tasks`, `filteredTasks`, `dueTasks`, `filteredDueTasks`, `collections`, `tags`, `activeCollectionId`, `activeStatuses`, `activeStatusOptions`, `user`, `fetchData`, `refreshQuietly`, `optimisticUpdateTask`, `fetchCollections`, `handleCollectionChange`, `handleTagCreated`, `handleUserUpdate`.
6. Render `<FocusWidget />`, `<Footer />`, and mobile bottom nav.
7. Replace all `setView(x)` calls with `navigate('/x')` (or `navigate('/')` for dashboard).
8. Replace the `view === v` active-state checks with `useLocation().pathname === '/v'`.

Create a typed context for the outlet:

```tsx
import { useOutletContext } from 'react-router';
import type { Task, Collection, Tag, User, CollectionStatus } from '../types';

export interface ProtectedContext {
  tasks: Task[];
  filteredTasks: Task[];
  dueTasks: Task[];
  filteredDueTasks: Task[];
  collections: Collection[];
  tags: Tag[];
  activeCollectionId: string | null;
  activeStatuses: CollectionStatus[] | undefined;
  activeStatusOptions: { value: string; label: string }[] | undefined;
  user: User;
  fetchData: () => Promise<void>;
  refreshQuietly: () => Promise<void>;
  optimisticUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  fetchCollections: () => Promise<void>;
  handleCollectionChange: (id: string | null) => void;
  handleTagCreated: (tag: Tag) => void;
  handleUserUpdate: (updated: User) => void;
}

export function useProtectedContext() {
  return useOutletContext<ProtectedContext>();
}
```

Export `useProtectedContext` so page components can consume the shared data.

**Step 2: Commit**

```bash
git add web/src/layouts/ProtectedLayout.tsx
git commit -m "feat: add ProtectedLayout with auth guard and shared data context"
```

---

### Task 4: Create router definition and update App.tsx + main.tsx

**Files:**

- Create: `web/src/router.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/main.tsx`

**Step 1: Create router.tsx**

```tsx
// web/src/router.tsx
import { createBrowserRouter } from 'react-router';
import { lazy, Suspense } from 'react';
import PublicLayout from './layouts/PublicLayout';
import ProtectedLayout from './layouts/ProtectedLayout';
import LoginPage from './components/LoginPage';
import DeviceApproval from './components/DeviceApproval';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import AddTask from './components/AddTask';
import TopicProgress from './components/TopicProgress';
import Settings from './components/Settings';
import Spinner from './components/Spinner';

const ReviewSession = lazy(() => import('./components/ReviewSession'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const ExportView = lazy(() => import('./components/ExportView'));
const TemplateGallery = lazy(() => import('./components/TemplateGallery'));

function LazyFallback() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin h-6 w-6 border-2 border-zinc-500 border-t-zinc-200 rounded-full" />
    </div>
  );
}

// Helper to wrap lazy components
function withSuspense(Component: React.LazyExoticComponent<React.ComponentType<any>>) {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  // Public routes
  {
    element: <PublicLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/device-approve', element: <DeviceApproval /> },
      { path: '/privacy', element: <PrivacyPolicy /> },
      { path: '/terms', element: <TermsOfService /> },
    ],
  },
  // Protected routes
  {
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: '/tasks', element: <TaskList /> },
      { path: '/add', element: <AddTask /> },
      { path: '/review', element: withSuspense(ReviewSession) },
      { path: '/practice', element: withSuspense(ReviewSession) },
      { path: '/progress', element: <TopicProgress /> },
      { path: '/calendar', element: withSuspense(CalendarView) },
      { path: '/export', element: withSuspense(ExportView) },
      { path: '/settings', element: <Settings /> },
      { path: '/templates', element: withSuspense(TemplateGallery) },
    ],
  },
]);
```

**Step 2: Replace App.tsx**

```tsx
// web/src/App.tsx
import { RouterProvider } from 'react-router';
import { router } from './router';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
```

**Step 3: main.tsx stays the same** — it already renders `<App />`.

**Step 4: Commit**

```bash
git add web/src/router.tsx web/src/App.tsx
git commit -m "feat: add router definition and simplify App to RouterProvider"
```

---

### Task 5: Update Footer.tsx — replace onNavigate with Link

**Files:**

- Modify: `web/src/components/Footer.tsx`

**Step 1: Update Footer**

Replace the `onNavigate` prop and `handleLink` function with React Router `<Link>` components:

```tsx
import { Link } from 'react-router';
import { Github, Shield, FileText, Coffee } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800/50 mt-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 pb-20 md:pb-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          &copy; {new Date().getFullYear()} reps v{__APP_VERSION__}
        </span>
        <div className="flex items-center gap-3">
          <Link
            to="/privacy"
            className="hover:text-zinc-400 transition-colors flex items-center gap-1"
          >
            <Shield size={12} />
            Privacy
          </Link>
          <span className="text-zinc-700">|</span>
          <Link
            to="/terms"
            className="hover:text-zinc-400 transition-colors flex items-center gap-1"
          >
            <FileText size={12} />
            Terms
          </Link>
          {/* ... rest unchanged (GitHub and Coffee links are already <a> tags) */}
        </div>
      </div>
    </footer>
  );
}
```

Remove the `FooterProps` interface and `onNavigate` prop entirely.

**Step 2: Commit**

```bash
git add web/src/components/Footer.tsx
git commit -m "refactor: Footer uses Link instead of onNavigate callback"
```

---

### Task 6: Update Dashboard.tsx — replace onNavigate/onStartReview with useNavigate

**Files:**

- Modify: `web/src/components/Dashboard.tsx`

**Step 1: Update Dashboard**

1. Remove `onStartReview` and `onNavigate` from props.
2. Import `useNavigate` from `react-router` and `useProtectedContext` from layouts.
3. Get `tasks`, `dueTasks`, `activeCollectionId` from `useProtectedContext()` instead of props.
4. Replace `onStartReview()` → `navigate('/review')`.
5. Replace `onNavigate('practice')` → `navigate('/practice')`, etc.
6. Keep `onTopicClick` prop for now (it sets `initialTopicFilter` state in the layout, then navigates to `/tasks`).

Updated props interface:

```tsx
interface DashboardProps {
  onTopicClick?: (topic: string) => void;
}
```

Or — simpler — handle topic click with a search param: `navigate('/tasks?topic=' + topic)` and remove the prop entirely. TaskList can read `useSearchParams()` to get the initial filter. This is cleaner than threading state through the layout.

**Step 2: Commit**

```bash
git add web/src/components/Dashboard.tsx
git commit -m "refactor: Dashboard uses useNavigate and outlet context"
```

---

### Task 7: Update TemplateGallery.tsx — replace onNavigate with useNavigate

**Files:**

- Modify: `web/src/components/TemplateGallery.tsx`

**Step 1: Update TemplateGallery**

1. Remove `onNavigate` from props.
2. Import `useNavigate` from `react-router`.
3. Replace `onNavigate('tasks')` → `navigate('/tasks')`.
4. Get `user` from `useProtectedContext()` instead of props (remove from props).
5. Keep `onCollectionCreated` prop — it mutates parent state in the layout.

Updated props:

```tsx
interface TemplateGalleryProps {
  onCollectionCreated: (collection: Collection) => void;
}
```

Or get `onCollectionCreated` from outlet context too, which would make the component prop-free.

**Step 2: Commit**

```bash
git add web/src/components/TemplateGallery.tsx
git commit -m "refactor: TemplateGallery uses useNavigate and outlet context"
```

---

### Task 8: Update remaining page components to use outlet context

**Files:**

- Modify: `web/src/components/TaskList.tsx` — get props from `useProtectedContext()`
- Modify: `web/src/components/AddTask.tsx` — get props from `useProtectedContext()`
- Modify: `web/src/components/TopicProgress.tsx` — get props from `useProtectedContext()`
- Modify: `web/src/components/ReviewSession.tsx` — get props from `useProtectedContext()`, use `useLocation().pathname` to determine review vs practice mode
- Modify: `web/src/components/Settings.tsx` — get `user` and `onUserUpdate` from context

For each component:

1. Import `useProtectedContext` from `../layouts/ProtectedLayout`.
2. Replace props with context values.
3. Remove the now-unnecessary props from the interface.
4. Where callbacks like `onComplete` navigate somewhere, use `useNavigate()` instead.

**Step 2: Commit**

```bash
git add web/src/components/TaskList.tsx web/src/components/AddTask.tsx web/src/components/TopicProgress.tsx web/src/components/ReviewSession.tsx web/src/components/Settings.tsx
git commit -m "refactor: page components consume outlet context instead of props"
```

---

### Task 9: Update LoginPage — redirect to / when already authenticated

**Files:**

- Modify: `web/src/components/LoginPage.tsx`

**Step 1: Add auth redirect**

At the top of LoginPage, add:

```tsx
import { Navigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';

// Inside component:
const { isAuthenticated } = useAuth();
if (isAuthenticated) return <Navigate to="/" replace />;
```

This prevents authenticated users from seeing the login page.

**Step 2: Commit**

```bash
git add web/src/components/LoginPage.tsx
git commit -m "feat: LoginPage redirects to / when already authenticated"
```

---

### Task 10: Update PrivacyPolicy and TermsOfService — add back button with Link

**Files:**

- Modify: `web/src/components/PrivacyPolicy.tsx`
- Modify: `web/src/components/TermsOfService.tsx`

**Step 1: Add back navigation**

The old App.tsx had a "Back" button above these pages. Add a `<Link to="/">` at the top of each component (or in PublicLayout if preferred).

**Step 2: Commit**

```bash
git add web/src/components/PrivacyPolicy.tsx web/src/components/TermsOfService.tsx
git commit -m "feat: add back link to privacy and terms pages"
```

---

### Task 11: Clean up — remove dead View type and hash routing code

**Files:**

- Modify: `web/src/App.tsx` — should already be clean from Task 4

Verify no remaining references to:

- `window.location.hash`
- `getViewFromHash`
- `VALID_VIEWS`
- `LEGACY_REDIRECTS`
- The `View` type (except in components that define their own local version — those should also be removed)

Run: `cd web && grep -r "location.hash\|getViewFromHash\|VALID_VIEWS\|LEGACY_REDIRECTS" src/`
Expected: No matches

**Step 2: Commit if any cleanup needed**

```bash
git commit -am "chore: remove dead hash-routing code"
```

---

### Task 12: Manual verification

**Step 1: Build check**

Run: `cd web && npm run build`
Expected: No TypeScript errors, clean build

**Step 2: Dev server smoke test**

Run dev server and verify:

- `/` shows Dashboard (when authenticated)
- `/login` shows LoginPage
- `/tasks` shows TaskList
- `/privacy` and `/terms` show legal pages
- Browser back/forward works
- Direct URL navigation works (e.g. paste `/tasks` in address bar)
- Mobile bottom nav works
- Desktop nav highlights active route
- Collection switcher still works
- Review flow navigates correctly

**Step 3: Commit any fixes**

---

### Task 13: Update vite config — add react-router to manual chunks

**Files:**

- Modify: `web/vite.config.ts`

**Step 1: Add chunk**

In `manualChunks`, add:

```ts
'vendor-router': ['react-router'],
```

**Step 2: Commit**

```bash
git add web/vite.config.ts
git commit -m "chore: add react-router to vendor chunk splitting"
```
