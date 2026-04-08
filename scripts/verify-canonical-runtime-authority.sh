#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

fail=0

SEARCH_TOOL=""
if command -v rg >/dev/null 2>&1; then
  SEARCH_TOOL="rg"
elif command -v grep >/dev/null 2>&1; then
  SEARCH_TOOL="grep"
else
  echo "❌ Neither rg nor grep is available on PATH"
  exit 127
fi

search_contains() {
  local file="$1"
  local pattern="$2"

  if [[ "$SEARCH_TOOL" == "rg" ]]; then
    rg -n "$pattern" "$file" >/dev/null 2>&1
  else
    grep -nE "$pattern" "$file" >/dev/null 2>&1
  fi
}

check_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "❌ Missing required file: $file"
    fail=1
  else
    echo "✅ Found: $file"
  fi
}

check_contains() {
  local file="$1"
  local pattern="$2"
  local message="$3"

  if search_contains "$file" "$pattern"; then
    echo "✅ $message"
  else
    echo "❌ $message"
    echo "   Expected pattern: $pattern"
    echo "   File: $file"
    fail=1
  fi
}

check_not_contains() {
  local file="$1"
  local pattern="$2"
  local message="$3"

  if search_contains "$file" "$pattern"; then
    echo "❌ $message"
    echo "   Forbidden pattern: $pattern"
    echo "   File: $file"
    fail=1
  else
    echo "✅ $message"
  fi
}

echo "========== CANONICAL RUNTIME AUTHORITY GUARD =========="
echo "Using search tool: ${SEARCH_TOOL}"

check_file "docs/CANONICAL_RUNTIME_OPERATIONS.md"
check_file "README.md"
check_file "WORKER_RUNBOOK.md"
check_file "OPENAI_INTEGRATION.md"
check_file "docs/PERSISTENCE_CONTRACT.md"
check_file "docs/E2E_WORKFLOW_BRANCH_MATRIX.md"
check_file "docs/jobs/PRODUCTION_READINESS.md"
check_file "docs/GOVERNANCE_AUTHORITY_CHAIN.md"

echo

echo "-- Required canonical authority pointers --"
check_contains "README.md" "docs/CANONICAL_RUNTIME_OPERATIONS.md" "README points to canonical runtime operations"
check_contains "WORKER_RUNBOOK.md" "Legacy/Quarantine Notice" "Worker runbook is marked legacy/quarantined"
check_contains "OPENAI_INTEGRATION.md" "Legacy/Quarantine Notice" "OpenAI integration doc is marked legacy/quarantined"
check_contains "docs/PERSISTENCE_CONTRACT.md" "Scope Clarification" "Persistence contract has legacy scope clarification"
check_contains "docs/E2E_WORKFLOW_BRANCH_MATRIX.md" "Run Canonical Evaluation" "E2E flow names canonical evaluation semantics"
check_contains "docs/jobs/PRODUCTION_READINESS.md" "Canonical runtime supersession" "Production readiness doc declares runtime supersession"
check_contains "docs/GOVERNANCE_AUTHORITY_CHAIN.md" "Supersession Notice" "Governance authority chain is explicitly superseded for runtime"

echo

echo "-- Forbidden stale authority claims in active docs --"
check_not_contains "docs/GOVERNANCE_AUTHORITY_CHAIN.md" "This document is binding on all platform implementations" "Governance authority chain no longer claims runtime binding authority"
check_not_contains "docs/E2E_WORKFLOW_BRANCH_MATRIX.md" "\*\*Run Phase 2\*\*" "E2E flow does not label canonical execution as legacy Phase 2"

if [[ "$fail" -ne 0 ]]; then
  echo
  echo "========== RESULT: FAIL =========="
  exit 1
fi

echo
echo "========== RESULT: PASS =========="
