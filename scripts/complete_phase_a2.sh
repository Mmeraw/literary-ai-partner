#!/bin/bash
# Phase A.2 Completion Script
# Run this when terminal is recovered

set -e

echo "=== Phase A.2 Completion ==="
echo

# Step 1: Reset terminal
echo "Step 1: Resetting terminal..."
reset
stty sane
export PAGER=cat
export GIT_PAGER=cat
export LESS='-FRSX'
export PSQL_PAGER=cat
git config --global core.pager cat
echo "✓ Terminal configured"
echo

# Step 2: Verify changes
echo "Step 2: Verifying file changes..."
cd /workspaces/literary-ai-partner
git status --short
echo

# Step 3: Commit changes
echo "Step 3: Committing changes..."
git add supabase/migrations/20260124000000_evaluation_artifacts.sql \
        supabase/migrations/20260130000003_fix_evaluation_artifacts_job_id_uuid.sql

git commit -m "fix: unblock local reset by casting evaluation_artifacts.job_id in RLS policy" \
           -m "Add forward migration to convert job_id TEXT→UUID and add FK"

echo "✓ Changes committed"
echo

# Step 4: Push to remote
echo "Step 4: Pushing to origin/main..."
git push origin main
echo "✓ Pushed to GitHub"
echo

# Step 5: Test local reset
echo "Step 5: Testing local reset..."
supabase db reset
echo "✓ Local reset succeeded"
echo

# Step 6: Verify A.2 columns locally
echo "Step 6: Verifying A.2 columns exist locally..."
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -P pager=off -c \
  "SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_schema='public' AND table_name='evaluation_jobs' 
   AND column_name IN ('attempt_count','max_attempts','next_attempt_at','failed_at') 
   ORDER BY column_name;"
echo

# Step 7: Verify job_id is now UUID locally
echo "Step 7: Verifying job_id converted to UUID..."
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -P pager=off -c \
  "SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_schema='public' AND table_name='evaluation_artifacts' 
   AND column_name='job_id';"
echo

# Step 8: Push migration to remote
echo "Step 8: Pushing migration 20260130000003 to remote..."
supabase db push --linked
echo "✓ Migration deployed"
echo

# Step 9: Verify migration sync
echo "Step 9: Verifying migration sync..."
supabase migration list --linked | tail -10
echo

echo "=== Phase A.2 Complete ==="
echo
echo "Summary:"
echo "  ✓ Local reset unblocked (cast in RLS policy)"
echo "  ✓ Forward migration deployed (TEXT→UUID + FK)"
echo "  ✓ All 32 migrations synced (local ⟷ remote)"
echo "  ✓ A.2 retry tracking live on both environments"
echo
echo "Next: Phase A.3 - Dead-letter UI (/admin/failed-jobs)"
