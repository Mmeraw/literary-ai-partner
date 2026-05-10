# Reliability Hardening Governance Brief

## Status

**DRAFT — UNLOCKED**

This brief is staged but not yet locked via governance PR. Lock when #293 Phase 1 implementation is complete and the next-lane sequencing decision is made.

## Purpose

Establish a Reliability Hardening Engine: replay-based fixture creation that converts every observed runtime failure into a permanent regression test. Move from "fix the bug" to "prevent the bug class forever."

## Why now

Three causal preconditions are now met:

1. **#291** established canonical manuscript source truth.
2. **#292** established the SIPOC instrument so we can measure what passes through the pipeline.
3. **#293 Phase 1** establishes seed-band runtime governance state.

Together these mean: every runtime failure now has enough context (telemetry, source identity, governance state) to be replayed deterministically. Reliability hardening is the natural consumer of that foundation.

## Scope (in)

1. **Replay harness**: a runner that takes a captured job telemetry payload + manuscript fixture and re-executes the evaluation deterministically.
2. **Fixture format**: a versioned schema for storing replay manifests in `tests/fixtures/replays/`.
3. **First fixture set**: 2–3 known failure modes converted to replay manifests:
   - Long-form Pass 3 truncation under high `representation_compression_ratio`.
   - Dark criteria scenarios (`criteria_with_zero_evidence` non-empty for long-form).
   - Chunk materialization mismatch (`ensure_chunks_returned_count != persisted_chunk_count`).
4. **CI integration**: replay manifests run on every PR; failure blocks merge.
5. **Telemetry**: emit `replay_harness_run_count`, `replay_harness_pass_count`, `replay_harness_fail_count` per CI run.

## Non-goals (out)

- ❌ No live production retry/halt behavior.
- ❌ No prompt/scoring/QG changes.
- ❌ No SIPOC schema changes.
- ❌ No UI rewrite.
- ❌ No new evaluation passes.

## File targets

- `tests/replays/harness.ts` (new) — replay runner.
- `tests/replays/manifest.types.ts` (new) — fixture schema.
- `tests/fixtures/replays/<failure-name>/manifest.json` (new) — first fixture set.
- `tests/fixtures/replays/<failure-name>/manuscript.txt` (new) — input fixture.
- `tests/fixtures/replays/<failure-name>/expected.json` (new) — expected outputs.
- `.github/workflows/replay-harness.yml` (new) — CI workflow.

## Required tests

1. `replay_harness_runs_long_form_truncation_fixture` — asserts deterministic re-execution and expected failure mode.
2. `replay_harness_runs_dark_criteria_fixture` — asserts `criteria_with_zero_evidence` reproduction.
3. `replay_harness_runs_chunk_mismatch_fixture` — asserts fail-closed reproduction.
4. `replay_harness_emits_run_telemetry` — asserts replay-level telemetry shape.
5. `replay_harness_ci_workflow_blocks_on_fail` — integration test on the workflow file.

## Acceptance bar

- [ ] Replay harness implemented and named.
- [ ] Fixture schema documented and stable.
- [ ] First 3 fixture manifests committed.
- [ ] CI workflow green and blocking.
- [ ] Replay-level telemetry emitted.
- [ ] Existing test suites continue to pass.
- [ ] CI/typecheck green.

## Strategic position

Reliability Hardening is the **Repair → Replay → Regression** discipline that converts the SIPOC instrument and governance state into long-term system health. Without it, every fix is local; with it, every fix becomes structural.

This lane is the precondition for confidently expanding into WAVE / TRUSTPATH / Revise, because those lanes will introduce new failure modes that need the same replay discipline.

## Telemetry expansion

Add to a replay-focused telemetry struct (or sibling telemetry surface):

```typescript
export interface ReplayHarnessTelemetry {
  replay_harness_run_count: number;
  replay_harness_pass_count: number;
  replay_harness_fail_count: number;
}
```

## Sequencing note

This brief should be locked via governance PR only after #293 Phase 1 merges and the lane handoff is formally declared. Keep this as staged guidance until then.
