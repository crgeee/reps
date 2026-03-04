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

echo "→ Stopping reps before dependency install..."
pm2 stop reps || true

# If deploy fails after pm2 stop, try to restart the previous version
trap '
  echo "!! Deploy failed — attempting to restart previous version..."
  if pm2 start reps --update-env; then
    echo "!! Previous version restarted — app should be available"
  else
    echo "!! CRITICAL: Recovery failed — app is DOWN. Manual intervention required."
  fi
' ERR

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

trap - ERR
echo "→ Starting reps with pm2..."
pm2 start reps --update-env

echo "→ Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "  Backend ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "✗ Backend failed to start after 30s"
    pm2 logs reps --lines 20 --nostream
    exit 1
  fi
  sleep 1
done

echo "→ Syncing nginx config..."
sudo cp /etc/nginx/sites-available/reps /etc/nginx/sites-available/reps.bak
sudo cp deploy/nginx.conf /etc/nginx/sites-available/reps
if ! sudo nginx -t; then
  echo "✗ nginx config test failed — rolling back"
  sudo cp /etc/nginx/sites-available/reps.bak /etc/nginx/sites-available/reps
  exit 1
fi

# Re-apply SSL cert (Certbot modifies the config in-place)
if command -v certbot &>/dev/null; then
  echo "→ Re-applying SSL certificate..."
  if ! sudo certbot --nginx -d reps-prep.duckdns.org --non-interactive --agree-tos --email crgeee@gmail.com; then
    echo "✗ Certbot failed — rolling back nginx config"
    sudo cp /etc/nginx/sites-available/reps.bak /etc/nginx/sites-available/reps
    sudo systemctl reload nginx
    exit 1
  fi
fi

if ! sudo systemctl reload nginx; then
  echo "✗ nginx reload failed — rolling back config"
  sudo cp /etc/nginx/sites-available/reps.bak /etc/nginx/sites-available/reps
  sudo systemctl reload nginx
  exit 1
fi

echo "→ Verifying deployment..."
sleep 2
if curl -sf http://localhost:3000/health > /dev/null; then
  echo "  ✓ Backend healthy"
else
  echo "✗ Health check failed — server may not be running"
  pm2 logs reps --lines 20 --nostream
  exit 1
fi

if curl -sf https://reps-prep.duckdns.org/ > /dev/null 2>&1; then
  echo "  ✓ HTTPS healthy"
else
  echo "  ⚠ HTTPS not reachable — check SSL certificate"
fi

echo "✓ reps deployed successfully"
