# Scale to 100,000 Users — Runtime Playbook (Canonical)

## Objective

Provide a fail-closed, auditable, and horizontally scalable evaluation runtime that preserves canonical contracts while handling 100k-user traffic growth.

## Non-Negotiable Runtime Invariants

1. Canonical execution path only:
   - `app/api/workers/process-evaluations/route.ts`
   - `lib/evaluation/processor.ts`
   - `lib/evaluation/pipeline/runPipeline.ts`
2. Canonical job statuses only: `queued`, `running`, `complete`, `failed`.
3. Illegal state transitions must fail explicitly and must not write partial success state.
4. UI/API read persisted state only; no simulated progress.

## Current Safety Baseline (Implemented)

- Worker invocation budget: `maxDuration = 300` seconds.
- Pass timeout cap: `EVAL_PASS_TIMEOUT_MS <= 180000`.
- OpenAI timeout cap: `EVAL_OPENAI_TIMEOUT_MS <= 180000`.
- Bounded queue batch: `EVAL_WORKER_BATCH_SIZE` clamped to `1..5` (default `1`).
- Defense in depth: route provides bounded batch size; processor clamps again.

## Capacity Strategy

### Phase 1 — Stability First (immediate)

- Keep `EVAL_WORKER_BATCH_SIZE=1` in production until live latency variance stabilizes.
- Verify stale-running auto-fail hygiene is active.
- Track p50/p95/p99 job completion times and timeout failure rates daily.

### Phase 2 — Controlled Throughput Ramp

- Increase batch size gradually: `1 -> 2 -> 3` only after 48h stable windows.
- Add shardable worker trigger strategy (parallel invocations over disjoint claim windows).
- Keep per-invocation worst-case budget below route max duration with margin.

### Phase 3 — 100k Readiness

- Queue partitioning by priority and age (SLA-aware ordering).
- Idempotent retry policy with bounded attempts and dead-letter handling.
- Multi-region worker deployment with deterministic claim ownership.
- Backpressure controls at submission edge when backlog exceeds SLO thresholds.

## SLOs and Error Budgets

- Availability SLO (evaluation enqueue + status API): 99.9%.
- Processing success SLO (non-user-error jobs): 99.5%.
- p95 queue-to-complete target: set per manuscript size tier.
- Timeout error budget: <0.5% of canonical jobs per 24h.

## Operational Controls

- Change management:
  - Any timeout/batch/env changes require PR + evidence in CI + rollback plan.
- Rollback:
  - Immediate revert to last known-good commit.
  - Force `EVAL_WORKER_BATCH_SIZE=1` during incident stabilization.
- Observability requirements:
  - Structured logs with job ID, phase, failure code, latency buckets.
  - Alert on timeout spikes, stale-running growth, queue backlog growth.

## Pre-Scale Checklist

- [ ] Load test worker route with production-like payload and latency injection.
- [ ] Validate queue backlog recovery after induced OpenAI latency spikes.
- [ ] Validate fail-closed behavior for env misconfiguration.
- [ ] Validate no non-canonical status values in runtime paths.
- [ ] Validate one-click rollback runbook under incident drill.

## Post-Deploy Proof Requirements

1. Fresh live evaluation completes under capped timeout budget.
2. No worker invocation overruns during 24h observation window.
3. Backlog does not grow unbounded under expected cron cadence.
4. Audit evidence stored with timestamps, commit hash, and metric snapshots.
