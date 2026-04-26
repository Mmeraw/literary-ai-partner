#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BOUNDARY_FILE="lib/evaluation/persistEvaluationResultV2.ts"
SEARCH_SCOPE=(lib workers)
EXCLUDES=(
  "--glob" "!**/*.test.ts"
  "--glob" "!**/__tests__/**"
  "--glob" "!**/*.spec.ts"
)

fail() {
  echo "❌ Eval2 persistence boundary guard failed: $1" >&2
  exit 1
}

if [[ ! -f "$BOUNDARY_FILE" ]]; then
  fail "Missing boundary file: $BOUNDARY_FILE"
fi

collect_non_boundary_hits() {
  local pattern="$1"
  local hits
  hits=$(rg -n "$pattern" "${SEARCH_SCOPE[@]}" "${EXCLUDES[@]}" || true)

  if [[ -z "$hits" ]]; then
    echo ""
    return
  fi

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local file
    file="${line%%:*}"
    if [[ "$file" != "$BOUNDARY_FILE" ]]; then
      echo "$line"
    fi
  done <<< "$hits"
}

# V2 artifact write call sites (upsert path)
NON_BOUNDARY_V2_ARTIFACT_WRITES=$(collect_non_boundary_hits "artifactType:\\s*['\"]evaluation_result_v2['\"]")
if [[ -n "$NON_BOUNDARY_V2_ARTIFACT_WRITES" ]]; then
  echo "$NON_BOUNDARY_V2_ARTIFACT_WRITES"
  fail "Found non-boundary evaluation_result_v2 artifact write call site(s)."
fi

# V2 completion payload write call sites (status complete payload path)
NON_BOUNDARY_V2_COMPLETION_WRITES=$(collect_non_boundary_hits "evaluation_result_version:\\s*['\"]evaluation_result_v2['\"]")
if [[ -n "$NON_BOUNDARY_V2_COMPLETION_WRITES" ]]; then
  echo "$NON_BOUNDARY_V2_COMPLETION_WRITES"
  fail "Found non-boundary evaluation_result_v2 completion write call site(s)."
fi

# Guard against accidental re-introduction of inline processor completion update
if rg -n "\\.from\\('evaluation_jobs'\\)" lib/evaluation/processor.ts >/dev/null 2>&1; then
  if rg -n "evaluation_result_version:\\s*['\"]evaluation_result_v2['\"]" lib/evaluation/processor.ts >/dev/null 2>&1; then
    fail "processor.ts contains inline evaluation_result_v2 completion write."
  fi
fi

echo "✅ Eval2 persistence boundary guard passed"
