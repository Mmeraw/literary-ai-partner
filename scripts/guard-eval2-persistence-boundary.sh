#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )/.." && pwd)"
cd "$ROOT_DIR"

BOUNDARY_FILE="lib/evaluation/persistEvaluationResultV2.ts"
HELPER_FILE="lib/evaluation/artifactPersistence.ts"
# Descriptor registry only: declares canonical artifact names/metadata and performs no persistence writes.
REGISTRY_FILE="lib/evaluation/artifacts/artifactRegistry.ts"

declare -a SOURCE_FILES=()

collect_source_files() {
  while IFS= read -r path; do
    SOURCE_FILES+=("$path")
  done < <(find lib workers -type f \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \) \
    ! -name "*.test.ts" \
    ! -name "*.spec.ts" \
    ! -path "*/__tests__/*" | sort)
}

fail() {
  echo "Eval2 persistence boundary guard failed: $1" >&2
  echo "RESULT: FAIL"
  exit 1
}

if [[ ! -f "$BOUNDARY_FILE" ]]; then
  fail "Missing boundary file: $BOUNDARY_FILE"
fi

if ! command -v grep >/dev/null 2>&1; then
  fail "grep is required but not available on PATH"
fi

collect_source_files

if [[ "${#SOURCE_FILES[@]}" -eq 0 ]]; then
  fail "No source files found in guard scope"
fi

echo "GUARD: eval2-persistence-boundary"
echo "SCANNED: ${#SOURCE_FILES[@]} files"

violations=""

record_violation() {
  local message="$1"
  violations+="$message"$'\n'
}

for file in "${SOURCE_FILES[@]}"; do
  if grep -nE "artifactType:[[:space:]]*['\"]evaluation_result_v2['\"]" "$file" >/dev/null 2>&1; then
    if [[ "$file" != "$BOUNDARY_FILE" && "$file" != "$REGISTRY_FILE" ]]; then
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        record_violation "$file:$line"
      done < <(grep -nE "artifactType:[[:space:]]*['\"]evaluation_result_v2['\"]" "$file")
    fi
  fi

  if grep -nE "evaluation_result_version:[[:space:]]*['\"]evaluation_result_v2['\"]" "$file" >/dev/null 2>&1; then
    if [[ "$file" != "$BOUNDARY_FILE" && "$file" != "$REGISTRY_FILE" ]]; then
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        record_violation "$file:$line"
      done < <(grep -nE "evaluation_result_version:[[:space:]]*['\"]evaluation_result_v2['\"]" "$file")
    fi
  fi

done

if [[ -n "$violations" ]]; then
  echo "VIOLATIONS:"
  printf "%s" "$violations"
  fail "Found non-boundary V2 persistence/completion path(s)."
fi

echo "VIOLATIONS: 0"
echo "RESULT: PASS"
echo "Eval2 persistence boundary guard passed"
