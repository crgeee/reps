# Contributing to reps

Thanks for your interest in contributing! Here's how to get started.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm

## Local Setup

```bash
git clone https://github.com/crgeee/reps.git
cd reps

# Install dependencies
npm install
cd web && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your local PostgreSQL credentials

# Run migrations
npm run migrate

# Start dev servers (two terminals)
npm run dev:server   # API on :3000
npm run dev:web      # Vite on :5173
```

## Environment Variables

All configuration is done via `.env` — see `.env.example` for the full list. No secrets should ever be hardcoded in source files.

Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `APP_URL` — Your app's public URL (used for CORS, auth redirects, emails)
- `ANTHROPIC_API_KEY` — Required for AI features (optional for basic task management)
- `RESEND_API_KEY` + `RESEND_FROM` — Required for email features (optional)
- `PUSHOVER_*` — Required for push notifications (optional)

## Development

```bash
npm run dev:server    # Server with hot reload
npm run dev:web       # Vite dev server
npm run typecheck     # TypeScript check
npm run lint          # ESLint
npm run build         # Full production build
```

## Project Structure

- `src/` — CLI (Commander.js). Additive changes only — do not break existing commands.
- `server/` — Hono API server with postgres.js (no ORM).
- `web/` — React + Vite SPA with Tailwind CSS.
- `db/` — SQL migration files (run in alphabetical order).
- `deploy/` — Production deployment configs.

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes with clear, focused commits
3. Ensure `npm run typecheck` and `npm run build` pass
4. Open a PR against `main` with a clear description

## Code Style

- TypeScript strict mode throughout
- No ORMs — raw SQL via postgres.js
- Tailwind utility classes only (no custom CSS)
- Keep it simple — no over-engineering

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
