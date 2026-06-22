#!/usr/bin/env bash
# Authority Chain Lint
#
# Flags unauthorized "golden master" / "dream master" / "dream authority" language
# and blocks new files that claim evaluation authority outside the Golden Records.
#
# Per docs/governance/AUTHORITY_CHAIN.md:
#   Level 1 Golden Records are the ONLY source of truth for report structure.
#   No benchmark, dream doc, corpus evaluation, or runtime module may override them.
#
# Usage: bash scripts/authority-chain-lint.sh [--diff-only]
#   --diff-only: only check files changed vs origin/main (for CI on PRs)
#   (default): check all files
#
# Exit 0 = clean, Exit 1 = violations found

set -euo pipefail

DIFF_ONLY=false
if [[ "${1:-}" == "--diff-only" ]]; then
  DIFF_ONLY=true
fi

# ─── Paths exempt from authority language checks ──────────────────────
# Level 1 Golden Records + governance docs that define the chain itself
EXEMPT_PATHS=(
  "docs/templates/evaluation/"
  "docs/governance/AUTHORITY_CHAIN.md"
  "docs/registries/"
  "docs/prs/"
  "lib/storygate/"
)

# ─── Patterns that indicate competing authority claims ────────────────
# These are ALWAYS forbidden outside exempt paths.
# "source of truth" alone is too common (used legitimately for DB columns, etc.)
# so we only flag it in combination with evaluation-authority terms.
HARD_FORBIDDEN=(
  "dream master"
  "golden master"
  "dream authority"
  "dream.*is.*the.*source of truth"
  "benchmark.*is.*the.*source of truth"
  "benchmark.*is.*authoritative.*for.*report"
  "corpus.*is.*the.*source of truth"
  "this.*document.*is.*the.*golden record"
  "this.*is.*the.*definitive.*template"
)

# ─── Collect files to scan ────────────────────────────────────────────
if [[ "$DIFF_ONLY" == "true" ]]; then
  # Only files changed in this branch vs main
  mapfile -t FILES < <(git diff --name-only origin/main...HEAD -- 'docs/' 'lib/' 2>/dev/null || true)
else
  mapfile -t FILES < <(find docs/ lib/ -type f \( -name "*.md" -o -name "*.ts" -o -name "*.tsx" -o -name "*.csv" \) 2>/dev/null)
fi

is_exempt() {
  local file="$1"
  for exempt in "${EXEMPT_PATHS[@]}"; do
    if [[ "$file" == "$exempt"* ]]; then
      return 0
    fi
  done
  return 1
}

violations=0
violation_details=""

for pattern in "${HARD_FORBIDDEN[@]}"; do
  for file in "${FILES[@]}"; do
    # Skip exempt paths
    if is_exempt "$file"; then
      continue
    fi
    # Skip if file doesn't exist (deleted in diff)
    [[ -f "$file" ]] || continue

    while IFS= read -r match; do
      violations=$((violations + 1))
      violation_details="${violation_details}\n  ${match}"
    done < <(grep -Hni "$pattern" "$file" 2>/dev/null || true)
  done
done

if [[ $violations -gt 0 ]]; then
  echo "AUTHORITY CHAIN LINT FAILED: $violations violation(s) found"
  echo ""
  echo "The following files claim authority reserved for Level 1 Golden Records:"
  echo -e "$violation_details"
  echo ""
  echo "Per docs/governance/AUTHORITY_CHAIN.md:"
  echo "  - Only evaluation templates may be called 'Golden Record' or 'source of truth'"
  echo "  - Use 'reference benchmark', 'validation asset', or 'calibration source' instead"
  echo "  - If a requirement is missing, add it to a Golden Record — do not promote lower-level docs"
  exit 1
fi

echo "AUTHORITY CHAIN LINT PASSED: no competing authority claims detected"
exit 0
