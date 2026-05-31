# RevisionGrade Fail-Closed Rules

Status: canonical warmup packet v1  
Purpose: define the product-wide fail-closed doctrine for evaluation, Story Ledger, Review Gate, Revise, and downstream handoffs.

## Core doctrine

RevisionGrade must not convert uncertainty into authority.

When required evidence, artifacts, validations, or benchmark minimums are missing, the system must block, retry, degrade with proof, suppress, or create a fit-gap report. It must not present incomplete or malformed output as valid author-facing truth.

## Allowed failure responses

```text
block
retry
regenerate
suppress
degrade_with_caution
create_fit_gap_report
route_to_needs_targeting
manual_review_required
```

## Prohibited failure response

```text
render_as_if_valid
```

---

# Phase 0 fail-closed rules

## Rule

Phase 0 must load only compact canonical warmup files and benchmark references.

## Fail closed when

- Required warmup packet missing.
- Benchmark manifest cannot be resolved.
- Required phase-specific governance docs unavailable.
- Runtime attempts to mine PR history instead of loading canonical docs.

## Runtime consequence

Block seed generation or continue only with explicitly degraded warmup status, never silent fallback to stale/default doctrine.

---

# SEED fail-closed rules

## Rule

Both required seeds must be complete:

```text
story_seed_v1
evaluation_seed_v1
```

## Fail closed when

- Either seed is missing.
- Either seed is malformed.
- Story seed lacks all nine layer scaffolds.
- Story seed lacks candidate input collections.
- Evaluation seed lacks manuscript profile.
- Evaluation seed lacks short/long/multilayer template routing.
- Evaluation seed lacks all 13 criterion scaffolds.
- Seed includes final scores, final verdict, final canon IDs, or final layer truth.

## Runtime consequence

Create:

```text
seed_fit_gap_report_v1
```

Block with:

```text
SEED_FIT_GAP_BLOCKED
```

Do not start Phase 1A.

---

# Phase 1A Story Ledger fail-closed rules

## Rule

Phase 1A must use SEED as baseline scaffold and verify against manuscript evidence.

## Fail closed when

- Manuscript text unavailable.
- Source scope unresolved.
- Required governing layer cannot be built.
- Layer output is malformed.
- Benchmark-required governing entities or systems are missing.
- Layer emits machine locators as author-facing evidence.
- Layer claims validity without evidence anchors.

## Runtime consequence

Create or update:

```text
ledger_quality_report_v1
```

Layer status must be one of:

```text
valid
degraded_with_caution
suppressed_insufficient_evidence
suppressed_conflicting_signals
failed_benchmark_minimum
```

Do not render failed layers as author-approvable truth.

---

# Review Gate fail-closed rules

## Rule

Review Gate opens only when the Story Ledger is valid, safely degraded with proof, or safely suppressed with explanation.

## Fail closed when

- ledger_quality_report_v1 missing.
- A required governing layer has failed_benchmark_minimum.
- A layer has raw malformed content.
- A layer includes unresolved identity blockers that contaminate dependent layers.
- Review payload uses invalid status vocabulary.
- Required comments are missing for comment/reject states.

## Runtime consequence

Do not create accepted_story_ledger_v1.
Do not start Phase 2.
Show controlled author-safe explanation or require regeneration.

---

# accepted_story_ledger_v1 fail-closed rules

## Rule

accepted_story_ledger_v1 is the governing story artifact for Phase 2.

## Fail closed when

- Artifact missing.
- Artifact malformed.
- Artifact lacks normalized layer decisions.
- Artifact lacks expected job/manuscript binding.
- Artifact was derived from unapproved failed layers.

## Runtime consequence

Phase 2 must refuse to start.

---

# Phase 2 evaluation fail-closed rules

## Rule

Phase 2 must evaluate craft against accepted story authority, not raw seed or dirty extraction.

## Fail closed when

- accepted_story_ledger_v1 missing.
- pass12_handoff_v1 missing when required.
- Required benchmark context unavailable.
- Evaluation route unknown: short-form, long-form, or long-form multi-layer.
- Evidence anchors missing for criterion claims.

## Runtime consequence

Block Phase 2 or mark job failed/degraded with explicit reason.

---

# Revise / Revise Queue fail-closed rules

## Rule

Revise must consume evidence-anchored revision_opportunity_ledger_v1. It must not re-diagnose the manuscript as a separate evaluation.

## Fail closed when

- revision_opportunity_ledger_v1 missing.
- Opportunity lacks exact anchor.
- Operation type is unknown.
- candidate_text is missing where required.
- candidate_text contains meta-commentary rather than manuscript content.
- Opportunity has no manuscript_id/job_id binding.
- Opportunity is vague advice rather than surgical operation.

## Runtime consequence

Do not place item in Revise Queue.
Route to:

```text
Needs Targeting
```

or suppress until regenerated.

---

# TrustedPath fail-closed rules

## Rule

TrustedPath may apply recommended Option A only from trusted, ledger-backed, evidence-anchored revision opportunities.

## Fail closed when

- Opportunity is not from revision_opportunity_ledger_v1.
- Option A is missing or malformed.
- Anchor missing.
- Operation type unknown.
- No rollback/versioning path exists.

## Runtime consequence

Do not auto-apply. Require manual Revise Queue or regeneration.

---

# Author-facing display fail-closed rules

## Rule

The author must never see internal machine implementation details as if they are manuscript location or editorial evidence.

## Fail closed when author-facing output contains

- chunk IDs
- raw internal artifact IDs as evidence
- unparsed JSON
- stack traces
- model prompt fragments
- unnormalized internal status vocabulary
- unsupported machine coordinates without manuscript-native display location

## Runtime consequence

Block render or sanitize before display.

---

# Runtime hierarchy

```text
Missing required input → block or fit-gap
Malformed artifact → block
Unverified seed truth → verify before authority
Dirty layer → suppress/degrade/block
Failed benchmark minimum → do not open Review Gate
No accepted ledger → do not start Phase 2
No anchor → no Revise opportunity
No rollback → no TrustedPath auto-apply
```

## Product trust sentence

RevisionGrade may be uncertain. It may be incomplete. It may ask for regeneration. It may suppress a layer. It may block a phase. It must never pretend uncertain or malformed output is valid author-facing truth.
