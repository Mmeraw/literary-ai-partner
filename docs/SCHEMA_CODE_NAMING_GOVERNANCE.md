# Schema & Code Naming Governance

**Scope:** Database schema, TypeScript types, and persistence-layer vocabulary for jobs, phases, chunks, artifacts, manuscripts, ownership, auth, time semantics, errors, RPCs, and environment flags.

**Applies to:** Database tables/columns/enums, TypeScript types, RLS policies, RPCs, background workers, evaluation artifacts, and all persistence-level logic.

**Last updated:** 2026-05-24

---

## Purpose

Prevent vocabulary drift — the silent divergence of names, enums, and concepts across DB, TypeScript, RLS, RPCs, prompts, worker logs, and UI. Drift causes subtle bugs: broken RLS, incorrect job orchestration, unprovable phase transitions, missing artifacts, and false-green evaluations.

This document defines the canonical persistence contract. UI and logs may translate for display, but stored values, SQL, runtime code, artifact types, and tests must use the canonical labels below.

---

## Canon Principle

For every domain concept:

- Exactly one canonical name and enum set exists.
- DB schema and TypeScript constants are the source of truth.
- UI/product language may translate only at the display edge.
- Banned aliases must not appear in stored data, enum values, SQL checks, artifact types, or runtime prompts.
- Human-facing names must not become stored artifact names.

---

## 1. Job Lifecycle

**Canonical job status values (`evaluation_jobs.status`):**

```text
queued | running | failed | complete
```

**Reject stored variants:**

```text
completed | succeeded | done | error | canceled
```

Notes:

- `complete` is the terminal success status.
- `completed_at` is allowed as a timestamp column name; it is not a status value.
- UI may display “Complete” or “Report ready,” but storage remains `complete`.

---

## 2. Pipeline Phases

**Canonical phase values (`evaluation_jobs.phase`):**

```text
phase_0 | phase_1a | review_gate | phase_2 | phase_3 | wave_revision
```

**Reject stored variants:**

```text
phase0 | phase1 | phase_1 | phase_1_a | approval_gate | user_gate | phase3 | p0 | p1 | p2 | p3
```

Phase meanings:

| Phase | Meaning |
|---|---|
| `phase_0` | Governance warmup / calibration. Does not read the manuscript. |
| `phase_1a` | First manuscript-reading phase; builds Phase 1A artifacts. |
| `review_gate` | Author approval checkpoint between Phase 1A and Phase 2. |
| `phase_2` | Ledger-informed criteria/evidence analysis and handoff generation. |
| `phase_3` | Final synthesis / report assembly. |
| `wave_revision` | Revision planning / future wave workflow. |

---

## 3. Phase Status

**Canonical phase status values (`evaluation_jobs.phase_status`):**

```text
pending | queued | running | complete | failed | awaiting_approval
```

**Reject stored variants:**

```text
completed | processing | starting | pending_approval | waiting_approval | approved
```

Notes:

- `awaiting_approval` is valid only for the review gate checkpoint.
- Do not use `queued` as the review-gate waiting state; use `awaiting_approval`.

---

## 4. Review Gate

The review gate is mandatory between Phase 1A and Phase 2.

**Canonical fields / artifacts:**

```text
phase = 'review_gate'
phase_status = 'awaiting_approval'
review_gate_entered_at
review_gate_passed_at
accepted_story_ledger_v1
ledger_user_feedback_v1
```

**Invariant:** no job may enter `phase_2`, `phase_3`, or `status = 'complete'` unless:

```text
accepted_story_ledger_v1 exists
ledger_user_feedback_v1 exists
review_gate_passed_at is not null
```

Watchdog/rescue logic may return a job to `review_gate`, but must not skip it.

---

## 5. Primary Keys and Foreign Keys

**Primary key:** always `id`.

**Canonical foreign keys:**

| Table | Column | References |
|---|---|---|
| `evaluation_jobs` | `manuscript_id` | `manuscripts.id` |
| `evaluation_artifacts` | `job_id` | `evaluation_jobs.id` |
| `manuscript_chunks` | `manuscript_id` | `manuscripts.id` |

**Reject redundant or synonymous FK names for evaluation artifacts:**

```text
eval_job_id | evaluation_job_id
```

If a different table already has `evaluation_job_id`, do not blindly rename it without checking schema ownership. But for `evaluation_artifacts`, the FK is `job_id`.

---

## 6. Phase 1A Story Layer / Story Ledger

**Canonical stored artifact type:**

```text
pass1a_story_layer_v1
```

**Human/product label allowed:**

```text
Story Layer / Story Ledger
```

**Reject stored artifact type:**

```text
pass1a_story_ledger_v1
```

Contract:

- Phase 1A produces one canonical Story Layer artifact: `pass1a_story_layer_v1`.
- It contains 8 required layers.
- Do not create separate “ledger” artifacts unless intentionally adding a canonical artifact type and downstream migration.
- Prompt text, runtime code, SQL checks, and tests must use `pass1a_story_layer_v1`.

---

## 7. Evaluation Artifacts

**Canonical table:**

```text
evaluation_artifacts
```

**Canonical discriminator:**

```text
artifact_type
```

High-value artifact types in the current evaluation path:

```text
phase1a_chunk_routing_manifest_v1
pass1a_chunk_cache_v1
pass3_preflight_draft_v1
pass1a_character_ledger_v1
pass1a_story_layer_v1
ledger_quality_report_v1
accepted_story_ledger_v1
ledger_user_feedback_v1
pass12_handoff_v1
evaluation_result_v2
longform_document_v1
```

UI-level labels such as `analysis`, `report`, `evaluation`, or `story ledger` must not double as stored artifact types.

---

## 8. Claim, Lease, and Worker Ownership

Use one concurrency vocabulary: **claim / lease / heartbeat**.

Canonical writable fields:

```text
claimed_by
claimed_at
worker_id
lease_token
lease_until
worker_pulse_at
last_heartbeat_at
```

**Writable lease expiry field:**

```text
lease_until
```

**Do not write:**

```text
lease_expires_at
```

`lease_expires_at` may exist as a generated/read-only compatibility field in some schema contexts, but runtime writes must target `lease_until`.

A `running` job must have a durable owner/lease trail. At minimum, do not allow `status = 'running'` with both `worker_id` and `claimed_by` missing and no `lease_until`.

---

## 9. Time Semantics

Each timestamp has one meaning only.

| Field | Meaning |
|---|---|
| `created_at` | Immutable creation time |
| `updated_at` | Last row update; not a heartbeat substitute |
| `started_at` | First transition into running |
| `completed_at` | Terminal success timestamp |
| `failed_at` | Terminal failure timestamp |
| `claimed_at` | Worker claim timestamp |
| `lease_until` | Writable lease expiry |
| `worker_pulse_at` | Worker liveness pulse |
| `review_gate_entered_at` | Review gate opened |
| `review_gate_passed_at` | User approved review gate |

**Forbidden:** using `updated_at` alone as proof of worker liveness.

---

## 10. Manuscript vs Project vs Submission

**Canonical internal work object:**

```text
manuscript
```

All internal evaluation logic references `manuscript_id`.

Reserve `project`, `submission`, `document`, and `work` for distinct entities with distinct tables. Do not use them interchangeably in persistence logic.

---

## 11. Chunks

**Canonical index:**

```text
chunk_index
```

Text ranges:

```text
char_start = inclusive
char_end = exclusive
```

Chunk status values should stay in the same status family used by the owning table. Do not introduce `done` or `completed` as stored chunk status values.

---

## 12. Attempts, Retries, and Priority

Canonical fields:

```text
attempt_count
max_attempts
next_attempt_at
priority
```

Reject aliases unless deliberately modeled:

```text
retries | try_count | max_retries | next_run_at
```

Self-chain requeues that are normal continuation should not increment `attempt_count`.

---

## 13. Errors

Canonical error fields:

```text
error_code
error_message
error_at
error_detail
```

Avoid mixing `error`, `last_error`, `failure_reason`, and `pipeline_failure` without a documented contract. Pipeline envelopes may exist, but they must expose machine-readable `error_code` and phase/pass location.

---

## 14. RPCs and Verbs

Standard verbs:

```text
claim | lease | heartbeat | finalize | complete | requeue | retry | rescue
```

RPC names should use `verb + domain`, for example:

```text
claim_evaluation_jobs
claim_evaluation_job_by_id
admin_reset_evaluation_job
```

Do not create parallel verbs for the same operation unless one is explicitly deprecated.

---

## 15. Auth, Roles, Plans

One source of truth should govern user roles/entitlements. Central helpers should enforce role checks.

Do not scatter plan strings, role strings, or admin checks across unrelated modules without a helper or documented contract.

---

## 16. Environment Flags

One helper module should interpret worker/runtime environment flags. Each flag should represent one concern.

Important worker/runtime flags must have clear scoping:

```text
CRON_SECRET
WORKER_KICKOFF_BASE_URL
NEXT_PUBLIC_APP_URL
VERCEL_URL
EVAL_PHASE1A_BATCH_SIZE
EVAL_PHASE1A_INVOCATION_BUDGET_MS
EVAL_WORKER_MAX_EXECUTION_MS
EVAL_PASS3B_MAX_TOKENS
```

Avoid ad-hoc `process.env.X` checks scattered across files where a config helper exists.

---

## Canon Enforcement & Audit Process

### Required drift scans

Use these as review aids. They are noisy by design; evaluate context before editing.

```bash
# Phase drift
rg "phase1|phase2|phase3|phase_1\b|phase_1_a|phase0|approval_gate|user_gate"

# Completion-state drift
rg "completed|succeeded|done|error"

# Evaluation artifact FK drift
rg "evaluation_job_id|eval_job_id"

# Story Layer / Story Ledger artifact drift
rg "pass1a_story_ledger_v1|pass1a_story_layer_v1"

# Lease field drift
rg "lease_expires_at|lease_until"

# Review gate drift
rg "awaiting_approval|pending_approval|approval_gate|review_gate"
```

### Audit output must include

1. Canonical domain name
2. All detected aliases and locations
3. Whether each occurrence is storage/runtime code, test, doc, or display-only text
4. Required code edits
5. Required DB migrations, if any
6. Verification commands

---

## E2E Forensic Checklist

For copy-safe SQL and live evaluation readiness checks, use:

```text
docs/evaluation/E2E_EVALUATION_FORENSIC_CHECKLIST.md
```

That checklist is the canonical place for E2E SQL and Vercel/Supabase proof steps. Keep ad-hoc chat SQL synchronized with that document.

---

## Compliance

All new code, migrations, and types must:

1. Use canonical persistence terms exclusively.
2. Document display-layer translations explicitly.
3. Avoid creating parallel stored labels for the same concept.
4. Pass targeted vocabulary drift tests when present.
5. Include an E2E proof path when touching evaluation orchestration.

