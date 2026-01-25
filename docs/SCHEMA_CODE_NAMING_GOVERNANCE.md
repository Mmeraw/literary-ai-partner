# Schema & Code Naming Governance

**Scope:** Database schema, TypeScript types, and persistence-layer vocabulary for jobs, phases, chunks, artifacts, manuscripts, ownership, auth, time semantics, errors, RPCs, and environment flags

**Applies to:** Database tables/columns/enums, TypeScript types, RLS policies, RPCs, background workers, and all persistence-level logic

## Purpose

To prevent vocabulary drift—the silent divergence of names, enums, and concepts across DB, TypeScript, RLS, RPCs, and UI—which is a primary cause of subtle bugs, broken RLS, incorrect job orchestration, and unprovable system behavior.

This document defines a single canonical contract for naming and semantics. All persistence layers must comply. UI and logs may translate for display only and must never introduce new stored variants.

---

## Canon Principle

For every domain concept (e.g., job status, phase, chunk state, ownership, artifact type):

- **Exactly one canonical name and enum set exists**
- **DB schema and TypeScript types are the source of truth**
- **UI, logs, and display labels may translate but never persist alternates**
- **Banned aliases must not appear in stored data, enums, or column names**

---

## Canon Domains and Rules

### 1. Job Lifecycle

**Canonical job status enum (DB + TS):**
```
queued | running | succeeded | failed | canceled
```

**Forbid stored variants such as:**
- `completed`, `done`, `error`

**If intra-phase state is needed, use a distinct `phase_status` enum:**
```
pending | running | complete | failed
```

---

### 2. Phases

**Canonical stored values:**
```
phase_0 | phase_1 | phase_2
```

**Stored values must never use:**
- `phase1`, `Phase 1`, `p1`, `phase1Eligible`

**UI and logs may display friendly labels** mapped from canonical values.

---

### 3. Ownership and Identity

**Every user-owned row must include:**
```sql
user_id UUID NOT NULL
```

**RLS rule:**
```sql
auth.uid() = user_id
```
*(no casts, no alternates)*

**If creator ≠ owner, explicitly add:**
```sql
created_by UUID NULL
```
and document the distinction.

**Ban ambiguous or drifting ownership fields:**
- `owner_id`, `author_id`, etc.

---

### 4. Primary Keys and Foreign Keys

**Primary key:** always `id`

**Foreign keys:** `<referenced_table>_id`
- `evaluation_jobs.manuscript_id` → `manuscripts.id`
- `evaluation_artifacts.job_id` → `evaluation_jobs.id`
- `manuscript_chunks.manuscript_id` → `manuscripts.id`

**Eliminate redundant or synonymous FK names:**
- `eval_job_id`, `evaluation_job_id`

---

### 5. Manuscript vs Project vs Submission

**Canonical internal work object:** `manuscript`

**All internal evaluation logic references:** `manuscript_id`

**Reserve `project`, `submission`, `document`, `work` for distinct entities** with their own tables.

**Do not use these terms interchangeably.**

---

### 6. Chunks

**Canonical index:** `chunk_index` (0-based)

**Text ranges:**
- `char_start` = inclusive
- `char_end` = exclusive

**Chunk status enum:**
```
pending | processing | complete | failed
```

**Forbid:** `done` / `completed` in stored values

**Choose one concurrency vocabulary and stick to it:**
- `claim / lease / heartbeat` **OR** `lock`
- Never mixed

---

### 7. Artifacts (Outputs)

**Canonical table:** `evaluation_artifacts`

**Canonical discriminator:** `artifact_type` (stable enum)

**UI-level labels** (`analysis`, `evaluation`, etc.) must not double as stored types.

**Storage identity:**
- `bucket` + `object_key`

**Public URLs and MIME types** are derived or stored separately, not used as type indicators.

---

### 8. Jobs vs Runs vs Evaluations

**If `evaluation_jobs` is the orchestrator:**
- Treat `job` as canonical
- Either eliminate "run" terminology or model it as a separate table

**Never overload `evaluation_id` to mean both:**
- a DB row ID
- a business-level evaluation concept

---

### 9. Time Semantics

**Each timestamp has one meaning only:**

| Field | Meaning |
|-------|---------|
| `created_at` | Immutable creation time |
| `started_at` | First transition into `running` |
| `heartbeat_at` | Worker liveness signal |
| `completed_at` | Terminal success |
| `failed_at` | Terminal failure |
| `lease_expires_at` | Concurrency control |

**Forbidden:** Using `updated_at` as heartbeat or "last seen" logic.

---

### 10. Attempts, Retries, Priority

**Canonical fields:**
- `attempt_count`
- `max_attempts`
- `next_run_at`
- `priority`

**Deprecate:** `retries`, `try_count`, `max_retries`, etc.

---

### 11. Errors

**Canonical error triad:**
- `error_code` (machine-readable)
- `error_message` (human-readable)
- `error_at` (timestamp)

**Optional:** `error_detail` (JSON/text)

**Avoid mixing** `error`, `last_error`, `failure_reason` without a defined contract.

---

### 12. RPCs and Verbs

**Standard verbs:**
- `claim / lease`
- `heartbeat`
- `finalize / complete`
- `requeue / retry`

**RPC names must follow:** `verb + domain`
- `claim_chunk_for_processing`
- `finalize_job`

**Do not create parallel verbs for the same operation.**

---

### 13. Auth, Roles, Plans

**Single source of truth table** (e.g., `user_roles` or `user_entitlements`) keyed by `user_id`

**Central helpers for RLS and code:**
- `is_admin(user_id)`
- `has_role(user_id, role)`

**One `CurrentUser` type in code**

**Ban scattered role/account/plan strings**

---

### 14. Environment Flags

**One helper module interprets all environment flags**

**Each flag represents one concern**

**Forbid ad-hoc `process.env.X` checks scattered across files**

---

## Canon Enforcement & Audit Process

### Canon Registry

Maintain a **CANONICAL_TERMS.md** (or Canon Vocabulary section) listing per domain:
- Canonical term / enum values
- Explicitly banned aliases
- Tables and types where enforcement applies

### Vocabulary Drift Audit

Periodically scan the repo for known drift clusters:

```bash
# Phases
rg "phase1|phase2|phase_1|phase_2|phase0|phase_0"

# Completion states
rg "completed|complete|done"

# Ownership
rg "owner_id|created_by|user_id|author_id"

# Job IDs
rg "job_id|eval_job_id|evaluation_job_id"

# Artifacts
rg "artifact|output"

# Work units
rg "project_id|work_id|document_id|submission_id|manuscript_id"
```

### Audit Output Must Include

1. Canonical domain name
2. All detected aliases and locations
3. Required code edits (files/lines)
4. Required DB migrations (rename-only; no behavior changes)

---

## Canon Outcome

This contract ensures:

✅ **RLS correctness and provability**

✅ **Deterministic job orchestration**

✅ **Clear mental models across DB, TS, and workers**

✅ **Reduced bug surface from semantic ambiguity**

✅ **Long-term maintainability as the system scales**

---

## Compliance

All new code, migrations, and types must:
1. Reference this document during design review
2. Use canonical terms exclusively in persistence layers
3. Document any display-layer translations explicitly
4. Pass vocabulary drift audits before merge

**Last Updated:** 2026-01-25
