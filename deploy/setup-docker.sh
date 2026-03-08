#!/usr/bin/env bash
set -euo pipefail

# setup-docker.sh — Hetzner VPS preparation for reps learning tracks
# Idempotent: safe to run multiple times.

APP_ENV="/var/www/reps/.env"

echo "=== reps Docker setup ==="

# 1. Add 2GB swap if not present
if [ -f /swapfile ]; then
  echo "[swap] /swapfile already exists, skipping"
else
  echo "[swap] Creating 2GB swap..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "[swap] Done"
fi

# 2. Install Docker if not installed
if command -v docker &>/dev/null; then
  echo "[docker] Docker already installed ($(docker --version))"
else
  echo "[docker] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  echo "[docker] Done"
fi

# Add chris to docker group if not already a member
if id -nG chris 2>/dev/null | grep -qw docker; then
  echo "[docker] User chris already in docker group"
else
  echo "[docker] Adding chris to docker group..."
  usermod -aG docker chris
  echo "[docker] Done (re-login required for group change)"
fi

# 3. Build the reps-runner-python image
echo "[build] Building reps-runner-python image..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
docker build -t reps-runner-python -f "$SCRIPT_DIR/Dockerfile.runner-python" "$SCRIPT_DIR"
echo "[build] Done"

# 4. Docker cleanup cron (daily at 3am)
CLEANUP_CRON="/etc/cron.d/reps-docker-cleanup"
if [ -f "$CLEANUP_CRON" ]; then
  echo "[cron] $CLEANUP_CRON already exists, skipping"
else
  echo "[cron] Creating Docker cleanup cron..."
  cat > "$CLEANUP_CRON" <<'CRON'
# Daily Docker cleanup — remove dangling images, stopped containers, unused networks
0 3 * * * root docker system prune -f >> /var/log/reps/docker-cleanup.log 2>&1
CRON
  chmod 644 "$CLEANUP_CRON"
  echo "[cron] Done"
fi

# 5. Container sweeper cron (every 5 minutes)
SWEEPER_CRON="/etc/cron.d/reps-container-sweeper"
if [ -f "$SWEEPER_CRON" ]; then
  echo "[cron] $SWEEPER_CRON already exists, skipping"
else
  echo "[cron] Creating container sweeper cron..."
  cat > "$SWEEPER_CRON" <<'CRON'
# Kill any lingering reps-runner-python containers every 5 minutes
*/5 * * * * root docker ps -q --filter ancestor=reps-runner-python | xargs -r docker kill >> /var/log/reps/container-sweeper.log 2>&1
CRON
  chmod 644 "$SWEEPER_CRON"
  echo "[cron] Done"
fi

# 6. Add FEATURE_LEARNING_TRACKS=true to .env if not present
if [ -f "$APP_ENV" ] && grep -q '^FEATURE_LEARNING_TRACKS=' "$APP_ENV"; then
  echo "[env] FEATURE_LEARNING_TRACKS already set in $APP_ENV"
else
  echo "[env] Adding FEATURE_LEARNING_TRACKS=true to $APP_ENV..."
  echo 'FEATURE_LEARNING_TRACKS=true' >> "$APP_ENV"
  echo "[env] Done"
fi

echo "=== Setup complete ==="
