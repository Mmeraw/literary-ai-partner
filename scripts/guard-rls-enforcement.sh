#!/usr/bin/env bash
set -euo pipefail

echo "[guard-rls-enforcement] scanning migrations for CREATE TABLE without RLS"

MIGRATIONS_DIR="supabase/migrations"
EXIT_CODE=0

# Collect all tables that have RLS enabled somewhere in the migration chain.
# Handles: ALTER TABLE public.foo ENABLE ROW LEVEL SECURITY
#          ALTER TABLE "public"."foo" ENABLE ROW LEVEL SECURITY
#          execute 'alter table public.foo enable row level security'
RLS_ENABLED_TABLES=$(
  grep -rihP '(?:alter\s+table|alter table)\s+(?:"?public"?\.)?"?(\w+)"?\s+enable\s+row\s+level\s+security' "$MIGRATIONS_DIR" \
    | grep -oiP '(?:alter\s+table)\s+(?:"?public"?\.)?"?\K\w+' \
    | sort -u
)

# Collect all tables created in migrations.
# Handles: CREATE TABLE public.foo (
#          CREATE TABLE IF NOT EXISTS public.foo (
#          CREATE TABLE IF NOT EXISTS "public"."foo" (
#          create table if not exists public.foo (
CREATED_TABLES=$(
  grep -rihP 'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?(\w+)"?\s*\(' "$MIGRATIONS_DIR" \
    | grep -oiP 'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?\K\w+' \
    | sort -u
)

echo "  Found $(echo "$CREATED_TABLES" | wc -w) created tables"
echo "  Found $(echo "$RLS_ENABLED_TABLES" | wc -w) tables with RLS enabled"

for TABLE in $CREATED_TABLES; do
  if ! echo "$RLS_ENABLED_TABLES" | grep -qw "$TABLE"; then
    echo ""
    echo "❌ Table '$TABLE' is created without ENABLE ROW LEVEL SECURITY."
    echo "   Every public table MUST have RLS enabled with an appropriate policy."
    echo "   Add: ALTER TABLE public.$TABLE ENABLE ROW LEVEL SECURITY;"
    echo "   Plus a service_role policy (or user-scoped policy as appropriate)."
    EXIT_CODE=1
  fi
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✅ RLS enforcement OK — all tables have RLS enabled"
else
  echo ""
  echo "💡 Fix: add ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY in the"
  echo "   same migration that creates the table, or in a separate RLS migration."
fi

exit $EXIT_CODE
