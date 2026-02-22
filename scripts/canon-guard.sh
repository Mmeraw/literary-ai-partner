#!/usr/bin/env bash
set -euo pipefail

# CANON GUARD — blocks commits that violate JOB_CONTRACT_v1
# Cheap + deadly: string + pattern guards that prevent drift.

ROOT="$(git rev-parse --show-toplevel)"

fail() {
  echo "❌ CANON GUARD FAILED: $1" >&2
  exit 1
}

echo "🔒 Canon Guard: JOB_CONTRACT_v1 checks..."

# 1) Block banned aliases (example: 'completed' must never exist as a status string; canonical is 'complete')
# Exclude: completed_units (valid CANON field), COMPLETED (const key), documentation examples
if git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' >/dev/null 2>&1; then
  # Only check actual code files, not markdown documentation
  if git diff --cached -- '*.ts' '*.tsx' '*.js' '*.jsx' | grep -E '(status|phase_status)[[:space:]]*[:=][[:space:]]*["\x27]completed["\x27]' >/dev/null 2>&1; then
    fail "Found banned status alias \"completed\" assigned to status field. Use \"complete\" only."
  fi
fi

# 2) Enforce canonical JobStatus union EXACTLY (best-effort grep guard)
# Update this path list to match your repo structure.
STATUS_TYPE_FILES=(
  "src/lib/jobs/types.ts"
  "lib/jobs/types.ts"
  "app/api/jobs/types.ts"
)

FOUND_STATUS_DEF="false"
for f in "${STATUS_TYPE_FILES[@]}"; do
  if [[ -f "$ROOT/$f" ]]; then
    FOUND_STATUS_DEF="true"
    # Must contain all four statuses
    grep -q '"queued"'   "$ROOT/$f" || fail "Missing \"queued\" in JobStatus (file: $f)"
    grep -q '"running"'  "$ROOT/$f" || fail "Missing \"running\" in JobStatus (file: $f)"
    grep -q '"complete"' "$ROOT/$f" || fail "Missing \"complete\" in JobStatus (file: $f)"
    grep -q '"failed"'   "$ROOT/$f" || fail "Missing \"failed\" in JobStatus (file: $f)"

    # Must NOT contain extra known-bad statuses
    if grep -nE '"done"|"success"|"succeeded"|"finished"|"completed"' "$ROOT/$f" >/dev/null 2>&1; then
      fail "JobStatus contains forbidden aliases in $f (use only queued/running/complete/failed)."
    fi
  fi
done

if [[ "$FOUND_STATUS_DEF" == "false" ]]; then
  echo "⚠️  Canon Guard: Could not find a JobStatus type file in expected locations."
  echo "    Add your actual types file path to STATUS_TYPE_FILES in scripts/canon-guard.sh"
fi

# 3) Ensure contract doc exists (binding truth source)
[[ -f "$ROOT/docs/JOB_CONTRACT_v1.md" ]] || fail "Missing docs/JOB_CONTRACT_v1.md (required CANON contract)."

# 4) Enforce canonical artifact identity in runtime code paths.
# Hard gate: legacy one_page_summary must not appear in active app/lib runtime tree.
# Historical references in docs/tests/migrations are handled outside this scope.
if rg -n --hidden --glob '!**/*.test.*' --glob '!**/__tests__/**' "one_page_summary" "$ROOT/app" "$ROOT/lib" >/dev/null 2>&1; then
  echo "Detected forbidden runtime artifact type references:" >&2
  rg -n --hidden --glob '!**/*.test.*' --glob '!**/__tests__/**' "one_page_summary" "$ROOT/app" "$ROOT/lib" >&2 || true
  fail "Runtime canonical drift: found one_page_summary in app/lib. Use evaluation_result_v1 only."
fi

echo "✅ Canon Guard passed."
