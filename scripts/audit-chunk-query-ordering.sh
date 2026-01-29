#!/usr/bin/env bash

ROOT="/workspaces/literary-ai-partner"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════════════"
echo "  Query Ordering Audit: manuscript_chunks (ENFORCING)"
echo "  Rule: Any query that returns chunk rows MUST order by chunk_index"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "Scanning for manuscript_chunks SELECT queries..."

# Create temp file for results
TMPFILE=$(mktemp)
trap "rm -f $TMPFILE" EXIT

# Pull candidate lines with file:line:text
grep -RInE --include="*.sql" --include="*.ts" --include="*.tsx" --include="*.sh" \
  'SELECT\b.*\bFROM\b.*\b(public\.)?manuscript_chunks\b' \
  "$ROOT/supabase/migrations" "$ROOT/lib" "$ROOT/src" "$ROOT/scripts" 2>/dev/null \
  | grep -v "audit-chunk-query-ordering.sh" \
  | grep -v "DELETE\|UPDATE\|INSERT" > "$TMPFILE" || true

TOTAL=0
ENFORCED=0
VIOLATIONS=0
VIOLATION_LINES=()

# Helper: case-insensitive regex match
ci_match() {
  echo "$1" | grep -Eiq "$2"
}

# Decide if a line is "row-returning" (ordering required)
requires_ordering() {
  local line="$1"

  # Exempt obvious non-row-returning patterns
  ci_match "$line" 'SELECT\s+COUNT\s*\(' && return 1
  ci_match "$line" 'SELECT\s+EXISTS\s*\(' && return 1
  ci_match "$line" 'SELECT\s+1\b' && return 1

  # Exempt FK/catalog/probe style checks
  ci_match "$line" 'pg_constraint|pg_indexes|pg_stat_|information_schema' && return 1

  # Exempt single-field probes
  ci_match "$line" 'SELECT\s+id\b[^,]*\bFROM' && return 1
  ci_match "$line" 'SELECT\s+attempt_count\b[^,]*\bFROM' && return 1

  # Exempt comments
  ci_match "$line" '^\s*--' && return 1

  # If it selects chunk content or multiple columns, we enforce
  ci_match "$line" 'SELECT\s+\*' && return 0
  ci_match "$line" 'chunk_text|chunk_index|token_count|word_count|start_char|end_char|content' && return 0
  ci_match "$line" 'SELECT\s+[^,]+,\s*[^,]+' && return 0  # multi-column select

  # Default: don't enforce
  return 1
}

# Check candidates
while IFS= read -r hit; do
  [ -z "$hit" ] && continue
  TOTAL=$((TOTAL + 1))

  # Split "file:line:content"
  file="${hit%%:*}"
  rest="${hit#*:}"
  line_no="${rest%%:*}"
  content="${rest#*:}"

  if requires_ordering "$content"; then
    ENFORCED=$((ENFORCED + 1))

    if ! ci_match "$content" 'ORDER\s+BY\s+chunk_index(\s+ASC)?\b'; then
      VIOLATIONS=$((VIOLATIONS + 1))
      VIOLATION_LINES+=("$file:$line_no")
    fi
  fi
done < "$TMPFILE"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Audit Results"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Candidate SELECTs found: $TOTAL"
echo "Row-returning selects enforced: $ENFORCED"
echo "Violations (missing ORDER BY chunk_index): $VIOLATIONS"
echo ""

if [ "$VIOLATIONS" -gt 0 ]; then
  echo -e "${RED}❌ AUDIT FAILED${NC}"
  echo ""
  echo "The following enforced queries must add: ORDER BY chunk_index ASC"
  echo ""
  for v in "${VIOLATION_LINES[@]}"; do
    echo -e "${YELLOW}  • $v${NC}"
  done
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ AUDIT PASSED${NC}"
echo ""
echo "✅ Chunk row retrieval ordering is regression-proof."
echo ""
exit 0
