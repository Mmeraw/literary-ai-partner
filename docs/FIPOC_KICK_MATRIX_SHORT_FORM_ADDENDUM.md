# FIPOC Kick Matrix Addendum — Short-Form Self-Correction Codes

> **Status:** Active — shipped in commit 8ebbd66  
> **Registry source:** `lib/evaluation/fipocRegistry.ts` — `KICK_MATRIX` (line ~1922)  
> **Self-correction policy:** `lib/evaluation/pipeline/selfCorrectionPolicy.ts`  
> **Parent FIPOC:** `docs/SIPOC_EVALUATION_PROCESS.md`  
> **Full kickback mechanics:** `docs/SIPOC_SHORT_FORM_KICKBACK_ADDENDUM.md`

---

## Purpose

Documents the three `SHORT_FORM_*` entries added to `KICK_MATRIX` in `fipocRegistry.ts`. These entries make the short-form self-correction system **machine-checkable**: test suites and the FIPOC registry test can verify that every kickable code has a registered entry, a stated retry limit, and a documented recovery action.

---

## New KICK_MATRIX Entries

### `CRITERION_OPPORTUNITY_COVERAGE_INVALID` — contradictory recommendation coverage

| Field | Value |
|---|---|
| `dirtyDataDetectedAt` | `S07_TEMPLATE_COMPLETENESS_GATE` |
| `failure` | A scored criterion lacks governed opportunity coverage, or explicit recommendation status contradicts recommendation cardinality |
| `kickBackTo` | `S07_PASS3` |
| `redoAction` | Regenerate the affected criterion so recommendation cardinality, governed status, and required rationale agree |
| `retryLimit` | 1 |
| `ifRetryFails` | Fail closed; preserve diagnostics and block certification, persistence, and Revise projection |
| `failureCode` | `CRITERION_OPPORTUNITY_COVERAGE_INVALID` |
| `blocksAuthorExposure` | `true` |

This entry measures status/cardinality consistency rather than recommendation quantity. It does not require a minimum number of opportunities and does not authorize queue creation. Diagnostic confidence and evidence counts remain observational. One recommendation on another criterion cannot hide invalid coverage.

Generic `TEMPLATE_COMPLETENESS_GATE_FAILED` remains terminal because structural/template defects may require a code or contract correction rather than model re-synthesis.

### `SHORT_FORM_LONGFORM_ARTIFACT_LEAK`

| Field | Value |
|---|---|
| `dirtyDataDetectedAt` | `SHORT_FORM_FINAL_SANITY_CHECK` |
| `failure` | Short-form output contains long-form artifact terms (WAVE / Golden Spine / Phase 5) |
| `kickBackTo` | `S07_PASS3` |
| `redoAction` | Regenerate Pass 3 synthesis with explicit prohibition: never emit WAVE, Golden Spine, Phase 5, or long-form canon terminology in any user-facing text field |
| `retryLimit` | 1 |
| `ifRetryFails` | Fail closed; block author exposure |
| `failureCode` | `SHORT_FORM_LONGFORM_ARTIFACT_LEAK` |
| `blocksAuthorExposure` | `true` |

**Root cause:** LLM echoes long-form tier terms from training context or leaked template context even when the submission is short-form (< 25,000 words). The template sanitizer in `dreamTemplateLoader.ts` is upstream prevention; this kick is the downstream safety net.

**Detection regex:** `/\b(WAVE|Golden Spine|long-form canon|Phase 5)\b/i` applied to `collectUserFacingText(evaluationResult)`.

---

### `SHORT_FORM_INTERNAL_PROCESS_LEAK`

| Field | Value |
|---|---|
| `dirtyDataDetectedAt` | `SHORT_FORM_FINAL_SANITY_CHECK` |
| `failure` | Short-form output contains internal pipeline process labels (Pass N / Phase N / WAVE internals) |
| `kickBackTo` | `S07_PASS3` |
| `redoAction` | Regenerate Pass 3 synthesis with explicit prohibition: never reference internal pipeline stage names in user-facing text |
| `retryLimit` | 1 |
| `ifRetryFails` | Fail closed; block author exposure |
| `failureCode` | `SHORT_FORM_INTERNAL_PROCESS_LEAK` |
| `blocksAuthorExposure` | `true` |

**Root cause:** LLM leaks internal pipeline terminology (Pass 1, Pass 2, Phase 0, Phase 3B, WAVE internals, seed names, job pipeline) into author-facing rationale text.

**Detection regex:** `INTERNAL_PROCESS_PATTERNS = /\b(Pass\s*[1234]|Phase\s*3B|Phase\s*[012](?:[._a-z]|\s|$)|WAVE\s+internals|seed\s+names|job\s+pipeline|pipeline\s+internals)\b/i`

Note: `"PHASE"` alone is intentionally excluded — it is common editorial prose ("each phase of the narrative arc"). Only explicit pipeline-stage identifiers are blocked.

---

### `SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM`

| Field | Value |
|---|---|
| `dirtyDataDetectedAt` | `SHORT_FORM_FINAL_SANITY_CHECK` |
| `failure` | Short-form output makes whole-manuscript claims not supportable from submitted excerpt |
| `kickBackTo` | `S07_PASS3` |
| `redoAction` | Regenerate Pass 3 synthesis scoped strictly to submitted text; remove whole-manuscript scope claims |
| `retryLimit` | 1 |
| `ifRetryFails` | Fail closed; block author exposure |
| `failureCode` | `SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM` |
| `blocksAuthorExposure` | `true` |

**Root cause:** LLM makes claims about "the whole novel", "the full manuscript", "market ready", or the ending of a book when only an excerpt (< 25,000 words) was submitted. These claims are epistemically unsupportable.

**Detection regex:** `WHOLE_MANUSCRIPT_PATTERNS = /\b(full[- ]novel|whole[- ]book|whole[- ]manuscript|entire manuscript|complete manuscript|ending payoff|whole-book arc|market ready)\b/i`

---

## Self-Correction Policy for All Three Codes

Source: `lib/evaluation/pipeline/selfCorrectionPolicy.ts` — `getGateFailurePolicy(errorCode)`

```typescript
{
  max_retries: 1,
  persist_quarantine_artifact: true,
  user_safe_message: "We found quality issues in the initial evaluation and are correcting them automatically.",
  severity: "high"
}
```

| Policy field | Value | Meaning |
|---|---|---|
| `max_retries` | 1 | One kick allowed per violation code |
| `persist_quarantine_artifact` | `true` | Failing output written to `evaluation_artifacts` before kick |
| `severity` | `"high"` | Surfaces in admin diagnostics as high-severity defect |
| `user_safe_message` | Quality correction message | Safe to surface in author-facing error if needed |

---

## Non-Kickable SHORT_FORM Codes

The following codes are in `shortFormFinalSanityCheck.ts` but are **not** in KICK_MATRIX (no retry path):

| Code | Verdict | Why not kickable |
|---|---|---|
| `SHORT_FORM_MISSING_ANCHORS` | BLOCK | Structural evidence absence — re-synthesis unlikely to add anchors that don't exist in the manuscript extract |
| `SHORT_FORM_FAKE_CERTAINTY` | BLOCK | High-confidence claim without evidence — requires different root cause fix |
| `SHORT_FORM_PLACEHOLDER_SCORE_CLUSTER` | BLOCK | All-zero cluster — indicates systemic scoring failure, not terminology echo |
| `SHORT_FORM_SCORE_SUMMARY_CONTRADICTION` | BLOCK | Structural contradiction — fail closed without retry |

For these codes: the gate fires, `blocking=true`, no kick path → terminal fail with `SHORT_FORM_FINAL_SANITY_BLOCKED`.

---

## PROCESSOR.TS Integration: `KICK_ELIGIBLE_FAILURE_CODES`

The three kickable codes are also registered in `processor.ts`:

```typescript
const KICK_ELIGIBLE_FAILURE_CODES = new Set<string>([
  // ... existing codes ...
  'SHORT_FORM_LONGFORM_ARTIFACT_LEAK',
  'SHORT_FORM_INTERNAL_PROCESS_LEAK',
  'SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM',
]);
```

This set governs:
- `isKickEligibleFailureCode(code)` — returns `true` for these codes
- `getKickBudgetForCode(code)` — returns `1` for these codes
- Terminal-fail override: `isTerminalFailure(code)` returns `false` when code is in this set

---

## Integrity Invariant

> If `SHORT_FORM_FINAL_SANITY_CHECK.blocking = true` and all kickable codes have exhausted their budget, the job MUST fail closed with `SHORT_FORM_FINAL_SANITY_BLOCKED`. No silent pass-through is permitted under any circumstance.

This invariant is enforced by the test: `persistEvaluationResultV2.short-form-kickback.test.ts` — "budget exhaustion → terminal fail" case.

---

## Relation to Prior KICK_MATRIX

These three entries extend the existing `KICK_MATRIX` in `fipocRegistry.ts`. They do not modify any existing entry. The matrix as of 2026-07-08 contains:

- All pre-existing handoff/ledger kick entries (unchanged)
- `SHORT_FORM_LONGFORM_ARTIFACT_LEAK` (new)
- `SHORT_FORM_INTERNAL_PROCESS_LEAK` (new)
- `SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM` (new)

The registry test at `__tests__/lib/evaluation/fipocRegistry.test.ts` enforces that every KICK_MATRIX entry has a non-empty `failureCode`, a `kickBackTo` stage, and a `retryLimit ≥ 0`.
