#!/bin/bash
# Quick Reference: Staging Smoke Runbook Commands
# Copy-paste ready for your terminal

# ===== LOCAL VALIDATION (no migration push) =====
bash scripts/staging-smoke-runbook.sh local

# ===== STAGING DEPLOYMENT (full validation + push) =====
export SUPABASE_PROJECT_ID=your-staging-project-id
bash scripts/staging-smoke-runbook.sh staging
# Exit code 0 = safe to promote to staging

# ===== PRODUCTION VALIDATION (final gate) =====
export SUPABASE_PROJECT_ID=your-prod-project-id
bash scripts/staging-smoke-runbook.sh production
# Exit code 0 = safe to promote to production

# ===== WHAT THE RUNBOOK VALIDATES =====
# ✓ Migrations push successfully
# ✓ Crash recovery for stuck chunks works (processing_started_at timeout)
# ✓ End-to-end manuscript processing completes
# ✓ Output JSON is schema-compliant

# ===== EXIT CODES =====
# 0 = all checks passed, safe to deploy
# 1 = migration failure
# 2 = crash recovery test failure
# 3 = end-to-end processing failure
# 4 = output validation failure

# ===== IF SOMETHING FAILS =====
# 1. Check docs/PRODUCTION_SECRETS_DEPLOY.md for the specific issue
# 2. Look for "[RG-SUPABASE] Using ANON key" warning (set SUPABASE_SERVICE_ROLE_KEY)
# 3. Verify migrations: supabase migration list --project-ref your-project-id
# 4. Re-run the runbook after fixing

# ===== MONITORING AFTER DEPLOY =====
# Vercel logs (production):
vercel logs --prod

# Supabase studio:
# https://app.supabase.com → your-project → Data Editor
# Watch: manuscript_chunks table, status/attempt_count columns

# ===== NEVER SKIP THE RUNBOOK =====
# This is your quality gate for years. Every. Single. Deploy.
