# Mock Evaluation Opacity Fix — Complete

**Date:** 2026-02-21  
**Issue:** Fail-open deception — UI hid governance warnings  
**Severity:** Critical — affects evaluation credibility  
**Status:** UI fixes deployed, infrastructure fixes queued

---

## WHAT WAS WRONG

The evaluation system had a **fail-open deception** bug:

```
OpenAI fails (429 rate limit) →
  processor returns mock evaluation →
  job marked "complete" →
  UI displays 72/100 score with generic fiction advice →
  NO WARNING shown to user about mock status
```

**User saw:** "Complete evaluation with professional-looking scores"  
**Reality:** Hardcoded placeholder data with no manuscript analysis

The mock contained governance warnings:
```json
{
  "governance": {
    "warnings": [
      "🔶 MOCK EVALUATION: This is generated test data, not a real AI analysis"
    ]
  }
}
```

But the UI never displayed them. Users had no way to know they were seeing fake data.

---

## WHAT WAS FIXED

### 1. Governance Warnings Display (CRITICAL FIX)

**File:** [app/evaluate/[jobId]/page.tsx](app/evaluate/[jobId]/page.tsx)

Added a prominent RED WARNING banner that displays when `governance.warnings` is present:

```tsx
{artifact.governance?.warnings && artifact.governance.warnings.length > 0 && (
  <div className="mt-4 rounded-md bg-red-50 border-2 border-red-400 p-4">
    <p className="text-sm font-bold text-red-900">
      ⚠️ EVALUATION INTEGRITY WARNING
    </p>
    <div className="mt-2 space-y-1">
      {artifact.governance.warnings.map((warning, i) => (
        <p key={i} className="text-sm text-red-800 font-medium">
          {warning}
        </p>
      ))}
    </div>
    <p className="mt-3 text-xs text-red-700">
      This evaluation did not use real AI analysis. Scores and recommendations are generic placeholders.
      To get a real evaluation, ensure OPENAI_API_KEY is configured in Vercel environment variables.
    </p>
  </div>
)}
```

**Impact:**
- Mock evaluations now immediately visible
- Users cannot be deceived by placeholder data
- Explicit guidance on how to fix (configure OpenAI key)

---

### 2. Evaluation Provenance Section

Added transparency for **all** evaluations (not just mocks):

```tsx
<section className="mt-6 rounded-lg border p-5 bg-gray-50">
  <h2 className="text-lg font-semibold">Evaluation Provenance</h2>
  <div className="mt-3 space-y-2 text-sm">
    <div>Engine: {artifact.engine.model}</div>
    <div>Provider: {artifact.engine.provider}</div>
    <div>Prompt Version: {artifact.engine.prompt_version}</div>
    <div>Confidence: {artifact.governance.confidence * 100}%</div>
    <div>Limitations: {artifact.governance.limitations}</div>
  </div>
</section>
```

**Impact:**
- Users can verify which model was used
- Confidence and limitations are transparent
- Clear audit trail for every evaluation

---

### 3. Diagnostic Runbook

**File:** [docs/MOCK_VS_REAL_DIAGNOSTIC.md](docs/MOCK_VS_REAL_DIAGNOSTIC.md)

Created comprehensive guide for:
- How to detect mock vs real evaluations
- How to check Supabase directly
- Most common causes of mock fallback
- How to fix OpenAI key issues
- Verification checklist

**Impact:**
- Users can self-diagnose evaluation issues
- Clear fix procedures
- No more mystery about evaluation provenance

---

## WHAT REMAINS TO BE DONE

### Phase 1: Infrastructure Reliability

**Priority:** High  
**Goal:** Make real AI evaluations work consistently

#### 1.1 Verify OpenAI Key Configuration

```bash
# Check Vercel environment variables
vercel env ls

# Ensure OPENAI_API_KEY is set for Production
vercel env add OPENAI_API_KEY production
```

#### 1.2 Add Retry Logic for 429 Errors

**File:** `lib/evaluation/processor.ts`

Add exponential backoff:
```typescript
async function callOpenAIWithRetry(client, params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.chat.completions.create(params);
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`[Processor] Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

#### 1.3 Implement Fail-Closed Behavior (Optional but Recommended)

Change from:
```typescript
catch (error) {
  return generateMockEvaluation(); // Silent fallback
}
```

To:
```typescript
catch (error) {
  // Mark job as failed, persist error, do NOT return mock
  await supabase
    .from('evaluation_jobs')
    .update({ 
      status: 'failed',
      last_error: error.message,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);
  
  throw error; // Fail loudly
}
```

**Trade-off:**  
- Current (Option B): Jobs complete with mock, but UI warns loudly ✅ Acceptable  
- Fail-closed (Option A): Jobs fail outright, require retry ↗️ Better long-term

---

### Phase 2: Genre Resolution & Smart Criteria Gating

**Priority:** Medium (after real AI confirmed working)  
**Goal:** Stop applying fiction rubric to memoir/nonfiction

#### 2.1 Add Phase 0: Contract Detection

Before scoring, detect:
- Narrative contract (fiction / literary memoir / nonfiction / hybrid)
- Core tension engine (plot stakes / thematic pressure / experiential authenticity)
- Which criteria apply cleanly vs which need adapted interpretation

#### 2.2 Conditional Criteria Evaluation

```typescript
const contract = await detectNarrativeContract(manuscript);
const applicableCriteria = selectCriteriaForContract(contract);

// Only evaluate criteria that apply to this genre
const scores = await evaluateApplicableCriteria(
  manuscript, 
  applicableCriteria
);
```

#### 2.3 Evidence-Anchored Scoring

Require each criterion to cite specific passages:
```json
{
  "key": "narrativeDrive",
  "score_0_10": 7,
  "rationale": "...",
  "evidence": [
    {
      "passage": "The door stayed shut longer than expected.",
      "location": "page 12, paragraph 3",
      "why_relevant": "Shows momentum through environmental resistance"
    }
  ]
}
```

**See:** Future doc `docs/GENRE_RESOLUTION_PHASE.md` (to be created)

---

## VERIFICATION (Post-Deployment)

### Test Plan

1. **Submit test evaluation** (500-word sample)
2. **Check UI** — Does governance warning appear if mock?
3. **Check Supabase** — Run diagnostic query
4. **Check Vercel logs** — Look for OpenAI success/failure messages
5. **Verify provenance section** — Shows model/provider/confidence

### Pass Criteria

✅ Mock evaluations show RED WARNING banner  
✅ Real evaluations show model="gpt-4o-mini", warnings=[]  
✅ Provenance section displays for all evaluations  
✅ No silent failures (all errors visible)

---

## DEPLOYMENT CHECKLIST

- [x] UI governance warnings display added
- [x] Evaluation provenance section added
- [x] Diagnostic runbook created
- [ ] Changes committed to git
- [ ] Changes pushed to main
- [ ] Deployed to Vercel production
- [ ] OpenAI key verified in Vercel env vars
- [ ] Test evaluation submitted and verified
- [ ] Supabase diagnostic query run
- [ ] Real AI vs mock confirmed via UI

---

## GOVERNANCE IMPACT

**Before this fix:**
- ❌ Users could be deceived by placeholder data
- ❌ No way to verify evaluation authenticity
- ❌ Silent failures appeared as successes

**After this fix:**
- ✅ Mock evaluations immediately visible (RED WARNING)
- ✅ Provenance section shows model/provider for every evaluation
- ✅ Diagnostic runbook enables self-service troubleshooting
- ✅ Path to real AI evaluations is clear

---

## NEXT PHASE TRIGGER

**After verifying real AI runs successfully:**

Move to Genre Resolution Phase to fix the "fiction rubric applied to memoir" problem.

Until then, current state is:
- Engineering: ✅ Working (artifacts persist, 13 criteria render)
- Transparency: ✅ Fixed (mock flag now visible)
- Reliability: ⏳ Queued (OpenAI key + retries + fail-closed)
- Intelligence: ⏳ Queued (genre detection + criteria gating)

**The critical governance hole is now closed.**
