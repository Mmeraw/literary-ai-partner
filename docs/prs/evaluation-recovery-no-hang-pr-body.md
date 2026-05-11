## Summary

Adds recovery-only hardening to the evaluation pipeline so transient Pass 3 failures can be retried or routed to a configured fallback model without rerunning successful earlier passes. This PR is intentionally narrow: it preserves the existing WARN/BLOCK editorial regime and does **not** reintroduce editorial auto-repair.

## Scope

Pass selection:
- [ ] Pass 1
- [ ] Pass 2
- [x] Pass 3

Changed files:
- `lib/evaluation/pipeline/runPipeline.ts`
- `lib/evaluation/policy.ts`
- `tests/evaluation/pipeline/pipeline-e2e.test.ts`

Out of scope:
- Editorial recommendation auto-repair
- Scoring changes
- Prompt changes
- Quality-gate rule weakening
- UI changes

## Contract Integrity

- `runPipeline` keeps fail-closed behavior for terminal failures.
- Pass 1 and Pass 2 outputs are checkpointed and reused when Pass 3 retries or falls back.
- Pass 3 fallback model selection is explicit and configurable.
- The existing processor/SLA stale-job guard remains the authority for no-progress classification; this PR does not weaken or bypass it.
- No new score semantics are introduced.

## Behavioral Quality

This PR is not reducing intelligence.

The behavioral proof is deterministic and seam-injected:
- a transient Pass 3 failure is retried without rerunning Pass 1 / Pass 2
- the fallback Pass 3 route is exercised only when the primary route fails
- checkpoint order is preserved (`pass12_complete` before `pass3_complete`)
- retry and fallback signals are emitted for observability

### Required proof cases

1. **Pass 3 retry recovery**
   - first Pass 3 attempt fails with a transient error
   - second Pass 3 attempt succeeds
   - Pass 1 and Pass 2 are called exactly once
   - retry heartbeat is emitted
   - checkpoint order is correct

2. **Pass 3 fallback routing**
   - primary Pass 3 route fails with a context/token-style error
   - fallback Pass 3 model succeeds
   - fallback heartbeat is emitted
   - the primary and fallback model arguments are both observable in the injected runner calls

3. **No-hang supervision proof**
   - the staged run must exit with a classified recoverable or terminal outcome
   - successful earlier pass artifacts must be reused
   - the job must not remain indefinitely running

## Latency Evidence

### Baseline (Pre-change)

| Run | pass3_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | Baseline before recovery hardening |
| Run 2 | N/A | N/A | Baseline before recovery hardening |

### Post-change Runs

| Run | pass3_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | Focused suite green; staged real-run proof still required before merge |
| Run 2 | N/A | N/A | Focused suite green; staged real-run proof still required before merge |

## Quality Gate / Anomalies

QG_<gate-id>: no QG behavior changes in this PR

## Risks & Anomalies

- Risk: over-expanding recovery logic could mask terminal failures. Mitigation: retry is bounded and fallback is explicit.
- Risk: a fallback model could silently become the default. Mitigation: fallback usage is logged and test-asserted.
- Risk: checkpoint/resume logic could regress ordering. Mitigation: tests assert checkpoint sequence integrity.

## Architecture Alignment

- alignment: post-#384 architecture-aligned
- mitigation_expiry: when PR2 lands with canonical routing/telemetry
- dependent_architecture: Pass 3 fallback model resolution via evaluationRuntimeConfig
- expected_revisit: yes
- replay_ids_at_risk:
- replay_ids_targeted:

## Recommended PR body

Use this as the paste-ready GitHub PR body for PR1:

### Summary
Add resumable recovery to the evaluation pipeline so transient Pass 3/runtime/provider failures do not collapse a valid evaluation or force a full restart.

### Why
Recent production and local real-run evidence shows valid evaluations failing for recoverable reasons:
- transient Pass 3/provider failures
- retryable JSON/schema-style completion failures
- repeated restarts that burn successful earlier passes

This PR preserves fail-closed governance for terminal failures while preventing unnecessary whole-job collapse.

### Scope
- add bounded retry/backoff for retryable Pass 3 failures
- add Pass 3 fallback model routing
- persist and reuse pass checkpoints
- resume from the first incomplete stage
- emit recovery telemetry/heartbeat markers
- keep editorial repair out of PR1

### Non-goals
- no scoring changes
- no prompt redesign
- no editorial recommendation repair
- no quality gate weakening
- no UI changes

### Behavioral proof
- deterministic failure injection at the Pass 3 seam
- pass3 retry proof: first call fails once, second succeeds, Pass 1/2 are not rerun
- pass3 fallback proof: primary model fails, fallback model succeeds
- checkpoint order proof: `pass12_complete` appears before `pass3_complete`
- retry/fallback markers are emitted
- no indefinite running state is introduced by this PR

### Acceptance
- a failed evaluation can resume from the first incomplete stage
- transient Pass 3 failures do not kill the entire evaluation on first occurrence
- successful earlier passes are reused
- fallback routing is explicit and test-covered
- strict failure remains for unrecoverable contract violations

### Proof requirement before merge
Include one staged real-run artifact showing a transient Pass 3 failure recovers without rerunning successful earlier passes or hanging indefinitely.
