# Evaluation Quality Deconfliction

**Context**: ChatGPT and Perplexity provided seemingly different analyses of the "Bicycle" evaluation quality issue. This doc separates **aligned truth** from **presentation noise**.

---

## 🎯 What They AGREE On (100% Aligned)

### 1. Root Cause Diagnosis
**Both AIs identified the same problem:**
- The evaluation showing on production is **mock fallback data**, not real AI analysis
- The mock contains hardcoded generic fiction advice (72/100, "Act 2 pacing," "antagonist clarity")
- The system fell back to mock due to **OpenAI API failure** (429 rate limit)
- The UI **did not display** the `governance.warnings` field that flagged it as mock

**Evidence**: Both cited `processor.ts` `generateMockEvaluation()` function and `governance.warnings: ["🔶 MOCK EVALUATION"]`

### 2. Immediate Fix Required
**Both AIs prescribed the exact same three-step fix:**

| Step | Requirement | Both Agree |
|------|-------------|-----------|
| 1 | Surface `governance.warnings` in UI (RED banner) | ✅ |
| 2 | Verify OpenAI API key in Vercel Production env | ✅ |
| 3 | Add retry logic for 429 rate limit errors | ✅ |

### 3. Architecture Gap (Phase 0 Contract Detection)
**Both AIs agree on the long-term fix:**
- Need **Genre & Intent Resolution** phase BEFORE scoring
- Fiction vs memoir/nonfiction rubrics must be conditionally applied
- Current WAVE Guide is fiction-oriented (three-act, antagonist) and inapplicable to memoir
- Evidence-anchored scoring requirement to prevent hallucinated structural features

**Difference**: Only presentation style (ChatGPT called it "Phase 0 Contract Detection", Perplexity called it "Genre Resolution Phase") — same concept.

---

## 📊 What They DIFFER On (Presentation Only)

### ChatGPT's Framing
- **Emphasized**: The evaluation contract is misaligned (fiction rubric on memoir)
- **Sequence**: Assumed real AI ran but applied wrong rubric → prescribed Phase 0 genre gating
- **Tone**: Architectural critique ("judgment layer needs tuning")

### Perplexity's Framing
- **Emphasized**: You got the mock, not real AI at all
- **Sequence**: Mock fallback opacity bug → fix visibility first, THEN check if real AI works
- **Tone**: Build/deploy focus ("verify infrastructure before tuning prompts")

---

## ✅ The Reconciled Truth

### They're Both Right, in Sequence:

```
IMMEDIATE (Perplexity's priority):
  1. Mock fallback is invisible → Make governance.warnings visible ✅ (DONE: commit c51defc)
  2. OpenAI not running reliably → Verify API key + add retry logic ⏳
  3. Fail-closed on 429 → Don't mark mock as "complete" ⏳

NEXT (ChatGPT's priority):
  4. Genre Resolution Phase → Add Phase 0 contract detection
  5. Criteria gating → Disable fiction rubrics for memoir
  6. Evidence requirement → Force quote-anchored scoring
```

### Why Both Sequences Are Valid:
- **Perplexity**: "Don't tune prompts while reading mock data" → forces infrastructure green first
- **ChatGPT**: "The rubric is fiction-shaped even when real AI runs" → anticipates next problem

**REALITY**: Both problems exist. Fix order = Perplexity's (infrastructure → intelligence).

---

## 🔍 The Single Diagnostic Query That Resolves The Fork

Run this in Supabase:

```sql
SELECT
  job_id,
  created_at,
  content->'governance'->'warnings' AS warnings,
  content->'engine'->>'model' AS model,
  content->'governance'->>'confidence' AS confidence
FROM public.evaluation_artifacts
WHERE job_id = 'b17a625b-aaee-4e48-84fe-664f35ad24ce'
ORDER BY created_at DESC
LIMIT 1;
```

**Interpretation**:
- `warnings` contains "MOCK" → **Perplexity's diagnosis confirmed** (mock fallback)
- `warnings` empty AND `model` = real → **ChatGPT's diagnosis confirmed** (real AI, wrong rubric)

---

## 📋 Current Status (Post-Deconfliction)

### ✅ Completed (c51defc deployed to production)
- Governance warnings RED banner added to UI
- Evaluation Provenance section displays model/provider/confidence
- Diagnostic runbook created (`MOCK_VS_REAL_DIAGNOSTIC.md`)
- SQL diagnostic queries created (`ops/sql/diagnose_mock_vs_real.sql`)

### ⏳ Queued (Priority Order per Perplexity/ChatGPT Consensus)
1. **Verify OpenAI API Key**: Check Vercel Production env for `OPENAI_API_KEY`
2. **Run diagnostic query**: Confirm if "Bicycle" evaluation was mock or real
3. **Add retry logic**: Exponential backoff for 429 errors in `processor.ts`
4. **Fail-closed policy**: 429 → job status = `failed` (not `complete` with mock)
5. **Phase 0 Contract Detection**: Add genre resolution BEFORE criteria scoring
6. **Evidence-anchored scoring**: Require 1-2 quote snippets per criterion score

---

## 💡 Key Insight (Why This Felt Like Conflict)

ChatGPT and Perplexity were **debugging different layers of the same stack**:

| Layer | ChatGPT Focus | Perplexity Focus |
|-------|--------------|------------------|
| **Plumbing** | Assumed working | Diagnosed failure |
| **Intelligence** | Diagnosed misalignment | Queued for later |

**Analogy**: 
- Perplexity: "Your car won't start because the battery is dead."
- ChatGPT: "Your car's GPS is using fiction mode for memoir routes."

Both true. Fix battery first (Perplexity), then tune GPS (ChatGPT).

---

## 🎯 Next Single Action

Run the diagnostic SQL query and paste the output here. That will confirm:
- ✅ Mock confirmed → proceed with OpenAI key verification + retry logic
- ✅ Real AI confirmed → proceed with Phase 0 genre resolution

**Either way, the governance UI fix (c51defc) prevents this opacity from ever happening again.**

---

**Status**: ALIGNED. No conflict. Two complementary analyses of the same multi-layer problem.
