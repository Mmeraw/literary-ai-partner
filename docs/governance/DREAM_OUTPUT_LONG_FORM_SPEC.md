# RevisionGrade Dream Output Long-Form Specification

**Status:** PROPOSED LOCK — becomes LOCKED when merged  
**Owner:** Mmeraw  
**Created:** 2026-05-14  
**Scope:** Standard long-form and multi-layer / multi-voice long-form manuscript evaluations  
**Visibility:** [PROTECTED] implementation authority; public report surfaces must expose only plain editorial output

---

## Purpose

This specification defines what a successful RevisionGrade long-form manuscript evaluation must produce.

A long-form evaluation is not successful merely because the pipeline reaches a terminal state. It is successful only when it completes within the configured wall-clock budget and produces a scored, summarized, revision-ready evaluation that applies the WAVE Revision System through the 13 canonical story criteria.

The minimum user promise is:

> The writer receives a professional-quality long-form evaluation with scores, summaries, evidence, WAVE-informed diagnostic reasoning, and concrete revision priorities — without needing to ask why the report stopped, where the score is, or what to fix first.

---

## Authority and inheritance

This spec inherits from, and must not contradict:

- `docs/governance/DREAM_OUTPUT_SPEC.md`
- `docs/WAVE_REVISION_GUIDE_CANON.md`
- `docs/canon/registered/volumes/VOLUME-II-STORY-EVALUATION-CRITERIA.md`
- `docs/benchmarks/ancient-bloodlines-shortform-model.md`
- `docs/benchmarks/ancient-bloodlines-longform-layered-template.md`
- `docs/benchmarks/ancient-bloodlines-longform-layered.md`

### Binding WAVE rule

WAVE canon is binding on long-form evaluation behavior. The WAVE guide is the authority for WAVE interpretation, structure, and revision order. Platforms implement WAVE; they do not redefine it.

### Binding 13-criteria rule

The 13 Story Evaluation Criteria remain the public evaluation spine. Long-form output must evaluate all 13 criteria before WAVE-derived revision guidance is considered complete.

### Canonical route and output-mode rule

This spec does not introduce new lifecycle status values or route enum values.

Canonical evaluation route remains `LONG_FORM` / `SHORT_FORM` where the evaluation artifact uses uppercase route values. Chunk-routing telemetry may use its existing lowercase telemetry values where already defined by code.

Standard long-form and multi-layer / multi-voice long-form are output modes within the long-form route. They must be represented as an output-mode or report-mode distinction, not as a new `JobStatus` or route identifier.

Recommended output-mode labels:

- `standard_long_form`
- `multi_layer_long_form`

### Canonical sequence

Long-form evaluation follows this sequence:

1. Architecture
2. 13 Story Criteria
3. Eligibility Gate
4. WAVE-informed revision diagnostics
5. Submission / readiness posture

WAVE must not replace the 13 criteria. WAVE is applied after, and through, the criteria to explain what must be revised and in what order.

---

## Evaluation vs Revise-engine boundary

The long-form evaluation produces diagnosis and revision targets. It does not perform manuscript changes.

The WAVE module layer is a downstream Revise-engine concern. The evaluator may emit WAVE-informed revision targets, recommended wave domains, priority order, and rationale, but manuscript-change application and module result persistence belong to a later Revise workflow.

Canonical separation:

1. **Evaluation output layer** — scores, summaries, criteria findings, WAVE-informed targets, coverage, and revision priorities.
2. **Mapping / planning layer** — converts evaluation findings into revision targets and recommended wave domains.
3. **Revise module layer** — applies approved revision modules and returns governed module results.
4. **Governance layer** — validates sequence, completeness, safety, releasability, and auditability.

A long-form evaluation can be complete without Revise module application. It cannot be complete without producing the WAVE-informed revision plan needed for later Revise work.

---

## WAVE layer boundary

The WAVE system must be applied to long-form evaluation, but not all WAVE layers are user-facing.

### Public-facing WAVE application

Public report text may describe WAVE-derived findings only in plain editorial language:

- structural weakness
- momentum drag
- scene-function failure
- voice / POV control issue
- prose-control issue
- revision order
- readiness risk

The public report must not expose protected WAVE internals, gate identifiers, doctrine IDs, validator names, prompt mechanics, or governance machinery.

### WAVE IV governance rule

WAVE IV is governance.

WAVE IV must be treated as an internal compliance, enforcement, and audit layer. It may govern whether an output is releasable, whether required sections exist, whether protected terminology leaked, and whether the evaluation followed the required sequence.

WAVE IV must not be rendered as a customer-facing editorial section or as manuscript advice. It belongs in protected diagnostics, audit logs, quality gates, and admin-only governance surfaces.

---

## Output modes

Long-form output has two required modes.

### Mode A — Standard long-form

Use standard long-form when the manuscript is primarily linear or can be evaluated through the 13 criteria without a separate layer architecture map.

The standard long-form output is still WAVE-applied. It must produce full criteria scoring, summaries, evidence, WAVE-informed diagnosis, and revision priorities.

### Mode B — Multi-layer / multi-voice long-form

Use multi-layer / multi-voice long-form when the manuscript contains multiple eras, ontological planes, doctrine systems, voice regimes, canon-bearing paratext, symbolic systems, or structural layers that would be flattened by a standard linear report.

This mode extends standard long-form with structural stack analysis, layer and voice mapping, layer-by-layer diagnosis, cross-layer integration, canon / doctrine / symbolic-system audit, and layer-aware revision sequencing.

---

## Shared success contract for all long-form modes

Every successful long-form evaluation must produce:

1. Manuscript metadata: title, word count, canonical route, output mode, chunk count, coverage statement, confidence, engine/build marker.
2. Executive verdict: concise professional summary of ambition, strengths, principal drag, and readiness.
3. Overall quality score or readiness score.
4. Full 13-criteria score grid.
5. Per-criterion summaries for all 13 criteria.
6. Evidence-backed diagnosis for material strengths and weaknesses.
7. WAVE-informed revision priorities.
8. Clear distinction between craft weakness, structural weakness, and readiness risk.
9. Coverage / SIPOC appendix sufficient to explain what was actually read and represented.
10. Releasability state: releasable only if scoring, summaries, coverage, governance, and persistence are complete.

If any required score, summary, criterion block, evidence basis, or route-specific report section is missing, the output is incomplete even if the job reached terminal lifecycle status `complete`.

---

## Standard long-form output shape

A standard long-form report must contain, at minimum:

```text
LongFormEvaluationReport
├── Work metadata
│   ├── title
│   ├── scope
│   ├── word_count
│   ├── route = LONG_FORM
│   ├── output_mode = standard_long_form
│   ├── chunk_count
│   ├── coverage_statement
│   └── confidence
├── Executive verdict
├── Overall score / readiness score
├── Score grid: 13 Story Evaluation Criteria
│   ├── criterion
│   ├── score
│   ├── confidence
│   └── one-line summary finding
├── Criterion-by-criterion analysis ×13
│   ├── what is working
│   ├── what is weakening impact
│   ├── evidence anchors
│   ├── WAVE-informed diagnostic reading
│   └── revision recommendation
├── Cross-criterion synthesis
│   ├── strongest dimensions
│   ├── weakest dimensions
│   ├── causal relationship among weaknesses
│   └── readiness posture
├── Prioritized revision plan
│   ├── top 5 actions
│   ├── reason for order
│   ├── estimated effort
│   └── expected reader impact
└── SIPOC / coverage appendix
```

### Standard long-form required sections

The report must include:

- Work metadata
- Executive verdict
- Overall score or readiness score
- Full 13-criteria score grid
- Detailed analysis for each of the 13 criteria
- Revision plan ordered by diagnostic priority
- Coverage statement
- Evidence anchors where available
- Plain-language caveats for missing evidence

### Standard long-form acceptance bar

A standard long-form output passes only if a writer can identify:

- the manuscript's current quality level
- the strongest criteria
- the weakest criteria
- the primary causal weakness
- the first five revision actions
- why those actions come first
- what WAVE-informed discipline governs the revision order

---

## Multi-layer / multi-voice long-form output shape

A multi-layer report must contain, at minimum:

```text
MultiLayerLongFormEvaluationReport
├── Work metadata
│   ├── title
│   ├── scope
│   ├── word_count
│   ├── route = LONG_FORM
│   ├── output_mode = multi_layer_long_form
│   ├── chunk_count
│   ├── coverage_statement
│   └── confidence
├── Executive verdict
├── Structural stack
│   ├── Layer & Voice Map
│   └── Stack diagnosis
├── Score grid
│   ├── 13 Story Evaluation Criteria
│   └── multi-layer-specific rows where applicable
├── Layer-by-layer analysis
│   ├── function in the whole
│   ├── what is working
│   ├── what is weakening impact
│   ├── revision priorities for this layer
│   └── evidence anchors
├── Cross-layer integration
│   ├── transition analysis
│   ├── echoes and mirrors
│   └── architectural risk
├── Canon / doctrine / symbolic-system audit
│   ├── system inventory
│   ├── later obligations
│   └── stability / drift / underuse status
├── Reader experience
│   ├── what a strong reader is likely to feel
│   ├── what an average reader may struggle with
│   └── what should not be simplified away
├── Revision plan
│   ├── top 5 actions
│   └── sequence recommendation
└── Acceptance checks / coverage appendix
```

### Multi-layer-specific score rows

Where applicable, multi-layer long-form may extend the 13-criteria grid with additional architecture rows, including:

- Layer & Mode Integration
- Layer Coherence
- Doctrine / Symbolic System Integrity
- Canon & Continuity Integrity

These rows do not replace the 13 Story Evaluation Criteria. They diagnose layered architecture only after the 13 criteria are preserved.

### Multi-layer acceptance bar

A multi-layer output passes only if it:

- preserves the manuscript's layer architecture before judging quality
- identifies the emotional anchor layer
- identifies the interpretive / doctrinal / symbolic layer
- identifies which layer is most fragile
- evaluates whether layers integrate into one designed organism
- gives revision advice that improves readability without flattening ambition

---

## Required 13 Story Evaluation Criteria

Every long-form report must score and summarize all 13 canonical criteria:

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

If evidence is insufficient for a criterion, the report must say `Not evaluated — insufficient evidence` or an equivalent truthful caveat. It must not silently omit the criterion or convert missing evidence into a false score.

---

## WAVE-applied revision logic

The long-form report must use WAVE to determine revision order and diagnostic priority.

### Required WAVE-informed behavior

The output must:

- correct architecture before refinement
- prioritize structural integrity over stylistic polish
- distinguish macro narrative viability from micro execution authority
- connect criteria failures to revision domains
- identify when line-level work is premature because architecture is unstable
- preserve voice and ambition while removing weakness, redundancy, confusion, and indulgence
- emit revision targets in a form that a later WAVE executor can consume

### Disallowed WAVE behavior

The output must not:

- expose protected WAVE identifiers in user-facing text
- describe WAVE IV governance as a public-facing manuscript section
- skip the 13 criteria and jump directly to WAVE advice
- prescribe line-level polish before unresolved structural failure
- flatten multi-layer ambition into a generic linear critique
- reward complexity merely for existing
- claim Revise-module application during evaluation output generation

---

## Timeout and completion rule

A long-form run that times out before producing required scores and summaries is not a successful evaluation.

The following are descriptive failure modes or reason categories, not new lifecycle `status` values:

- successful evaluated output
- fail-closed timeout
- fail-closed coverage gap
- fail-closed synthesis gap
- fail-closed quality-gate / governance gap
- fail-closed persistence gap

If these are persisted, they must live in existing validity / reason-code / governance fields or in an explicitly approved future field. They must not be copied into lifecycle status columns as new status values.

A result is releasable only when the report contains the required mode-specific sections, all 13 criterion surfaces, overall score/verdict, coverage statement, revision priorities, and required persistence artifacts.

---

## Validation fixtures

### Standard long-form fixture requirement

At least one standard long-form manuscript must be used as a validation fixture proving:

- all 13 criteria are scored or truthfully caveated
- overall score / verdict exists
- summaries are present
- WAVE-informed revision order is present
- coverage statement is present
- output is complete within wall-clock budget

### Multi-layer fixture requirement

The following files are the canonical multi-layer benchmark fixtures. They prove the required presence of:

- multi-layer / multi-voice mode label
- structural stack
- layer and voice map
- score grid with 13 criteria + 4 architecture rows
- layer-by-layer analysis
- cross-layer integration
- canon / doctrine / symbolic-system audit
- reader experience
- top five revision actions
- sequence recommendation

| File | Manuscript | Notes |
|---|---|---|
| `docs/benchmarks/ancient-bloodlines-longform-layered.md` | *Ancient Bloodlines* | Initial shape reference |
| `docs/benchmarks/froggin-noggin-dream.md` | *Froggin Noggin* | Multi-layer eco-satirical myth; closure ledger benchmark |
| `docs/benchmarks/cartel-babies-dream.md` | *Cartel Babies* | Multi-layer captivity/family arc; structural defect detection benchmark |

All three must conform to `docs/governance/DREAM_STATE_LONGFORM_CANON.md`.

---

## Definition of done for implementation PRs

Any PR that affects long-form evaluation output, prompt shaping, score persistence, synthesis, quality gates, chunk routing, report rendering, or admin observability is done only if it states whether it preserves or changes this spec.

Implementation PRs must answer:

1. Which output mode is affected: standard long-form, multi-layer long-form, or both?
2. Are all 13 criteria still scored or truthfully caveated?
3. Does the output still apply WAVE in the correct sequence?
4. Is WAVE IV kept internal as governance?
5. Are overall score, verdict, summaries, and revision priorities preserved?
6. Does the change reduce timeout risk or clearly preserve bounded runtime?
7. Does the output remain releasable only when all required artifacts exist?
8. Does the evaluator stop at targets/plans rather than falsely claiming Revise-module application?

---

## Lockability

This spec is a proposed lock. Once merged, future changes require a separate governance PR explaining why the long-form target is changing.

No runtime PR may quietly weaken this spec while implementing output, timeout, scoring, summary, WAVE target, or template changes.
