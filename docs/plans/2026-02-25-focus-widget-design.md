# Focus Widget Design

## Problem

The FocusTimer (pomodoro) component exists (`web/src/components/FocusTimer.tsx`) but is only accessible inside ReviewSession and MockInterview. Users want it available across all views, plus a way to play focus music while studying.

## Solution

A floating/sticky widget in the bottom-right corner that persists across all views, combining the pomodoro timer with an embedded YouTube music player.

## Architecture

### New component: `FocusWidget.tsx`

Rendered at the App level (outside `<main>`) so it persists across view changes.

**Two states:**

1. **Collapsed** — small pill/FAB in bottom-right showing timer icon. If timer is running, shows remaining time. Click to expand.
2. **Expanded** — floating card containing:
   - The existing `FocusTimer` component (reused as-is)
   - A playlist selector dropdown
   - An embedded YouTube player (compact, ~280x158)
   - A close/collapse button

### Focus Music

Curated YouTube playlists embedded via iframe. No API key required.

Playlists:
- Lofi Hip Hop (lofi girl 24/7 stream)
- Classical Focus
- Ambient/Nature
- Brain.fm (external link, opens new tab for subscribers)

The YouTube iframe only loads when the user selects a playlist (lazy). Uses `allow="autoplay"` so playback starts on selection.

### State management

- Collapsed/expanded: `useState` + `localStorage` for persistence
- Selected playlist: `localStorage`
- Timer state: handled internally by existing `FocusTimer`
- No backend changes, no new API routes, no database

### Placement in App.tsx

```tsx
// After </main>, before closing </div>
<FocusWidget />
```

### Styling

- `fixed bottom-4 right-4 z-50`
- Dark card matching existing zinc theme
- Collapsed: ~48x48 pill or shows "MM:SS" when running
- Expanded: ~320px wide card
- Mobile: same position, responsive sizing

### What this does NOT include

- No Spotify/YouTube search or API integration
- No session tracking database (existing localStorage in FocusTimer is sufficient)
- No changes to ReviewSession or MockInterview inline timers
- No embed players for non-YouTube services
