# Block 1 PR-2 Runbook — Deploy & Schedule `rescue-stuck-jobs`

## Purpose

Operationalize the already-merged out-of-band rescue path:

- Supabase Edge Function: `supabase/functions/rescue-stuck-jobs/index.ts`
- Batch RPC: `public.rescue_stuck_evaluation_jobs(...)`
- Canonical single-job rescue RPC: `public.admin_rescue_orphaned_evaluation_job(...)`

This runbook is **ops-only**. It does not change rescue logic, worker/watchdog behavior, or pipeline logic.

---

## Scope Boundary (Do / Do Not)

### Do

- Deploy the existing Edge Function.
- Configure required secrets.
- Configure scheduled invocation.
- Verify production behavior with explicit checks.

### Do Not

- Modify rescue RPC logic.
- Modify Edge Function logic.
- Modify worker/watchdog behavior.
- Modify evaluation pipeline, scoring, rendering, ViewModels, templates, or Revise logic.

---

## Required Secrets

Set these in Supabase Edge Function secrets:

- `RESCUE_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Function code also reads `SUPABASE_URL` at runtime (project URL), so ensure it is available in the deployed function environment.

> Security note: `RESCUE_SECRET` should be long, random, and unique to this function path. Do not reuse `CRON_SECRET`.

---

## Prerequisites

1. Supabase CLI installed.
2. Operator is authenticated (`SUPABASE_ACCESS_TOKEN` or `supabase login`).
3. Target project reference is known.
4. Migration containing `rescue_stuck_evaluation_jobs` is already applied in target environment.

---

## 1) Link to Target Supabase Project

```bash
supabase link --project-ref <PROJECT_REF>
```

Optional sanity check:

```bash
supabase status
```

---

## 2) Set Function Secrets

```bash
supabase secrets set \
  RESCUE_SECRET="<LONG_RANDOM_SECRET>" \
  SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>" \
  --project-ref <PROJECT_REF>
```

If your environment requires explicit URL in function secrets, also set:

```bash
supabase secrets set \
  SUPABASE_URL="https://<PROJECT_REF>.supabase.co" \
  --project-ref <PROJECT_REF>
```

---

## 3) Deploy Edge Function

Use no-JWT verification because this endpoint is authenticated by `RESCUE_SECRET` bearer auth in function code:

```bash
supabase functions deploy rescue-stuck-jobs \
  --project-ref <PROJECT_REF> \
  --no-verify-jwt
```

---

## 4) Manual Invocation (Operator Smoke Test)

```bash
curl -sS -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/rescue-stuck-jobs" \
  -H "Authorization: Bearer <RESCUE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"max_jobs": 5, "reason": "manual_smoke_test"}'
```

Expected response shape:

- `ok: true`
- `rescued_count: <number>`
- `rescued: [...]`
- `invoked_at: <timestamp>`

---

## 5) Scheduling Options

Choose one:

### Option A — Supabase Scheduled Invocation (preferred)

- Configure a schedule to POST to `/functions/v1/rescue-stuck-jobs`.
- Add header: `Authorization: Bearer <RESCUE_SECRET>`.
- Suggested cadence: every **5 minutes**.
- Suggested body:

```json
{ "max_jobs": 20, "reason": "scheduled_rescue" }
```

### Option B — External Scheduler / Uptime Monitor

- Any scheduler that can issue HTTPS POST with headers.
- Same endpoint, header, and JSON body as above.

---

## 6) Production Verification Checklist

Run after deployment and after schedule is enabled.

- [ ] Function deploy succeeded (`rescue-stuck-jobs` visible in Supabase functions).
- [ ] Required secrets present: `RESCUE_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_URL` where required).
- [ ] Manual POST invocation returns `ok: true`.
- [ ] Unauthorized call (missing/wrong bearer token) returns `401`.
- [ ] Scheduler executes successfully at expected cadence.
- [ ] Rescue output is bounded by `max_jobs` cap.
- [ ] Review-gate/awaiting-approval jobs are not rescued (Guard E behavior preserved).
- [ ] Rescued jobs show canonical rescue event trail in `evaluation_jobs.progress`.
- [ ] No worker/watchdog/pipeline behavior changed.

Suggested SQL spot checks:

```sql
-- Recent rescued jobs
select id, status, phase, phase_status, updated_at
from public.evaluation_jobs
where updated_at > now() - interval '30 minutes'
  and status in ('queued','running','failed','complete')
order by updated_at desc
limit 50;
```

```sql
-- Confirm rescue event marker exists in progress JSONB where applicable
select id, progress
from public.evaluation_jobs
where updated_at > now() - interval '30 minutes'
  and progress::text ilike '%_rescue_event%'
order by updated_at desc
limit 50;
```

---

## If Credentials Are Missing in Session

Do **not** fake deployment.

Hand this exact operator checklist to an authenticated operator:

1. `supabase link --project-ref <PROJECT_REF>`
2. `supabase secrets set RESCUE_SECRET=... SUPABASE_SERVICE_ROLE_KEY=... --project-ref <PROJECT_REF>`
3. `supabase functions deploy rescue-stuck-jobs --project-ref <PROJECT_REF> --no-verify-jwt`
4. Manual curl smoke test (above)
5. Configure 5-minute schedule with `Authorization: Bearer <RESCUE_SECRET>`
6. Complete production verification checklist (above)
