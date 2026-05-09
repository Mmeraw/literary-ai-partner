# RevisionGrade Reliability Doctrine v1

## Purpose

This document defines the reliability kernel for RevisionGrade's governed evaluation system. It exists to prevent reliability drift, architecture ambiguity, silent regression, and semantic dishonesty as the evaluation system evolves.

RevisionGrade is not merely an AI manuscript scoring application. It is a governed narrative evaluation and certification system. Reliability doctrine therefore governs architecture, observability, replay, coverage semantics, provenance, and enforcement together.

## Scope

This doctrine applies to:

- Evaluation architecture
- Quality gate enforcement
- Replay and regression governance
- Coverage semantics and long-form certification
- Failure taxonomy and drift classification
- Provenance and trust graph design
- PR governance for mitigation vs architecture-aligned changes

## Architecture Generations

### V1 — Concatenation-Window Evaluation

**Identity:**

- manuscript chunks persisted to storage
- chunks concatenated into one string
- evaluation operates through prompt-window truncation / compression
- long-form runs may complete while still being sampled or uncertified

**Operational implications:**

- long-form coverage is not guaranteed
- compression artifacts can masquerade as editorial defects
- mitigation logic around repair, clamp, or gate handling may be compensating for substrate starvation

### V2 — Chunk-Grounded Map-Reduce Evaluation

**Identity:**

- chunk-local evidence extraction
- chunk-local criterion analysis
- arbitration / reduction over distributed evidence
- recommendation construction grounded in multi-chunk evidence substrate
- coverage tiers become meaningful certification signals for long-form evaluation

**Operational implications:**

- manuscript-scale cognition becomes architecture-supported
- coverage honesty becomes enforceable
- replay and provenance become more stable and interpretable

## Core Invariants

These invariants are governance anchors. They must not change silently.

1. **Gates remain strict.**
   - Gates go quiet because upstream improves, not because standards weaken.
   - Gate suppression, threshold softening, or semantic weakening requires explicit doctrine versioning.

2. **Coverage is not completion.**
   - A completed run does not imply meaningful manuscript coverage.
   - Coverage tier changes the semantic meaning of the evaluation output.

3. **Replay IDs are constitutional objects.**
   - Canonical replay IDs define behavioral invariants.
   - Breaking a canonical replay is a governance-significant event.

4. **Mitigation is not architecture.**
   - Heuristics, repair shims, and clamp workarounds are debt unless proven architecture-aligned.
   - Every mitigation touching evaluation logic must carry expiry and substrate assumptions.

5. **Evidence must be traceable.**
   - Recommendations must be traceable to evidence anchors, chunk lineage, synthesis path, repair lineage, and gate history.

6. **Failure morphology matters.**
   - High-level error categories alone are insufficient.
   - Morphology must be captured so failure meaning is operationally precise.

## Coverage Semantics and Tiers

Coverage tier is not cosmetic metadata. It changes the operational meaning of the evaluation artifact.

### Required Coverage Metrics

- `manuscript_words_total`
- `words_evaluated_effective`
- `evidence_coverage_pct`
- `criterion_anchor_count`
- `unique_chunk_refs`
- `chunk_distribution_entropy`
- `recommendation_evidence_span`

### Coverage Tiers

| Tier | Meaning |
|---|---|
| `uncertified` | Insufficient substrate for trustworthy global evaluation |
| `sampled` | Partial inference only |
| `partial-long-form` | Substantial but incomplete long-form coverage |
| `certified-long-form` | Trustworthy long-form coverage |

### Required UI / Artifact Semantics

Outputs must expose truthful semantics, e.g.:

- `Evaluation completed (sampled)`
- `Evaluation completed (certified-long-form)`

## Failure Taxonomy and Morphology

Reliability language must distinguish category from morphology.

### Required Structure

- `error_code` = contract family / high-level failure category
- `subcode` = morphology / failure shape

### Example

- `QG_EDITORIAL_GENERIC_FEEDBACK + truncated_mid_word`
- `QG_EDITORIAL_GENERIC_FEEDBACK + compression_degradation`
- `QG_EDITORIAL_GENERIC_FEEDBACK + repair_collapse`

### Taxonomy Rule

Any new `subcode` must ship with:

- at least one fixture
- at least one regression test
- short doctrine note explaining meaning and non-meaning

## Replay and Drift Classes

Replay exists to stabilize evolving behavior and make regressions governable.

### Replay ID Doctrine

Canonical replay IDs are behavioral invariants. They may be used as:

- fixture names
- CI targets
- dashboard anchors
- PR acceptance references
- burn-in targets

Examples:

- `replay_pass3_bc9ee6d4_v1`
- `replay_longform_85k_novel_v1`

### Replay Classes

| Replay Class | Purpose | Allowed Drift |
|---|---|---|
| `certification` | strict certification invariant | none |
| `adversarial` | stress and bounded evolution | formatting / rhetorical only unless otherwise declared |
| `exploratory` | monitored evolution | permissive, but logged |

### Drift Classification

| Drift Type | Severity | Meaning |
|---|---|---|
| `formatting_drift` | low | formatting / layout only |
| `rhetorical_drift` | low/moderate | wording changed, meaning preserved |
| `recommendation_order_drift` | moderate | same recommendation set, different order |
| `evidence_anchor_drift` | high | recommendation grounded on different evidence/chunks |
| `confidence_drift` | high | confidence changed |
| `score_drift` | high | score changed |
| `gate_outcome_drift` | critical | pass/fail outcome changed |

### Replay Governance Rule

Canonical certification replays must not exhibit gate-outcome drift or score drift.

## Provenance / Trust Graph

RevisionGrade recommendations must become explainable recommendation objects.

### Minimum Provenance Chain

- `recommendation_id`
- `criterion_key`
- `evidence_anchors`
- `chunk_ids`
- `synthesis_step_id`
- `repair_step_ids`
- `gate_checks`
- `coverage_snapshot`
- `replay_ids`

This provenance chain becomes the trust graph for evaluation recommendations.

## PR Governance and Architectural Debt

Doctrine must influence engineering decisions through lightweight mandatory hooks.

### Required PR Metadata Block

```text
## Architecture Alignment
- alignment: pre-#384 mitigation | post-#384 architecture-aligned
- mitigation_expiry:
- dependent_architecture:
- expected_revisit: yes | no
- replay_ids_at_risk:
- replay_ids_targeted:
```

### Semantics

- `pre-#384 mitigation` means the change is compensating for V1 substrate limitations.
- `post-#384 architecture-aligned` means the change assumes chunk-grounded map-reduce substrate.
- `mitigation_expiry` prevents heuristic fossilization.
- `dependent_architecture` identifies substrate assumptions.
- `replay_ids_at_risk` makes regression blast radius explicit.

## Transition Criteria for Post-#384 State

Merging #384 does not automatically mean V2 is operational.

The system may only be considered operationally post-#384 when all required transition criteria are satisfied.

### Required Conditions

- long-form certification lane reaches `evidence_coverage_pct >= 75%`
- `unique_chunk_refs` show distributed manuscript coverage
- `QG_EDITORIAL_TRUNCATED` recurrence is zero across defined burn-in window
- comparison packet / arbitration centralization remains below defined threshold
- canonical replay suite is stable within declared drift policy
- coverage tiers are exposed truthfully in artifacts and UI

## Reliability Maturity Levels

| Level | Description |
|---|---|
| R0 | ad hoc debugging |
| R1 | observable failures |
| R2 | taxonomy + replay |
| R3 | deterministic replay governance |
| R4 | coverage-certified evaluation |
| R5 | provenance-backed certification |

### Current Framing

RevisionGrade appears to be moving from R1 toward R2/R3.
Issue #384 is the architectural gateway toward R4.
Provenance-backed certification enables R5.

## Immediate Operationalization Order

1. Doctrine v1 document lands in repo.
2. PR metadata hooks become mandatory for evaluation-affecting PRs.
3. Replay ID schema is introduced.
4. Pre/post-clamp instrumentation lands.
5. Coverage tier persistence is added.
6. Canonical replay suite and drift classification are established.
7. Dashboard and artifact surfaces expose taxonomy + coverage semantics.
8. Post-#384 architecture work proceeds against this doctrine.

## Closing Doctrine

Failures are not embarrassments. They are architectural signals.

RevisionGrade reliability improves when failures become:

- observable
- classifiable
- replayable
- substrate-aware
- morphologically meaningful
- provenance-linked
- non-regressive over time

This doctrine exists to make those properties operational rather than aspirational.
