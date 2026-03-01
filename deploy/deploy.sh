#!/bin/bash
set -e

# Ensure node/npm are available (nvm may not be loaded in non-login shells)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if ! command -v node &>/dev/null; then
  echo "✗ node not found — check nvm installation"
  exit 1
fi
echo "  Using node $(node --version)"

echo "→ Switching to main and pulling latest..."
git checkout main
git pull origin main

echo "→ Installing root dependencies..."
npm ci

echo "→ Installing web dependencies..."
cd web && npm ci && cd ..

echo "→ Running pre-migration backup..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if ! bash "$SCRIPT_DIR/backup.sh"; then
  echo "✗ Backup failed — aborting deploy"
  exit 1
fi

echo "→ Running database migrations..."
npm run migrate

echo "→ Building server..."
npm run build:server
cp package.json dist/package.json

echo "→ Building web..."
npm run build:web

echo "→ Checking nginx config..."
if ! sudo nginx -t; then
  echo "✗ nginx config test failed"
  exit 1
fi
sudo systemctl reload nginx

echo "→ Restarting reps with pm2..."
pm2 restart reps --update-env

echo "→ Verifying server is healthy..."
sleep 3
if curl -sf http://localhost:3000/health > /dev/null; then
  echo "✓ reps deployed successfully"
else
  echo "✗ Health check failed — server may not be running"
  pm2 logs reps --lines 20 --nostream
  exit 1
fi
