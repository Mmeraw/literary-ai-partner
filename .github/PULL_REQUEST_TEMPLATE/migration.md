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

## Branch Freshness (Never Behind)

<!-- Required merge gate: PR head must include current base HEAD. -->

Branch-Behind-Base: 0

## Risks & Anomalies

<!-- Lock contention, downtime, replica lag, application compatibility, etc. -->

---

No-Pipeline-Impact: Confirmed — this PR does not modify lib/evaluation/**, app/api/workers/**, prompts, or any pipeline contract.

<!-- pr-type: migration -->
