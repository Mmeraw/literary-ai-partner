# Phase Architecture v2 — Concurrent Preflight Track

Status: canonical architecture proposal for evaluation orchestration alignment.
Scope: evaluation lifecycle naming, orchestration boundaries, preflight gating, and post-evaluation WAVE placement.

## Why this exists

The codebase currently contains overlapping architecture vocabulary:

- `runPipeline.ts` uses an older Pass 1 / Pass 2 / Pass 3 / Pass 4 vocabulary, where Pass 4 is the deterministic Quality Gate.
- `processor.ts` uses a newer job-phase relay vocabulary: Phase 0, Phase 1A, Review Gate, Phase 2, Phase 3.
- Pass 3A preflight exists as an independent full-manuscript reader concept, but it must be treated as its own lane rather than an implicit side effect of Phase 1A.
- WAVE Revision exists separately from the deterministic Quality Gate and must not be renamed to Pass 4 unless a full repo-wide migration retires the old Pass 4 name everywhere.

This document defines the canonical lifecycle so future runtime work has one source of truth.

## Canonical lifecycle

```text
Submit manuscript
  ↓
Phase 0 — Governance Warmup
  ↓
Chunk Routing Manifest
  ↓
Parallel Tracks
  ├─ Track B — Phase 1A Story Layer
  └─ Track C — Pass 3A Preflight Scout
  ↓
Review Gate
  ↓
Phase 2 — Criteria Analysis
  ↓
Phase 3B — Synthesis
  ↓
Quality Gate — deterministic validation
  ↓
WAVE Revision — eligible long-form revision planning
  ↓
DREAM / Longform Report
  ↓
Complete
```

## Phase 0 — Governance Warmup

Phase 0 is governance-only.

It must not evaluate manuscript content.

Responsibilities:

- Load golden records.
- Load lessons learned.
- Load playbooks.
- Load scoring contract.
- Prove calibration before manuscript-reading tracks launch.

Required invariant:

```text
Phase 1A and Pass 3A must not start until Phase 0 proof exists.
```

## Chunk Routing Manifest

The chunk routing manifest prepares durable manuscript segmentation for downstream readers.

Responsibilities:

- Resolve canonical manuscript text.
- Materialize or verify chunks.
- Persist a durable routing manifest.
- Provide shared chunk ordering for Phase 1A and Pass 3A.

Required invariant:

```text
Track B and Track C may launch only after the chunk routing manifest is durable.
```

## Track B — Phase 1A Story Layer

Phase 1A owns story-layer and ledger production.

Responsibilities:

- Deep per-chunk ledger work.
- Character / story layer extraction.
- Story Layer assembly.
- Ledger quality assessment.

Required outputs:

- `pass1a_story_layer_v1`
- `ledger_quality_report_v1`

Phase 1A does not own Pass 3A preflight completion.

## Track C — Pass 3A Preflight Scout

Pass 3A is an independent full-manuscript reader.

Responsibilities:

- Run chunk MAP work independently of Phase 1A.
- Aggregate chunk observations into act/zone summaries.
- Run REDUCE only after all required MAP chunks complete.
- Persist preflight evidence for Phase 3B synthesis.

Required output when successful:

- `pass3_preflight_draft_v1`

Allowed completion modes:

- `done` — preflight draft exists and completion metadata exists.
- `degraded` — structured degradation proof exists and no misleading partial preflight is treated as complete.

Failed is not an allowed gate-satisfying state.

Required invariant:

```text
Pass 3A REDUCE must wait until all MAP chunks are complete.
```

## Review Gate

The Review Gate is a derived state, not a manually asserted truth.

It may open only when all three conditions are satisfied:

1. `pass1a_story_layer_v1` exists.
2. `ledger_quality_report_v1` exists.
3. Pass 3A is terminal-and-gate-valid.

Pass 3A terminal-and-gate-valid means:

```text
DONE:
  pass3a_status = 'done'
  AND pass3_preflight_draft_v1 exists
  AND completion metadata exists

OR

DEGRADED:
  pass3a_status = 'degraded'
  AND structured degradation proof exists
```

Failed is terminal but gate-blocking:

```text
pass3a_status = 'failed' must block Review Gate and Phase 2.
```

## Phase 2 — Criteria Analysis

Phase 2 may start only after Review Gate approval and Pass 3A gate validity.

Required invariant:

```text
Phase 2 must not start if Pass 3A is missing, running, half-written, or failed.
```

## Phase 3B — Synthesis

Phase 3B consumes Phase 2 outputs and Pass 3A preflight where available.

Responsibilities:

- Synthesize the evaluation result.
- Preserve evidence and confidence boundaries.
- Produce `evaluation_result_v2` and longform artifacts where applicable.

## Quality Gate

The Quality Gate is deterministic validation.

Do not call this WAVE.

It may validate output shape, confidence, evidence, propagation, governance, and artifact integrity.

## WAVE Revision

WAVE Revision is a post-evaluation revision-plan system for eligible long-form manuscripts.

It is separate from the deterministic Quality Gate.

Expected outputs where applicable:

- `wave_revision_plan_v1`
- `wave_runs`
- revision session metadata

## Naming rules

- Pass 3A is not Phase 0.
- Pass 3A must never be classified as Phase 0 in logs, UI, progress, or governance docs.
- Quality Gate is not WAVE.
- WAVE is not Pass 4 unless the legacy Pass 4 Quality Gate name is retired repo-wide.
- Phase 1A is the Story Layer lane.
- Pass 3A is the Preflight Scout lane.
- Review Gate readiness is derived from artifacts and gate-valid states.

## Progress ladder

| State | Progress |
|---|---:|
| Queued | 2% |
| Phase 0 calibrating | 5% |
| Chunk routing / manuscript prep | 10% |
| Phase 1A + Preflight reading in parallel | 15–40% |
| 3A REDUCE + Story Layer assembly | 42–47% |
| Review Gate | 50% |
| Phase 2 criteria analysis | 60–75% |
| Phase 3B synthesis | 80–92% |
| DREAM longform | 95–99% |
| Complete | 100% |

## Hard rules

- Phase 0 must complete before manuscript-reading tracks launch.
- Track B and Track C require durable chunk routing manifest.
- Track B and Track C are independently throttled.
- No unbounded concurrency.
- Pass 3A REDUCE waits for all MAP chunks.
- Review Gate requires Story Layer, ledger quality report, and Pass 3A terminal-and-gate-valid state.
- Phase 2 refuses missing, running, half-written, or failed Pass 3A.
- Degraded is gate-valid only with structured proof.
- Failed is never gate-valid.
