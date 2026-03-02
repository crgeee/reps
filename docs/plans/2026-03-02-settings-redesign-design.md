# Settings Redesign — Subtab Navigation & New Preferences

**Date:** 2026-03-02
**Status:** Approved

## Problem

The Settings page is a single scrolling page with Profile, Notifications, Custom Topics, Sessions, and Admin sections all stacked vertically. It's already cluttered and needs room for new user preferences (date/time format, start of week, language).

## Design

### Layout

**Desktop (md+):** Vertical sidebar (~200px) on the left with tab labels + icons. Content panel on the right. Both scroll independently if content overflows.

**Mobile (<md):** Full-width list of tab labels. Tapping one slides the content in with a back arrow at top. Hash-based routing: `#settings` (shows tab list), `#settings/general`, `#settings/notifications`, `#settings/account`, `#settings/admin`.

### Tab Structure (4 tabs)

#### General (default) — Globe icon

- **Language**: Dropdown, `English` only for now (schema supports future i18n)
- **Date format**: `MM/DD/YYYY` | `DD/MM/YYYY` | `YYYY-MM-DD`
- **Time format**: `12-hour` | `24-hour`
- **Start of week**: `Sunday` | `Monday`
- **Timezone**: Existing IANA timezone dropdown
- **Theme**: `Dark` | `Light` | `System` (existing, still stored but not applied yet)
- **Daily review goal**: Existing stepper (1–50)

#### Notifications — Bell icon

- Daily briefing toggle (existing)
- Weekly insight toggle (existing)

#### Account — User icon

- Profile card: Gravatar, display name input, email (read-only)
- Custom topics: Existing add/remove with color swatches
- Active sessions: Existing list with revoke

#### Admin — Shield icon (visible only to admins)

- Stats cards (existing)
- User management (existing)
- Template management (existing)

### Data Model Changes

Add to `User` type and `users` DB table:

```typescript
timeFormat: '12h' | '24h'; // default: '12h'
dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'; // default: 'MM/DD/YYYY'
startOfWeek: 0 | 1; // 0=Sunday (default), 1=Monday
language: string; // default: 'en'
```

DB migration adds columns with defaults so existing users are unaffected.

### Component Structure

Break the current monolithic `Settings.tsx` into:

```
web/src/components/
├── Settings.tsx                    # Layout shell: sidebar + content area, tab routing
├── settings/
│   ├── GeneralSettings.tsx         # Language, date/time format, start of week, timezone, theme, daily goal
│   ├── NotificationSettings.tsx    # Daily briefing, weekly insight toggles
│   ├── AccountSettings.tsx         # Profile, custom topics, active sessions
│   ├── AdminSettings.tsx           # Admin panel (stats, users, templates)
│   └── shared.tsx                  # SectionHeader, ToggleRow, ListRow, SelectRow
```

### Save Behavior

Each tab has its own "Save changes" button that only persists that tab's fields via the existing `updateProfile` API. Topics and sessions use their own dedicated endpoints (no change).

### Routing

Extends current hash-based routing. `#settings` on mobile shows the tab list; on desktop it defaults to General. Subtab hashes: `#settings/general`, `#settings/notifications`, `#settings/account`, `#settings/admin`.

### What's NOT in scope

- Actually applying the theme to the DOM (theme is stored but dark mode is hardcoded — separate task)
- Full i18n/translation system (language field is future-proofing only)
- Applying date/time format globally across all components (separate task — this design adds the preferences, a follow-up wires them into display logic)
