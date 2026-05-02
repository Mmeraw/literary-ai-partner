**RevisionGrade — Output Quality Upgrade Spec**

**Workstream:** Recommendation Semantics Contract
**Goal:** Improve report sharpness, reduce semantic redundancy, strengthen editorial usefulness, and align Pass 3 generation with QualityGate enforcement.

**1. Problem Statement**

Current recommendation objects are structurally valid but semantically weak. They preserve surface actions, but they do not encode enough editorial meaning for deterministic clustering, non-redundancy enforcement, or strong final synthesis.

This creates four recurring quality problems:

1. **Semantic duplication passes as novelty**
   Different phrasings of the same fix survive because dedupe is largely text-based.
2. **Pass 3 must infer too much live**
   It has to guess issue class, leverage, and revision level from prose instead of receiving that structure explicitly.
3. **QualityGate can reject obvious defects but cannot sharpen output decisively**
   It sees malformed or thin content, but not topical overlap or lever repetition.
4. **Writer-facing usefulness is weaker than it should be**
   Reports often diagnose well but do not always collapse into one strong editorial posture.

**2. Scope**

This workstream covers:

* recommendation schema upgrade
* Pass 3 output contract alignment
* QualityGate semantic non-redundancy checks
* agreement-rationale contract cleanup
* submission readiness field addition

This workstream does **not** include:

* queue tuning
* worker budget changes
* claim/dispatch changes
* LLR-003 redesign
* large-scale pipeline rewrites

**3. Objectives**

**MUST**

* Add semantic fields to recommendation objects so duplication can be detected conceptually, not only textually.
* Update Pass 3 so those fields are emitted deliberately.
* Update QualityGate so same-lever redundancy is caught deterministically.
* Remove the current tension between Pass 3 “Confirmed.” output and thin-rationale thresholds.
* Add a structured writer-facing readiness signal above the criteria layer.

**SHOULD**

* Preserve backward compatibility during rollout.
* Prefer controlled vocabularies or normalized values over free-form semantic labels.
* Keep the first version narrow and enforceable, not overdesigned.

**MUST NOT**

* Expand Pass 3 responsibility.
* Introduce open-ended prose fields that duplicate existing rationale text.
* Break legacy artifacts without a transition path.

**4. Current Gaps**

**4.1 Recommendation schema is too thin**

Current fields:

* priority
* action
* expected\_impact
* anchor\_snippet
* source\_pass

These fields describe the recommendation but do not classify it.

**4.2 QualityGate dedupe is too literal**

It can catch exact or near-text duplicates, but not conceptual duplicates like:

* “increase forward momentum”
* “interleave action beats”
* “vary scene rhythm”

These are often the same editorial lever.

**4.3 Pass 3 / QualityGate contract conflict**

Pass 3 prompt currently allows or encourages very short agree-state rationale such as "Confirmed.", while QualityGate expects a materially longer rationale. That creates avoidable friction and inconsistency.

**4.4 Verdict layer is structurally incomplete**

The system has verdict-like fields, but it does not force a clean submission-readiness posture:

* queryable\_now
* close
* not\_yet

That weakens the writer-facing utility of the final artifact.

**5. Proposed Contract Changes**

**5.1 Recommendation schema upgrade**

**New fields**

Add the following fields to the recommendation type:

* issue\_family
* strategic\_lever
* revision\_granularity

**Strongly recommended additional fields**

Add now if low-friction, otherwise add in phase 1.1:

* confidence
* redundancy\_key
* evidence\_span\_count

**Definitions**

**issue\_family**

Broad craft/problem class.

Examples:

* pacing
* dialogue
* closure
* characterization
* exposition
* tension
* prose\_control
* scene\_structure
* voice
* market\_positioning

**strategic\_lever**

Higher-order editorial move. This is the main semantic dedupe handle.

Examples:

* momentum\_visibility
* dialogue\_exposition\_density
* scene\_goal\_clarity
* closure\_state\_lock
* character\_voice\_differentiation
* tension\_escalation
* exposition\_load\_reduction
* prose\_compression
* market\_signal\_clarity

**revision\_granularity**

Where the fix primarily operates.

Allowed values:

* line
* beat
* scene
* chapter
* manuscript

**confidence optional but recommended**

Allowed values:

* high
* medium
* low

**redundancy\_key optional but recommended**

Normalized deterministic string used for grouping/collapse. Example:
pacing:momentum\_visibility:scene

**evidence\_span\_count optional but recommended**

Count of distinct evidence spans supporting the recommendation.

**6. Canonical Value Strategy**

**6.1 MUST prefer controlled values**

Do not allow unconstrained free-text semantic labels in v1 unless normalized immediately after generation.

**Recommendation**

Implement:

* controlled enum or union for issue\_family
* controlled enum or union for revision\_granularity
* controlled enum or canonical normalization table for strategic\_lever

**6.2 MUST normalize before QualityGate**

If Pass 3 emits slightly variant strings, normalize them before validation.

Example:

* “forward momentum”
* “momentum visibility”
* “scene momentum”

should normalize to:

* momentum\_visibility

**7. Pass 3 Contract Changes**

**7.1 Pass 3 MUST emit semantic recommendation fields**

Pass 3 should not imply these fields only in prose. It must populate them directly for every recommendation.

**7.2 Pass 3 MUST NOT rediscover issue class in prose only**

If a recommendation is about pacing through scene drift, that classification must appear in:

* issue\_family
* strategic\_lever
* revision\_granularity

not just inside rationale text.

**7.3 Agree-state rationale contract MUST change**

Remove or replace instructions that permit "Confirmed." as sufficient rationale.

**New rule**

For criteria in an agree state, final\_rationale must briefly state:

* what was confirmed
* what evidence basis supported that confirmation
* why that confirmation matters

This can be short, but it must be substantive.

Example acceptable pattern:
“Both upstream passes converge on strong scene-level tension escalation, supported by the same evidence cluster around escalating consequence and narrowing choice. This confirms the criterion as a genuine strength rather than a single-pass overread.”

**MUST NOT**

* allow one-word or one-sentence empty confirmations
* weaken QualityGate merely to excuse weak Pass 3 wording

**8. QualityGate Extensions**

**8.1 Add semantic redundancy rule**

QualityGate must validate recommendation non-redundancy at the semantic level.

**MUST flag**

Two or more recommendations that share:

* same strategic\_lever
* same or closely related issue\_family
* same or overlapping revision\_granularity

unless justified by clearly distinct evidence or scope.

**SHOULD allow**

Same strategic\_lever only if:

* one is scene-level and one is manuscript-level, and
* they are supported by different evidence clusters, and
* the distinction is editorially real rather than cosmetic

**8.2 Add lever repetition rule**

A report should not over-concentrate its top recommendations on the same lever.

**MUST**

Reject or warn when top recommendations collapse to one lever disguised in multiple phrasings.

Example:

* increase momentum
* vary rhythm
* interleave action
* reduce reflective drag

These should likely collapse into one lever:

* momentum\_visibility

**8.3 Add semantic justification requirement**

If repeated lever usage is allowed, it must include explicit justification:

* different criterion
* different evidence base
* different revision scale
* genuinely distinct fix objective

**8.4 Severity calibration SHOULD remain aligned**

QualityGate should continue ensuring recommendation tone matches score severity.

A moderate issue should not sound catastrophic. A high-confidence strength should not sound vague.

**9. Submission Readiness Addition**

**9.1 Add explicit readiness field to overall synthesis**

Add:

submission\_readiness: "queryable\_now" | "close" | "not\_yet"

**9.2 Purpose**

This gives the writer a decisive editorial posture that is more actionable than pass/revise/fail alone.

**9.3 Interpretation**

* queryable\_now = strong enough to submit, though not necessarily finished in absolute terms
* close = viable foundation, but one focused revision pass would materially improve requestability
* not\_yet = substantial issues still prevent strong submission posture

**9.4 MUST align with report body**

This field must not contradict:

* top risks
* verdict
* criterion distribution
* recommendation severity

**10. File-Level Change Plan**

**Priority 1 — Schema**

**File:** types.ts

**MUST**

Add to recommendation type:

* issue\_family
* strategic\_lever
* revision\_granularity

**SHOULD**

Also add:

* confidence
* redundancy\_key
* evidence\_span\_count

**MUST**

Add to overall synthesis type:

* submission\_readiness

**Priority 2 — Pass 3 generation contract**

**File:** runPass3Synthesis.ts or prompt-definition file

**MUST**

Update prompt/schema instructions so Pass 3 emits:

* semantic recommendation fields
* substantive agree-state rationale
* submission\_readiness

**MUST**

Remove or supersede instructions that permit "Confirmed."

**SHOULD**

Include brief guidance:

* avoid semantic duplicates
* collapse synonymous recommendations to one lever
* use repeated levers only with real scope distinction

**Priority 3 — QualityGate enforcement**

**File:** qualityGate.ts

**MUST**

Add validation for:

* repeated strategic\_lever
* repeated lever + same-family overlap
* ungrounded repeated lever usage
* semantic dedupe using normalized values

**SHOULD**

Implement rule names that are audit-friendly and specific, for example:

* QG\_DUPLICATE\_STRATEGIC\_LEVER
* QG\_REDUNDANT\_RECOMMENDATION\_FAMILY
* QG\_UNJUSTIFIED\_LEVER\_REUSE

**MUST**

Differentiate between:

* blocking redundancy
* warn-level near-overlap

**Priority 4 — Optional normalization utility**

**File:** new helper, likely near synthesis/quality utilities

**SHOULD**

Create normalization helpers:

* normalizeIssueFamily()
* normalizeStrategicLever()
* buildRedundancyKey()

This reduces drift and keeps validation deterministic.

**11. Backward Compatibility Plan**

**11.1 Transition requirement**

Do not assume all existing artifacts or upstream emitters populate the new fields immediately.

**MUST choose one rollout path**

**Option A — soft rollout**

* new fields optional initially
* normalization/inference fills gaps where possible
* QualityGate warns before blocking

**Option B — hard rollout**

* new fields required for all newly generated Pass 3 artifacts
* legacy artifacts remain readable but are not considered canonical for new releases

**Recommendation**

Use **Option A for one short transition window**, then move to **Option B** once generation is stable.

**11.2 MUST log missing-field rates during transition**

Track how often:

* fields are missing
* fields are unrecognized
* normalization had to coerce values

This will tell you whether the contract is stable enough to harden.

**12. Risks**

**Risk 1 — overfree schema**

If strategic\_lever is free-form, semantic dedupe will remain weak.

**Mitigation:** canonical vocabulary or normalization map.

**Risk 2 — overblocking**

QualityGate may collapse recommendations that are similar in topic but genuinely distinct in action.

**Mitigation:** allow repeated lever usage when evidence base and granularity differ materially.

**Risk 3 — brittle rollout**

Adding required fields too quickly may break older pipeline expectations.

**Mitigation:** staged transition with logging.

**Risk 4 — fake precision**

If the model is forced to emit semantic labels it does not truly understand, labels may become decorative.

**Mitigation:** keep vocabularies tight, examples concrete, and normalization deterministic.

**13. Acceptance Criteria**

**MUST pass**

**A. Schema**

* Recommendation objects include the new semantic fields in newly generated artifacts.
* Overall synthesis includes submission\_readiness.

**B. Prompt alignment**

* Agree-state criteria no longer emit one-word rationale.
* Pass 3 emits semantic labels directly rather than leaving them implicit in prose.

**C. QualityGate**

* A report with semantically duplicate recommendations is flagged even when wording differs.
* Repeated strategic lever usage without justification is blocked or warned according to rule severity.

**D. Editorial quality**

Given a test case with recommendations like:

* “increase forward momentum”
* “interleave action beats”
* “vary scene rhythm”

the final output should collapse these into one primary lever rather than preserving all three as separate top recommendations.

**E. Readiness signal**

Final artifact includes one explicit writer-facing posture:

* queryable\_now
* close
* not\_yet

and it aligns with the rest of the synthesis.

**14. Suggested Implementation Order**

1. types.ts schema extension
2. Pass 3 prompt/output contract update
3. normalization helpers
4. QualityGate semantic redundancy rule
5. submission\_readiness wiring
6. transition logging
7. harden from warn to block once stable

**15. My blunt recommendation**

Do this first.

Not LLR-003 tuning, not broader latency work, not more timeout hardening.

This is the cleanest next move because it improves both:

* **quality**, by making the output less repetitive and more decisive
* **latency**, by reducing how much live inference Pass 3 has to do

The right first slice is not “more intelligence.” It is **better structure for the intelligence you already have**.

If you want, I can turn this into a PR-ready spec in your repo style with sections like:

**Summary / Problem / Scope / Proposed Changes / File Map / Acceptance Tests / Rollout Notes**

Top of Form

\*\*\*

Here is the **PR-ready spec** in your repo style—tight, executable, and aligned with your governance conventions.

**PR — feat: recommendation semantics contract + QualityGate semantic dedupe**

**Summary**

Upgrade the evaluation output contract to introduce **semantic structure for recommendations**, enabling:

* deterministic non-redundancy (beyond text matching)
* stronger Pass 3 synthesis (less repetition, higher authority)
* clearer writer-facing decisions (submission readiness signal)

This PR introduces:

* structured recommendation fields (issue\_family, strategic\_lever, revision\_granularity)
* semantic redundancy enforcement in QualityGate
* Pass 3 contract alignment (no thin “Confirmed.” rationale)
* explicit submission\_readiness signal in final synthesis

**Problem**

Current outputs suffer from **semantic duplication and soft synthesis**, even when upstream passes are correct.

Root causes:

1. **Schema is too thin**
   Recommendations lack classification fields → semantic overlap cannot be detected.
2. **QualityGate dedupe is text-based**
   Different phrasings of the same editorial fix pass through as distinct.
3. **Pass 3 / QualityGate contract conflict**
   Pass 3 allows "Confirmed." → violates QG\_THIN\_RATIONALE.
4. **No explicit readiness posture**
   Verdict exists, but not a clear submission signal (queryable\_now | close | not\_yet).

Result:
Outputs feel repetitive, less decisive, and less useful to writers.

**Scope**

**In scope**

* Recommendation schema upgrade
* Pass 3 output contract alignment
* QualityGate semantic dedupe rules
* Submission readiness signal

**Out of scope**

* Worker/queue/latency infra changes
* LLR-003 redesign (only downstream compatibility)
* Pass pipeline restructuring

**Proposed Changes**

**1. Recommendation Schema Upgrade**

**File: lib/evaluation/types.ts**

**Add to Recommendation (or equivalent)**

type IssueFamily =
 | "pacing"
 | "dialogue"
 | "closure"
 | "characterization"
 | "exposition"
 | "tension"
 | "prose\_control"
 | "scene\_structure"
 | "voice"
 | "market\_positioning";

type StrategicLever =
 | "momentum\_visibility"
 | "dialogue\_exposition\_density"
 | "scene\_goal\_clarity"
 | "closure\_state\_lock"
 | "character\_voice\_differentiation"
 | "tension\_escalation"
 | "exposition\_load\_reduction"
 | "prose\_compression"
 | "market\_signal\_clarity";

type RevisionGranularity =
 | "line"
 | "beat"
 | "scene"
 | "chapter"
 | "manuscript";

type ConfidenceLevel = "high" | "medium" | "low";

export interface Recommendation {
 priority: number;
 action: string;
 expected\_impact: string;
 anchor\_snippet?: string;
 source\_pass: "pass1" | "pass2" | "pass3";

 // NEW — semantic contract
 issue\_family: IssueFamily;
 strategic\_lever: StrategicLever;
 revision\_granularity: RevisionGranularity;

 // OPTIONAL (v1 soft rollout)
 confidence?: ConfidenceLevel;
 redundancy\_key?: string;
 evidence\_span\_count?: number;
}

**2. Submission Readiness Signal**

**File: lib/evaluation/types.ts**

Add to overall synthesis:

type SubmissionReadiness =
 | "queryable\_now"
 | "close"
 | "not\_yet";

export interface SynthesisOverall {
 verdict: "pass" | "revise" | "fail";
 submission\_readiness: SubmissionReadiness; // NEW
 top\_3\_strengths: string[];
 top\_3\_risks: string[];
 one\_paragraph\_summary: string;
}

**3. Pass 3 Contract Update**

**File: lib/evaluation/runPass3Synthesis.ts (or prompt definition)**

**MUST update prompt instructions**

**A. Require semantic fields**

For each recommendation, Pass 3 MUST output:

* issue\_family
* strategic\_lever
* revision\_granularity

**B. Remove weak agree-state rationale**

❌ REMOVE:

agree → final\_rationale = "Confirmed."

✅ REPLACE WITH:

For agreed criteria, briefly state:
- what was confirmed
- what evidence supports it
- why it matters

Minimum: 1–2 sentences with concrete reference.

**C. Add anti-redundancy instruction**

Do not produce multiple recommendations that resolve the same underlying editorial lever.
If multiple recommendations map to the same strategic\_lever, collapse them into one stronger recommendation.

**D. Require submission readiness**

You MUST assign:
submission\_readiness = queryable\_now | close | not\_yet

This must align with:
- top risks
- recommendation severity
- overall verdict

**4. Semantic Normalization Helpers (NEW)**

**File: lib/evaluation/normalization.ts**

export function normalizeStrategicLever(input: string): StrategicLever {
 const map: Record<string, StrategicLever> = {
 "forward momentum": "momentum\_visibility",
 "scene momentum": "momentum\_visibility",
 "increase momentum": "momentum\_visibility",
 "vary rhythm": "momentum\_visibility",

 "reduce exposition in dialogue": "dialogue\_exposition\_density",
 "on-the-nose dialogue": "dialogue\_exposition\_density",
 };

 return map[input.toLowerCase()] ?? input as StrategicLever;
}

export function buildRedundancyKey(rec: Recommendation): string {
 return `${rec.issue\_family}:${rec.strategic\_lever}:${rec.revision\_granularity}`;
}

**5. QualityGate Semantic Dedupe**

**File: lib/evaluation/qualityGate.ts**

**Add new rules**

**Rule: QG\_DUPLICATE\_STRATEGIC\_LEVER**

**Trigger:**

* same strategic\_lever
* same issue\_family
* same revision\_granularity

**Action:**

* BLOCK if >1 recommendation
* unless justified (future extension)

**Rule: QG\_REDUNDANT\_LEVER\_CLUSTER**

**Trigger:**
Multiple recommendations share:

* same strategic\_lever
* but only wording differs

**Action:**

* BLOCK (primary enforcement)
* message: “Recommendations collapse to same strategic lever — must merge”

**Rule: QG\_UNJUSTIFIED\_LEVER\_REUSE**

**Trigger:**
Same strategic\_lever used across multiple criteria without:

* distinct evidence
* distinct granularity

**Action:**

* WARN (v1)
* future: escalate to BLOCK

**Integration point**

Apply after:

* dedupeRecommendationsPreGate
* normalization

**6. Transition Strategy**

**Phase 1 — Soft rollout**

* new fields optional
* normalization fills missing values where possible
* QualityGate:
  + WARN on missing semantic fields
  + BLOCK only on clear redundancy

**Phase 2 — Hard enforcement**

* semantic fields REQUIRED for Pass 3 output
* QualityGate BLOCKS:
  + missing fields
  + duplicate strategic\_lever without justification

**7. Risks & Mitigations**

| **Risk** | **Mitigation** |
| --- | --- |
| Overblocking distinct recommendations | allow granularity-based separation |
| Model emits inconsistent lever names | normalization layer |
| Schema drift | controlled enums |
| Pipeline breakage | soft rollout phase |

**8. Acceptance Criteria**

**MUST**

**A. Semantic dedupe works**

Input:

* “increase forward momentum”
* “interleave action beats”
* “vary scene rhythm”

Output:

* ONE recommendation using:
  strategic\_lever = momentum\_visibility

**B. Pass 3 emits semantic fields**

Every recommendation includes:

* issue\_family
* strategic\_lever
* revision\_granularity

**C. No thin rationale**

No criterion returns:

* "Confirmed."

All rationales:

* ≥ 1–2 sentences
* reference evidence

**D. Submission readiness present**

Final output includes:

submission\_readiness: "queryable\_now" | "close" | "not\_yet"

and aligns with:

* verdict
* risks
* recommendations

**E. QualityGate enforcement**

Reports with:

* repeated strategic\_lever
* no differentiation

→ BLOCKED or WARNED per rule

**9. Testing**

**Add tests:**

* qualityGate.semantic-dedupe.test.ts
* pass3.semantic-output.test.ts

**Cases:**

1. duplicate lever phrasing → blocked
2. distinct granularity same lever → allowed
3. missing semantic fields → warn/block
4. thin rationale → blocked
5. readiness mismatch → blocked

**10. Rollout Notes**

* Deploy behind soft validation first
* Log:
  + missing semantic fields
  + normalization fallback rate
  + dedupe triggers
* After stability:
  + enable hard enforcement

**11. Why this PR matters**

This is not just a schema change.

It is the shift from:

**textual analysis → structured editorial judgment**

It will:

* eliminate “same insight, different wording”
* reduce Pass 3 cognitive load
* improve perceived intelligence of outputs
* strengthen real writer decision-making

**12. Follow-ups (not in this PR)**

* LLR-003 calibration audit
* Pass 3 input slimming (latency phase)
* recommendation-level confidence enforcement
* craft vs market section separation

**Final note (blunt)**

This is the highest-leverage quality upgrade available right now.

It improves:

* clarity
* authority
* usefulness

without increasing system complexity in the wrong place.

Top of Form

Bottom of Form

Bottom of Form
