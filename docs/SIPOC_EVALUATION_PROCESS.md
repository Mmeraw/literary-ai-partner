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
7. `docs/canon/registered/volumes/GENRE_EXPECTATIONS_VOLUME_II_AND_REVISE_MODE_CONTRACT.md`

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
- `lib/evaluation/canonGovernanceRunner.ts`
- `lib/evaluation/waveRevision.ts`
- `lib/revision/wavePlanner.ts`
- `lib/evaluation/pipeline/finalExternalAudit.ts`
- `app/api/workers/process-dream/route.ts`

### Authority Source Registries

The following governance families are runtime-relevant authority sources and must surface in SIPOC UI, forensic views, registry exports, and execution planning. They are not background references.

- **Evaluation templates:** `docs/templates/evaluation/short-form-evaluation-template.md`, `docs/templates/evaluation/long-form-evaluation-template.md`, `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md`
- **Rendering contract:** `docs/templates/evaluation/evaluation-rendering-contract.md`
- **Governance specifications:** `docs/governance/DREAM_OUTPUT_SPEC.md`, `docs/governance/DREAM_OUTPUT_LONG_FORM_SPEC.md`, `docs/governance/DREAM_STATE_LONGFORM_CANON.md`, `docs/governance/seed-phase-template-alignment-contract.md`, `docs/governance/phase-2-calibration-template.md`
- **Benchmark authorities:** `docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md`, `docs/canon/registered/control/BENCHMARK-CHARTER.md`
- **Canon authorities:** `docs/GOLDEN_SPINE.md`, `docs/canon/intake/_md/Normalized Gold Standard CANONICAL ACCEPTANCE COMPARATOR v1.md`
- **DREAM / GOLD format templates:** `docs/benchmarks/templates/dream-longform-layered-template.md`
- **GOLD standards and exemplars:** `docs/VERIFICATION_GOLD_STANDARD.md`, `docs/gold-standards/recommendation-integrity-dream-standard.md`, `docs/gold-standards/revise-queue-rendering-exemplars.md`, `docs/gold-standards/sister-revise-queue-dream-ledger.md`
- **Reference matrices and executable registries:** `docs/templates/evaluation/surface-parity-matrix.md`, `lib/evaluation/fipocRegistry.ts`

Executable mirror:

- `lib/evaluation/fipocRegistry.ts` exports `AUTHORITY_SOURCE_REGISTRY`.
- `docs/registries/authority_source_registry.csv` is the spreadsheet-reviewable mirror.

Each authority source must declare which stage IDs and artifacts it governs so SIPOC UI can show *why* a stage is blocked, degraded, calibrated, or template-bound.

### Telemetry

Primary required telemetry surfaces:
- `lib/observability/latencyTrace.ts`
- `app/api/admin/pipeline-health/route.ts`
- `app/admin/pipeline-health/page.tsx`
- `evaluation_jobs.progress.pipeline_failure_envelope`
- `evaluation_artifacts` diagnostic artifacts

### Forensic Diagnostics

Per-job stage-by-stage trace (answers: what entered, what left, what validates, what repairs):
- `app/api/admin/forensics/[jobId]/route.ts` — assembles forensic data from jobs + artifacts + logs
- `app/admin/forensics/[jobId]/page.tsx` — SIPOC Forensic View UI

Stage result taxonomy:
- `pass` — proven by audit logs or timeline events
- `inferred_pass` — proven by artifact evidence or phase highwater mark (artifact exists ≠ stage fully passed)
- `fail` — stage failed (error code captured)
- `retry_pass` / `retry_fail` — self-correction attempted
- `not_reached` — stage never executed

#### Contamination Trace

Per-recommendation lifecycle tracking (answers: where did this recommendation enter, mutate, survive, or get quarantined?):
- Created: which pipeline stage originated the recommendation (`source_pass` field → Pass 1/2/3)
- Modified: which stage merged/rewrote it (Pass 3 synthesis for recs originated in Pass 1/2)
- Flagged: which gate detected a violation (Integrity Gate S08/S09)
- Quarantined: whether the rec was removed before author-facing output
- Reason: violation code(s) explaining quarantine decision

Status categories:
- `CLEAN` — recommendation passed all gates without flags
- `FLAGGED` — gate detected potential issue but rec survived (PASS_MINIMUM+ tier)
- `QUARANTINED` — rec removed from output (FAIL tier, violation codes logged)

#### Retry/Quarantine Analytics

Operational self-correction telemetry (answers: is the system healing or failing more politely?):

Metrics tracked per job:
- `total_retry_attempts` — number of gate violation retries attempted
- `retry_success_count` — retries that resolved the violation
- `retry_failure_count` — retries that failed (exhausted budget)
- `quarantine_count` — recommendations/stages quarantined after failed retry
- `fail_closed_count` — jobs/stages that failed closed (no further processing)
- `top_violation_codes` — most frequent defect patterns triggering retries
- `affected_stage` — pipeline stage where self-correction was triggered
- `retry_events` — detailed log of each retry event (event type, stage, result, reason, timestamp)

Data sources:
- `progress.self_correction` (job-level retry/quarantine state)
- `progress.quality_violations` (quality gate violation details)
- `pipeline_logs` (timeline events matching retry/quarantine/fail_closed patterns)
- Recommendation integrity gate quarantine metadata

Empty state handling:
- Pre-policy jobs (no telemetry): display explicit "not measured" state — empty ≠ clean
- Post-policy jobs with no violations: display "0 attempts, no retryable violations occurred"

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
10. Evaluation must consider diagnosed genre, reader promise, dominant craft engine, and author-selected mode/voice contract; it must not penalize genre-appropriate pacing, dialogue density, structure, or voice as generic defects.
11. No malformed, garbled, or generic recommendation may reach the author. Every LLM-generated text must pass a prose-quality gate before advancing to the next pipeline stage.
12. Evidence ownership boundary: manuscript quotations (`anchor_snippet`, `evidence_snippets[*].snippet`) are author-owned and must never be sanitized, rewritten, or mutated by any pipeline stage. Only RG-generated editorial text (summaries, rationale, recommendations, quick wins, strategic revisions) may be sanitized.
13. Every LLM output point must have a deterministic prose-quality gate before its output advances downstream. Gates that check only structure or length are insufficient — sentence completeness and scaffold-residue detection are required.
14. All renderers (webpage, PDF, DOCX, TXT, DREAM) must consume the active evaluation template through `UnifiedEvaluationDocument`. `evaluation_result_v2` remains the canonical evaluation artifact for scores, genre, criteria, confidence, and entity names; templates remain the product authority for author-facing report shape. No renderer may recalculate, re-synthesize, reorder, suppress, or pull from alternate artifact sources. One canonical template-backed view model → all surfaces.
15. Gates that detect defects must enforce consequences. Detection without enforcement is a defect in itself — report shipment after a FAIL verdict is a pipeline integrity violation.
16. Story ledger canonical entity names are ground truth. Any LLM output (including DREAM synthesis) using non-canonical names or blocked words (BLOCKED_CANONICAL_NAMES set) as character names is a contamination defect.
17. Post-evaluation stages (WAVE, Canon Governance, DREAM, Final Audit) must execute in strict temporal order. Final audit must run AFTER all upstream artifacts are persisted — audit of incomplete state produces false verdicts.

## Evaluation Critical Path

### Full Evaluation Pipeline (including seeding + post-evaluation long-form stages)

`Phase 0 Warmup -> Phase 0.5A Story Map Seed -> Phase 0.5B Revise Opportunity Seed -> Seed Completeness Gate -> Intake -> Queue -> Claim -> Routing/Chunking -> Phase 1A (Pass 1 extraction) -> Story Layer Quality Gate -> Review Gate -> Phase 2 (Pass 2 craft diagnosis) -> Phase 3 (Pass 3 synthesis) -> EvaluationResultV2 normalization -> QualityGateV2 -> Persistence -> WAVE Revision Planning -> Canon Governance Runner (Gate 15 + Golden Spine + Dialogue Canon) -> DREAM Long-Form Synthesis -> Final External Audit -> Phase 5 Author Exposure Gate -> Renderer -> Revision Opportunity Ledger -> Revise Queue`

### Runtime Spine (S01–S12) + Post-Evaluation Long-Form Stages

`Intake -> Queue -> Claim -> Routing/Chunking -> Pass 1 -> Pass 2 -> Pass 1/2 Handoff Gate -> Pass 3 -> EvaluationResultV2 normalization -> QualityGateV2 -> Persistence -> [WAVE -> Canon Governance -> DREAM -> Final External Audit] -> Phase 5 Author Exposure Gate -> Renderer (Webpage) -> Download Pipeline (PDF/DOCX/TXT)`

Post-evaluation stages (in brackets) are long-form only (≥25K words). Short-form manuscripts proceed Persistence → Phase 5 Author Exposure Gate → Renderer, skipping the bracketed long-form stages.

**Highest-risk seam (explicit):**

`Pass 1/2 Handoff Gate -> Pass 3 -> Recommendation Integrity Gate -> EvaluationResultV2 normalization -> QualityGateV2 -> Persistence`

Reason: this seam carries handoff prose quality, synthesis correctness, recommendation integrity, normalization semantics, deterministic gate enforcement, and fail-closed persistence guarantees in one boundary chain.

**Genre/mode consideration seam (explicit):**

`Pass 3 expectation profile -> EvaluationResultV2 enrichment -> Revision Opportunity Ledger -> Revise Queue -> TrustedPath`

Reason: this seam carries diagnosed genre, target audience, dominant craft engine, confirmed mode, and voice preservation into revision automation. It must follow `GENRE_EXPECTATIONS_VOLUME_II_AND_REVISE_MODE_CONTRACT.md` and fail closed when the mode/voice/genre contract needed for automation is missing.

**Seeding seam (explicit):**

`Phase 0 -> Phase 0.5A -> Phase 0.5B -> Seed Completeness Gate -> Phase 1A`

Reason: the entire downstream pipeline quality depends on seed completeness and authority proof. Degraded or missing seeds propagate error through every subsequent phase.

## SIPOC Stage Table

### Adjacent / Seeding Stages

| Stage | Stage ID | Supplier | Customer / Downstream | Certification Status |
|---|---|---|---|---|
| Phase 0 Authority Binding | `ADJACENT_PHASE_0` | Precomputed `phase0_calibration_baseline_v1` + manuscript metadata | `ADJACENT_PHASE_0_5A`, `ADJACENT_PHASE_0_5B` | Emerging |
| Phase 0.5A Story Seeds + Enhanced Ledger | `ADJACENT_PHASE_0_5A` | Phase 0 authority proof + calibration baseline + manuscript | `ADJACENT_SEED_COMPLETENESS_GATE`, `S05_PASS1` (Phase 1A) | Emerging |
| Phase 0.5B Revise Opportunity Seed | `ADJACENT_PHASE_0_5B` | Phase 0 authority proof + manuscript + 13 criteria canon | `ADJACENT_REVISE` (Revise admission) | Emerging |
| Seed Completeness Gate | `ADJACENT_SEED_COMPLETENESS_GATE` | Phase 0.5A seed artifacts | `S05_PASS1` (Phase 1A) or seed regeneration | Emerging |
| Story Layer Quality Gate | `ADJACENT_SEMANTIC_GATE` | Phase 1A story layer output + benchmarks | Review Gate | Emerging |
| Review Gate | `ADJACENT_REVIEW_GATE` | Author + quality report + story layers | `S06_PASS2` (Phase 2) | Emerging |

### Post-Evaluation Active Stages (Long-Form Only)

| Stage | Stage ID | Supplier | Customer / Downstream | Certification Status |
|---|---|---|---|---|
| WAVE Revision Planning | `ADJACENT_WAVE` | Pass 3 synthesis findings + `evaluation_result_v2` | `ADJACENT_CANON_GOVERNANCE`, `ADJACENT_DREAM` | Active — Partial |
| Canon Governance Runner | `ADJACENT_CANON_GOVERNANCE` | Manuscript text + `evaluation_result_v2` criteria | `ADJACENT_DREAM` | Active — Partial |
| DREAM Long-Form Synthesis | `ADJACENT_DREAM` | Manuscript chunks + `evaluation_result_v2` + Pass 2a context | `ADJACENT_FINAL_EXTERNAL_AUDIT` | Active — Partial |
| Final External Audit | `ADJACENT_FINAL_EXTERNAL_AUDIT` | All persisted artifacts for the job | End user / report release gate | Active — Partial |

### Runtime Spine Stages (S01–S12)

| Stage | Stage ID | Supplier | Customer / Downstream | Certification Status |
|---|---|---|---|---|
| Intake | `S01_INTAKE` | Authenticated user + API gateway | `S02_QUEUE` | Partial |
| Queue | `S02_QUEUE` | Jobs API + store | `S03_CLAIM` | Proven |
| Claim | `S03_CLAIM` | Worker + atomic claim RPC | `S04_ROUTING_CHUNKING` | Proven |
| Routing / Chunking | `S04_ROUTING_CHUNKING` | Manuscript/chunking services | `S05_PASS1`, `S06_PASS2` | Emerging |
| Pass 1 | `S05_PASS1` | Pipeline orchestrator + Pass 1 runner | `S06b_HANDOFF_GATE` | Partial |
| Pass 2 | `S06_PASS2` | Pipeline orchestrator + Pass 2 runner | `S06b_HANDOFF_GATE` | Partial |
| Pass 1/2 Handoff Gate | `S06b_HANDOFF_GATE` | Pass 1 + Pass 2 structured output | `S07_PASS3` | Emerging |
| Pass 3 | `S07_PASS3` | Pipeline orchestrator + synthesis runner | `S08_ER2_NORMALIZATION` | High-risk |
| EvaluationResultV2 normalization | `S08_ER2_NORMALIZATION` | Pipeline adapter / observability normalization | `S09_QUALITYGATEV2` | High-risk |
| QualityGateV2 | `S09_QUALITYGATEV2` | Deterministic gate engine | `S10_PERSISTENCE` | Partial |
| Persistence | `S10_PERSISTENCE` | Atomic persistence layer | `S10b_PHASE5_AUTHOR_EXPOSURE_GATE` | Partial |
| Phase 5 Author Exposure Gate | `S10b_PHASE5_AUTHOR_EXPOSURE_GATE` | Evaluation templates + `UnifiedEvaluationDocument` + renderer manifest + audits | `S11a_RENDERER_WEBPAGE`, `S11b_DOWNLOAD_PIPELINE`, `ADJACENT_REVISION_LEDGER` | Missing Critical |
| Renderer (Webpage) | `S11a_RENDERER_WEBPAGE` | Phase 5-certified `UnifiedEvaluationDocument` | End user / admin, `S11b_DOWNLOAD_PIPELINE`, `ADJACENT_REVISE` | Partial |
| Download Pipeline | `S11b_DOWNLOAD_PIPELINE` | Read-time sanitizer + parity gate + format renderers (PDF/DOCX/TXT) | End user (downloaded files) | Emerging |
| WAVE Revision Planning | `ADJACENT_WAVE` | Pass 3 synthesis + evaluation_result_v2 | Canon Governance, DREAM, Revise | Active — Partial |
| Canon Governance Runner | `ADJACENT_CANON_GOVERNANCE` | Manuscript + evaluation_result_v2 criteria | DREAM, Final Audit | Active — Partial |
| DREAM Long-Form Synthesis | `ADJACENT_DREAM` | Manuscript chunks + evaluation_result_v2 | Final External Audit, End user | Active — Partial |
| Final External Audit | `ADJACENT_FINAL_EXTERNAL_AUDIT` | All persisted artifacts | Report release gate | Active — Partial |

### Evaluation → Revise Handoff Stages

| Stage | Stage ID | Supplier | Customer / Downstream | Certification Status |
|---|---|---|---|---|
| Revision Opportunity Ledger | `ADJACENT_REVISION_LEDGER` | Phase 2 + Phase 3 evaluation artifacts | `ADJACENT_REVISE` (Revise Queue) | Emerging |
| Revise Admission | `ADJACENT_REVISE` | revision_opportunity_ledger_v1 + revise_opportunity_seed_v1 | Revise Queue / TrustedPath / Author | Emerging |

## Canonical Stage Identifier Register (Immutable)

The following stage IDs are canonical runtime certification identifiers and are **immutable** unless superseded by explicit canon-governed revision:

### Runtime Spine (S01–S12)

- `S01_INTAKE`
- `S02_QUEUE`
- `S03_CLAIM`
- `S04_ROUTING_CHUNKING`
- `S05_PASS1`
- `S06_PASS2`
- `S06b_HANDOFF_GATE`
- `S07_PASS3`
- `S08_ER2_NORMALIZATION`
- `S09_QUALITYGATEV2`
- `S10_PERSISTENCE`
- `S10b_PHASE5_AUTHOR_EXPOSURE_GATE`
- `S11a_RENDERER_WEBPAGE`
- `S11b_DOWNLOAD_PIPELINE`

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
- `ADJACENT_CANON_GOVERNANCE`
- `ADJACENT_DREAM`
- `ADJACENT_FINAL_EXTERNAL_AUDIT`

Governance requirements for identifier changes:

1. No silent rename, aliasing, or inferred mapping.
2. Any stage-ID change requires explicit governance review and versioned contract update.
3. Downstream assets (fixtures, harness, CI, telemetry, dashboards) must treat these IDs as stable keys.
4. If evolution is required, introduce a versioned migration plan before runtime adoption.
5. Adjacent stage identifiers carry the same immutability rules as runtime spine identifiers.

### Stage Contract Details

### `ADJACENT_PHASE_0` — Phase 0 Authority Binding

- **Architecture:** Phase 0 is a **deterministic authority-binding stage**. It does NOT re-read or re-summarize Dream/Gold/Canon docs per job. Instead, it loads a precomputed certified calibration baseline (`phase0_calibration_baseline_v1`) generated offline from static governance documents. No LLM calls in Phase 0.
- **Supplier:** Precomputed `phase0_calibration_baseline_v1` + manuscript metadata
- **Input:** Certified calibration baseline (Dream/Gold/Canon/Fail-closed pre-synthesized) + manuscript word count + structure
- **Input acceptance metrics:**
  - `phase0_calibration_baseline_v1` loaded
  - Baseline checksum verified
  - Baseline source document checksums still valid (fail-closed if governance docs changed since baseline generation)
  - Manuscript metadata available (word count, structure)
  - No live PR mining at runtime
- **Process / runtime code surface:**
  - `lib/evaluation/phase-architecture-v2/phase0AuthorityProof.ts`
  - `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (phase_0 row)
- **Process:** Load baseline → verify checksum → confirm authority paths → select route/scope → persist proof
- **Output:** `phase0_authority_proof_v1` — authority binding with baseline version linkage, checksums, selected route, and confirmed authority paths
- **Output acceptance metrics:**
  - Baseline version/checksum linkage present
  - Authority paths confirmed
  - Route selected: short-form / long-form / long-form multi-layer
  - Route rationale present
  - `schema_valid = true`
  - `is_resume_safe` determined
- **SLA:** 12–15 seconds target, 20 seconds hard limit (no LLM calls)
- **Customer / downstream stage:** `ADJACENT_PHASE_0_5A`, `ADJACENT_PHASE_0_5B`
- **Gates / invariants:** Phase 0.5A and 0.5B must not start without proven Phase 0 authority. If baseline checksum fails, fail-closed.
- **Failure codes:** `PHASE0_AUTHORITY_MISSING`, `PHASE0_MANIFEST_UNRESOLVED`, `PHASE0_BASELINE_CHECKSUM_FAILED`
- **Required telemetry:** authority binding timing, baseline version used, route selected
- **Required evidence artifact:** `phase0_authority_proof_v1` with baseline version/checksum linkage
- **Canon refs:** Phase 0.1–0.3 governance enforcement, warmup benchmark manifest
- **Spec refs:** `docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md`, `docs/architecture/phase0-calibration-baseline.md`
- **Runtime refs:** `lib/evaluation/phase-architecture-v2/phase0AuthorityProof.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### `ADJACENT_PHASE_0_5A` — Phase 0.5A Story Map Seed + Enhanced Ledger

Phase 0.5A has two sub-stages:
1. **Seed generation** — produces `story_map_seed_v1` + `evaluation_seed_v1` (minimum 500 words combined)
2. **Enhanced Ledger generation** — produces `full_context_story_ledger_v1` (9-layer deep story ledger from full manuscript context)

These are the **first manuscript-understanding stages**. Phase 0 only binds authority; Phase 0.5A first touches the manuscript.

- **Supplier:** Phase 0 authority proof + `phase0_calibration_baseline_v1` + manuscript text + benchmarks
- **Input:** `phase0_authority_proof_v1` + calibration baseline + manuscript ingestion/source text + chunk/routing manifest + manuscript version ID
- **Input acceptance metrics:**
  - `phase0_authority_proof_v1` present and valid
  - Calibration baseline available (linked via authority proof)
  - Manuscript text available
  - Canon sources missing list explicitly recorded
- **Process / runtime code surface:**
  - `lib/evaluation/phase-architecture-v2/phase05aStoryMapSeed.ts`
  - `lib/evaluation/seed/semanticSeedGenerator.ts`
  - `lib/evaluation/seed/seedScaffoldFactory.ts`
  - `lib/evaluation/phase-architecture-v2/checklistMatrix.ts` (phase_0_5a row)
- **Output:** `story_map_seed_v1` + `evaluation_seed_v1` + `full_context_story_ledger_v1`
- **Output acceptance metrics:**
  - `story_map_seed_v1` includes: candidate_entity_registry, candidate_alias_map, candidate_relationship_map, candidate_object_symbol_map, candidate_location_map, candidate_timeline_map, candidate_pov_map, candidate_pressure_map, candidate_open_loop_map, uncertainty_flags
  - `evaluation_seed_v1` includes: likely_13_criteria_strengths, likely_13_criteria_risks, known_story_risks, known_evidence_targets
  - Combined seed output ≥ 500 words
  - `full_context_story_ledger_v1` has 9 canonical layers present, structure valid
  - `seed_status = candidate_provisional` (not final authority)
  - All 9 Story Ledger layer scaffolds present
  - All 13 criteria scaffolded
  - `schema_valid = true`
  - `semantic_status` determined (valid / degraded_with_reasons / blocked)
  - No final scores in seed
  - No final verdict in seed
  - `seed_authority = seed_only`
- **SLA:** Seed generation is scope-dependent. Enhanced Ledger has 180s hard limit. Neither counts against Phase 0's 12–15s SLA.
- **Customer / downstream stage:** `ADJACENT_SEED_COMPLETENESS_GATE`, `S05_PASS1` (Phase 1A)
- **Gates / invariants:** Seeds must run only after Phase 0 authority binding is proven. Seeds are provisional candidate scaffolds — not evaluation authority. Phase 0.5A answers: "what does the manuscript contain?"
- **Failure codes:** `SEED_GENERATION_FAILED`, `SEED_AUTHORITY_PROOF_MISSING`
- **Required telemetry:** seed generation timing, enhanced ledger timing, scaffold completeness counts, semantic status
- **Required evidence artifact:** `story_map_seed_v1` + `evaluation_seed_v1` + `full_context_story_ledger_v1` with authority proof linkage
- **Canon refs:** Volume III pass architecture, Story Ledger layer contract
- **Spec refs:** `docs/phase-0-warmup/SEED_AND_PHASE_1A_GOVERNANCE.md`, `docs/prs/p16-phase-0-5a-story-map-seed-producer.md`, `docs/architecture/phase0-calibration-baseline.md`
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
- **Output:** `ledger_quality_report_v1` — per-layer classification → feeds Review Gate which produces `accepted_story_ledger_v1`
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
- **Short-form bypass risk (explicit):** When short-form evaluations bypass the Review Gate, the only quality assurance on story layer data comes from the deterministic seed validator. This means short-form evaluations have reduced QA depth on story layers — recommendations derived from story data in short-form mode must be treated with lower confidence. The downstream Handoff Gate (S06b) and Recommendation Integrity Gate (S07) become the primary quality defense for short-form output.
- **Failure codes:** `REVIEW_GATE_REJECTED`, `REVIEW_GATE_TIMEOUT`
- **Required telemetry:** review gate decision, time-to-review, layer acceptance rates
- **Required evidence artifact:** `accepted_story_ledger_v1` with per-layer review decisions
- **Canon refs:** RevisionGrade Operating Model, Phase 0.1–0.3 governance
- **Spec refs:** `docs/QUALITY_GATES_v1.md`
- **Runtime refs:** `lib/evaluation/processor.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

---

### Runtime Spine Stage Contracts (S01–S12)

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
- **Customer / downstream stage:** `S06b_HANDOFF_GATE`
- **Gates / invariants:** pass independence mandatory
- **Failure codes:** `PASS2_TIMEOUT`, `PASS2_FAILED`, `PASS2_INDEPENDENCE_REWRITE_FAILED`, `QG_INDEPENDENCE_VIOLATION`
- **Required telemetry:** pass2 timing, independence diagnostics
- **Required evidence artifact:** pass2 output + independence diagnostic trace
- **Canon refs:** Volume III pass architecture/state model
- **Spec refs:** `docs/EVALUATION_CRITICAL_FILE_PATH.md`
- **Runtime refs:** `lib/evaluation/pipeline/runPipeline.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Partial

### `S06b_HANDOFF_GATE` — Pass 1/2 Handoff Gate

- **Supplier:** Pass 1 + Pass 2 structured outputs
- **Input:** Combined structured artifacts from Pass 1 (story layer extraction, evidence mapping) and Pass 2 (craft diagnosis, recommendation candidates)
- **Input acceptance metrics:**
  - Both Pass 1 and Pass 2 artifacts present and parseable
  - No scaffold residue detected (e.g., `[PLACEHOLDER]`, `TODO:`, `<insert>`)
  - Sentence completeness: every sentence has subject + verb + terminal punctuation
  - No broken modal phrases (e.g., `"which More…"`, `"can long stretches…"`)
  - No generic workshop language (e.g., `"consider adding more detail"` without evidence anchor)
  - Evidence anchors present: every recommendation references a specific manuscript location
- **Process / runtime code surface:**
  - `lib/evaluation/pipeline/pass12HandoffGate.ts` (to be implemented — PR 2)
- **Output:** Certified Pass 1/2 payload that is safe to feed into synthesis
- **Output acceptance metrics:**
  - All input acceptance metrics pass
  - Handoff payload carries prose quality certification flag
- **Customer / downstream stage:** `S07_PASS3`
- **Gates / invariants:** Handoff cannot feed garbage to synthesis. Fail closed if any prose quality check fails.
- **Failure codes:** `HANDOFF_SCAFFOLD_RESIDUE`, `HANDOFF_INCOMPLETE_SENTENCE`, `HANDOFF_BROKEN_MODAL`, `HANDOFF_GENERIC_LANGUAGE`, `HANDOFF_MISSING_EVIDENCE_ANCHOR`
- **Required telemetry:** handoff gate pass/fail counts, per-check failure reasons, retry count
- **Required evidence artifact:** pre-gate payload snapshot + gate diagnostic output
- **Canon refs:** Volume III pass architecture, Runtime Doctrine #11/#13
- **Spec refs:** `docs/forensics/SISTER_FORENSIC_PIPELINE_MAP.md` (Stage 5: Pass 1/2 → Pass 3 Handoff)
- **Runtime refs:** `lib/evaluation/pipeline/runPipeline.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Emerging

### `S07_PASS3` — Pass 3

- **Supplier:** Pipeline orchestrator with Pass 1+2 outputs
- **Input:** Certified outputs from Pass 1 and Pass 2 only
- **Input acceptance metrics:**
  - both upstream passes succeed
  - convergence input consistency
- **Process / runtime code surface:**
  - `lib/evaluation/pipeline/runPipeline.ts`
  - `lib/evaluation/pipeline/runPass3Synthesis.ts`
- **Output:** Synthesis output with recommendation integrity certification
- **Output acceptance metrics:**
  - synthesis object present
  - criteria/recommendation structure survives deterministic checks
  - **Recommendation Integrity Gate passes:** no FAIL-tier recommendations reach persistence (malformed, garbled, generic, or evidence-free recommendations are quarantined)
  - Every recommendation has: complete sentences, specific manuscript evidence anchor, actionable language (not generic workshop advice)
- **Customer / downstream stage:** `S08_ER2_NORMALIZATION`
- **Gates / invariants:** stages fail closed; no partial success promoted as final. No malformed recommendation may reach the author (Runtime Doctrine #11).
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
- **Customer / downstream stage:** `S10b_PHASE5_AUTHOR_EXPOSURE_GATE`
- **Gates / invariants:** no artifact persists after failed deterministic gate
- **Failure codes:** `EVALUATION_ARTIFACT_VALIDATION_FAILED`, `EVALUATION_GATE_REJECTED`
- **Required telemetry:** persistence gate trace + confidence derivation + reason codes
- **Required evidence artifact:** persisted `evaluation_artifacts` row and completion/failure envelope
- **Canon refs:** Phase 0.1–0.3 governance enforcement
- **Spec refs:** `docs/JOB_CONTRACT_v1.md`
- **Runtime refs:** `lib/evaluation/persistEvaluationResultV2.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Partial

### `S10b_PHASE5_AUTHOR_EXPOSURE_GATE` — Phase 5 Author Exposure Gate

- **Supplier:** Persisted `evaluation_result_v2`, active evaluation template contract, long-form audits where applicable, and renderer parity diagnostics
- **Input:** `evaluation_result_v2` + `evaluation_template_contract_v1` + active template path + final audit / Gate 15 / Dialogue Canon / WAVE / DREAM artifacts where applicable
- **Input acceptance metrics:**
  - active template mode and path known
  - one of the three evaluation templates selected explicitly
  - `UnifiedEvaluationDocument` can be built from canonical artifacts
  - required Title Block fields and confidence labels present
  - WAVE / Gate 15 / Dialogue Canon / Final External Audit blocking defects resolved or explicitly certified nonblocking
- **Process / runtime code surface:**
  - `lib/evaluation/unifiedEvaluationDocument.ts`
  - `lib/evaluation/reportHeaderPolicy.ts`
  - planned: `lib/evaluation/authorExposureCertification.ts`
- **Output:** `unified_evaluation_document_v1` + `author_exposure_certification_v1` + `report_render_manifest_v1`
- **Output acceptance metrics:**
  - active template path persisted in the render manifest
  - `UnifiedEvaluationDocument` hash captured
  - author exposure decision is `certified` before web/PDF/DOCX/TXT/print exposure
  - renderer parity diagnostics pass for every registered field
  - `revision_opportunity_ledger_v1` handoff requirement recorded for Revise
- **Customer / downstream stage:** `S11a_RENDERER_WEBPAGE`, `S11b_DOWNLOAD_PIPELINE`, `ADJACENT_REVISION_LEDGER`
- **Gates / invariants:** Templates are the product authority. `UnifiedEvaluationDocument` is the mandatory renderer adapter. Renderer violations block release / author exposure; they are not advisory warnings.
- **Failure codes:** `PHASE5_TEMPLATE_CONTRACT_FAIL`, `PHASE5_RENDER_PARITY_FAIL`, `PHASE5_BANNED_ENTITY`, `PHASE5_SCORE_DRIFT`, `PHASE5_MISSING_AUDIT`, `PHASE5_UNCERTIFIED_OUTPUT`
- **Required telemetry:** template selected, certification decision, blocking reason list, renderer parity result, unified document hash
- **Required evidence artifact:** `author_exposure_certification_v1`, `report_render_manifest_v1`, `unified_evaluation_document_v1`
- **Authority sources:** three evaluation templates, evaluation rendering contract, DREAM long-form specs, DREAM benchmark index, GOLD standard recommendation/exemplar docs
- **Authority priority:** Evaluation Templates > SIPOC > Spec > Runtime > Telemetry
- **Certification status:** Missing Critical

### `S11a_RENDERER_WEBPAGE` — Renderer (Webpage)

- **Supplier:** Phase 5-certified `UnifiedEvaluationDocument`
- **Input:** `author_exposure_certification_v1` + `report_render_manifest_v1` + `unified_evaluation_document_v1`
- **Input acceptance metrics:**
  - ownership/auth check passes
  - release gate passes
- **Process / runtime code surface:**
  - `app/api/evaluations/[jobId]/route.ts`
  - `app/evaluate/[jobId]/page.tsx`
  - `app/reports/[jobId]/page.tsx`
  - `lib/evaluation/unifiedEvaluationDocument.ts`
- **Output:** user/admin visible evaluation webpage
- **Output acceptance metrics:**
  - source identified as Phase 5-certified `UnifiedEvaluationDocument`
  - no fabricated progress
  - scores, recommendations, and sections match the active evaluation template and render manifest
- **Customer / downstream stage:** End user / admin, `S11b_DOWNLOAD_PIPELINE`, `ADJACENT_REVISE`
- **Gates / invariants:** UI/API reads persisted state only. Webpage must consume the same `UnifiedEvaluationDocument` model as downloads and may format only.
- **Failure codes:** `401`, `404`, `409`, `500`
- **Required telemetry:** read path access and release decision events
- **Required evidence artifact:** response payload audit + source marker
- **Canon refs:** Volume III state model and fail-closed governance
- **Spec refs:** `docs/JOB_CONTRACT_v1.md`, `docs/NOMENCLATURE_CANON_v1.md`
- **Runtime refs:** `app/api/evaluations/[jobId]/route.ts`, `app/api/admin/pipeline-health/route.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Partial

### `S11b_DOWNLOAD_PIPELINE` — Download Pipeline (PDF/DOCX/TXT)

- **Supplier:** persisted artifacts (same source as webpage renderer)
- **Input:** completed artifact + download format request (PDF, DOCX, or TXT)
- **Input acceptance metrics:**
  - artifact exists and is releasable
  - requested format is supported
- **Process / runtime code surface:**
  - `lib/evaluation/downloadReadTimeSanitizer.ts` (read-time sanitization of RG-generated editorial text)
  - `lib/evaluation/downloadParityGate.ts` (post-sanitization parity validation)
  - `lib/evaluation/unifiedEvaluationDocument.ts` (canonical renderer adapter)
  - `app/api/evaluations/[jobId]/route.ts` (format-specific renderers: `buildCanonicalTemplateTxt`, `renderCanonicalTemplateHtml` → PDF, `buildCanonicalTemplateDocx`)
- **Output:** PDF, DOCX, or TXT file delivered to the user
- **Output acceptance metrics:**
  - Read-time sanitizer passes: no forbidden patterns remain in editorial text
  - Parity gate passes: post-sanitization output preserves data integrity
  - **Evidence ownership preserved:** `anchor_snippet` and `evidence_snippets[*].snippet` are byte-for-byte identical to source (Runtime Doctrine #12)
  - Format-specific renderer completes without error
  - Output sections match webpage: same report type, overall score, confidence labels, market readiness, criteria scores, recommendation counts, executive summary, and active template order
- **Customer / downstream stage:** End user (downloaded file)
- **Gates / invariants:**
  - Read-time sanitizer must NOT mutate manuscript evidence or quotations (author-owned content)
  - Read-time sanitizer MAY sanitize: summaries, rationale, recommendations, quick wins, strategic revisions (RG-generated editorial text)
  - Parity gate validates cleaned output before format rendering proceeds
  - Download rejected if contamination remains after sanitization
  - Download rejected if parity gate fails
- **Failure codes:** `DOWNLOAD_SANITIZER_FAILED`, `DOWNLOAD_PARITY_FAILED`, `DOWNLOAD_RENDER_FAILED`, `DOWNLOAD_FORMAT_UNSUPPORTED`
- **Required telemetry:** sanitizer pass/fail + patterns cleaned, parity gate pass/fail, format render timing
- **Required evidence artifact:** pre-sanitization snapshot + post-sanitization diff + parity gate diagnostic
- **Canon refs:** Runtime Doctrine #11/#12, Volume III fail-closed governance
- **Spec refs:** `docs/forensics/SISTER_FORENSIC_PIPELINE_MAP.md` (Stage 12–15)
- **Runtime refs:** `lib/evaluation/downloadReadTimeSanitizer.ts`, `lib/evaluation/downloadParityGate.ts`
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
| Releasable read path | only releasable outputs are rendered | S11a |
| Download evidence preservation | `anchor_snippet` and `evidence_snippets[*].snippet` byte-for-byte identical before/after sanitization | S11b |
| Download parity | overall score, criteria scores, rec count, executive summary identical across webpage/PDF/DOCX/TXT | S11a–S11b |
| WAVE derivation non-empty | `derived_wave_ids` is non-empty when Pass 3 findings contain ≥1 criterion with score ≤9 | ADJACENT_WAVE |
| WAVE score-aware selection | score-10 criteria produce continuity audit waves only; score ≤7 produce full structural bridge | ADJACENT_WAVE |
| Gate 15 enforcement | Gate 15 FAIL verdict must block or prominently flag report before author release | ADJACENT_CANON_GOVERNANCE |
| Dialogue detection proportionality | detected dialogue line count proportional to manuscript dialogue ratio (e.g., 16% dialogue in 109K words ≈ 800+ lines, not 1) | ADJACENT_CANON_GOVERNANCE |
| Golden Spine visibility | weak continuity score must be surfaced in the final report, not silently hidden | ADJACENT_CANON_GOVERNANCE |
| DREAM canonical parity | DREAM output scores, genre, Report Type, criteria, confidence must match `evaluation_result_v2` exactly | ADJACENT_DREAM |
| DREAM contamination guard | DREAM output must not contain banned names from BLOCKED_CANONICAL_NAMES set | ADJACENT_DREAM |
| Score-10 recommendation suppression | criteria with score 10/10 must have 0 recommendations (or at most 1 "Consider" tier) | ADJACENT_DREAM, S11a |
| Final audit temporal ordering | Final external audit must run AFTER DREAM persistence, not before or concurrently | ADJACENT_FINAL_EXTERNAL_AUDIT |
| Final audit required artifact list | Only `evaluation_result_v2` + `longform_document_v1` are hard-required; `revision_opportunity_ledger_v1` is Revise-phase only | ADJACENT_FINAL_EXTERNAL_AUDIT |
| Cross-medium template-backed source of truth | All renderers (webpage, PDF, DOCX, TXT) must consume Phase 5-certified `UnifiedEvaluationDocument`; `evaluation_result_v2` remains canonical artifact input, but templates govern author-facing report shape | S10b, S11a, S11b, ADJACENT_DREAM |
| Authority source surfacing | Canon, governance, reference, benchmark, template, DREAM, GOLD standard, exemplar, SIPOC, and registry authority docs must appear in executable registry and SIPOC UI | ADJACENT_PHASE_0, ADJACENT_DREAM, S10b, S11a, S11b, ADJACENT_REVISION_LEDGER, ADJACENT_REVISE |
| Phase 5 template contract | Active template path, `UnifiedEvaluationDocument` hash, renderer parity, and author exposure decision must be certified before release | S10b |
| Recommendation prose quality | every author-facing recommendation has: complete sentences, evidence anchor, actionable specificity | S06b, S07 |
| Handoff prose completeness | Pass 1/2 output contains no scaffold residue, broken modals, or generic language before reaching synthesis | S06b |
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
- Handoff gate failures: `HANDOFF_SCAFFOLD_RESIDUE`, `HANDOFF_INCOMPLETE_SENTENCE`, `HANDOFF_BROKEN_MODAL`, `HANDOFF_GENERIC_LANGUAGE`, `HANDOFF_MISSING_EVIDENCE_ANCHOR`
- Download pipeline failures: `DOWNLOAD_SANITIZER_FAILED`, `DOWNLOAD_PARITY_FAILED`, `DOWNLOAD_RENDER_FAILED`, `DOWNLOAD_FORMAT_UNSUPPORTED`
- Recommendation integrity failures: `REC_INTEGRITY_MALFORMED`, `REC_INTEGRITY_GENERIC`, `REC_INTEGRITY_NO_EVIDENCE`
- WAVE failures: `WAVE_DERIVATION_EMPTY`, `WAVE_EXECUTION_TIMEOUT`, `WAVE_PLAN_FAILED`
- Canon Governance failures: `GATE15_EXECUTION_FAILED`, `GATE15_TIMEOUT`, `GOLDEN_SPINE_EXECUTION_FAILED`, `GOLDEN_SPINE_TIMEOUT`, `DIALOGUE_CANON_EXECUTION_FAILED`, `DIALOGUE_CANON_TIMEOUT`, `REVISION_CANON_METADATA_FAILED`
- DREAM synthesis failures: `DREAM_SYNTHESIS_FAILED`, `DREAM_TIMEOUT`, `DREAM_NO_CHUNKS`, `DREAM_NO_EVAL_RESULT`, `DREAM_CANCELLED`
- Final external audit codes: `FINAL_AUDIT_SAFE_TO_RELEASE`, `FINAL_AUDIT_SKIPPED_SHORT_FORM`, `FINAL_AUDIT_PROVIDER_UNAVAILABLE`, `FINAL_AUDIT_MISSING_DREAM`, `FINAL_AUDIT_MISSING_WAVE`, `FINAL_AUDIT_MISSING_PHASE5`, `FINAL_AUDIT_LOW_COVERAGE`, `FINAL_AUDIT_CONTRADICTION`, `FINAL_AUDIT_SCHEMA_INVALID`

Reference implementation list: `lib/evaluation/pipeline/qualityGate.ts`, `lib/evaluation/persistEvaluationResultV2.ts`, `lib/evaluation/seed/seedCompletenessGuard.ts`, `lib/evaluation/seed/twoPassSeedValidation.ts`, `lib/evaluation/canonGovernanceRunner.ts`, `lib/evaluation/waveRevision.ts`, `lib/revision/wavePlanner.ts`, `lib/evaluation/pipeline/finalExternalAudit.ts`, `app/api/workers/process-dream/route.ts`, runtime route handlers.

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
10. **WAVE derivation evidence** — `wave_revision_plan_v1` with derived_wave_ids, ordered_wave_ids, modules_run, modules_with_findings, fallback_reason, score-aware filtering applied.
11. **Canon Governance evidence** — `gate_15_audit_v1` (mechanical purity metrics + pass/fail), `golden_spine_v1` (continuity score + motif payoff ratio), `dialogue_canon_audit_v1` (dialogue line count + speaker attribution), `revision_canon_metadata_v1` (cross-referenced status).
12. **DREAM synthesis evidence** — `longform_document_v1` with synthesis provenance, model metadata, and canonical parity validation.
13. **Final external audit evidence** — `final_external_audit_v1` with verdict, codes, checked_artifacts, coverage_summary, contradictions, missing_required_artifacts.

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
| `S06b_HANDOFF_GATE` | Emerging | Doctrine defined (PR 1); implementation pending (PR 2). Highest-priority new gate. |
| `S07_PASS3` | High-risk | Upstream of highest-risk seam. Recommendation Integrity Gate added (PR #1044). |
| `S08_ER2_NORMALIZATION` | High-risk | Boundary semantics and score/null integrity critical |
| `S09_QUALITYGATEV2` | Partial | Deterministic gate active; statistical certification pending |
| `S10_PERSISTENCE` | Partial | Atomic enforcement present; seam risk remains |
| `S11a_RENDERER_WEBPAGE` | Partial | Releasability/read-path contract active; UnifiedEvaluationDocument model proven |
| `S11b_DOWNLOAD_PIPELINE` | Emerging | Sanitizer + parity gate active (PRs #1046/#1047); evidence ownership enforced |
| `ADJACENT_PHASE_0` | Emerging | Authority proof generation active; fixture coverage pending |
| `ADJACENT_PHASE_0_5A` | Emerging | Seed generation active; two-pass validation implemented; format conformance guard active |
| `ADJACENT_PHASE_0_5B` | Emerging | Revise opportunity seed generation active; candidate-prose contract defined |
| `ADJACENT_SEED_COMPLETENESS_GATE` | Emerging | Completeness + format conformance checks active; blocking on incomplete seeds |
| `ADJACENT_SEMANTIC_GATE` | Emerging | Quality checks + hard-fail triage + entity contamination filter active |
| `ADJACENT_REVIEW_GATE` | Emerging | Author review surface active; short-form bypass implemented |
| `ADJACENT_REVISION_LEDGER` | Emerging | Ledger assembly defined; evidence anchor requirement specified |
| `ADJACENT_REVISE` | Emerging | Queue admission contract defined; Ready vs Needs Targeting specified |
| `ADJACENT_WAVE` | Active — Partial | Criterion bridge fix merged (PR #1108); score-aware selection active; generic fallback eliminated |
| `ADJACENT_CANON_GOVERNANCE` | Active — Partial | Gate 15 detects but doesn't block; dialogue detector broken (1 line in 109K words); golden spine not surfaced |
| `ADJACENT_DREAM` | Active — Partial | Synthesis working; contamination guard and cross-medium parity enforcement pending |
| `ADJACENT_FINAL_EXTERNAL_AUDIT` | Active — Partial | False BLOCK fix merged (PR #1109); enforcement gap pending (BLOCK verdict advisory only) |

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

## Active Post-Evaluation Stages (Long-Form Pipeline)

The following stages execute after the main 11-stage evaluation spine completes for long-form manuscripts (≥25,000 words). They are **active in production** and produce artifacts that are auditable, gate-checked, and author-facing.

### `ADJACENT_WAVE` — WAVE Revision Planning

- **Supplier:** Pass 3 synthesis findings + `evaluation_result_v2` criteria scores
- **Input:** `evaluation_result_v2` criteria array (13 canonical keys with `final_score_0_10` and `recommendations[]`) + synthesis convergence context
- **Input acceptance metrics:**
  - `evaluation_result_v2` present and gate-passed
  - Criteria array has ≥1 criterion with `final_score_0_10 ≤ 9`
  - Pass 3 synthesis findings parseable (criteria keys extractable)
- **Process / runtime code surface:**
  - `lib/evaluation/waveRevision.ts` (`runWaveRevision`)
  - `lib/revision/wavePlanner.ts` (`deriveWaveTargetsFromFindings`)
  - `lib/revision/waveRegistry.ts` (63 registered waves, IDs 1–63)
  - `lib/evaluation/processor.ts` (invocation after Pass 3 persistence)
- **Process:** Extract canonical criterion keys from Pass 3 findings → bridge to wave IDs via `CANONICAL_CRITERION_WAVE_BRIDGE` → apply score-aware selection (≤7 = full structural bridge, 8–9 = polish/continuity only, 10 = continuity audit only) → build execution plan with conflict resolution → persist `wave_revision_plan_v1`
- **Output:** `wave_revision_plan_v1`
- **Output acceptance metrics:**
  - `derived_wave_ids` is non-empty (not falling back to generic IDs [1,2,7])
  - `modules_run > 0` and `modules_with_findings > 0`
  - `fallback_reason` is absent or null (not `NO_DERIVED_WAVES_FROM_PASS3_FINDINGS`)
  - Score-aware filtering applied: criteria at 10/10 do NOT generate full structural waves
  - Conflict resolution complete: no blocked wave IDs in final plan
  - `schema_valid = true`
- **Customer / downstream stage:** `ADJACENT_CANON_GOVERNANCE`, `ADJACENT_DREAM`, `ADJACENT_REVISE`
- **Gates / invariants:**
  - WAVE is NON-BLOCKING: failure produces a degraded artifact (status: `failed`) but does NOT block job completion
  - WAVE must NOT produce generic fallback waves when manuscript-specific findings are available — generic fallback is a defect
  - WAVE must bridge from canonical criterion keys (concept, narrativeDrive, character, etc.) to wave registry IDs — direct token matching against internal criterionIds (STRUCTURE_SPINE, CLIMAX_CAUSALITY) is insufficient (vocabularies are disjoint)
  - Score-10 criteria must NOT generate full structural waves — only continuity audit waves
  - 60-second timeout cap; timeout produces failed artifact
- **Failure codes:** `WAVE_DERIVATION_EMPTY`, `WAVE_EXECUTION_TIMEOUT`, `WAVE_PLAN_FAILED`
- **Required telemetry:** derived wave count, fallback status, score distribution of input criteria, execution timing
- **Required evidence artifact:** `wave_revision_plan_v1` with derived_wave_ids, ordered_wave_ids, modules_run, modules_with_findings, fallback_reason
- **Input metrics (Cartel Babies forensic reference):**
  - Input criteria count: 13 (all canonical keys present)
  - Input scores: 3 at 10/10, 7 at 9/10, 3 at 8/10
  - Input recommendations: 4 total (narrativeDrive: 3, pacing: 1)
- **Output metrics (Cartel Babies forensic reference — PRE-FIX):**
  - `derived_wave_ids: []` — EMPTY (defect: criterion key bridge missing)
  - `modules_with_findings: 0` — ZERO (defect: token matching failed)
  - `fallback_reason: "NO_DERIVED_WAVES_FROM_PASS3_FINDINGS"` — GENERIC FALLBACK
  - `ordered_wave_ids: [1, 2, 7]` — generic waves only
  - **SIPOC verdict: FAIL — completeness FALSE, accuracy LOW**
- **Output metrics (POST-FIX with PR #1108 criterion bridge):**
  - `derived_wave_ids` populated via `CANONICAL_CRITERION_WAVE_BRIDGE` mapping
  - Score-aware selection filters: full bridge for ≤7, polish for 8–9, audit-only for 10
  - Generic fallback eliminated for all manuscripts with Pass 3 findings
- **Canon refs:** Volume III pass architecture, WAVE readiness governance
- **Spec refs:** `docs/governance/DREAM_STATE_LONGFORM_CANON.md`
- **Runtime refs:** `lib/evaluation/waveRevision.ts`, `lib/revision/wavePlanner.ts`, `lib/revision/waveRegistry.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Active — Partial (criterion bridge fix merged PR #1108; score-aware selection active)

### `ADJACENT_CANON_GOVERNANCE` — Canon Governance Runner

Runs Gate 15 (mechanical purity), Golden Spine (motif/object continuity), Dialogue Canon Audit (speaker differentiation/attribution), and Revision Canon Metadata in parallel after WAVE. All layers are fire-and-forget: they never fail the evaluation job.

- **Supplier:** Manuscript text + `evaluation_result_v2` criteria keys + word count
- **Input:** Full manuscript text + criteria key array + word count + optional synthesis JSON (for Golden Spine)
- **Input acceptance metrics:**
  - Manuscript text present and non-empty
  - Job ID and manuscript ID available for artifact persistence
  - Criteria keys extractable from `evaluation_result_v2`
- **Process / runtime code surface:**
  - `lib/evaluation/canonGovernanceRunner.ts` (`runCanonGovernance`)
  - `lib/evaluation/gate15/` (Gate 15 mechanical purity audit)
  - `lib/evaluation/goldenSpine/goldenSpineAudit.ts` (motif/object continuity)
  - `lib/evaluation/dialogueCanon/dialogueCanonAudit.ts` (dialogue detection/attribution)
  - `lib/evaluation/revisionCanonMetadata.ts` (Phase 5 cross-reference metadata)
- **Process:** Run Gate 15 + Golden Spine + Dialogue Canon in parallel (30s timeout each) → persist all four artifacts → build Revision Canon Metadata from cross-referenced results
- **Output:** `gate_15_audit_v1` + `golden_spine_v1` + `dialogue_canon_audit_v1` + `revision_canon_metadata_v1`
- **Output acceptance metrics:**
  - **Gate 15:** `overallStatus` = pass/warn/fail; mechanical purity checks (attribution density, thought-verb frequency, overcorrection firewall) completed; Gate 15.2 not skipped
  - **Golden Spine:** `continuityScore` = strong/moderate/weak; motif payoff ratio > 50%; overused motif count < 10
  - **Dialogue Canon:** `dialogueStatus` = pass/warn/fail; detected dialogue lines proportional to manuscript dialogue ratio (e.g., 16% dialogue → expect hundreds of lines, not 1)
  - **Revision Canon Metadata:** cross-references Gate 15 + Golden Spine + Dialogue Canon results; `overallStatus` determined
- **Customer / downstream stage:** `ADJACENT_DREAM`, `ADJACENT_FINAL_EXTERNAL_AUDIT`
- **Gates / invariants:**
  - Canon Governance is NON-BLOCKING: failures produce degraded artifacts but do NOT block job completion
  - Gate 15 FAIL must be surfaced to the final external audit — FAIL detected but report shipped = gate enforcement gap (defect)
  - Dialogue detection must find dialogue proportional to the manuscript's actual dialogue/narrative ratio — finding 1 line in a 109K-word novel with 16% dialogue is a broken detector (defect)
  - Golden Spine weak continuity should be surfaced in the report — silent weak spine = visibility gap
  - 30-second per-layer timeout; individual layer timeout does not block other layers
- **Failure codes:** `GATE15_EXECUTION_FAILED`, `GATE15_TIMEOUT`, `GOLDEN_SPINE_EXECUTION_FAILED`, `GOLDEN_SPINE_TIMEOUT`, `DIALOGUE_CANON_EXECUTION_FAILED`, `DIALOGUE_CANON_TIMEOUT`, `REVISION_CANON_METADATA_FAILED`
- **Required telemetry:** per-layer execution timing, per-layer pass/fail status, Gate 15 mechanical purity metrics, dialogue line count vs expected
- **Required evidence artifact:** `gate_15_audit_v1`, `golden_spine_v1`, `dialogue_canon_audit_v1`, `revision_canon_metadata_v1`
- **Input metrics (Cartel Babies forensic reference):**
  - Manuscript text: 109,472 words
  - Criteria keys: 13 canonical keys
  - Word count: 109,472
- **Output metrics (Cartel Babies forensic reference):**
  - **Gate 15:** `overallStatus: FAIL` — Mechanical Purity FAIL (attribution 7.06/1000, thought-verb 12.7/chapter), Gate 15.2 SKIPPED — **SIPOC: DETECTED but did NOT block report shipment**
  - **Golden Spine:** `continuityScore: weak` — only 6/30 motifs paid off, 18 overused — **SIPOC: weak continuity NOT surfaced to user**
  - **Dialogue Canon:** `dialogueStatus: fail` — only 1 dialogue line detected in 109K words (expected hundreds) — **SIPOC: FAIL — detector fundamentally broken**
  - **Revision Canon Metadata:** metadata present — **SIPOC: OK**
- **Canon refs:** Volume III governance, Gate 15 mechanical purity contract
- **Runtime refs:** `lib/evaluation/canonGovernanceRunner.ts`, `lib/evaluation/gate15/`, `lib/evaluation/goldenSpine/`, `lib/evaluation/dialogueCanon/`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Active — Partial (Gate 15 detects but doesn't block; dialogue detector broken; golden spine not surfaced)

### `ADJACENT_DREAM` — DREAM Long-Form Document Synthesis

Async Pass 3b — produces the full narrative synthesis document for long-form manuscripts. Runs as a separate Vercel serverless function (cron every 2 minutes) to avoid 800s timeout on the main evaluation worker.

- **Supplier:** Manuscript chunks + `evaluation_result_v2` + Pass 2a structured context + genre expectation metadata
- **Input:** Completed evaluation job with `status=complete` AND `word_count >= 25000` AND no `longform_document_v1` artifact yet
- **Input acceptance metrics:**
  - Job status = `complete`
  - Word count ≥ 25,000 (DREAM_WORD_COUNT_THRESHOLD)
  - `evaluation_result_v2` artifact present and loadable
  - Manuscript chunks loadable
  - No existing `longform_document_v1` for this job (idempotency guard)
- **Process / runtime code surface:**
  - `app/api/workers/process-dream/route.ts` (cron worker)
  - `lib/evaluation/pipeline/runPass3bLongform.ts` (synthesis engine)
  - `lib/evaluation/pipeline/buildPass2aStructuredContext.ts` (context builder)
  - `lib/evaluation/pipeline/finalExternalAudit.ts` (called after DREAM persistence)
- **Process:** Cron picks eligible job → load manuscript chunks → build Pass 2a structured context → build chapter index → run GPT synthesis → persist `longform_document_v1` → run final external audit → persist `final_external_audit_v1`
- **Output:** `longform_document_v1` (DREAM synthesis document)
- **Output acceptance metrics:**
  - Document generated and non-empty
  - Contains all expected sections (executive summary, per-criterion analysis, strengths, risks, recommendations)
  - No banned-name contamination (story ledger canonical names only)
  - Scores and criteria consistent with `evaluation_result_v2` (no competing score sources)
  - Recommendations for score-10 criteria: 0 or at most 1 "Consider" tier (not a shopping list)
  - Genre, Report Type, and all metadata fields match `evaluation_result_v2` canonical values
- **Customer / downstream stage:** `ADJACENT_FINAL_EXTERNAL_AUDIT`, End user (report downloads)
- **Gates / invariants:**
  - DREAM is ASYNC: runs on a separate cron worker, not inline with the main evaluation
  - DREAM must consume ONLY `evaluation_result_v2` for scores, criteria, genre, confidence — must NOT recalculate or use alternate synthesis sources
  - DREAM output must NOT diverge from the canonical artifact (cross-medium parity requirement)
  - Batch size = 1 job per tick (stays within maxDuration=800s)
  - OpenAI timeout = 750s (leaves 50s for DB writes + response overhead)
  - Job cancellation check before synthesis starts
- **Failure codes:** `DREAM_SYNTHESIS_FAILED`, `DREAM_TIMEOUT`, `DREAM_NO_CHUNKS`, `DREAM_NO_EVAL_RESULT`, `DREAM_CANCELLED`
- **Required telemetry:** synthesis timing, chunk count processed, model used, token usage, success/failure status
- **Required evidence artifact:** `longform_document_v1` with synthesis provenance metadata
- **Input metrics (Cartel Babies forensic reference):**
  - Word count: 109,472
  - Chunk count: 40
  - Evaluation result: present (score 90/100, 13 criteria)
- **Output metrics (Cartel Babies forensic reference):**
  - `longform_document_v1` created at 06:32:52 — **SIPOC: PRESENT**
  - Contains "No/Michael" contamination (3 instances) — **SIPOC: CONTAMINATED — banned-name guard not applied to DREAM output**
  - Genre, Report Type in DREAM document diverges from webpage — **SIPOC: FAIL — cross-medium parity violated**
- **Canon refs:** DREAM State Longform Canon, Volume III pass architecture
- **Spec refs:** `docs/governance/DREAM_STATE_LONGFORM_CANON.md`
- **Runtime refs:** `app/api/workers/process-dream/route.ts`, `lib/evaluation/pipeline/runPass3bLongform.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Active — Partial (synthesis working; contamination guard and cross-medium parity enforcement pending)

### `ADJACENT_FINAL_EXTERNAL_AUDIT` — Final External Audit

Last-mile releasability check. Runs AFTER DREAM persistence to verify all required artifacts exist and are internally consistent before the report is considered safe to release.

- **Supplier:** All persisted artifacts for the job (evaluation_result_v2, longform_document_v1, wave_revision_plan_v1, gate_15_audit_v1, golden_spine_v1, dialogue_canon_audit_v1, revision_canon_metadata_v1)
- **Input:** Job ID + all artifacts in `evaluation_artifacts` table for this job
- **Input acceptance metrics:**
  - Job has completed main evaluation (status = complete)
  - DREAM persistence has completed (longform_document_v1 exists)
  - All artifact queries successful
- **Process / runtime code surface:**
  - `lib/evaluation/pipeline/finalExternalAudit.ts` (`persistFinalExternalAudit`)
  - `lib/evaluation/pipeline/finalExternalAuditPrompt.ts` (audit packet builder)
  - Called from `app/api/workers/process-dream/route.ts` after DREAM persistence
- **Process:** Query all artifacts → check hard-required artifacts (evaluation_result_v2, longform_document_v1) → check soft-required artifacts (wave_revision_plan_v1) → check optional artifacts (revision_opportunity_ledger_v1 — Revise-phase only) → build coverage summary → check for contradictions → determine verdict (PASS/WARN/BLOCK/SKIP)
- **Output:** `final_external_audit_v1`
- **Output acceptance metrics:**
  - `verdict` = PASS or WARN (not BLOCK) for a healthy evaluation
  - `blocking = false` for releasable reports
  - Hard-required artifacts present: `evaluation_result_v2`, `longform_document_v1`
  - `missing_required_artifacts` is empty
  - No contradictions detected between artifacts
  - Coverage summary shows all expected artifact types checked
- **Customer / downstream stage:** Report release gate (end user visibility)
- **Gates / invariants:**
  - Audit must run AFTER DREAM persistence — audit before DREAM = false BLOCK (temporal race defect)
  - Hard-required artifacts: `evaluation_result_v2` + `longform_document_v1` ONLY
  - `revision_opportunity_ledger_v1` is a Revise-phase artifact — must NOT be hard-required at evaluation audit time (PR #1109 fix)
  - `wave_revision_plan_v1` missing = WARN, not BLOCK (wave is non-blocking upstream)
  - BLOCK verdict should prevent report release — currently advisory only (enforcement gap)
  - Short-form jobs (< 25K words) skip final audit entirely (verdict = SKIP)
- **Failure codes:** `FINAL_AUDIT_SAFE_TO_RELEASE`, `FINAL_AUDIT_SKIPPED_SHORT_FORM`, `FINAL_AUDIT_PROVIDER_UNAVAILABLE`, `FINAL_AUDIT_MISSING_DREAM`, `FINAL_AUDIT_MISSING_WAVE`, `FINAL_AUDIT_MISSING_PHASE5`, `FINAL_AUDIT_LOW_COVERAGE`, `FINAL_AUDIT_CONTRADICTION`, `FINAL_AUDIT_SCHEMA_INVALID`
- **Required telemetry:** verdict, blocking status, missing artifact list, contradiction count, audit timing
- **Required evidence artifact:** `final_external_audit_v1` with verdict, codes, checked_artifacts, coverage_summary, contradictions
- **Input metrics (Cartel Babies forensic reference):**
  - All 21 artifacts queryable
  - DREAM persisted at 06:32:52
- **Output metrics (Cartel Babies forensic reference — PRE-FIX):**
  - `verdict: BLOCK` — false positive
  - `code: FINAL_AUDIT_MISSING_DREAM` — race condition (audit ran 2s after DREAM but checked `revision_opportunity_ledger_v1` which is Revise-phase)
  - `blocking: true` — but report shipped anyway (enforcement gap)
  - **SIPOC verdict: FAIL — false BLOCK due to wrong required artifact list**
- **Output metrics (POST-FIX with PR #1109):**
  - `revision_opportunity_ledger_v1` reclassified from hard-required to soft-checked (Revise-phase artifact)
  - Only `evaluation_result_v2` + `longform_document_v1` are hard-required
  - `wave_revision_plan_v1` missing = WARN, not BLOCK
- **Canon refs:** Volume III fail-closed governance
- **Runtime refs:** `lib/evaluation/pipeline/finalExternalAudit.ts`, `app/api/workers/process-dream/route.ts`
- **Authority priority:** Canon > Spec > Runtime > Telemetry
- **Certification status:** Active — Partial (false BLOCK fix PR #1109; enforcement gap pending)

## Deferred / Adjacent Runtime Paths

- **Deferred only:** Revision Execution (TrustedPath apply phase).
- Revision Execution is not part of the active evaluation certification spine in this contract.
- It may only be promoted into active spine scope after explicit proven runtime integration and dedicated in-scope certification updates.
- **Note:** WAVE, Gate 15, Canon Governance, DREAM, and Final External Audit were previously listed as deferred but are now **active in production** with stage contracts documented above. They were promoted to active scope based on forensic evidence from Cartel Babies job 23801747 (June 2026).

## Cartel Babies Forensic Validation (Job 23801747 — 109,472 words)

Reference forensic audit of all 21 artifacts produced by long-form evaluation. This table validates SIPOC completeness and accuracy in practice and tracks remediation status.

### Artifact Forensic Table

| # | Artifact | Stage | Status | SIPOC Triggered? | Completeness | Accuracy | Defects Found | Remediation |
|---|----------|-------|--------|-----------------|-------------|----------|---------------|-------------|
| 1 | `story_map_seed_v1` | ADJACENT_PHASE_0_5A | ⚠️ FALLBACK | ✓ | Partial | Low | LLM seed JSON malformed (provider_error) — used fallback seed | Seed generation robustness |
| 2 | `evaluation_seed_v1` | ADJACENT_PHASE_0_5A | ⚠️ FALLBACK | ✓ | Partial | Low | All 4 claims `proposed_unverified` | Seed verification step |
| 3 | `full_context_story_ledger_v1` | ADJACENT_PHASE_0_5A | ✓ CLEAN | ✓ | Complete | High | 9 layers, 0 contamination, canonical names correct | OK |
| 4 | `phase1a_chunk_routing_manifest_v1` | S04_ROUTING_CHUNKING | ✓ OK | ✓ | Complete | High | 40 chunks routed | OK |
| 5 | `pass1a_chunk_cache_v1` | S05_PASS1 | ✓ CLEAN | ✓ | Complete | High | 40 chunks, 0 contamination | OK |
| 6 | `pass3_preflight_draft_v1` | S07_PASS3 | ✓ OK | ✓ | Complete | High | reducer_status=ok, 8 character observations, 0 contamination | OK |
| 7 | `pass1a_character_ledger_v1` | S05_PASS1 | ✓ CLEAN | ✓ | Complete | High | 15 entries, "Michael Salter" correct, 0 "No" anywhere | OK |
| 8 | `pass1a_story_layer_v1` | S05_PASS1 | ✓ CLEAN | ✓ | Complete | High | 9 layers, 0 contamination | OK |
| 9 | `ledger_quality_report_v1` | ADJACENT_SEMANTIC_GATE | ⚠️ REPAIR | ✓ | Partial | Medium | `gate_ready_status: repair_required`, 9 abandoned characters | Gate should kick for abandoned characters |
| 10 | `accepted_story_ledger_v1` | ADJACENT_REVIEW_GATE | ⚠️ DEGRADED | ✓ | Partial | Medium | All 9 layers `auto_accepted` with corruption=0.1, `kick_forward_reason: "Review gate bypassed"` | Enforce backward kick |
| 11 | `pass1_chunk_cache_v1` | S05_PASS1 | ✓ CLEAN | ✓ | Complete | High | 40 chunks, 0 contamination | OK |
| 12 | `pass2_chunk_cache_v1` | S06_PASS2 | ✓ CLEAN | ✓ | Complete | High | 40 chunks, 0 contamination | OK |
| 13 | `pass12_handoff_v1` | S06b_HANDOFF_GATE | ✓ CLEAN | ✓ | Complete | High | P1 scores 6-9, P2 scores 6-9 with 36-40 recs each, 0 contamination | OK |
| 14 | `evaluation_result_v2` | S08_ER2_NORMALIZATION | ❌ CONTAMINATED | ✓ | Partial | Low | 3x "No/Michael" in rationale, `metrics.genre` undefined, many fields undefined | PR #1107 (banned-name sanitizer) |
| 15 | `wave_revision_plan_v1` | ADJACENT_WAVE | ❌ EMPTY | ✓ | Empty | Low | `derived_wave_ids: []`, `modules_with_findings: 0`, fell back to generic [1,2,7] | PR #1108 (criterion bridge) ✓ MERGED |
| 16 | `gate_15_audit_v1` | ADJACENT_CANON_GOVERNANCE | ❌ FAIL | ✓ | Partial | Low | Mechanical Purity FAIL (attribution 7.06/1000, thought-verb 12.7/chapter), Gate 15.2 SKIPPED | Gate blocking policy needed |
| 17 | `golden_spine_v1` | ADJACENT_CANON_GOVERNANCE | ⚠️ WEAK | ✓ | Partial | Medium | `continuityScore: weak`, only 6/30 motifs paid off, 18 overused | Surface weak spine to user |
| 18 | `dialogue_canon_audit_v1` | ADJACENT_CANON_GOVERNANCE | ❌ FAIL | ✓ | Partial | Low | Only 1 dialogue line detected out of 109K words (16% dialogue) | Dialogue detector fix needed |
| 19 | `revision_canon_metadata_v1` | ADJACENT_CANON_GOVERNANCE | ✓ OK | ✓ | Complete | High | Attribution metadata present | OK |
| 20 | `longform_document_v1` | ADJACENT_DREAM | ⚠️ CONTAMINATED | ✓ | Partial | Medium | Contains "No/Michael" banned-name leak; genre/score diverges from canonical | DREAM contamination guard + parity fix |
| 21 | `final_external_audit_v1` | ADJACENT_FINAL_EXTERNAL_AUDIT | ❌ BLOCK | ✓ | Partial | Low | False BLOCK: `revision_opportunity_ledger_v1` hard-required but is Revise-phase artifact | PR #1109 (false BLOCK fix) ✓ MERGED |

### Forensic Summary

- **SIPOC triggers fired:** 21/21 (100%) — every stage produced an artifact
- **Complete + accurate:** 9/21 (43%) — artifacts #3–8, #11–13, #19
- **Degraded but functional:** 4/21 (19%) — artifacts #1, #2, #9, #10
- **Defective:** 8/21 (38%) — artifacts #14–18, #20–21
- **Gates that detected but did NOT block:** Gate 15 (FAIL → report shipped), Final Audit (BLOCK → report shipped)
- **Detectors that failed:** Dialogue Canon (1 line in 109K words), WAVE (0 findings from 63 waves)
- **Cross-medium divergence:** Webpage uses different data source than PDF/DOCX/TXT for: Report Type, Overall Score, Genre, Criteria Scores, Confidence, Pitch, Premise, Content Warnings

### Remediation Status

| Priority | Fix | Status | PR |
|----------|-----|--------|-------|
| 1 | WAVE criterion bridge (empty findings) | ✓ MERGED | #1108 |
| 2 | Final audit false BLOCK (wrong required artifact list) | ✓ MERGED | #1109 |
| 3 | Gate blocking policy (Gate 15 detects but doesn't block) | PENDING | — |
| 4 | Dialogue detector (1 line in 109K words) | PENDING | — |
| 5 | Cross-medium fit-gap (Report Type, Genre, canonical view model) | PENDING | — |
| 6 | Score-10 recommendations (shopping list for perfect scores on webpage) | PENDING | — |
| — | Banned-name sanitizer (deterministic) | ✓ MERGED | #1107 |

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
