# Staging Smoke Test - Quick Start

**Purpose**: Run this after deploying to staging, before promoting to production.

---

## 🚀 Quick Run (5 minutes)

### 1. Get Your Staging JWT Token

```bash
# Option A: Via Supabase Dashboard (easiest)
# 1. Go to https://app.supabase.com → Your Staging Project
# 2. Authentication → Users → Find/create test user
# 3. Click user → Generate Access Token
# 4. Copy the token

# Option B: Via API (if test user already exists)
curl -X POST "https://YOUR-STAGING-REF.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR-STAGING-ANON-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staging-test@example.com",
    "password": "test-password-123"
  }' | jq -r '.access_token'
```

### 2. Set Environment Variables

```bash
export STAGING_URL="https://your-app-name.vercel.app"
export STAGING_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Run the Test

```bash
bash scripts/staging-smoke.sh
```

### 4. Interpret Results

**✅ Success** (all automated tests pass):
```
════════════════════════════════════════════
  ✅ AUTOMATED TESTS PASSED                
════════════════════════════════════════════

Next Steps:
1. Complete manual verification tests (4-7)
2. Update docs/STAGING_VERIFICATION.md with results
3. Record verification date and URL
```

**❌ Failure** (see specific error messages):
- Exit code 1 = Prerequisites missing (JWT or URL not set)
- Exit code 2 = Auth test failed (CRITICAL: check Test 2 - might be security issue)
- Exit code 3 = Job progression failed (worker not running or DB issue)
- Exit code 4 = Other failures

---

## 🔍 What Gets Tested

### Automated (runs in ~60 seconds)
1. ✅ Create job with real JWT auth
2. ✅ Verify header bypass is blocked (SECURITY)
3. ✅ Poll job status progression

### Manual Verification (you run these)
4. ⚠️ Check database schema via Supabase SQL Editor
5. ⚠️ Run worker and verify lease claim
6. ⚠️ Test concurrent workers (lease contention)
7. ⚠️ Test lease recovery after expiry

---

## 🐛 Troubleshooting

### "STAGING_URL not set"
```bash
export STAGING_URL="https://your-vercel-app.vercel.app"
```

### "STAGING_JWT not set"
Get token from Supabase Dashboard (see Quick Run step 1)

### Test 1 fails with 401
- JWT token expired (generate new one)
- Test user doesn't exist (create in Supabase)
- Wrong Supabase project linked

### Test 2 fails (header bypass works - should be blocked!)
**🚨 CRITICAL SECURITY ISSUE**
1. Check Vercel env vars: `ALLOW_HEADER_USER_ID` must NOT exist
2. Verify you're hitting staging deployment (not local)
3. Redeploy and re-test

### Test 3 fails (job stuck in "queued")
- No worker running → Start worker pointing at staging
- Worker can't connect → Check worker env vars
- Job system disabled → Verify `USE_SUPABASE_JOBS=true` in Vercel

---

## 📝 After Successful Run

1. **Record results** in [docs/STAGING_VERIFICATION.md](../docs/STAGING_VERIFICATION.md)
2. **Update** [ZERO_DRIFT_VERIFICATION.md](../ZERO_DRIFT_VERIFICATION.md):
   ```markdown
   ## Staging Verification
   **Last Verified**: 2026-01-24
   **URL**: https://your-app.vercel.app
   **Result**: ✅ All automated tests passed
   ```
3. **Complete manual tests** (4-7) and document results
4. **Ready for production** once all tests pass

---

## 🔗 Full Documentation

See [docs/STAGING_VERIFICATION.md](../docs/STAGING_VERIFICATION.md) for:
- Complete test descriptions
- Expected outputs
- Failure investigation guide
- Manual test procedures
- Database queries
- Worker setup instructions
