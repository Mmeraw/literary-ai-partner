# Story Ledger Semantic Integrity Plan

Purpose: implementation plan for hardening Story Ledger from a raw extraction display into a confidence-rated, dependency-aware, machine-readable canon system.

## Guiding principle

- Raw extraction is evidence.
- Normalized extraction is candidate canon.
- Validated extraction is reviewable canon.
- Approved extraction is job-scoped authority.
- Approved-with-override extraction is **not** clean extraction success.

## PR stack

### PR 0 — public phase-label copy

Scope:

- public phase labels only
- no semantic or runtime changes

Examples:

- `Calibrating evaluation standards` → `Preparing your evaluation`
- `Manuscript analysis + structural preflight` → `Reading your manuscript`
- `Craft diagnostics` → `Building your report`
- `Narrative Synthesis` → `Finalizing your report`
- `WAVE Handoff` → `Preparing next-step guidance`

Acceptance:

- no public progress label exposes internal pass names, calibration terms, or pipeline architecture
- no pipeline behavior changes

### PR 1 — RCA document

Scope:

- docs only

Acceptance:

- failure chain is frozen
- layer-by-layer root causes are identified
- failure codes are named
- PR stack is documented
- Great Expectations regression expectations are documented
- non-goals are stated

### PR 2 — story layer count contract

Scope:

- contract drift only

Required structure:

```ts
export const STORY_LAYER_KEYS = [
  "source_integrity_layer",
  "pov_structure_layer",
  "canonical_identity_layer",
  "cast_role_tier_layer",
  "identity_pronoun_layer",
  "relationship_network_layer",
  "object_symbol_layer",
  "location_timeline_worldstate_layer",
  "threat_antagonist_ending_layer",
] as const;

export const STORY_LAYER_COUNT = STORY_LAYER_KEYS.length;
```

Acceptance:

- no hardcoded 8 or 9 outside the canonical constant
- UI, backend, and docs agree on 9 layers
- tests fail if the layer count changes without contract updates

### PR 3 — canonical identity kernel

Scope:

- identity normalization before dependent layers

Add a deterministic identity kernel that separates:

- `canonical_name`
- `legal_name`
- `aliases`
- `assumed_names`
- `descriptors`
- `forms_of_address`
- `pronouns`
- `same_name_disambiguation_group`
- `identity_confidence`
- `identity_blockers`

Acceptance:

- pronouns cannot enter nameStates / legal-name fields
- descriptors cannot enter legal-name fields
- forms of address cannot enter legal-name fields
- same-name-but-different-person collisions are represented
- Pip / Philip Pirrip and Young Pip, Joe and Biddy’s son are separate entities in the fixture

### PR 4 — dependency blocking

Scope:

- dependency health

If Canonical Identity is failed or degraded, dependent layers must be marked degraded or blocked:

- `cast_role_tier_layer`
- `identity_pronoun_layer`
- `pov_structure_layer`
- `relationship_network_layer`
- `object_symbol_layer`
- `location_timeline_worldstate_layer`
- `threat_antagonist_ending_layer`
- `source_integrity_layer`

Acceptance:

- dependent layers cannot present as clean when canonical identity failed
- Source Integrity reports inherited failed identity
- downstream handoff carries ledger-health warning
- author can still override, but override is not clean approval

### PR 5 — POV and pronoun guards

Scope:

- POV truth and pronoun-family normalization

POV rules:

- `co_protagonist !== POV owner`
- `major character !== POV owner`
- `relationship hub !== POV owner`
- POV ownership must come from direct focalization evidence

Pronoun rules:

- `he/him/his` = `masculine_singular`
- `she/her/hers` = `feminine_singular`
- `they/them/their` = `neutral_or_plural`
- `I/me/my` = `first_person`

Acceptance:

- no role-only POV assertion
- no `he/him` SHIFT
- no `she/her` SHIFT
- no `they/them` SHIFT
- `he/she` and `he/they` still flag review
- Great Expectations shows Pip as sole POV owner

### PR 6 — alias / revelation merge

Scope:

- literary alias and reveal structures

Support merge candidates based on:

- explicit identity reveal
- secret benefactor role
- same object chain
- same relationship chain
- same terminal state
- same physical marker
- same role function across chunks

Acceptance:

- Magwitch / Abel Magwitch / Provis / convict / unknown benefactor merge in the Great Expectations fixture
- merged entity uses one canonical character ID
- relationships, objects, timeline, and threat all reference the merged ID

### PR 7 — relationship canonical-ID keying

Scope:

- graph stability

Relationship pairs must be keyed by stable canonical IDs:

```ts
pairKey = sort([characterAId, characterBId]).join("↔");
```

Acceptance:

- no duplicate relationship edges caused by display-name variants
- display names remain render-only
- graph integrity test fails if two aliases produce separate edges

### PR 8 — timeline / location normalization

Scope:

- chronology and geography

Separate location types:

- `canonical_location`
- `sublocation`
- `present_scene_location`
- `recalled_location`
- `reported_location`
- `offstage_location`
- `event_summary`

Acceptance:

- event summaries cannot enter canonical location list
- recalled backstory does not appear as present-scene movement
- Satis House normalizes into one canonical place with sublocations
- Great Expectations fixture excludes phrases like `fetching the pie` from canonical locations

### PR 9 — threat / pressure architecture

Scope:

- pressure systems, not only antagonists

Threat layer must extract pressure systems:

- `character_pressure`
- `social_class_pressure`
- `institutional_legal_pressure`
- `internal_guilt_pressure`
- `romantic_emotional_pressure`
- `physical_threat`
- `economic_debt_pressure`
- `ending_consequence`

Acceptance:

- threat layer does not derive only from antagonist role
- Great Expectations includes Magwitch, Miss Havisham, Estella, Jaggers/legal machinery, Orlick, Drummle, Compeyson, Joe/Biddy/home conscience, class shame, debt, and Pip’s guilt/self-deception
- Compeyson cannot be labeled maternal obligation
- Miss Havisham and Compeyson cannot be marked unresolved when death/resolution evidence exists

### PR 10 — Source Integrity health dashboard

Scope:

- semantic blocker aggregation

Source Integrity should report:

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
- `DEPENDENT_LAYER_FAILED_IDENTITY_INHERITANCE`

Acceptance:

- Source Integrity surfaces real root blockers
- false `he/him` pronoun warnings do not crowd out fatal identity failures
- Source Integrity status can be clean, degraded, failed, or author-overridden

### PR 11 — Review Gate provenance

Scope:

- clean approval vs author override

Add first-class approval states:

```ts
ledger_approval_status:
  | "clean_approved"
  | "approved_with_author_override"
  | "rejected";

ledger_has_known_issues: boolean;
ledger_issue_count: number;
ledger_override_notes: jsonb;
downstream_quality_warning: boolean;

extraction_health_status:
  | "clean"
  | "needs_review"
  | "known_bad_author_override";
```

Acceptance:

- any wrong layer without note disables approval
- wrong layer with note permits author override
- override proceeds to Phase 2 if the user chooses
- override is excluded from clean extraction metrics
- downstream phases receive warning

### PR 12 — Great Expectations regression fixture

Scope:

- proof

Fixture must verify:

- Pip / Philip Pirrip is protagonist
- Pip / Philip Pirrip is sole POV owner
- Young Pip, Joe and Biddy’s son is separate minor/end-state child
- Herbert Pocket is not co-protagonist
- Herbert Pocket is not POV owner
- `he/him` does not trigger SHIFT
- Magwitch aliases merge
- relationship graph keys by canonical IDs
- Pip–Magwitch is a top relationship
- Pip–Joe is a top relationship
- Pip–Estella is a top relationship
- Estella–Miss Havisham is a top relationship
- threat systems exceed antagonist-only count
- Compeyson is criminal antagonist
- Miss Havisham terminal state is resolved
- Compeyson terminal state is resolved
- Source Integrity reports root blockers when any of these fail

## Merge rule

No PR should merge unless it makes one specific Great Expectations failure impossible to repeat silently.

## Final standard

A Story Ledger can be called clean only when:

- Canonical Identity passes
- Alias merge passes
- Pronoun normalization passes
- POV evidence passes
- Relationships use canonical IDs
- Timeline / location types are normalized
- Threat / pressure coverage is sufficient
- Source Integrity reports no blockers
- Review Gate approval is clean, not override
