# Operator Runbook

## Quick Checks (60 seconds)

- Open the Invariants dashboard: /admin/invariants
- Confirm the API returns JSON: /api/admin/invariants
- Open Jobs dashboard: /admin/jobs
- Check diagnostics endpoint: /api/admin/diagnostics
- Capture generated_at + any failing/warning invariant IDs + sample_job_ids

## Invariants Reference

- INV-001 -- No stuck processing jobs
  Rule: status="processing" AND heartbeat_at < now()-30min
  threshold_seconds: 1800
  Fail if observed_count > 0

- INV-002 -- No expired leases
  Rule: lease_until < now() AND status IN ("queued","processing")
  Fail if observed_count > 0

- INV-003 -- No infinite retries
  Rule: attempts >= 10 AND status NOT IN ("completed","failed","cancelled")
  Fail if observed_count > 0

- INV-004 -- Completed jobs must have results
  Rule: status="completed" AND evaluation_result IS NULL
  Fail if observed_count > 0

- INV-005 -- Dead-letter daily volume sanity
  Rule: status="dead_lettered" AND created_at within last 24 hours
  Pass if observed_count <= 50; Warn if observed_count > 50

## Common Remediations

- Stuck processing jobs: check heartbeat, lease, worker health
- Expired leases: investigate worker crash / TTL / clock skew
- Missing results: phase2 persistence path, artifacts/results table
- Dead-letter spikes: check last_error patterns, retry policies, worker logs

## Escalation Package

Include:

- Routes:
  - /admin/invariants
  - /api/admin/invariants
  - /admin/jobs
  - /api/admin/diagnostics

- Evidence:
  - generated_at timestamp
  - failing/warning invariant IDs
  - observed_count + sample_job_ids
  - worker logs and diagnostics output (if available)
  - deploy SHA + environment
