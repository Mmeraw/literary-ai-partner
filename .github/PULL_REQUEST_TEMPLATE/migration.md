## Summary

> Validation rule: blank sections, placeholder-only answers (for example, `TBD`, `TODO`, bare `N/A`) fail. Use `N/A — <reason>` when a section truly does not apply.

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

## Rollback Posture

<!-- State whether rollback is reversible, irreversible, or operator-gated.
Describe the trigger to roll back, the blast-radius containment plan, and what evidence would tell operators to stop. -->

## Lock / Table-Scan Risk

<!-- Describe expected lock scope, table-scan risk, index creation mode, and any production concurrency impact.
If none: use "None — <reason>". -->

## Data Backfill Risk

<!-- Describe batching, resumability, idempotency, failure handling, and recovery posture for any backfill.
If no backfill is required: use "None — no backfill required because ...". -->

## RLS / Access Impact

<!-- Describe any row-level security, grants, role, or access-path impact.
If none: use "None — no access-control change." -->

## Production Verification Query

<!-- Provide the exact safe read-only SQL query or verification steps operators should run after deploy to prove the migration succeeded. -->

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
