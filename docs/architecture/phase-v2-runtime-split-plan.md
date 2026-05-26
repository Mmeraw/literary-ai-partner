# Phase Architecture v2 — Runtime Split Plan

Status: staged implementation plan.
Scope: safe sequence for splitting Pass 3A into an independent Track C without destabilizing Phase 1A, Review Gate, Phase 2, or existing evaluation persistence.

## Objective

Move from the current mixed lifecycle to Phase Architecture v2:

```text
Phase 0
  ↓
Chunk Routing Manifest
  ↓
Parallel Tracks
  ├─ Track B — Phase 1A Story Layer
  └─ Track C — Pass 3A Preflight Scout
  ↓
Review Gate
  ↓
Phase 2
  ↓
Phase 3B
  ↓
Quality Gate
  ↓
WAVE Revision
```

The first runtime goal is not speed. The first runtime goal is correctness.

## Non-goals

- Do not rename WAVE to Pass 4.
- Do not rename deterministic Quality Gate unless doing a full repo-wide migration.
- Do not introduce unbounded concurrency.
- Do not allow Phase 2 to start from partial preflight.
- Do not treat failed Pass 3A as degraded.
- Do not rewrite scoring, synthesis, or WAVE semantics in the same PR as lane separation.

## Implementation sequence

### PR A — Canon and naming freeze

Already represented by `phase-architecture-v2.md`.

Required outcomes:

- One architecture source of truth exists.
- Pass 3A is named as Preflight Scout.
- Phase 1A is named as Story Layer lane.
- Quality Gate and WAVE are distinct.
- Failed vs degraded semantics are explicit.

### PR B — Pass 3A gate validity contract

Already represented by `pass3a-gate-validity-contract.md`.

Required outcomes:

- `done` requires successful artifact proof.
- `degraded` requires structured degradation proof.
- `failed` is terminal but gate-blocking.
- Review Gate readiness is derived, not hand-set.
- Phase 2 requires Pass 3A terminal-and-gate-valid.

### PR C — Progress/state model support

Add or standardize progress fields in the job progress JSONB contract:

```text
phase0_status
chunk_manifest_status
phase1a_status
pass3a_status
pass3a_gate_validity
pass3a_map_status
pass3a_reduce_status
review_gate_ready
```

Rules:

- `review_gate_ready` is derived from artifacts and gate-valid state.
- `pass3a_gate_validity` is derived from `pass3a_status` plus artifact/degradation proof.
- Missing fields default to not-ready / gate-blocking, not success.

Recommended helper functions:

```text
derivePass3aGateValidity(progress, artifacts)
deriveReviewGateReadiness(progress, artifacts)
assertPhase2Preconditions(progress, artifacts)
```

### PR D — Track C extraction

Extract Pass 3A from the Phase 1A lifecycle into an independently claimable/resumable Track C.

Requirements:

- Track C starts only after:
  - Phase 0 proof exists.
  - chunk routing manifest is durable.
- Track C does not consume Phase 1A output.
- Track C uses its own throttling/concurrency budget.
- Track C MAP progress is durable.
- Track C REDUCE runs only after all MAP chunks are complete.
- Track C persists `pass3_preflight_draft_v1` on success.
- Track C persists structured degraded status if safe fallback is chosen.
- Track C persists failed status when retry/operator intervention is required.

### PR E — Review Gate hardening

Change Review Gate opening from Story Layer-only readiness to derived three-condition readiness.

Required conditions:

```text
pass1a_story_layer_v1 exists
ledger_quality_report_v1 exists
Pass 3A is terminal-and-gate-valid
```

Gate-valid Pass 3A:

```text
done + pass3_preflight_draft_v1 + completion metadata
OR
degraded + structured degradation proof
```

Blocked states:

```text
not_started
running
map_done
reduce_running
failed
missing artifact with done status
partial artifact without degraded proof
```

### PR F — Phase 2 guard

Add a hard entry guard to Phase 2.

Phase 2 may start only after:

- accepted Story Layer exists.
- all author layer decisions are complete.
- Pass 3A is terminal-and-gate-valid.

If Pass 3A is not valid:

- Do not score.
- Do not silently degrade.
- Return explicit gate-blocking error or requeue depending on state.

Suggested failure/status codes:

```text
PASS3A_NOT_READY
PASS3A_HALF_WRITTEN
PASS3A_FAILED_BLOCKING
PASS3A_ARTIFACT_MISSING
PASS3A_DEGRADED_PROOF_MISSING
```

### PR G — UI/log/progress labels

Update UI and logs to distinguish:

- Phase 0 calibrating
- Chunk routing / manuscript prep
- Phase 1A Story Layer reading
- Pass 3A MAP reading
- Pass 3A REDUCE
- Review Gate
- Phase 2 Criteria Analysis
- Phase 3B Synthesis
- Quality Gate
- WAVE Revision
- DREAM longform

Hard naming rules:

- Pass 3A is never Phase 0.
- Quality Gate is never WAVE.
- WAVE is never Pass 4 unless a full migration retires old Pass 4 usage.

## Runtime safety notes

### Concurrency

Track B and Track C must be throttled independently.

Pass 3A should start conservatively:

```text
MAP concurrency: 1
REDUCE concurrency: 1
```

Track B can keep its existing controlled batch/concurrency model.

### Resume behavior

Pass 3A MAP should persist chunk-level progress so retries do not restart all chunks unnecessarily.

Recommended resume states:

```text
pass3a_status='running'
pass3a_map_status='running'
completed_map_chunks=[...]
pending_map_chunks=[...]
```

REDUCE should be idempotent by source hash and expected chunk count.

### Degradation behavior

Use degradation only when the system can safely continue without a misleading partial artifact.

Examples of possible degraded states:

- all MAP chunks completed but REDUCE timed out; no successful preflight draft exists; structured reduced-authority reason persisted.
- preflight unavailable due to provider timeout after bounded retry; degraded proof persisted; synthesis receives `PREFLIGHT DEGRADED` rather than fabricated preflight.

Do not degrade when:

- source text is missing.
- chunk manifest is invalid.
- MAP coverage is partial and would misrepresent full-manuscript read.
- artifact integrity is ambiguous.

Those should fail/block.

## Acceptance checklist

- [ ] Phase 0 proof gates manuscript-reading tracks.
- [ ] Chunk routing manifest gates Track B and Track C.
- [ ] Pass 3A is independently tracked from Phase 1A.
- [ ] Pass 3A REDUCE waits for all MAP chunks.
- [ ] Review Gate readiness is derived from Story Layer + quality report + Pass 3A gate validity.
- [ ] Phase 2 refuses missing/running/half-written/failed Pass 3A.
- [ ] Failed is not treated as degraded.
- [ ] Degraded requires structured proof.
- [ ] Logs and UI distinguish all major lifecycle states.
- [ ] No WAVE/Quality Gate naming collapse occurs.

## Suggested test coverage

- Phase 1A cannot launch before Phase 0 proof.
- Pass 3A cannot launch before Phase 0 proof.
- Track B and Track C can progress independently after manifest readiness.
- Review Gate blocks when Pass 3A is running.
- Review Gate blocks when Pass 3A failed.
- Review Gate opens when Pass 3A done with artifact.
- Review Gate opens when Pass 3A degraded with structured proof.
- Phase 2 blocks when Pass 3A is half-written.
- Phase 2 blocks when done status lacks artifact.
- Phase 2 blocks when degraded lacks proof.
- Phase 2 proceeds when Pass 3A is terminal-and-gate-valid.
