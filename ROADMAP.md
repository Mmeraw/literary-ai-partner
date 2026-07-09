# RevisionGrade Final Architecture Roadmap

- **Status date:** 2026-07-09
- **Current baseline:** `3d3acaa0`
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

↓

1220
↓
1222

────────────────────────────

1225
Semantic Parity Proof
+
Semantic Golden Masters

────────────────────────────

Presentation Governance

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

## Phase 0 — Complete Integrity

**Goal:** The canonical evaluation cannot be fabricated, silently altered, or partially enforced.

### Completed

- ✅ #1219 — Workbench integrity
- ✅ #1223 — Withheld-card visibility
- ✅ #1224 — Normalization hardening

### Remaining

- ⏳ #1220 — Remaining RevisionPackage padding
- ⏳ #1222 — Certification ENFORCE rollout

### Exit Criteria

- No fabricated diagnostics.
- No inferred filler where certification requires evidence.
- Certification policy is fully enforced.
- Integrity tests are green in CI.

---

## Phase 1 — Proof of Canonical Semantics

- **Issue:** #1225
- **Goal:** Prove there is one canonical evaluation rendered four different ways.

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

---

## Non-Goals

- Do not recreate Base44 files or Base44 references.
- Do not use deleted roadmap CSVs, old workbooks, phase files, session summaries, archived planning artifacts, or stale branch audits as authority.
- Do not add another roadmap file.
- Do not introduce new roadmap phases outside this sequence without explicitly updating this file.
- Do not introduce renderer-owned semantic authority.
- Do not start presentation polish before semantic parity proof is complete.
- Do not treat Golden Spine, benchmark authority, or DREAM references as roadmap state.

---

## Roadmap Authority Rule

There is only one roadmap authority:

```text
ROADMAP.md
```

If another file disagrees with this file, this file wins. If automation requires roadmap state, it must read this file or an explicitly generated derivative of this file.
