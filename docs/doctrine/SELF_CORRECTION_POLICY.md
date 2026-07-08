# Self-Correction Policy — Canonical Doctrine

> **Status:** Active  
> **Code authority:** `lib/evaluation/pipeline/selfCorrectionPolicy.ts`  
> **FIPOC registry:** `lib/evaluation/fipocRegistry.ts` — `KICK_MATRIX`  
> **Kickback mechanics:** `docs/SIPOC_SHORT_FORM_KICKBACK_ADDENDUM.md`  
> **Parent governance:** `docs/governance/AUTHORITY_CHAIN.md`

---

## Doctrine Statement

> **The system MUST self-correct.** Terminal failures caused by LLM terminology echo, pipeline label leakage, or scope violations in short-form output are system defects, not manuscript defects. The evaluation pipeline must detect, quarantine, and retry these failures without operator intervention.

This policy defines when a gate failure triggers a backward kick to re-synthesis versus an immediate terminal fail. It governs all present and future gate failure codes in the evaluation pipeline.

---

## Policy Authority

All gate failure policy is resolved through `getGateFailurePolicy(errorCode: string)` in `selfCorrectionPolicy.ts`.

```typescript
export interface GateFailurePolicy {
  max_retries: number;          // 0 = fail closed immediately; >0 = kick-eligible
  persist_quarantine_artifact: boolean; // write failing output to evaluation_artifacts before kick
  user_safe_message: string;    // safe to surface to author if needed
  severity: "low" | "medium" | "high" | "critical";
}
```

**Default (unknown code):**

```typescript
{ max_retries: 0, persist_quarantine_artifact: false, severity: "medium" }
```

All unregistered codes fail closed with zero retries. There is no optimistic default.

---

## Current Policy Table

| Error Code | max_retries | persist_quarantine | severity | Notes |
|---|---|---|---|---|
| `SHORT_FORM_LONGFORM_ARTIFACT_LEAK` | 1 | true | high | LLM echoed WAVE/Golden Spine/Phase 5 |
| `SHORT_FORM_INTERNAL_PROCESS_LEAK` | 1 | true | high | LLM echoed Pass N / Phase N labels |
| `SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM` | 1 | true | high | LLM made whole-manuscript scope claims |
| All other codes (handoff, rec-integrity, etc.) | 0 | false | medium | Fail closed — no retry |
| Unknown / unregistered code | 0 | false | medium | Fail closed — conservative default |

---

## Retry Context Builder

When `max_retries > 0` and budget is available, `buildRetryContext()` constructs the injection payload:

```typescript
{
  failed_gate: "SHORT_FORM_FINAL_SANITY_CHECK",
  stage_id: "S07_PASS3",
  violation_codes: ["SHORT_FORM_LONGFORM_ARTIFACT_LEAK"],
  affected_fields: ["overview", "criteria[*].rationale"],
  attempt_number: 1,
  retry_instruction: "Your previous output was rejected by SHORT_FORM_FINAL_SANITY_CHECK for: [violation summary]. Regenerate without these defects. ..."
}
```

The `retry_instruction` string is:
1. Written to `progress.short_form_retry_instruction` in the DB
2. Read by `processor.ts` on next Phase 3 execution
3. Forwarded as `_shortFormRetryInstruction` through `runPipeline` → `_runPass3` → `runPass3Synthesis`
4. Appended to the **effective system prompt** as a mandatory prohibition block

**Violation code cap:** At most 5 violation codes are described in the retry instruction to prevent prompt bloat.

---

## Violation Code Descriptions (User-Facing Language)

| Code | Description injected into retry instruction |
|---|---|
| `SHORT_FORM_LONGFORM_ARTIFACT_LEAK` | output contains long-form tier terms (WAVE / Golden Spine / Phase 5) — regenerate without these words |
| `SHORT_FORM_INTERNAL_PROCESS_LEAK` | output contains internal pipeline stage labels (Pass N / Phase N) — regenerate without pipeline terminology |
| `SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM` | output makes whole-manuscript scope claims not supported by the submitted excerpt — scope all claims to the submitted text only |
| `HANDOFF_SCAFFOLD_RESIDUE` | placeholder/template text found in output |
| `HANDOFF_INCOMPLETE_SENTENCE` | rationale or action lacks complete sentence structure |
| `HANDOFF_BROKEN_MODAL` | garbled modal phrase detected |
| `HANDOFF_GENERIC_LANGUAGE` | generic workshop advice without specific manuscript evidence |
| `HANDOFF_MISSING_EVIDENCE_ANCHOR` | recommendation lacks manuscript quotation reference |
| `REC_INTEGRITY_MALFORMED` | malformed recommendation text |
| `REC_INTEGRITY_GENERIC` | generic recommendation without specificity |
| `REC_INTEGRITY_NO_EVIDENCE` | recommendation lacks supporting evidence |

---

## Quarantine Artifact Contract

When `persist_quarantine_artifact: true` and a kick fires, a quarantine artifact is written **before** the kick DB update:

```typescript
{
  artifact_type: "quarantine_short_form_sanity_v1",
  job_id: "<job UUID>",
  content: {
    // Full EvaluationResultV2 that triggered the violation
    schema_version: "quarantine_short_form_sanity_v1",
    gate: "SHORT_FORM_FINAL_SANITY_CHECK",
    stage_id: "S07_PASS3",
    violation_codes: ["..."],
    attempt_number: 1,
    content: { ...evaluationResult }
  },
  created_at: "<ISO>"
}
```

Written to: `evaluation_artifacts` table.

**Important:** Quarantine artifact persistence is **best-effort**. A DB write failure on the quarantine artifact does not prevent the kick from proceeding. The kick itself is the primary recovery action; the quarantine is for admin inspection only.

---

## Budget Tracking

Kick attempts are tracked per-code in `progress.kick_attempts`:

```json
{
  "kick_attempts": {
    "SHORT_FORM_LONGFORM_ARTIFACT_LEAK": 1
  }
}
```

On each kick, the counter for the triggering code is incremented. On the next phase_3 execution:
- If `kick_attempts[code] >= max_retries`: budget exhausted → terminal fail
- If `kick_attempts[code] < max_retries`: kick still available

The counter persists across job re-execution because it is stored in the `progress` JSONB column, not recomputed from scratch.

---

## Operator Guidance

### When you see `SHORT_FORM_FINAL_SANITY_BLOCKED` in production:

This means:
1. The kick fired (attempt 1 used)
2. The retry also failed the sanity check, OR
3. The kick DB write itself failed (see `last_error` for "kick requeue failed")

**Check:**
- `evaluation_artifacts` for `artifact_type = 'quarantine_short_form_sanity_v1'` — inspect what the LLM produced
- `progress.kick_attempts` — confirms whether the kick fired before the terminal fail
- `progress.last_kick_failure_code` — which code triggered the kick
- `progress.last_kick_violation_summary` — the retry instruction that was injected

### When you see a job at `phase: "phase_3", status: "queued"` unexpectedly:

This may be a valid kick-back state. Check `progress.last_kick_failure_code` — if present, the job was kicked back for re-synthesis. This is correct behavior, not a stuck job.

### Admin retry after terminal fail:

If the system self-correction path fails and you want to force a retry:
1. Clear `progress.kick_attempts` (reset budget)
2. Reset job to `phase_3 / queued`
3. The retry instruction is still in `progress.short_form_retry_instruction` — it will be picked up again

---

## Governance Rules for Future Additions

1. Any new gate failure code that should be kick-eligible MUST be added to `getGateFailurePolicy()` with explicit `max_retries > 0` before the kick path in `persistEvaluationResultV2` will recognize it.
2. Any new kickable code MUST also be added to `KICK_MATRIX` in `fipocRegistry.ts`.
3. Any new kickable code MUST be added to `KICK_ELIGIBLE_FAILURE_CODES` in `processor.ts`.
4. Any new kick that injects a prompt instruction MUST have a `describeViolationCode()` case in `selfCorrectionPolicy.ts`.
5. Unit tests MUST cover: kick fires, budget tracks, budget exhaustion → terminal fail, DB failure fallthrough.

**Checklist for adding a new kickable code:**

- [ ] `getGateFailurePolicy()` case added with `max_retries > 0`
- [ ] `describeViolationCode()` case added
- [ ] `KICK_MATRIX` entry added in `fipocRegistry.ts`
- [ ] `KICK_ELIGIBLE_FAILURE_CODES` updated in `processor.ts`
- [ ] Unit test: kick fires
- [ ] Unit test: budget exhaustion → terminal fail
- [ ] This doc updated with new code in policy table
