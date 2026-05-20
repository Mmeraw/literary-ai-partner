# DREAM Evidence Distribution / Confidence Gate

## Purpose

The Evidence Distribution / Confidence Gate prevents full-novel DREAM reports from sounding authoritative while relying on narrow evidence, especially opening-chapter dominance.

Confidence must be evidence-earned, not merely model-reported.

## Required when

Required for every DREAM long-form report.

## Folded report surfaces

This gate should be rendered or enforced through existing DREAM surfaces, especially:

- `criterion_analyses.confidence`
- `criterion_analyses.fit_evidence`
- `criterion_analyses.gap_evidence`
- `executive_verdict`
- `acceptance_checks.required_detection`
- `acceptance_checks.failure_conditions`
- `calibration_notes`

## Evidence zones

For full-novel reports, evidence anchors should be classified by zone:

- opening
- early
- middle
- late
- ending / close
- whole-manuscript pattern

## Confidence rule

High confidence for a major full-manuscript claim requires evidence from at least two act zones.

For major whole-manuscript claims about character, theme, closure, marketability, relationship spine, symbolic payoff, or structural readiness, the preferred support span is:

- opening
- middle
- late act
- ending / close

If evidence is concentrated in the opening, the report must downgrade confidence or explicitly flag narrow evidence distribution.

## Minimum criterion contract

Each criterion analysis should include or imply:

| Field | Requirement |
|---|---|
| Evidence count | Number or visible set of anchors supporting the claim. |
| Evidence zones | Which manuscript zones support the claim. |
| Confidence basis | Why the confidence label is earned. |
| Downgrade reason | Required when support is narrow, missing, or opening-heavy. |
| Report risk | Whether the claim is adequately supported, overconfident, or requires manual verification. |

## Hard-fail conditions

A DREAM report is incomplete if:

- It assigns High confidence to a full-novel claim supported only by opening evidence.
- It discusses closure without ending evidence.
- It discusses character arcs without middle, late, or ending evidence for major characters.
- It discusses marketability without naming a manuscript-specific differentiator.
- It repeatedly cites the same opening scene across unrelated criteria as if it proves the whole book.
- It ignores evidence-distribution limitations after admitting confidence varies.

## Recommendation interaction

Recommendation confidence should follow evidence distribution. A high-priority recommendation must identify:

- location
- action
- mechanism rationale
- risk if ignored
- asset to preserve
- evidence basis

## Benchmark obligation pattern

Each gold-standard benchmark should state which zones and systems must be represented for its major claims. The exact examples belong in the benchmark addendum, not this generic gate spec.

## Implementation note

This gate can be deterministic once evidence anchors are tagged by zone. It should not require another model pass.
