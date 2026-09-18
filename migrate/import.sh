#!/usr/bin/env bash
# StatBridge: load the exported database into a new Supabase project.
#
#   export TARGET_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
#   bash migrate/import.sh
#
# Use the *session* (port 5432) connection string, not the transaction pooler.
set -euo pipefail

: "${TARGET_DB_URL:?Set TARGET_DB_URL to the new Supabase database connection string}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> extensions"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/00_extensions.sql"

echo "==> tables, functions, row-level security policies and grants"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/01_schema.sql"

echo "==> allow deferred foreign key checks"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/02a_defer_constraints.sql"

echo "==> data"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -c "SET CONSTRAINTS ALL DEFERRED;" -f "$DIR/02_data.sql"

echo "==> private file stores and their access rules"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/04_storage.sql"

echo "==> done. Next: create the staff sign-in account, then run 03_relink_admin.sql"
