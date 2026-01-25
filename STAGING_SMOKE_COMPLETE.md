# Staging Smoke Test - Implementation Complete ✅

**Status**: **READY TO EXECUTE**  
**Created**: January 24, 2026  
**What Changed**: Complete staging verification infrastructure built

---

## 📦 What You Got

### 3 New Documentation Files
1. **[docs/STAGING_VERIFICATION.md](docs/STAGING_VERIFICATION.md)**
   - Complete test suite (7 tests)
   - Expected outputs and failure modes
   - Database queries and debug commands
   - Success criteria checklist

2. **[docs/STAGING_SMOKE_QUICKSTART.md](docs/STAGING_SMOKE_QUICKSTART.md)**
   - 5-minute quick start guide
   - How to get JWT token
   - Common troubleshooting
   - Next steps after passing

3. **[STAGING_SMOKE_READY.md](STAGING_SMOKE_READY.md)**
   - Executive summary
   - Immediate action checklist
   - Critical success criteria
   - Links to all relevant docs

### 1 Automated Test Script
**[scripts/staging-smoke.sh](scripts/staging-smoke.sh)** (executable)
- Tests 1-3: Fully automated (~60 seconds)
- Tests 4-7: Manual verification guidance
- Color-coded output
- Proper exit codes for CI integration

### Updates to Existing Files
- **[ZERO_DRIFT_VERIFICATION.md](ZERO_DRIFT_VERIFICATION.md)**: Added CI evidence tracking section
- **[NEXT_HARDENING_THEN_FEATURES.md](NEXT_HARDENING_THEN_FEATURES.md)**: Complete phase plan (already existed)

---

## 🎯 Your Next Action (Pick One)

### Option A: Deploy and Test Now (20 minutes total)

```bash
# 1. Deploy to staging (if not already done)
#    Follow STAGING_READY.md

# 2. Get JWT token from Supabase Dashboard
#    Authentication → Users → Generate Access Token

# 3. Run the test
export STAGING_URL="https://your-app.vercel.app"
export STAGING_JWT="eyJhbG..."
bash scripts/staging-smoke.sh

# 4. Record results in docs/STAGING_VERIFICATION.md
```

### Option B: Review Documentation First (5 minutes)

```bash
# Quick read path:
cat docs/STAGING_SMOKE_QUICKSTART.md    # 2 min read
cat STAGING_SMOKE_READY.md              # 3 min read

# Deep dive path:
cat docs/STAGING_VERIFICATION.md        # 10 min read (all 7 tests in detail)
```

### Option C: Continue with Other Hardening Steps

If you don't have staging deployed yet, continue with:
- Step 3: Concurrency proof (create dedicated test)
- Step 5: Production checklist (verify env vars)

---

## 🔍 What the Tests Prove

### Automated Tests (60 seconds)
| Test | Proves | Why It Matters |
|------|--------|----------------|
| **Test 1** | Job creation with JWT | Real auth works |
| **Test 2** | Header bypass blocked | 🚨 Security gate |
| **Test 3** | Job progresses | State machine works |

### Manual Tests (10 minutes)
| Test | Proves | How |
|------|--------|-----|
| **Test 4** | DB schema correct | SQL query in Supabase |
| **Test 5** | Worker claims jobs | Trigger `/api/jobs/{id}/run-phase1` |
| **Test 6** | Lease contention | Run 2 workers simultaneously |
| **Test 7** | Expired lease recovery | Simulate stale lease + restart worker |

---

## 🚨 Test 2 is Critical

**Test 2 (Header Bypass Blocked)** is your security gate.

**If it passes** (401/403): ✅ Staging is secure  
**If it fails** (200 OK): 🚨 **STOP - Security violation**

If Test 2 fails:
1. Check Vercel env vars: `ALLOW_HEADER_USER_ID` must NOT exist
2. Verify deployment is using staging environment
3. Check for `SECURITY VIOLATION` in logs
4. Fix, redeploy, re-test

**Do not proceed to production if Test 2 fails.**

---

## 📊 Success Path

```
1. Run automated tests (scripts/staging-smoke.sh)
   ↓
2. All pass? → Complete manual tests 4-7
   ↓
3. Record results in docs/STAGING_VERIFICATION.md
   ↓
4. Update ZERO_DRIFT_VERIFICATION.md with staging URL + date
   ↓
5. Move to Step 3 (Concurrency) or Step 5 (Production checklist)
   ↓
6. THEN ship features (Perplexity's job types)
```

---

## 💡 Key Insight from ChatGPT

> "You are done hardening the harness.  
> Now you must prove it holds under real conditions.  
> Until you do that, any new job type is compounding risk."

This test suite **proves the harness holds**. It's the bridge between:
- ✅ "We built it correctly" (CI contracts)
- ✅ "It works in production" (staging smoke tests)

---

## 📚 Documentation Map

```
STAGING_SMOKE_READY.md          ← Start here (this file)
  ↓
docs/STAGING_SMOKE_QUICKSTART.md   ← Quick 5-min guide
  ↓
docs/STAGING_VERIFICATION.md       ← Full test details
  ↓
STAGING_READY.md                   ← Deployment guide
  ↓
NEXT_HARDENING_THEN_FEATURES.md    ← Overall plan
```

---

## ✅ Checklist Before You Start

- [ ] Staging Supabase project created
- [ ] Migrations applied to staging (`supabase db push`)
- [ ] Vercel staging environment configured
- [ ] Staging deployed (or ready to deploy)
- [ ] Test user created in Supabase (or can be created via SQL)
- [ ] Test manuscript exists (ID 999) or can be created
- [ ] `jq` installed locally (for JSON parsing)

---

## 🚀 Ready to Execute

Everything is built. The script is tested (syntax). Documentation is complete.

**When you're ready:**

```bash
# Read the quick start
cat docs/STAGING_SMOKE_QUICKSTART.md

# Deploy to staging (if needed)
# (Follow STAGING_READY.md)

# Run the test
export STAGING_URL="https://your-app.vercel.app"
export STAGING_JWT="<your-jwt-token>"
bash scripts/staging-smoke.sh
```

**Expected runtime**: 
- Automated tests: 60 seconds
- Manual verification: 10 minutes
- **Total: < 12 minutes to prove weeks of infrastructure work**

---

## Questions?

- **"Do I need a worker running?"** - Not for Tests 1-3 (automated). Yes for Tests 5-7 (manual).
- **"What if I don't have staging yet?"** - Follow [STAGING_READY.md](STAGING_READY.md) first (15 min setup).
- **"Can I run this in CI?"** - Yes! The script has proper exit codes. Add to GitHub Actions after manual verification.
- **"What if tests fail?"** - Check [docs/STAGING_VERIFICATION.md](docs/STAGING_VERIFICATION.md) "Failure Investigation" section.

---

**Bottom line**: You have everything needed to prove your job system works in production-like conditions. The automated part runs in 60 seconds. Do it. 🚀
