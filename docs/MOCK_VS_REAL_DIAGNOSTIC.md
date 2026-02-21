# Mock vs Real Evaluation Diagnostic

**Status:** Active Governance Issue  
**Priority:** Critical — affects evaluation credibility  
**Created:** 2026-02-21

---

## PROBLEM SUMMARY

RevisionGrade evaluations can fail silently to mock fallback when OpenAI API calls fail (429 rate limit, missing key, etc.). Until now, the UI **did not display governance warnings**, making it impossible to know if you were seeing real AI analysis or placeholder data.

**This is now fixed** — governance warnings are displayed prominently in the UI.

---

## QUICK DIAGNOSTIC (Is my evaluation mock or real?)

### Option 1: Check the UI (after UI fix is deployed)

Visit your evaluation report page: `/evaluate/[jobId]`

Look for a **red warning banner** at the top:

```
⚠️ EVALUATION INTEGRITY WARNING
🔶 MOCK EVALUATION: This is generated test data, not a real AI analysis
```

If you see this banner → **MOCK evaluation (not real AI)**  
If you do NOT see this banner → **Real AI evaluation**

---

### Option 2: Check Supabase Directly

Run this query in Supabase SQL Editor:

```sql
SELECT
  job_id,
  artifact_type,
  created_at,
  content->'governance'->'warnings' AS warnings,
  content->'engine'->>'model' AS model,
  content->'engine'->>'provider' AS provider,
  content->'governance'->>'confidence' AS confidence
FROM public.evaluation_artifacts
WHERE job_id = 'YOUR_JOB_ID_HERE'
ORDER BY created_at DESC
LIMIT 1;
```

**Interpretation:**

| Condition | Meaning |
|-----------|---------|
| `warnings` contains "MOCK EVALUATION" | Mock fallback was used |
| `warnings` is `null` or `[]` | Real AI ran |
| `model` is missing or `null` | Likely mock |
| `model` is `gpt-4o-mini` and warnings empty | Real AI ran |
| `confidence` is 0.85 | Mock (hardcoded value) |
| `confidence` is 0.90 | Real AI (default) |

---

## MOST COMMON CAUSES OF MOCK FALLBACK

### 1. OpenAI API Key Not Set in Vercel

**Check:**
```bash
vercel env ls
```

Look for `OPENAI_API_KEY` in **Production** environment.

**Fix:**
```bash
vercel env add OPENAI_API_KEY production
# Paste your OpenAI API key when prompted
```

Then redeploy:
```bash
vercel --prod
```

---

### 2. OpenAI Rate Limit (429 Error)

**Symptoms:**
- Vercel logs show: `OpenAI evaluation failed: 429`
- Job completes but uses mock fallback

**Causes:**
- Free tier rate limits exceeded
- Too many concurrent evaluations
- Insufficient quota

**Fix:**
1. Check OpenAI usage dashboard: https://platform.openai.com/usage
2. Upgrade to paid tier if needed
3. Add rate limit handling (see below)

---

### 3. Insufficient OpenAI Account Balance

**Check:**
- Visit: https://platform.openai.com/account/billing
- Ensure you have available credits

**Fix:**
- Add payment method
- Add credits to account

---

## FIXING THE RELIABILITY PATH

### Current Behavior (BAD):
```
OpenAI fails → return mock → job status = "complete"
```

**Problem:** User sees "complete" evaluation with 72/100 score and has no idea it's fake.

---

### Target Behavior (GOOD):

#### Option A: Fail-Closed (Recommended)

```
OpenAI fails (429/5xx/timeout) →
  job status = "failed"
  persist last_error
  governance.warnings populated
  UI shows "Evaluation failed" with retry button
```

#### Option B: Mock Allowed But Loud

```
OpenAI fails →
  job status = "complete"
  governance.warnings = ["MOCK EVALUATION"]
  UI shows RED WARNING banner (now implemented)
  overall_score marked "placeholder"
```

**We currently use Option B.** The UI fix makes this acceptable for now, but Option A is better long-term.

---

## VERIFICATION CHECKLIST

After fixing OpenAI configuration, verify real AI is running:

### 1. Submit a test evaluation

```bash
# From the UI: submit a small manuscript (500-1000 words)
# Note the job_id
```

### 2. Check Vercel logs

```bash
vercel logs --prod
```

Look for:
```
[Processor] OpenAI response received (N chars)
[Processor] AI evaluation completed in Nms
```

**Not:**
```
[Processor] No OpenAI API key found, using mock evaluation
[Processor] OpenAI evaluation failed: 429
```

### 3. Query the artifact

```sql
SELECT
  content->'governance'->'warnings' AS warnings,
  content->'engine'->>'model' AS model
FROM evaluation_artifacts
WHERE job_id = 'YOUR_TEST_JOB_ID'
ORDER BY created_at DESC
LIMIT 1;
```

**PASS:**
- `warnings` is `null` or `[]`
- `model` is `gpt-4o-mini`

**FAIL:**
- `warnings` contains "MOCK EVALUATION"
- `model` is missing

---

## NEXT STEPS (After Real AI Confirmed Running)

Once you've verified real AI evaluations are working, the next phase is:

### Phase 0: Genre & Intent Resolution

Add a pre-flight analysis step that:
1. Detects narrative contract (fiction / memoir / nonfiction / hybrid)
2. Selects applicable criteria (disable mismatched ones)
3. Identifies actual tension engine (plot stakes vs thematic pressure vs experiential authenticity)

This prevents the system from applying fiction rubric (three-act structure, antagonist clarity) to memoir pieces.

**See:** `docs/GENRE_RESOLUTION_PHASE.md` (to be created after real AI confirmed)

---

## DEPLOYMENT STATUS

- ✅ UI fix deployed: governance warnings now visible
- ✅ Evaluation Provenance section added
- ⏳ OpenAI key verification pending
- ⏳ 429 retry logic pending
- ⏳ Fail-closed behavior pending
- ⏳ Genre Resolution Phase pending

---

## SUPPORT

If you're still seeing mock evaluations after:
1. Verifying `OPENAI_API_KEY` is set in Vercel Production
2. Confirming OpenAI account has credits
3. Redeploying to production

Then check:
- Vercel function logs for actual error messages
- OpenAI dashboard for API errors
- Run the Supabase diagnostic query above

The governance warnings will now always tell you the truth about whether AI ran.
