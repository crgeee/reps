# Settings Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize Settings into sidebar-tabbed navigation (General, Notifications, Account, Admin) and add user preferences for date format, time format, start of week, and language.

**Architecture:** Add 4 new columns to `users` table. Extend the server-side User type, validation schema, and updateProfile function. Refactor the monolithic Settings.tsx into a layout shell with sub-components per tab. Desktop shows vertical sidebar + content panel; mobile shows drill-down list.

**Tech Stack:** PostgreSQL migration, Zod validation, React components, Tailwind CSS

**Design doc:** `docs/plans/2026-03-02-settings-redesign-design.md`

---

### Task 1: Database Migration — Add Preference Columns

**Files:**
- Create: `db/010-user-preferences.sql`

**Step 1: Create migration file**

```sql
-- Add user preference columns for date/time formatting and locale
ALTER TABLE users ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '12h' CHECK (time_format IN ('12h', '24h'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'MM/DD/YYYY' CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_of_week INT DEFAULT 0 CHECK (start_of_week IN (0, 1));
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
```

**Step 2: Run migration locally**

Run: `npm run migrate`
Expected: "Applied 010-user-preferences.sql"

**Step 3: Verify columns exist**

Run: `psql $DATABASE_URL -c "\d users" | grep -E "time_format|date_format|start_of_week|language"`
Expected: All 4 columns listed with defaults

**Step 4: Commit**

```bash
git add db/010-user-preferences.sql
git commit -m "feat: add user preference columns for date/time format, start of week, language"
```

---

### Task 2: Server — Extend User Type & Update Logic

**Files:**
- Modify: `server/auth/users.ts` (User interface lines 3-17, UserRow lines 19-33, rowToUser lines 35-51, updateUserProfile lines 74-110)

**Step 1: Add fields to User interface (line 14, before createdAt)**

```typescript
  timeFormat: string;
  dateFormat: string;
  startOfWeek: number;
  language: string;
```

**Step 2: Add fields to UserRow interface (line 31, before created_at)**

```typescript
  time_format: string;
  date_format: string;
  start_of_week: number;
  language: string;
```

**Step 3: Add fields to rowToUser (line 48, before createdAt)**

```typescript
    timeFormat: row.time_format,
    dateFormat: row.date_format,
    startOfWeek: row.start_of_week,
    language: row.language,
```

**Step 4: Extend updateUserProfile parameter type (line 76, add to updates object type)**

```typescript
    timeFormat?: string;
    dateFormat?: string;
    startOfWeek?: number;
    language?: string;
```

**Step 5: Extend fieldMap (line 91, add entries)**

```typescript
    timeFormat: 'time_format',
    dateFormat: 'date_format',
    startOfWeek: 'start_of_week',
    language: 'language',
```

**Step 6: Commit**

```bash
git add server/auth/users.ts
git commit -m "feat: extend User type with preference fields"
```

---

### Task 3: Server — Add Validation for New Fields

**Files:**
- Modify: `server/routes/users.ts` (updateProfileSchema lines 15-26)

**Step 1: Add new fields to updateProfileSchema (line 25, before closing brace)**

```typescript
  timeFormat: z.enum(['12h', '24h']).optional(),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  startOfWeek: z.number().int().min(0).max(1).optional(),
  language: z.string().max(10).optional(),
```

**Step 2: Test with curl**

Run: `curl -s -X PATCH http://localhost:3000/users/me -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" -d '{"timeFormat":"24h","dateFormat":"YYYY-MM-DD","startOfWeek":1,"language":"en"}' | jq '.timeFormat, .dateFormat, .startOfWeek, .language'`
Expected: `"24h"`, `"YYYY-MM-DD"`, `1`, `"en"`

**Step 3: Test validation rejects bad values**

Run: `curl -s -X PATCH http://localhost:3000/users/me -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" -d '{"timeFormat":"25h"}' | jq '.error'`
Expected: `"Validation failed"`

**Step 4: Commit**

```bash
git add server/routes/users.ts
git commit -m "feat: add validation for user preference fields"
```

---

### Task 4: Frontend — Extend User Type

**Files:**
- Modify: `web/src/types.ts` (User interface lines 215-229)

**Step 1: Add fields to User interface (line 227, before createdAt)**

```typescript
  timeFormat: string;
  dateFormat: string;
  startOfWeek: number;
  language: string;
```

**Step 2: Commit**

```bash
git add web/src/types.ts
git commit -m "feat: extend frontend User type with preference fields"
```

---

### Task 5: Frontend — Create Shared Settings Sub-Components

**Files:**
- Create: `web/src/components/settings/shared.tsx`

**Step 1: Create the shared file**

Extract `SectionHeader`, `ToggleRow`, `ListRow`, and `SECTION_ICONS` from `Settings.tsx` (lines 636-746) into `web/src/components/settings/shared.tsx`. Export all of them. Add a new `SelectRow` component:

```typescript
export function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-400">{label}</span>
      {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
```

Also add a new icon entry for `'globe'` in `SECTION_ICONS` (for the General tab):

```typescript
globe: (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418"
  />
),
```

**Step 2: Commit**

```bash
mkdir -p web/src/components/settings
git add web/src/components/settings/shared.tsx
git commit -m "refactor: extract shared settings sub-components"
```

---

### Task 6: Frontend — Create GeneralSettings Tab Component

**Files:**
- Create: `web/src/components/settings/GeneralSettings.tsx`

**Step 1: Create the component**

This component renders: Language, Date format, Time format, Start of week, Timezone, Theme, Daily review goal, and a Save button.

Props:
```typescript
interface Props {
  user: User;
  onSave: (updates: Partial<User>) => Promise<void>;
  saving: boolean;
  saveMessage: { text: string; type: 'success' | 'error' } | null;
}
```

State fields: `language`, `dateFormat`, `timeFormat`, `startOfWeek`, `timezone`, `theme`, `dailyGoal`.

Initialize from `user` props. On save, call `onSave({ language, dateFormat, timeFormat, startOfWeek, timezone, theme, dailyReviewGoal: dailyGoal })`.

Use `SectionHeader` with `globe` icon and title "General". Use the `SelectRow` component for dropdowns. Reuse the existing daily goal stepper UI pattern.

Options:
- Language: `[{ value: 'en', label: 'English' }]`
- Date format: `[{ value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }, { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }]`
- Time format: `[{ value: '12h', label: '12-hour (1:30 PM)' }, { value: '24h', label: '24-hour (13:30)' }]`
- Start of week: `[{ value: '0', label: 'Sunday' }, { value: '1', label: 'Monday' }]` (convert to/from number)
- Timezone: existing `buildTimezoneOptions()` list
- Theme: existing `THEMES` array

**Step 2: Commit**

```bash
git add web/src/components/settings/GeneralSettings.tsx
git commit -m "feat: create GeneralSettings tab component"
```

---

### Task 7: Frontend — Create NotificationSettings Tab Component

**Files:**
- Create: `web/src/components/settings/NotificationSettings.tsx`

**Step 1: Create the component**

Props:
```typescript
interface Props {
  user: User;
  onSave: (updates: Partial<User>) => Promise<void>;
  saving: boolean;
  saveMessage: { text: string; type: 'success' | 'error' } | null;
}
```

State: `notifyDaily`, `notifyWeekly`. Uses `SectionHeader` with `bell` icon. Two `ToggleRow` components (existing content from Settings.tsx lines 270-288). Save button at bottom.

**Step 2: Commit**

```bash
git add web/src/components/settings/NotificationSettings.tsx
git commit -m "feat: create NotificationSettings tab component"
```

---

### Task 8: Frontend — Create AccountSettings Tab Component

**Files:**
- Create: `web/src/components/settings/AccountSettings.tsx`

**Step 1: Create the component**

Props:
```typescript
interface Props {
  user: User;
  onSave: (updates: Partial<User>) => Promise<void>;
  saving: boolean;
  saveMessage: { text: string; type: 'success' | 'error' } | null;
}
```

Contains 3 sections (from existing Settings.tsx):
1. **Profile** — Gravatar, display name input, email read-only. Save button after profile section.
2. **Custom Topics** — Full existing topics section (lines 308-377). Fetches topics on mount, add/remove handlers.
3. **Active Sessions** — Full existing sessions section (lines 379-403). Fetches sessions on mount, revoke handler.

Move all topic/session state and fetch logic into this component.

**Step 2: Commit**

```bash
git add web/src/components/settings/AccountSettings.tsx
git commit -m "feat: create AccountSettings tab component"
```

---

### Task 9: Frontend — Create AdminSettings Tab Component

**Files:**
- Create: `web/src/components/settings/AdminSettings.tsx`

**Step 1: Create the component**

Props:
```typescript
interface Props {
  user: User;
}
```

Move existing admin panel (Settings.tsx lines 407-631) into this component. It manages its own state: `adminUsers`, `adminStats`, `adminTemplates`. Fetches on mount.

**Step 2: Commit**

```bash
git add web/src/components/settings/AdminSettings.tsx
git commit -m "feat: create AdminSettings tab component"
```

---

### Task 10: Frontend — Rewrite Settings.tsx as Layout Shell with Sidebar Navigation

**Files:**
- Modify: `web/src/components/Settings.tsx`

**Step 1: Replace Settings.tsx with layout shell**

Define tab type and list:
```typescript
type SettingsTab = 'general' | 'notifications' | 'account' | 'admin';

const TABS: { id: SettingsTab; label: string; icon: string; adminOnly?: boolean }[] = [
  { id: 'general', label: 'General', icon: 'globe' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'admin', label: 'Admin', icon: 'shield', adminOnly: true },
];
```

State: `activeTab` (default `'general'`), `saving`, `saveMessage`.

Shared `handleSave` function that calls `updateProfile` and `onUserUpdate`.

**Desktop layout (md+):**
```
┌──────────────────────────────────────────┐
│ Settings                                 │
├────────────┬─────────────────────────────┤
│ ○ General  │                             │
│ ○ Notif... │  [Active tab content]       │
│ ○ Account  │                             │
│ ○ Admin    │                             │
├────────────┴─────────────────────────────┤
```

Sidebar: `w-48 flex-shrink-0` column of buttons. Active tab gets `bg-zinc-800 text-zinc-100`, inactive gets `text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900`. Each button shows icon + label.

Content: `flex-1 min-w-0` renders the active tab component.

**Mobile layout (<md):**
- When no `activeTab` is drilled into (or on first load): show list of tabs as full-width buttons, each with icon, label, and chevron right.
- When a tab is active: show back button ("← Settings") at top, then the tab content.
- Use `mobileView` state: `null` (list) or `SettingsTab` (drilled in).

Filter out admin tab if `!user.isAdmin`.

Import and render the 4 tab components conditionally based on `activeTab`.

**Step 2: Remove old sub-components from Settings.tsx**

Delete `SectionHeader`, `ToggleRow`, `ListRow`, `SECTION_ICONS` from the bottom of Settings.tsx (they now live in `settings/shared.tsx`).

**Step 3: Verify build**

Run: `cd web && npx vite build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add web/src/components/Settings.tsx
git commit -m "feat: rewrite Settings as tabbed layout with sidebar navigation"
```

---

### Task 11: Visual QA & Polish

**Step 1: Test desktop layout**

Run: `cd web && npx vite`
Navigate to `#settings`. Verify:
- Sidebar visible on left with 4 tabs (3 if not admin)
- Clicking tabs switches content
- Save works per tab
- All existing functionality preserved

**Step 2: Test mobile layout**

Use browser devtools to set viewport to 375px wide. Verify:
- Tab list shows as full-width buttons
- Tapping drills into tab content with back button
- Back button returns to tab list
- All sections render properly on narrow viewport

**Step 3: Test new preferences**

- Change date format to DD/MM/YYYY, save, refresh — value persists
- Change time format to 24h, save, refresh — value persists
- Change start of week to Monday, save, refresh — value persists

**Step 4: Final commit if any polish needed**

```bash
git add -A
git commit -m "fix: settings polish and visual adjustments"
```
