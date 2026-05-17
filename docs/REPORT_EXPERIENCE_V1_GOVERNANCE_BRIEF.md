# Report Experience V1 Governance Brief

## Status

Substrate-only implementation contract.

## Purpose

`report_experience_v1` is an additive post-evaluation artifact. It translates already-valid evaluation truth into author-facing editorial guidance that is candid, concrete, motivating, and emotionally usable.

It is not an evaluation-scoring artifact.

## Canonical Boundary

`report_experience_v1` must not alter:

- `CRITERIA_KEYS`
- Pass 1
- Pass 2
- Pass 3 scoring
- Pass 4 cross-check scoring
- QualityGateV2
- `evaluation_result_v2`
- criterion scores
- evidence anchors
- confidence bands
- verdict semantics

## Product Principle

Hard truth, beautifully delivered.

The governed evaluation kernel establishes the truth. The report experience layer translates that truth into a recovery roadmap the author can use.

## Internal Emotional Usability

Emotional resonance is internal only. It is not a public criterion and must not replace or alias `narrativeClosure`.

The report experience audit may measure:

- whether the author feels accurately understood
- whether candor is delivered without cruelty
- whether recovery paths are concrete
- whether guidance is specific
- whether the report motivates revision without false praise
- whether unsupported superlatives are avoided

## Runtime Boundary

This substrate PR does not add runtime behavior.

Future implementation should generate `report_experience_v1` asynchronously through a cron-triggered worker modeled after `process-dream`.

The worker must process completed evaluations only and must never run inside the core Pass 1–4 pipeline.

## Artifact Eligibility

Future worker eligibility should be:

Short-form:

- `evaluation_jobs.status = complete`
- `evaluation_result_v2` exists
- `report_experience_v1` does not exist

Long-form:

- `evaluation_jobs.status = complete`
- `evaluation_result_v2` exists
- `longform_document_v1` exists
- `report_experience_v1` does not exist

## Rollback

Safe rollback is deletion or ignoring of `report_experience_v1` artifacts. The governed evaluation result remains canonical.
