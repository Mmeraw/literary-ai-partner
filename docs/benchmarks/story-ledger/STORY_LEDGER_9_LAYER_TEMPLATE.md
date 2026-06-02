---
benchmark-schema: ideal-story-ledger-9-layer-v1
title: Story Ledger 9-Layer Template
file-role: format-template
note: >
  This is a BLANK reusable template for the 9-layer Story Ledger.
  It is NOT a completed benchmark. The completed gold-standard examples are in
  IDEAL_STORY_LEDGER_9_LAYER_BENCHMARK_*.md files.
  SEED generators and Phase 1A must populate every layer below.
  Phase 0.5a full-context ledger must match this structure.
created: 2026-06-02T20:00:00Z
---

# Story Ledger 9-Layer Template

> Template purpose: Blank structure that SEED and Phase 1A must populate for every manuscript.
> Authority rule: Seed proposes; Phase 1A verifies against manuscript evidence; Review Gate authorizes; accepted_story_ledger_v1 governs Phase 2.
> Display rule: Never show machine chunk labels to authors. Use chapter, scene, paragraph, page, or quoted evidence anchors.

## Completion Standard

A compliant Story Ledger is incomplete if it misses any primary structural character, any story-bearing object that drives plot/identity/closure, any sustained named relationship, or the ending accountability chain (who is alive, dead, transformed, unresolved).

---

# Layer 1 — Source Integrity

## Required status

One of: `complete_with_confidence` | `complete_with_review_flags` | `degraded_with_caution`

## Required fields

| Field | Fill instruction |
|---|---|
| Scope | `<full manuscript / excerpt / chapter range>` |
| Route | `<LONG_FORM / SHORT_FORM>` |
| Work type | `<novel / novella / short_story / etc>` |
| Evidence distribution required | `<list 5+ manuscript regions that MUST be cited in downstream evidence: opening, middle, late, climax, resolution>` |

## Required review flags

| Risk | Classification |
|---|---|
| `<source risk 1>` | `<correct classification and treatment>` |
| `<source risk 2>` | `<correct classification and treatment>` |

## Mistake-proofing

- Do not claim full-manuscript confidence from partial evidence.
- Do not show internal chunk labels.
- Do not treat package/metadata defects as story defects unless evidence supports it.

---

# Layer 2 — POV Structure

## Required status

One of: `complete_with_confidence` | `complete_with_review_flags` | `degraded_with_caution`

## Required fields

| POV / camera owner | Structural use | Required treatment |
|---|---|---|
| `<character 1>` | `<what they control narratively>` | `<what must be tracked>` |
| `<character 2>` | `<what they control narratively>` | `<what must be tracked>` |
| `<...>` | `<...>` | `<...>` |

## POV failure conditions

- Fails if it says "no POV characters identified" when obvious focal centers exist.
- Fails if it confuses omniscient/mythic narration with absence of POV.
- Fails if it reduces multi-lane narration to generic third person.

---

# Layer 3 — Canonical Identity

## Required status

One of: `complete_with_merge_split_controls` | `complete_with_confidence` | `degraded_with_caution`

## Required fields

| Canonical entity | Type | Identity obligations |
|---|---|---|
| `<entity 1>` | `<named character / force / system>` | `<merge/split risks, alias rules>` |
| `<entity 2>` | `<named character / force / system>` | `<merge/split risks, alias rules>` |
| `<...>` | `<...>` | `<...>` |

## Merge / split risks

`<Describe specific merge/split risks for this manuscript. Missing any primary structural character is a blocker.>`

---

# Layer 4 — Cast / Role Tier

## Required status

One of: `complete_with_structural_weight` | `complete_with_confidence` | `degraded_with_caution`

## Required fields

| Tier | Entities / forces | Role obligation |
|---|---|---|
| Primary structural forces | `<names>` | `<what must be tracked>` |
| Authority / governance | `<names>` | `<what must be tracked>` |
| Vulnerability / emotional counter-logic | `<names>` | `<what must be tracked>` |
| Antagonist / pressure | `<names>` | `<what must be tracked>` |
| Symbolic / systemic forces | `<names>` | `<what must be tracked>` |
| Collective forces | `<names>` | `<what must be tracked>` |

## Role-tier failure conditions

- Fails if primary forces are flattened to generic roles.
- Fails if structural animals/symbols treated as ordinary cast.
- Fails if tier based only on mention count rather than plot function.

---

# Layer 5 — Pronoun Transitions

## Required status

One of: `complete_no_reviewable_transition_unless_evidenced` | `complete_with_confidence` | `valid_empty`

## Required fields

### Reviewable transitions (only if genuinely ambiguous)

`<List any real pronoun-family transitions, cross-family shifts, or identity signals requiring review.>`

### Valid empty state

If no reviewable transitions exist, output:
```
No reviewable pronoun-family transitions detected.
Stable pronoun usage is normalized and hidden from review.
```

## Pronoun failure conditions

- Fails if stable pronoun usage shown as review burden.
- Fails if species terms, titles, royal terms, or symbolic personification treated as pronoun transitions.

---

# Layer 6 — Relationship Network

## Required status

One of: `complete_named_relationships_plus_system_routes` | `complete_with_confidence` | `degraded_with_caution`

## Required fields

| Relationship / system | Function | Beginning / middle / ending obligation |
|---|---|---|
| `<entity A / entity B>` | `<relationship function>` | `<arc from beginning → middle → ending>` |
| `<entity C / entity D>` | `<relationship function>` | `<arc from beginning → middle → ending>` |
| `<...>` | `<...>` | `<...>` |

## Relationship failure conditions

- Fails if benchmark-required relationships missing.
- Fails if named relational arcs collapsed to generic "pressure."
- Groups/institutions/environments appear only as explicitly labeled systems.

---

# Layer 7 — Object / Symbol

## Required status

One of: `complete_with_symbol_lifecycle` | `complete_with_confidence` | `degraded_with_caution`

## Required fields

| Symbol / system | Attached characters / layers | Lifecycle obligation |
|---|---|---|
| `<object 1>` | `<who it's attached to>` | `<how it functions: stationary / mobile / leaching>` |
| `<object 2>` | `<who it's attached to>` | `<how it functions>` |
| `<...>` | `<...>` | `<...>` |

### Contamination model

`<Describe the ACTUAL mechanism of how influence/danger/power spreads in this story. What is fixed, what is mobile, what leaches?>`

## Object failure conditions

- Fails if dialogue classified as object.
- Fails if doctrine treated as physical object.
- Fails if story-bearing objects treated as scenery.
- Do not classify animals as objects.

---

# Layer 8 — Timeline / Location / Worldstate

## Required status

One of: `complete_with_world_rules` | `complete_with_confidence` | `degraded_with_caution`

## Required fields — Timeline

| Phase | Location | Function |
|---|---|---|
| `<narrative phase 1>` | `<where>` | `<what happens>` |
| `<narrative phase 2>` | `<where>` | `<what happens>` |
| `<...>` | `<...>` | `<...>` |

## Required fields — World rules

| Rule | Treatment |
|---|---|
| `<world rule 1>` | `<how the ledger should treat it>` |
| `<world rule 2>` | `<how the ledger should treat it>` |

## Timeline failure conditions

- Fails if full novel collapsed to opening/middle/end only.
- Fails if machine chunk labels used as locations.
- Fails if transit chains with plot/identity/safety meaning are ignored.

---

# Layer 9 — Threat / Pressure / Ending

## Required status

One of: `complete_with_ending_accountability` | `complete_with_confidence` | `degraded_with_caution`

## Required fields — Pressures

| Pressure type | Content |
|---|---|
| `<individual / institutional / environmental / relational / symbolic / biological / social / internal>` | `<what the pressure involves>` |
| `<...>` | `<...>` |

## Required fields — Character end states

| Entity | End state | Terminal? |
|---|---|---|
| `<character 1>` | `<what happens by end>` | `<yes if dead/permanently removed — no post-death arc>` |
| `<character 2>` | `<what happens by end>` | `<yes/no>` |
| `<...>` | `<...>` | `<...>` |

## Threat/ending failure conditions

- Fails if all pressure reduced to one villain.
- Fails if ending treated as mood only.
- Fails if unresolved ending misreported as clean closure.
- Fails if consequences missing from terminal states.
- Include ALL major characters in end states, especially those who DIE.

---

# Validation Contract

## Canonical hard facts

Include 10-20 declarative factual statements about the manuscript. These travel downstream as MANDATORY CONSTRAINTS. Any downstream recommendation that contradicts these is INVALID.

```
<fact 1>
<fact 2>
...
```

## Failure conditions

Include 5-15 specific, falsifiable claims that would indicate comprehension failure. Format: "Fails if [specific incorrect claim]."

```
<failure condition 1>
<failure condition 2>
...
```

## Hard do-not-import

List content from other works, false assumptions, or common AI hallucinations that must NEVER appear.

```
<item 1>
<item 2>
...
```

## Acceptance checks

Include 8-12 verification Q&A pairs. Each question should have exactly one correct answer based on the manuscript.

```
Q: <question>
A: <correct answer>
...
```
