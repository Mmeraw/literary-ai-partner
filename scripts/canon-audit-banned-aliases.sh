#!/bin/bash
# Canonical Vocabulary Audit - Find ALL banned aliases
# Usage: ./scripts/canon-audit-banned-aliases.sh
# Reference: docs/CANONICAL_VOCABULARY.md

set -euo pipefail

echo "🔍 Canonical Vocabulary Audit - Searching for banned aliases..."
echo ""

ERRORS=0

# Storage layer patterns (ERROR level - blocks PR)
echo "=== STORAGE LAYER (ERROR) ==="
echo ""

echo "Checking: Ownership drift (owner_id, author_id in DB/RPC)..."
if rg --type sql --type ts --type tsx 'owner_id|author_id' supabase/ src/ --stats 2>/dev/null | grep -q 'matches'; then
  echo "❌ CANON_VIOLATION: Found 'owner_id' or 'author_id' in storage layer"
  echo "   Fix: Replace with canonical 'user_id'"
  echo "   See: docs/CANONICAL_VOCABULARY.md#ownership"
  rg --type sql --type ts --type tsx 'owner_id|author_id' supabase/ src/ -n
  ((ERRORS++))
fi
echo ""

echo "Checking: Job status drift (state, stage, job_state in DB)..."
if rg --type sql 'state|stage|job_state' supabase/migrations/ --stats 2>/dev/null | grep -q 'matches'; then
  echo "❌ CANON_VIOLATION: Found 'state', 'stage', or 'job_state' in DB"
  echo "   Fix: Replace with canonical 'status'"
  echo "   See: docs/CANONICAL_VOCABULARY.md#job-status"
  rg --type sql 'state|stage|job_state' supabase/migrations/ -n
  ((ERRORS++))
fi
echo ""

echo "Checking: Phase naming drift (phase1, phase2, p1, p2 in DB/TS)..."
if rg --type sql --type ts --type tsx 'phase1|phase2|"p1"|"p2"|phase_one|phase_two' supabase/ src/ --stats 2>/dev/null | grep -q 'matches'; then
  echo "❌ CANON_VIOLATION: Found 'phase1/phase2/p1/p2' in storage layer"
  echo "   Fix: Use canonical 'phase_0', 'phase_1', 'phase_2'"
  echo "   See: docs/CANONICAL_VOCABULARY.md#job-phase"
  rg --type sql --type ts --type tsx 'phase1|phase2|"p1"|"p2"' supabase/ src/ -n
  ((ERRORS++))
fi
echo ""

echo "Checking: Manuscript identity drift (document_id, work_id, doc_id in DB)..."
if rg --type sql 'document_id|work_id|doc_id' supabase/migrations/ --stats 2>/dev/null | grep -q 'matches'; then
  echo "❌ CANON_VIOLATION: Found 'document_id/work_id/doc_id' in DB"
  echo "   Fix: Replace with canonical 'manuscript_id'"
  echo "   See: docs/CANONICAL_VOCABULARY.md#manuscript"
  rg --type sql 'document_id|work_id|doc_id' supabase/migrations/ -n
  ((ERRORS++))
fi
echo ""

echo "Checking: RLS policies using created_by for authorization..."
if rg --type sql 'created_by.*=.*auth\.uid\(\)' supabase/ --stats 2>/dev/null | grep -q 'matches'; then
  echo "❌ CANON_VIOLATION: RLS policy using 'created_by' for authorization"
  echo "   Fix: Use canonical 'user_id' for RLS; 'created_by' is audit-only"
  echo "   See: docs/CANONICAL_VOCABULARY.md#ownership-vs-audit"
  rg --type sql 'created_by.*=.*auth\.uid\(\)' supabase/ -n
  ((ERRORS++))
fi
echo ""

# Display layer patterns (WARNING level - does not block)
echo "=== DISPLAY LAYER (WARNING) ==="
echo ""

echo "Checking: UI status labels (complete, done in React components)..."
if rg --type tsx --type jsx 'complete"|"done"' src/components/ --stats 2>/dev/null | grep -q 'matches'; then
  echo "⚠️  WARNING: Found 'complete' or 'done' in display layer"
  echo "   Acceptable if mapping to canonical storage values"
  echo "   Verify: These are display labels, not storage values"
  rg --type tsx --type jsx '"complete"|"done"' src/components/ -n | head -5
fi
echo ""

# Summary
echo "========================================"
if [ $ERRORS -eq 0 ]; then
  echo "✅ No banned aliases found in storage layer"
  echo "✅ Canonical vocabulary compliance verified"
  exit 0
else
  echo "❌ Found $ERRORS storage-layer violations"
  echo "❌ Fix these before proceeding"
  echo ""
  echo "📚 See: docs/CANONICAL_VOCABULARY.md"
  exit 1
fi
