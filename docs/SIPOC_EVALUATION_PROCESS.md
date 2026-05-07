# SIPOC Evaluation Process — Canonical Runtime Certification Index

Status: Canonical certification index for **evaluation runtime spine only** (PR A, docs-only)

## Purpose

Freeze the canonical certification spine for evaluation runtime execution so downstream fixture, harness, CI, and telemetry work (PR B–E) can be built against explicit stage contracts instead of inferred behavior.

This document is intentionally scoped to active evaluation runtime flow and excludes implementation of harnesses, fixtures, CI certification workflows, dashboard behavior changes, or any runtime behavior change.

## Authority Order

### Canon

1. `docs/canon/_md/VOLUME II — STORY EVALUATION CRITERIA & ANALYTICAL FRAMEWORK (V2.0).md`
2. `docs/canon/_md/REVISIONGRADE CANON ADDENDUM Criterion Observability & Signal Sufficiency Model.md`
3. `docs/canon/_md/VOLUME III — EVALUATION PIPELINE ARCHITECTURE (PASS SYSTEM).md`
4. `docs/canon/_md/VOLUME III — FINAL PIPELINE DIAGRAM + STATE MODEL.md`
5. `docs/canon/_md/E2E Evaluation Flow Architecture.md`
6. `docs/canon/_md/PHASE 0.1–0.3 — CANON INTEGRATION & GOVERNANCE ENFORCEMENT SPEC.md`

### Spec

1. `docs/JOB_CONTRACT_v1.md`
2. `docs/NOMENCLATURE_CANON_v1.md`
3. `docs/EVALUATION_CRITICAL_FILE_PATH.md`
4. `docs/QUALITY_GATES_v1.md`

### Runtime

Primary runtime surfaces are read from:
- `app/api/jobs/route.ts`
- `app/api/workers/process-evaluations/route.ts`
- `lib/jobs/jobStore.supabase.ts`
- `lib/manuscripts/chunking.ts`
- `lib/evaluation/pipeline/runPipeline.ts`
- `lib/evaluation/pipeline/qualityGate.ts`
- `lib/evaluation/persistEvaluationResultV2.ts`
- `app/api/evaluations/[jobId]/route.ts`
- `app/api/admin/pipeline-health/route.ts`

### Telemetry

Primary required telemetry surfaces:
- `lib/observability/latencyTrace.ts`
- `app/api/admin/pipeline-health/route.ts`
- `app/admin/pipeline-health/page.tsx`
- `evaluation_jobs.progress.pipeline_failure_envelope`
- `evaluation_artifacts` diagnostic artifacts

## Runtime Doctrine

1. Evaluation is constrained by evidence, not schema.
2. No artifact persists after failed deterministic gate.
3. Score and null must never collapse.
4. Pass independence is mandatory.
5. Stages fail closed; no partial success is reported as final.
6. Canon overrides runtime behavior.
7. Telemetry is mandatory for all gate failures.
8. Stages accept only certified upstream outputs.
9. Deterministic gates may not be bypassed by heuristic confidence.

## Evaluation Critical Path

`Intake -> Queue -> Claim -> Routing/Chunking -> Pass 1 -> Pass 2 -> Pass 3 -> EvaluationResultV2 normalization -> QualityGateV2 -> Persistence -> Renderer`

**Highest-risk seam (explicit):**

`Pass 3 -> EvaluationResultV2 normalization -> QualityGateV2 -> Persistence`

Reason: this seam carries synthesis correctness, normalization semantics, deterministic gate enforcement, and fail-closed persistence guarantees in one boundary chain.

## SIPOC Stage Table

| Stage | Stage ID | Supplier | Customer / Downstream | Certification Status |
|---|---|---|---|---|
| Intake | `S01_INTAKE` | Authenticated user + API gateway | `S02_QUEUE` | Partial |
| Queue | `S02_QUEUE` | Jobs API + store | `S03_CLAIM` | Proven |
| Claim | `S03_CLAIM` | Worker + atomic claim RPC | `S04_ROUTING_CHUNKING` | Proven |
| Routing / Chunking | `S04_ROUTING_CHUNKING` | Manuscript/chunking services | `S05_PASS1`, `S06_PASS2` | Emerging |
| Pass 1 | `S05_PASS1` | Pipeline orchestrator + Pass 1 runner | `S07_PASS3` | Partial |
| Pass 2 | `S06_PASS2` | Pipeline orchestrator + Pass 2 runner | `S07_PASS3` | Partial |
| Pass 3 | `S07_PASS3` | Pipeline orchestrator + synthesis runner | `S08_ER2_NORMALIZATION` | High-risk |
| EvaluationResultV2 normalization | `S08_ER2_NORMALIZATION` | Pipeline adapter / observability normalization | `S09_QUALITYGATEV2` | High-risk |
| QualityGateV2 | `S09_QUALITYGATEV2` | Deterministic gate engine | `S10_PERSISTENCE` | Partial |
| Persistence | `S10_PERSISTENCE` | Atomic persistence layer | `S11_RENDERER` | Partial |
| Renderer | `S11_RENDERER` | API read path + UI | End user / admin | Emerging |

### Stage Contract Details

### `S01_INTAKE` — Intake

- **Supplier:** Authenticated user/session path
- **Input:** Job/evaluation request payload (`manuscript_id` or `manuscript_text`, `job_type`, actor identity)
- **Input acceptance metrics:**
  - Auth present (`401` if absent)
  - Required field completeness (`400` if missing)
  - No ambiguous manuscript source (`400`)
  - Canonical `job_type` set only
- **Process / runtime code surface:**
  - `app/api/jobs/route.ts`
  - `app/api/evaluate/route.ts`
- **Output:** Validated request accepted for queueing
- **Output acceptance metrics:**
  - `ok=true` response
  - trace IDs emitted
- **Customer / downstream stage:** `S02_QUEUE`
- **Gates / invariants:** canonical field validation, no inferred state
- **Failure codes:** `401`, `400`, `403`, `413`, `429`, `500`
- **Required telemetry:** request trace ID, intake rejection event, latency start
- **Required evidence artifact:** request/response audit log with trace identifiers
- **Canon refs:** Volume III pipeline/state model; Phase 0.1–0.3 governance
- **Spec refs:** `docs/JOB_CONTRACT_v1.md`, `docs/NOMENCLATURE_CANON_v1.md`
- **Runtime refs:** `app/api/jobs/route.ts`, `app/api/evaluate/route.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Partial

### `S02_QUEUE` — Queue

- **Supplier:** Intake routes + job store
- **Input:** Canonical job creation payload with `status=queued`
- **Input acceptance metrics:**
  - Job row persisted
  - `status` in canonical set: `queued|running|complete|failed`
- **Process / runtime code surface:**
  - `lib/jobs/store.ts`
  - `lib/jobs/jobStore.supabase.ts`
- **Output:** Queued job with phase metadata ready for claim
- **Output acceptance metrics:**
  - DB write success
  - canonical progress keys present
- **Customer / downstream stage:** `S03_CLAIM`
- **Gates / invariants:** no non-canonical status values; no illegal transition writes
- **Failure codes:** DB write failure (`500`), canonical contract violations
- **Required telemetry:** `job.created`, queue depth and acceptance event
- **Required evidence artifact:** persisted `evaluation_jobs` row with queued state
- **Canon refs:** Volume III pass system/state model
- **Spec refs:** `docs/JOB_CONTRACT_v1.md`
- **Runtime refs:** `lib/jobs/store.ts`, `lib/jobs/jobStore.supabase.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Proven

### `S03_CLAIM` — Claim

- **Supplier:** Worker processor and atomic claim RPC
- **Input:** Eligible queued jobs
- **Input acceptance metrics:**
  - Claim eligibility by canonical status/phase
  - Lease token / lease expiry written atomically
- **Process / runtime code surface:**
  - `app/api/workers/process-evaluations/route.ts`
  - `lib/evaluation/processor.ts`
  - `lib/jobs/jobStore.supabase.ts`
- **Output:** Claimed running job with active lease
- **Output acceptance metrics:**
  - exactly one claimer
  - fail-closed if claim RPC fails
- **Customer / downstream stage:** `S04_ROUTING_CHUNKING`
- **Gates / invariants:** no claim fallback that bypasses atomic path; stale lease handling fail-closed
- **Failure codes:** claim RPC failure; lease expiry dead-job classification
- **Required telemetry:** worker invocation, claim result, lease diagnostics
- **Required evidence artifact:** claim RPC result and job lease fields snapshot
- **Canon refs:** Volume III state model
- **Spec refs:** `docs/JOB_CONTRACT_v1.md`, `docs/EVALUATION_CRITICAL_FILE_PATH.md`
- **Runtime refs:** `app/api/workers/process-evaluations/route.ts`, `lib/jobs/jobStore.supabase.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Proven

### `S04_ROUTING_CHUNKING` — Routing / Chunking

- **Supplier:** Claimed job + manuscript loader/chunking module
- **Input:** Manuscript text and routing metadata
- **Input acceptance metrics:**
  - text present and normalized
  - boundary strategy selected deterministically
- **Process / runtime code surface:**
  - `lib/manuscripts/chunking.ts`
  - `lib/evaluation/processor.ts`
- **Output:** Chunked/routed evaluation input for pass execution
- **Output acceptance metrics:**
  - deterministic chunk indices and boundaries
  - non-empty chunk set when required
- **Customer / downstream stage:** `S05_PASS1`, `S06_PASS2`
- **Gates / invariants:** deterministic chunking hierarchy; no hidden fallback path
- **Failure codes:** `QG_FAILED` (observed downstream surfacing), chunk/routing envelope errors
- **Required telemetry:** route, chunk count, word count, stage failure envelope
- **Required evidence artifact:** chunk map + routing metadata snapshot
- **Canon refs:** Volume III evaluation pipeline architecture
- **Spec refs:** `docs/EVALUATION_CRITICAL_FILE_PATH.md`
- **Runtime refs:** `lib/manuscripts/chunking.ts`, `app/api/admin/pipeline-health/route.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### `S05_PASS1` — Pass 1

- **Supplier:** Pipeline orchestrator
- **Input:** Manuscript/chunk payload + canonical registry
- **Input acceptance metrics:**
  - pass runner invocation with required options
  - timeout budget set
- **Process / runtime code surface:**
  - `lib/evaluation/pipeline/runPipeline.ts`
  - `lib/evaluation/pipeline/runPass1.ts`
- **Output:** Pass 1 structured artifact
- **Output acceptance metrics:**
  - pass output parseable at boundary
  - no pass timeout/fatal parse violation
- **Customer / downstream stage:** `S07_PASS3`
- **Gates / invariants:** pass independence (Pass 1 cannot depend on Pass 2 output)
- **Failure codes:** `PASS1_TIMEOUT`, `PASS1_FAILED`, `PASS1_*` JSON-boundary errors
- **Required telemetry:** pass1 stage timing, model/prompt metadata
- **Required evidence artifact:** pass1 output diagnostic artifact when failure occurs
- **Canon refs:** Volume III pass architecture
- **Spec refs:** Criterion observability addendum
- **Runtime refs:** `lib/evaluation/pipeline/runPipeline.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Partial

### `S06_PASS2` — Pass 2

- **Supplier:** Pipeline orchestrator
- **Input:** Manuscript/chunk payload + canonical registry
- **Input acceptance metrics:**
  - no Pass 1 payload as input
  - timeout budget set
- **Process / runtime code surface:**
  - `lib/evaluation/pipeline/runPipeline.ts`
  - `lib/evaluation/pipeline/runPass2.ts`
  - `lib/evaluation/pipeline/pass2IndependenceGuard.ts`
- **Output:** Pass 2 structured artifact
- **Output acceptance metrics:**
  - output parseable
  - lexical independence guard passes
- **Customer / downstream stage:** `S07_PASS3`
- **Gates / invariants:** pass independence mandatory
- **Failure codes:** `PASS2_TIMEOUT`, `PASS2_FAILED`, `PASS2_INDEPENDENCE_REWRITE_FAILED`, `QG_INDEPENDENCE_VIOLATION`
- **Required telemetry:** pass2 timing, independence diagnostics
- **Required evidence artifact:** pass2 output + independence diagnostic trace
- **Canon refs:** Volume III pass architecture/state model
- **Spec refs:** `docs/EVALUATION_CRITICAL_FILE_PATH.md`
- **Runtime refs:** `lib/evaluation/pipeline/runPipeline.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Partial

### `S07_PASS3` — Pass 3

- **Supplier:** Pipeline orchestrator with Pass 1+2 outputs
- **Input:** Certified outputs from Pass 1 and Pass 2 only
- **Input acceptance metrics:**
  - both upstream passes succeed
  - convergence input consistency
- **Process / runtime code surface:**
  - `lib/evaluation/pipeline/runPipeline.ts`
  - `lib/evaluation/pipeline/runPass3Synthesis.ts`
- **Output:** Synthesis output
- **Output acceptance metrics:**
  - synthesis object present
  - criteria/recommendation structure survives deterministic checks
- **Customer / downstream stage:** `S08_ER2_NORMALIZATION`
- **Gates / invariants:** stages fail closed; no partial success promoted as final
- **Failure codes:** `PASS3_TIMEOUT`, `PASS3_FAILED`
- **Required telemetry:** pass3 timing + convergence diagnostics
- **Required evidence artifact:** pass3 output snapshot
- **Canon refs:** Volume III pass/convergence canon
- **Spec refs:** `docs/EVALUATION_CRITICAL_FILE_PATH.md`
- **Runtime refs:** `lib/evaluation/pipeline/runPipeline.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** High-risk

### `S08_ER2_NORMALIZATION` — EvaluationResultV2 normalization

- **Supplier:** Pass 3 synthesis output
- **Input:** Synthesis criteria/overview plus criteria plan and observability context
- **Input acceptance metrics:**
  - synthesis payload exists
  - canonical criterion keys preserved
- **Process / runtime code surface:**
  - `lib/evaluation/pipeline/runPipeline.ts` (`synthesisToEvaluationResultV2`)
  - `schemas/evaluation-result-v2.ts`
- **Output:** `EvaluationResultV2` with normalized criteria and governance/transparency fields
- **Output acceptance metrics:**
  - score/null semantics preserved
  - criteria count/shape coherent with canonical keys
- **Customer / downstream stage:** `S09_QUALITYGATEV2`
- **Gates / invariants:** score and null never collapse; status/signal/scorability consistency
- **Failure codes:** `QG_CRITERIA_MISSING`, `QG_SCORE_RANGE`, `QG_CONSEQUENCE_CONTRACT`, `QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH`
- **Required telemetry:** normalization warnings, propagation integrity summary
- **Required evidence artifact:** normalized `evaluation_result_v2` pre-gate snapshot
- **Canon refs:** Volume II criteria canon + Criterion Observability Addendum
- **Spec refs:** `docs/EVALUATION_RESULT_SCHEMA_V1.md` (legacy context), `docs/NOMENCLATURE_CANON_v1.md`
- **Runtime refs:** `lib/evaluation/pipeline/runPipeline.ts`, `schemas/evaluation-result-v2.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** High-risk

### `S09_QUALITYGATEV2` — QualityGateV2

- **Supplier:** EvaluationResultV2 + synthesis diagnostics
- **Input:** normalized result and/or synthesis artifacts
- **Input acceptance metrics:**
  - deterministic gate checks executed
  - artifact gate decision available
- **Process / runtime code surface:**
  - `lib/evaluation/pipeline/qualityGate.ts` (`runQualityGate`, `runQualityGateV2`)
- **Output:** pass/fail gate decision and diagnostics
- **Output acceptance metrics:**
  - fail-closed on failed checks
  - diagnostics emitted for failed gates
- **Customer / downstream stage:** `S10_PERSISTENCE`
- **Gates / invariants:** deterministic gates cannot be bypassed by heuristic confidence
- **Failure codes:**
  - `QG_GENERIC_REC`, `QG_DUPLICATE_REC`, `QG_SHORT_REC`, `QG_LONG_REC`
  - `QG_LONG_EVIDENCE`, `QG_LONG_OVERVIEW`, `QG_CRITERIA_MISSING`, `QG_SCORE_RANGE`
  - `QG_CONSEQUENCE_CONTRACT`, `QG_THIN_RATIONALE`, `QG_PLACEHOLDER_RATIONALE`
  - `QG_LOW_EVIDENCE_COVERAGE`, `QG_MISSING_REQUIRED_EVIDENCE`
  - `QG_INDEPENDENCE_VIOLATION`, `QG_DUPLICATE_STRATEGIC_LEVER`
  - `QG_CONFIRMED_RATIONALE`, `QG_CRITERIA_SCOPE_SHAPE_MISMATCH`
  - `QG_EDITORIAL_GENERIC_FEEDBACK`, `QG_ARTIFACT_GATE_FAIL`
- **Required telemetry:** failed check IDs, error code histogram, per-criterion diagnostics
- **Required evidence artifact:** `quality_gate_diagnostics_v1` and check summary
- **Canon refs:** Volume III governance and pass-system doctrines
- **Spec refs:** `docs/QUALITY_GATES_v1.md`, Criterion Observability Addendum
- **Runtime refs:** `lib/evaluation/pipeline/qualityGate.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Partial

### `S10_PERSISTENCE` — Persistence

- **Supplier:** Quality gate pass result + EvaluationResultV2
- **Input:** gate pass and normalized result
- **Input acceptance metrics:**
  - no persist if gate fails
  - atomic persistence function available
- **Process / runtime code surface:**
  - `lib/evaluation/persistEvaluationResultV2.ts`
  - atomic RPC `persist_evaluation_v2_atomic` (invoked by runtime)
- **Output:** persisted artifact + terminal status update
- **Output acceptance metrics:**
  - artifact ID returned
  - terminal status written canonically
- **Customer / downstream stage:** `S11_RENDERER`
- **Gates / invariants:** no artifact persists after failed deterministic gate
- **Failure codes:** `EVALUATION_ARTIFACT_VALIDATION_FAILED`, `EVALUATION_GATE_REJECTED`
- **Required telemetry:** persistence gate trace + confidence derivation + reason codes
- **Required evidence artifact:** persisted `evaluation_artifacts` row and completion/failure envelope
- **Canon refs:** Phase 0.1–0.3 governance enforcement
- **Spec refs:** `docs/JOB_CONTRACT_v1.md`
- **Runtime refs:** `lib/evaluation/persistEvaluationResultV2.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Partial

### `S11_RENDERER` — Renderer

- **Supplier:** persisted artifacts and releasable job state
- **Input:** completed/releasable job + artifact retrieval
- **Input acceptance metrics:**
  - ownership/auth check passes
  - release gate passes
- **Process / runtime code surface:**
  - `app/api/evaluations/[jobId]/route.ts`
  - `app/evaluate/[jobId]/page.tsx`
  - `app/reports/[jobId]/page.tsx`
- **Output:** user/admin visible evaluation payload
- **Output acceptance metrics:**
  - source identified as artifact or inline fallback
  - no fabricated progress
- **Customer / downstream stage:** User/admin consumers
- **Gates / invariants:** UI/API reads persisted state only
- **Failure codes:** `401`, `404`, `409`, `500`
- **Required telemetry:** read path access and release decision events
- **Required evidence artifact:** response payload audit + source marker
- **Canon refs:** Volume III state model and fail-closed governance
- **Spec refs:** `docs/JOB_CONTRACT_v1.md`, `docs/NOMENCLATURE_CANON_v1.md`
- **Runtime refs:** `app/api/evaluations/[jobId]/route.ts`, `app/api/admin/pipeline-health/route.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

## Metric Contract Table

| Metric | Contract | Stage(s) |
|---|---|---|
| Canonical status set | status must be one of `queued|running|complete|failed` | S02–S11 |
| Claim atomicity | single atomic claimant per job lease window | S03 |
| Chunk determinism | stable boundaries and indices for same input/config | S04 |
| Pass independence | Pass 2 must not consume Pass 1 output; overlap guard enforced | S05–S06 |
| Synthesis completeness | pass3 output must be structurally consumable by normalization | S07 |
| Score/null separation | non-scorable criteria must not carry invalid numeric score semantics | S08–S09 |
| Deterministic quality gate | gate failures block downstream persistence | S09 |
| Persist fail-closed | no artifact write after gate or validation fail | S10 |
| Releasable read path | only releasable outputs are rendered | S11 |
| Gate-failure telemetry coverage | all gate failures emit required diagnostics | S09–S10 |

## Failure Code Registry

This registry indexes active runtime families used along the evaluation certification spine:

- Intake/queue/render HTTP families: `400`, `401`, `403`, `404`, `409`, `413`, `429`, `500`
- Pass failures: `PASS1_*`, `PASS2_*`, `PASS3_*`, `PIPELINE_INPUT_INVALID`
- Independence and editorial quality: `QG_INDEPENDENCE_VIOLATION`, `QG_EDITORIAL_GENERIC_FEEDBACK`
- Quality gate families: `QG_*` (as enumerated in `S09_QUALITYGATEV2`)
- Persistence boundary failures: `EVALUATION_ARTIFACT_VALIDATION_FAILED`, `EVALUATION_GATE_REJECTED`

Reference implementation list: `lib/evaluation/pipeline/qualityGate.ts`, `lib/evaluation/persistEvaluationResultV2.ts`, runtime route handlers.

## Evidence Artifact Requirements

Minimum evidence artifacts required for certification claims:

1. **Stage execution evidence** — stage timing traces with trace/job identifiers.
2. **Failure envelope evidence** — `pipeline_failure_envelope` for failed stages.
3. **Quality gate diagnostic evidence** — `quality_gate_diagnostics_v1` artifacts on gate failures.
4. **Pass output diagnostic evidence** — pass artifacts used to reconstruct gate decisions.
5. **Persistence decision evidence** — gate enforcement trace persisted with terminal job state.
6. **Render-source evidence** — artifact vs inline source marker on retrieval paths.

No stage is certifiable without reproducible evidence artifacts for pass and fail outcomes.

## Certification Status Matrix

| Stage ID | Certification status | Notes |
|---|---|---|
| `S01_INTAKE` | Partial | Input validation strong; certification fixture coverage pending |
| `S02_QUEUE` | Proven | Canonical status/transition enforcement in place |
| `S03_CLAIM` | Proven | Atomic claim RPC + lease hardening enforced |
| `S04_ROUTING_CHUNKING` | Emerging | Operationally visible, needs fixture/harness certification |
| `S05_PASS1` | Partial | Stable path, but stress-certification not yet frozen |
| `S06_PASS2` | Partial | Independence checks exist; adversarial certification pending |
| `S07_PASS3` | High-risk | Upstream of highest-risk seam |
| `S08_ER2_NORMALIZATION` | High-risk | Boundary semantics and score/null integrity critical |
| `S09_QUALITYGATEV2` | Partial | Deterministic gate active; statistical certification pending |
| `S10_PERSISTENCE` | Partial | Atomic enforcement present; seam risk remains |
| `S11_RENDERER` | Emerging | Releasability/read-path contract active, calibration pending |

## Deferred / Adjacent Runtime Paths

- **Deferred/adjacent only:** WAVE, Gate 15, Revision Execution.
- They are not part of the active 11-stage evaluation certification spine in this contract.
- They may only be promoted into active spine scope after explicit proven runtime integration and dedicated in-scope certification updates.

### Release Certification (Pre-SIPOC change-control layer)

Critical-path/checks release verification is treated as a **cross-cutting governance wrapper**, not an evaluation runtime stage.

- Runtime SIPOC (this document) answers: *does evaluation execution obey stage contracts?*
- Release certification answers: *is a code change safe to merge/deploy?*

This separation is deliberate to avoid mixing PR ship-gate governance with runtime stage-contract semantics.
