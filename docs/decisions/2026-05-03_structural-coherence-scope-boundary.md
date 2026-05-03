# Decision: Structural coherence is surfaced via excellence filter, not the quality gate

**Date:** 2026-05-03  
**Status:** Accepted  
**Baseline commit:** `b8ec991c` (post-#286 main)  
**Evidence:** `docs/operations/evidence/runs/2026-05-03_canary_broken_main/`

## Context

The 2026-05-03 contrast canary (A/B/C run set) tested post-#286 behavior on three inputs:

- **A — Strong (Froggin Noggin):** real chapter, `quality_gate_pass: true`, `agree: 13 / soft: 0 / hard: 0`
- **B — Weak (engineered bland):** `quality_gate_pass: false`, 1 × `QG_EDITORIAL_GENERIC_FEEDBACK`, 4 × `missing_fix`
- **C — Broken (engineered structural failures):** `quality_gate_pass: true`, Pass 3 `agree: 10 / soft_divergence: 2 / hard_divergence: 1`, excellence filter `verdict: not-yet-ready` with blocking criteria `[character, sceneConstruction, pacing, narrativeClosure, marketability]`

Case C is the key ambiguity: structural problems were surfaced by synthesis/excellence signals, but did not produce a hard `QG_*` failure.

## Question

Should structural-coherence failures (POV stability, factual continuity, scene completion) trigger hard quality-gate failure (`QG_*`), or remain soft signal via excellence filter?

## Decision

**Structural coherence is intentionally surfaced via Pass 3 divergence and excellence filter, not by hard quality-gate failure.**

## Rationale

1. **Scope clarity** — `recommendation_editorial_quality` (#283/#284) enforces recommendation-contract compliance, not manuscript-level coherence. Mixing concerns couples orthogonal axes.
2. **Signal sufficiency** — Case C already produced loud structured signals (`hard_divergence`, `not-yet-ready`, named blocking criteria).
3. **False-positive risk** — Hard coherence gates risk penalizing deliberate narrative techniques (intentional POV shifts, unreliable narration) without stronger disambiguation infrastructure.
4. **Reversibility** — Deferral cost is low; premature hard enforcement cost is high.

## Consequences

- Quality gate continues to represent recommendation-contract validity.
- Excellence filter remains the manuscript-level structural readiness surface.
- No new structural-coherence `QG_*` code at this time.
- Future enforcement can be proposed if production evidence shows soft signal insufficiency.

## Triggers for revisit

Re-open this decision if any of the following occur repeatedly:

1. `excellence_filter.verdict = not-yet-ready` with structural blockers, but downstream presentation treats manuscript as ready.
2. User feedback indicates structural failures are routinely missed despite current signals.
3. Product doctrine elevates structural coherence to release-gating criterion.

## References

- PR #283 — editorial quality gate
- PR #284 — gate fidelity hardening
- PR #285 — diagnostics + traceability
- PR #286 — Pass 3 contract hardening v8
- Evidence pack — `docs/operations/evidence/runs/2026-05-03_*`
