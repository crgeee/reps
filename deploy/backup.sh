#!/bin/bash
#
# reps — PostgreSQL backup script
#
# Dumps the reps database to /var/backups/reps/ with gzip compression.
# Retains backups for 14 days, then deletes older files.
#
# Server cron setup (run as the app user):
#   0 3 * * * /var/www/reps/deploy/backup.sh >> /var/log/reps/backup.log 2>&1
#
# Recommendation: Also enable Hetzner automated server snapshots (weekly)
# via the Hetzner Cloud console as a second recovery layer. Cost is ~20%
# of the server price. This protects against issues beyond just the database
# (e.g. corrupted config, lost SSL certs, OS-level problems).
#
set -euo pipefail

BACKUP_DIR="/var/backups/reps"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/reps_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup..."

# Load DATABASE_URL from .env if available
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  export DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
fi

# Dump and compress
if pg_dump "${DATABASE_URL:-postgresql://reps@localhost/reps}" | gzip > "$BACKUP_FILE"; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date -Iseconds)] Backup successful: ${BACKUP_FILE} (${SIZE})"
else
  echo "[$(date -Iseconds)] ERROR: Backup failed" >&2
  exit 1
fi

# Prune old backups
DELETED=$(find "$BACKUP_DIR" -name "reps_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date -Iseconds)] Pruned ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
fi
