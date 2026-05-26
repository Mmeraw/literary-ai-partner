# Pass 3A Gate Validity Contract

Status: implementation contract for Phase Architecture v2.
Scope: Pass 3A terminal states, artifact invariants, Review Gate derivation, and Phase 2 entry protection.

## Purpose

Pass 3A is the independent Preflight Scout lane. It must produce a gate-valid terminal state before Review Gate opens or Phase 2 starts.

This contract prevents temporal drift where Phase 2 begins from a missing, running, half-written, partial, or failed preflight.

## Core rule

```text
Degraded is gate-valid only with structured proof.
Failed is terminal but never gate-valid.
```

## Status model

Allowed `pass3a_status` values:

```ts
type Pass3AStatus =
  | 'not_started'
  | 'running'
  | 'map_done'
  | 'reduce_running'
  | 'done'
  | 'degraded'
  | 'failed';
```

Allowed `pass3a_gate_validity` values:

```ts
type Pass3AGateValidity =
  | 'not_ready'
  | 'gate_valid'
  | 'gate_blocking';
```

## Recommended progress fields

```ts
type Pass3AProgress = {
  pass3a_status: Pass3AStatus;
  pass3a_gate_validity: Pass3AGateValidity;

  pass3a_map_status?: 'not_started' | 'running' | 'done' | 'failed';
  pass3a_reduce_status?: 'not_started' | 'running' | 'done' | 'failed' | 'skipped';

  pass3a_artifact_id?: string;
  pass3a_completed_at?: string;

  degraded_reason?: string;
  degraded_reason_codes?: string[];
  degraded_at?: string;

  failed_reason?: string;
  failed_at?: string;
};
```

## Gate-valid states

### Done

`done` is gate-valid only when all are true:

- `pass3a_status === 'done'`
- `pass3_preflight_draft_v1` exists
- completion metadata exists
- the artifact is not marked partial, failed, stale, or degraded

### Degraded

`degraded` is gate-valid only when all are true:

- `pass3a_status === 'degraded'`
- `degraded_reason` exists
- `degraded_reason_codes` exists and is non-empty
- `degraded_at` exists
- no misleading partial `pass3_preflight_draft_v1` is treated as complete

Degraded means the system intentionally chose a safe fallback that preserves pipeline semantics.

### Failed

`failed` is never gate-valid.

Failed means retry or operator intervention is required.

A failed Pass 3A must block:

- Review Gate opening
- Phase 2 start
- any claim that preflight is available

## Derived Review Gate rule

`review_gate_ready` must be derived, not hand-set.

Pseudo-code:

```ts
const storyLayerReady = Boolean(pass1a_story_layer_v1);
const qualityReportReady = Boolean(ledger_quality_report_v1);

const pass3aDoneValid =
  progress.pass3a_status === 'done' &&
  Boolean(pass3_preflight_draft_v1) &&
  Boolean(progress.pass3a_completed_at);

const pass3aDegradedValid =
  progress.pass3a_status === 'degraded' &&
  Boolean(progress.degraded_reason) &&
  Array.isArray(progress.degraded_reason_codes) &&
  progress.degraded_reason_codes.length > 0 &&
  Boolean(progress.degraded_at);

const pass3aGateValid = pass3aDoneValid || pass3aDegradedValid;

const reviewGateReady =
  storyLayerReady &&
  qualityReportReady &&
  pass3aGateValid;
```

Explicit blocker:

```ts
if (progress.pass3a_status === 'failed') {
  reviewGateReady = false;
}
```

## Phase 2 guard

Phase 2 must refuse to start unless Pass 3A is terminal-and-gate-valid.

Allowed:

- `pass3a_status='done'` with valid `pass3_preflight_draft_v1`
- `pass3a_status='degraded'` with structured degradation proof

Blocked:

- `not_started`
- `running`
- `map_done`
- `reduce_running`
- `failed`
- missing progress fields
- missing artifact where status claims done
- partial artifact without degraded proof

## Artifact invariants

### `pass3_preflight_draft_v1`

When present as a successful artifact, it must include enough metadata to prove:

- source job id
- manuscript id
- chunk count or coverage basis
- map completion proof
- reduce completion proof
- generated timestamp
- artifact version

### Degraded artifact / degraded status

When degraded, persist structured proof such as:

```json
{
  "status": "degraded",
  "reason": "PASS3A_REDUCE_TIMEOUT",
  "reason_codes": ["PASS3A_REDUCE_TIMEOUT"],
  "map_chunks_completed": 42,
  "map_chunks_expected": 42,
  "reduce_completed": false,
  "safe_to_continue": true,
  "generated_at": "2026-05-26T00:00:00.000Z"
}
```

Do not treat a partial preflight draft as a successful `done` artifact.

## Logging rules

Logs must distinguish:

- `pass3a_map_started`
- `pass3a_map_completed`
- `pass3a_reduce_started`
- `pass3a_reduce_completed`
- `pass3a_degraded`
- `pass3a_failed`
- `pass3a_gate_valid`
- `pass3a_gate_blocking`

Pass 3A logs must not be labeled Phase 0.

## Acceptance criteria

- Review Gate readiness is derived from artifact existence plus Pass 3A gate validity.
- `failed` never satisfies Review Gate.
- `degraded` satisfies Review Gate only with structured proof.
- Phase 2 refuses missing, running, half-written, or failed Pass 3A.
- Done status without `pass3_preflight_draft_v1` is treated as gate-blocking.
- Partial preflight cannot masquerade as done.
