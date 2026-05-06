# SIPOC Evaluation Process Contract

Status: Canonical operational contract
Owner: RevisionGrade evaluation pipeline
Scope: Evaluation jobs only
Last updated: 2026-05-06

This document defines the enforceable SIPOC contract for RevisionGrade evaluations. It is the source document for future SIPOC regression harnesses, Pipeline Health checks, and stage-level diagnostics.

This is not a roadmap. It is a contract.

---

## 1. Purpose

RevisionGrade evaluations must be traceable across the full chain:

```txt
Supplier -> Input -> Process -> Output -> Customer
```

The goal is to stop discovering systemic failures one job at a time. Every stage must have:

- an owner
- a code surface
- expected inputs
- expected outputs
- telemetry
- gate or dashboard visibility
- regression-test coverage

Failures are acceptable only when they are:

- explainable
- reproducible
- classified
- visible in diagnostics
- non-regressive

---

## 2. Canonical job lifecycle

Only these lifecycle statuses are canonical:

```txt
queued
running
complete
failed
```

Do not introduce additional lifecycle states without a schema/governance migration.

Validity and lifecycle are separate concerns. A job may have lifecycle status while artifact validity is handled by validation/gate logic.

---

## 3. SIPOC summary

| SIPOC | Contract |
|---|---|
| Suppliers | User, manuscript store, job creation API, worker/cron, canonical prompts/governance, model providers, Supabase persistence |
| Inputs | Manuscript text, manuscript metadata, job record, runtime config, canonical criteria, pass contracts, governance config |
| Process | Submit -> queue -> claim -> resolve manuscript -> route/chunk -> Pass 1 -> Pass 2 -> Pass 3 -> quality gate -> persist -> render |
| Outputs | EvaluationResultV2 artifact, criteria, recommendations, score ledger, governance diagnostics, job terminal state, UI report |
| Customers | Writer, evaluation UI, admin/pipeline health, audit/governance layer, downstream revision/WAVE systems |

---

## 4. Canonical stage map

| Stage ID | Process responsibility | Primary code surfaces | Expected input | Expected output | Customer |
|---|---|---|---|---|---|
| intake | Accept user manuscript and create job | `app/evaluate/*`, `components/ManuscriptSubmissionForm.jsx`, `app/api/jobs/*` | User text/file, metadata, auth context | `evaluation_jobs` row in `queued` state | Worker / user progress UI |
| claim | Atomically claim eligible job | `lib/evaluation/processor.ts`, Supabase claim RPCs | queued job, worker identity, lease config | running job with claimant/lease | Pipeline runner |
| manuscript_resolution | Resolve canonical manuscript text | `lib/evaluation/processor.ts`, manuscript/chunk helpers | job_id, manuscript_id, stored manuscript/chunks | canonical text payload | routing/chunking |
| routing_chunking | Decide short-form vs long-form path and ensure chunks | chunk helpers, processor routing seam | manuscript text, word count, chunk state | route metadata, chunk_count, comparison input material | Pass 1 / Pass 3 packet builder |
| pass1_craft | Independent craft/structural analysis | `lib/evaluation/pipeline/runPipeline.ts`, Pass 1 runner/prompts | canonical manuscript text/chunks, criteria contract | Pass 1 criterion signals | Pass 3 synthesis / gate diagnostics |
| pass2_editorial | Independent editorial analysis | `lib/evaluation/pipeline/runPipeline.ts`, Pass 2 runner/prompts | canonical manuscript text/chunks, criteria contract | Pass 2 criterion signals | Pass 3 synthesis / independence gate |
| pass3_synthesis | Reconcile Pass 1 and Pass 2 into EvaluationResultV2 | `lib/evaluation/pipeline/runPipeline.ts`, Pass 3 synthesis, comparison packet builder | Pass 1 output, Pass 2 output, comparison packet, canonical criteria | EvaluationResultV2 candidate | QualityGateV2 |
| quality_gate | Deterministically validate artifact candidate | `lib/evaluation/pipeline/qualityGate.ts` | EvaluationResultV2 candidate, telemetry context | pass/fail gate result with reason codes | persistence / diagnostics |
| persistence_report | Persist only valid terminal artifacts and expose report | `lib/evaluation/processor.ts`, artifact persistence helpers, `app/evaluate/[jobId]/page.tsx` | gate-passing artifact or failure diagnostics | persisted artifact or persisted failure envelope | user report / admin dashboard |
| admin_observability | Summarize pipeline health without mutating runtime | `app/api/admin/pipeline-health/route.ts`, `app/admin/pipeline-health/page.tsx` | `evaluation_jobs`, progress JSON, diagnostics artifacts | SIPOC strip, failure heatmap, failed job table | admin/operator |

---

## 5. Stage metrics contract

Every stage should either emit the metric directly or expose enough structured data for Pipeline Health to derive it.

| Stage ID | Metric | Type | Required? | Failure mode if absent |
|---|---|---:|---:|---|
| intake | job_id | string | yes | job cannot be tracked |
| intake | manuscript_id | number/string | yes | job cannot be traced to source |
| claim | claimed_by / worker_id | string/null | yes for running | active claim integrity unknown |
| claim | lease_token / lease_until | string/date | yes for leased running jobs | malformed running job |
| manuscript_resolution | manuscript_word_count | number | yes | routing cannot be trusted |
| routing_chunking | route | `short_form` / `long_form` | yes | route proof unavailable |
| routing_chunking | chunk_count | number | yes | long-form proof unavailable |
| routing_chunking | comparison_packet_chars | number | yes for long-form | Pass 3 representation proof unavailable |
| pass1_craft | pass1_ms | number | preferred | latency trend incomplete |
| pass2_editorial | pass2_ms | number | preferred | latency trend incomplete |
| pass3_synthesis | pass3_ms | number | preferred | latency trend incomplete |
| pass3_synthesis | criteria_count_by_state | object | yes for comparison packet audits | divergence collapse cannot be measured |
| quality_gate | error_code | string/null | yes on failure | failure class cannot be grouped |
| quality_gate | confidence_distribution | object | preferred | confidence anomalies cannot be bulk-detected |
| persistence_report | artifact_type | string | yes on complete | report provenance unknown |
| persistence_report | artifact_validation_result | PASS/HOLD/FAIL | preferred | artifact validity not auditable |
| admin_observability | diagnosticStatus | available/missing/blocked_by_307/not_applicable | yes | dashboard cannot distinguish missing vs pending diagnostics |

---

## 6. Hard invariants

The following invariants are non-negotiable:

1. No complete job without a persisted evaluation artifact.
2. No persisted evaluation artifact without passing deterministic gates.
3. No EvaluationResultV2 artifact with fewer or more than 13 canonical criteria.
4. No criterion score outside integer range 0-10.
5. No `SCORABLE + confidence_level=low + score_0_10>5` after score-confidence reconciliation is in force.
6. No fake-zero artifacts.
7. No schema-valid but evidence-invalid artifacts.
8. No traceability decrease on failure.
9. No long-form job without route/chunk proof.
10. No quality-gate failure without a reason code.

---

## 7. Dashboard binding

Pipeline Health must be a consumer of this contract, not a place that invents new logic.

Current minimum dashboard surfaces:

- Fleet totals: queued, running, complete, failed
- SIPOC Pipeline Strip by stage
- Failure heatmap: stage x error_code
- Recent failed jobs
- Recent jobs
- Diagnostic status summary

Future dashboard surfaces:

- criterion-level reconstruction
- confidence anomaly matrix
- comparison packet scale proof
- pass-level latency trends
- route/chunk proof evidence
- drift regression summary

---

## 8. Regression harness contract

The future SIPOC regression harness must use this document as its contract source.

Required fixture classes:

| Fixture class | Purpose |
|---|---|
| short_form_valid | proves short-form route can complete |
| long_form_valid | proves chunking/route/comparison packet scale |
| low_confidence_high_score | proves score-confidence reconciliation/gate behavior |
| generic_recommendation | proves editorial genericity detection |
| independence_overlap | proves Pass 2 independence diagnostics |
| dialogue_under_anchored | proves dialogue diagnostics/soft-fail or hard-fail policy |
| pov_under_anchored | proves POV defects remain blocking when configured |
| malformed_criteria_count | proves 13-criteria invariant |
| fake_zero_artifact | proves fake-zero rejection |
| missing_diagnostics_failure | proves diagnosticStatus classification |
| schema_valid_evidence_invalid | proves evidence validity is not bypassed by schema validity |
| genre_ambiguous | proves interpretation layer does not drift wildly |
| calibration_golden | proves score drift stays within tolerance |

Required aggregate outputs:

```txt
artifacts/sipoc-results.json
artifacts/gate-matrix.json
artifacts/confidence-anomalies.json
artifacts/drift-report.json
```

Required CI failure conditions:

- criteria count != 13
- low-confidence score cap violation
- missing gate reason code on failure
- complete job without artifact
- persisted artifact without gate pass
- fake-zero artifact
- schema-valid/evidence-invalid artifact
- long-form route without chunk proof
- drift beyond configured tolerance

---

## 9. Relationship to open work

This SIPOC contract does not close proof issues by itself.

It supports and organizes proof for:

- routing/chunking proof
- divergence collapse proof
- score-confidence alignment proof
- dialogue/POV/voice diagnostics
- admin observability
- artifact validation hardening

Issues must close only after proof artifacts exist.

---

## 10. Implementation discipline

All future SIPOC work must follow these rules:

- one PR per contract layer
- docs first, then harness, then enforcement
- no mixed dashboard/runtime/gate scope
- no prompt changes hidden inside observability PRs
- no gate weakening to pass tests
- no mass issue closure without production proof

The correct implementation sequence is:

1. Canonical SIPOC contract
2. Fixture taxonomy
3. Deterministic harness
4. GitHub Action regression workflow
5. Pipeline Health ingestion of harness results
6. Production proof loops

---

## 11. Current status

This document is the foundation contract. It is complete enough to build the first SIPOC regression harness, but it does not itself implement the harness.

Completion state:

```txt
SIPOC contract: present
Pipeline Health consumer: partially present
Regression fixtures: pending
Harness script: pending
CI workflow: pending
Production proof artifacts: pending
```
