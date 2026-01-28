#!/usr/bin/env bash
set -euo pipefail

# Quick Reference: Valid evaluation_jobs INSERT Template
# Source: Database check constraints (supabase/migrations/20260117060042_remote_schema.sql)
# Last verified: 2026-01-27

# ============================================================================
# CANONICAL VALUES (use these as defaults)
# ============================================================================
POLICY_FAMILY="standard"
VOICE_LEVEL="balanced"
ENGLISH_VARIANT="us"

# ============================================================================
# ALLOWED ENUM VALUES (from DB check constraints)
# ============================================================================
# policy_family: standard | dark_fiction | trauma_memoir
# voice_preservation_level: strict | balanced | expressive
# english_variant: us | uk | ca | au

# ============================================================================
# EXAMPLE: Valid INSERT using canonical values
# ============================================================================
cat << 'SQL'
INSERT INTO public.evaluation_jobs (
  manuscript_id,
  job_type,
  status,
  phase,
  work_type,
  policy_family,
  voice_preservation_level,
  english_variant
)
VALUES (
  1,                    -- manuscript_id (bigint)
  'full_evaluation',    -- job_type (text)
  'queued',            -- status (text)
  'phase_1',           -- phase (text)
  'novel',             -- work_type (text)
  'standard',          -- policy_family: standard|dark_fiction|trauma_memoir
  'balanced',          -- voice_preservation_level: strict|balanced|expressive
  'us'                 -- english_variant: us|uk|ca|au
);
SQL

# ============================================================================
# GUARDRAILS: Add this to any script that creates evaluation_jobs
# ============================================================================
cat << 'BASH'
# Canonical defaults (override with env vars if needed)
POLICY_FAMILY="${POLICY_FAMILY:-standard}"
VOICE_LEVEL="${VOICE_LEVEL:-balanced}"
ENGLISH_VARIANT="${ENGLISH_VARIANT:-us}"

# Fail fast on invalid values
case "$POLICY_FAMILY" in
  standard|dark_fiction|trauma_memoir) ;;
  *) echo "ERROR: invalid POLICY_FAMILY=$POLICY_FAMILY"; exit 1 ;;
esac

case "$VOICE_LEVEL" in
  strict|balanced|expressive) ;;
  *) echo "ERROR: invalid VOICE_LEVEL=$VOICE_LEVEL"; exit 1 ;;
esac

case "$ENGLISH_VARIANT" in
  us|uk|ca|au) ;;
  *) echo "ERROR: invalid ENGLISH_VARIANT=$ENGLISH_VARIANT"; exit 1 ;;
esac
BASH

# ============================================================================
# COMMON MISTAKES (these will fail)
# ============================================================================
cat << 'ERRORS'
❌ WRONG - NULL values:
   INSERT INTO evaluation_jobs (manuscript_id, job_type, status)
   VALUES (1, 'full_evaluation', 'queued');
   → ERROR: null value in column "policy_family" violates not-null constraint

❌ WRONG - Invalid policy_family:
   policy_family = 'huhu'
   → ERROR: violates check constraint "chk_eval_jobs_policy_family"

❌ WRONG - Wrong value family:
   voice_preservation_level = 'standard'  (belongs to policy_family enum)
   → ERROR: violates check constraint "chk_eval_jobs_voice_preservation_level"

✅ CORRECT - Use canonical values:
   policy_family = 'standard'
   voice_preservation_level = 'balanced'
   english_variant = 'us'
ERRORS

# ============================================================================
# DIAGNOSTIC QUERY: Verify constraints directly from database
# ============================================================================
cat << 'QUERY'
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
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
  );
"
QUERY

echo ""
echo "📖 See also:"
echo "  - docs/EVALUATION_JOBS_ENUM_VALUES.md (complete reference)"
echo "  - docs/PHASE2_SCHEMA_ENFORCEMENT_COMPLETE.md (implementation summary)"
