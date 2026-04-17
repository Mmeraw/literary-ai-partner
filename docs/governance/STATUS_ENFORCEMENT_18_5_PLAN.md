# Item #18.5 — Runtime Status Contract Wiring

## Purpose

Wire live evaluation job writes to the canonical status contract introduced in PR #151.

This is an execution PR, not a doctrine PR.

## Scope

Enforce three runtime rules:

1. lifecycle writes must go through `normalizeEvaluationJobStatus(...)`
2. lifecycle transitions must go through one canonical validator
3. validity must be written separately and never inferred from lifecycle

## Canonical contracts

### Lifecycle status
`queued | running | complete | failed`

### Validity status
`pending | valid | invalid | quarantined`

Definitions:
- `pending` — not yet adjudicated
- `valid` — passes release criteria, safe to surface
- `invalid` — adjudicated and blocked
- `quarantined` — held back due to integrity/trust anomaly; distinct from invalid

## Canonical ownership

Before rewiring, confirm the single source of truth for:

- `EvaluationJobStatus`
- `assertValidJobStatusTransition(...)`

Do **not** allow parallel owners in:
- `lib/evaluation/status.ts`
- `lib/jobs/types.ts`
- `lib/jobs/transitions.ts`

Rule:
- if `lib/evaluation/status.ts` is the canonical owner, downstream code imports from there
- if `lib/jobs/*` already owns lifecycle truth, `lib/evaluation/status.ts` must delegate or re-export

There must be exactly one canonical lifecycle type owner and one canonical transition validator.

## Allowed lifecycle transitions

Only these transitions are valid:

- `queued -> running`
- `queued -> failed`
- `running -> complete`
- `running -> failed`

Blocked examples:
- `queued -> complete`
- `complete -> running`
- `failed -> complete`

## Write hub map

### Enforced hub
- `lib/jobs/jobStore.supabase.ts`

This is the primary write surface for `evaluation_jobs.status` and, when present, `validity_status`.

### Verification-only touch points
- `claimJob.ts`
- `processor.ts`
- `finalize.ts`

These files should be checked only to ensure they do not bypass the store or persist raw lifecycle values directly.

## File-by-file plan

### 1) `lib/jobs/jobStore.supabase.ts`
Primary work happens here.

Required changes:
- route every lifecycle write through `normalizeEvaluationJobStatus(...)`
- validate every lifecycle transition through `assertValidJobStatusTransition(from, to)` before persistence
- keep validity writes explicit and separate
- do not infer validity from lifecycle
- do not introduce new lifecycle values

### 2) `claimJob.ts`
Check caller behavior only.

Confirm:
- claim path uses the store
- persisted transition is `queued -> running`
- no raw status writes bypass the hub

### 3) `processor.ts`
Check processing/failure paths only.

Confirm:
- success path ends as `running -> complete`
- failure path ends as `running -> failed`
- no raw status persistence bypasses the hub
- no stage-specific lifecycle states are introduced

### 4) `finalize.ts`
Check validity handling only.

Confirm:
- validity is written explicitly, not inferred
- valid completion can write:
  - `status='complete'`
  - `validity_status='valid'`
- invalid completion can write:
  - `status='complete'`
  - `validity_status='invalid'`
- quarantined completion can write:
  - `status='complete'`
  - `validity_status='quarantined'`

## Non-goals

This PR does **not** do any of the following:

- no DB migration
- no `validity_status` backfill
- no DB CHECK constraints
- no new lifecycle states
- no inferred validity
- no UI cleanup
- no progress-model changes

Those belong to #18.6 or later work.

## Acceptance criteria

18.5 is done when:

- no raw lifecycle writes bypass the canonical normalizer
- no lifecycle transition is persisted without validator approval
- validity writes are explicit and separate
- retry/failure semantics still work under the 4-state lifecycle
- no new lifecycle vocabulary appears in runtime code

## Test checklist

Before merge, confirm:

### Unit / targeted
- canonical status tests still pass
- transition guard tests still pass

### Runtime behavior
- `queued -> running`
- `running -> complete`
- `running -> failed`

### Blocked transitions
- `queued -> complete` is blocked
- `complete -> running` is blocked
- `failed -> complete` is blocked

### Validity separation
- `status='complete'`, `validity_status='valid'`
- `status='complete'`, `validity_status='invalid'`
- `status='complete'`, `validity_status='quarantined'`

## Merge note

Keep #18.5 surgical.

If a change does not directly support runtime enforcement of the canonical lifecycle/validity contract, it belongs in a different PR.
