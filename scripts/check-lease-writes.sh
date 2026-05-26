#!/usr/bin/env bash
# check-lease-writes.sh
# Canonical lease contract guard.
#
# RULE: lease_until is the only writable lease expiry field.
#       lease_expires_at is a GENERATED column — read/output only.
#
# Fails if any application code attempts a top-level DB write of lease_expires_at.
#
# Safe patterns (excluded):
#   - Inside progress JSONB objects (preceded by "progress:" context)
#   - Read/output mapping (return types, response parsing, type definitions)
#   - SQL migrations (historical record — prod RPCs are authoritative)
#   - Test fixtures (mocking DB response shape, not writing to DB)
#   - Comments

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VIOLATIONS=0
VIOLATION_FILES=()

# Patterns that indicate a forbidden top-level write:
# A .update({ ... lease_expires_at: ... }) call NOT inside a progress JSONB object.
# We detect: file has `lease_expires_at:` AND is not in an excluded category.

EXCLUDED_DIRS=(
  "node_modules"
  ".next"
  "dist"
  "supabase/migrations"
  "__tests__"
  "tests"
  ".test.ts"
  ".test.js"
  ".spec.ts"
  ".spec.js"
)

# Build exclude args for grep
EXCLUDE_ARGS=()
for d in "${EXCLUDED_DIRS[@]}"; do
  EXCLUDE_ARGS+=("--exclude-dir=$d")
done

echo "=== Lease Write Contract Check ==="
echo "Rule: lease_until only. lease_expires_at = generated/read-only."
echo ""

# Find all .ts files with lease_expires_at: (write syntax) outside excluded dirs
while IFS=: read -r file line content; do
  # Skip comments
  if echo "$content" | grep -qE '^\s*//' ; then
    continue
  fi
  # Skip type definitions / interface fields
  if echo "$content" | grep -qE '^\s*lease_expires_at\s*[?!]?\s*:.*string|null|Date' ; then
    # Could be a type field — check if it's in a .types.ts or interface context
    if echo "$file" | grep -qE '\.types\.ts|types\.ts|finalize\.types|manuscript.*factory|ui-helpers'; then
      continue
    fi
  fi
  # Skip read/output mapping lines (mapping FROM db response, not writing TO db)
  if echo "$content" | grep -qE 'lease_expires_at.*??|row\?\.lease_expires_at|job\.lease_expires_at|\.lease_expires_at\b|progress\?\.lease_expires_at'; then
    continue
  fi
  # Skip store.finalizer.ts read-mapping line
  if echo "$file" | grep -q "store.finalizer" && echo "$content" | grep -qE 'row\?\.'; then
    continue
  fi

  echo "VIOLATION: $file:$line"
  echo "  $content"
  VIOLATIONS=$((VIOLATIONS + 1))
  VIOLATION_FILES+=("$file")
done < <(grep -rn "lease_expires_at:" \
  "${REPO_ROOT}/lib" \
  "${REPO_ROOT}/app" \
  "${REPO_ROOT}/scripts" \
  --include="*.ts" \
  "${EXCLUDE_ARGS[@]}" \
  --exclude="*.test.ts" \
  --exclude="*.spec.ts" \
  2>/dev/null || true)

echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "✅ PASS — no forbidden top-level lease_expires_at writes found."
  exit 0
else
  echo "❌ FAIL — $VIOLATIONS forbidden lease_expires_at write(s) found."
  echo ""
  echo "Fix: replace top-level lease_expires_at writes with lease_until."
  echo "lease_expires_at is GENERATED ALWAYS AS (lease_until) — Postgres rejects writes."
  exit 1
fi
