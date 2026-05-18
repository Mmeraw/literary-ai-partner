# DREAM State Long-Form Evaluation Canon

**Status:** Draft governance canon  
**Owner:** Mmeraw  
**Created:** 2026-05-16  
**Rebased:** 2026-05-18  
**Scope:** DREAM long-form evaluation documents, benchmark fixtures, and async DREAM worker artifacts.

## Purpose

This canon defines the target shape of a DREAM long-form evaluation while preserving the current async DREAM worker architecture.

It applies to manual gold-standard benchmark files, renderer targets for DREAM long-form reports, async DREAM worker artifacts persisted as `longform_document_v1`, and future docs/test checks that validate benchmark shape and report rendering coverage.

It does **not** require `runPipeline()` to synchronously generate a DREAM document. The governed 13-criterion evaluation remains the main pipeline source of truth. DREAM long-form report generation is async-worker-owned.

## Runtime Architecture Boundary

DREAM long-form synthesis must not be reintroduced as a synchronous critical-path step inside `runPipeline()`.

| Concern | Owner |
|---|---|
| Pass 1 craft evaluation | main evaluation pipeline |
| Pass 2 editorial evaluation | main evaluation pipeline |
| Pass 3 synthesis / 13-criterion result | main evaluation pipeline |
| Pass 4 / QualityGate governance | main evaluation pipeline |
| DREAM long-form document generation | async DREAM worker, e.g. `/api/workers/process-dream` |
| `longform_document_v1` persistence | async DREAM worker / artifact persistence layer |
| DREAM long-form rendering | report/evaluate page renderer components |

Reason: prior synchronous Pass 3b wiring created long-form timeout risk. The DREAM document is a downstream report artifact, not a blocker that should extend the main evaluation critical path unless a future PR deliberately changes the architecture and includes timeout proof.

## Canonical Section Order

A fully conformant DREAM long-form document contains these 16 sections in order:

1. Executive Verdict
2. Market / Shelf Description
3. What This Manuscript Should Not Become
4. Structural Stack
5. Arc Map
6. Score Grid
7. Criterion-by-Criterion Analysis
8. Layer-by-Layer Analysis
9. Cross-Layer Integration
10. Symbolic / Doctrine / System Audit
11. Reader Experience
12. Prioritized Revision Plan
13. Releasability Assessment
14. Acceptance Checks for Repo Benchmark
15. Gold-Standard Lessons / Evaluator Calibration Notes
16. Repo-Ready Summary Block

## Canonical 13 Criteria

1. Concept & Core Premise
2. Narrative Drive & Momentum
3. Character Depth & Psychological Coherence
4. Point of View & Voice Control
5. Scene Construction & Function
6. Dialogue Authenticity & Subtext
7. Thematic Integration
8. World-Building & Environmental Logic
9. Pacing & Structural Balance
10. Prose Control & Line-Level Craft
11. Tonal Authority & Consistency
12. Narrative Closure & Promises Kept
13. Professional Readiness & Market Positioning

## Multi-Layer Architecture Rows

For `multi_layer_long_form` documents, Section 6 should append these four architecture rows after the canonical 13 criteria:

14. Layer & Mode Integration
15. Layer Coherence
16. Doctrine / Symbolic System Integrity
17. Canon & Continuity Integrity

## Enforcement Posture

Near-term enforcement should focus on docs/test surfaces: benchmark frontmatter shape, section order where a file declares `dream-state: true`, canonical criterion names, multi-layer rows, and renderer coverage.

Runtime enforcement must respect the async worker boundary. A future PR may harden async artifact production and persistence, but it must not silently move DREAM generation back into `runPipeline()`.

## Closure Principle

DREAM long-form output is a report-quality target and async artifact contract. The DREAM document translates governed evaluation truth into a richer long-form editorial artifact; it must not destabilize the main evaluation critical path.
