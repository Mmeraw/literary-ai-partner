#!/usr/bin/env bash
# PR-0 containment guard. Read-only. Never modifies repo state.
# PR-0 = WARN-heavy scaffold. Later PRs convert selected warnings to hard-fail.
# Escalation path:
# - PR-0 = warnings/reporting only for legacy debt
# - PR-1 = inventory/classification baseline
# - PR-2 = frontmatter normalization
# - PR-3 = hard-fail enforcement once remediation baseline exists

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

PRUNE_ARGS=(
  -path ./node_modules -prune -o
  -path ./.next -prune -o
  -path ./.git -prune -o
  -path ./dist -prune -o
  -path ./build -prune -o
  -path ./coverage -prune -o
  -path ./worktrees -prune -o
  -path ./.worktrees -prune -o
)

CANON_ROOT="docs/canon"
CONTROL="$CANON_ROOT/registered/control"
VOLUMES="$CANON_ROOT/registered/volumes"
AUTHORITY="$CANON_ROOT/AUTHORITY.md"

fail=0
warn_typos_count=0
warn_dupe_count=0
warn_out_of_zone_count=0
warn_missing_frontmatter_count=0
warn_claims_count=0

section() { printf "\n=== %s ===\n" "$1"; }

section "1. .md.md typo files"
typos=$(find . "${PRUNE_ARGS[@]}" -type f -name '*.md.md' -print 2>/dev/null || true)
if [ -n "$typos" ]; then
  echo "$typos"
  warn_typos_count=$(printf "%s\n" "$typos" | sed '/^$/d' | wc -l | tr -d ' ')
  # TODO(PR-2): convert to fail=1 after classification baseline lands
  echo "WARN: .md.md double-extension files exist."
else
  echo "ok"
fi

section "2. Duplicate basenames inside canon"
dupes=$(find "$CANON_ROOT" -type f -name '*.md' -printf '%f\n' 2>/dev/null | sort | uniq -d | grep -v '^AUTHORITY.md$' || true)
if [ -n "$dupes" ]; then
  echo "$dupes"
  warn_dupe_count=$(printf "%s\n" "$dupes" | sed '/^$/d' | wc -l | tr -d ' ')
  # TODO(PR-2): convert to fail=1 after classification baseline lands
  echo "WARN: duplicate basenames inside canon."
else
  echo "ok"
fi

section "3. Authoritative files only inside allowlisted authority paths"
while IFS= read -r f; do
  if head -20 "$f" 2>/dev/null | grep -qE '^canon_status:\s*authoritative'; then
    case "$f" in
      "$CONTROL"/*|"$VOLUMES"/*|"$AUTHORITY") : ;;
      *)
        echo "OUT OF ZONE: $f"
        warn_out_of_zone_count=$((warn_out_of_zone_count + 1))
        # TODO(PR-2): convert to fail=1 after classification baseline lands
        echo "WARN: authoritative file outside allowlisted zone."
        ;;
    esac
  fi
done < <(find . "${PRUNE_ARGS[@]}" -type f -name '*.md' -print 2>/dev/null)

section "4. Registered canon files missing frontmatter"
while IFS= read -r f; do
  if ! head -20 "$f" 2>/dev/null | grep -qE '^canon_status:\s*(authoritative|secondary|deprecated|draft|meta)'; then
    echo "MISSING canon_status: $f"
    warn_missing_frontmatter_count=$((warn_missing_frontmatter_count + 1))
  fi
done < <(find "$CONTROL" "$VOLUMES" -type f -name '*.md' 2>/dev/null || true)

# TODO(PR-2): convert to fail=1 after classification baseline lands
echo "WARN ONLY in PR-0. Hard enforcement deferred to PR-1."

section "5. Non-authoritative zones claiming authority"
forbidden='source of truth|canonical authority|binding canon|runtime ownership|authoritative canon'

while IFS= read -r f; do
  case "$f" in
    "$CONTROL"/*|"$VOLUMES"/*|"$AUTHORITY"|"$CANON_ROOT/README.md"|"./scripts/verify-canon-authority.sh") continue ;;
  esac

  if grep -liE "$forbidden" "$f" >/dev/null 2>&1; then
    echo "CLAIMS-AUTHORITY: $f"
    warn_claims_count=$((warn_claims_count + 1))
  fi
done < <(find "$CANON_ROOT" "${PRUNE_ARGS[@]}" -type f -name '*.md' -print 2>/dev/null)

# TODO(PR-2): convert to fail=1 after classification baseline lands
# TODO(PR-5): re-expand Section 5 scan scope from docs/canon/** to repo-wide canon-like surfaces
echo "WARN ONLY in PR-0. Hard enforcement deferred to PR-2."

section "6. AUTHORITY.md existence"
if [ ! -f "$AUTHORITY" ]; then
  echo "FAIL: $AUTHORITY missing."
  fail=1
else
  echo "ok"
fi

section "RESULT"
echo "warning_count.md_md_typos=$warn_typos_count"
echo "warning_count.duplicate_basenames_inside_canon=$warn_dupe_count"
echo "warning_count.authoritative_out_of_zone=$warn_out_of_zone_count"
echo "warning_count.missing_canon_status_registered=$warn_missing_frontmatter_count"
echo "warning_count.non_authoritative_claims=$warn_claims_count"

if [ "$fail" -ne 0 ]; then
  echo "canon-authority guard: FAIL"
  exit 1
fi

echo "canon-authority guard: PASS (with warnings allowed in PR-0)"
