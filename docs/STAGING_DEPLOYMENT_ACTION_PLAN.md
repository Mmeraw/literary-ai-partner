================================================================================
                    STAGING DEPLOYMENT: ACTION PLAN
================================================================================

✅ COMPLETED:
  • Secrets foundation (SUPABASE_SERVICE_ROLE_KEY configured)
  • All 9 migrations applied locally
  • Atomic chunk claiming RPC exists
  • Crash recovery enabled (15-min lease)
  • Staging smoke runbook created (quality gate)
  • Complete documentation provided

================================================================================
                         YOUR IMMEDIATE NEXT STEPS
================================================================================

STEP 1: Review the Setup (15 minutes)
  1. Open: STAGING_READY.md (this file explains everything)
  2. Open: docs/NEXT_STEPS.md (immediate action items)
  3. Open: RUNBOOK_COMMANDS.sh (copy-paste ready)

STEP 2: Configure Vercel Staging (5 minutes)
  Go to: Vercel Dashboard → Project Settings → Environment Variables
  Add these 3 variables (values from your staging Supabase project):
    SUPABASE_SERVICE_ROLE_KEY=eyJh...
    NEXT_PUBLIC_SUPABASE_URL=https://your-staging.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...

STEP 3: Push Migrations to Staging (2 minutes)
  $ supabase link --project-ref your-staging-project-id
  $ supabase db push

STEP 4: Run Quality Gate (30 seconds)
  $ export SUPABASE_PROJECT_ID=your-staging-project-id
  $ bash scripts/staging-smoke-runbook.sh staging
  
  Should see:
    ✓ Migrations applied successfully
    ✓ Crash recovery test passed
    ✓ End-to-end processing completed
    ✓ Outputs validated
    ALL CHECKS PASSED
  
  Exit code: 0 = YOU'RE GOOD

STEP 5: Deploy to Vercel (1 minute)
  $ vercel deploy --prod

STEP 6: Monitor (watch first hour)
  • Check Vercel logs
  • Look for: NO "[RG-SUPABASE] Using ANON key" warnings
  • Look for: NO "permission denied" RLS errors
  • Watch: Chunks transition pending → processing → done

================================================================================
                           KEY FILES TO KNOW
================================================================================

For Immediate Deployment:
  STAGING_READY.md                  ← Start here (full overview)
  RUNBOOK_COMMANDS.sh               ← Copy-paste commands
  scripts/staging-smoke-runbook.sh  ← The quality gate (DO NOT SKIP)

For Step-by-Step:
  docs/NEXT_STEPS.md                ← Immediate actions with details
  docs/STAGING_DEPLOY_CHECKLIST.md  ← Complete checklist

For Reference:
  docs/PRODUCTION_SECRETS_DEPLOY.md ← Complete secrets guide
  .env.local                        ← Your local configuration

================================================================================
                             CRITICAL: DO NOT
================================================================================

❌ Deploy to production without running smoke runbook
❌ Use anon key for server-side writes
❌ Skip migrations (RPC won't exist)
❌ Reuse Supabase project/secrets between staging and prod
❌ Modify schema without migration + smoke test

================================================================================
                       IF SOMETHING BREAKS: ROLLBACK
================================================================================

RLS errors (permission denied):
  → Service role key not set in Vercel
  → Check: docs/PRODUCTION_SECRETS_DEPLOY.md#issue-writes-blocked-with-rls-error
  → Fix: Add SUPABASE_SERVICE_ROLE_KEY to Vercel

Function doesn't exist:
  → Migrations didn't push to remote
  → Check: supabase migration list --project-ref your-project-id
  → Fix: Run supabase db push again

Stuck chunks not recovering:
  → Worker may have crashed or lease timeout not working
  → Check: SELECT COUNT(*) FROM manuscript_chunks WHERE status='processing'
  → Debug: docs/PRODUCTION_SECRETS_DEPLOY.md#issue-stuck-chunks-not-being-recovered

================================================================================
                         NEXT PHASE (AFTER STABLE)
================================================================================

Once staging is stable for 24h:

1. Run same smoke runbook with production secrets
   export SUPABASE_PROJECT_ID=your-prod-project-id
   bash scripts/staging-smoke-runbook.sh production

2. Deploy to production
   (same setup, different Supabase project)

3. After production stability: Build Phase 2
   - LLM Provider Factory
   - Finalize aggregation
   - Extend smoke runbook

================================================================================

Questions? See STAGING_READY.md or docs/PRODUCTION_SECRETS_DEPLOY.md

Good luck! 🚀
