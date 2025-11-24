#!/bin/bash
set -e

echo "⏳ Waiting for PostgreSQL to become ready..."
until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h localhost; do
  sleep 1
done

echo "🚀 PostgreSQL is ready. Restoring cras.sql..."

psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-wait/cras.sql

echo "🎉 Restore complete."
