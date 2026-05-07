# SIPOC Per-Criterion Non-Certified Addendum

Status: Canonical addendum for Option B score/confidence survivability semantics.

Authority: supplements `docs/SIPOC_EVALUATION_PROCESS.md` until the next full SIPOC contract revision folds this text into the S07_PASS3 and S09_QUALITYGATEV2 stage rows.

## Purpose

Canonize the distinction between an invalid criterion certification and an invalid evaluation artifact.

The failure mode discovered in jobs `15a655ae-6658-4e1e-b39b-b10542cd5f87` and `bae4c87b-87f9-4000-ab86-d20124ce251c` is:

- a criterion emitted `score_0_10 > 5`,
- the same criterion carried `confidence_level: "low"`,
- the deterministic gate surfaced `v2_fidelity_score_confidence_alignment`,
- and the whole report failed instead of marking the single criterion non-certified.

This addendum defines the canonical Option B behavior.

## Architectural Truth 1: Pass 3 Output Is Not Persisted On QG Failure

For failed jobs, raw Pass 3 output is not a durable forensic surface after QualityGateV2 failure.

Current failed-job diagnosis must use:

- `evaluation_jobs.progress.pipeline_failure_envelope`,
- any committed or emitted diagnostic artifacts,
- and explicit failure-envelope strings such as `v2_fidelity_score_confidence_alignment: ... proseControl:7`.

Diagnostic tools must not depend on a non-existent `evaluation_jobs.pass3_result` column.

If future runtime work changes failed-pass persistence, that change must be canonized separately and must preserve the no-artifact-after-failed-gate doctrine.

## Architectural Truth 2: Insufficient Evidence Anchoring Is Not Entire Report Invalidity

A single criterion that lacks certified evidence anchoring is not, by itself, proof that the entire evaluation artifact is invalid.

The canonical distinction is:

- structural result failure means the job must fail closed;
- per-criterion certification failure means the affected criterion becomes non-certified while the remaining valid criteria may still render;
- fabricated numeric repair is forbidden.

## S09_QUALITYGATEV2 Canonical Semantics

`v2_fidelity_score_confidence_alignment` is a deterministic gate rule. It must still fire when a low-confidence criterion exceeds the allowed high-score threshold.

The canonical response is per-criterion downgrade, not score capping and not automatic job annihilation.

When this specific rule detects an offending criterion:

- set `status` to `INSUFFICIENT_SIGNAL`,
- set `scorable` to `false`,
- set `score_0_10` to `null`,
- preserve the model-emitted numeric score only in an audit-only field,
- set `insufficient_signal_reason` to a structured reason explaining insufficient certified anchoring,
- exclude the criterion from `overview.scored_criteria_count`,
- recompute aggregate score only from certified scorable criteria according to the active score denominator policy,
- return a passing gate result for this rule if no other fatal gate rule failed.

## Fatal Gate Rules Remain Fatal

This addendum does not weaken structural fail-closed behavior.

The following remain job-fatal unless separately canonized otherwise:

- missing canonical criteria,
- malformed schema,
- illegal score range,
- invalid score/null separation outside the per-criterion downgrade path,
- generic/duplicate/invalid recommendation failures when configured as fatal,
- persistence validation failure,
- artifact gate failure.

## Forbidden Patterns

The following patterns are forbidden:

- silently capping a low-confidence high score to `5`,
- rendering the model-emitted unverified score as if certified,
- hiding the affected criterion without explanation,
- bypassing QualityGateV2 entirely,
- treating `v2_fidelity_score_confidence_alignment` as a warning with no criterion state change,
- retroactively editing failed production jobs to appear complete.

## Required Audit Field

Runtime may preserve the original model-emitted score in an audit-only field named:

`model_emitted_score_unverified`

This field is not a certified score. It must not appear in any user-facing rendered report.

## Required Renderer Semantics

When a criterion has `status === "INSUFFICIENT_SIGNAL"` and `score_0_10 === null`, the renderer must show a non-certified state rather than a number.

Required user-facing meaning:

`Score not certified — insufficient evidence anchoring.`

The renderer should display the structured `insufficient_signal_reason` as explanatory subtext and should expose a certified-count summary such as `12 of 13 criteria certified`.

## Required Runtime Tests

The runtime implementation PR must prove:

1. A single `v2_fidelity_score_confidence_alignment` violation downgrades only the offending criterion.
2. The job remains eligible to persist if no other fatal gate rule fails.
3. Other criteria remain unchanged.
4. Structural gate failures still fail the whole job.
5. `score_0_10 !== null` and `status === "INSUFFICIENT_SIGNAL"` is impossible at validation/type boundaries.
6. `model_emitted_score_unverified` is audit-only and never rendered.

## Relationship To Existing SIPOC Stages

This addendum applies to:

- `S07_PASS3`: failed Pass 3/QG forensic evidence is failure-envelope based unless explicit failed-pass persistence is later canonized.
- `S08_ER2_NORMALIZATION`: score/null separation remains mandatory; non-certified criteria carry `score_0_10: null`.
- `S09_QUALITYGATEV2`: score/confidence alignment is a deterministic per-criterion certification rule.
- `S10_PERSISTENCE`: artifacts may persist only after remaining fatal gate rules pass.
- `S11_RENDERER`: non-certified criteria must be displayed honestly without a numeric score.

Refs #338
