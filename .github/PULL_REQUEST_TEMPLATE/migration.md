## Summary

<!-- 1–3 sentences describing what schema changes and why. -->

## Scope

<!-- Tables, columns, indexes, RLS policies, functions affected. What is NOT touched. -->

## Schema Diff

<!-- Summary of tables/columns added, modified, dropped. Index changes. RLS policy changes. -->

| Object | Change | Notes |
| --- | --- | --- |
|        |        |       |

## Rollback Plan

<!-- Down-migration SQL or operator steps. If irreversible, say so explicitly and explain the safety net. -->

## Data Backfill

<!-- Yes/No. If yes: estimated row count, runtime, lock impact, and whether it runs inside or outside the migration transaction. -->

## Unauthorized Input Sources

<!-- Explicitly state all input sources this migration consumes (existing table data, migration params, env-driven behavior, operator inputs).
For each, describe authorization boundary and validation/safety handling. If none: state "None". -->

## Internal Process Leakage

<!-- Confirm migration/runtime responses and docs do not leak internal process details (raw errors, internals, sensitive IDs) to public surfaces. -->

## Input → Action → Output

<!-- Provide a concise flow map: input state/data, migration action, output state/schema contract.
Include failure-path behavior and rollback posture. -->

## Public-Safe Quality/Status Metrics

<!-- List visible migration status/quality indicators and confirm they are public-safe (no secret/internal telemetry leakage). -->

## Runtime/Pipeline Expansion

<!-- Declare whether this migration adds hidden runtime/pipeline expansion (new workers/routes/paths).
If none: state "None" and explain. -->

## Latency Impact

<!-- Provide migration/runtime latency impact evidence (query/runtime/lock duration) or explain why no unnecessary latency increase is expected. -->

## Branch Freshness (Never Behind)

<!-- Required merge gate: PR head must include current base HEAD. -->

Branch-Behind-Base: 0

## Risks & Anomalies

<!-- Lock contention, downtime, replica lag, application compatibility, etc. -->

---

No-Pipeline-Impact: Confirmed — this PR does not modify lib/evaluation/**, app/api/workers/**, prompts, or any pipeline contract.

<!-- pr-type: migration -->
