# Root Cause & Fix Verification — Issue #384 / #289

**Status**: ✅ VERIFIED — Perplexity and ChatGPT diagnosis is correct

---

## Executive Summary

The production evaluation report (fd1fd073, May 10, 2026) demonstrates exactly what Perplexity and ChatGPT predicted:

- **132,991-word novel** → **~6,778 words analyzed** (5.1% coverage)
- **Both Pass 1 and Pass 2 read identical 40,000-char sampled window** (beginning/middle/end)
- **Identical input → predict identical output** (agree:13 convergence)
- **Chunks exist but are never consumed by evaluation passes**

The suggested fix is **correct and necessary**.

---

## Root Cause — Code Evidence

### 1. Chunks Exist But Are Ignored by Passes ❌

**In runPipeline.ts (line 79–80):**
```typescript
export interface RunPipelineOptions {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];  // ← EXISTS
  ...
}
```

**In runPass1.ts (line 143–160):**
```typescript
export interface RunPass1Options {
  scopeProfile?: SubmissionScopeProfile;
  manuscriptText: string;  // ← ONLY THIS
  workType: string;
  title: string;
  // NOTE: NO manuscriptChunks parameter
  ...
}
```

**In runPass2.ts (line 118–135):**
```typescript
export interface RunPass2Options {
  scopeProfile?: SubmissionScopeProfile;
  /**
   * The original manuscript text — the ONLY thing Pass 2 receives.
   * Pass 1 output must NEVER appear here.
   */
  manuscriptText: string;  // ← ONLY THIS
  workType: string;
  // NOTE: NO manuscriptChunks parameter
  ...
}
```

**Result**: `manuscriptChunks` parameter in runPipeline is never forwarded to Pass 1 or Pass 2. They only receive full `manuscriptText`.

---

### 2. Both Passes Call buildPromptInputWindow() on Same Text

**In pass1-craft.ts (line 83):**
```typescript
const promptWindow = buildPromptInputWindow(params.manuscriptText);
```

**In pass2-editorial.ts (line 112):**
```typescript
const promptWindow = buildPromptInputWindow(params.manuscriptText);
```

---

### 3. How buildPromptInputWindow() Creates Identical Sampling

**In promptInput.ts (line 32–45):**
```typescript
export function buildPromptInputWindow(text: string, maxChars?: number): string {
  const effectiveMaxChars = maxChars ?? getEvaluationRuntimeConfig().pass.inputCharBudget;
  const trimmed = text.trim();
  
  if (trimmed.length <= effectiveMaxChars) {
    return trimmed;  // Full text fits
  }

  const separatorBudget = OMITTED_SEPARATOR.length * 2;
  const segmentLen = Math.max(1500, Math.floor((effectiveMaxChars - separatorBudget) / 3));

  const start = trimmed.slice(0, segmentLen).trim();
  const middleStart = Math.max(0, Math.floor(trimmed.length / 2) - Math.floor(segmentLen / 2));
  const middle = trimmed.slice(middleStart, middleStart + segmentLen).trim();
  const end = trimmed.slice(Math.max(0, trimmed.length - segmentLen)).trim();

  return `${start}${OMITTED_SEPARATOR}${middle}${OMITTED_SEPARATOR}${end}`;
}
```

**For a 132,991-word (≈530k token) manuscript**:
- `effectiveMaxChars` ≈ 40,000 (hard budget)
- `segmentLen` ≈ ~12,000 chars each
- Returns: **beginning + OMITTED + middle + OMITTED + end**
- Total analyzed: **~36,000 chars of 530,000 = 5.1%**

**Both passes call this with identical parameters → identical window**.

---

### 4. Hardcoded "3 Chunks" Display Artifact

**In promptInput.ts (line 67):**
```typescript
export function derivePromptChunkCount(coverage: PromptCoverage): number {
  return coverage.truncated ? 3 : 1;
}
```

This returns **hardcoded 3** — not the actual count of chunks evaluated. The report says "Chunks Analyzed: 3" because:

1. Chunks may exist
2. But the function evaluates to "text is truncated → return 3"
3. Not "we analyzed 3 actual chunks"

The actual evaluation is: **1 shared 5% window, displayed as "3 chunks"**.

---

### 5. Both Passes Receive SAME manuscriptText Parameter

**In runPipeline.ts (line 573–580):**
```typescript
const pass1Promise = withTimeout(
  _runPass1({
    manuscriptText: opts.manuscriptText,  // ← SAME
    workType: opts.workType,
    title: opts.title,
    ...
  }),
  ...
);
```

**In runPipeline.ts (line 616–623):**
```typescript
const pass2Promise = withTimeout(
  _runPass2({
    manuscriptText: opts.manuscriptText,  // ← SAME
    workType: opts.workType,
    title: opts.title,
    ...
  }),
  ...
);
```

Both are called in parallel with identical `manuscriptText`.

---

## Why Divergence Failed (Failure Mode Analysis)

| Component | Pass 1 Input | Pass 2 Input | Result |
|-----------|-------------|-------------|--------|
| Source manuscript | 132,991 words | 132,991 words | ✓ Independent |
| Processed via | buildPrompt InputWindow | buildPrompt InputWindow | ✓ Same function |
| Budget | 40k chars | 40k chars | ✓ Same budget |
| Actual window | ~6,778 words (5%) | ~6,778 words (5%) | ❌ IDENTICAL INPUT |
| Expected scores | Independent | Independent | ❌ Actual: converged |
| Actual outcome | Craft focus | Editorial focus | ✓ But on same 5% |

**Why "agree:13"**: Two evaluators reading the same 6,778-word window will produce similar scores, regardless of their framing (craft vs. editorial). The independence model is **starved of divergence input** before reasoning even begins.

---

## Confirmed: The Suggested Fix Is Correct

### What Needs to Happen

**Current (broken):**
```
132k manuscript → buildPromptInputWindow() → Pass 1 sees 5%
                 → Pass 2 sees same 5%
                 → Pass 3 synthesizes from two identical inputs
                 → agree:13
```

**Required (fixed):**
```
132k manuscript → split into ~40–60 chunks
               → Pass 1 evaluates each chunk (60 chunk-native calls)
               → Pass 2 evaluates each chunk (60 chunk-native calls)
               → Aggregate chunk evidence across all criteria
               ↓
               → Pass 3 synthesizes from full-manuscript evidence
               ↓
               → Genuine divergence possible (different chunk perspectives)
               ↓
               → Manuscript-specific recommendations emerge
```

---

## Implementation Seams (Safe Entry Points)

### Seam 1: Pass 1 Chunk-Native Routing (Preferred)
- File: `lib/evaluation/pipeline/runPass1.ts`
- Change: Add `manuscriptChunks?: ManuscriptChunkEvidence[]` to `RunPass1Options`
- Logic: If chunks exist and manuscript is long-form, evaluate each chunk separately
- If chunk evaluation exists, aggregate criterion evidence before returning SinglePassOutput
- If no chunks or short-form, fall back to current `buildPromptInputWindow()` path

### Seam 2: Pass 2 Chunk-Native Routing (Parallel)
- File: `lib/evaluation/pipeline/runPass2.ts`
- Identical to Seam 1 — independent pass, same pattern

### Seam 3: Pass 3 Reducer Input (Downstream)
- File: `lib/evaluation/pipeline/runPass3Synthesis.ts`
- Change: Accept aggregated chunk evidence from Pass 1 and Pass 2
- No change to Pass 3 logic — it already reduces evidence

### Seam 4: Chunk Generation Tuning (Prerequisite)
- File: `lib/evaluation/pipeline/chunking/ensureChunksFromText.ts` (or equivalent)
- Change: Increase chunk count from 3 to ~40–60 for long-form
- Chunk size: ~5,000–8,000 words each (to fit within prompt window when evaluated individually)
- For 132k words: 132,000 / 6,000 ≈ 22 minimum; 40–60 for good granularity

---

## Why Token Budget Increase Alone Fails

**Objection**: "Just raise the 40k-char limit"

**Response**:
- 40k chars ≈ 10k tokens
- 133k-word novel ≈ 530k tokens
- Even raising to 200k chars (50k tokens) leaves 480k tokens unanalyzed
- No single LLM context window (GPT-4o: 128k) can fit the entire novel
- A sampled-window approach, even with a higher budget, is still sampling
- Two evaluators on a slightly-larger sample of the same truncated window will still converge

**The architectural problem is sampling itself, not the size of the sample.**

---

## Gold Standard: Production Evidence

**From fd1fd073 Report (May 10, 2026):**
```
Evaluation Provenance:
Pass 1 and Pass 2 analyzed a sampled prompt window 
(~6778 of 132991 words; 40000-char budget).

Overall Score: 53.00
Confidence: 70%  
Criteria certified at "Moderate Confidence" despite 5% coverage
```

**Correct interpretation**:
- ✅ System is working as architected
- ✅ Architecture is fundamentally limited
- ✅ 5% coverage explains generic output
- ✅ Divergence requires full-manuscript input

---

## Acceptance Criteria for Fix

When chunk-native Pass 1/2 is implemented:

- [ ] Long-form manuscript (>50k words) with chunks present: **do not call buildPromptInputWindow()** on full text
- [ ] Each chunk gets independent Pass 1 evaluation
- [ ] Each chunk gets independent Pass 2 evaluation
- [ ] Chunk evidence is aggregated by criterion before Pass 3
- [ ] Report shows actual coverage: "Pass 1/2 coverage: 95%+" (not 5%)
- [ ] Recommendations become manuscript-specific (not template-fill). Example should change from:
  - ❌ "Replace one expository exchange with two short turns plus an interruption beat"
  - ✅ "In Chapter 3, replace the river guardian dialogue (lines X–Y) with two rapid exchanges plus a pause beat, because..."
- [ ] Divergence emerges from chunk-level independence (agree:13 should become agree:0–5)

---

## Conclusion

**Perplexity and ChatGPT's diagnosis is empirically correct.**

The evaluation pipeline:
1. ✅ Has chunks available
2. ✅ Ignores them during Pass 1 and Pass 2
3. ✅ Both passes read identical 5% of the manuscript
4. ✅ Identical input produces identical output (agree:13)
5. ✅ The fix (chunk-native Pass 1/2) is architecturally sound

The production evidence requires no further diagnostic review. The issue is **known, classified, and ready for implementation** via Hybrid Path C (diagnostic PR merged, targeted implementation PR follows immediately).

---

## References

- Issue #384: Sampler starvation / Failure Mode 4
- Issue #289: Divergence collapse / Root cause analysis
- Issue #437: Diagnostic telemetry PR (confirms coverage)
- PR #436: Execution package (Section 2: map-reduce architecture)
- Production Job: fd1fd073-25e2-4b0b-a744-750cc04d74e1 (May 10, 2026)
