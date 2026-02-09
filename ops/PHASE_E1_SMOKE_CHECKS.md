# Phase E1 — Smoke Checks (Production)

**Target:** Vercel production URL from v1.0.1-rrs-100  
**Time:** 15 minutes  
**Date:** 2026-02-09

---

## Prerequisites
- [ ] Vercel project deployed
- [ ] Production URL: `https://_______.vercel.app`
- [ ] Supabase env vars configured

---

## 1. Build Identity (1 min)
**Action:** Open production URL → Check version  
**Expected:** App loads, shows commit c018221 or e30f89a  
**Result:** ❌ / ✅

---

## 2. D1 Error Safety (3 min)
**Action:** Submit invalid payload to /api/evaluate  
**Expected:** Safe error, NO stack traces, NO secrets  
**Result:** ❌ / ✅

---

## 3. End-to-End Evaluation (5 min)
**Action:** Run full evaluation through UI  
**Expected:** Completes, agent view shows work type + matrix version  
**Verify Supabase:** `SELECT * FROM evaluations ORDER BY created_at DESC LIMIT 1;`  
**Result:** ❌ / ✅

---

## 4. Forbidden Content (2 min)
**Action:** Submit content triggering safety controls  
**Expected:** Safe response, NO disallowed content  
**Result:** ❌ / ✅

---

## 5. Rate Limits (4 min)
**Action:** Rapid-fire 25 requests  
**Expected:** 429 at threshold, ~5 concurrent max  
**Result:** ❌ / ✅

---

## Summary
**Overall:** ❌ FAILED / ✅ PASSED  
**Next:** If PASSED → Phase E2 monitoring. If FAILED → fix and repeat.
