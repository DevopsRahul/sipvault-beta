#!/bin/sh
# Runs every time the web container starts:
#   1. bring the database schema up to date
#   2. start the Next.js server
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  if ls prisma/migrations/*/migration.sql >/dev/null 2>&1; then
    echo "[entrypoint] Applying database migrations..."
    prisma migrate deploy
  else
    # No migration files committed yet -> sync schema directly (OK for beta only).
    echo "[entrypoint] No migrations found - running 'prisma db push' (beta mode)."
    prisma db push --skip-generate
  fi
fi

echo "[entrypoint] Starting SipVault on port ${PORT:-3000}"
exec node server.js
