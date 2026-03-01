#!/bin/bash
set -e

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

echo "→ Updating nginx config..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/reps
sudo ln -sf /etc/nginx/sites-available/reps /etc/nginx/sites-enabled/reps
sudo nginx -t && sudo systemctl reload nginx

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
