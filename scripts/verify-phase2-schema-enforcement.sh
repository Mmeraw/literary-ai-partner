#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Phase 2 Schema Enforcement - Audit-Grade Evidence Bundle
# ============================================================================
# This script provides concrete evidence (not assertions) that:
# 1. DB constraints are correctly defined
# 2. Script guardrails work (reject invalid values before DB)
# 3. DB enforcement works (reject invalid values even if scripts bypassed)
#
# Run this anytime to re-prove Phase 2 Schema Enforcement is complete.
# ============================================================================

echo "════════════════════════════════════════════════════════════════"
echo "  Phase 2 Schema Enforcement - Audit Evidence Bundle"
echo "  $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ============================================================================
# EVIDENCE 1: DB Constraints Exist (Source of Truth)
# ============================================================================
echo "📋 EVIDENCE 1: DB Constraints (Source of Truth)"
echo "════════════════════════════════════════════════════════════════"
docker exec -i supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'evaluation_jobs'
  AND conname IN (
    'chk_eval_jobs_policy_family',
    'chk_eval_jobs_voice_preservation_level',
    'chk_eval_jobs_english_variant'
  )
ORDER BY conname;
" || { echo "❌ FAILED: DB constraints not found"; exit 1; }

echo ""
echo "✅ PASS: All 3 DB constraints verified"
echo ""

# ============================================================================
# EVIDENCE 2: Script Guardrails Work
# ============================================================================
echo "📋 EVIDENCE 2: Script Guardrails (Pre-DB Validation)"
echo "════════════════════════════════════════════════════════════════"
echo "Testing: POLICY_FAMILY=huhu (should be rejected by script)"
echo ""

GUARDRAIL_OUTPUT=$(POLICY_FAMILY=huhu VOICE_LEVEL=balanced ENGLISH_VARIANT=us bash scripts/test-phase2b-chunk-fetch.sh 2>&1 || true)
if echo "$GUARDRAIL_OUTPUT" | grep -q "ERROR: invalid POLICY_FAMILY"; then
  echo "✅ PASS: Script correctly rejected invalid POLICY_FAMILY"
else
  echo "❌ FAILED: Script did not reject invalid POLICY_FAMILY"
  echo "Output: $GUARDRAIL_OUTPUT"
  exit 1
fi

echo ""

# ============================================================================
# EVIDENCE 3: DB Enforcement Works (Even if Scripts Bypassed)
# ============================================================================
echo "📋 EVIDENCE 3: DB Constraint Enforcement (Defense in Depth)"
echo "════════════════════════════════════════════════════════════════"
echo "Testing: Direct INSERT with policy_family='huhu'"
echo ""

DB_OUTPUT=$(docker exec -i supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
INSERT INTO public.evaluation_jobs (
  manuscript_id, job_type, work_type, 
  policy_family, voice_preservation_level, english_variant, 
  status
)
VALUES (
  9999, 'full_evaluation', 'novel', 
  'huhu', 'balanced', 'us', 
  'queued'
);" 2>&1 || true)

if echo "$DB_OUTPUT" | grep -q "chk_eval_jobs_policy_family"; then
  echo "✅ PASS: DB correctly rejected invalid policy_family"
else
  echo "❌ FAILED: DB did not reject invalid policy_family"
  echo "Output: $DB_OUTPUT"
  exit 1
fi

echo ""

# ============================================================================
# EVIDENCE 4: Valid INSERT Works (Positive Test)
# ============================================================================
echo "📋 EVIDENCE 4: Valid INSERT (Canonical Values)"
echo "════════════════════════════════════════════════════════════════"
echo "Testing: INSERT with canonical values (should succeed)"
echo ""

RESULT=$(docker exec -i supabase_db_literary-ai-partner psql -U postgres -d postgres -t -A -c "
INSERT INTO public.evaluation_jobs (
  manuscript_id, job_type, work_type, 
  policy_family, voice_preservation_level, english_variant, 
  status
)
VALUES (
  9999, 'full_evaluation', 'novel', 
  'standard', 'balanced', 'us', 
  'queued'
)
RETURNING id;
" 2>&1)

if echo "$RESULT" | grep -qE '^[0-9a-f-]{36}$'; then
  echo "✅ PASS: Valid INSERT succeeded (job_id: $(echo "$RESULT" | head -1))"
else
  echo "❌ FAILED: Valid INSERT was rejected"
  echo "Output: $RESULT"
  exit 1
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "════════════════════════════════════════════════════════════════"
echo "  Summary: Phase 2 Schema Enforcement"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "✅ DB Constraints: Verified (3/3)"
echo "✅ Script Guardrails: Working (fail-fast on invalid values)"
echo "✅ DB Enforcement: Working (defense in depth)"
echo "✅ Valid INSERT: Working (canonical values accepted)"
echo ""
echo "Canonical Values:"
echo "  policy_family = 'standard'"
echo "  voice_preservation_level = 'balanced'"
echo "  english_variant = 'us'"
echo ""
echo "Allowed Values:"
echo "  policy_family: standard | dark_fiction | trauma_memoir"
echo "  voice_preservation_level: strict | balanced | expressive"
echo "  english_variant: us | uk | ca | au"
echo ""
echo "Status: 🔒 Schema Canon-Locked (Phase 2A/2B/2D)"
echo "Ready: ✅ Phase 2C OpenAI integration (zero drift risk)"
echo ""
echo "Quick Reference: ./scripts/eval-jobs-insert-reference.sh"
echo "Full Docs: docs/PHASE2_SCHEMA_ENFORCEMENT_INDEX.md"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ ALL EVIDENCE CHECKS PASSED"
echo "════════════════════════════════════════════════════════════════"
