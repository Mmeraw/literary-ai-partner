# Evaluation Relay Contract

This document records the locked RevisionGrade evaluation relay contract used to harden the production worker.

## One-line rule

No phase may rerun all previous phases. Each phase owns one baton artifact. If a baton is missing, return to the phase that writes that baton.

## Canonical flow

```text
intake / chunking
  -> phase_1a
  -> phase_2
  -> phase_3
  -> wave_revision
```

## Phase ownership

### Intake

Owns validation and long-form chunk materialization.

Required outputs for long-form:

- `manuscript_chunks`

Failure policy:

- Missing manuscript text: fail immediately.
- Unsupported file type: fail immediately.
- Text extraction failure: fail immediately.
- Long-form chunk materialization failure: fail immediately with named code.

### phase_1a

Owns facts and independent read.

Runs:

- Pass 1A character / continuity ledger
- Pass 3A independent full-manuscript preflight

Writes:

- `pass1a_character_ledger_v1`
- `pass3_preflight_draft_v1`

Next phase:

- `phase_2`

Failure policy:

- If Pass 1A produces zero usable chunk outputs, fail loudly with `PASS1A_ZERO_CHUNK_OUTPUTS`.
- Do not write an empty ledger sentinel on zero-output runs.
- Pass 3A preflight may degrade only when the ledger exists.

### phase_2

Owns score and diagnosis only.

Runs:

- Pass 1 craft / criteria
- Pass 2 editorial / literary

Writes:

- `pass12_handoff_v1`

Forbidden:

- Pass 3B synthesis
- Quality Gate / final QA
- WAVE revision
- Deleting `pass12_handoff_v1`
- Full `runPipeline()` fallback for long-form handoff capture

Next phase:

- `phase_3`

Failure policy:

- Missing ledger before Pass 1/2: requeue `phase_1a`.
- Missing `pass12_handoff_v1` before Pass 1/2: normal; run Pass 1/2 only.
- Missing `pass12_handoff_v1` after Pass 1/2: retry `phase_2` with named error.
- `QG_*` errors must never originate from phase_2.

### phase_3

Owns final report.

Runs:

- Pass 3B final synthesis / editor-in-chief report
- Quality Gate / final QA

Reads:

- `pass12_handoff_v1` required
- compact `pass3_preflight_draft_v1` optional

Writes:

- `evaluation_result_v2`
- `longform_document_v1`

Forbidden:

- Rerunning Pass 1 + Pass 2 as the normal path
- Deleting `pass12_handoff_v1`
- Treating WAVE as the main phase job

Failure policy:

- Missing `pass12_handoff_v1`: requeue `phase_2` or fail with `PHASE3_MISSING_HANDOFF` depending retry context.
- Quality Gate failure: fail report with named QG code and diagnostic artifacts.

### wave_revision

Owns post-report revision plan only.

Runs after base report persistence.

Reads:

- `evaluation_result_v2`
- `pass1a_character_ledger_v1`
- manuscript text

Gate:

- word count >= 25,000
- all 13 final scores >= 6.0
- Quality Gate passed
- character ledger available

Writes:

- `wave_revision_plan_v1`

Failure policy:

- Ineligible manuscript: persist `wave_revision_plan_v1` with `status="skipped"` and reason codes.
- WAVE timeout or execution error: persist `status="failed"`, `retryable=true`, and reason code.
- WAVE must never change a successful base evaluation into a failed job.

## Missing artifact routing

| Missing artifact | Where detected | Meaning | Correct action |
|---|---|---|---|
| manuscript text | intake | no evaluation input | fail immediately |
| chunks for long-form | intake | cannot safely evaluate | retry chunking or fail clearly |
| `pass1a_character_ledger_v1` | phase_2 | facts phase incomplete | requeue phase_1a |
| `pass3_preflight_draft_v1` | phase_3 | independent read unavailable | continue degraded if ledger exists |
| `pass12_handoff_v1` | phase_3 | diagnosis phase incomplete | requeue phase_2 |
| `evaluation_result_v2` | wave_revision | base report incomplete | do not run WAVE |
| ledger in wave_revision | wave_revision | cannot build governed revision plan | skip WAVE; keep report complete |

## Proof query

Use `supabase/queries/evaluation_relay_proof.sql` to verify one job mechanically.

Required proof sequence:

```text
claimed_by / worker_id non-null
heartbeat fresh
lease_until future
pass1a_character_ledger_v1 exists and is real
pass3_preflight_draft_v1 exists or degraded-with-ledger is recorded
pass12_handoff_v1 exists
evaluation_result_v2 exists
longform_document_v1 exists
wave_revision_plan_v1 is complete, skipped, or failed
```

## Anti-regression checklist

Before running a fresh production proof job, confirm:

- phase_2 does not delete `pass12_handoff_v1`.
- phase_2 queues `phase_3` after `pass12_handoff_v1` lands.
- phase_3 reads `pass12_handoff_v1`.
- WAVE writes `wave_revision_plan_v1` only after base report persistence.
- WAVE failure is non-fatal to the base evaluation.
- `QG_*` errors originate from phase_3 / Quality Gate, not phase_2.
