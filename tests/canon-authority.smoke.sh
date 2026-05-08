#!/usr/bin/env bash
set -euo pipefail

out="$(bash scripts/verify-canon-authority.sh)"

echo "$out" | grep -q "canon-authority guard: PASS"
echo "$out" | grep -q "warning_count.md_md_typos="
echo "$out" | grep -q "warning_count.missing_canon_status_registered="
echo "$out" | grep -q "warning_count.non_authoritative_claims="

echo "canon-authority smoke: PASS"
