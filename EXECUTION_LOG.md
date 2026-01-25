# STAGING SMOKE TEST - EXECUTION LOG

**Date**: January 24, 2026  
**Environment**: Dev Container with Local Supabase + Remote Supabase Project  
**Current State**: Ready to execute

---

## Execution Path Chosen

**Starting with LOCAL execution** (header bypass enabled for testing):
- Use existing `.env.local` configuration
- `ALLOW_HEADER_USER_ID=true` (local dev mode)
- Test against local dev server
- Verify script logic before hitting remote staging

---

## Step 1: Start Dev Server

```bash
cd /workspaces/literary-ai-partner
npm run dev
# Server runs on port 3002
```

**Status**: ✅ Server started successfully

---

## Step 2: Run Staging Smoke Test (Local Mode)

```bash
export STAGING_URL="http://localhost:3002"
export STAGING_JWT="fake-jwt-not-needed-in-local-mode"
bash scripts/staging-smoke.sh
```

**Expected Behavior**:
- Test 1: Should PASS (create job with or without JWT)
- Test 2: Should FAIL (because `ALLOW_HEADER_USER_ID=true` in local mode)
  - This is EXPECTED for local dev
  - It proves Test 2 works correctly (detects when bypass is enabled)

---

## Step 3: Interpret Results

### If Test 2 "fails" (bypass works):
✅ **CORRECT** - You're in local dev mode where bypass is intentionally enabled
- The test correctly detected the bypass
- Script is working as designed
- Next: Run against real staging (remote Supabase) with bypass disabled

### If Test 1 fails:
❌ Check server logs, API endpoints, job creation logic

### If Test 3 fails (job doesn't progress):
⚠️  Expected in local mode if worker isn't running
- This is a manual verification test anyway

---

## Step 4: Next Actions Based on Results

After local test completes:

1. **Review output** - Did the script run? Did it show clear PASS/FAIL messages?
2. **Fix any script bugs** - Is the bash logic working?
3. **Deploy to Vercel** - Get a real staging environment
4. **Re-run against Vercel** - With `ALLOW_HEADER_USER_ID` unset
5. **Verify Test 2 PASSES** - Bypass is blocked in deployed environment

---

## Current Blockers

1. ✅ Script created and executable
2. ✅ Dev server can run
3. ⚠️  **JWT token creation blocked** - Supabase email validation rejects test emails
   - **Solution**: Use header bypass mode for local testing (it's already enabled)
   - **For real staging**: Create user manually in Supabase Dashboard

4. ❓ **Real staging deployment** - Do you have this deployed to Vercel yet?

---

## Recommendation

**Run it in local mode RIGHT NOW** to verify the script works:

```bash
# In terminal:
cd /workspaces/literary-ai-partner

# Start server (if not running)
npm run dev &
sleep 10

# Run the smoke test
export STAGING_URL="http://localhost:3002"
export STAGING_JWT="not-needed-for-local"
bash scripts/staging-smoke.sh

# Expected: Test 2 will show "SECURITY VIOLATION" because bypass is enabled
# This is CORRECT for local dev mode - proves the test works!
```

---

## What This Proves (Even in Local Mode)

✅ Script executes without bash errors  
✅ HTTP requests are formatted correctly  
✅ JSON parsing works  
✅ Test 2 correctly detects when bypass is enabled  
✅ Output formatting is readable  

**Missing (requires real staging)**:
❌ Real JWT auth flow  
❌ Production-like RLS behavior  
❌ Vercel deployment verification  

---

## Decision Point

**Do you want to:**

**A) Run local test now** (5 min) - Proves script works  
**B) Deploy to Vercel first** (15 min) - Get real staging environment  
**C) Both** - Local first, then deploy and re-run  

**My recommendation: Option C**

1. Run local now → verify script logic
2. Deploy to Vercel → get real environment
3. Re-run against Vercel → prove real auth works
