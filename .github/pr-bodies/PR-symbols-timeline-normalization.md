## Summary

Draft implementation PR for the Story Ledger literary/world map repair.

This PR should begin after PR A — Alias / Revelation + Source Integrity — is merged or stable enough to consume. It repairs Object/Symbol prioritization/lifecycles and Timeline/Location normalization.

## Purpose

Repair the literary/world map after alias/revelation and Source Integrity are stable:

1. Object / Symbol Prioritization and Lifecycle Repair
2. Timeline / Location Normalization

## Lane 1 — Object / Symbol Prioritization and Lifecycle Repair

### Required behavior

- Do not merge generic objects across owners unless evidence proves they are the same recurring object.
- Track object/symbol lifecycle:
  - first appearance
  - owner/attached character
  - recurring contexts
  - symbolic function
  - payoff / transformation / unresolved status
- Prioritize story-critical symbols above incidental props.

### Great Expectations required symbols

- file
- stolen food / pork pie / bread / cheese
- leg iron
- Hulks
- Satis House
- stopped clocks
- forge / forge tools
- tombstones / churchyard
- Joe’s letter / debt receipt
- Jaggers/legal documents

### The Awakening required symbols

- sea / Gulf / water
- birds / flight
- pigeon house
- wedding ring
- music / piano
- letters
- Edna’s art / sketching
- children as maternal obligation signal where applicable

### Failure conditions

- generic “pipe” merged across unrelated owners.
- Mrs. Joe’s ring and Biddy’s marriage/wedding state collapsed into one object lifecycle.
- file / leg iron / Satis House / stopped clocks under-ranked.
- sea / birds / pigeon house / wedding ring / music / art omitted or treated as incidental.

## Lane 2 — Timeline / Location Normalization

### Required behavior

- Normalize locations into stable canonical place IDs/labels.
- Separate:
  - present-scene location
  - recalled/backstory location
  - reported/offstage location
  - symbolic setting
- Track life-stage / chronology without contradictions.
- Do not assign adult/late-stage age to childhood scenes.

### Great Expectations required normalization

- Marshes / churchyard / Battery
- Gargery forge/home
- village
- Satis House
- London / Barnard’s Inn / Jaggers’s office
- Wemmick’s Walworth Castle
- Newgate / prison/legal system
- river / escape route
- abroad / Egypt where relevant
- Opening Pip must be child-stage, not age 21.

### The Awakening required normalization

- Grand Isle
- Léonce’s house / domestic interior
- New Orleans
- pigeon house
- Mademoiselle Reisz’s apartment
- beach / sea / Gulf
- social spaces / Creole community setting

### Failure conditions

- sentence fragments stored as canonical locations.
- pantry/kitchen action text treated as location identity.
- recalled Compeyson/Magwitch backstory mixed with present-time movement.
- childhood Pip assigned adult age/life-stage.
- symbolic places omitted or reduced to incidental scenery.

## Required tests

- Great Expectations symbol-priority test
- Awakening symbol-priority test
- generic-prop de-merge test
- canonical-location normalization test
- present-vs-backstory separation test
- life-stage contradiction test
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

- Do not change alias/revelation merge logic except to consume PR A outputs.
- Do not change Source Integrity except to emit new object/timeline blockers into the PR A aggregation path.
- Do not touch scoring.
- Do not touch Revise UI.
- Do not touch Workbench V2.
- Do not touch Agent Readiness.
- Do not touch public pages.
- Do not touch Pass 3 recommendation contract.

## Merge bar

This PR may merge only when Object/Symbol and Timeline/Location fixture expectations pass without weakening the gold fixtures.

Specifically:

- Great Expectations must surface the core symbols and avoid generic prop over-merging.
- Great Expectations must normalize locations/life stages without opening-Pip adult-age contradiction.
- The Awakening must surface sea/birds/pigeon house/wedding ring/music/letters/art as meaningful symbols.
- The Awakening must normalize locations without sentence-fragment garbage.
- Existing safety stack must remain intact:
  - #823 visibility gate
  - #824 dependency blocking
  - #827 relationship canonical-ID keying
  - #828 POV evidence guard
  - #829 pronoun-family transition display

## Implementation status

Draft scaffold only. Implementation commits still required.
