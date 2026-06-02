# SEED and Phase 1A Governance

Status: canonical warmup packet v1  
Purpose: define the exact relationship between Phase 0 warmup, SEED artifacts, Phase 1A Story Ledger extraction, Story Layer Quality Gate, Review Gate, and Phase 2.

## Core doctrine

```text
Seed proposes.
Phase 1A must use seed as baseline.
Phase 1A verifies against manuscript evidence.
Reducer normalizes.
Story Layer Quality Gate validates.
Author Review Gate authorizes.
accepted_story_ledger_v1 governs Phase 2.
```

## What SEED is

SEED is a provisional scaffold. It reduces cold-start drift and gives downstream extraction a map of what to look for.

SEED is not truth.

## Required SEED artifacts

```text
story_map_seed_v1
evaluation_seed_v1
```

## story_map_seed_v1 purpose

The story seed is the complete provisional Story Ledger scaffold.

It must include all nine Story Ledger layer scaffolds:

```text
source_integrity_layer
pov_structure_layer
canonical_identity_layer
cast_role_tier_layer
identity_pronoun_layer
relationship_network_layer
object_symbol_layer
location_timeline_worldstate_layer
threat_antagonist_ending_layer
```

It must include candidate inputs:

```text
candidate_entity_registry
candidate_alias_map
candidate_pov_map
candidate_relationship_map
candidate_pressure_map
candidate_object_shortlist
candidate_location_map
candidate_timeline_hypotheses
uncertainty_flags
```

## evaluation_seed_v1 purpose

The evaluation seed is the complete provisional evaluation scaffold.

It must include:

```text
manuscript_profile
word_count_tier
evaluation_mode
reporting_template_path
short_form_template
long_form_template
long_form_multilayer_template
criterion_scaffolds for all 13 criteria
```

## Evaluation routing

```text
under 25,000 words → short_form_evaluation
25,000+ words → long_form_evaluation
long / complex / layered manuscript → long_form_multi_layer_evaluation
```

Short-form evaluations use the 13 story criteria only. They do not receive Golden Spine / WAVE-level long-form governance.

Long-form evaluations activate manuscript-scale logic.

Long-form multi-layer evaluations activate the deeper layered/canonical path.

## What SEED may do

SEED may:

- propose likely entities
- propose likely aliases
- propose likely POV/focalization owners
- propose likely pressure systems
- propose likely object/symbol candidates
- propose likely locations/timeline hypotheses
- propose evaluation route
- propose reporting template path
- propose criterion scaffolds
- mark uncertainty flags

## What SEED must not do

SEED must not:

- create final canon IDs
- verify relationships
- create final Story Ledger truth
- create final craft scores
- create final executive verdict
- authorize Phase 2
- replace manuscript evidence
- bypass Review Gate
- extract dialogue fragments, interjections, or common English words as entity names (e.g. "No", "Yes", "Oh", "Hey" followed by a comma are dialogue — not character names)

## Artifact state vs claim state

SEED artifact lifecycle and claim verification state must remain separate.

Artifact state answers:

```text
Does the seed artifact exist and meet shape/completeness requirements?
```

Claim state answers:

```text
Has this specific seeded claim been verified, corrected, rejected, or left unresolved by manuscript evidence?
```

Do not collapse a partially useful seed into all-or-nothing truth.

## Phase 1A obligation

Phase 1A must use SEED as a baseline scaffold.

That means Phase 1A starts from the seed’s layer scaffolds and candidate inputs, then verifies, corrects, rejects, or expands them from manuscript evidence.

Phase 1A must not wander through the manuscript blindly when a complete seed exists.

Phase 1A must also not trust the seed blindly.

## Phase 1A claim resolution states

Seeded claims should be resolved into states such as:

```text
verified_from_manuscript
corrected_by_manuscript
rejected_by_manuscript
unresolved_insufficient_evidence
conflicting_signals
not_applicable
```

## Required Phase 1A output

```text
pass1a_story_layer_v1
```

This output must include all nine Story Ledger layers, unless a layer is intentionally suppressed/degraded with a quality report explanation.

## Story Layer Quality Gate

After Phase 1A, before Review Gate rendering, generated layers must pass the Story Layer Quality Gate.

The gate must classify each layer:

```text
valid
degraded_with_caution
suppressed_insufficient_evidence
suppressed_conflicting_signals
failed_benchmark_minimum
```

The gate produces:

```text
ledger_quality_report_v1
```

## Review Gate

Review Gate may open only when visible layers are valid, safely degraded, or safely suppressed with explanation.

Review Gate must not open for raw failed layers.

Author decisions create:

```text
accepted_story_ledger_v1
```

## Phase 2 authority

Phase 2 may use:

```text
accepted_story_ledger_v1
```

Phase 2 must not use:

```text
raw seed as authority
raw failed Story Ledger layers
unapproved Phase 1A extraction
```

## Benchmark relationship

Benchmark files are quality targets and known-answer keys. They are not manuscript evidence.

During benchmark runs, missing benchmark-required structures should produce fit-gap or quality-report failures.

During ordinary user manuscript runs, benchmark docs guide shape, completeness, and failure classification, but all claims must be verified against the user manuscript.

## Display rules

Author-facing Story Ledger output must use manuscript-native locators:

```text
chapter
scene
paragraph
page
quoted evidence anchor
```

Never show:

```text
chunk IDs
raw internal coordinates
unparsed JSON
model prompt fragments
stack traces
```

## Runtime anti-patterns

Do not:

- load PR history live during runtime
- let seed bypass manuscript evidence
- let seed bypass Review Gate
- let incomplete seed start Phase 1A
- let dirty Story Ledger layers render as truth
- let failed layers become accepted_story_ledger_v1
- let Phase 2 start without accepted_story_ledger_v1

## Success condition

The successful path is:

```text
Phase 0 loaded compact warmup packet.
Both seed artifacts complete.
Phase 1A used seed as baseline.
Phase 1A verified against manuscript evidence.
Story Layer Quality Gate classified every layer.
Review Gate displayed only valid/degraded/suppressed-safe layers.
Author decisions created accepted_story_ledger_v1.
Phase 2 evaluated against accepted_story_ledger_v1.
```
