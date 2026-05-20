# RevisionGrade DREAM Output Long-Form Specification

**Status:** PROPOSED LOCK — DREAM long-form completeness contract  
**Owner:** Mmeraw  
**Created:** 2026-05-14  
**Updated:** 2026-05-19  
**Scope:** Standard long-form and multi-layer / multi-voice long-form manuscript evaluations  
**Visibility:** [PROTECTED] implementation authority; public report surfaces must expose only plain editorial output

---

## Purpose

This specification defines what a successful RevisionGrade long-form manuscript evaluation must produce.

A long-form evaluation is not successful merely because the pipeline reaches a terminal state. It is successful only when it completes within the configured wall-clock budget and produces a scored, summarized, revision-ready evaluation that applies the WAVE Revision System through the 13 canonical story criteria while proving that it has accounted for the manuscript's character, relationship, symbolic, sensory, integrity, and evidence-distribution architecture.

The minimum user promise is:

> The writer receives a professional-quality long-form evaluation with scores, summaries, evidence, WAVE-informed diagnostic reasoning, concrete revision priorities, and auditable proof that the report detected the manuscript's load-bearing architecture — without needing to ask why the report stopped, where the score is, what it missed, or what to fix first.

DREAM is a completeness contract, not a section explosion. The report must prove what it detected, what it protected, what it traced, and what would count as a miss.

---

## Authority and inheritance

This spec inherits from, and must not contradict:

- `docs/governance/DREAM_OUTPUT_SPEC.md`
- `docs/WAVE_REVISION_GUIDE_CANON.md`
- `docs/canon/registered/volumes/VOLUME-II-STORY-EVALUATION-CRITERIA.md`
- `docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md`
- `docs/benchmarks/froggin-noggin-dream.md`
- `docs/benchmarks/cartel-babies-dream.md`
- `docs/benchmarks/let-the-river-decide-dream.md`
- `lib/evaluation/pipeline/prompts/pass3b-longform.ts`

### Binding WAVE rule

WAVE canon is binding on long-form evaluation behavior. The WAVE guide is the authority for WAVE interpretation, structure, and revision order. Platforms implement WAVE; they do not redefine it.

### Binding 13-criteria rule

The 13 Story Evaluation Criteria remain the public evaluation spine. Long-form output must evaluate all 13 criteria before WAVE-derived revision guidance is considered complete.

### Canonical route and output-mode rule

This spec does not introduce new lifecycle status values or route enum values.

Canonical evaluation route remains `LONG_FORM` / `SHORT_FORM` where the evaluation artifact uses uppercase route values. Chunk-routing telemetry may use existing lowercase telemetry values where already defined by code.

Standard long-form and multi-layer / multi-voice long-form are output modes within the long-form route. They must be represented as an output-mode or report-mode distinction, not as a new `JobStatus` or route identifier.

Recommended output-mode labels:

- `standard_long_form`
- `multi_layer_long_form`

### Canonical sequence

Long-form evaluation follows this sequence:

1. Architecture
2. 13 Story Criteria
3. Eligibility Gate
4. DREAM completeness ledgers
5. WAVE-informed revision diagnostics
6. Submission / readiness posture

WAVE must not replace the 13 criteria. WAVE is applied after, and through, the criteria to explain what must be revised and in what order.

---

## Evaluation vs Revise-engine boundary

The long-form evaluation produces diagnosis and revision targets. It does not perform manuscript changes.

The WAVE module layer is a downstream Revise-engine concern. The evaluator may emit WAVE-informed revision targets, recommended wave domains, priority order, and rationale, but manuscript-change application and module result persistence belong to a later Revise workflow.

Canonical separation:

1. **Evaluation output layer** — scores, summaries, criteria findings, WAVE-informed targets, coverage, and revision priorities.
2. **DREAM completeness layer** — compact ledgers and gates proving the report accounted for character architecture, relationship spine, symbolic payoff, sensory/emotional register, integrity classification, and evidence distribution.
3. **Mapping / planning layer** — converts evaluation findings into revision targets and recommended wave domains.
4. **Revise module layer** — applies approved revision modules and returns governed module results.
5. **Governance layer** — validates sequence, completeness, safety, releasability, and auditability.

A long-form evaluation can be complete without Revise module application. It cannot be complete without producing the WAVE-informed revision plan and DREAM completeness proof needed for later Revise work.

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
- evidence-distribution confidence risk
- character / relationship payoff risk

The public report must not expose protected WAVE internals, gate identifiers, doctrine IDs, validator names, prompt mechanics, or governance machinery.

### WAVE IV governance rule

WAVE IV is governance.

WAVE IV must be treated as an internal compliance, enforcement, and audit layer. It may govern whether an output is releasable, whether required sections exist, whether protected terminology leaked, whether confidence was evidence-earned, and whether the evaluation followed the required sequence.

WAVE IV must not be rendered as a customer-facing editorial section or as manuscript advice. It belongs in protected diagnostics, audit logs, quality gates, and admin-only governance surfaces.

---

## Output modes

Long-form output has two required modes.

### Mode A — Standard long-form

Use standard long-form when the manuscript is primarily linear or can be evaluated through the 13 criteria without a separate layer architecture map.

The standard long-form output is still WAVE-applied. It must produce full criteria scoring, summaries, evidence, WAVE-informed diagnosis, revision priorities, and the DREAM completeness ledgers appropriate to the manuscript.

### Mode B — Multi-layer / multi-voice long-form

Use multi-layer / multi-voice long-form when the manuscript contains multiple eras, ontological planes, doctrine systems, voice regimes, canon-bearing paratext, symbolic systems, major relational systems, or structural layers that would be flattened by a standard linear report.

This mode extends standard long-form with structural stack analysis, layer and voice mapping, layer-by-layer diagnosis, cross-layer integration, canon / doctrine / symbolic-system audit, layer-aware revision sequencing, and the required compact ledgers below.

### Dual-POV / multi-voice route flag

If the manuscript contains alternating narrator lanes, parallel POV architecture, or a secondary POV lane carrying major emotional or causal load, the evaluator must set a multi-voice submode internally and render separate structural/layer rows for each major narrator lane.

This is required because a co-protagonist or parallel POV lane may be underweighted if treated only as relationship context. For example, a search / absence / domestic-ritual POV lane must be evaluated as architecture when it functions as a parallel narrative engine.

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
8. Clear distinction between craft weakness, structural weakness, readiness risk, and report-coverage risk.
9. Coverage / SIPOC appendix sufficient to explain what was actually read and represented.
10. DREAM completeness ledgers sufficient to prove the evaluation did not miss the manuscript's load-bearing architecture.
11. Releasability state: releasable only if scoring, summaries, coverage, governance, and persistence are complete.

If any required score, summary, criterion block, evidence basis, compact ledger, or route-specific report section is missing, the output is incomplete even if the job reached terminal lifecycle status `complete`.

---

## DREAM completeness ledgers

The long-form template must not add twelve new prose-heavy sections. It must add compact governed ledgers and gates. These ledgers are report-quality controls, not decorative appendices.

### 1. Character Coverage & Arc Ledger

Required for every long-form DREAM report.

Purpose: prove that the report accounted for protagonists, co-protagonists, major secondary characters, antagonists, recurring companions, animal companions, symbolic-force characters, and ending obligations.

Each major row must include:

- character name / canonical label
- aliases or renamings where relevant
- role and narrative weight
- relationship-engine participation
- arc start
- arc pressure
- turning point or movement
- end state
- ending accountability
- evidence anchors
- report risk: covered, underweighted, omitted, or needs manual verification

A report is incomplete if it discusses plot, theme, closure, or readiness while omitting a protagonist, co-protagonist, major recurring companion, pronoun/gender consistency concern, arc-state coverage, or ending-status accountability.

### 2. Relationship Spine Ledger

Required for every long-form DREAM report.

Purpose: prove that the report detected the manuscript's emotional and causal relationship engines, not merely individual characters.

Each relationship row should include:

- relationship label
- characters or groups connected
- beginning pressure
- midpoint change
- ending state or payoff
- bridge activity, object, ritual, game, food, music, labor, or place if any
- power relation affected
- trust transfer or authority shift
- report status: adequately accounted for, underweighted, or missing

The evaluator must identify bridge activities when they materially connect captives, guards, authority figures, children, family systems, companions, or social groups. Games, lessons, shared labor, meals, sports, local cultural practices, or music may be plot architecture, not color.

### 3. Symbol-to-Character Payoff Ledger

Required for every long-form DREAM report.

Purpose: prevent the report from merely listing symbols without tracing their lifecycle.

Each symbol row should include:

- symbol / object / name / recurring image
- attached character(s) or relationship(s)
- first appearance
- transformation / disappearance / transfer
- reappearance or payoff
- identity / continuity / power function
- status: resolved, active, underused, abandoned, or needs manual verification

A symbolic object tied to identity, promise, grief, naming, authority, memory, punishment, or family cannot be considered covered unless the report traces its lifecycle.

### 4. Sensory / Emotional Register Ledger

Required for every long-form DREAM report.

Purpose: force the evaluator to identify the top sensory channels driving emotional register and to prevent sensory systems from being flattened into atmosphere.

The report must identify the top three sensory drivers and account for all five senses as active, underused, intentionally absent, or not load-bearing.

Each sensory row should include:

- sense channel: sound, touch, sight, smell, or taste
- dominant anchors
- emotional register produced
- plot / power function
- relationship function
- revision opportunity or asset-protection instruction

Sound/music systems must be detected when they function as punishment, conditioning, trauma trigger, authority, camp rhythm, mood control, relationship bridge, or symbolic payoff. Tactile systems must be detected when they carry confinement, tenderness, body-memory, violence, or relief.

### 5. Manuscript Integrity Confidence Table

Required for every long-form DREAM report.

Purpose: separate actual manuscript defects from intentional motifs, TOC/rendering artifacts, broken anchors, title-card hygiene, or manual-verification items.

Each issue row must include:

- issue label
- location or evidence basis
- integrity class: confirmed defect, likely defect, artifact suspected, intentional motif suspected, title/package hygiene, anchor/TOC issue, or needs manual verification
- craft impact if true
- recommended action
- confidence level

The report must not treat a document-hygiene artifact as story weakness without verification. It must not call intentional mirroring a duplicate-content defect unless evidence supports that claim.

### 6. Evidence Distribution / Confidence Gate

Required for every long-form DREAM report.

Purpose: prevent opening-chapter dominance and false confidence.

For full-novel claims, confidence must be evidence-earned. A major criterion or executive claim may not carry High confidence unless evidence anchors span at least two act zones. For major whole-manuscript claims, the preferred span is opening, middle, late act, and ending.

Each criterion should expose or imply:

- evidence zones used: opening, early, middle, late, ending, or whole manuscript
- evidence count
- confidence basis
- downgrade reason if evidence is narrow

A report that repeatedly cites only the opening for character, theme, marketability, or closure must downgrade confidence or flag evidence-distribution risk.

---

## Folded surfaces, not standalone section explosion

The following concerns are mandatory but must be folded into existing sections or ledgers rather than expanded into separate prose-heavy sections:

- Character Promise / Payoff → inside Character Coverage & Arc Ledger.
- Distinctive Intelligence / Technical Voice → inside Asset Protection Notes and Marketability.
- Opening Asset Audit → inside Evidence Distribution / Confidence Gate.
- Ending Emotional Register → inside Reader Experience and Closure.
- Market Differentiator Stack → inside Market Shelf / Marketability.
- What This Manuscript Must Not Become → structured as a Doctrine Anti-Pattern Ledger.

### Doctrine Anti-Pattern Ledger

The existing `What this manuscript must not become` section remains required, but it should be structured conceptually as anti-patterns:

- risk description
- trigger condition
- evidence of current proximity
- mitigation

This keeps the section actionable and testable while preserving its editorial value.

### Canonical Recommendation Ledger

The report must deduplicate recommendations across top recommendations, criterion recommendations, layer analysis, and revision plan.

Each canonical recommendation must have:

- location
- action
- mechanism rationale: why this change works
- risk if ignored
- asset to preserve
- linked criterion or ledger
- priority

The same recommendation must not appear repeatedly under different headings unless it is explicitly referenced as the same recommendation.

---

## Standard long-form output shape

A standard long-form report must contain, at minimum:

```text
LongFormEvaluationReport
├── Work metadata
├── Executive verdict
├── Overall score / readiness score
├── Score grid: 13 Story Evaluation Criteria
├── Criterion-by-criterion analysis ×13
├── Character Coverage & Arc Ledger
├── Relationship Spine Ledger
├── Symbol-to-Character Payoff Ledger
├── Sensory / Emotional Register Ledger
├── Manuscript Integrity Confidence Table
├── Evidence Distribution / Confidence Gate
├── Cross-criterion synthesis
├── Doctrine Anti-Pattern Ledger
├── Canonical Recommendation Ledger / Prioritized revision plan
└── SIPOC / coverage appendix
```

### Standard long-form acceptance bar

A standard long-form output passes only if a writer can identify:

- the manuscript's current quality level
- the strongest criteria
- the weakest criteria
- the primary causal weakness
- the principal characters and relationship engines
- the first five revision actions
- why those actions come first
- what must be preserved during revision
- what WAVE-informed discipline governs the revision order

---

## Multi-layer / multi-voice long-form output shape

A multi-layer report must contain, at minimum:

```text
MultiLayerLongFormEvaluationReport
├── Work metadata
├── Executive verdict
├── Structural stack
│   ├── Layer & Voice Map
│   └── Stack diagnosis
├── Score grid
│   ├── 13 Story Evaluation Criteria
│   └── multi-layer-specific rows where applicable
├── Character Coverage & Arc Ledger
├── Relationship Spine Ledger
├── Symbol-to-Character Payoff Ledger
├── Sensory / Emotional Register Ledger
├── Layer-by-layer analysis
├── Cross-layer integration
├── Canon / doctrine / symbolic-system audit
├── Reader experience
├── Manuscript Integrity Confidence Table
├── Evidence Distribution / Confidence Gate
├── Doctrine Anti-Pattern Ledger
├── Canonical Recommendation Ledger / Revision plan
└── Acceptance checks / coverage appendix
```

### Multi-layer-specific score rows

Where applicable, multi-layer long-form may extend the 13-criteria grid with additional architecture rows, including:

- Layer & Mode Integration
- Layer Coherence
- Doctrine / Symbolic System Integrity
- Canon & Continuity Integrity
- Character / Relationship Architecture Coverage
- Sensory / Emotional Register Control

These rows do not replace the 13 Story Evaluation Criteria. They diagnose layered architecture only after the 13 criteria are preserved.

### Multi-layer acceptance bar

A multi-layer output passes only if it:

- preserves the manuscript's layer architecture before judging quality
- identifies the emotional anchor layer
- identifies the interpretive / doctrinal / symbolic layer
- identifies which layer is most fragile
- identifies the principal character and relationship spine
- identifies bridge activities, rituals, games, music, sensory systems, or symbolic objects that carry plot/relationship weight
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
- preserve voice, ambition, distinctive intelligence, and load-bearing symbolism while removing weakness, redundancy, confusion, and indulgence
- emit revision targets in a form that a later WAVE executor can consume
- pair revision advice with asset-protection notes

### Disallowed WAVE behavior

The output must not:

- expose protected WAVE identifiers in user-facing text
- describe WAVE IV governance as a public-facing manuscript section
- skip the 13 criteria and jump directly to WAVE advice
- prescribe line-level polish before unresolved structural failure
- flatten multi-layer ambition into a generic linear critique
- flatten bridge activities, music, sensory systems, or local cultural anchors into generic atmosphere when they carry architecture
- reward complexity merely for existing
- claim Revise-module application during evaluation output generation

---

## Runtime and reducer contract

DREAM completeness must be implemented as compact ledgers and deterministic gates, not as unbounded new prose generation.

Recommended implementation shape:

```text
Pass 1  = craft evidence
Pass 2  = independent editorial audit
Pass 1A = character / relationship / symbol / sensory evidence sweep

Reducer = deterministic compression with hard caps

Pass 3 / Pass 3b = DREAM synthesis from compressed evidence
Pass 4 = deterministic gates
```

### Hard caps

Default caps should prevent latency explosion:

- Pass 1A per chunk: max 8–12 character candidates.
- Pass 1A per chunk: max 2 evidence anchors per candidate.
- Pass 1A per chunk: no long quotes.
- Whole manuscript character ledger: max 12 major report-visible character rows unless manually expanded.
- Relationship ledger: max 8 report-visible relationship engines.
- Symbol-to-character payoff ledger: max 12 report-visible rows.
- Sensory ledger: top 3 sensory drivers plus five-senses opportunity matrix.
- Pass 3b must receive compressed ledgers, not raw chunk spam.
- Reducer should be deterministic code, not another model pass.

### Latency target

The safe path should target +8–15% wall-clock and must treat +25% as a hard warning threshold. If the added ledgers push full-novel evaluation beyond configured budget, the implementation is too verbose or the reducer is leaking raw evidence into synthesis.

---

## Timeout and completion rule

A long-form run that times out before producing required scores, summaries, ledgers, and revision priorities is not a successful evaluation.

The following are descriptive failure modes or reason categories, not new lifecycle `status` values:

- successful evaluated output
- fail-closed timeout
- fail-closed coverage gap
- fail-closed synthesis gap
- fail-closed quality-gate / governance gap
- fail-closed persistence gap
- fail-closed DREAM completeness gap

If these are persisted, they must live in existing validity / reason-code / governance fields or in an explicitly approved future field. They must not be copied into lifecycle status columns as new status values.

A result is releasable only when the report contains the required mode-specific sections, all 13 criterion surfaces, overall score/verdict, coverage statement, DREAM completeness ledgers, revision priorities, and required persistence artifacts.

---

## Validation fixtures

### Required DREAM gold standards

The required RevisionGrade-native gold standards are:

- `docs/benchmarks/froggin-noggin-dream.md`
- `docs/benchmarks/cartel-babies-dream.md`

These define house style, depth, and report architecture.

### Calibration benchmark

`docs/benchmarks/let-the-river-decide-dream.md` is extended calibration coverage. It tests eco-thriller / memoir-witness / road-narrative / cultural-protocol / research-heavy ambiguity behavior and should be used to broaden calibration without blocking the minimum required gold-standard lock.

### Public-domain calibration

Public-domain DREAM calibration may be added later for texts such as `Dracula`, `Great Expectations`, and `Pride and Prejudice`. Those calibrations must be marked `runtime-authority: false` and must not replace the required RevisionGrade-native gold standards.

### Shape validation requirement

Benchmark guards should validate:

- all required gold standards are present
- all required gold standards expose canonical 13 criteria
- required DREAM ledgers are present or explicitly folded into recognized sections
- manual-reference disclaimer exists
- scores are bounded 0–10 or 0–100 depending on section
- confidence labels come from the allowed set
- calibration-tier files do not become runtime authority by accident

---

## Definition of done for implementation work

Any work that affects long-form evaluation output, prompt shaping, score persistence, synthesis, quality gates, chunk routing, report rendering, or admin observability is done only if it states whether it preserves or changes this spec.

Implementation changes must answer:

1. Which output mode is affected: standard long-form, multi-layer long-form, or both?
2. Are all 13 criteria still scored or truthfully caveated?
3. Does the output still apply WAVE in the correct sequence?
4. Is WAVE IV kept internal as governance?
5. Are overall score, verdict, summaries, and revision priorities preserved?
6. Are the six DREAM completeness ledgers present, folded, or intentionally not applicable?
7. Does the output distinguish craft weakness from report-coverage weakness?
8. Does the change reduce timeout risk or clearly preserve bounded runtime?
9. Does the output remain releasable only when all required artifacts exist?
10. Does the evaluator stop at targets/plans rather than falsely claiming Revise-module application?

---

## Lockability

This spec is a proposed lock. Once merged, future changes require a separate governance change explaining why the long-form target is changing.

No runtime work may quietly weaken this spec while implementing output, timeout, scoring, summary, WAVE target, template, benchmark, or DREAM completeness changes.
