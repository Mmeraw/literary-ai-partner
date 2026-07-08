# Canonical Runtime Operations (Authoritative)

## Non-Negotiable Runtime Doctrine

No RevisionGrade evaluation may be persisted or shown unless it is produced by the canonical pipeline (`runPipeline`), synthesized through governed passes, and written via canonical processor flow.

## Canonical Runtime Spine

1. Entrypoints
   - `app/api/workers/process-evaluations/route.ts`
   - `app/api/jobs/[jobId]/run-phase2/route.ts`
   - `app/api/admin/jobs/[jobId]/run-phase2/route.ts`
2. Processor adapter
   - `lib/evaluation/processor.ts`
   - Responsibilities only: load job/input, call `runPipeline`, persist canonical artifact, write status/progress/error state.
3. Sovereign evaluator engine
   - `lib/evaluation/pipeline/runPipeline.ts`
4. Canonical artifact output
   - `evaluation_artifacts` row with `artifact_type="evaluation_result_v1"`

## Quarantined Legacy Paths (Non-Authoritative)

- `workers/phase2Worker.ts`
- `workers/phase2Evaluation.ts`
- `lib/jobs/phase2.ts`

These are legacy compatibility paths only.

### Kill-switch semantics

- Legacy worker path requires: `ENABLE_LEGACY_PHASE2_WORKER=1`
- Legacy lib/jobs runtime path requires: `ENABLE_LEGACY_PHASE2_RUNTIME=1`

If unset, these paths fail loudly by design.

## Operator Rules

1. Do not run or document legacy Phase 2 executors as normal runtime.
2. Treat legacy execution as migration-only/quarantine behavior.
3. Any production issue triage must begin from canonical entrypoints above.
4. If docs conflict with code, this file and architecture invariants are authoritative.

## Evaluation Reliability Minimum (Policy)

- Canonical evaluation fail-closed gate is enforced in `lib/evaluation/processor.ts` before `runPipeline`.
- Runtime policy minimum is **200 words** (default: `EVAL_MIN_MANUSCRIPT_WORDS=200`).
- Env control precedence:
   1. `EVAL_MIN_MANUSCRIPT_WORDS` (primary, default: 200)
   2. `EVAL_MIN_MANUSCRIPT_CHARS` (temporary backward-compatibility fallback)

## Phase 0 Timing Canon

- Phase 0 is **authority binding** (load precomputed calibration baseline, verify checksum, select route). No LLM calls.
- Phase 0 target: **12–15 seconds**, hard limit: **20 seconds**.
- Phase 0 output: `phase0_authority_proof_v1`.
- Phase 0.5A (Story Seeds): `story_map_seed_v1` + `evaluation_seed_v1` — minimum 500 words combined seed output.
- `full_context_story_ledger_v1` is Phase 0.5A (Enhanced Ledger) — separate stage, separate SLA, NOT counted against Phase 0 timing.
- Phase 0.5A SLA: scope-dependent, hard limit 180 seconds.

## Worker Runtime Guardrails (Canonical)

- Worker route runtime budget: `app/api/workers/process-evaluations/route.ts` exports `maxDuration = 800`.
- Per-pass timeout cap: `EVAL_PASS_TIMEOUT_MS` is clamped to `<= 800000` ms in `lib/evaluation/processor.ts`.
- OpenAI timeout cap: `EVAL_OPENAI_TIMEOUT_MS` is clamped to `<= 800000` ms in processor and pass runners.
- Queue batch-size safety guard: `EVAL_WORKER_BATCH_SIZE` is clamped to `1..5` (default `1`) before queue fetch.
- Worker route passes bounded `batchSize` into `processQueuedJobs()`; processor enforces clamp again (defense in depth).

## CI/Invariant Enforcement

Architecture invariants enforce:

- processor adapter uses `runPipeline`
- processor has no direct OpenAI evaluator authority
- production entrypoints do not import legacy Phase 2 authorities
- worker entrypoint remains canonical

See: `__tests__/lib/evaluation/architecture-invariants.test.ts`

## Phase 2 Queue Handoff Contract

The following state is **required** when a route queues a job for Phase 2 execution. Any deviation is a canonical drift defect.

| Field | Required Value | Notes |
|-------|---------------|-------|
| `status` | `"queued"` | Top-level job status |
| `phase` | `"phase_2"` | Top-level phase |
| `phase_status` | `"queued"` | **Must be `"queued"` — `"triggered"` is not a canonical runtime state** |
| `progress.phase` | `"phase_2"` | Must mirror top-level phase |
| `progress.phase_status` | `"queued"` | Must mirror top-level phase_status |

### Canonical non-state: "triggered"

`"triggered"` is an event word describing the act of queueing. It is **not** a persisted queue state.

- The canonical persisted queue state is `"queued"`.
- Worker queries must select on `phase_status = 'queued'`, never `'triggered'`.
- Any code writing `phase_status: "triggered"` to the database is a defect.

### Timeout Configuration Invariant

`EVAL_OPENAI_TIMEOUT_MS` must always resolve to `>=` `EVAL_PASS_TIMEOUT_MS`. The shared timeout resolver enforces this by promoting any lower OpenAI/provider timeout to the resolved pass timeout and emitting a validation warning. This prevents poisoned shell defaults such as `EVAL_OPENAI_TIMEOUT_MS=30000` from blocking every build while preserving the invariant at runtime.

Recommended production values:
```
EVAL_PASS_TIMEOUT_MS=720000
EVAL_OPENAI_TIMEOUT_MS=720000
```

---

## Short-Form Evaluation Runtime (< 25,000 words)

### Global SLA

```
SHORT_FORM_GLOBAL_SLA_MS = 15 * 60_000  (15 minutes)
```

Defined in `lib/evaluation/processor.ts`. Covers the full short-form job including any one FIPOC kick-back + retry.

### Short-Form Route Activation

Route: `short_form`
Activation condition: `manuscript_word_count < 25,000`
Read from: `progressSnapshot.manuscript_word_count`
Set in: `processor.ts` chunk routing block

Short-form jobs do NOT run: Golden Spine, Story Ledger extraction, long-form continuity proof, WAVE multi-layer ledgers, Phase 3B long-form synthesis.

Short-form jobs DO run: Pass 1 (craft), Pass 2 (editorial), Pass 3 (synthesis), SHORT_FORM_FINAL_SANITY_CHECK at persist-time.

### SHORT_FORM_FINAL_SANITY_CHECK Stage

Runs in `persistEvaluationResultV2` before any evaluation artifact is written.
- Target: < 100ms (deterministic regex scan)
- Maximum: 500ms
- Gate activation: `manuscript_word_count < 25,000`

Violation codes: see `docs/SIPOC_SHORT_FORM_KICKBACK_ADDENDUM.md`

Kick path: `lib/evaluation/persistEvaluationResultV2.ts` — backward kick to `phase_3 / queued` with retry instruction

### Short-Form Auto-Approval at Review Gate

Short-form jobs (< 25,000 words) are **auto-approved** at the review gate:

```
approved_by: 'system:auto_short_form_policy'
gate_ready_status: 'auto_approved_short_form'
```

This bypasses the human review gate. All quality control is enforced by the SHORT_FORM_FINAL_SANITY_CHECK stage.

### Template Sanitization

`buildCompactTemplateBlock("short_form")` in `dreamTemplateLoader.ts` sanitizes the injected template before LLM call:

| Original term | Sanitized to |
|---|---|
| `WAVE` | `[ADVANCED-TIER]` |
| `Golden Spine` | `[SPINE-FEATURE]` |
| `Phase 5` | `[RELEASE-GATE]` |
| `long-form canon` | `[LONG-FORM-FEATURE]` |

Purpose: prevent LLM from echoing long-form tier labels into short-form output before the sanity check even fires.

### FIPOC Self-Correction (Kickback)

Full details: `docs/SIPOC_SHORT_FORM_KICKBACK_ADDENDUM.md` and `docs/doctrine/SELF_CORRECTION_POLICY.md`

| Code | Kick? | Budget |
|---|---|---|
| `SHORT_FORM_LONGFORM_ARTIFACT_LEAK` | YES | 1 attempt |
| `SHORT_FORM_INTERNAL_PROCESS_LEAK` | YES | 1 attempt |
| `SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM` | YES | 1 attempt |
| All other SHORT_FORM_* codes | NO | Terminal fail |

Budget exhausted or non-kickable code → `SHORT_FORM_FINAL_SANITY_BLOCKED` terminal fail.
