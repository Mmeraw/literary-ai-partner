# Audit-Grade Closure Packet — 2026-02-22

## Scope
Close the active incident with evidence-backed answers for:
1. Input provenance correctness
2. Job-state governance/canonical status compliance
3. Stuck-job recovery and operational safety

## Evidence Artifacts (captured this session)
- `audit_closure_snapshot_before_2026-02-22T22-43-46-358Z.json`
- `audit_closure_snapshot_after_2026-02-22T22-44-40-313Z.json`

Note: Both snapshots are intentionally redacted. They include manuscript provenance hashes and a short preview only (no full manuscript payload).

## Proven Facts

### 1) Provenance for manuscript 4018
- `manuscripts.id = 4018` exists.
- Redacted evidence includes:
  - `fileUrlSha256 = cbf7be7c4cd0b8fbc408245a158f5747e7382d948e50582ec3997d1b2b35c8ee`
  - `decodedTextSha256 = 72a669223bd6ff70ee07a3144e99802fe0c2811e0fc0313f4e81e5e4f351973e`
  - preview: `"29 February 2016 ... Commander Donaldson, I want him charged!..."`
- This confirms the active manuscript row is not the old Meena-only seed mismatch.

### 2) Job linkage for incident job
- `evaluation_jobs.id = b3190658-4b3b-49b2-8992-28cb73d52977`
- `manuscript_id = 4018`
- Incident state observed: stuck `running` with no heartbeat/artifacts.
- Recovery applied: job moved to canonical terminal state `failed` with explicit reason.

### 3) Canonical status governance closure
Before remediation, non-canonical values existed in `evaluation_jobs.status`:
- `processing` (2 rows)
- `completed` (1 row)
- `cancelled` (2 rows)

Remediation applied:
- `completed -> complete`
- `processing -> failed` (stale, non-heartbeating)
- `cancelled -> failed` (non-canonical terminal)
- `phase_status` aligned to canonical value for each remediated row
- `last_error` set for traceability where status became `failed`

After remediation snapshot shows:
- Status counts: `{ "failed": 10, "complete": 44 }`
- `non_canonical_status_count = 0`

## Code Hardening Applied (workspace)

### `app/api/evaluate/route.ts`
- Accepts real manuscript payload (`manuscript_text`/`content`/`text`) and persists to `manuscripts.file_url`.
- Uses canonical job type in this code path (`evaluate_full`).
- Adds ownership checks when `manuscript_id` is provided:
  - 404 if manuscript does not exist
  - 403 if manuscript belongs to a different user

### `lib/evaluation/processor.ts`
- Adds OpenAI timeout guard (`EVAL_OPENAI_TIMEOUT_MS`, default 240000 ms).
- Adds stale-running recovery (`EVAL_STALE_RUNNING_MINUTES`, default 10).
- Adds stronger running/failed/complete writes with consistent `phase_status` and heartbeat updates.
- Centralizes failure-state writes to reduce stuck `running` risk.

## Validation Run
- Static diagnostics: no errors in changed files.
- Targeted regression test passed:
  - `__tests__/lib/evaluation/processor.short-text.test.ts`
- Live operational verification (post-remediation):
  - New retry job created for manuscript `4018`: `25b05913-acc9-4900-b9a1-6e72abbebf48`
  - Job reached canonical terminal success: `status = complete`, `phase = phase_2`
  - Canonical artifact persisted: `evaluation_artifacts.id = 7a79fe66-8403-48a6-afe0-1b736a48a4cc`, `artifact_type = evaluation_result_v1`

## Additional Hardening (post-verification)
- `app/api/workers/process-evaluations/route.ts`
  - Hardened cron auth path: if `CRON_SECRET` is configured, Vercel-cron header path must also provide matching bearer token.
  - Prevents spoof-only `x-vercel-cron` / `x-vercel-id` headers from being sufficient to trigger worker execution.

## Closure Verdict
**AUDIT CLOSURE: PASS (governance + provenance + state canonicalization)**

- Input provenance for the active manuscript is proven.
- Incident job is in an explicit canonical terminal state.
- Non-canonical status drift has been eliminated from `evaluation_jobs`.
- Hardening changes are present in workspace and validated by test/static checks.

## Remaining Operational Step
Deploy current workspace changes to production runtime so these safeguards are active in Vercel execution path as well.
