# reps

AI-powered interview prep tracker with spaced repetition, coaching, and push notifications.

The name is a double meaning: "getting your reps in" (training) and the `repetitions` field in the [SM-2 spaced repetition algorithm](https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm) the app is built on.

[![Deploy](https://github.com/crgeee/reps/actions/workflows/deploy.yml/badge.svg)](https://github.com/crgeee/reps/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-crgeee-orange?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/crgeee)

## Features

- **Spaced repetition** — SM-2 algorithm schedules reviews at optimal intervals
- **AI coaching** — Daily briefings and weekly insights powered by Claude
- **Mock interviews** — AI-generated questions with structured evaluation
- **Board view** — Kanban-style drag-and-drop with custom statuses per collection
- **Collections & tags** — Organize tasks into collections with custom workflows
- **Push notifications** — Pushover integration for iOS/Android reminders
- **Email digests** — Daily summary of due reviews via Resend
- **CLI** — Full-featured terminal interface for quick task management

## Stack

| Layer | Technology |
|-------|-----------|
| API | [Hono](https://hono.dev) + Node.js |
| DB | PostgreSQL + [postgres.js](https://github.com/porsager/postgres) |
| Frontend | React + Vite + Tailwind CSS |
| AI | [Anthropic SDK](https://docs.anthropic.com/en/docs/build-with-claude/claude-code) (Claude) |
| Notifications | Pushover (push) + Resend (email) |

## Quick Start

```bash
git clone https://github.com/crgeee/reps.git
cd reps
npm install && cd web && npm install && cd ..
cp .env.example .env
# Edit .env with your PostgreSQL credentials
npm run migrate
npm run dev:server   # Terminal 1
npm run dev:web      # Terminal 2
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup instructions.

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in your values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_URL` | Yes | Public URL (CORS, auth redirects, emails) |
| `ANTHROPIC_API_KEY` | For AI | Enables coaching, mock interviews, evaluation |
| `RESEND_API_KEY` | For email | Daily digest emails |
| `RESEND_FROM` | For email | Sender address |
| `PUSHOVER_USER_KEY` | For push | Pushover notifications |
| `PUSHOVER_API_TOKEN` | For push | Pushover notifications |
| `PORT` | No | Server port (default: 3000) |

## CLI

```bash
npx reps              # Dashboard
npx reps add          # Add a task
npx reps list         # List all tasks
npx reps review       # Start a review session
npx reps done <id>    # Mark task complete
npx reps note <id>    # Add a note
npx reps status       # Show prep status
```

## Deployment

The app runs on a single VPS with pm2 and nginx:

```bash
npm run build         # Build server + web
npm run migrate       # Run DB migrations
pm2 start deploy/ecosystem.config.cjs
```

See `deploy/` for nginx config and deploy script.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

If you find this useful, consider [buying me a coffee](https://buymeacoffee.com/crgeee).

## License

[MIT](LICENSE)
