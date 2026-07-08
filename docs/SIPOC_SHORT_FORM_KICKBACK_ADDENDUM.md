# SIPOC/FIPOC Short-Form Evaluation Kickback Addendum

> **Status:** Active — shipped in commit 8ebbd66, tests green 22/22 as of 2026-07-08  
> **Parent SIPOC:** `docs/SIPOC_EVALUATION_PROCESS.md`  
> **FIPOC registry:** `lib/evaluation/fipocRegistry.ts` — `KICK_MATRIX` entries at `SHORT_FORM_FINAL_SANITY_CHECK`  
> **Self-correction policy:** `lib/evaluation/pipeline/selfCorrectionPolicy.ts`  
> **Authority chain:** `docs/governance/AUTHORITY_CHAIN.md`

---

## Purpose

This addendum records the **SHORT_FORM_LONGFORM_ARTIFACT_LEAK self-correction system** introduced to prevent terminal failures when the LLM echoes long-form tier terminology into a short-form evaluation output.

Before this fix, a short-form job failing the sanity check would hard-fail with `SHORT_FORM_FINAL_SANITY_BLOCKED` — evaluation data was present in the DB but could never be published to the author. The system had no self-recovery path.

After this fix, the system detects the violation, kicks the job backward to Phase 3 synthesis with an explicit prohibition injected into the LLM system prompt, and retries once. If the retry also fails, it falls through to terminal fail-closed behavior.

> **Doctrine:** The system MUST self-correct. Short-form terminal failures caused by LLM terminology echo are a system defect, not an author manuscript defect.

---

## New Process Stage: `SHORT_FORM_FINAL_SANITY_CHECK`

This stage runs inside `persistEvaluationResultV2` after Pass 3 synthesis completes, before any evaluation artifact is written to `evaluation_artifacts`.

### Stage Identity

| Field | Value |
|---|---|
| Stage ID | `SHORT_FORM_FINAL_SANITY_CHECK` |
| Phase | Phase 3 (persist-time gate, post-synthesis) |
| Gate activation | `manuscript_word_count < 25,000` only |
| Code surface | `lib/evaluation/pipeline/shortFormFinalSanityCheck.ts` |
| Caller | `lib/evaluation/persistEvaluationResultV2.ts` |
| Active state | `active` |

### Inputs

| Artifact | Source | Required Fields |
|---|---|---|
| `EvaluationResultV2` | `runPass3Synthesis` output | `criteria[*].rationale`, `overview.verdict`, `overview.one_paragraph_summary`, `governance.transparency.short_form_final_sanity_check` |
| `progressSnapshot.manuscript_word_count` | Job progress state | Integer word count |
| `progressSnapshot.kick_attempts` | Job progress state | Map of `{ [violationCode]: attemptCount }` — initialized empty, written on each kick |

### Process: Violation Detection

The gate scans all user-facing text fields (overview + criterion rationales) against seven deterministic regex checks:

| Violation Code | Pattern | Verdict |
|---|---|---|
| `SHORT_FORM_LONGFORM_ARTIFACT_LEAK` | `/\b(WAVE\|Golden Spine\|long-form canon\|Phase 5)\b/i` | **BLOCK** |
| `SHORT_FORM_INTERNAL_PROCESS_LEAK` | Pass N / Phase N / WAVE internals / pipeline labels | **BLOCK** |
| `SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM` | full-novel / whole-book / entire manuscript / market ready | **BLOCK** |
| `SHORT_FORM_MISSING_ANCHORS` | Scored criterion lacks evidence snippet ≥12 chars | **BLOCK** |
| `SHORT_FORM_FAKE_CERTAINTY` | High-confidence criterion lacks anchor | **BLOCK** |
| `SHORT_FORM_PLACEHOLDER_SCORE_CLUSTER` | ≥10 scored criteria all score 0 | **BLOCK** |
| `SHORT_FORM_SCORE_SUMMARY_CONTRADICTION` | ≥7 non-scorable criteria + "market ready" in text | **BLOCK** |
| `SHORT_FORM_SANITY_PASS` | No violations detected | PASS |

### Outputs

| Artifact | Destination | Schema |
|---|---|---|
| `short_form_final_sanity_check_v1` | Written into `evaluationResult.governance.transparency.short_form_final_sanity_check` | `{ schema_version, verdict: 'PASS'\|'WARN'\|'BLOCK', codes: string[], blocking: boolean, public_safe_reason, internal_reason }` |

### Input Metrics

| Metric | Where read | Purpose |
|---|---|---|
| `manuscript_word_count` | `progressSnapshot.manuscript_word_count` | Gate activation threshold (< 25,000) |
| `kick_attempts[code]` | `progressSnapshot.kick_attempts` | Budget tracking — prevents infinite retry loops |
| `violationCodes` | `evaluationResult.governance.transparency.short_form_final_sanity_check.codes` | Determines kick eligibility |

### Output Metrics

| Metric | Written to | Purpose |
|---|---|---|
| `kick_attempts[code]` | `progress.kick_attempts` on job update | Increment per code per kick |
| `last_kick_at` | `progress.last_kick_at` | ISO timestamp of most recent kick |
| `last_kick_failure_code` | `progress.last_kick_failure_code` | Which code triggered the kick |
| `last_kick_violation_summary` | `progress.last_kick_violation_summary` | Human-readable retry instruction |
| `short_form_retry_instruction` | `progress.short_form_retry_instruction` | Propagated into Pass 3 system prompt on retry |

---

## FIPOC Kick Path: Backward Kick to S07_PASS3

### Decision Logic in `persistEvaluationResultV2`

```
shortFormReadiness.blockingReason?
  ├─ YES → read violationCodes from evaluationResult.governance.transparency.short_form_final_sanity_check.codes
  │         filter kickableCodes: getGateFailurePolicy(code).max_retries > 0
  │         ├─ kickableCodes.length > 0
  │         │   find codeWithBudget: kick_attempts[code] ?? 0 < 1
  │         │   ├─ budget available → BUILD quarantine artifact → PERSIST quarantine → UPDATE job: re-queue phase_3 → RETURN kick result (persisted: false)
  │         │   └─ budget exhausted → FALL THROUGH to terminal fail
  │         └─ kickableCodes.length == 0 (codes=[] or all non-kickable) → FALL THROUGH to terminal fail (SHORT_FORM_FINAL_SANITY_BLOCKED)
  └─ NO → proceed to normal evaluation artifact persistence
```

### Kick-Eligible Codes (max_retries: 1)

| Code | Kick? | Budget |
|---|---|---|
| `SHORT_FORM_LONGFORM_ARTIFACT_LEAK` | YES | 1 attempt |
| `SHORT_FORM_INTERNAL_PROCESS_LEAK` | YES | 1 attempt |
| `SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM` | YES | 1 attempt |
| `SHORT_FORM_MISSING_ANCHORS` | NO (non-kickable) | 0 |
| `SHORT_FORM_FAKE_CERTAINTY` | NO (non-kickable) | 0 |
| `SHORT_FORM_PLACEHOLDER_SCORE_CLUSTER` | NO (non-kickable) | 0 |
| `SHORT_FORM_SCORE_SUMMARY_CONTRADICTION` | NO (non-kickable) | 0 |

### Quarantine Artifact

When a kick fires, a quarantine artifact is written to `evaluation_artifacts` (best-effort, does not block the kick):

| Field | Value |
|---|---|
| `artifact_type` | `quarantine_short_form_sanity_v1` |
| `content` | Full `EvaluationResultV2` that triggered the violation |
| `job_id` | Failing job ID |

Purpose: admin forensic inspection of the failing LLM output without blocking re-synthesis.

### Job State Written on Kick

```json
{
  "status": "queued",
  "phase": "phase_3",
  "phase_status": "queued",
  "claimed_by": null,
  "claimed_at": null,
  "lease_token": null,
  "failure_code": null,
  "last_error": null,
  "progress": {
    "phase": "phase_3",
    "phase_status": "queued",
    "message": "Backward kick: re-queued for synthesis after <code>",
    "kick_attempts": { "<code>": <n> },
    "last_kick_at": "<ISO>",
    "last_kick_failure_code": "<code>",
    "last_kick_violation_summary": "<retry_instruction>",
    "short_form_retry_instruction": "<retry_instruction>"
  }
}
```

### Return Value on Kick

```typescript
{
  persisted: false,
  gateDecision: "FAIL",
  validationResult: "FAIL",
  confidence: { quarantinedOutput: true, ... },
  reason: "[ShortFormSanityKick] kicked back to phase_3 for re-synthesis (<code>)"
}
```

---

## Retry Instruction Propagation Chain

The kick writes `short_form_retry_instruction` into `progress`. On the next Phase 3 execution, the instruction propagates through the full pipeline:

```
progress.short_form_retry_instruction
    ↓ read by
processor.ts (line ~6670)
    ↓ passed as
_shortFormRetryInstruction → runPipeline(opts)
    ↓ forwarded as
runPipeline → _runPass3 → runPass3Synthesis(opts.shortFormRetryInstruction)
    ↓ injected as
## SHORT-FORM RE-SYNTHESIS PROHIBITION (FIPOC KICK-BACK — MANDATORY)
<retry_instruction>

This is a retry after a SHORT_FORM_LONGFORM_ARTIFACT_LEAK violation. The prohibition
above is ABSOLUTE. Any output containing the flagged long-form terms will be rejected
again. Produce a clean short-form evaluation only.
```

This injection appends to the **effective system prompt** for Pass 3, not the user prompt.

### File Chain

| File | Change | Purpose |
|---|---|---|
| `lib/evaluation/dreamTemplateLoader.ts` | Sanitize `buildCompactTemplateBlock("short_form")`: WAVE→[ADVANCED-TIER], Golden Spine→[SPINE-FEATURE], Phase 5→[RELEASE-GATE] | Prevent source contamination before LLM ever sees template |
| `lib/evaluation/fipocRegistry.ts` | Add 3 KICK_MATRIX entries at `SHORT_FORM_FINAL_SANITY_CHECK` | Machine-checkable registry authority |
| `lib/evaluation/pipeline/selfCorrectionPolicy.ts` | Add SHORT_FORM_* to `getGateFailurePolicy` + `describeViolationCode` | Policy authority: max_retries=1, persist_quarantine=true |
| `lib/evaluation/persistEvaluationResultV2.ts` | Replace terminal fail path with kick-back block | Runtime: kick fires, quarantine written, job re-queued |
| `lib/evaluation/processor.ts` | Add SHORT_FORM_* to `KICK_ELIGIBLE_FAILURE_CODES`; propagate `_shortFormRetryInstruction` | Processor recognizes kick codes; passes instruction downstream |
| `lib/evaluation/pipeline/runPipeline.ts` | Accept `_shortFormRetryInstruction?: string` in `RunPipelineOptions` | Forwards to Pass 3 |
| `lib/evaluation/pipeline/runPass3Synthesis.ts` | Accept `shortFormRetryInstruction?: string`; inject as system prompt appendix | LLM receives prohibition |

---

## Template Sanitization (Upstream Prevention)

`buildCompactTemplateBlock("short_form")` in `dreamTemplateLoader.ts` sanitizes the injected template **before** the LLM ever sees it:

| Term in template | Replaced with |
|---|---|
| `WAVE` | `[ADVANCED-TIER]` |
| `Golden Spine` | `[SPINE-FEATURE]` |
| `Phase 5` | `[RELEASE-GATE]` |
| `long-form canon` | `[LONG-FORM-FEATURE]` |

This is upstream prevention. The FIPOC kickback is the downstream safety net for cases where the LLM re-introduces terms from training context without template injection.

---

## Timing and SLA

| Stage | Target | Maximum | Acceptance Criteria |
|---|---|---|---|
| SHORT_FORM_FINAL_SANITY_CHECK | < 100ms | 500ms | Deterministic regex scan complete; verdict written to governance block |
| Full short-form job (including possible 1 kick + retry) | 3–8 min | 15 min (`SHORT_FORM_GLOBAL_SLA_MS = 15 * 60_000`) | Evaluation artifact persisted or terminal fail confirmed |

Kick does not extend the global SLA clock; the retry Phase 3 execution runs within the same 15-minute budget.

---

## Failure Modes and Fail-Closed Rules

| Scenario | Behavior |
|---|---|
| Violation codes detected, kick budget available | Kick to Phase 3, quarantine artifact written |
| Kick DB write fails | Fall through to terminal fail (`SHORT_FORM_FINAL_SANITY_BLOCKED`) — no silent pass |
| Budget exhausted (1 kick already used per code) | Terminal fail (`SHORT_FORM_FINAL_SANITY_BLOCKED`) |
| `violationCodes` array empty but `blocking=true` | Non-kickable path — skip kick, terminal fail immediately |
| Non-kickable code (MISSING_ANCHORS, FAKE_CERTAINTY, etc.) | Terminal fail — no kick |
| Retry also fails sanity check | Budget consumed → terminal fail |
| `manuscript_word_count >= 25,000` | Gate bypassed — long-form path governs |

> **Invariant:** A short-form evaluation MUST NOT be published if `short_form_final_sanity_check.blocking = true` and kick budget is exhausted. No silent pass-through is permitted.

---

## Test Coverage

| Test file | Tests | What it covers |
|---|---|---|
| `__tests__/lib/evaluation/persistEvaluationResultV2.short-form-kickback.test.ts` | 9 | Kick fires, retry_instruction present, kick_attempts counter, quarantine artifact, budget exhaustion, INTERNAL_PROCESS_LEAK kickable, invariant no-failed-write, DB failure fallthrough, long-form bypass |
| `__tests__/lib/evaluation/persistEvaluationResultV2.short-form-empty-codes.test.ts` | 1 | Defensive: `blocking=true` + `codes=[]` → skip kick → terminal fail immediately |
| `__tests__/smoke/short-form-kickback.submit-smoke.test.ts` | 1 | Mocked POST /api/jobs submission → word_count < 25k → persistence with WAVE-leaked artifact → confirms phase_3 requeue |
| `__tests__/lib/evaluation/persistEvaluationResultV2.boundary-gate.test.ts` | 10 | Upstream boundary gates including long-form bypass regression |

**All 22 tests green as of 2026-07-08 (commits 8ebbd66 through 6f52763).**

---

## Regression Gate

The boundary-gate suite (`persistEvaluationResultV2.boundary-gate.test.ts`) must remain fully green after any change to:

- `persistEvaluationResultV2.ts`
- `shortFormFinalSanityCheck.ts`
- `selfCorrectionPolicy.ts`
- `fipocRegistry.ts`
- `processor.ts` (KICK_ELIGIBLE_FAILURE_CODES)
- `runPipeline.ts` (_shortFormRetryInstruction propagation)
- `runPass3Synthesis.ts` (injection block)

Run: `./node_modules/.bin/jest "boundary-gate|short-form-kickback|short-form-empty-codes" --no-coverage --forceExit`

Expected: `4/4 suites, 22/22 tests`.

---

## Relation to Existing SIPOC Docs

This addendum is a **normative extension** of `docs/SIPOC_EVALUATION_PROCESS.md`.

It adds a new persist-time stage not present in the original SIPOC. Until the parent SIPOC is rewritten in a consolidated edit, this addendum is authoritative for:

- `SHORT_FORM_FINAL_SANITY_CHECK` stage definition
- All `SHORT_FORM_*` violation codes
- The kickback path and retry instruction propagation chain
- The quarantine artifact contract
- The template sanitization rule for `buildCompactTemplateBlock("short_form")`

Where this document conflicts with earlier SIPOC text regarding short-form terminal behavior, **this addendum governs**.
