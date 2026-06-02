# SIPOC Evaluation Process — Canonical Runtime Certification Index

Status: Canonical certification index for **evaluation runtime spine only** (PR A, docs-only)

## Purpose

Freeze the canonical certification spine for evaluation runtime execution so downstream fixture, harness, CI, and telemetry work (PR B–E) can be built against explicit stage contracts instead of inferred behavior.

This document is intentionally scoped to active evaluation runtime flow and excludes implementation of harnesses, fixtures, CI certification workflows, dashboard behavior changes, or any runtime behavior change.

## Authority Order

### Canon

1. `docs/canon/intake/_md/VOLUME II — STORY EVALUATION CRITERIA & ANALYTICAL FRAMEWORK (V2.0).md`
2. `docs/canon/intake/_md/REVISIONGRADE CANON ADDENDUM Criterion Observability & Signal Sufficiency Model.md`
3. `docs/canon/intake/_md/VOLUME III — EVALUATION PIPELINE ARCHITECTURE (PASS SYSTEM).md`
4. `docs/canon/intake/_md/VOLUME III — FINAL PIPELINE DIAGRAM + STATE MODEL.md`
5. `docs/canon/intake/_md/E2E Evaluation Flow Architecture.md`
6. `docs/canon/intake/_md/PHASE 0.1–0.3 — CANON INTEGRATION & GOVERNANCE ENFORCEMENT SPEC.md`

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

### Full Evaluation Pipeline (including seeding)

`Phase 0 Warmup -> Phase 0.5A Story Map Seed -> Phase 0.5B Revise Opportunity Seed -> Seed Completeness Gate -> Intake -> Queue -> Claim -> Routing/Chunking -> Phase 1A (Pass 1 extraction) -> Story Layer Quality Gate -> Review Gate -> Phase 2 (Pass 2 craft diagnosis) -> Phase 3 (Pass 3 synthesis) -> EvaluationResultV2 normalization -> QualityGateV2 -> Persistence -> Renderer -> Revision Opportunity Ledger -> Revise Queue`

### Runtime Spine (S01–S11)

`Intake -> Queue -> Claim -> Routing/Chunking -> Pass 1 -> Pass 2 -> Pass 3 -> EvaluationResultV2 normalization -> QualityGateV2 -> Persistence -> Renderer`

**Highest-risk seam (explicit):**

`Pass 3 -> EvaluationResultV2 normalization -> QualityGateV2 -> Persistence`

Reason: this seam carries synthesis correctness, normalization semantics, deterministic gate enforcement, and fail-closed persistence guarantees in one boundary chain.

**Seeding seam (explicit):**

`Phase 0 -> Phase 0.5A -> Phase 0.5B -> Seed Completeness Gate -> Phase 1A`

Reason: the entire downstream pipeline quality depends on seed completeness and authority proof. Degraded or missing seeds propagate error through every subsequent phase.

## SIPOC Stage Table

### Adjacent / Seeding Stages

| Stage | Stage ID | Supplier | Customer / Downstream | Certification Status |
|---|---|---|---|---|
| Phase 0 Warmup | `ADJACENT_PHASE_0` | Canon docs + benchmarks + manifest | `ADJACENT_PHASE_0_5A`, `ADJACENT_PHASE_0_5B` | Emerging |
| Phase 0.5A Story Map Seed | `ADJACENT_PHASE_0_5A` | Phase 0 authority proof + manuscript | `ADJACENT_SEED_COMPLETENESS_GATE`, `S05_PASS1` (Phase 1A) | Emerging |
| Phase 0.5B Revise Opportunity Seed | `ADJACENT_PHASE_0_5B` | Phase 0 authority proof + manuscript + 13 criteria canon | `ADJACENT_REVISE` (Revise admission) | Emerging |
| Seed Completeness Gate | `ADJACENT_SEED_COMPLETENESS_GATE` | Phase 0.5A seed artifacts | `S05_PASS1` (Phase 1A) or seed regeneration | Emerging |
| Story Layer Quality Gate | `ADJACENT_SEMANTIC_GATE` | Phase 1A story layer output + benchmarks | Review Gate | Emerging |
| Review Gate | `ADJACENT_REVIEW_GATE` | Author + quality report + story layers | `S06_PASS2` (Phase 2) | Emerging |

### Runtime Spine Stages (S01–S11)

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
| Renderer | `S11_RENDERER` | API read path + UI | End user / admin, `ADJACENT_REVISE` | Emerging |

### Evaluation → Revise Handoff Stages

| Stage | Stage ID | Supplier | Customer / Downstream | Certification Status |
|---|---|---|---|---|
| Revision Opportunity Ledger | `ADJACENT_REVISION_LEDGER` | Phase 2 + Phase 3 evaluation artifacts | `ADJACENT_REVISE` (Revise Queue) | Emerging |
| Revise Admission | `ADJACENT_REVISE` | revision_opportunity_ledger_v1 + revise_opportunity_seed_v1 | Revise Queue / TrustedPath / Author | Emerging |

## Canonical Stage Identifier Register (Immutable)

The following stage IDs are canonical runtime certification identifiers and are **immutable** unless superseded by explicit canon-governed revision:

### Runtime Spine (S01–S11)

- `S01_INTAKE`
- `S02_QUEUE`
- `S03_CLAIM`
- `S04_ROUTING_CHUNKING`
- `S05_PASS1`
- `S06_PASS2`
- `S07_PASS3`
- `S08_ER2_NORMALIZATION`
- `S09_QUALITYGATEV2`
- `S10_PERSISTENCE`
- `S11_RENDERER`

### Adjacent / Seeding / Handoff Stages

- `ADJACENT_PHASE_0`
- `ADJACENT_PHASE_0_5A`
- `ADJACENT_PHASE_0_5B`
- `ADJACENT_SEED_COMPLETENESS_GATE`
- `ADJACENT_PASS_3A`
- `ADJACENT_SEMANTIC_GATE`
- `ADJACENT_REVIEW_GATE`
- `ADJACENT_REVISION_LEDGER`
- `ADJACENT_REVISE`
- `ADJACENT_LLR`
- `ADJACENT_WAVE`

Governance requirements for identifier changes:

1. No silent rename, aliasing, or inferred mapping.
2. Any stage-ID change requires explicit governance review and versioned contract update.
3. Downstream assets (fixtures, harness, CI, telemetry, dashboards) must treat these IDs as stable keys.
4. If evolution is required, introduce a versioned migration plan before runtime adoption.
5. Adjacent stage identifiers carry the same immutability rules as runtime spine identifiers.

### Stage Contract Details

### `ADJACENT_PHASE_0` — Phase 0 Warmup

- **Supplier:** Canon docs, benchmark manifests, governance docs
- **Input:** Warmup manifest + what-not-to-do + benchmark references + fail-closed rules + SIPOC quality gates + seed governance
- **Input acceptance metrics:**
  - `PHASE_0_WARMUP_BENCHMARK_MANIFEST.md` resolved
  - `WHAT_NOT_TO_DO.md` loaded
  - `STORY_LEDGER_LAYER_FAILURE_MODES.md` loaded
  - `REVISIONGRADE_FAIL_CLOSED_RULES.md` loaded
  - `SIPOC_INPUT_OUTPUT_QUALITY_GATES.md` loaded
  - `SEED_AND_PHASE_1A_GOVERNANCE.md` loaded
  - All required benchmark docs available
  - No live PR mining at runtime
- **Process / runtime code surface:**
  - `lib/evaluation/phase-architecture-v2/phase0AuthorityProof.ts`
  - `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (phase_0 row)
- **Output:** `phase0_authority_proof_v1` — compact warmup context with loaded authority paths, checksums, selected route, and benchmark references
- **Output acceptance metrics:**
  - Authority paths loaded and checksummed
  - Benchmark path list present
  - Fail-closed doctrine loaded
  - Route selected: short-form / long-form / long-form multi-layer
  - `schema_valid = true`
  - `is_resume_safe` determined
- **Customer / downstream stage:** `ADJACENT_PHASE_0_5A`, `ADJACENT_PHASE_0_5B`
- **Gates / invariants:** Phase 0.5A and 0.5B must not start without proven Phase 0 authority. Canon sources missing must be explicitly recorded.
- **Failure codes:** `PHASE0_AUTHORITY_MISSING`, `PHASE0_MANIFEST_UNRESOLVED`
- **Required telemetry:** authority proof generation timing, loaded path count, missing path count
- **Required evidence artifact:** `phase0_authority_proof_v1` with full authority path checksums
- **Canon refs:** Phase 0.1–0.3 governance enforcement, warmup benchmark manifest
- **Spec refs:** `docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md`, `docs/phase-0-warmup/PHASE_0_WARMUP_BENCHMARK_MANIFEST.md`
- **Runtime refs:** `lib/evaluation/phase-architecture-v2/phase0AuthorityProof.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### `ADJACENT_PHASE_0_5A` — Phase 0.5A Story Map Seed

- **Supplier:** Phase 0 authority proof + manuscript text + benchmarks
- **Input:** `phase0_authority_proof_v1` + manuscript ingestion/source text + chunk/routing manifest + manuscript version ID
- **Input acceptance metrics:**
  - `phase0_authority_proof_v1` present and valid
  - Authority paths loaded and checksummed against Phase 0 proof
  - Manuscript text available
  - Canon sources missing list explicitly recorded
- **Process / runtime code surface:**
  - `lib/evaluation/phase-architecture-v2/phase05aStoryMapSeed.ts`
  - `lib/evaluation/seed/semanticSeedGenerator.ts`
  - `lib/evaluation/seed/seedScaffoldFactory.ts`
  - `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (phase_0_5a row)
- **Output:** `story_map_seed_v1` + `evaluation_seed_v1`
- **Output acceptance metrics:**
  - `story_map_seed_v1` includes: candidate_entity_registry, candidate_alias_map, candidate_relationship_map, candidate_object_symbol_map, candidate_location_map, candidate_timeline_map, candidate_pov_map, candidate_pressure_map, candidate_open_loop_map, uncertainty_flags
  - `evaluation_seed_v1` includes: likely_13_criteria_strengths, likely_13_criteria_risks, known_story_risks, known_evidence_targets
  - `seed_status = candidate_provisional` (not final authority)
  - All 9 Story Ledger layer scaffolds present
  - All 13 criteria scaffolded
  - `schema_valid = true`
  - `semantic_status` determined (valid / degraded_with_reasons / blocked)
  - No final scores in seed
  - No final verdict in seed
  - `seed_authority = seed_only`
- **Customer / downstream stage:** `ADJACENT_SEED_COMPLETENESS_GATE`, `S05_PASS1` (Phase 1A)
- **Gates / invariants:** Seeds must run only after Phase 0 governance warmup is loaded and proven. Seeds are provisional candidate scaffolds — not evaluation authority. Phase 0.5A answers: "what does the manuscript contain?"
- **Failure codes:** `SEED_GENERATION_FAILED`, `SEED_AUTHORITY_PROOF_MISSING`
- **Required telemetry:** seed generation timing, scaffold completeness counts, semantic status
- **Required evidence artifact:** `story_map_seed_v1` + `evaluation_seed_v1` with authority proof linkage
- **Canon refs:** Volume III pass architecture, Story Ledger layer contract
- **Spec refs:** `docs/phase-0-warmup/SEED_AND_PHASE_1A_GOVERNANCE.md`, `docs/prs/p16-phase-0-5a-story-map-seed-producer.md`
- **Runtime refs:** `lib/evaluation/phase-architecture-v2/phase05aStoryMapSeed.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### `ADJACENT_PHASE_0_5B` — Phase 0.5B Revise Opportunity Seed

- **Supplier:** Phase 0 authority proof + manuscript text + 13 criteria canon + Revise Queue candidate-prose contract
- **Input:** `phase0_authority_proof_v1` + manuscript ingestion/source text + 13 Story Criteria canon + WAVE/long-form readiness canon (where eligible) + dialogue/speech/POV protection canon + Gate 15/long-form governance (where eligible) + Revise Queue candidate-prose contract
- **Input acceptance metrics:**
  - `phase0_authority_proof_v1` present and valid
  - Authority paths loaded and checksummed against Phase 0 proof
  - 13 criteria canon loaded
  - Revise candidate-prose contract loaded
  - Manuscript text available
- **Process / runtime code surface:**
  - `lib/evaluation/phase-architecture-v2/phase05bReviseOpportunitySeed.ts`
  - `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (phase_0_5b row)
- **Output:** `revise_opportunity_seed_v1`
- **Output acceptance metrics:**
  - Each opportunity includes: opportunity_id, criterion_key, canon_basis[], authority_path_basis[], severity (MUST/SHOULD/COULD), scope, location_label, location_anchor, original_passage, operation_type, symptom, cause, reader_effect, evidence, fix_direction, mistake_proofing, candidate_a, candidate_b, candidate_c, author_decision_status (= pending), validation_status (= unvalidated)
  - A/B/C candidates are actual manuscript-ready prose — not meta-instructions
  - Every opportunity has an evidence anchor
  - `schema_valid = true`
  - `semantic_status` determined
- **Customer / downstream stage:** `ADJACENT_REVISE` (Revise admission)
- **Gates / invariants:** Phase 0.5B answers: "what targeted revision opportunities appear to exist, where are they, why do they matter, and what candidate repairs can the author choose?" Seeds must not be generated from manuscript text alone without proven canon governance. Forbidden: generating revision-opportunity seeds while pretending RevisionGrade canon governed the result.
- **Failure codes:** `REVISE_SEED_GENERATION_FAILED`, `REVISE_SEED_AUTHORITY_PROOF_MISSING`
- **Required telemetry:** seed generation timing, opportunity count, severity distribution, semantic status
- **Required evidence artifact:** `revise_opportunity_seed_v1` with authority proof linkage and per-opportunity evidence anchors
- **Canon refs:** Volume II criteria canon, Revise Queue candidate-prose contract
- **Spec refs:** `docs/architecture/phase-0-5b-revise-opportunity-seed.md`, `docs/prs/p17-phase-0-5b-revise-opportunity-seed-producer.md`
- **Runtime refs:** `lib/evaluation/phase-architecture-v2/phase05bReviseOpportunitySeed.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### `ADJACENT_SEED_COMPLETENESS_GATE` — Seed Completeness Gate

- **Supplier:** Phase 0.5A seed artifacts
- **Input:** `story_map_seed_v1` + `evaluation_seed_v1`
- **Input acceptance metrics:**
  - Both seed artifacts present
  - Schema validation passed on both
- **Process / runtime code surface:**
  - `lib/evaluation/seed/seedCompletenessGuard.ts`
  - `lib/evaluation/seed/phase1aSeedRuntimeGate.ts`
- **Output:** `seed_fit_gap_report_v1` — status: blocked / passed / passed_with_warnings
- **Output acceptance metrics:**
  - Missing required seed sections detected
  - Fit-gap report persisted
  - Phase 1A blocked on incomplete seed (`SEED_FIT_GAP_BLOCKED`)
  - Gap severity classified as blocker or warning
- **Customer / downstream stage:** `S05_PASS1` (Phase 1A) — if passed; seed regeneration — if blocked
- **Gates / invariants:** Phase 1A must not start with incomplete seeds. Doctrine: `complete_seed_artifacts_required_before_phase_1a`.
- **Failure codes:** `SEED_FIT_GAP_BLOCKED`
- **Required telemetry:** seed completeness check timing, gap count, gap severity distribution
- **Required evidence artifact:** `seed_fit_gap_report_v1` with gap details
- **Canon refs:** Seed governance doctrine
- **Spec refs:** `docs/phase-0-warmup/SEED_AND_PHASE_1A_GOVERNANCE.md`
- **Runtime refs:** `lib/evaluation/seed/seedCompletenessGuard.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### `ADJACENT_SEMANTIC_GATE` — Story Layer Quality Gate

- **Supplier:** Phase 1A story layer output + benchmarks + layer validators
- **Input:** `pass1a_story_layer_v1` + benchmark targets + layer validators
- **Input acceptance metrics:**
  - Story layer output present
  - Benchmark comparison targets loaded
- **Process / runtime code surface:**
  - `lib/evaluation/phase1a/buildLedgerQualityReport.ts`
  - `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (semantic_gate row)
- **Output:** `ledger_quality_report_v1` — per-layer classification + `semantic_gate_result_v1` + `accepted_story_context_v1`
- **Output acceptance metrics:**
  - Every visible layer classified: valid / degraded_with_caution / suppressed_insufficient_evidence / suppressed_conflicting_signals / failed_benchmark_minimum
  - Failed benchmark minimum blocks approval
  - Dirty layers suppressed/degraded (not rendered as clean)
  - Author-safe reason shown
  - Valid empty pronoun state allowed
  - Raw malformed layer NOT rendered
  - Entity-typing contamination suppressed before accountability checks
  - WARN-prefixed items never promoted to hard_fail
  - Ending accountability hard-fail ONLY when: long_form_evaluation mode + verified primary character + clean preflight authority + evidence-backed
- **Customer / downstream stage:** `ADJACENT_REVIEW_GATE`
- **Gates / invariants:** If Canonical Identity is degraded, dependent layers (Cast, POV, relationships, objects, timeline, threat, source integrity) must not render as clean. Content certainty requires evidence authority — if Track C / Pass 3A authority is degraded, the system cannot confidently issue content hard-fails.
- **Failure codes:** `REVIEW_GATE_QUALITY_HARD_FAIL`, `REVIEW_GATE_QUALITY_TECHNICAL_BLOCK`
- **Required telemetry:** quality check results, hard-fail triage classifications, layer status distribution
- **Required evidence artifact:** `ledger_quality_report_v1` with per-check severity and triage reasoning
- **Canon refs:** Volume III pass architecture, Entity-Typing Validator doctrine
- **Spec refs:** `docs/QUALITY_GATES_v1.md`
- **Runtime refs:** `lib/evaluation/phase1a/buildLedgerQualityReport.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### `ADJACENT_REVIEW_GATE` — Review Gate

- **Supplier:** Author + quality report + story layers
- **Input:** `pass1a_story_layer_v1` + `ledger_quality_report_v1` + author decisions/comments
- **Input acceptance metrics:**
  - All visible layers reviewed
  - Invalid status vocabulary normalized/rejected
  - Comments required for correction/reject states
  - Failed layers excluded from approval
- **Process / runtime code surface:**
  - `lib/evaluation/processor.ts` (Review Gate handler)
  - `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (semantic_gate row output)
- **Output:** `accepted_story_ledger_v1`
- **Output acceptance metrics:**
  - `accepted_story_ledger_v1` persisted
  - All visible layers have review decision
  - Short-form jobs (<25k words) bypass Review Gate — Phase 0.5A + Phase 0.5B + manuscript text + deterministic evidence validator is sufficient authority
  - Long-form jobs (≥25k words) require operator review for genuine hard-fails
- **Customer / downstream stage:** `S06_PASS2` (Phase 2)
- **Gates / invariants:** Phase 2 remains blocked on `accepted_story_ledger_v1` (Review Gate authority). Short-form insufficiency renders as N/A / advisory / warning / insufficient_evidence — not terminal failure. No short-form job requires `accepted_story_ledger_v1`.
- **Failure codes:** `REVIEW_GATE_REJECTED`, `REVIEW_GATE_TIMEOUT`
- **Required telemetry:** review gate decision, time-to-review, layer acceptance rates
- **Required evidence artifact:** `accepted_story_ledger_v1` with per-layer review decisions
- **Canon refs:** RevisionGrade Operating Model, Phase 0.1–0.3 governance
- **Spec refs:** `docs/QUALITY_GATES_v1.md`
- **Runtime refs:** `lib/evaluation/processor.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

---

### Runtime Spine Stage Contracts (S01–S11)

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
| Seed-as-baseline-authority | Phase 1A must treat seed entities as 95%+ quality baseline; deviations require manuscript evidence | ADJACENT_PHASE_0_5A, S05_PASS1 |
| Seed format conformance | Seeds must match canonical templates (layer scaffold + criterion scaffold fields) | ADJACENT_SEED_COMPLETENESS_GATE |
| Entity contamination rejection | Pseudo-entities (pronouns, descriptors, fragments) rejected before ledger assembly | S05_PASS1 |
| Revision ledger evidence coverage | Every revision opportunity must have an evidence anchor traceable to evaluation | ADJACENT_REVISION_LEDGER |
| Revise-is-not-evaluator | Revise Queue must consume `revision_opportunity_ledger_v1` — must NOT rerun evaluation | ADJACENT_REVISE |
| Ready vs Needs Targeting separation | Ready items must have surgical A/B/C prose; non-surgical items classified as Needs Targeting | ADJACENT_REVISE |
| Author decision persistence | Every author decision on a revision opportunity must be persisted to `revision_ledger_decisions` | ADJACENT_REVISE |
| TrustedPath eligibility | Only `approve`-verdict repairs (from Perplexity cross-check where enabled) are TrustedPath eligible | ADJACENT_REVISE |

## Failure Code Registry

This registry indexes active runtime families used along the evaluation certification spine:

- Intake/queue/render HTTP families: `400`, `401`, `403`, `404`, `409`, `413`, `429`, `500`
- Pass failures: `PASS1_*`, `PASS2_*`, `PASS3_*`, `PIPELINE_INPUT_INVALID`
- Independence and editorial quality: `QG_INDEPENDENCE_VIOLATION`, `QG_EDITORIAL_GENERIC_FEEDBACK`
- Quality gate families: `QG_*` (as enumerated in `S09_QUALITYGATEV2`)
- Persistence boundary failures: `EVALUATION_ARTIFACT_VALIDATION_FAILED`, `EVALUATION_GATE_REJECTED`
- Seed enforcement failures: `SEED_GENERATION_FAILED`, `SEED_AUTHORITY_PROOF_MISSING`, `SEED_FIT_GAP_BLOCKED`, `SEED_DRIFT_REQUEUE_RECOMMENDED`
- Phase 0 failures: `PHASE0_AUTHORITY_MISSING`, `PHASE0_MANIFEST_UNRESOLVED`
- Revise seed failures: `REVISE_SEED_GENERATION_FAILED`, `REVISE_SEED_AUTHORITY_PROOF_MISSING`
- Revision ledger failures: `REVISION_LEDGER_ASSEMBLY_FAILED`, `REVISION_LEDGER_EVIDENCE_MISSING`, `REVISION_LEDGER_EMPTY`
- Revise admission failures: `REVISE_ADMISSION_FAILED`, `REVISE_QUEUE_EMPTY`, `REVISE_EVIDENCE_MISSING`, `REVISE_ABC_NOT_PROSE`, `REVISE_AUTHOR_DECISION_NOT_PERSISTED`

Reference implementation list: `lib/evaluation/pipeline/qualityGate.ts`, `lib/evaluation/persistEvaluationResultV2.ts`, `lib/evaluation/seed/seedCompletenessGuard.ts`, `lib/evaluation/seed/twoPassSeedValidation.ts`, runtime route handlers.

## Evidence Artifact Requirements

Minimum evidence artifacts required for certification claims:

1. **Stage execution evidence** — stage timing traces with trace/job identifiers.
2. **Failure envelope evidence** — `pipeline_failure_envelope` for failed stages.
3. **Quality gate diagnostic evidence** — `quality_gate_diagnostics_v1` artifacts on gate failures.
4. **Pass output diagnostic evidence** — pass artifacts used to reconstruct gate decisions.
5. **Persistence decision evidence** — gate enforcement trace persisted with terminal job state.
6. **Render-source evidence** — artifact vs inline source marker on retrieval paths.

7. **Seed enforcement evidence** — `seed_fit_gap_report_v1` on completeness gate, `seed_contradiction_report_v1` on drift detection, per-chunk `seed_validation` arrays from two-pass extraction.
8. **Revision opportunity ledger evidence** — `revision_opportunity_ledger_v1` with per-opportunity evidence anchors, finding IDs, and source artifact references.
9. **Revise Queue decision evidence** — `revision_ledger_decisions` with per-opportunity author decisions and timestamps.

No stage is certifiable without reproducible evidence artifacts for pass and fail outcomes.

## Evaluation Mode Doctrine

RevisionGrade has three evaluation depths, and the pipeline must respect mode boundaries:

### Short-form evaluation (under 25k words)
- **Scope:** Excerpts, chapters, openings, shorter submissions
- **Uses:** 13 story criteria ONLY (Concept, Narrative Drive & Momentum, Character, Voice, Scene Construction, Dialogue, Theme, Worldbuilding, Pacing, Prose Control, Tone, Narrative Closure, Marketability)
- **Does NOT use:** Story Ledger authority, WAVE, Golden Spine, manuscript-scale continuity
- **Missing long-form evidence renders as:** N/A, advisory, warning, or insufficient evidence — NOT fake certainty
- **Seed depth:** Lightweight seeds (entities + basic criteria scaffolds)

### Long-form evaluation (25k+ words)
- **Scope:** Manuscript-scale submissions
- **Uses:** Full Story Ledger, governing canon, accepted story authority, manuscript-scale continuity, broader structural diagnosis
- **Seed depth:** Full scaffold (all 9 Story Ledger layers + all 13 criteria)

### Long-form multi-layer evaluation (75k+ words, high complexity)
- **Scope:** Multi-world, multi-POV, high-complexity novels
- **Uses:** Golden Spine, WAVE-informed readiness governance, canon/gate checks, continuity ledgers, manuscript-scale protection rules
- **Important:** WAVE is part of evaluation/readiness governance — it is NOT the Revise engine
- **Seed depth:** Full scaffold + Golden Spine + WAVE readiness sections

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
| `ADJACENT_PHASE_0` | Emerging | Authority proof generation active; fixture coverage pending |
| `ADJACENT_PHASE_0_5A` | Emerging | Seed generation active; two-pass validation implemented; format conformance guard active |
| `ADJACENT_PHASE_0_5B` | Emerging | Revise opportunity seed generation active; candidate-prose contract defined |
| `ADJACENT_SEED_COMPLETENESS_GATE` | Emerging | Completeness + format conformance checks active; blocking on incomplete seeds |
| `ADJACENT_SEMANTIC_GATE` | Emerging | Quality checks + hard-fail triage + entity contamination filter active |
| `ADJACENT_REVIEW_GATE` | Emerging | Author review surface active; short-form bypass implemented |
| `ADJACENT_REVISION_LEDGER` | Emerging | Ledger assembly defined; evidence anchor requirement specified |
| `ADJACENT_REVISE` | Emerging | Queue admission contract defined; Ready vs Needs Targeting specified |

### Evaluation → Revise Handoff Stage Contracts

### `ADJACENT_REVISION_LEDGER` — Revision Opportunity Ledger

- **Supplier:** Phase 2 craft diagnosis + Phase 3 synthesis + evaluation artifacts
- **Input:** `evaluation_result_v2` + `criterion_scores_v1` + `diagnostic_findings_v1` + `accepted_story_ledger_v1` (long-form) + evaluation evidence chain
- **Input acceptance metrics:**
  - `evaluation_result_v2` present and gate-passed
  - All 13 criteria scored (or explicitly marked non-scorable with reason)
  - Diagnostic findings have evidence anchors
  - Source artifact references resolvable
- **Process / runtime code surface:**
  - `lib/evaluation/processor.ts` (revision opportunity ledger assembly)
  - `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (revision_ledger row)
- **Output:** `revision_opportunity_ledger_v1`
- **Output acceptance metrics:**
  - Every opportunity includes: `manuscript_id`, `evaluation_job_id`, `finding_id`, `criterion`, `severity` (Must / Should / Could), `source_text` or affected passage, `source_location`, `affected_manuscript_span`, `evidence_anchor`, `diagnosis` (symptom + likely cause + reader effect), `fix_direction`, `mistake_proofing_guidance`, `revision_operation`, `confidence`, `source_artifact_reference`, `status`
  - No opportunity without an evidence anchor
  - No opportunity without a specific source target and operation
  - Severity must be Must / Should / Could — not arbitrary free text
  - Every opportunity traceable to a `finding_id` from `diagnostic_findings_v1`
  - Ready vs Needs Targeting classification for each opportunity
- **Customer / downstream stage:** `ADJACENT_REVISE` (Revise Queue)
- **Gates / invariants:**
  - **Governing doctrine:** "No evaluation evidence = no Revise Queue item."
  - Revise Queue items are populated FROM evaluation evidence — never invented after the fact
  - Vague paragraph advice without evidence is rejected
  - "Expand this" or "improve that" without specific source target and operation is rejected
  - `revision_opportunity_ledger_v1` is the single bridge artifact between Evaluation and Revise
- **Failure codes:** `REVISION_LEDGER_ASSEMBLY_FAILED`, `REVISION_LEDGER_EVIDENCE_MISSING`, `REVISION_LEDGER_EMPTY`
- **Required telemetry:** opportunity count, severity distribution (Must/Should/Could), Ready vs Needs Targeting ratio, evidence coverage percentage
- **Required evidence artifact:** `revision_opportunity_ledger_v1` with per-opportunity evidence anchors and source artifact references
- **Canon refs:** Volume II criteria canon, RevisionGrade Evaluation → Revise Queue Operating Doctrine
- **Spec refs:** `docs/architecture/phase-0-5b-revise-opportunity-seed.md` (seed contract), `docs/prs/p17-phase-0-5b-revise-opportunity-seed-producer.md`
- **Runtime refs:** `lib/evaluation/processor.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### `ADJACENT_REVISE` — Revise Queue Admission

- **Supplier:** `revision_opportunity_ledger_v1` + `revise_opportunity_seed_v1` (where available)
- **Input:** Revision opportunity ledger from completed evaluation + optional Phase 0.5B revise opportunity seeds
- **Input acceptance metrics:**
  - `revision_opportunity_ledger_v1` present and non-empty
  - Each queue item has required fields (criterion, severity, source_location, evidence_anchor, diagnosis, revision_operation, confidence)
  - A/B/C repair options (where Ready) are actual manuscript-ready prose — not meta-instructions or problem restatements
  - `revise_opportunity_seed_v1` merged if present (seeds enrich, evaluation evidence governs)
- **Process / runtime code surface:**
  - Revise Queue admission handler (consumes `revision_opportunity_ledger_v1`)
  - `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (revise_admission row)
- **Output:** Populated Revise Queue with classified opportunities
- **Output acceptance metrics:**
  - **Ready items** have: specific source location, specific source text or manuscript span, clear revision operation, evidence anchor, A/B/C options as actual manuscript-ready candidate revisions, author controls
  - **Needs Targeting items** are real but not yet surgical: good diagnosis without exact passage, pattern-level issues without chosen target, broad structural issues requiring author review, instructions instead of copy-ready prose
  - Ready and Needs Targeting items are NOT mixed
  - Author decision fields initialized: Accept A / Accept B / Accept C / Keep Original / Reject Opportunity / Defer / Write Custom
  - Every queue item linked to `evaluation_job_id` and `finding_id`
- **A/B/C repair option requirements:**
  - **A — Recommended Repair:** Most direct, safest, best-aligned repair
  - **B — Balanced Variant:** Different rhythm, structure, or emphasis but same repair intent
  - **C — Bolder Rendering Shift:** More assertive or stylistically distinct version
  - A/B/C must NOT repeat the problem statement
  - A/B/C must NOT be meta-instructions
  - A/B/C must be text the author can accept, reject, or customize
- **Author sovereignty controls:**
  - Accept A / Accept B / Accept C / Keep Original / Reject Opportunity / Defer / Write Custom
  - No system-generated rewrite silently overwrites manuscript without recorded author decision or TrustedPath authorization
- **Customer / downstream stage:** Author decision surface, TrustedPath, Perplexity repair cross-check (where enabled)
- **Gates / invariants:**
  - **Governing doctrine:** "Revise is a consume-and-repair surface, not a second diagnosis engine."
  - Revise must NOT rerun evaluation to find opportunities
  - Revise must NOT create opportunities without evidence anchors
  - Supporting diagnostics must NOT be shown as copy-ready repairs
  - Short-form evaluations must NOT pretend to have WAVE/Golden Spine certainty
  - Author decisions must be persisted to `revision_ledger_decisions`
  - Revise Queue must NOT be empty simply because the summary report had few top recommendations
  - UI must NOT send users to public Revise marketing page instead of authenticated workbench
- **TrustedPath requirements:**
  - Apply all eligible Recommended Repair A options across a protected manuscript copy after preview/confirmation
  - Preserve: original manuscript, revised manuscript version, changelog, decision ledger, rollback ability, final review before/after visibility
  - Only items passing eligibility rules are auto-eligible
  - If Perplexity repair cross-check is active, only independently approved (`approve` verdict) repairs are TrustedPath eligible
  - Flagged, rejected, unavailable, pending, or uncertain repairs stay in manual review
- **Perplexity / repair cross-check role (where enabled):**
  - Verifier, not primary writer
  - Checks: addresses diagnosis, preserves author voice, avoids over-editing, no new problems introduced, grounded in original evidence
  - Verdicts: `approve` / `flag` / `reject` / `unavailable` / `pending`
  - Only `approve` is TrustedPath eligible; all others require manual author review
- **Failure codes:** `REVISE_ADMISSION_FAILED`, `REVISE_QUEUE_EMPTY`, `REVISE_EVIDENCE_MISSING`, `REVISE_ABC_NOT_PROSE`, `REVISE_AUTHOR_DECISION_NOT_PERSISTED`
- **Required telemetry:** queue item count, Ready vs Needs Targeting ratio, severity distribution, author decision rates, TrustedPath eligibility rate
- **Required evidence artifact:** Populated Revise Queue with per-item evidence anchors, source artifact references, and author decision state
- **Canon refs:** RevisionGrade Evaluation → Revise Queue Operating Doctrine, Volume II criteria canon
- **Runtime refs:** Revise Queue admission handler
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### Anti-Patterns (Evaluation → Revise Boundary)

The following patterns violate the Evaluation → Revise Operating Doctrine and must be rejected by any implementation:

1. Revise calls the evaluator again to find opportunities
2. Revise creates opportunities without evidence anchors
3. A/B/C options are generic advice instead of manuscript-ready text
4. Supporting diagnostics are shown as copy-ready repairs
5. Short-form evaluations pretend to have WAVE/Golden Spine certainty
6. Author decisions are not persisted
7. TrustedPath applies unverified or unavailable repairs
8. A generated revised manuscript overwrites the original
9. Revise Queue is empty simply because the summary report had few top recommendations
10. The UI sends users to the public Revise marketing page instead of the authenticated workbench
11. Re-evaluation runs on the original manuscript version instead of the revised manuscript version

## Deferred / Adjacent Runtime Paths

- **Deferred/adjacent only:** WAVE, Gate 15, Revision Execution.
- They are not part of the active 11-stage evaluation certification spine in this contract.
- They may only be promoted into active spine scope after explicit proven runtime integration and dedicated in-scope certification updates.

### Release Certification (Pre-SIPOC change-control layer)

Critical-path/checks release verification is treated as a **cross-cutting governance wrapper**, not an evaluation runtime stage.

- Runtime SIPOC (this document) answers: *does evaluation execution obey stage contracts?*
- Release certification answers: *is a code change safe to merge/deploy?*

This separation is deliberate to avoid mixing PR ship-gate governance with runtime stage-contract semantics.

## Contract Governance Control

This document is constitutional infrastructure for evaluation certification.

Operational governance implications:

1. Changes to stage identifiers, authority order, doctrine laws, seam definitions, or evidence requirements require explicit governance review.
2. Runtime behavior remains subordinate to canon/spec authority defined above.
3. PR B–E implementation artifacts must be derived from this contract and must not redefine contract law ad hoc.
