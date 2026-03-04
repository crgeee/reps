# React Router v7 Implementation Design

## Approach

Replace hash-based routing with React Router v7 (`createBrowserRouter`). Two layout shells: `ProtectedLayout` (auth + header + nav + data fetching) and `PublicLayout` (minimal wrapper). No legacy hash redirect support.

## Route Map

| Path | Component | Layout |
|------|-----------|--------|
| `/` | Dashboard | Protected |
| `/tasks` | TaskList | Protected |
| `/add` | AddTask | Protected |
| `/review` | ReviewSession (review) | Protected |
| `/practice` | ReviewSession (practice) | Protected |
| `/progress` | TopicProgress | Protected |
| `/calendar` | CalendarView | Protected |
| `/export` | ExportView | Protected |
| `/settings` | Settings | Protected |
| `/templates` | TemplateGallery | Protected |
| `/login` | LoginPage | Public |
| `/device-approve` | DeviceApproval | Public |
| `/privacy` | PrivacyPolicy | Public |
| `/terms` | TermsOfService | Public |

## Layout Nesting

- `ProtectedLayout`: checks `useAuth()`, redirects to `/login` if unauthenticated, renders header/nav/mobile-bottom-nav/footer around `<Outlet />`
- `PublicLayout`: renders Footer around `<Outlet />`

## Files Changed

- **New**: `web/src/router.tsx`, `web/src/layouts/ProtectedLayout.tsx`, `web/src/layouts/PublicLayout.tsx`
- **Gutted**: `App.tsx` becomes router provider only
- **Updated**: `Footer.tsx`, `Dashboard.tsx`, `TemplateGallery.tsx` — replace `onNavigate` callbacks with `useNavigate()` / `<Link>`
- **Updated**: `main.tsx` — render `RouterProvider`

## What Stays the Same

- All component internals (TaskList, ReviewSession, AddTask, etc.)
- `useAuth` hook
- API layer
- Vite proxy config
- Nginx `try_files` already supports SPA fallback
