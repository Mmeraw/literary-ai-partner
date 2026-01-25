#!/bin/bash
# Smoke test: End-to-end vertical slice with UUID migration verification (hardened)
# Purpose: Verify evaluation_jobs.id is UUID, FKs work, Phase 1→2→artifact succeeds

set -euo pipefail

cd /workspaces/literary-ai-partner

echo "=================================================="
echo "UUID MIGRATION SMOKE TEST"
echo "=================================================="
echo ""

# Verify DB container is running
DB_CONTAINER="supabase_db_literary-ai-partner"
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "❌ FAIL: Database container '${DB_CONTAINER}' is not running"
  echo "   Run: npx supabase start"
  exit 1
fi
echo "✓ Database container running"

# Start dev server in background with cleanup trap
echo "Starting dev server..."
npm run dev > /tmp/dev-server.log 2>&1 &
DEV_PID=$!
trap 'kill "$DEV_PID" 2>/dev/null || true' EXIT

sleep 8

# Run vertical slice test (must exit non-zero on failure)
echo ""
echo "Running Phase 2 vertical slice test..."
./scripts/test-phase2-vertical-slice.sh || {
  echo "❌ FAIL: Vertical slice test failed (see output above)"
  exit 1
}

# Locate the most recent phase2 test log
LOG_FILE="$(ls -1t /tmp/phase2-test-*.log 2>/dev/null | head -n 1 || true)"
if [[ -z "${LOG_FILE}" ]]; then
  echo "❌ FAIL: No /tmp/phase2-test-*.log file found"
  exit 1
fi

# Extract most recent UUID after "Job created:" (case-insensitive A-F)
JOB_ID="$(
  grep -oE 'Job created: [0-9A-Fa-f-]{36}' "$LOG_FILE" \
    | tail -n 1 \
    | sed 's/^Job created: //'
)"

if [[ -z "${JOB_ID}" ]]; then
  echo "❌ FAIL: No job ID found in ${LOG_FILE}"
  echo "   Hint: Expected a line like: Job created: <uuid>"
  exit 1
fi

echo ""
echo "✓ Job created with UUID: ${JOB_ID}"

# Helper: run SQL and return a single scalar value (no headers/formatting)
psql_scalar () {
  local sql="$1"
  docker exec -i "${DB_CONTAINER}" psql -U postgres -d postgres -t -A -c "${sql}" | tr -d '[:space:]'
}

# Verify job.id is actually UUID type
echo ""
echo "Verifying schema..."
id_type="$(psql_scalar "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='evaluation_jobs' AND column_name='id';")"
if [[ "${id_type}" != "uuid" ]]; then
  echo "❌ FAIL: evaluation_jobs.id is type '${id_type}', expected 'uuid'"
  exit 1
fi
echo "✓ evaluation_jobs.id is UUID type"

# Verify chunks were written with job_id FK (count must be > 0)
chunk_count="$(psql_scalar "SELECT COUNT(*) FROM public.manuscript_chunks WHERE job_id = '${JOB_ID}'::uuid;")"
if [[ "${chunk_count}" =~ ^[0-9]+$ ]] && (( chunk_count > 0 )); then
  echo "✓ Chunks persisted with job_id FK (count=${chunk_count})"
else
  echo "❌ FAIL: No chunks persisted for job_id=${JOB_ID} (count=${chunk_count})"
  exit 1
fi

# Verify artifact was created with job_id FK (count must be > 0)
artifact_count="$(psql_scalar "SELECT COUNT(*) FROM public.evaluation_artifacts WHERE job_id = '${JOB_ID}'::uuid;")"
if [[ "${artifact_count}" =~ ^[0-9]+$ ]] && (( artifact_count > 0 )); then
  echo "✓ Artifact persisted with job_id FK (count=${artifact_count})"
else
  echo "❌ FAIL: No artifacts persisted for job_id=${JOB_ID} (count=${artifact_count})"
  exit 1
fi

# Verify FK constraints exist (exactly one FK, no duplicates)
echo ""
echo "Verifying foreign key constraints..."
fk_artifacts="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.evaluation_artifacts'::regclass AND conname='fk_evaluation_artifacts_job_id' AND contype='f';")"
if [[ "${fk_artifacts}" != "1" ]]; then
  echo "❌ FAIL: FK constraint fk_evaluation_artifacts_job_id not found or duplicated (count=${fk_artifacts})"
  exit 1
fi
echo "✓ FK: evaluation_artifacts.job_id → evaluation_jobs.id"

fk_chunks="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.manuscript_chunks'::regclass AND conname='fk_manuscript_chunks_job_id' AND contype='f';")"
if [[ "${fk_chunks}" != "1" ]]; then
  echo "❌ FAIL: FK constraint fk_manuscript_chunks_job_id not found or duplicated (count=${fk_chunks})"
  exit 1
fi
echo "✓ FK: manuscript_chunks.job_id → evaluation_jobs.id"

# Verify no orphans (FK should prevent this, but sanity check)
orphan_artifacts="$(psql_scalar "SELECT COUNT(*) FROM public.evaluation_artifacts a LEFT JOIN public.evaluation_jobs j ON j.id = a.job_id WHERE j.id IS NULL;")"
orphan_chunks="$(psql_scalar "SELECT COUNT(*) FROM public.manuscript_chunks c LEFT JOIN public.evaluation_jobs j ON j.id = c.job_id WHERE c.job_id IS NOT NULL AND j.id IS NULL;")"

if [[ "${orphan_artifacts}" != "0" ]]; then
  echo "❌ FAIL: Found ${orphan_artifacts} orphan artifacts (FK violation)"
  exit 1
fi

if [[ "${orphan_chunks}" != "0" ]]; then
  echo "❌ FAIL: Found ${orphan_chunks} orphan chunks (FK violation)"
  exit 1
fi

echo "✓ No orphan records (FK integrity verified)"

echo ""
echo "=================================================="
echo "✅ ALL SMOKE TESTS PASSED"
echo "=================================================="
echo ""
echo "Summary:"
echo "  • Job created with UUID: ${JOB_ID}"
echo "  • Phase 1 wrote ${chunk_count} chunks"
echo "  • Phase 2 created ${artifact_count} artifact(s)"
echo "  • All FK constraints in place"
echo "  • No orphan records"
echo ""
