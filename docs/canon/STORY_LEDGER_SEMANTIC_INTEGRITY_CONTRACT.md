# Story Ledger Semantic Integrity Contract

Purpose: define when Story Ledger may be treated as clean downstream story authority.

This contract does not replace author sovereignty. Authors may approve flawed, unusual, ambiguous, or intentionally experimental ledgers. RevisionGrade must still distinguish clean system success from author override.

## Core rule

- Story Ledger is not clean because it exists.
- Story Ledger is not clean because it renders.
- Story Ledger is not clean because Review Gate opens.
- Story Ledger is not clean because the author approves it.

Story Ledger is clean only when semantic integrity checks pass and the author approves without unresolved known blockers.

## Authority levels

### 1. Raw extraction

Model/chunk output before deterministic cleanup.

Raw extraction may contain:

- wrong names
- aliases
- pronouns
- descriptors
- forms of address
- duplicate entities
- role over-promotions
- location fragments
- object over-merges
- threat undercounts

Raw extraction is evidence only.

### 2. Normalized ledger

Deterministically cleaned ledger with identity grouping, field separation, and basic validation.

Normalized ledger is candidate canon.

### 3. Reviewable ledger

Ledger safe enough to show the author for Review Gate.

Reviewable ledger requires:

- canonical identity present
- layer count valid
- Source Integrity computed
- no structural artifact missing
- basic semantic checks complete

### 4. Accepted ledger

Ledger approved by the author.

Accepted ledger may be:

- `clean_approved`
- `approved_with_author_override`

### 5. Clean accepted ledger

A clean accepted ledger may be used as clean story authority and counted as extraction success.

### 6. Override accepted ledger

Override accepted ledger may proceed downstream, but it must carry warning provenance and must not count as clean extraction success.

## Required layer count

Story Ledger has nine layers:

1. `source_integrity_layer`
2. `pov_structure_layer`
3. `canonical_identity_layer`
4. `cast_role_tier_layer`
5. `identity_pronoun_layer`
6. `relationship_network_layer`
7. `object_symbol_layer`
8. `location_timeline_worldstate_layer`
9. `threat_antagonist_ending_layer`

Layer count must be defined by one canonical constant, not hardcoded.

## Canonical identity rules

Canonical Identity is the foundation layer.

It must separate:

- `canonical_name`
- `legal_name`
- `aliases`
- `assumed_names`
- `descriptors`
- `forms_of_address`
- `pronouns`
- `same_name_disambiguation_group`

Invalid legal / name-state tokens:

- pronouns
- generic descriptors
- generic common nouns
- forms of address
- relationship-only descriptors
- scene role labels

Examples that must not enter legal/name-state fields:

- `he`
- `him`
- `she`
- `her`
- `I`
- `me`
- `the boy`
- `the man`
- `sir`
- `old chap`
- `dear boy`
- `the convict`

Descriptors may be retained as descriptors, not as legal names.

## Same-name disambiguation

Same-name characters must not merge automatically.

Example rule:

- Pip / Philip Pirrip ≠ Young Pip, Joe and Biddy’s son

The system must support distinct character IDs for same-name entities.

## Alias / revelation identity rules

Alias merge must support literary revelation patterns.

A character may appear under role descriptors before legal identity is revealed.

Merge candidates may use:

- explicit reveal statements
- secret role continuity
- object chain continuity
- relationship continuity
- physical marker continuity
- terminal-state continuity

Example:

- Convict1 / First convict / the convict / Magwitch / Abel Magwitch / Provis / unknown benefactor

must resolve to one canonical Magwitch entity when evidence supports it.

## POV rules

POV ownership requires direct evidence.

Valid evidence includes:

- first-person narration
- section/chapter camera ownership
- close third focalization
- free indirect concentration
- explicit perspective shifts
- narrative access boundaries

Invalid evidence:

- co-protagonist role
- major character role
- high mention count
- relationship centrality
- emotional importance

Hard rule:

- `co_protagonist !== pov_owner`

## Pronoun rules

Pronoun handling must be family-based, extensible, and evidence-driven. RevisionGrade must not pretend to enumerate the entire gamut of possible pronouns.

Core principles:

- Pronouns are identity metadata, not legal names, aliases, assumed names, descriptors, or forms of address.
- Known pronoun families may be normalized for comparison, but original pronoun strings must be preserved for display and traceability.
- Custom, neopronoun, uncommon, or unrecognized pronoun strings must not be treated as errors by default.
- Unknown pronoun does not equal wrong pronoun. It means preserve the signal and warn only if manuscript evidence creates identity, continuity, or referent ambiguity.
- Pronoun warnings must depend on manuscript evidence, not dictionary completeness.

Recognized common families include, but are not limited to:

- `he/him/his/himself` = masculine family
- `she/her/hers/herself` = feminine family
- `they/them/their/theirs/themself/themselves` = neutral or plural family
- `I/me/my/mine` = first-person family
- `it/its/itself` = nonhuman, object, creature, or dehumanizing-use family depending on manuscript evidence
- neopronoun or custom sets = preserved as supplied and normalized only when a family mapping is known

Allowed non-shifts / non-errors by default:

- stable family variants such as `he/him`, `she/her`, `they/them`, and `I/me`
- mixed pronoun sets such as `he/they` or `she/they` when the manuscript presents them as one character’s stable pronoun set
- custom or uncommon pronouns when they are used consistently or do not create referent ambiguity

Review-required cases:

- cross-family contradiction across chunks, such as one character moving from `he/him` to `she/her` without supporting identity or transition evidence
- unclear referent ownership where the system cannot determine which character a pronoun belongs to
- conflicting character identity caused by pronoun evidence
- human pronoun shifting to `it` when the manuscript does not support nonhuman, object, creature, or intentional dehumanizing usage
- unresolved custom or unknown pronoun signals that affect identity tracking, continuity, or reader comprehension

Author-facing rule:

- Stable pronoun usage belongs in hidden normalization, not author burden.
- The Story Ledger should surface only reviewable pronoun-family transitions, unresolved referent ownership, or identity conflicts.
- Final evaluation reports should mention pronouns only when they affect clarity, continuity, referent ownership, identity tracking, or reader comprehension.

## Relationship rules

Relationship pairs must be keyed by canonical character IDs.

Required key:

```ts
pairKey = sort([characterAId, characterBId]).join("↔");
```

Display names are render fields only.

The relationship graph must not create separate edges for aliases of the same character.

## Object / Symbol rules

Object identity must distinguish:

- same physical object
- same symbolic motif
- generic prop occurrence

Generic object nouns must not be automatically merged into one lifecycle.

Example:

- Joe’s pipe
- Magwitch’s pipe
- tavern/social pipe

should not collapse into one `pipe` lifecycle without evidence.

## Timeline / Location rules

Timeline/location must separate:

- `canonical_location`
- `sublocation`
- `present_scene_location`
- `recalled_location`
- `reported_location`
- `offstage_location`
- `event_summary`

Event summaries must not enter canonical location lists.

Recalled backstory must not be treated as present-scene movement.

## Threat / Pressure rules

Threat / pressure is not antagonist-only.

Required pressure categories:

- `character_pressure`
- `social_class_pressure`
- `institutional_legal_pressure`
- `internal_guilt_pressure`
- `romantic_emotional_pressure`
- `physical_threat`
- `economic_debt_pressure`
- `ending_consequence`

A long-form manuscript with a complex cast should not pass threat coverage if only one or two pressure agents are found without explanation.

## Terminal state rules

Terminal states must distinguish:

- `alive_resolved`
- `dead_resolved`
- `injured_then_dead`
- `captured`
- `imprisoned`
- `exiled`
- `married_resolved`
- `relationship_ambiguous`
- `intentionally_unresolved`
- `unknown_due_to_extraction_gap`

A character with explicit death, capture, injury/death, or resolved consequence must not be marked generically unresolved.

## Source Integrity rules

Source Integrity must aggregate semantic blockers.

Required blocker classes:

- identity conflation
- alias fragmentation
- invalid name-state token
- pronoun false shift
- POV role fallback
- relationship display-name keying
- object generic noun over-merge
- timeline location fragment
- threat under-extraction
- terminal-state contradiction
- dependent-layer contamination

Source Integrity must report root causes, not only symptoms.

## Dependency rules

If Canonical Identity fails or degrades, dependent layers must be marked degraded or blocked.

Dependent layers:

- `cast_role_tier_layer`
- `identity_pronoun_layer`
- `pov_structure_layer`
- `relationship_network_layer`
- `object_symbol_layer`
- `location_timeline_worldstate_layer`
- `threat_antagonist_ending_layer`
- `source_integrity_layer`

## Review Gate provenance

Review Gate must distinguish:

- `clean_approved`
- `approved_with_author_override`
- `rejected`

If any layer is marked wrong and no note exists:

- approval must be disabled

If any layer is marked wrong with a note and the author chooses to proceed:

- `ledger_approval_status = approved_with_author_override`
- `ledger_has_known_issues = true`
- `downstream_quality_warning = true`
- `extraction_health_status = known_bad_author_override`

Override approvals may proceed downstream but must not count as clean extraction success.

## Clean ledger standard

A ledger is clean only when:

- layer count is valid
- canonical identity passes
- aliases are merged or flagged
- pronouns are normalized
- POV has evidence
- relationships use canonical IDs
- objects are not over-merged
- timeline/location types are separated
- threat / pressure coverage is sufficient
- terminal states are coherent
- Source Integrity has no blockers
- Review Gate approval is clean

## Final doctrine

RevisionGrade should preserve author sovereignty while protecting system truth.

The author may say:

> Proceed anyway.

The system must remember:

> Proceeding anyway is not the same as clean extraction.
