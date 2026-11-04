#!/usr/bin/env bash
# Nightly backup of the database + uploaded images.
# Install on the server with:  crontab -e   and add:
#   30 2 * * * /opt/sipvault/deploy/backup.sh >> /opt/sipvault/backups/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

mkdir -p backups
STAMP=$(date +%F_%H%M)

echo "[$(date)] Backing up database..."
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner \
  | gzip > "backups/db_${STAMP}.sql.gz"

echo "[$(date)] Backing up uploads..."
docker run --rm -v sipvault_uploads:/data:ro -v "$PWD/backups":/backup alpine \
  tar czf "/backup/uploads_${STAMP}.tar.gz" -C /data .

# keep 7 days locally
find backups -type f -name "*.gz" -mtime +7 -delete

# copy off the server (a backup on the same disk is not a real backup)
if [ -n "${BACKUP_RSYNC_TARGET:-}" ]; then
  echo "[$(date)] Copying to ${BACKUP_RSYNC_TARGET}"
  rsync -az backups/ "$BACKUP_RSYNC_TARGET"
fi

echo "[$(date)] Done."
