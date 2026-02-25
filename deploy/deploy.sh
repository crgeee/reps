#!/bin/bash
set -e

echo "→ Pulling latest changes..."
git pull

echo "→ Installing root dependencies..."
npm ci

echo "→ Installing web dependencies..."
cd web && npm ci && cd ..

echo "→ Running database migrations..."
npm run migrate

echo "→ Building server..."
npm run build:server

echo "→ Building web..."
npm run build:web

echo "→ Restarting reps with pm2..."
pm2 restart reps --update-env

echo "✓ reps deployed successfully"
