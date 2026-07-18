# RevisionGrade Final Architecture Roadmap

- **Status date:** 2026-07-18
- **Current baseline:** `666d48e2`
- **Authority:** This file is the single canonical roadmap for the repository.

All older roadmap ledgers, CSV mirrors, spreadsheets, phase notes, session summaries, archived planning artifacts, and stale branch audits are non-authoritative. They must not be used to determine current execution order.

---

## Governing Principle

> **No new authority. Only stronger proof of existing authority.**

The remaining roadmap must strengthen proof, enforcement, parity, and presentation of the existing canonical evaluation architecture. It must not introduce competing sources of truth, renderer-owned semantics, or convenience fallbacks that bypass governance.

---

## Archived Promotion Sentinel

The prior U2/U3 promotion work remains complete and enforced. This sentinel is retained for existing CI governance continuity and is not a new roadmap phase.

```text
U2: ENFORCED
U3: ENFORCED
```

---

## Roadmap Summary

```text
1219 ✓
1223 ✓
1224 ✓
1220 ✓
1222 ✓

────────────────────────────

1225 ✓
Semantic Parity Proof
+
Semantic Golden Masters

────────────────────────────

Presentation Governance   ← active architectural phase

↓

Renderer Completion

↓

Presentation Golden Masters

↓

Production Readiness

↓

Launch
```

---

## Current Repository Execution — 2026-07-18

This section records the current implementation tracks on `main`. It is subordinate to the architectural phases below and does not create a competing roadmap authority.

### Recently Completed — Held Recovery

The repository now contains the durable Held Recovery chain through retry schedule persistence:

```text
Recovery executor
↓
Durable attempt record
↓
Queue transition policy
↓
Queue transition writer
↓
Retry policy decision
↓
Retry schedule writer
↓
Durable retry schedule record
```

Completed boundaries include:

- Recovery executor and dispatcher contract.
- Runtime input construction and orchestration boundary.
- Durable attempt recorder.
- Queue transition policy.
- Queue transition writer.
- Retry policy.
- Retry schedule writer and durable schedule persistence — PR #1333, merged on `main`.

### Active Highest-Priority Proof Lane — Issue #1260

**Owner:** Devin

**Goal:** Prove that author decisions made in the Revise Workbench survive every authority and persistence boundary and determine the final revised manuscript.

```text
Evaluation artifact
↓
Persisted revision opportunity ledger
↓
Workbench queue classification
↓
Rendered card
↓
Author decision persistence
↓
Reload / rehydration
↓
Final Review
↓
Revised manuscript apply / export
```

The three paths must be traced independently:

1. `copy_paste_rewrite`
2. `revision_strategy`
3. `withheld`

Required proof questions:

- Do candidates B and C survive persistence and reload?
- Does `finalDecision.cardType` remain authoritative over stale mirrored fields?
- Does a persisted author selection of candidate A, B, or C reach Final Review unchanged?
- Does revised-manuscript generation apply the selected candidate rather than defaulting to A?
- Is accepted text applied exactly once at the authoritative anchor?
- Are `revision_strategy` and `withheld` cards prevented from directly mutating the manuscript?
- Do reload and rehydration read the authoritative persisted decision rather than reconstructing or inferring it from stale payload data?

Required first deliverables:

- Repository-grounded boundary map.
- Production file and symbol inventory for every boundary.
- Authoritative input, persisted record, reload source, and derived/mirrored fields for every boundary.
- Existing-test inventory.
- Characterization tests for confirmed and suspected loss points.
- Exact changed-file proposal.
- Smallest correction plan.

Execution rule:

> No production fix may begin until characterization tests establish the failing authority boundary and the smallest correction scope has been reported.

Explicitly out of scope for issue #1260:

- Held Recovery retry policy.
- Retry schedule writer, table, or RPC.
- Retry workers, polling, claiming, or dispatch.
- Queue transition policy or writer.
- Evaluation scoring, prompts, or Quality Gate thresholds.
- Broad Workbench UI styling.

### Next Held Recovery Infrastructure Lane — Not Yet Approved for Implementation

The next possible isolated lane is:

```text
Durable retry schedule
↓
Due-schedule eligibility
↓
Atomic claim / lease
↓
Dispatcher invocation
```

Before implementation, this lane requires a read-only boundary audit covering:

- Existing workers, cron jobs, watchdogs, routes, and queue pollers that could own schedule consumption.
- Authoritative definition of `due`.
- Stale or superseded checks at claim time.
- Lease, expiry, reclaim, and crash-recovery semantics.
- Deterministic claim outcomes.
- Idempotency boundaries.
- Crash windows between claim, dispatch, attempt recording, and queue transition.
- Expected migrations and changed-file scope.
- Collision analysis against issue #1260.

Do not wire a due-schedule consumer into production until this audit is complete and implementation is explicitly approved.

### Current Execution Priority

1. Complete the #1260 Workbench-to-manuscript authority proof.
2. Fix only confirmed loss points with the smallest test-backed correction.
3. Prove author selections survive persistence, reload, Final Review, and manuscript export.
4. Keep strategy and withheld paths outside direct manuscript mutation.
5. Only then decide whether the due-schedule claim/dispatcher lane is the next implementation priority.

---

## Phase 0 — Complete Integrity

**Goal:** The canonical evaluation cannot be fabricated, silently altered, or partially enforced.

### Completed

- ✅ #1219 — Workbench integrity
- ✅ #1223 — Withheld-card visibility
- ✅ #1224 — Normalization hardening
- ✅ #1220 — Remaining RevisionPackage padding
- ✅ #1222 — Certification ENFORCE rollout

Phase 0 is complete. All Phase 0 issues are closed.

### Exit Criteria

- No fabricated diagnostics.
- No inferred filler where certification requires evidence.
- Certification policy is fully enforced.
- Integrity tests are green in CI.

---

## Phase 1 — Proof of Canonical Semantics

- **Issue:** #1225 — ✅ closed / complete
- **Goal:** Prove there is one canonical evaluation rendered four different ways.
- **Status:** Complete. The claim below is unlocked; Presentation Governance (Phase 2) is the active architectural phase.

```text
UED
↓
ViewModel
↓
Web
PDF
DOCX
TXT
↓
Identical semantics
```

### Deliverables

- ViewModel completeness proof.
- Renderer semantic parity harness.
- Canonical accessor usage for renderer-facing fields.
- Missing-field fail-closed behavior.
- Semantic Golden Masters.
- CI parity verification.

### Exit Criteria

- Every required UED field reaches the ViewModel.
- Every renderer consumes the same canonical field set.
- No renderer silently drops, renames, reinterprets, repairs, or fabricates semantic fields.
- Missing required semantic fields fail closed.
- Semantic Golden Masters pass in CI.

### Claim Unlocked

> There is one canonical evaluation, rendered four different ways.

---

## Phase 2 — Presentation Governance

**Goal:** Define the premium presentation contract before changing renderers.

This phase produces specification, not renderer implementation. It is the presentation equivalent of the ViewModel boundary: a shared contract each renderer must obey in a medium-appropriate way.

### Specify

- Typography hierarchy.
- Spacing tokens.
- Section hierarchy.
- Component anatomy.
- Executive dashboard rules.
- Opportunity card presentation.
- Recommendation card presentation.
- PDF pagination rules.
- DOCX style rules.
- TXT readability rules.
- Navigation and CTA treatment.
- Premium editorial copy rules.

### Rule

No renderer invents presentation behavior outside the approved presentation specification.

---

## Phase 3 — Renderer Completion

**Goal:** Implement the presentation contract across every author-facing report surface.

### Renderers

- Web
- PDF
- DOCX
- TXT

### Rule

Every renderer consumes the same proven semantics and applies the approved presentation contract for its medium.

---

## Phase 4 — Presentation Golden Masters

**Goal:** Lock visual and presentation expectations after renderer completion.

Presentation Golden Masters protect quality, not semantic authority.

### Protect

- Typography.
- Whitespace.
- Hierarchy.
- Card rendering.
- Pagination.
- Navigation.
- Premium appearance.

---

## Phase 5 — Production Readiness

**Goal:** Certify the system for launch after integrity, semantic parity, and presentation completion.

### Final Certification Covers

- Semantic correctness.
- Renderer parity.
- Presentation quality.
- Accessibility.
- Performance.
- Regression coverage.
- Premium editorial quality.
- Deployment readiness.

The presentation layer is considered frozen only after this phase passes.

---

## Governing Principles

1. **Single Source of Truth**
   UED remains authoritative.

2. **Single Presentation Model**
   ViewModel remains the only renderer input.

3. **No Renderer Authority**
   Renderers format; they never invent, reinterpret, repair, or fabricate semantics.

4. **Fail Closed**
   Missing required information results in certification failure or kick-back, never silent omission.

5. **Proof Before Polish**
   Semantic correctness precedes presentation improvements.

6. **No New Authority**
   Remaining work strengthens proof and presentation only; it does not introduce competing sources of truth.

7. **Characterization Before Correction**
   Cross-boundary authority defects must be proven by tests before production fixes are introduced.

8. **Exact-Head Merge Discipline**
   Repository changes merge only after the intended head is fully green and clean.

---

## Non-Goals

- Do not recreate Base44 files or Base44 references.
- Do not use deleted roadmap CSVs, old workbooks, phase files, session summaries, archived planning artifacts, or stale branch audits as authority.
- Do not add another roadmap file.
- Do not introduce new roadmap phases outside this sequence without explicitly updating this file.
- Do not introduce renderer-owned semantic authority.
- Do not start presentation polish before semantic parity proof is complete.
- Do not treat Golden Spine, benchmark authority, or DREAM references as roadmap state.
- Do not treat the current execution tracks as permission to bypass the architectural phases or governance rules.

---

## Roadmap Authority Rule

There is only one roadmap authority:

```text
ROADMAP.md
```

If another file disagrees with this file, this file wins. If automation requires roadmap state, it must read this file or an explicitly generated derivative of this file.
