#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════
# Query Ordering Audit for manuscript_chunks
# ════════════════════════════════════════════════════════════════
# Purpose: Ensure all queries include ORDER BY chunk_index ASC
# Why: Postgres doesn't guarantee order without explicit ORDER BY
# Risk: "Works locally, flakes in prod" classic trap
# ════════════════════════════════════════════════════════════════

ROOT="/workspaces/literary-ai-partner"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════════════"
echo "  Query Ordering Audit: manuscript_chunks"
echo "  Validates: All SELECT queries include ORDER BY chunk_index"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Files to audit
AUDIT_PATHS=(
  "supabase/migrations/*.sql"
  "src/**/*.ts"
  "src/**/*.tsx"
  "scripts/*.sh"
)

VIOLATIONS=()
TOTAL_QUERIES=0
SAFE_QUERIES=0

echo "Searching for manuscript_chunks queries..."
echo ""

# Function to check a file
check_file() {
  local file="$1"
  local line_num=0
  local in_query=false
  local query_start=0
  local query_buffer=""
  
  while IFS= read -r line; do
    ((line_num++))
    
    # Check if line contains manuscript_chunks
    if echo "$line" | grep -qi "FROM.*manuscript_chunks\|manuscript_chunks.*WHERE"; then
      in_query=true
      query_start=$line_num
      query_buffer="$line"
    elif [ "$in_query" = true ]; then
      query_buffer="$query_buffer $line"
      
      # Check if query ends (semicolon or EOF)
      if echo "$line" | grep -q ";"; then
        ((TOTAL_QUERIES++))
        
        # Check if query has ORDER BY chunk_index
        if echo "$query_buffer" | grep -qi "ORDER BY.*chunk_index"; then
          ((SAFE_QUERIES++))
        else
          VIOLATIONS+=("$file:$query_start - Missing ORDER BY chunk_index")
        fi
        
        in_query=false
        query_buffer=""
      fi
    fi
  done < "$file"
}

# Audit each path
for pattern in "${AUDIT_PATHS[@]}"; do
  for file in $ROOT/$pattern 2>/dev/null; do
    if [ -f "$file" ]; then
      check_file "$file"
    fi
  done
done

# Report findings
echo "════════════════════════════════════════════════════════════════"
echo "  Audit Results"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Queries found: $TOTAL_QUERIES"
echo "Queries with ORDER BY: $SAFE_QUERIES"
echo "Queries without ORDER BY: $((TOTAL_QUERIES - SAFE_QUERIES))"
echo ""

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo -e "${RED}⚠ VIOLATIONS FOUND:${NC}"
  echo ""
  for violation in "${VIOLATIONS[@]}"; do
    echo -e "${YELLOW}  • $violation${NC}"
  done
  echo ""
  echo "Recommendation: Add 'ORDER BY chunk_index ASC' to ensure stable ordering"
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ ALL QUERIES SAFE${NC}"
  echo ""
  echo "All manuscript_chunks queries include ORDER BY chunk_index."
  echo ""
  exit 0
fi
