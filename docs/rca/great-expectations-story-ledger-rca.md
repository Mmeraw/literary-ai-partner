# Great Expectations Story Ledger RCA

Status: RCA / implementation planning document.

## Purpose

This document freezes the diagnosis for the Great Expectations Story Ledger failures before broader code changes begin.

The Great Expectations evaluation exposed a Story Ledger semantic-integrity failure, not merely a bad literary judgment. The later diagnostic and synthesis stages recovered because they still reasoned from the manuscript text. The Story Ledger itself, however, was allowed to render as approval-grade narrative canon before canonical identity, alias merge, POV evidence, pronoun normalization, relationship keying, timeline normalization, threat coverage, and Source Integrity aggregation were strong enough.

Core doctrine:

> Story Ledger is proposed machine-readable evidence, not governing canon by default. It becomes governing only after canonical identity, dependency validation, Source Integrity aggregation, and Review Gate provenance pass.

## Failure chain

```text
Noisy chunk extraction
  ↓
Weak canonical identity / alias normalization
  ↓
Bad canonical node created
  ↓
character_id derived from bad canonicalName
  ↓
Cast, POV, relationship, object, timeline, and threat layers inherit bad node
  ↓
Source Integrity reports symptoms, not root blockers
  ↓
Review Gate permits approval without a strong clean-vs-override distinction
  ↓
Phase 2 / 3 partially recover from manuscript text
  ↓
Story Ledger remains semantically compromised
```

## Affected layers

### Canonical Identity

The protagonist node was repeatedly conflated with Joe and Biddy’s separate end-state child. That created the wrong identity node:

- `Pip (Joe and Biddy’s son)`

That node then propagated downstream.

### Cast / Role Tier

- Herbert Pocket was over-promoted as co-protagonist.
- Magwitch / Abel Magwitch / Provis / convict / unknown benefactor was fragmented or under-ranked.
- Joe Gargery was flattened into a generic pressure agent.
- Estella was under-described as only a romantic catalyst.

### Identity & Pronouns

The system flagged ordinary pronoun case variation such as `he/him` as a pronoun shift. That is a false positive unless multiple pronoun families are actually present.

### POV Structure

POV ownership was derived from role importance when direct focalization evidence was missing. That overcounts co-protagonists as POV owners.

### Relationship Network

Relationship edges were keyed by display names and inherited alias fragmentation.

### Object / Symbol

Object ownership and lifecycle logic inherited the failed identity node and over-merged generic object nouns.

### Timeline / Location

Timeline data mixed canonical places, scene summaries, recalled backstory, and character state into one bucket.

### Threat / Pressure / Ending

Threat extraction undercounted the novel’s pressure architecture by treating antagonist roles as the main source of pressure.

### Source Integrity

Source Integrity reported minor or false issues while missing the root blockers above.

## Code seams

The following seams are the likely fault lines for the semantic failures:

- Canonical identity reducer / identity grouping
- Name-state population and alias filtering
- POV builder fallback path when direct POV signals are missing
- Pronoun inconsistency detection logic
- Relationship pair key construction
- Object lifecycle grouping / generic noun merge logic
- Timeline/location normalization and snapshot projection
- Threat/pressure extraction and ending-state labeling
- Source Integrity blocker aggregation
- Review Gate provenance / clean-vs-override distinction
- Story layer count contract drift (8 vs 9)

## Required failure codes

These must become deterministic, testable conditions:

- `IDENTITY_SAME_NAME_CONFLATION`
- `IDENTITY_NAMESTATE_INVALID_TOKEN`
- `ALIAS_FRAGMENTATION_CORE_CAST`
- `POV_ROLE_FALLBACK_ASSERTION`
- `PRONOUN_CASE_FALSE_SHIFT`
- `RELATIONSHIP_PAIR_DISPLAY_NAME_KEY`
- `OBJECT_GENERIC_NOUN_OVERMERGE`
- `TIMELINE_LOCATION_SENTENCE_FRAGMENT`
- `THREAT_PRESSURE_UNDEREXTRACTED`
- `ENDING_TERMINAL_STATE_CONTRADICTION`
- `SOURCE_INTEGRITY_UNDERREPORTS_BLOCKERS`
- `DEPENDENT_LAYER_FAILED_IDENTITY_INHERITANCE`
- `STORY_LAYER_COUNT_CONTRACT_DRIFT`
- `REVIEW_GATE_OVERRIDE_NOT_PROVENANCED`

## PR sequence

### PR 0 — public phase-label copy

Scope:

- public phase labels only
- no semantic changes
- no pipeline behavior changes

### PR 1 — this RCA document

Scope:

- docs only
- lock the diagnosis before code

### PR 2 — story-layer count contract

- unify the 8 vs 9 layer contract
- make layer count a single canonical constant

### PR 3 — canonical identity hygiene

- separate canonical names, aliases, descriptors, forms of address, pronouns, and same-name disambiguation groups
- prevent pronouns and descriptors from entering legal/name-state fields

### PR 4 — dependency blocking

- fail or degrade dependent layers when canonical identity is failed or degraded

### PR 5 — pronoun-family normalization

- normalize pronouns before shift detection

### PR 6 — alias / revelation merge

- merge Magwitch-style reveal structures into one canonical entity

### PR 7 — relationship canonical-ID keying

- build edges from canonical IDs, not display names

### PR 8 — timeline/location normalization

- distinguish canonical location, sublocation, present scene, recalled location, reported location, offstage location, and event summary

### PR 9 — threat / pressure architecture

- model pressure systems, not only antagonist roles

### PR 10 — Source Integrity health dashboard

- surface semantic blockers instead of only shallow warnings

### PR 11 — Review Gate provenance

- distinguish clean approval from approved-with-author-override

### PR 12 — Great Expectations regression fixture

- prove the known failures cannot repeat silently

## Great Expectations regression expectations

A regression fixture must prove all of the following:

- Pip / Philip Pirrip is the protagonist.
- Young Pip, Joe and Biddy’s son is a separate minor/end-state child.
- Herbert Pocket is not co-protagonist.
- Herbert Pocket is not POV owner.
- `he/him` does not trigger SHIFT.
- Magwitch aliases merge.
- Pip–Magwitch appears as a top relationship engine.
- Pip–Joe appears as a top relationship engine.
- Pip–Estella appears as a top relationship engine.
- Estella–Miss Havisham appears as a top relationship engine.
- Threat systems exceed antagonist-only extraction.
- Compeyson is criminal antagonist, not maternal obligation.
- Miss Havisham terminal state is resolved.
- Compeyson terminal state is resolved.
- Source Integrity reports root blockers when any of the above fail.

## Non-goals

This RCA does **not** require:

- hardcoding Great Expectations answers into production logic
- blocking all author overrides
- hiding Story Ledger from users
- abandoning Story Ledger
- solving semantic accuracy by prompt wording alone
- merging all fixes in one large PR
- changing Review Gate author sovereignty rules

## Strategic note

Do not abandon Story Ledger.

Instead, change its authority model:

- raw extraction ≠ canon
- rendered Story Ledger ≠ clean canon
- author-approved Story Ledger ≠ clean extraction success
- normalized + validated + provenance-marked Story Ledger = governing canon

## Final conclusion

The previous Story Ledger PRs protected process mechanics. They did not yet protect semantic truth.

The next fixes must make this true:

> No Story Ledger can fail Canonical Identity and still allow dependent layers to present themselves as clean.
