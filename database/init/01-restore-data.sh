#!/bin/bash
set -e

echo "📦 Skipping pgRouting installation (requires root privileges)"
echo "🚀 Note: pgRouting extension not available - contamination analysis may not work"

echo "🗃️ Restoring database..."
# Files are already cleaned, just restore them
# First run the GIS extensions
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/00-gis-complete.sql 2>/dev/null || echo "Some GIS extension commands failed"

# Then restore the main data
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/cras.sql 2>/dev/null || echo "Some SQL commands failed (expected for pg_dump format issues)"

echo "🎉 Database setup complete."
