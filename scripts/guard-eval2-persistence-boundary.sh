#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BOUNDARY_FILE="lib/evaluation/persistEvaluationResultV2.ts"
HELPER_FILE="lib/evaluation/artifactPersistence.ts"

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
  echo "❌ Eval2 persistence boundary guard failed: $1" >&2
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
  # 1) V2 artifact type call sites must exist only in boundary.
  if grep -nE "artifactType:[[:space:]]*['\"]evaluation_result_v2['\"]" "$file" >/dev/null 2>&1; then
    if [[ "$file" != "$BOUNDARY_FILE" ]]; then
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        record_violation "$file:$line"
      done < <(grep -nE "artifactType:[[:space:]]*['\"]evaluation_result_v2['\"]" "$file")
    fi
  fi

  # 2) V2 completion payload writes must exist only in boundary.
  if grep -nE "evaluation_result_version:[[:space:]]*['\"]evaluation_result_v2['\"]" "$file" >/dev/null 2>&1; then
    if [[ "$file" != "$BOUNDARY_FILE" ]]; then
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        record_violation "$file:$line"
      done < <(grep -nE "evaluation_result_version:[[:space:]]*['\"]evaluation_result_v2['\"]" "$file")
    fi
  fi

  # 3) Stronger check: direct evaluation_artifacts write chains carrying V2 markers
  #    are forbidden outside boundary/helper path.
  if [[ "$file" != "$BOUNDARY_FILE" && "$file" != "$HELPER_FILE" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      record_violation "$line"
    done < <(awk -v file="$file" '
      {
        lines[NR] = $0
      }
      END {
        for (i = 1; i <= NR; i++) {
          if (lines[i] ~ /evaluation_artifacts/) {
            start = i
            end = i + 30
            if (end > NR) end = NR
            hasWrite = 0
            hasV2 = 0
            for (j = start; j <= end; j++) {
              if (lines[j] ~ /(insert|upsert|update)\(/) hasWrite = 1
              if (lines[j] ~ /evaluation_result_v2/) hasV2 = 1
            }
            if (hasWrite && hasV2) {
              print file ":" start ": direct evaluation_artifacts write chain references evaluation_result_v2 outside boundary/helper"
            }
          }
        }
      }
    ' "$file")
  fi
done

if [[ -n "$violations" ]]; then
  echo "VIOLATIONS:"
  printf "%s" "$violations"
  fail "Found non-boundary V2 persistence/completion path(s)."
fi

echo "VIOLATIONS: 0"
echo "RESULT: PASS"
echo "✅ Eval2 persistence boundary guard passed"
