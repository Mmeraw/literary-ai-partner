# Evaluation E2E Forensic Checklist

**Purpose:** Provide a copy-safe, schema-correct forensic checklist for proving that a live evaluation run is operationally clean — not merely that a report eventually rendered.

**Scope:** Evaluation pipeline jobs, artifacts, review gate, Vercel worker orchestration, Supabase claim/lease state, and canonical naming drift.

**Last updated:** 2026-05-24

---

## Canonical labels for this checklist

Use these labels in all E2E checks. Do not substitute synonyms.

| Domain | Canonical value / field | Reject / avoid |
|---|---|---|
| Terminal job status | `status = 'complete'` | `completed`, `succeeded`, `done` |
| Queued job status | `status = 'queued'` | `pending` as job status |
| Running job status | `status = 'running'` | `processing` as job status |
| Failed job status | `status = 'failed'` | `error` |
| Review phase | `phase = 'review_gate'` | `approval_gate`, `user_gate` |
| Review phase status | `phase_status = 'awaiting_approval'` | `queued`, `pending_approval` |
| Phase 1A artifact | `pass1a_story_layer_v1` | `pass1a_story_ledger_v1` |
| Human/product label | Story Layer / Story Ledger | Must not become stored artifact name |
| Evaluation artifact FK | `evaluation_artifacts.job_id` | `evaluation_job_id`, `eval_job_id` |
| Lease expiry field | `lease_until` | `lease_expires_at` as writable field |
| Worker owner fields | `claimed_by` and/or `worker_id` when present | running job with neither field set |
| Approval artifacts | `accepted_story_ledger_v1`, `ledger_user_feedback_v1` | Phase 2 without both artifacts |
| Phase 2 handoff | `pass12_handoff_v1` | untyped handoff blobs |
| Final evaluation artifact | `evaluation_result_v2` | UI-only report state as proof |
| DREAM longform artifact | `longform_document_v1` | spinner / UI completion as proof |

---

## Repo-level go/no-go checks

Run before any live E2E evaluation.

```bash
grep -n "pass1a_story_ledger_v1" lib/evaluation/processor.ts
# Expected: no output

grep -n "pass1a_story_layer_v1" lib/evaluation/processor.ts
# Expected: Phase 0 / Phase 1A governance block references are present

npx jest __tests__/evaluation/storyLedgerExtensions.test.ts --runInBand
# Expected: pass

npx tsc --noEmit
# Expected: zero errors
```

**Go/no-go:** if `pass1a_story_ledger_v1` appears in `processor.ts`, do not run the live proof.

---

## Supabase window setup

For a same-day forensic window, use an explicit UTC cutoff. Example: May 23, 2026 6:00 AM America/Mazatlan is approximately:

```sql
'2026-05-23 13:00:00+00'
```

Replace that cutoff if auditing a different window.

---

## 1. Jobs touched in forensic window

```sql
select
  id,
  created_at,
  updated_at,
  phase,
  phase_status,
  status,
  worker_id,
  claimed_by,
  lease_until,
  attempt_count,
  review_gate_entered_at,
  review_gate_passed_at,
  progress->>'message' as message
from evaluation_jobs
where created_at >= '2026-05-23 13:00:00+00'
   or updated_at >= '2026-05-23 13:00:00+00'
order by updated_at desc;
```

Use this to establish the universe of jobs affected by recent code/config changes.

---

## 2. Review-gate violations

No job may advance to Phase 2, Phase 3, or terminal complete without review-gate approval.

```sql
select
  id,
  phase,
  phase_status,
  status,
  review_gate_entered_at,
  review_gate_passed_at,
  updated_at
from evaluation_jobs
where updated_at >= '2026-05-23 13:00:00+00'
  and (phase in ('phase_2', 'phase_3') or status = 'complete')
  and review_gate_passed_at is null
order by updated_at desc;
```

**Expected:** zero rows.

---

## 3. Artifact contract audit

This query uses the canonical FK column: `evaluation_artifacts.job_id`.

```sql
select
  job_id,
  artifact_type,
  created_at,
  superseded_at,
  invalidated_at
from evaluation_artifacts
where created_at >= '2026-05-23 13:00:00+00'
  and artifact_type in (
    'phase1a_chunk_routing_manifest_v1',
    'pass1a_chunk_cache_v1',
    'pass3_preflight_draft_v1',
    'pass1a_character_ledger_v1',
    'pass1a_story_layer_v1',
    'pass1a_story_ledger_v1',
    'ledger_quality_report_v1',
    'accepted_story_ledger_v1',
    'ledger_user_feedback_v1',
    'pass12_handoff_v1',
    'evaluation_result_v2',
    'longform_document_v1'
  )
order by job_id, created_at;
```

**Expected:** canonical artifact order with no `pass1a_story_ledger_v1` rows.

---

## 4. Phase 2+ without approval artifacts

```sql
with artifacts as (
  select
    job_id,
    max(case when artifact_type = 'accepted_story_ledger_v1' then 1 else 0 end) as has_accepted_story_ledger,
    max(case when artifact_type = 'ledger_user_feedback_v1' then 1 else 0 end) as has_user_feedback
  from evaluation_artifacts
  where created_at >= '2026-05-23 13:00:00+00'
  group by job_id
)
select
  j.id,
  j.phase,
  j.phase_status,
  j.status,
  j.review_gate_passed_at,
  coalesce(a.has_accepted_story_ledger, 0) as has_accepted_story_ledger,
  coalesce(a.has_user_feedback, 0) as has_user_feedback
from evaluation_jobs j
left join artifacts a on a.job_id = j.id
where j.updated_at >= '2026-05-23 13:00:00+00'
  and (j.phase in ('phase_2', 'phase_3') or j.status = 'complete')
  and (
    coalesce(a.has_accepted_story_ledger, 0) = 0
    or coalesce(a.has_user_feedback, 0) = 0
  )
order by j.updated_at desc;
```

**Expected:** zero rows.

---

## 5. Claim / lease anomalies

```sql
select
  id,
  created_at,
  updated_at,
  phase,
  phase_status,
  status,
  worker_id,
  claimed_by,
  lease_until,
  attempt_count,
  worker_pulse_at,
  last_heartbeat_at,
  progress->>'message' as message
from evaluation_jobs
where updated_at >= '2026-05-23 13:00:00+00'
  and (
    (status = 'running' and lease_until is null)
    or (status = 'running' and worker_id is null and claimed_by is null)
    or (attempt_count > 3)
  )
order by updated_at desc;
```

**Expected:** zero rows, unless investigating an already-known stuck job.

---

## 6. Legacy artifact-name contamination

```sql
select
  artifact_type,
  count(*) as count_rows,
  min(created_at) as first_seen,
  max(created_at) as last_seen
from evaluation_artifacts
where created_at >= '2026-05-23 13:00:00+00'
  and artifact_type in ('pass1a_story_layer_v1', 'pass1a_story_ledger_v1')
group by artifact_type
order by artifact_type;
```

**Expected:**

```text
pass1a_story_layer_v1 exists when Phase 1A completed
pass1a_story_ledger_v1 does not exist
```

---

## 7. Froggin proof path

For a full proof job, the backend must show this order:

```text
phase_0 / queued
→ phase_0 / running
→ phase_1a / queued
→ phase_1a / running
→ phase1a_chunk_routing_manifest_v1 written
→ pass1a_chunk_cache_v1 written
→ pass3_preflight_draft_v1 written
→ pass1a_character_ledger_v1 written
→ pass1a_story_layer_v1 written
→ ledger_quality_report_v1 written
→ review_gate / awaiting_approval
→ accepted_story_ledger_v1 written only after user approval
→ ledger_user_feedback_v1 written only after user approval
→ phase_2 / running
→ pass12_handoff_v1 written
→ phase_3 / running
→ evaluation_result_v2 written
→ longform_document_v1 written
→ status = complete
```

**Fail if:** Phase 2 begins before both approval artifacts exist.

---

## 8. Vercel deployment/runtime checks

For every deployment in the forensic window, record:

```text
deployment URL
commit SHA
branch
production/preview status
worker route logs for process-evaluations
worker route logs for process-dream
cron vs kick/manual trigger source
```

Search logs for:

```text
job_id
phase_0
phase_1a
review_gate
phase_2
phase_3
claim
lease_until
worker_pulse_at
cron
kick
manual
awaiting_approval
complete
```

**Yellow flag:** job completed only after cron/watchdog rescue and not by intended self-chain / review-gate flow.

---

## Decision rule

| Result | Meaning |
|---|---|
| No legacy artifact names, no phase-order violations, no lease anomalies, deployment/env mapping clear | Green enough for another live E2E |
| Job completed but any cron-only advancement, legacy artifact drift, or unproven finalizer ownership exists | Yellow; stable enough to demo, not yet hardened |
| Any Phase 2-before-approval, duplicate finalization, invalid worker claim, or mixed deployment/env state | Red; pause production evaluations until fixed |

---

## Notes

- Report UI completion is not proof of orchestration correctness.
- A completed evaluation proves the pipeline can finish; it does not prove it used the intended route.
- `job_id` is the canonical artifact FK for `evaluation_artifacts`.
- `pass1a_story_layer_v1` is the canonical stored artifact type. “Story Ledger” is allowed as human-facing product language only.
