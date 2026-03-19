# REVISIONGRADE MASTER ROADMAP
*Evaluation → Revision → Trajectory → Signal → Marketplace*

## 1. Purpose

This document defines the authoritative build sequence for RevisionGrade.

It establishes:
- current system state
- completed milestones
- immediate engineering priorities
- forward architecture

This roadmap is binding for sequencing decisions.  
All implementation work should align with the order and invariants defined here.

## 1.1 Canon Authority Chain

RevisionGrade behavior is governed by the canon, not by ad hoc implementation choices.

The order of authority is:
- Canon Doctrine Registry (`REVISIONGRADE CANON DOCTRINE REGISTRY`)
- Volume II — 13 Story Criteria Canon
- Volume II-A — Operational Schema (machine-operational specification)
- Volume III+ — Platform and AI Governance Canons, Execution Architecture

No doctrine may be enforced by the platform unless it appears in the Canon Doctrine Registry with ACTIVE status.

No evaluation or refinement behavior may contradict the constants, thresholds, and envelopes defined in Volume II-A.

---

## 2. Current Authoritative Status (16 Mar 2026)

### Repository state
- Branch: `main`
- PR queue: `0`
- Stage 2: **CLOSED**
- Hydration reliability: **verified**
- Strict apply behavior: **fail-closed and enforced**

### Engine status
- Versioned revision pipeline: **working**
- Source immutability: **guaranteed**
- Finalize/apply: **deterministic under valid anchors**
- Remaining failures: **anchor-quality / proposal-quality only**

---

## 3. Completed (Stage 2 Closure)

### Engine Reliability
- Non-mutating finalize-time hydration
- Newline normalization for strict matching
- Strict fail-closed apply (no silent skips)
- Deterministic version lineage (`v1 → v2`)
- Source version immutability enforcement

### Session Safety
- Stale-session detection and rejection
- Explicit `evaluation_run_id` binding
- Prevention of duplicate apply

### Evidence & Governance
- Stage 2 closure evidence committed:
  - `STAGE2_REVISION_HYDRATION_CLOSURE_EVIDENCE_2026-03-16.md`
- Smoke harness validated across runs
- Failure mode correctly classified as anchor-quality

### Repo Hygiene
- All PRs merged or closed
- Linear history on `main`
- No dangling branches in active queue

---

## 4. NOW (Immediate Engineering Priority)

## Stage 2.5 — Deterministic Anchored Apply
*Targeted hardening of Stage 2 apply.*

### Objective
Eliminate all remaining non-determinism in proposal application.

### Problem
Finalize failures occur when:

```text
original_text not found in source text
```

This is not a system failure.  
It is an anchor-quality failure.

### Required Deliverables

#### 1. Anchor Metadata (mandatory)
Extend `change_proposals` with:
- optional character offsets (`start`, `end`)
- optional context window (`before`, `after`)
- normalized anchor text (optional)

#### 2. Proposal Extraction Contract
Ensure:
- `original_text` is taken from exact hydrated source
- no whitespace drift
- no partial sentence capture

#### 3. Location-Aware Apply (next evolution)
Move from:
- string matching

Toward:
- offset-based application
- context-validated replacement

#### 4. Failure Classification (forward-compatible with Stage 3)
Introduce explicit failure types:
- `ANCHOR_NOT_FOUND`
- `ANCHOR_AMBIGUOUS`
- `EMPTY_SOURCE_TEXT`
- `HYDRATION_FAILURE`
- `NO_ACCEPTED_PROPOSALS`

These must map directly to future:

```text
revision_sessions.failure_code
```

#### 5. Invariants (must not change)
- strict fail-closed behavior remains
- no skip-and-continue logic
- no mutation of source text
- no “best effort” fallback

### Canon Bindings
- Stage 2.5 may not introduce any new rule or behavior that lacks a Canon ID in the Canon Doctrine Registry.
- Stage 2.5 must respect the eligibility gate and scoring constants defined in Volume II-A. No refinement behavior may bypass the eligibility gate once implemented.
- Stage 2.5 changes must preserve the 13-criteria evaluation envelope shape defined in Volume II-A. Proposal logic must not alter or reinterpret criterion keys, bands, or weights.

### Immediate governed execution note
Canon Enforcement Layer work is part of the immediate governed execution path for this stage, not optional follow-on work.

---

## 5. NEXT (Structural Upgrade)

## Stage 3 — Revision Session State Machine + Observability

### Objective
Convert implicit pipeline behavior into explicit persisted state.

### Lifecycle States

```text
open
findings_ready
synthesis_started
proposals_ready
applied
failed
```

### Required Fields (`revision_sessions`)

```text
findings_count
actionable_findings_count
proposal_ready_actionable_findings_count
proposals_created_count
last_transition_at
failure_code
failure_message
```

### Transition Rules
- `open` → `findings_ready`
- `findings_ready` → `synthesis_started`
- `synthesis_started` → `proposals_ready | failed`
- `proposals_ready` → `applied | failed`
- `open` → `failed` (early governed failure only)
- `applied` → terminal
- `failed` → terminal (unless future recovery contract defined)

### Core Mechanism
Single canonical helper:

```text
transitionRevisionSessionState(sessionId, nextState, metadata)
```

Responsibilities:
- validate transitions
- update counters
- stamp timestamps
- persist failure metadata
- reject invalid transitions

### Canon Alignment
- `revision_sessions` readiness and failure states must be mappable from the evaluation envelope fields defined in Volume II-A (`eligibility_gate`, `readiness_state`, `weighted_composite_score`).
- All lifecycle transitions that depend on story viability must ultimately be explainable from the 13 canonical criteria in Volume II and their weights/thresholds in Volume II-A.
- Any new session state that encodes doctrine must correspond to an ACTIVE entry in the Canon Doctrine Registry.

### Why Stage 3 Exists

**Stage 2 made the engine reliable.  
Stage 3 makes it explicit, queryable, scheduler-safe, and UI-friendly.**

---

## 6. AFTER (Observability Layer)

## Telemetry / Dashboard Layer

### Metrics (must derive from Stage 3 fields)
- anchor coverage rate
- finalize success rate
- failure-class distribution
- findings → proposals conversion rate
- proposals → applied conversion rate
- immutability violations (should be zero)

### Outputs
- admin diagnostics panel
- session lifecycle visibility
- failure inspection without log reconstruction

### Canon-Driven Artifacts
- Telemetry and dashboards must be able to reconstruct the Volume II-A evaluation envelope (13 criteria, scores, bands, WCS, `eligibility_gate`, `readiness_state`) from stored data without ad hoc inference.
- Observability surfaces are required to expose the canonical diagnostic signals defined in Volume II once implemented at the engine level.

---

## 7. LATER (Product Layer)

## Stage 3B — Trajectory Engine

### Objective
Track manuscript and author improvement over time.

### Features
- manuscript score history
- revision momentum
- improvement velocity
- longitudinal progression

### Dependency
Requires:
- deterministic apply (Stage 2.5)
- explicit lifecycle + counters (Stage 3)

### Canon Artifact Spine
- Trajectory views must be composed from canonical artifacts, not ad hoc metrics: 13-criteria scorecards, weighted composite history, and eligibility/readiness states as defined in Volume II and Volume II-A.
- External-facing artifacts (for example, agent/publisher reports) must be derivable from `evaluation_artifacts` that conform to the Volume II-A envelope. No external report may rely on fields or interpretations that are not traceable to canon.

---

## 8. Future Stages

### Stage 4 — Signal Engine (ACE)
- agent-facing quality filtering
- manuscript ranking
- confidence scoring

### Stage 5 — Marketplace
- agent discovery layer
- writer → agent connection system

---

## 9. Ordering Rationale

Correct build order:

1. Deterministic apply (Stage 2.5)
2. Explicit lifecycle (Stage 3)
3. Telemetry layer
4. Trajectory/history
5. Signal + marketplace

Reason:  
You cannot build analytics or product layers on top of non-deterministic core behavior.

---

## 10. Non-Negotiable Invariants

These are system laws:
- Source manuscript versions are immutable
- Hydration must never mutate stored source
- Apply must remain strict fail-closed
- No silent skipping of failed proposals
- Lifecycle must be explicitly persisted (Stage 3)
- Counters must agree with actual data rows
- Failures must be classifiable without logs
- All enforceable rules must correspond to ACTIVE doctrines in the Canon Doctrine Registry or to constants explicitly defined in Volume II-A.
- No new criteria, weights, thresholds, or readiness states may be invented at runtime. Exactly 13 canonical criteria must be present in every full evaluation.

---

## 11. Exit Criteria by Phase

### Stage 2.5 Complete When:
- no false-negative anchor matches
- apply is deterministic under valid anchors
- failure cases are consistently classified

### Stage 3 Complete When:
- all sessions have explicit lifecycle states
- smoke asserts state progression
- recovery is state-driven (not inferred)
- counters match proposal rows
- failures persist structured metadata

### Telemetry Layer Complete When:
- all key metrics are queryable
- admin can inspect sessions without logs

---

## 12. One-Line Roadmap

**Next engineering move: deterministic anchored apply, then explicit revision-session state machine.**

### Canon-Safe Restatement
All roadmap execution remains subordinate to the Canon Doctrine Registry and Volume II / Volume II-A specifications.

Roadmap stages may change implementation order, but not canonical doctrine, criteria set, or eligibility rules without a canon version bump and registry update.

---

## 13. Implementation Note for GitHub Copilot

When executing work from this roadmap:
- treat Stage 2.5 as apply-path hardening only
- do not introduce new behavior that weakens governance
- implement Stage 3 only after apply-path determinism is improving
- prefer minimal, auditable changes over broad refactors
- always preserve Stage 2 invariants
- never invent criteria, weights, thresholds, or readiness states outside Volume II-A
- always consult the Canon Doctrine Registry before adding new doctrine

---

## Phase 2.4 Closure Evidence (Current jobs/apply path)

### Scope

Structured failure classification for the current jobs/apply failure path.

### Completed

- 2.4.a Enumerated closed failure-code set
- 2.4.b Persisted structured failure envelope and surfaced `failure_code`
- 2.4.c Added concrete classification-path proof for covered apply failure modes

### Key files

- `lib/errors/revisionCodes.ts`
- `lib/revision/failureClassification.ts`
- `docs/errors/failure-codes.md`
- `lib/jobs/jobStore.supabase.ts`
- `app/api/jobs/[jobId]/route.ts`
- `tests/failures/apply-failure-codes.test.ts`
- `tests/failures/apply-failure-classification-paths.test.ts`
- `tests/api/jobs-endpoint.test.ts`

### Validation command

`npm test -- tests/failures/apply-failure-classification-paths.test.ts tests/failures/apply-failure-codes.test.ts tests/api/jobs-endpoint.test.ts --runInBand`

### Result

- Test Suites: 3 passed, 3 total
- Tests: 42 passed, 42 total

### Covered codes

- `ANCHOR_MISS`
- `ANCHOR_AMBIGUOUS`
- `CONTEXT_MISMATCH`
- `OFFSET_CONFLICT`
- `PARSE_ERROR`
- `INVARIANT_VIOLATION`
- `APPLY_COLLISION`

### Acceptance outcome

- `setJobFailed(...)` persists structured failure data
- `getJob(...)` surfaces `failure_code`
- jobs endpoint returns classified failure info on failed jobs
- no generic/unclassified fallback in covered paths

---

## Post-2.4 execution packet (2.1–2.3 residual hardening)

### Tracker one-liner

Phase 2.4 closed on main at `461a004`; next execution block is engine hardening to lock residual 2.1–2.3 invariants, fail-closed extraction, and `>=99.5%` apply reliability with zero wrong-location edits.

### Canonical anchor contract (single source of truth)

- `start_offset`: inclusive
- `end_offset`: exclusive
- `before_context`: exact preceding slice
- `after_context`: exact following slice

### Execution order

1. 2.1 Anchor enforcement hard-lock
2. 2.1 DB/type/runtime parity
3. 2.2 Fail-closed extraction behavior
4. 2.2 Extraction contract golden set
5. 2.3 Apply harness expansion

### Explicit acceptance refinements

- DB, TS, and validator all reject `start_offset >= end_offset`
- Golden coverage includes mixed smart/curly punctuation
- Apply harness quality gates are split and both mandatory:
  - placement success rate `>=99.5%` on valid anchors
  - wrong-location edits `= 0`

### Operations hardening spec (next artifact)

- See `docs/operations/OPERATIONS_HARDENING_SPEC.md` for SLOs, test matrix, alert thresholds, go/no-go release gates, and rollback playbook.
- See `docs/operations/OPERATIONS_HARDENING_RUNBOOK.md` for verification packs, exact commands, evidence archive expectations, no-go triggers, and release sign-off.
