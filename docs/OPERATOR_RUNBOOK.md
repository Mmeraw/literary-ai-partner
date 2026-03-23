# Operator Runbook — A4.3 Invariant Dashboard

## Purpose

This runbook explains how to interpret the invariant dashboard and what actions to take when metrics or checks move out of bounds.

The dashboard/check API is served from:

- UI: `/admin/invariants`
- API: `/api/admin/invariants`

## 60-Second Triage

1. Open `/admin/invariants` and capture `generatedAt`.
2. Confirm check summary (`totalChecks`, `passed`, `failed`).
3. If any check fails, open `/api/admin/invariants` and copy `checks[]` + `metrics` payload.
4. Correlate with:
   - `/admin/jobs`
   - `/api/admin/diagnostics`
5. Start remediation from the If-X-Then-Y section below.

## Metric Definitions

### Claim Metrics

- `claimAttempts`: Sum of `attempt_count` across sampled `evaluation_jobs` rows in window.
- `claimSuccesses`: Number of jobs with `attempt_count > 0`.
- `emptyClaims`: Derived proxy = `claimAttempts - claimSuccesses` (never negative).

Interpretation:

- Increasing `claimAttempts` with flat throughput can mean contention or lease churn.
- Rising `emptyClaims` suggests workers are polling while few/no eligible jobs are claimable.

### Retry Metrics

- `retryAttempts`: Sum of retry attempts (for rows where `attempt_count > 1`, uses `attempt_count - 1`).
- `retryChanged`: Retried jobs now in terminal state (`complete` or `failed`).
- `retryNoStateChange`: `retryAttempts - retryChanged` proxy.

Interpretation:

- High `retryAttempts` + low `retryChanged` indicates repeated retries with little progress.

### Lease Expiration Metrics

- `totalExpired`: Running jobs with `lease_until < now()` in analysis window.
- `points[]`: Daily buckets for expiration trend.

Interpretation:

- Upward `totalExpired` trend usually indicates worker death, stalled renewals, or lease TTL mismatch.

### Job Status Metrics

- `queued`, `running`, `complete`, `failed` counts from canonical `evaluation_jobs.status` values.

Interpretation:

- High `running` with low `complete` means jobs are being claimed but not finishing.
- Growing `queued` with steady workers suggests claim gate or retry scheduling pressure.

## Invariant Checks (Current)

- `successes_lte_attempts`
  - Rule: `claimSuccesses <= claimAttempts`
- `one_successful_claimant_per_job`
  - Rule: each eligible running job has claimant context (`worker_id` + `lease_until`)
- `empty_claims_under_contention`
  - Rule: when contention signal is present, empty claims should be non-zero
- `no_overlapping_leases`
  - Rule: no duplicate active lease rows for same `job_id`

## Common Patterns and What They Usually Mean

### Pattern: High empty-claim rates

Likely causes:

- Worker polling cadence too aggressive for current queue depth
- Retry gate / eligibility filters preventing claimability
- Queue starvation after burst completion

### Pattern: Rising lease expirations over time

Likely causes:

- Worker crashes/restarts before renew
- Renewal RPC latency or DB contention
- Lease TTL too short for actual workload duration

### Pattern: Repeated retries with no state change

Likely causes:

- Deterministic downstream failure (same error repeated)
- Incorrect retry classification (retrying non-retryable errors)
- Retry delay too short, causing tight failure loops

## If X Then Y (Operator Actions)

### If `successes_lte_attempts` fails

1. Inspect `/api/admin/invariants` payload for claim metrics window.
2. Inspect `evaluation_jobs.attempt_count` distribution and recent writes.
3. Review claim-path code and atomic claim RPC behavior for regression.

### If `one_successful_claimant_per_job` fails

1. Query running jobs with null `worker_id` or null `lease_until`.
2. Inspect worker startup/claim logs around those `job_id`s.
3. Verify claim writes and lifecycle updates are in same successful path.

### If `empty_claims_under_contention` fails

1. Confirm contention signal (`running > 1` or attempts pressure) in payload.
2. Inspect claim loop logs for poll cadence and eligibility decisions.
3. Validate queue depth and retry scheduling; tune claim interval if needed.

### If `no_overlapping_leases` fails

1. Identify duplicated `job_id`s from check details.
2. Inspect claim and renew RPC calls for race behavior.
3. Review lease conditions (`lease_until`, optimistic concurrency guards).
4. Temporarily pause workers if active corruption risk exists.

## Logs and Data to Inspect First

- Worker logs (claim, renew, retry, terminal transition lines)
- `evaluation_jobs` fields:
  - `status`, `attempt_count`, `worker_id`, `lease_until`, `next_attempt_at`, `updated_at`
- Admin diagnostics output (`/api/admin/diagnostics`)

## Escalation Package

When escalating to engineering, include:

- Timestamp (`generatedAt`)
- Failing check IDs + `details`
- Full `metrics` object from `/api/admin/invariants`
- Sample affected `job_id`s from job list/queries
- Deployment SHA + environment + incident start time
