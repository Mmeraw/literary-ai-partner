# Story Ledger Layer Failure Modes

Status: canonical warmup packet v1  
Purpose: define how each of the nine Story Ledger layers may fail, how the system should classify the failure, and what the UI/runtime may render.

## Core rule

Story Ledger layers may not fail open.

If a layer does not meet benchmark minimums or does not have sufficient verified manuscript evidence, RevisionGrade must render a controlled degraded/suppressed state or block Review Gate. It must not ask the author to approve substandard extraction as story truth.

## Layer health statuses

```text
valid
degraded_with_caution
suppressed_insufficient_evidence
suppressed_conflicting_signals
failed_benchmark_minimum
```

## Author-facing rendering rule

When a layer is not safe to present, render a concise human-readable reason:

```text
Layer not presented.
RevisionGrade detected incomplete, conflicting, or insufficiently verified story signals for this layer.
This layer did not meet the benchmark standard for author review.
```

Do not expose machine chunk IDs.

---

# 1. Source Integrity

## Valid when

- Submission scope is clear.
- Manuscript text is available.
- Word count / route / short-vs-long-form mode is known.
- Extraction coverage can be assessed.
- Known source risks are listed.

## Failure modes

| Failure | Status | Runtime consequence |
|---|---|---|
| Manuscript text missing or unreadable | failed_benchmark_minimum | Block Phase 1A |
| Scope unknown | suppressed_insufficient_evidence | Request regeneration or human review |
| Major source contamination | suppressed_conflicting_signals | Block Review Gate until resolved |
| Coverage too narrow for full manuscript | degraded_with_caution or failed_benchmark_minimum | Do not treat output as complete |
| Internal machine labels exposed | failed_benchmark_minimum | Block author rendering |

## Never do

- Do not claim full-manuscript confidence from partial evidence.
- Do not show internal chunk labels.
- Do not treat package/metadata defects as story defects unless evidence supports it.

---

# 2. POV Structure

## Valid when

- Narrative camera/focalization owners are identified or a valid non-focal structure is proven.
- Omniscient narration is distinguished from absence of POV.
- Benchmark-required focal centers are represented where applicable.

## Failure modes

| Failure | Status | Runtime consequence |
|---|---|---|
| Says “No POV characters identified” despite obvious focal centers | failed_benchmark_minimum | Suppress layer and regenerate |
| Confuses role importance with focalization | degraded_with_caution | Show caution or regenerate |
| Omits benchmark-required POV lane | failed_benchmark_minimum | Block Review Gate for benchmark run |
| Treats omniscience as no POV | failed_benchmark_minimum | Suppress raw layer |

## Never do

- Do not render “No POV characters identified” for full novels with clear cameras.
- Do not confuse protagonist role with POV ownership.
- Do not flatten multi-lane narration into generic third person.

---

# 3. Canonical Identity

## Valid when

- Major named characters and required structural entities are captured.
- Aliases, titles, roles, name states, and collectives are separated.
- Merge/split risks are explicitly tracked.

## Failure modes

| Failure | Status | Runtime consequence |
|---|---|---|
| Required benchmark entity missing | failed_benchmark_minimum | Block or fit-gap |
| Titles split into fake characters | degraded_with_caution or failed_benchmark_minimum | Normalize before Review Gate |
| Distinct characters merged incorrectly | failed_benchmark_minimum | Suppress layer |
| Collectives treated as individuals without evidence | degraded_with_caution | Review before approval |
| Name-state transformation omitted | failed_benchmark_minimum when structural | Fit-gap/regenerate |

## Never do

- Do not collapse aliases and identity transformations into generic names.
- Do not invent final canon IDs from seed alone.
- Do not merge collectives, institutions, objects, and people into one entity type.

---

# 4. Cast / Role Tier

## Valid when

- Characters are ranked by structural function.
- Individual, collective, institutional, animal, symbolic, and environmental forces are separated.
- Role tier reflects actual story work, not name frequency alone.

## Failure modes

| Failure | Status | Runtime consequence |
|---|---|---|
| Primary/major structural force omitted | failed_benchmark_minimum | Block benchmark Review Gate |
| Animal/symbolic/institutional force misclassified | degraded_with_caution | Render with caution or regenerate |
| Minor walk-on promoted to major without evidence | degraded_with_caution | Require evidence |
| Role tier based only on mentions | degraded_with_caution | Reclassify from plot function |

## Never do

- Do not treat all named characters as equal.
- Do not treat structural animals as objects.
- Do not treat institutions or symbolic systems as ordinary cast unless clearly framed.

---

# 5. Pronoun Transitions

## Valid when

- Only reviewable pronoun-family transitions or identity-signal ambiguities are shown.
- Stable pronoun use is normalized and hidden from author review.
- Empty state is allowed when no reviewable transitions exist.

## Failure modes

| Failure | Status | Runtime consequence |
|---|---|---|
| Shows stable pronoun usage as review burden | failed_benchmark_minimum | Suppress or regenerate |
| Treats titles/species/personification as pronoun transition | failed_benchmark_minimum | Suppress raw layer |
| Misses real cross-family transition | degraded_with_caution or failed_benchmark_minimum | Review/regenerate |

## Valid empty state

```text
No reviewable pronoun-family transitions detected.
Stable pronoun usage is normalized and hidden from review.
```

## Never do

- Do not show stable he/him, she/her, they/them as author tasks.
- Do not mistake species labels, titles, royal terms, or symbolic personification for pronoun transition.

---

# 6. Relationship Network

## Valid when

- Sustained named relationships are represented.
- Character-system relationships are allowed when structurally necessary.
- Group/institution/environment relationships are clearly labeled as systems.

## Failure modes

| Failure | Status | Runtime consequence |
|---|---|---|
| Benchmark-required relationship missing | failed_benchmark_minimum | Fit-gap/regenerate |
| Named relationship collapsed into generic pressure | failed_benchmark_minimum | Suppress or degrade |
| One-off encounter treated as major relationship | degraded_with_caution | Require evidence |
| Unnamed group treated like named relationship without role stability | degraded_with_caution | Route to pressure/system |

## Never do

- Do not reduce relationships to generic “pressure” when named relational arcs exist.
- Do not ignore animal/human, character/object, character/institution, or character/place relationships when structurally active.

---

# 7. Object / Symbol

## Valid when

- Story-bearing objects and motifs are tracked with lifecycle.
- Physical objects, symbolic systems, beliefs, artifacts, places, and props are separated.
- Objects that drive identity, pressure, plot, or closure are not treated as scenery.

## Failure modes

| Failure | Status | Runtime consequence |
|---|---|---|
| Required benchmark object missing | failed_benchmark_minimum | Fit-gap/regenerate |
| Dialogue classified as object | degraded_with_caution | Correct classification |
| Doctrine treated as physical object | degraded_with_caution | Split doctrine/object |
| Story-bearing object treated as scenery | failed_benchmark_minimum when structural | Suppress/regenerate |
| Object lifecycle missing final meaning | degraded_with_caution | Render with caution |

## Never do

- Do not classify animals as objects.
- Do not classify abstract doctrine as a physical object.
- Do not miss objects that carry ending accountability.

---

# 8. Timeline / Location / Worldstate

## Valid when

- The story’s key temporal and spatial movement is represented.
- Active scene locations are distinguished from backstory, myth, research, or reference locations.
- World rules are captured.

## Failure modes

| Failure | Status | Runtime consequence |
|---|---|---|
| Full novel collapsed to opening/middle/end only | degraded_with_caution or failed_benchmark_minimum | Regenerate for coverage |
| Benchmark-required transit/location chain omitted | failed_benchmark_minimum | Fit-gap |
| Backstory location treated as active scene | degraded_with_caution | Correct classification |
| World rules omitted | degraded_with_caution | Degrade layer |
| Machine chunk labels shown | failed_benchmark_minimum | Block rendering |

## Never do

- Do not use chunk IDs as author-facing location.
- Do not collapse all settings into generic place categories.
- Do not ignore transit chains when they carry plot, identity, or safety meaning.

---

# 9. Threat / Pressure / Ending

## Valid when

- Individual, institutional, environmental, relational, symbolic, biological, social, and internal pressures are separated.
- Ending accountability is explicit.
- Closure debts are tracked.

## Failure modes

| Failure | Status | Runtime consequence |
|---|---|---|
| All pressure reduced to one villain | failed_benchmark_minimum | Regenerate |
| Ending treated as mood only | failed_benchmark_minimum | Suppress/degrade |
| Unresolved ending misreported as clean closure | failed_benchmark_minimum | Regenerate |
| Major pressure system omitted | failed_benchmark_minimum | Fit-gap |
| Consequences missing from terminal states | degraded_with_caution | Render with caution or regenerate |

## Never do

- Do not treat endings as complete just because the manuscript stops.
- Do not omit consequences for benchmark-required relationships, objects, and pressures.
- Do not flatten systemic, environmental, institutional, or symbolic pressure into a single antagonist.

---

# Review Gate rule

Review Gate may open only when every visible layer is one of:

```text
valid
degraded_with_caution with proof
suppressed_insufficient_evidence with author-safe explanation
suppressed_conflicting_signals with author-safe explanation
```

Review Gate must not allow approval of:

```text
failed_benchmark_minimum
raw malformed layer
raw unverified seed output
machine-locator-heavy output
```
