#!/bin/bash
set -e
git pull
npm ci
npm run migrate
npm run build:server
npm run build:web
pm2 restart reps
echo "reps deployed ✓"
