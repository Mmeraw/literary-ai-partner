# RevisionGrade Dream Output Specification

**Status**: PROPOSED LOCK — becomes LOCKED when merged
**Owner**: Mmeraw
**Created**: 2026-05-09
**Last verified**: 2026-05-09

## IP Visibility Classification

This specification describes **internal system architecture** that is protected intellectual property. Sections marked [PUBLIC] describe user-visible surface. Sections marked [PROTECTED] describe internal canon that must never appear in user-facing surfaces, exported artifacts, API responses, error messages, or downloadable reports.

[PUBLIC] Public surface: 13 Story Criteria names, scores, fit/gap framing in plain editorial language, anchored evidence excerpts, plain-language revision priorities.

[PROTECTED] Protected internals: WAVE canon (62 waves, Tsunamis), Gate 15.1/15.2, two-ledger scoring architecture, ritual registry, anchor locks, Lost World doctrine entries, Pass 1/2/3/4 prompt specifications, Volume I–VI references, all wave/gate/doctrine identifiers.

## Purpose

Define what a "successful manuscript evaluation" looks like from the user's perspective: a complete, actionable diagnostic that lets the user begin revision with full clarity on **what** their manuscript is doing, **where** it's doing it, **why** it matters, **who** it affects, **when** in the arc it lands, and **how** to fix it.

Without this spec, every implementation choice is unanchored. With it, every governance lock and implementation PR can be measured against the same target.

## The user's question

When a writer uploads a manuscript to RevisionGrade, they are asking one core question:

> "I've written a manuscript. Tell me what's working, what isn't, where exactly, why it matters, and what to fix first — so I can start revising tonight with confidence."

The dream output must answer this question completely.

## The 5 Ws + How framework

Every diagnostic produced by the system must address these six dimensions:

| Dimension | What it answers | Where it surfaces |
|---|---|---|
| **What** | Which criterion is fit / gap | Per-criterion fit/gap statements |
| **Where** | Specific passage / chapter / scene | Passage anchors on every evidence excerpt |
| **Why** | Causal mechanism (craft + reader effect) | Rationale field linking evidence → effect |
| **Who** | Reader experience impact | Reader-impact statement per gap |
| **When** | Position in arc / pacing context | Arc-position metadata on anchors |
| **How** | Concrete revision pathway | Prioritized revision queue |

If any of the six dimensions is missing or generic, the output is incomplete.

## Required output shape

Every long-form evaluation must produce, at minimum, this user-facing structure:

```text
EvaluationReport
├── Manuscript metadata (title, word count, route, chunk count)
├── Overall score + brief summary
├── Per-criterion blocks (×13 canonical keys)
│   ├── Criterion name
│   ├── Craft score + Editorial score
│   ├── Fit statement: what the manuscript IS doing well on this criterion
│   │   └── Anchored evidence excerpts (chapter/scene/percentile)
│   ├── Gap statement: what the manuscript is FALLING SHORT on this criterion
│   │   └── Anchored evidence excerpts
│   ├── Why-it-matters: reader-impact statement
│   └── How-to-revise: 1–3 concrete recommendations
├── Prioritized revision queue (top 5)
│   ├── Rank
│   ├── Criterion + gap reference
│   ├── Reasoning for priority
│   ├── Estimated revision effort (low/medium/high)
│   └── Estimated reader impact (low/medium/high)
└── SIPOC diagnostic appendix (chunk_coverage_pct, compression_ratio, dark criteria, evidence density)
```

## Acceptance criteria

The dream output is delivered when **all** of the following are true for a real long-form manuscript run:

### Criterion 1 — Fit/gap framing per canonical criterion

- [ ] Every long-form evaluation produces a `fit` field and a `gap` field for each of the 13 canonical criteria.
- [ ] Both fields are non-empty strings of at least 30 words.
- [ ] Each field references at least one anchored evidence excerpt.
- [ ] `fit` and `gap` are mutually distinct: a criterion can be partially fit and partially gap; the system articulates both.

### Criterion 2 — Passage anchoring on every excerpt

- [ ] Every evidence excerpt carries a `passage_anchor` object: `{ chapter, scene, percentile_position, page_estimate }`.
- [ ] Anchors are stable across re-runs of the same manuscript (deterministic).
- [ ] Anchors are accurate within ±2% of true position for prose manuscripts.
- [ ] Chapter and scene detection works on standard manuscript formatting (chapter headings, scene breaks).

### Criterion 3 — Causal rationale (Why)

- [ ] Every gap statement includes a `reader_impact` field describing what the gap costs the reader.
- [ ] Reader impact is concrete: "the reader loses motivation to continue at p.47" not "pacing could be tighter."
- [ ] Rationale links evidence → diagnosis → reader effect explicitly.

### Criterion 4 — Arc-position context (When)

- [ ] Every passage anchor includes `arc_position`: `opening | rising_action | midpoint | climax | resolution | denouement` for narrative works, or equivalent structural markers for non-narrative.
- [ ] Pacing-related diagnostics use arc position to contextualize ("the midpoint feels rushed because...").

### Criterion 5 — Concrete revision recommendations (How)

- [ ] Every gap statement includes 1–3 `revision_recommendations` strings.
- [ ] Recommendations are actionable: "consider adding a sensory anchor to ground the reader at p.12" not "improve sense of place."
- [ ] Recommendations reference specific passages where possible.

### Criterion 6 — Prioritized revision queue

- [ ] Output includes a `revision_priorities` array of length 5 (or fewer if fewer gaps exist).
- [ ] Each entry has: `rank`, `criterion`, `gap_summary`, `priority_reasoning`, `effort_estimate`, `impact_estimate`.
- [ ] Priority reasoning is explicit: "ranked first because this gap affects 60% of chapters and the criterion has high reader-impact weight."
- [ ] Ranking is deterministic given the same evidence.

### Criterion 7 — SIPOC diagnostic appendix

- [ ] Output includes a diagnostic appendix surfacing: `chunk_coverage_pct`, `representation_compression_ratio`, `criteria_with_zero_evidence`, `evidence_count_by_criterion`, `compression_governance_state`.
- [ ] Appendix is presented in plain language, not raw telemetry: "the evaluator analyzed 78% of your manuscript directly; 22% was summarized for context."
- [ ] Dark criteria (zero evidence) are flagged prominently with explanation.

### Criterion 8 — End-to-end real manuscript test

- [ ] At least one real long-form manuscript (≥ 25,000 words) has been run through the upgraded pipeline.
- [ ] The output has been hand-evaluated against this spec.
- [ ] Identified shortfalls have been triaged into either: (a) accepted, (b) addressed in the same PR, or (c) opened as follow-up issues.

## Non-goals

What this spec does **not** require:

- ❌ Auto-generated rewrites of manuscript passages.
- ❌ Comparable-author analysis or market positioning beyond `marketability` criterion.
- ❌ Plot or character generation suggestions.
- ❌ Genre-specific frameworks beyond the 13 canonical criteria.
- ❌ Real-time collaborative editing.
- ❌ Visual/illustrative output beyond text.

## Causal position in the system

This spec is the **target** that the following lanes ultimately serve:

- #291 + #404 (canonical source) → ensures the evaluator reads the right text
- #292 + #406 (SIPOC instrument) → measures what the evaluator consumed
- #293 + #411 (governance) → observes representation density health
- #412 + #413 (reliability) → prevents regressions on named failure modes
- #414 + #415 (calibration tooling lock + implementation) → enables Phase 2 lock pathway
- **<future PR — Editorial Output Layer>** → produces the dream output structure
- **<future PR — Passage Anchoring>** → adds chapter/scene/arc-position anchors
- **<future PR — Prioritization Layer>** → adds the revision queue
- **<future PR — Real Manuscript End-to-End Validation>** → proves the dream output is delivered

## Estimated work to delivery

| Lane | Estimated hours | Risk |
|---|---|---|
| Editorial Output Layer (fit/gap framing) | 4–6 | Medium — prompt iteration |
| Passage Anchoring | 3–5 | Medium — format consistency |
| Prioritization Layer | 3–5 | Low–Medium — algorithmic |
| Real Manuscript Validation + refinement | 2–4 | High — first-contact surprises |
| Buffer | 2–3 | — |

**Estimated work to first acceptance candidate: 14–23 focused hours (realistic midpoint ~17).**

## Success signal

The dream output is delivered the moment a real user can:

1. Upload their long-form manuscript.
2. Receive the full output structure described above.
3. Read the prioritized revision queue.
4. Open their manuscript at the top-priority gap's anchor.
5. Begin revising with concrete guidance — without needing to ask the system another question.

That is the moment RevisionGrade transitions from "evaluation tool" to "revision partner."

## Lockability

This spec is **PROPOSED LOCK** as the target definition. Upon merge, it becomes **LOCKED**. Future PRs are measured against it. Changes to the spec require:

- A separate governance PR explaining why the target is shifting.
- Cross-reference to the lane(s) that prompted the shift.
- Approval from owner before merging.

This prevents target drift during implementation.

## Refs

Refs #291, #292, #293, #404, #405, #406, #407, #409, #411, #412, #413, #414, #415, governance/docs-foundation, governance/reliability-hardening-lock, governance/calibration-analysis-tooling-lock
