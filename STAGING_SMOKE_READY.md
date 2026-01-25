# Staging Smoke Test: Ready to Execute

**Status**: 🚧 **BUILT - READY TO RUN**  
**Date**: January 24, 2026  
**Next Action**: Deploy to staging and run tests

---

## ✅ What Was Built

### 1. Complete Test Documentation
- **[docs/STAGING_VERIFICATION.md](docs/STAGING_VERIFICATION.md)**: Full test suite with 7 tests
  - Covers: Auth, security, job progression, DB verification, worker leases, concurrency
  - Includes: Expected outputs, failure modes, debug commands
  - Manual and automated test procedures

### 2. Automated Test Script
- **[scripts/staging-smoke.sh](scripts/staging-smoke.sh)**: Executable bash script
  - Tests 1-3: Automated (runs in ~60 seconds)
  - Tests 4-7: Manual verification guidance
  - Exit codes for CI integration
  - Color-coded output for easy reading

### 3. Quick Start Guide
- **[docs/STAGING_SMOKE_QUICKSTART.md](docs/STAGING_SMOKE_QUICKSTART.md)**: 5-minute setup
  - How to get JWT token
  - How to run tests
  - Common troubleshooting
  - Next steps after passing

### 4. Audit Trail
- **[ZERO_DRIFT_VERIFICATION.md](ZERO_DRIFT_VERIFICATION.md)**: Updated with CI evidence section
  - Tracks last CI run
  - Tracks last staging verification
  - Links to proof of verification

---

## 🎯 Your Immediate Next Steps

### Step 1: Deploy to Staging (15 min)

Follow **[STAGING_READY.md](STAGING_READY.md)**:

```bash
# 1. Set Vercel env vars (staging environment):
#    - SUPABASE_SERVICE_ROLE_KEY
#    - NEXT_PUBLIC_SUPABASE_URL
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - NODE_ENV=production
#    - USE_SUPABASE_JOBS=true
#    - DO NOT SET: ALLOW_HEADER_USER_ID

# 2. Push migrations to staging Supabase
supabase link --project-ref YOUR-STAGING-REF
supabase db push

# 3. Deploy to Vercel
vercel  # Creates preview deployment using staging env vars
```

### Step 2: Create Test User in Staging DB (2 min)

```sql
-- Run in Supabase SQL Editor (staging project)

INSERT INTO auth.users (
  id, email, encrypted_password, 
  email_confirmed_at, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'staging-test@example.com',
  crypt('test-password-123', gen_salt('bf')),
  now(), now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO manuscripts (
  id, user_id, title, content, 
  created_at, updated_at
) VALUES (
  999,
  '00000000-0000-0000-0000-000000000001',
  'Staging Test Manuscript',
  'Test content for staging smoke tests.',
  now(), now()
) ON CONFLICT (id) DO UPDATE SET updated_at = now();
```

### Step 3: Get JWT Token (1 min)

**Option A - Supabase Dashboard** (easiest):
1. Go to Supabase Dashboard → Your Staging Project
2. Authentication → Users → staging-test@example.com
3. Click "Generate Access Token"
4. Copy the token

**Option B - API**:
```bash
curl -X POST "https://YOUR-STAGING-REF.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR-STAGING-ANON-KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"staging-test@example.com","password":"test-password-123"}' \
  | jq -r '.access_token'
```

### Step 4: Run the Smoke Test (1 min)

```bash
export STAGING_URL="https://your-app.vercel.app"
export STAGING_JWT="eyJhbGciOi..."  # Your JWT token

bash scripts/staging-smoke.sh
```

### Step 5: Record Results

Update [docs/STAGING_VERIFICATION.md](docs/STAGING_VERIFICATION.md):

```markdown
## Last Verification Run

**Date**: 2026-01-24  
**Staging URL**: https://your-app.vercel.app  
**Test Results**:
- Test 1 (Create Job): ✅
- Test 2 (Header Bypass Blocked): ✅
- Test 3 (Job Status): ✅
- Test 4 (Database Check): ✅
- Test 5 (Worker Lease): ✅
- Test 6 (Concurrency): ✅
- Test 7 (Lease Recovery): ✅

**Overall**: ✅ VERIFIED
```

---

## 📊 Test Coverage

### Automated Tests (Run by script)
| Test | What It Proves | Critical? |
|------|----------------|-----------|
| **Test 1** | Job creation with real JWT works | ✅ Yes |
| **Test 2** | Header bypass is blocked (security) | 🚨 **CRITICAL** |
| **Test 3** | Jobs progress through states | ✅ Yes |

### Manual Tests (You verify)
| Test | What It Proves | How to Verify |
|------|----------------|---------------|
| **Test 4** | Database schema correct | Run SQL query in Supabase |
| **Test 5** | Worker can claim jobs | Start worker, check logs |
| **Test 6** | Lease contention works | Run 3 workers simultaneously |
| **Test 7** | Expired leases recovered | Simulate stale lease, restart worker |

---

## 🚨 Critical Success Criteria

Before marking as "Staging Verified":

- [ ] Test 1 passes (200 OK, job created)
- [ ] **Test 2 passes (401/403, bypass blocked)** ← SECURITY GATE
- [ ] Test 3 passes (job progresses to terminal state)
- [ ] At least one job completes end-to-end in database
- [ ] Worker successfully claims and processes a job
- [ ] No "SECURITY VIOLATION" errors in logs

If Test 2 fails (bypass works when it shouldn't):
1. **STOP IMMEDIATELY**
2. Check Vercel env vars
3. Remove `ALLOW_HEADER_USER_ID` if present
4. Redeploy
5. Re-test

---

## 🎉 After All Tests Pass

You've proven:
- ✅ Real Supabase works (not just memory mode)
- ✅ Real auth works (no bypass in production)
- ✅ Real workers work (lease contention proven)
- ✅ All CI contracts hold under real conditions

**Next:**
1. Update [ZERO_DRIFT_VERIFICATION.md](ZERO_DRIFT_VERIFICATION.md) with staging results
2. Move to Step 3: [Concurrency Proof](NEXT_HARDENING_THEN_FEATURES.md#step-3-concurrency-proof)
3. Then Step 5: [Production Checklist](NEXT_HARDENING_THEN_FEATURES.md#step-5-production-safety-checklist)
4. **THEN ship features** (Perplexity's job types plan)

---

## 📚 Reference Documents

- **Quick Start**: [docs/STAGING_SMOKE_QUICKSTART.md](docs/STAGING_SMOKE_QUICKSTART.md)
- **Full Test Suite**: [docs/STAGING_VERIFICATION.md](docs/STAGING_VERIFICATION.md)
- **Deployment Guide**: [STAGING_READY.md](STAGING_READY.md)
- **Overall Plan**: [NEXT_HARDENING_THEN_FEATURES.md](NEXT_HARDENING_THEN_FEATURES.md)
- **Audit Trail**: [ZERO_DRIFT_VERIFICATION.md](ZERO_DRIFT_VERIFICATION.md)

---

## 💡 Key Insight

You've spent weeks building a hardened job system. This test suite is where you **prove it works in reality**, not just in theory.

The automated script runs in < 2 minutes. The manual tests take another 10 minutes. That's 12 minutes to validate weeks of infrastructure work.

**Don't skip this.** Every production bug caught in staging saves hours of debugging and user trust.

Ready when you are. 🚀
