# Operator Runbook

## Quick Checks (60 seconds)

1. Open the Invariants dashboard: `/admin/invariants`
2. Confirm API is reachable: `GET /api/admin/invariants`
3. Check jobs dashboard: `/admin/jobs`
4. Check diagnostics endpoint: `GET /api/admin/diagnostics`
5. If any invariant shows **fail** or **warn**:
   - Note the `generated_at` timestamp
   - Record affected invariant IDs (INV-001..INV-005)
   - Capture `observed_count` and `sample_job_ids`

## Invariants Reference

| ID | Name | Rule | Severity | Status Logic |
|---|---|---|---|---|
| INV-001 | No stuck processing jobs | `status = 'processing' AND heartbeat_at < now() - 30 min` | high | fail if count > 0 |
| INV-002 | No expired leases | `lease_until < now() AND status IN ('queued','processing')` | high | fail if count > 0 |
| INV-003 | No infinite retries | `attempts >= 10 AND status NOT IN ('completed','failed','cancelled')` | medium | fail if count > 0 |
| INV-004 | Completed jobs must have results | `status = 'completed' AND evaluation_result IS NULL` | high | fail if count > 0 |
| INV-005 | Dead-letter daily volume sanity | `status = 'dead_lettered' AND created_at within 24h` | low | pass if <= 50, warn if > 50 |

## Common Remediations

### Stuck processing jobs (INV-001)

- Verify workers are running and can reach the database
- Look for missing heartbeat updates on `sample_job_ids`
- Confirm lease logic is renewing as expected
- If a worker crashed: restart the worker, expired leases will be reclaimed

### Expired leases (INV-002)

- Investigate worker crash or process instability
- Validate TTL settings and lease renewal cadence
- Check system clock skew in the runtime environment
- Review lease clamping logic in the worker claim path

### Infinite retries (INV-003)

- Check the `attempts` and `max_attempts` values for affected jobs
- Look for a recurring error pattern in `last_error`
- Consider manually failing or cancelling stuck jobs
- Review retry policies for edge cases

### Missing results (INV-004)

- Confirm Phase 2 aggregation writes `evaluation_result`
- Check for errors in the persistence path for `sample_job_ids`
- Validate schema: ensure `evaluation_result` column exists and is populated
- Inspect the artifacts/results table for partial writes

### Dead-letter spikes (INV-005)

- Identify common error messages driving dead-lettering
- Confirm retry/attempt policies are correctly bounded
- Review worker logs around the spike window
- Use `/admin/jobs` filters to isolate dead-lettered jobs by time range

## Escalation Package

When escalating an incident, include all of the following:

### Links to check

- `/admin/invariants` -- dashboard view
- `/api/admin/invariants` -- raw JSON
- `/admin/jobs` -- job browser
- `/api/admin/diagnostics` -- system diagnostics

### Evidence to attach

- `generated_at` timestamp from invariants response
- Invariant IDs that are failing or warning
- `observed_count` and `sample_job_ids` for each failing invariant
- Correlated logs (worker logs, Vercel function invocation errors)
- Recent deploy SHA and environment (prod/preview)
- Relevant entries from Vercel Logs (filter by function name, error level)

### Where to look in Vercel logs

- Filter by Function: look for `/api/admin/invariants`, `/api/evaluate`, worker functions
- Filter by Level: `error` and `warn`
- Search for job IDs from `sample_job_ids` to trace execution path
- Check for timeout errors (function invocation exceeded duration limit)
