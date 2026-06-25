# Phase 4B — Final External Audit Contract

Status: governance contract v1  
Audience: evaluation pipeline, DREAM synthesis, WAVE, Phase 5 author exposure, renderers, Revise Queue, Agent Readiness Package  
Runtime role: final independent audit before author exposure, downloads, Revise handoff, or agent packaging.

## Purpose

Phase 4B catches evaluations that are technically complete but not actually release-worthy.

It sits between WAVE / Quality Gate and Phase 5 Author Exposure Certification. It does not re-score the manuscript and does not rewrite the report. It verifies that produced artifacts are coherent, complete, evidence-grounded, template-compliant, benchmark-calibrated, and safe to expose.

Core rule:

```text
No evaluation should move from WAVE / Quality Gate into author-facing surfaces unless Phase 4B returns PASS or explicitly tolerated WARN.
```

## Pipeline position

```text
Phase 0 Authority Warmup
  ↓
Phase 0.5A Story Map Seed
  ↓
Phase 0.5B Revise Opportunity Seed
  ↓
Pass 1 / Pass 2 / Pass 3A
  ↓
Pass 3B DREAM Long-Form Multi-Layer Synthesis
  ↓
Quality Gate / Semantic Gate
  ↓
WAVE
  ↓
Phase 4B Final External Audit
  ↓
Phase 5 Author Exposure Certification
  ↓
UED → ViewModel → Web/PDF/DOCX/TXT
  ↓
Revise Queue / Revise Workbench
  ↓
Agent Readiness Package
```

## Authority inputs

Phase 4B validates against:

```text
docs/governance/evaluation-output-mode-contract.md
docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
docs/templates/evaluation/evaluation-rendering-contract.md
docs/templates/evaluation/surface-parity-matrix.md
docs/governance/DREAM_OUTPUT_LONG_FORM_SPEC.md
docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md
docs/phase-0-warmup/PHASE_0_WARMUP_BENCHMARK_MANIFEST.md
```

Benchmarks are calibration references only. They never replace manuscript evidence, accepted Story Ledger authority, templates, or output contracts.

## Required artifact

Phase 4B produces:

```text
final_external_audit_v1
```

Minimum fields:

```yaml
artifact_type: final_external_audit_v1
schema_version: 1
job_id: string
manuscript_id: string | number
manuscript_version_id: string | null
input_artifacts: string[]
authority_basis:
  registry_path: docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md
  runtime_benchmark_authority_map_path: docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
  template_path: docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
  checksums: object
status: pass | warn | block
blocking_reason_codes: string[]
warning_reason_codes: string[]
checks: object[]
summary: string
created_at: string
is_resume_safe: boolean
```

## Audit check families

### 1. Authority and benchmark loading

Verify Phase 0 authority proof, runtime benchmark authority map, output-mode contract, and template path are present or explicitly degraded.

Block if required authority is absent without reason, benchmark path drift hides current benchmarks, or a full long-form run uses legacy long-form-only mode instead of `long_form_multi_layer_evaluation` / `multi_layer_long_form`.

### 2. Template and DREAM completeness

Verify the long-form multi-layer report contains executive verdict, dashboard/readiness, all 13 criteria, evidence, structural stack, layer analysis, Story Ledger reference, cross-layer synthesis, symbolic/motif audit where applicable, reader experience, revision plan, releasability, acceptance checks, and manuscript-integrity issues.

Block if required sections are missing, fewer than 13 criteria appear without N/A/insufficiency reason, or a long-form report collapses into short-form shape.

### 3. Evidence and anti-hallucination

Verify findings have manuscript evidence, anchors are not placeholders, chapter references use real index data when available, and recommendations do not introduce unsupported facts.

Block if major findings lack evidence, hallucinated characters/locations/endings/chapter numbers appear, or benchmark content leaks into manuscript facts.

### 4. Story Ledger consistency

Verify accepted Story Ledger or verified seed exists, final synthesis does not contradict story authority without evidence, author corrections are preserved, and uncertainty remains uncertainty.

Block if final evaluation contradicts accepted Story Ledger, ignores author corrections, or drops critical story-bearing entities.

### 5. Recommendation and Revise readiness

Verify revision plan and opportunity ledger are specific, deduplicated, evidence-backed, six-part where applicable, and ready for Revise Queue without inventing fields.

Block if recommendation inventory is shadow-generated, generic, duplicative, unsupported, or missing evidence anchors for actionable cards.

### 6. UED, ViewModel, and renderer readiness

Verify UED can be built, ViewModel is pass-through for certified fields, all renderers consume the same ViewModel, render manifest exists when downloads are generated, and parity gaps are surfaced before author exposure.

Block if renderers bypass UED/ViewModel, surfaces disagree on author-facing truth, or renderers add business logic.

### 7. WAVE and Phase 5 handoff

Verify WAVE outputs are present when required, WAVE priorities align with the canonical recommendation ledger, Phase 5 sees Phase 4B status, and WARN has an explicit tolerance reason.

Block if Phase 5 proceeds after BLOCK, WAVE contradicts evaluation without explanation, or `report_ready` is set before audit/certification.

## Status semantics

- `pass`: all required check families pass.
- `warn`: bounded non-author-trust issues; may proceed only with explicit tolerance reason.
- `block`: must not be author-exposed, downloaded, revised, or packaged for agents.

## Machine-readable check shape

```yaml
check_id: string
family: authority | template | evidence | story_ledger | recommendation | renderer | wave | phase5
status: pass | warn | block
reason_code: string
message: string
affected_artifacts: string[]
author_facing_risk: low | medium | high
required_fix: string | null
```

## Non-negotiable rules

1. Phase 4B audits; it does not re-score.
2. Phase 4B verifies manuscript-grounding; it does not add manuscript facts.
3. Benchmarks calibrate completeness and quality; they do not override templates or manuscript evidence.
4. BLOCK means no author exposure, downloads, Revise queue release, or Agent Readiness Package.
5. WARN must be bounded and explicit.
6. Phase 5 must consume Phase 4B status before certifying author exposure.
