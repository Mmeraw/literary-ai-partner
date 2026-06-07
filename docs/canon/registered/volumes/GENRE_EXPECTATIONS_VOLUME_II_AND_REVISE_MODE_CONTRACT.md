---
canon_status: doctrine_candidate
domain: genre-expectations-volume-ii-and-revise-mode-contract
supersedes: []
superseded_by: null
runtime_binding: consideration
---

# Genre Expectations Volume II and Revise Mode Contract

**Document status:** Evaluation Contract / Doctrine Candidate  
**Product area:** RevisionGrade Evaluation, Revise Queue, TrustedPath  
**Applies to:** Short-form evaluation, long-form evaluation, revision opportunity ledger, Revise Workbench, TrustedPath  
**Purpose:** Prevent genre-flattening, voice drift, and mode/voice contract loss between evaluation and revision.

---

## 1. Revise Mode Contract Must Survive Evaluation to TrustedPath

This is a critical RevisionGrade doctrine point.

### Before

There was a real risk that:

```text
Author chooses TESTIMONY + MAXIMUM
        ↓
Evaluation understands that
        ↓
Revise Queue loses it
        ↓
TrustedPath defaults to STANDARD + BALANCED
        ↓
Voice drift
```

That would violate RevisionGrade doctrine.

TrustedPath must never silently flatten an author’s selected revision contract into a generic default.

### After

The intended contract is:

```text
Evaluation
    ↓
confirmed_mode
    ↓
evaluation_jobs
    ↓
revision_opportunity_ledger_v1
    ↓
WorkbenchQueuePayload
    ↓
TrustedPath
```

with fail-closed behavior if the contract disappears.

If the selected mode/voice contract is missing, ambiguous, or not explicitly confirmed, TrustedPath automation must not proceed.

---

## 2. TrustedPath Is A-Only, but A Is Not Generic

TrustedPath does not need nine buttons.

The author’s 3×3 selection should already be baked into the generated candidate options.

TrustedPath applies:

```text
Option A = Recommended repair
           within the confirmed mode/voice contract
           within the diagnosed genre
           within the evaluated author voice
```

Therefore, Option A is not “standard/balanced prose” unless the author explicitly selected that cell.

Option A must inherit:

- confirmed revision mode,
- confirmed voice preservation level,
- diagnosed genre,
- target audience,
- dominant craft engine,
- author voice fingerprint,
- passage-level evidence,
- revision operation type.

TrustedPath should apply A only when that inherited contract permits automation.

---

## 3. Genre-Fit Evaluation Doctrine

The evaluator must not penalize a manuscript for belonging to its actual genre.

A memoir must not be penalized because it is not a thriller.

A literary chapter must not be penalized because it does not end like commercial suspense.

A reflective work must not be penalized for reflection when reflection is the craft engine.

The evaluator must measure:

```text
Genre expectation fit
Reader promise fulfillment
Dominant craft engine execution
```

not generic assumptions such as:

```text
More dialogue = better
Faster pacing = better
More action = better
More plot acceleration = better
```

---

## 4. Current Genre-Fit Foundation

The current genre expectation system is broader than a few isolated examples.

It already recognizes profile families such as:

- propulsion,
- reflection,
- atmosphere,
- dread,
- puzzle,
- emotional payoff,
- voice,
- world concept,
- experimental form.

This is a strong foundation.

It is sufficient to prevent the dangerous failure:

```text
Memoir gets punished because it is not a thriller.
```

However, it is not yet mature enough to support fully differentiated genre intelligence across every major manuscript type.

---

## 5. Current Weakness: Genre Families Are Too Broad

Some genres currently collapse into broad expectation buckets.

For example:

```text
Fantasy
Science Fiction
Speculative Fiction
```

may collapse largely into:

```text
world_concept_forward
```

That is not specific enough for mature evaluation.

These are different books with different reader promises and craft expectations.

### Epic Fantasy

Epic fantasy may require:

- worldbuilding load tolerance,
- ensemble cast tolerance,
- slower setup tolerance,
- lore density tolerance,
- quest structure expectations,
- mythic scale,
- political or dynastic complexity,
- magic-system or cosmology coherence.

### Military Science Fiction

Military science fiction may require:

- operational clarity,
- technology coherence,
- chain-of-command realism,
- tactical cause and effect,
- logistical plausibility,
- mission pressure,
- institutional stakes.

### Literary Speculative Fiction

Literary speculative fiction may require:

- idea resonance,
- thematic exploration,
- metaphorical or symbolic logic,
- tonal control,
- ambiguity tolerance,
- emotional or philosophical payoff over action velocity.

These should not be evaluated as interchangeable.

---

## 6. Thriller and Suspense Must Not Collapse

Current clustering can also over-flatten:

```text
thriller
suspense
action
commercial
```

These are related but not identical.

### Suspense

Suspense often rewards:

- uncertainty,
- dread,
- anticipation,
- withheld information,
- slow pressure,
- psychological unease,
- controlled reveal timing.

### Action Thriller

Action thriller often rewards:

- velocity,
- escalation,
- decisions,
- physical stakes,
- tactical reversals,
- scene propulsion,
- compressed reaction time.

A suspense manuscript should not automatically be told to accelerate like an action thriller.

An action thriller should not be excused for diffuse movement if the reader promise is velocity and escalation.

---

## 7. Romance Needs Subgenre-Specific Expectations

Romance should not collapse merely into:

```text
emotional_payoff_forward
```

Romance evaluation may need to account for:

- relationship progression,
- romantic tension,
- emotional intimacy,
- HEA/HFN expectations,
- consent and agency,
- chemistry,
- internal/external conflict balance,
- trope execution,
- heat level expectations,
- reader payoff timing.

A literary relationship drama, romantic suspense novel, romantasy, and contemporary romance do not share the same full reader contract.

---

## 8. Genre Expectations Volume II

RevisionGrade should add a second-layer genre expectation system.

The structure should be:

```text
Genre
    ↓
Reader Promise
    ↓
Craft Expectations
    ↓
Protected Behaviors
    ↓
Failure Modes
```

### Required Genre Coverage

Genre Expectations Volume II should include, at minimum:

- Literary Fiction
- Upmarket Fiction
- Memoir
- Spiritual Memoir
- Historical Fiction
- Epic Fantasy
- Urban Fantasy
- Science Fiction
- Military Science Fiction
- Speculative Fiction
- Horror
- Gothic Horror
- Thriller
- Suspense
- Mystery
- Crime
- Romance
- Young Adult
- Middle Grade
- Comedy
- Satire
- Drama
- Experimental Fiction
- Creative Nonfiction

Other nonfiction categories may require a separate evaluation mode rather than the standard 13 story criteria.

---

## 9. Genre Profile Schema Proposal

Each genre profile should define:

```ts
type GenreExpectationProfileV2 = {
  genre_key: string;
  display_name: string;
  parent_family: string;

  reader_promise: string[];

  expected_strengths: string[];
  protected_behaviors: string[];
  common_false_positives: string[];
  legitimate_failure_modes: string[];

  pacing_expectation: {
    default: "fast" | "moderate" | "slow" | "variable";
    protected_when: string[];
    failure_when: string[];
  };

  dialogue_expectation: {
    density: "high" | "moderate" | "low" | "variable";
    protected_when: string[];
    failure_when: string[];
  };

  structure_expectation: {
    common_forms: string[];
    protected_forms: string[];
    failure_modes: string[];
  };

  recommendation_suppression_rules: string[];
  recommendation_translation_rules: string[];
};
```

---

## 10. Examples of Genre-Specific Evaluation Logic

### Memoir

Protected behaviors:

- reflection,
- interiority,
- memory logic,
- episodic structure,
- lower dialogue density,
- thematic repetition,
- voice-led pacing.

Do not penalize memoir for:

- not having thriller-like acceleration,
- lower scene count,
- lower dialogue density,
- reflective pauses,
- nonlinear memory structure.

Penalize memoir only when:

- reflection becomes redundant rather than revelatory,
- memory logic becomes confusing,
- scenes lack emotional consequence,
- the narrator’s self-interrogation does not deepen,
- chronology obscures meaning rather than enriching it.

### Epic Fantasy

Protected behaviors:

- longer setup,
- lore density,
- invented terminology,
- ensemble cast,
- multiple locations,
- mythic scale.

Penalize epic fantasy when:

- worldbuilding lacks consequence,
- exposition stalls character agency,
- lore terms are introduced without usable context,
- ensemble threads do not converge,
- magic/power systems lack stable rules,
- quest or conflict stakes remain abstract.

### Suspense

Protected behaviors:

- uncertainty,
- dread,
- withheld information,
- slow pressure.

Penalize suspense when:

- withholding becomes confusion,
- dread does not escalate,
- clues do not accumulate,
- uncertainty lacks directional pressure.

### Action Thriller

Protected behaviors:

- fast turns,
- compressed reaction time,
- danger escalation,
- decisive movement.

Penalize action thriller when:

- scene goals are unclear,
- action lacks spatial clarity,
- decisions do not alter the situation,
- escalation plateaus,
- consequence does not follow action.

### Comedy / Satire

Protected behaviors:

- exaggeration,
- tonal rupture,
- comic timing,
- absurdity,
- incongruity,
- recurring bits.

Penalize comedy/satire when:

- jokes do not escalate,
- comic premise is unclear,
- satire lacks target,
- tonal rupture breaks rather than sharpens reader trust,
- repetition does not transform.

---

## 11. Acceptance Criteria

GitHub should implement and test Genre Expectations Volume II with the following acceptance criteria.

### Evaluation Behavior

- Memoir is not penalized for slower pacing unless explicit malfunction evidence exists.
- Memoir is not penalized for lower dialogue density unless dialogue is required by the passage’s own promise.
- Literary fiction is not penalized for contemplative or atmospheric endings when atmosphere is the dominant craft engine.
- Suspense and action thriller receive different pacing expectations.
- Epic fantasy and military science fiction receive different worldbuilding/coherence expectations.
- Romance receives relationship-progression and emotional-payoff expectations.
- Comedy and satire receive humor/timing/target expectations.

### Recommendation Behavior

- Genre-protected behaviors must not become automatic revision opportunities.
- Commercial-fiction advice must not be applied to literary, memoir, contemplative, or atmosphere-forward work unless malfunction evidence exists.
- Genre-aware suppression must produce status metadata, not silence.
- Recommendation text must explain when a passage is genre-appropriate and no revision is warranted.

### Revise Behavior

- revision_opportunity_ledger_v1 must carry genre/craft-engine context.
- Revise Queue must preserve genre/craft-engine context.
- A/B/C candidate generation must be genre-calibrated.
- TrustedPath must apply A only within the confirmed mode/voice/genre contract.
- Missing mode/voice/genre contract must fail closed for automation.

### Regression Tests

Add tests proving:

- the same reflective passage is protected in memoir but questioned in action thriller,
- the same slow-burn uncertainty is protected in suspense but questioned in action thriller when it stalls velocity,
- epic fantasy lore density is not automatically treated as over-exposition,
- military SF operational incoherence is caught even when prose is strong,
- romance without relationship progression receives genre-specific critique,
- comedy without escalation/timing receives genre-specific critique,
- TrustedPath refuses automation when mode/voice contract is missing.

---

## 12. Current Assessment

| Area | Status |
|---|---|
| Memoir not penalized for pace/dialogue | Good |
| Literary not penalized for commercial pacing | Good |
| Thriller allowed propulsion guidance | Good |
| Genre-fit override exists | Good |
| Genre taxonomy depth | Moderate |
| Genre-specific reader promises | Needs expansion |
| Full genre intelligence system | Not yet |

---

## 13. Implementation Priority

This is not an emergency repair.

The current system appears sufficient to prevent the most dangerous error:

```text
Memoir gets punished because it is not a thriller.
```

Genre Expectations Volume II is the next refinement layer:

```text
Epic fantasy should be evaluated differently from military science fiction.
Suspense should be evaluated differently from action thriller.
Romance should be evaluated by romance reader promises.
Comedy should be evaluated by comic mechanics.
```

This should become a major evaluation-contract expansion after the core evaluation and Revise Queue systems are stable.

---

## 14. Doctrine Summary

RevisionGrade must not evaluate manuscripts against a generic idea of “good writing.”

RevisionGrade must evaluate manuscripts against:

```text
The manuscript’s diagnosed genre
The manuscript’s reader promise
The manuscript’s dominant craft engine
The author’s chosen mode/voice contract
The evidence present in the submitted text
```

The goal is not to make every manuscript faster, cleaner, safer, or more commercial.

The goal is to determine whether the manuscript is fulfilling the kind of book it is trying to be.
