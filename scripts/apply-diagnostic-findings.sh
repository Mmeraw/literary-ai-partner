#!/usr/bin/env bash
# ============================================================
# apply-diagnostic-findings.sh
#
# One-shot CLI helper to apply the diagnostic_findings layer
# migrations to the linked Supabase remote project.
#
# REQUIRES one of:
#   Option A (supabase CLI):
#     SUPABASE_ACCESS_TOKEN   — Supabase personal access token
#     SUPABASE_PROJECT_REF    — project ref (e.g. xtumxjnzdswuumndcbwc)
#
#   Option B (psql direct):
#     SUPABASE_DB_URL_CI      — full postgres:// connection string
#
# USAGE:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_PROJECT_REF=xtumxjnzdswuumndcbwc \
#     bash scripts/apply-diagnostic-findings.sh
#
#   — or —
#
#   SUPABASE_DB_URL_CI="postgresql://postgres.xtumxjnzdswuumndcbwc:PASSWORD@..." \
#     bash scripts/apply-diagnostic-findings.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

M1="$PROJECT_ROOT/supabase/migrations/20260316020000_add_diagnostic_findings.sql"
M2="$PROJECT_ROOT/supabase/migrations/20260316021000_diagnostic_findings_rls.sql"

echo "==> apply-diagnostic-findings.sh"
echo "    Migration 1: $M1"
echo "    Migration 2: $M2"
echo ""

# Guard: migration files must exist
for f in "$M1" "$M2"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: migration file not found: $f"
    exit 1
  fi
done

# ── Route A: supabase CLI ──────────────────────────────────
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" && -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "Route: supabase CLI (SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF)"
  echo ""

  export SUPABASE_ACCESS_TOKEN

  echo "→ Linking project $SUPABASE_PROJECT_REF ..."
  supabase link --project-ref "$SUPABASE_PROJECT_REF" --yes

  echo "→ Pushing new migrations ..."
  # --include-all ensures migrations not yet tracked in remote history are applied
  (yes || true) | supabase db push --include-all

  echo "→ Reloading PostgREST schema cache ..."
  # Reload via management API (no psql needed)
  curl -sf -X POST \
    "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"query":"SELECT pg_notify('"'"'pgrst'"'"', '"'"'reload schema'"'"');"}' \
    && echo "✅ PostgREST reload sent" \
    || echo "⚠️  PostgREST reload via API failed — run manually: NOTIFY pgrst, 'reload schema';"

# ── Route B: psql direct ──────────────────────────────────
elif [[ -n "${SUPABASE_DB_URL_CI:-}" ]]; then
  echo "Route: psql direct (SUPABASE_DB_URL_CI)"
  echo ""

  if ! command -v psql &>/dev/null; then
    echo "ERROR: psql not found on PATH. Install postgresql-client or use Route A."
    exit 1
  fi

  echo "→ Applying 20260316020000_add_diagnostic_findings.sql ..."
  psql "$SUPABASE_DB_URL_CI" -v ON_ERROR_STOP=1 -f "$M1"

  echo "→ Applying 20260316021000_diagnostic_findings_rls.sql ..."
  psql "$SUPABASE_DB_URL_CI" -v ON_ERROR_STOP=1 -f "$M2"

  echo "→ Reloading PostgREST schema cache ..."
  psql "$SUPABASE_DB_URL_CI" -v ON_ERROR_STOP=1 \
    -c "SELECT pg_notify('pgrst', 'reload schema');" \
    && echo "✅ PostgREST reload sent" \
    || echo "⚠️  PostgREST reload failed"

  echo "→ Verifying diagnostic_findings table ..."
  psql "$SUPABASE_DB_URL_CI" -c \
    "SELECT relname AS table_name, relrowsecurity AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='diagnostic_findings';"

  psql "$SUPABASE_DB_URL_CI" -c \
    "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='diagnostic_findings' ORDER BY indexname;"

# ── Neither credential set ────────────────────────────────
else
  echo "ERROR: No credentials found."
  echo ""
  echo "Set one of:"
  echo "  Option A (supabase CLI):"
  echo "    SUPABASE_ACCESS_TOKEN=sbp_xxx"
  echo "    SUPABASE_PROJECT_REF=xtumxjnzdswuumndcbwc"
  echo ""
  echo "  Option B (psql direct):"
  echo "    SUPABASE_DB_URL_CI=postgresql://postgres.xtumxjnzdswuumndcbwc:PASSWORD@..."
  echo ""
  echo "PRIMARY PATH (no credentials required):"
  echo "  Copy scripts/apply-diagnostic-findings-migrations.sql into:"
  echo "  https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/sql"
  echo "  and click Run."
  exit 1
fi

echo ""
echo "✅ Migrations applied."
echo ""
echo "Next steps:"
echo "  1. Restart your local dev server"
echo "  2. Rerun smoke test:"
echo "       cd $PROJECT_ROOT"
echo "       node scripts/revision-stage2-smoke.mjs"
