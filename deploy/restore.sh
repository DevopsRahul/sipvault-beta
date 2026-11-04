#!/usr/bin/env bash
# Restore the database from a backup file.
#   ./deploy/restore.sh backups/db_2026-11-04_0230.sql.gz
# WARNING: this replaces the current database contents.
set -euo pipefail

FILE="${1:?usage: restore.sh backups/db_XXXX.sql.gz}"
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

read -r -p "This will OVERWRITE database '$POSTGRES_DB'. Type YES to continue: " ok
[ "$ok" = "YES" ] || { echo "Aborted."; exit 1; }

docker compose stop web
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" -c "CREATE DATABASE \"$POSTGRES_DB\";"
gunzip -c "$FILE" | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose start web
echo "Restored from $FILE"
