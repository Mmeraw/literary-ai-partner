## Summary

Draft implementation PR for the Story Ledger truth/provenance foundation.

This PR is intentionally split from Object/Symbol and Timeline/Location repair. It must fix alias/revelation identity handling and Source Integrity blocker aggregation first, because downstream layers inherit those truth conditions.

## Purpose

Fix the foundation before repairing literary/world mapping:

1. Alias / Revelation Merge Hardening
2. Source Integrity Blocker Aggregation

## Lane 1 — Alias / Revelation Merge Hardening

### Required behavior

- Merge or explicitly link aliases when evidence supports the same identity.
- Preserve reveal-state metadata:
  - surface label
  - canonical identity
  - alias / assumed name
  - descriptor
  - reveal timing
  - confidence
- Do not treat descriptors as legal names.
- Do not force same visible names to merge without disambiguation.

### Great Expectations requirements

- Magwitch / Abel Magwitch / Provis / the convict / first convict / unknown benefactor resolve to one canonical Magwitch identity or explicit linked reveal group.
- Pip / Philip Pirrip remains distinct from Joe and Biddy’s later child.
- Herbert Pocket / Herbert_Pocket do not duplicate.
- Mr. Pumblechook / Pumblechook do not duplicate.
- Orlick / Dolge Orlick do not duplicate.
- Joe_Gargery / JoeGargery / Joe Gargery do not duplicate.

### The Awakening requirements

- Edna / Mrs. Pontellier / Edna Pontellier resolve correctly.
- Léonce / Mr. Pontellier resolve correctly.
- Robert / Robert Lebrun resolve correctly.
- Mademoiselle Reisz variants resolve correctly.
- Madame Ratignolle / Adèle Ratignolle resolve correctly.
- Children/lovers/background mentions must not become false core identities.

### Failure conditions

- Magwitch fragmented into multiple core characters.
- “Unknown benefactor” treated as separate after revelation evidence.
- Pip conflated with Joe and Biddy’s son.
- Descriptors promoted into legal/canonical names.
- Same visible names merged without disambiguation.

## Lane 2 — Source Integrity Blocker Aggregation

### Required behavior

Aggregate blocker signals from:

- Canonical Identity
- Alias/revelation merge
- Relationship Network
- POV Structure
- Identity & Pronouns
- Object/Symbol
- Timeline/Location
- Narrative Pressure / Stakes / Consequence

Distinguish:

- clean
- needs_review
- degraded
- blocked
- author_override

Source Integrity must:

- name affected layers and blocker codes;
- never call the Story Ledger clean if dependent layers inherited identity/timeline/alias defects;
- never count author override as clean extraction success.

### Required blocker examples

- identity conflation
- alias fragmentation
- same-name ambiguity
- failed canonical ID dependency
- duplicate relationship edges
- false POV fallback
- false pronoun shift
- object ownership uncertainty
- timeline/location contradiction
- missing pressure-system coverage
- unresolved ending-state contradiction

## Required tests

- Magwitch alias/reveal merge test
- Pip vs Joe/Biddy child disambiguation test
- descriptor-not-legal-name test
- Awakening alias normalization test
- Source Integrity blocker aggregation test
- dependent-layer inherited-risk test
- author-override-not-clean test
- existing gold fixture harness

## Fixture integrity

Tighten fixtures only. Do not weaken them.

For every fixture change, explain whether it:

- adds a required truth;
- adds a forbidden failure;
- clarifies canonical IDs;
- clarifies expected metadata.

Do not remove required truths or forbidden failures to make implementation pass.

## Out of scope

- Do not repair Object/Symbol lifecycle in this PR.
- Do not repair Timeline/Location normalization in this PR.
- Do not touch scoring.
- Do not touch Revise UI.
- Do not touch Workbench V2.
- Do not touch Agent Readiness.
- Do not touch public pages.
- Do not touch Pass 3 recommendation contract.

## Merge bar

This PR may merge only when alias/reveal defects and Source Integrity under-reporting are fixed without weakening Great Expectations or Awakening fixtures.

Specifically:

- Great Expectations must not show Magwitch alias fragmentation.
- Great Expectations must not conflate Pip / Philip Pirrip with Joe and Biddy’s child.
- The Awakening aliases must normalize without turning background/common mentions into core identities.
- Source Integrity must report real upstream blockers and inherited risk truthfully.
- Existing safety stack must remain intact:
  - #823 visibility gate
  - #824 dependency blocking
  - #827 relationship canonical-ID keying
  - #828 POV evidence guard
  - #829 pronoun-family transition display

## Implementation status

Draft scaffold only. Implementation commits still required.
