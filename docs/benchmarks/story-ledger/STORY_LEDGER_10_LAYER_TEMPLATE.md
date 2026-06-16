---
benchmark-schema: ideal-story-ledger-10-layer-v1
title: Story Ledger 10-Layer Template
file-role: format-template
note: >
  This is a BLANK reusable template for the 10-layer Story Ledger.
  It is NOT a completed benchmark. The completed gold-standard examples are in
  IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_*.md files.
  SEED generators and Phase 1A must populate every layer below.
  Phase 0.5a full-context ledger must match this structure.
  Calibrated against: Froggin Noggin, Cartel Babies, Let the River Decide
  benchmarks plus public-domain corpus (Dracula, Great Expectations,
  Pride and Prejudice, The Awakening, Jekyll & Hyde, etc.).
created: 2026-06-02T20:00:00Z
revised: 2026-05-28T07:00:00Z
---

# Story Ledger 10-Layer Template

> Template purpose: Blank structure that SEED and Phase 1A must populate for every manuscript.
> Authority rule: Seed proposes; Phase 1A verifies against manuscript evidence; Review Gate authorizes; accepted_story_ledger_v1 governs Phase 2.
> Display rule: Never show machine chunk labels to authors. Use chapter, scene, paragraph, page, or quoted evidence anchors.
> Scope rule: Long-form manuscripts (>=25k words) require full population of all layers and all sub-tables. Short-form manuscripts (<25k words) still require all 10 layers but may have fewer rows per table where the manuscript genuinely has less structural complexity. Do not fabricate complexity that does not exist.

## Completion Standard

A compliant Story Ledger is incomplete if it misses:

- Any primary structural character (protagonist, antagonist, or force that drives more than one plot thread)
- Any story-bearing object that drives plot, identity, or closure
- Any sustained named relationship (one that spans more than a single scene)
- The ending accountability chain (who is alive, dead, transformed, unresolved)
- The contamination / influence model (how danger, power, or consequence spreads)
- Transit geography if the manuscript moves between locations with plot meaning

A ledger that covers only the first third of the manuscript is automatically `degraded_with_caution`.

## Layer Health Status Hierarchy

All layers report a status. Statuses in order of quality:

1. `complete_with_confidence` — fully populated, evidence-backed, no known gaps
2. `complete_with_review_flags` — fully populated but flagged risks require human verification
3. `complete_with_merge_split_controls` — fully populated, identity risks documented (Layer 3)
4. `complete_with_structural_weight` — fully populated, tier weights justified by plot function (Layer 4)
5. `degraded_with_caution` — partial population; gaps are known and documented
6. `suppressed_insufficient_evidence` — layer cannot be populated due to insufficient manuscript evidence
7. `suppressed_conflicting_signals` — evidence exists but contradicts itself; suppressed until resolved
8. `failed_benchmark_minimum` — layer attempted but cannot meet minimum structural requirements
9. `valid_empty` — layer correctly has no content (e.g., pronoun transitions when none exist)

GOLDEN RULE: If a layer cannot meet benchmark minimums, mark it degraded or suppressed — do NOT fabricate content.

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
| Word count | `<approximate word count>` |
| Reading Grade Level | `<X.X>` (Flesch-Kincaid — computed algorithmically, no LLM required) |
| Dialogue/Narrative Ratio | `<XX>%` dialogue / `<XX>%` narrative (computed algorithmically) |
| Premise | `<1–2 sentence elevator pitch: protagonist, conflict, tonal register>` |
| Trigger Warnings | `<bulleted content categories requiring reader advisories, or "None identified">` |
| Evidence distribution required | `<list 5+ manuscript regions that MUST be cited in downstream evidence: opening, early-middle, mid-point, late-middle, climax, resolution>` |

Evidence distribution example (long-form): Opening setup (Ch 1-3), early escalation (Ch 4-8), mid-point pivot (Ch 12-15), late escalation (Ch 20-25), climax/resolution (final chapters).

Evidence distribution example (short-form): Opening (first 20%), rising action (20-50%), turning point (50-65%), climax (65-85%), resolution (85-100%).

## Required review flags

| Risk | Classification | Treatment |
|---|---|---|
| `<source risk 1>` | `<craft/structure / copy defect / intentional device / market risk>` | `<how downstream should handle it>` |
| `<source risk 2>` | `<classification>` | `<treatment>` |

Classification guidance: Distinguish between true story defects, intentional formal devices (e.g., epistolary structure, unreliable narrator, experimental typography), TOC/metadata artifacts, and content risks (e.g., adult material, sensitive topics). Do not treat intentional craft choices as defects.

## Mistake-proofing

- Do not claim full-manuscript confidence from partial evidence.
- Do not show internal chunk labels (chunk_0, chunk_12, etc.) — use chapter/scene/page references.
- Do not treat package/metadata defects as story defects unless evidence supports it.
- Do not confuse intentional formal systems (epistolary, paratext, epigraphs, experimental structure) with extraction corruption.

---

# Layer 2 — POV Structure

## Required status

One of: `complete_with_confidence` | `complete_with_review_flags` | `degraded_with_caution`

## Required fields

| POV / camera owner | Structural use | Required treatment |
|---|---|---|
| `<character 1>` | `<what they control narratively: scenes, chapters, voice, perspective>` | `<what must be tracked downstream>` |
| `<character 2>` | `<what they control narratively>` | `<what must be tracked>` |
| `<...>` | `<...>` | `<...>` |

Long-form target: 3-8 named POV/camera owners with structural function descriptions.
Short-form target: 1-3 named POV/camera owners.

### Narrative strategy note

`<Describe the manuscript's overall POV strategy: first-person singular, close third rotating, omniscient with focal centers, multi-document epistolary, unreliable narrator, etc. This is NOT a list of characters but a description of how the manuscript handles narrative perspective.>`

## POV failure conditions

- Fails if it says "no POV characters identified" when obvious focal centers exist.
- Fails if it confuses omniscient/mythic narration with absence of POV.
- Fails if it reduces multi-lane narration to generic "third person."
- Fails if it confuses role importance (protagonist) with focalization (whose eyes we see through).
- Fails if epistolary/multi-document narration is collapsed into a single narrator.

---

# Layer 3 — Narrator Attribution

## Required status

One of: `complete_with_confidence` | `complete_with_review_flags` | `unknown_narrator_identity`

## Required fields

| Field | Fill instruction |
|---|---|
| Narrator label | `<confirmed narrator name OR "the narrator" OR "the unnamed narrator">` |
| Narrator confidence | `<confirmed / inferred / unknown>` |
| Allowed report references | `<safe phrases downstream reports may use>` |
| Blocked false names | `<terms that must never be treated as narrator names>` |
| Evidence anchors | `<specific manuscript evidence if narrator identity is confirmed or constrained>` |
| Attribution note | `<why the narrator label is supported, or why identity remains unknown>` |

If no explicit narrator identity is confirmed, output `the unnamed narrator` and set confidence to `unknown`.

## Narrator attribution failure conditions

- Fails if narrator identity is inferred from theme, motif, object, expense/cost language, prices, vanity language, yes/no tokens, greetings, or section titles.
- Fails if dialogue fragments, common English words, or blocked non-person tokens are treated as narrator names.
- Fails if downstream-safe report references are omitted.
- Fails if an unnamed narrator is upgraded to a named identity without explicit manuscript evidence.

---

# Layer 4 — Canonical Identity

## Required status

One of: `complete_with_merge_split_controls` | `complete_with_confidence` | `degraded_with_caution`

## Required fields

| Canonical entity | Type | Identity obligations | Must-not-omit? |
|---|---|---|---|
| `<entity 1>` | `<named character / force / system / deity / institution>` | `<merge/split risks, alias rules, title vs name distinctions>` | `<yes/no — yes if downstream phases MUST track this entity>` |
| `<entity 2>` | `<type>` | `<obligations>` | `<yes/no>` |
| `<...>` | `<...>` | `<...>` | `<...>` |

Long-form target: 8-15 primary entities with identity obligations.
Short-form target: 3-8 primary entities.

## Merge / split risks

`<Describe specific merge/split risks for this manuscript.>`

Common merge/split errors to watch for:
- Titles/honorifics split into separate characters (e.g., "The Queen" and "Hyla" are the same person)
- Species labels or group terms treated as individual characters
- Distinct characters with similar names merged into one
- Nicknames, aliases, or renamed characters tracked as separate people
- Deity/doctrine concepts forced into literal character slots
- Collective forces (mobs, institutions, species groups) misclassified as individual cast

Missing any primary structural character is a blocker.

---

# Layer 5 — Cast / Role Tier

## Required status

One of: `complete_with_structural_weight` | `complete_with_confidence` | `degraded_with_caution`

## Required fields

| Tier | Entities / forces | Role obligation |
|---|---|---|
| Primary structural forces | `<names — characters/forces that drive the main plot>` | `<what must be tracked: arcs, conflicts, transformations>` |
| Authority / governance | `<names — characters/systems that hold or contest power>` | `<what must be tracked: power dynamics, doctrine, control>` |
| Vulnerability / emotional counter-logic | `<names — characters that carry tenderness, conscience, or moral alternatives>` | `<what must be tracked: emotional arcs, care relationships>` |
| Antagonist / pressure | `<names — characters/forces that create opposition>` | `<what must be tracked: nature of opposition, escalation>` |
| Symbolic / systemic forces | `<names — objects, doctrines, environments that function as story forces>` | `<what must be tracked: lifecycle, contamination, payoff>` |
| Collective forces | `<names — groups, institutions, species, polities, social systems>` | `<what must be tracked: group dynamics, mirror functions>` |
| Animal / sensory layer | `<names — animals or sensory systems with structural function, if present>` | `<what must be tracked: detection, emotional register, symbolic function>` |

Tier assignment guidance: Base tier on PLOT FUNCTION and STRUCTURAL WEIGHT, not on mention count or page time. A character who appears in 3 scenes but drives the climax outranks a character mentioned on every page with no plot function.

## Role-tier failure conditions

- Fails if primary forces are flattened to generic roles (e.g., "protagonist," "antagonist" without structural specificity).
- Fails if structural animals/symbols treated as ordinary cast or scenery.
- Fails if tier based only on mention count rather than plot function.
- Fails if collective forces (mobs, polities, institutions) misclassified as individual cast.
- Fails if a character serving multiple structural functions is flattened to one role.

---

# Layer 6 — Pronoun Transitions

## Required status

One of: `complete_no_reviewable_transition_unless_evidenced` | `complete_with_confidence` | `valid_empty`

## Required fields

### Reviewable transitions (only if genuinely ambiguous)

`<List any real pronoun-family transitions, cross-family shifts, or identity signals requiring review. Include: the entity, the transition, the evidence location, and what review is needed.>`

### Valid empty state

If no reviewable transitions exist, output:
```
No reviewable pronoun-family transitions detected.
Stable pronoun usage is normalized and hidden from review.
```

## Pronoun failure conditions

- Fails if stable pronoun usage shown as review burden.
- Fails if species terms, titles, royal terms, or symbolic personification treated as pronoun transitions.
- Fails if identity name changes (e.g., Paolito → Paul) are treated as pronoun transitions instead of identity/renaming events (those belong in Layer 4).

---

# Layer 7 — Relationship Network

## Required status

One of: `complete_named_relationships_plus_system_routes` | `complete_with_confidence` | `degraded_with_caution`

## Required fields — Named relationships

| Relationship | Function | Beginning → middle → ending obligation |
|---|---|---|
| `<entity A / entity B>` | `<relationship function: love, authority, mentorship, captive-captor, etc.>` | `<arc from beginning → middle → ending>` |
| `<entity C / entity D>` | `<relationship function>` | `<arc>` |
| `<...>` | `<...>` | `<...>` |

Long-form target: 5-10 named sustained relationships with full arcs.
Short-form target: 2-5 named sustained relationships.

## Required fields — System / mirror relationships

| System relationship | Function | Treatment |
|---|---|---|
| `<system A / system B>` | `<how these systems mirror, contrast, or pressure each other>` | `<what must be tracked>` |
| `<...>` | `<...>` | `<...>` |

System relationships are NOT between individual characters but between groups, institutions, environments, or structural forces that mirror or pressure each other across the narrative (e.g., "frog polity / human damage" as mirror systems, "church / family" as competing authority systems).

## Relationship failure conditions

- Fails if benchmark-required relationships missing.
- Fails if named relational arcs collapsed to generic "pressure."
- Fails if system/mirror relationships are omitted when the manuscript has parallel social structures.
- Groups, institutions, and environments appear only as explicitly labeled systems — do not force them into individual relationship slots.
- Fails if triads or multi-party relationship structures are flattened into pairwise-only entries when the triad has its own structural function.

---

# Layer 8 — Object / Symbol

## Required status

One of: `complete_with_symbol_lifecycle` | `complete_with_confidence` | `degraded_with_caution`

## Required fields

| Symbol / system | Type | Attached characters / layers | Lifecycle obligation |
|---|---|---|---|
| `<object 1>` | `<physical / symbolic / identity-document / coercive-system / environmental / ritual>` | `<who it's attached to>` | `<how it functions: stationary / mobile / leaching / transferred / destroyed>` |
| `<object 2>` | `<type>` | `<who it's attached to>` | `<lifecycle>` |
| `<...>` | `<...>` | `<...>` | `<...>` |

Long-form target: 4-8 story-bearing objects/symbols with lifecycle documentation.
Short-form target: 2-4 story-bearing objects/symbols.

Object type guidance:
- **Physical objects**: tangible items that move through the story (shard, charm, weapon, key)
- **Symbolic systems**: concepts or doctrines that function as story forces (theology, contamination logic)
- **Identity documents**: papers, legal instruments, names that drive identity/safety payoff (passports, renamed identities)
- **Coercive systems**: punishment codes, surveillance mechanisms, disposal/terror infrastructure
- **Environmental systems**: locations or ecological systems that function as story forces (river, mine, disease vector)
- **Ritual / sensory systems**: music, sound, ceremony, or bodily experience with structural narrative function

### Contamination model

`<Describe the ACTUAL mechanism of how influence, danger, power, or consequence spreads in this story. What is fixed? What is mobile? What leaches? What transfers between characters? How does the contamination/influence system resolve or fail to resolve by the ending?>`

## Object failure conditions

- Fails if dialogue classified as object.
- Fails if doctrine/theology treated as physical object (it is a symbolic system).
- Fails if story-bearing objects treated as scenery or background.
- Do not classify animals as objects (they belong in Layer 4 animal/sensory tier).
- Fails if identity/legal/document objects are treated as mere props when they drive safety, identity, or closure payoff.
- Fails if coercive/punishment systems are missed when they function as structural pressure infrastructure.
- Separate physical object, symbolic system, belief holder, and motif — do not collapse distinct types.

---

# Layer 9 — Timeline / Location / Worldstate

## Required status

One of: `complete_with_world_rules` | `complete_with_confidence` | `degraded_with_caution`

## Required fields — Timeline

| Phase | Location | Function |
|---|---|---|
| `<narrative phase 1>` | `<where — use place names, not chunk IDs>` | `<what happens and why it matters structurally>` |
| `<narrative phase 2>` | `<where>` | `<what happens>` |
| `<...>` | `<...>` | `<...>` |

Long-form target: 5-8 narrative phases with distinct locations and functions.
Short-form target: 3-5 narrative phases.

### Transit chain (if applicable)

`<If the manuscript moves characters between locations with plot meaning, document the transit chain. Format: Location A → Location B → Location C, with the plot/identity/safety meaning of each transition.>`

Transit chains matter when movement between locations drives plot, identity transformation, or safety logic (e.g., captivity → transit → embassy → new home; castle → London → pursuit → resolution).

## Required fields — World rules

| Rule | Treatment |
|---|---|
| `<world rule 1: supernatural, social, biological, economic, or environmental law>` | `<how the ledger should treat it: verify consistency, track violations, flag contradictions>` |
| `<world rule 2>` | `<treatment>` |

World rules are the internal logic systems of the manuscript — supernatural mechanics, social hierarchies, biological constraints, economic systems, or environmental laws that govern character behavior and plot possibility. Document them so downstream phases can verify consistency.

## Timeline failure conditions

- Fails if full novel collapsed to opening/middle/end only (minimum 5 phases for long-form).
- Fails if machine chunk labels used as locations.
- Fails if transit chains with plot/identity/safety meaning are ignored.
- Fails if locations are listed without their structural function.
- Fails if world rules that constrain action (e.g., vampire thresholds, cartel hierarchy, river agency) are omitted.

---

# Layer 10 — Threat / Pressure / Ending

## Required status

One of: `complete_with_ending_accountability` | `complete_with_confidence` | `degraded_with_caution`

## Required fields — Pressures

| Pressure type | Content |
|---|---|
| Individual antagonist | `<named antagonists and what they pressure>` |
| Institutional / governance | `<power systems, hierarchies, authorities, doctrine>` |
| Environmental / biological | `<disease, ecology, bodily constraints, natural forces>` |
| Relational | `<love, loyalty, betrayal, family obligation, conscience>` |
| Symbolic / metaphysical | `<theological, mythic, moral-frame pressures>` |
| Internal / psychological | `<guilt, trauma, identity crisis, moral conflict>` |
| Social / collective | `<mob, community, class, prejudice, social machinery>` |
| Coercive / physical | `<captivity, violence, punishment, surveillance, disposal>` |
| `<additional manuscript-specific pressure types>` | `<content>` |

Long-form target: 6-15 distinct pressure types, each with named content.
Short-form target: 3-6 distinct pressure types.

Do not collapse all pressure into a single villain or force. Most manuscripts have at least 4 distinct pressure categories operating simultaneously.

## Required fields — Character end states

| Entity | End state | Terminal? |
|---|---|---|
| `<character 1>` | `<what happens by end: alive/dead/transformed/unresolved/exiled/redeemed/etc.>` | `<yes if dead/permanently removed with no post-death arc — no if alive, transformed, or ambiguous>` |
| `<character 2>` | `<end state>` | `<yes/no>` |
| `<...>` | `<...>` | `<...>` |

Include ALL major characters in end states. Every character in Layer 5 primary/authority/vulnerability tiers MUST have an end state entry. Do not omit characters who die — their death and its consequences are critical accountability data.

## Required fields — Closure ledger

`<For each major story-bearing object, relationship, and pressure system, document whether it reaches payoff, is left unresolved, or is deliberately ambiguous. This is the ending accountability chain.>`

## Threat/ending failure conditions

- Fails if all pressure reduced to one villain.
- Fails if ending treated as mood only ("bittersweet," "hopeful") without structural accountability.
- Fails if unresolved ending misreported as clean closure.
- Fails if consequences missing from terminal states.
- Include ALL major characters in end states, especially those who DIE.
- Fails if the closure ledger omits payoff status for story-bearing objects and relationships.
- Fails if the ending is described only in terms of the protagonist and ignores other major characters' fates.

---

# Validation Contract

## Canonical hard facts

Include 10-20 declarative factual statements about the manuscript that are objectively verifiable from the text. These travel downstream as MANDATORY CONSTRAINTS. Any downstream recommendation that contradicts these is INVALID.

Long-form target: 15-20 hard facts.
Short-form target: 8-12 hard facts.

```
<fact 1: e.g., "Character X dies in Chapter Y">
<fact 2: e.g., "The story takes place in Location Z during Time Period W">
<fact 3: e.g., "Character A and Character B are siblings">
...
```

## Failure conditions

Include 5-15 specific, falsifiable claims that would indicate comprehension failure. Format: "Fails if [specific incorrect claim]."

Long-form target: 10-15 failure conditions.
Short-form target: 5-8 failure conditions.

```
<failure condition 1: e.g., "Fails if Character X is described as surviving when the text confirms death">
<failure condition 2: e.g., "Fails if the central conflict is described as romance when it is governance">
...
```

## Hard do-not-import

List content from other works, false assumptions, or common AI hallucinations that must NEVER appear. This prevents cross-contamination from training data, other manuscripts in the corpus, or common literary misconceptions.

```
<item 1: e.g., "Do not import Hamlet's soliloquy themes into this manuscript's psychological analysis">
<item 2: e.g., "Do not assume a romantic subplot exists when the central relationship is mentorship">
...
```

## Acceptance checks

Include 8-12 verification Q&A pairs. Each question should have exactly one correct answer based on the manuscript. These are used to verify the ledger was built from actual manuscript evidence, not hallucination.

Long-form target: 10-12 Q&A pairs.
Short-form target: 6-8 Q&A pairs.

```
Q: <question about a specific plot point, character identity, or structural fact>
A: <correct answer, with manuscript location if possible>
...
```
