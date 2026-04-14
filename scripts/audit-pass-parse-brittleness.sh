#!/usr/bin/env bash
# audit-pass-parse-brittleness.sh
# Issue #122: Find all pass runners with brittle JSON.parse patterns,
# comment/constant mismatches, and missing error classification.
# Run from repo root.

set -euo pipefail

echo "=== AUDIT: Pass Runner JSON Parse Brittleness ==="
echo "Issue: https://github.com/Mmeraw/literary-ai-partner/issues/122"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# --- 1. MAX_TOKENS comment vs constant mismatches ---
echo "--- [1] MAX_TOKENS comment/constant mismatches ---"
echo "Looking for files where header comment token count != constant value..."
for f in $(grep -rl 'MAX_TOKENS' lib/evaluation/pipeline/ 2>/dev/null || true); do
  echo ""
  echo "FILE: $f"
  echo "  Comments mentioning tokens:"
  grep -n -i 'max.tokens.*[0-9]' "$f" | grep -E '^[0-9]+:.*(\*|\/\/)' | head -5 || echo "    (none)"
  echo "  Constants:"
  grep -n 'MAX_TOKENS' "$f" | grep -v 'import\|require\|from' | head -5 || echo "    (none)"
done
echo ""

# --- 2. Bare JSON.parse with no recovery ---
echo "--- [2] Bare JSON.parse catch-and-throw (no classification) ---"
echo "Files with JSON.parse followed by generic throw (no error class)..."
grep -rn 'JSON\.parse' lib/evaluation/pipeline/ --include='*.ts' | while read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  # Check if the catch block within 5 lines has a generic throw
  context=$(sed -n "$((lineno)),$((lineno+8))p" "$file" 2>/dev/null)
  if echo "$context" | grep -q 'throw new Error.*not valid JSON'; then
    echo "  OFFENDER: $file:$lineno -- bare JSON.parse with generic error"
  fi
done
echo ""

# --- 3. Missing finish_reason check ---
echo "--- [3] Missing finish_reason check near parse logic ---"
for f in $(find lib/evaluation/pipeline/ -name '*.ts' 2>/dev/null); do
  if grep -q 'JSON\.parse' "$f" && ! grep -q 'finish_reason' "$f"; then
    echo "  OFFENDER: $f -- has JSON.parse but no finish_reason check"
  fi
done
echo ""

# --- 4. Missing raw response logging before parse ---
echo "--- [4] Missing raw response logging before JSON.parse ---"
for f in $(find lib/evaluation/pipeline/ -name '*.ts' 2>/dev/null); do
  if grep -q 'JSON\.parse' "$f"; then
    # Check if there's a console.log/error with 'raw' within 5 lines before JSON.parse
    parse_line=$(grep -n 'JSON\.parse' "$f" | head -1 | cut -d: -f1)
    if [ -n "$parse_line" ]; then
      start=$((parse_line > 5 ? parse_line - 5 : 1))
      pre_context=$(sed -n "${start},${parse_line}p" "$f")
      if ! echo "$pre_context" | grep -q 'console\.[a-z]*.*raw\|console\.[a-z]*.*preview\|console\.[a-z]*.*response'; then
        echo "  OFFENDER: $f:$parse_line -- no raw response log before JSON.parse"
      fi
    fi
  fi
done
echo ""

# --- 5. Missing fence stripping ---
echo "--- [5] Missing markdown fence stripping ---"
for f in $(find lib/evaluation/pipeline/ -name '*.ts' 2>/dev/null); do
  if grep -q 'JSON\.parse' "$f" && ! grep -q 'fence\|```\|extractJson' "$f"; then
    echo "  OFFENDER: $f -- has JSON.parse but no fence stripping"
  fi
done
echo ""

# --- 6. response_format json_object without truncation guard ---
echo "--- [6] response_format: json_object without truncation guard ---"
for f in $(find lib/evaluation/pipeline/ -name '*.ts' 2>/dev/null); do
  if grep -q 'json_object' "$f" && ! grep -q 'truncat\|endsWith.*}\|finish_reason.*length' "$f"; then
    echo "  OFFENDER: $f -- uses json_object mode but no truncation detection"
  fi
done
echo ""

echo "=== AUDIT COMPLETE ==="
