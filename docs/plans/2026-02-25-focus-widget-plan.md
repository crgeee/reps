# Focus Widget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a floating focus widget (pomodoro timer + embedded YouTube focus music) that persists across all views.

**Architecture:** New `FocusWidget.tsx` component rendered at the App level after `</main>`. Wraps existing `FocusTimer` component. Adds a curated YouTube playlist selector with iframe embed. Collapsed/expanded state persisted in localStorage.

**Tech Stack:** React, Tailwind CSS, lucide-react icons, YouTube iframe embed (no API key)

**Design doc:** `docs/plans/2026-02-25-focus-widget-design.md`

---

### Task 1: Create FocusWidget component

**Files:**
- Create: `web/src/components/FocusWidget.tsx`

**Step 1: Create the FocusWidget component**

```tsx
import { useState, useEffect } from 'react';
import { Timer, X, ChevronDown, Music, ExternalLink } from 'lucide-react';
import FocusTimer from './FocusTimer';

const PLAYLISTS = [
  { id: 'jfKfPfyJRdk', label: 'Lofi Hip Hop', description: 'lofi girl 24/7' },
  { id: 'DWcJFNfaw9c', label: 'Classical Focus', description: 'classical music' },
  { id: '5yx6BWlEVcY', label: 'Ambient', description: 'ambient soundscapes' },
];

const EXTERNAL_LINKS = [
  { label: 'Brain.fm', url: 'https://www.brain.fm', description: 'AI focus music (subscription)' },
];

function getStoredState<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

export default function FocusWidget() {
  const [expanded, setExpanded] = useState(() => getStoredState('reps_focus_expanded', false));
  const [activePlaylist, setActivePlaylist] = useState<string | null>(() =>
    getStoredState('reps_focus_playlist', null)
  );
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDisplay, setTimerDisplay] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('reps_focus_expanded', JSON.stringify(expanded));
  }, [expanded]);

  useEffect(() => {
    localStorage.setItem('reps_focus_playlist', JSON.stringify(activePlaylist));
  }, [activePlaylist]);

  // Poll the timer display from the DOM when collapsed + timer is running
  // (The FocusTimer manages its own state internally, so we read the display)
  useEffect(() => {
    if (expanded || !timerRunning) {
      setTimerDisplay(null);
      return;
    }
    const interval = setInterval(() => {
      const el = document.querySelector('[data-focus-timer-display]');
      if (el) setTimerDisplay(el.textContent);
    }, 1000);
    return () => clearInterval(interval);
  }, [expanded, timerRunning]);

  const activeLabel = PLAYLISTS.find((p) => p.id === activePlaylist)?.label;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-full shadow-lg hover:bg-zinc-800 hover:border-zinc-600 transition-all duration-200 group"
      >
        <Timer className="w-4 h-4 text-amber-400" />
        {timerDisplay ? (
          <span className="text-sm font-mono text-zinc-100 tabular-nums">{timerDisplay}</span>
        ) : (
          <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Focus</span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-zinc-200">Focus</span>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Timer */}
      <div className="p-4">
        <FocusTimer />
      </div>

      {/* Music section */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Music className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Focus Music</span>
        </div>

        {/* Playlist selector */}
        <div className="relative mb-2">
          <button
            onClick={() => setPlaylistOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-750 hover:border-zinc-600 transition-colors"
          >
            <span>{activeLabel ?? 'Select playlist...'}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${playlistOpen ? 'rotate-180' : ''}`} />
          </button>

          {playlistOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-10">
              {PLAYLISTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setActivePlaylist(p.id); setPlaylistOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    activePlaylist === p.id
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50'
                  }`}
                >
                  <div>{p.label}</div>
                  <div className="text-xs text-zinc-500">{p.description}</div>
                </button>
              ))}
              {activePlaylist && (
                <>
                  <div className="border-t border-zinc-700 my-1" />
                  <button
                    onClick={() => { setActivePlaylist(null); setPlaylistOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Stop music
                  </button>
                </>
              )}
              <div className="border-t border-zinc-700 my-1" />
              {EXTERNAL_LINKS.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 transition-colors"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="w-3 h-3 text-zinc-600" />
                  <span className="text-xs text-zinc-600 ml-auto">{link.description}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* YouTube embed */}
        {activePlaylist && (
          <div className="rounded-lg overflow-hidden bg-black">
            <iframe
              width="100%"
              height="158"
              src={`https://www.youtube.com/embed/${activePlaylist}?autoplay=1&rel=0`}
              title="Focus music"
              allow="autoplay; encrypted-media"
              allowFullScreen={false}
              className="block"
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd web && npx tsc --noEmit`
Expected: no errors (or only pre-existing ones)

**Step 3: Commit**

```
git add web/src/components/FocusWidget.tsx
git commit -m "feat: add FocusWidget with pomodoro timer and YouTube focus music"
```

---

### Task 2: Wire FocusWidget into App.tsx

**Files:**
- Modify: `web/src/App.tsx`

**Step 1: Add import and render FocusWidget**

Add import at the top of `web/src/App.tsx` alongside other component imports:

```tsx
import FocusWidget from './components/FocusWidget';
```

Render `<FocusWidget />` after the closing `</main>` tag (line 421), before the final closing `</div>`:

```tsx
      </main>
      <FocusWidget />
    </div>
```

The widget should NOT render when `hasApiKey` is false (it's already inside the `hasApiKey` conditional return block, so this is handled automatically).

**Step 2: Verify dev server renders the widget**

Run: `cd web && npx vite --open`
Expected: small "Focus" pill visible in bottom-right corner on all views

**Step 3: Build check**

Run: `npm run build:web`
Expected: successful build, no errors

**Step 4: Commit**

```
git add web/src/App.tsx
git commit -m "feat: wire FocusWidget into App layout"
```

---

### Task 3: Add data attribute to FocusTimer for collapsed display

**Files:**
- Modify: `web/src/components/FocusTimer.tsx`

**Step 1: Add data attribute to the timer display span**

In `FocusTimer.tsx`, find the countdown display span (around line 129):

```tsx
            <span className="text-zinc-100 text-sm font-mono font-semibold tabular-nums">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
```

Add a `data-focus-timer-display` attribute so FocusWidget can read the time when collapsed:

```tsx
            <span data-focus-timer-display className="text-zinc-100 text-sm font-mono font-semibold tabular-nums">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
```

Also, add a `data-focus-timer-running` attribute to the root div so FocusWidget can detect running state. Find the root div (line 108):

```tsx
    <div className="flex items-center gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg transition-all duration-200">
```

Change to:

```tsx
    <div data-focus-timer-running={running || undefined} className="flex items-center gap-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg transition-all duration-200">
```

**Step 2: Build check**

Run: `npm run build:web`
Expected: successful build

**Step 3: Commit**

```
git add web/src/components/FocusTimer.tsx
git commit -m "feat: add data attributes to FocusTimer for widget integration"
```

---

### Task 4: Lint check + final build verification

**Files:** none (verification only)

**Step 1: Run lint**

Run: `npm run lint`
Expected: 0 errors (warnings in src/ are acceptable)

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: passes (server code unaffected)

**Step 3: Run full build**

Run: `npm run build`
Expected: both server and web build successfully

**Step 4: Final commit if any adjustments were needed**

If lint or build required fixes, commit them:

```
git commit -m "fix: address lint/build issues in focus widget"
```
