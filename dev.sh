#!/usr/bin/env bash
set -e

# --- reps local dev ---
# Starts: PostgreSQL (Docker), runs migrations, API server, Vite frontend

RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[2m'
RESET='\033[0m'

PIDS=()

cleanup() {
  echo ""
  echo -e "${DIM}Shutting down...${RESET}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo -e "${GREEN}Done.${RESET}"
}
trap cleanup EXIT INT TERM

# 0. Check Docker is available
if ! command -v docker &>/dev/null; then
  echo -e "${RED}ERROR: docker is not installed${RESET}"
  exit 1
fi
if ! docker info &>/dev/null; then
  echo -e "${RED}ERROR: Docker daemon is not running. Start Docker Desktop and try again.${RESET}"
  exit 1
fi

# 1. Start Postgres if not already running
if docker compose ps --status running 2>/dev/null | grep -q db; then
  echo -e "${DIM}PostgreSQL already running${RESET}"
else
  echo -e "${GREEN}Starting PostgreSQL...${RESET}"
  docker compose up -d db
  echo -n "Waiting for PostgreSQL"
  PG_READY=0
  for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U reps -q 2>/dev/null; then
      echo -e " ${GREEN}ready${RESET}"
      PG_READY=1
      break
    fi
    echo -n "."
    sleep 1
  done
  if [ "$PG_READY" -eq 0 ]; then
    echo ""
    echo -e "${RED}ERROR: PostgreSQL did not start within 30s${RESET}"
    echo -e "${DIM}Check: docker compose logs db${RESET}"
    exit 1
  fi
fi

# 2. Run migrations
echo -e "${GREEN}Running migrations...${RESET}"
npm run migrate

# 3. Start API server (background)
echo -e "${GREEN}Starting API server on :3000...${RESET}"
node --env-file=.env --import=tsx/esm --watch server/index.ts &
PIDS+=($!)
API_PID=$!
sleep 2

if ! kill -0 "$API_PID" 2>/dev/null; then
  echo -e "${RED}ERROR: API server failed to start. Check output above.${RESET}"
  exit 1
fi

# 4. Start Vite dev server (background)
echo -e "${GREEN}Starting Vite on :5173...${RESET}"
(cd web && npx vite) &
PIDS+=($!)

echo ""
echo -e "${GREEN}reps dev environment ready${RESET}"
echo -e "  Frontend: ${GREEN}http://localhost:5173${RESET}"
echo -e "  API:      ${GREEN}http://localhost:3000${RESET}"
echo -e "  Health:   ${DIM}http://localhost:3000/health${RESET}"
echo ""
echo -e "${DIM}Press Ctrl+C to stop${RESET}"

wait
