# Editorial Output Layer Governance Brief

**Status**: PROPOSED LOCK — becomes LOCKED when merged
**Visibility**: [PROTECTED]
**Scope**: Criterion 1 from DREAM_OUTPUT_SPEC — fit/gap framing per canonical criterion
**Hard dependency**: Translation layer runtime implementation (must be merged before implementation begins)
**Owner**: Mmeraw
**Created**: 2026-05-10
**References**: DREAM_OUTPUT_SPEC.md (#416), EVALUATION_HANDOFF_SUCCESS_SPEC.md (#416), TRANSLATION_LAYER_GOVERNANCE_BRIEF.md (#417)

---

## Document Visibility Classification

This document is classified [PROTECTED]. It specifies the implementation
contract for the editorial output layer — the first user-visible evaluation
quality improvement.

[PUBLIC] The user-facing output (fit/gap statements, evidence anchors,
editorial prose) is public.

[PROTECTED] The synthesis mechanics, prompt structure, sanitization
boundary, and quality gate internals are protected.

---

## Inheritance

This brief inherits and applies the following locked doctrine without
re-deriving any of it:

- DREAM_OUTPUT_SPEC.md Criterion 1 (#416)
- Translation layer governance brief (#417)
- Disclosure-audit cycle and asymmetric disclosure principle (#418)
- Boundary integrity doctrine (#419)
- Governance-before-implementation pattern (codified)

The translation layer runtime implementation is a hard dependency. This
brief's implementation PR must not merge before the translation layer
implementation has merged. Fit/gap output is user-facing prose and must
pass through `sanitizeForPublic()` before persistence.

---

## Purpose

The editorial output layer is the first lane that produces user-visible
evaluation quality improvement. It implements Criterion 1 from the
DREAM_OUTPUT_SPEC: every long-form evaluation produces a `fit` field and
a `gap` field for each of the 13 canonical criteria.

The user receives: actionable editorial prose telling them what their
manuscript does well and where it falls short, anchored to specific
evidence from their text, for every criterion — without exposure to any
internal system mechanics.

---

## Schema Extension (additive)

Each criterion in EvaluationResultV2 gains four new fields:

- `fit: string | null` — what the manuscript IS doing well on this
  criterion. Null only if the criterion is non-scorable.
- `gap: string | null` — what the manuscript is FALLING SHORT on.
  Null only if the criterion is non-scorable.
- `fit_evidence: Evidence[]` — anchored excerpts supporting the fit
  statement.
- `gap_evidence: Evidence[]` — anchored excerpts supporting the gap
  statement.

The extension is additive. Existing consumers that do not read `fit`/`gap`
are unaffected. No existing fields are modified or removed.

---

## Synthesis Prompt Contract

The synthesis stage currently produces convergence judgments per criterion.
The editorial output layer extends the synthesis prompt to additionally
produce structured `fit` and `gap` fields.

The prompt contract specifies:

- For each SCORABLE criterion, produce both a `fit` statement and a
  `gap` statement.
- Both statements must be ≥30 words of editorially actionable prose.
- Both statements must reference at least one specific evidence anchor
  from the manuscript.
- Fit and gap are mutually distinct: a criterion can be partially fit
  and partially gap. The system articulates both sides.

---

## Hard Constraints (binding)

### 1. Fit/Gap Independence Constraint

`fit` cannot merely restate the score rationale in positive framing.
`gap` cannot merely restate the score rationale in negative framing.
Both must contain editorially actionable prose that is substantively
distinct from the numeric justification already present in the criterion's
`rationale` field.

The quality gate must verify that `fit` and `gap` text does not exceed
a similarity threshold with the existing `rationale` text for the same
criterion. Mechanical restatement is a gate failure.

### 2. Evidence Anchoring Constraint

Every `fit` statement must trace to at least one explicit evidence anchor
in `fit_evidence`. Every `gap` statement must trace to at least one
explicit evidence anchor in `gap_evidence`. No free-floating generalized
claims are permitted.

Evidence objects must survive into persisted artifacts. If evidence is
present at synthesis time but absent in the persisted result, the quality
gate fails.

### 3. Anti-Template Constraint

Repetitive rhetorical stems across criteria are prohibited. The system
must not produce fit/gap statements that begin with identical or
near-identical sentence openings across multiple criteria.

The quality gate must verify cross-criterion template divergence and
cross-criterion semantic distinctness:
- no two criteria may share opening sentence structure within the same
  evaluation run
- no repeated causal framing skeletons across criteria
- no repeated recommendation skeletons across criteria

This constraint explicitly inherits lessons from
QG_EDITORIAL_GENERIC_FEEDBACK failures previously debugged in synthesis-stage outputs.
Generic craft language constitutes a gate failure.

### 4. Persistence Boundary Constraint

Raw unsanitized fit/gap text must never persist after synthesis
finalization. Only sanitized forms may enter EvaluationResultV2 artifacts.

No "sanitize later" fallback path is permitted.

### 5. Criterion Symmetry Constraint

For every SCORABLE criterion:
- `fit` and `gap` must both exist
- `fit` and `gap` must both contain evidence anchors
- `fit` and `gap` must both survive sanitization
- `fit` and `gap` must both pass lexical-diversity thresholds independently

Asymmetric commentary is a gate failure.

### 6. Sanitization Ordering Contract

Ordering is locked as:
1. Synthesis stage generates raw editorial output
2. Evidence anchoring attaches
3. `sanitizeForPublic()` runs
4. Sanitized artifact persists
5. Downstream consumers read sanitized artifact only

Disallowed orderings:
- sanitize before evidence attachment
- sanitize lazily at render time
- dual raw/sanitized persistence

### 7. Evidence–Prose Alignment Constraint

Evidence anchors must semantically support the fit/gap prose.
Mechanical evidence attachment with weak relevance is a gate failure.

---

## Quality Gate Extension

The existing quality gate must be extended with fit/gap-specific checks.
For every SCORABLE criterion:

**Structural checks:**
- fit is non-null and ≥30 words
- gap is non-null and ≥30 words
- fit_evidence contains ≥1 evidence anchor
- gap_evidence contains ≥1 evidence anchor

**Quality checks (beyond structural):**
- Lexical diversity minimum: fit/gap text must exceed a minimum
  unique-word ratio
- Evidence-anchor presence and non-empty snippet fields
- Cross-criterion template divergence
- Cross-criterion semantic distinctness
- Fit/gap independence from rationale field
- Evidence–prose semantic alignment threshold

**Failure behavior:**
- Structural check failure: INVALID; fit/gap fields set to null; governance warning emitted
- Quality check failure tiers:
  - INVALID tier: cross-criterion template collapse above threshold,
    rationale similarity above threshold, or evidence–prose alignment failure
  - WARNING tier: mild lexical diversity degradation, with confidence reduction

---

## Additional Audit Extensions

### Prompt Leakage Audit

Verify no internal gate names, governance identifiers, or protected
enforcement terminology can surface inside:
- `fit`
- `gap`
- evidence snippets
- governance warnings

### Evidence Sanitization Audit

Verify:
- evidence snippets pass through sanitization
- anchor metadata does not expose internal scoring/runtime mechanics
- evidence objects preserve editorial meaning after sanitization

### Null-Fallback Consistency Audit

If translation runtime fails:
- `fit`/`gap` null consistently
- evidence arrays null/empty consistently
- no partial persistence states
- no mixed sanitized/unsanitized artifact states

---

## Sanitization Boundary

Fit/gap sanitization occurs at persistence, not at rendering.

`sanitizeForPublic()` is called inside `synthesisToEvaluationResult()`
on every fit and gap string before persistence.

This ensures:
- persisted EvaluationResultV2 artifact contains only sanitized text
- downstream consumers (report page, export serializer, API response,
  Revise queue, analytics, TRUSTPATH surfaces) read already-safe prose
- no downstream consumer needs to call `sanitizeForPublic()` again
- if translation layer is unavailable, fit/gap fields are set to null
  (fail-closed)

---

## Acceptance Criteria

The implementation PR is accepted only when ALL are true:

1. Additive schema extension: `fit`, `gap`, `fit_evidence`, `gap_evidence`
2. Synthesis prompt produces fit/gap for every SCORABLE criterion
3. Fit/gap independence enforced
4. Evidence anchoring enforced
5. Anti-template and semantic distinctness enforced
6. Persistence boundary and ordering contract enforced
7. Quality gate extended with structural + quality checks
8. Lexical diversity minimum enforced independently for fit and gap
9. Evidence–prose alignment enforced
10. Existing evaluation behavior unchanged for consumers not reading fit/gap
11. Translation layer dependency satisfied before merge
12. Disclosure audit passes (no protected leakage)
13. CI Guard passes on implementation PR

---

## Scope (out)

This brief explicitly does not cover:

- Passage anchoring with chapter/scene/arc-position metadata (Criterion 2)
- Prioritized revision queue (Criterion 6)
- WAVE assignment per gap (Criterion 7)
- UI rendering of fit/gap beyond basic display
- Real manuscript end-to-end validation (Criterion 8)
- Export format changes beyond including fit/gap in existing structures

---

## Non-Goals

- No prompt redesign beyond adding fit/gap output fields
- No scoring methodology changes
- No new evaluation passes
- No WAVE integration
- No UI/UX redesign
- No passage anchoring lane implementation

---

## Refs

Refs #416, #417, #418, #419, #420, #421, #422, #423, #424, #425, #426,
#427, #428, #429, #430, #431, #432, #433, #434
