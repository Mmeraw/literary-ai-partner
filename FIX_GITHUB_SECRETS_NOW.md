# 🚨 FIX GITHUB SECRETS - PRODUCTION PROJECT ONLY

**Date:** February 1, 2026  
**Status:** URGENT - CI is blocked due to mixed Supabase projects

---

## 🎯 The Problem

Your CI is using **TWO DIFFERENT** Supabase projects:
- ✅ `SUPABASE_SERVICE_ROLE_KEY` → `ngfszuqjoyixmtlbthyv` (TESTING)
- ❌ `SUPABASE_ANON_KEY` → `xtumxjnzdswuumndcbwc` (PRODUCTION)

**This causes Phase 2D Evidence Gate to fail with project mismatch.**

---

## ✅ The Solution

**ALL GitHub secrets MUST use PRODUCTION project:** `xtumxjnzdswuumndcbwc`

---

## 📋 EXACT STEPS TO FIX

### 1. Go to GitHub Secrets Settings

https://github.com/Mmeraw/literary-ai-partner/settings/secrets/actions

### 2. Get Production Keys from Supabase Dashboard

Go to: https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/settings/api

Copy these values:
- **Project URL** (top of page)
- **anon public** key (under "Project API keys")
- **service_role** key (under "Project API keys", click "Reveal")

### 3. Update ALL GitHub Secrets

Click each secret name and click "Update":

| Secret Name | Value | Where to Get It |
|------------|-------|-----------------|
| `SUPABASE_URL` | `https://xtumxjnzdswuumndcbwc.supabase.co` | Project URL from dashboard |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xtumxjnzdswuumndcbwc.supabase.co` | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` (JWT starting with eyJ) | Service role key from dashboard |
| `SUPABASE_ANON_KEY` | `eyJhbG...` (JWT starting with eyJ) | Anon public key from dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` (JWT starting with eyJ) | Same as SUPABASE_ANON_KEY |

**CRITICAL:** Make sure you're copying from the **RevisionGrade Production** project (`xtumxjnzdswuumndcbwc`), NOT the "⚠️ TESTING ONLY" project.

### 4. Verify After Update

After updating all secrets, trigger a new workflow run:

```bash
git commit --allow-empty -m "test: verify supabase secrets fixed"
git push
```

Then check the Phase 2D Evidence workflow - it should print:
```
✅ All key refs match URL project ref: xtumxjnzdswuumndcbwc
```

---

## 🔒 What About the TESTING Project?

**Testing project (`ngfszuqjoyixmtlbthyv`) should NEVER be used in CI.**

It's clearly marked as "⚠️ TESTING ONLY - DO NOT USE" in the Supabase dashboard.

Purpose:
- Test migrations locally before applying to production
- Experiment with schema changes
- **NOT for CI/CD**

If you need to use it for local testing:
```bash
# Create .env.test (NEVER commit this file)
echo "SUPABASE_URL=https://ngfszuqjoyixmtlbthyv.supabase.co" > .env.test
echo "SUPABASE_SERVICE_ROLE_KEY=<test_service_key>" >> .env.test
echo "SUPABASE_ANON_KEY=<test_anon_key>" >> .env.test

# Then run tests with it
source <(grep -v '^#' .env.test | xargs -I {} echo export {}) && npm test
```

---

## 📚 Related Documentation

- [docs/SUPABASE_PROJECTS.md](docs/SUPABASE_PROJECTS.md) - Full project configuration guide
- [README.md](README.md#-supabase-configuration) - Quick reference
- [TEST_ENV.md](TEST_ENV.md) - Testing environment variables (local only)

---

## ✅ Checklist

- [ ] Opened GitHub secrets settings page
- [ ] Opened Supabase Production dashboard
- [ ] Updated `SUPABASE_URL`
- [ ] Updated `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Updated `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Updated `SUPABASE_ANON_KEY`
- [ ] Updated `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Triggered new workflow run
- [ ] Verified Phase 2D Evidence passes fingerprint check

---

**After this fix, ALL CI workflows will use the correct production project.**
