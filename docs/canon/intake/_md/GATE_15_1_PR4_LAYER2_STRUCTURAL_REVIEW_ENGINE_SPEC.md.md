**GATE\_15\_1\_PR4\_LAYER2\_STRUCTURAL\_REVIEW\_ENGINE\_SPEC.md**

**RevisionGrade — PR4 Layer 2 Structural Review Engine Specification**

**Scope:** PR4 only
**Purpose:** Implement **Layer 2 — Structural Validation** for Gate 15.1 so dialogue can be tested for independence, voice clarity, and rhythmic integrity after Layer 1 passes.

**1. Objective**

PR4 implements the **structural review engine** for Gate 15.1.

This PR must evaluate three binary checks:

* **D1 — Attribution Independence**
* **D2 — Voice Differentiation Integrity**
* **D3 — Rhythm Integrity**

PR4 must:

* extract high-value dialogue exchanges from chapter text
* generate a derived “tag-stripped” review version where needed
* assess whether dialogue remains clear without attribution crutches
* return binary PASS/FAIL judgments with concise rationale
* persist Layer 2 review output in canonical schema form
* remain composable so Governance can call it as a standalone review stage

PR4 does **not** implement:

* Layer 1 scanning logic
* governance blocking rules
* front-end UI
* final exception approval workflow

**2. Layer 2 Review Scope**

Layer 2 exists because **counts are not enough**.

A chapter may pass Layer 1 thresholds and still fail structurally if:

* speakers are not distinguishable without tags
* dialogue rhythm feels mechanically tagged
* voice identity collapses when attribution is removed

Layer 2 confirms that dialogue architecture is **actually strong**, not merely low-count.

**3. Deliverables**

**New files**

/packages/review/dialogue-extractor.ts
/packages/review/tag-stripper.ts
/packages/review/gate15-layer2-review.ts
/packages/review/gate15-layer2-prompt.ts
/packages/schemas/layer2-review.schema.ts

**Test files**

/packages/review/\_\_tests\_\_/dialogue-extractor.test.ts
/packages/review/\_\_tests\_\_/tag-stripper.test.ts
/packages/review/\_\_tests\_\_/gate15-layer2-review.test.ts

**Optional fixtures**

/data/fixtures/layer2-dialogue-pass.txt
/data/fixtures/layer2-dialogue-fail-attribution.txt
/data/fixtures/layer2-dialogue-fail-rhythm.txt

**4. Required Output Contract**

**File**

/packages/schemas/layer2-review.schema.ts

export type PassFail = "PASS" | "FAIL";

export interface Layer2FlaggedInstance {
 lineStart: number;
 lineEnd?: number;
 category: "D1" | "D2" | "D3";
 excerpt: string;
 rationale: string;
}

export interface Layer2CriterionResult {
 status: PassFail;
 rationale: string;
 instances: Layer2FlaggedInstance[];
}

export interface Gate15Layer2Result {
 chapterId: string;
 manuscriptId: string;
 status: PassFail;
 attributionIndependence: Layer2CriterionResult;
 voiceDifferentiationIntegrity: Layer2CriterionResult;
 rhythmIntegrity: Layer2CriterionResult;
 reviewerType: "AI" | "HUMAN";
 createdAt: string;
}

**5. Dialogue Extractor**

**File**

/packages/review/dialogue-extractor.ts

**Purpose**

Identify dialogue-heavy exchanges worth structural review.

Layer 2 should not inspect the entire chapter blindly. It should isolate **high-risk exchanges** where structural weakness is most likely to appear.

**Required export**

export interface DialogueExchange {
 id: string;
 lineStart: number;
 lineEnd: number;
 originalText: string;
 containsAttribution: boolean;
 containsActionBeats: boolean;
 dialogueLineCount: number;
}

export function extractDialogueExchanges(text: string): DialogueExchange[];

**Required detection targets**

* consecutive quoted lines
* dialogue blocks with nearby attribution tags
* mixed dialogue/action sequences
* exchanges with 2+ speakers
* exchanges where tags are carrying identification load

**Selection rule**

If too many exchanges are found, prioritize:

1. longest exchanges
2. exchanges with attribution tags
3. exchanges with alternating speakers
4. exchanges with repeated tag cadence

**6. Tag Stripper**

**File**

/packages/review/tag-stripper.ts

**Purpose**

Create a derived version of each exchange with attribution tags removed so D1 can be tested directly.

**Required export**

export interface StrippedDialogueExchange {
 id: string;
 lineStart: number;
 lineEnd: number;
 originalText: string;
 strippedText: string;
}

export function stripDialogueTags(exchange: DialogueExchange): StrippedDialogueExchange;

**Required behavior**

Remove likely attribution constructions such as:

* "..." he said.
* "..." she asked.
* "..." Mike replied.
* "..." he whispered.
* "..." she murmured.

**Important rule**

Do **not** aggressively remove action beats that are doing structural work.

Examples:

* Keep: "..." He stepped back from the table.
* Remove: "..." he said.

This is not a prose cleaner. It is a **test artifact generator**.

**7. D1 — Attribution Independence**

**Definition**

If attribution tags are removed, speaker identity should remain clear through:

* position
* voice
* context
* action structure

**Required rule**

A dialogue exchange fails D1 if, after tag stripping:

* speaker identity becomes unclear
* turn order becomes guesswork
* attribution was doing necessary identity work

**Required result behavior**

Return:

* PASS if dialogue remains clear
* FAIL if dialogue collapses without tags

**Required output**

At least one flagged instance for each failed exchange.

**8. D2 — Voice Differentiation Integrity**

**Definition**

Speakers in a multi-line exchange must remain identifiable through voice alone or through minimal structural context.

**Signals of differentiation**

* lexical preference
* sentence rhythm
* degree of formality
* cultural register
* emotional compression vs expansiveness
* question vs statement patterns
* character-specific phrasing

**Failure signals**

* interchangeable dialogue
* generic response structure
* same cadence across speakers
* identity recoverable only through tags

**Required rule**

If two or more speakers sound functionally interchangeable within an exchange, D2 fails.

**9. D3 — Rhythm Integrity**

**Definition**

Dialogue must not fall into mechanical cadence patterns created by repetitive tag placement or beat repetition.

**Failure signals**

* said… said… said… cadence
* repeated beat rhythm after every line
* identical sentence/response lengths creating metronomic feel
* over-regular alternation that sounds processed rather than lived

**Required rule**

If the exchange exhibits mechanical cadence rather than purposeful variation, D3 fails.

**Important note**

Rhythm failure can occur even when attribution is technically clear.

**10. Review Engine**

**File**

/packages/review/gate15-layer2-review.ts

**Required export**

import { Gate15Layer2Result } from "@/packages/schemas/layer2-review.schema";

export interface RunGate15Layer2Input {
 manuscriptId: string;
 chapterId: string;
 rawText: string;
}

export async function runGate15Layer2Review(
 input: RunGate15Layer2Input
): Promise<Gate15Layer2Result>;

**Required flow**

extract dialogue exchanges
→ strip attribution tags where applicable
→ evaluate D1
→ evaluate D2
→ evaluate D3
→ assemble canonical Layer 2 result

**11. Review Prompt / AI Adapter**

**File**

/packages/review/gate15-layer2-prompt.ts

**Purpose**

Provide a deterministic, binary-oriented review instruction for AI-assisted evaluation.

**Prompt requirements**

The prompt must instruct the reviewer to:

* evaluate only D1, D2, D3
* return PASS or FAIL only
* avoid “mostly,” “somewhat,” “partially,” or “uncertain”
* cite line ranges or excerpts where failure occurs
* distinguish between attribution clarity and voice clarity
* treat rhythm as an independent criterion

**Example review frame**

Evaluate the supplied dialogue exchange against three criteria only:

D1 Attribution Independence:
If dialogue tags are removed, does speaker identity remain clear?

D2 Voice Differentiation Integrity:
Do speakers remain distinguishable by voice, phrasing, or structural context?

D3 Rhythm Integrity:
Does the exchange avoid mechanical tag cadence or repetitive beat patterns?

Return PASS or FAIL for each criterion. No partial credit. Include concise rationale and cite the failing excerpt where applicable.

**12. Review Strategy**

**Preferred review order**

For each exchange:

1. inspect original text
2. inspect stripped version
3. judge D1 first
4. judge D2 second
5. judge D3 third

**Why this order matters**

* D1 tests dependency
* D2 tests character-specific distinction
* D3 tests line-level motion

This keeps the criteria from collapsing into one another.

**13. Aggregation Rules**

**Chapter-level status**

The overall Layer 2 result is:

* **PASS** only if D1, D2, and D3 all PASS
* **FAIL** if any one of D1, D2, or D3 FAILS

**Criterion aggregation**

If multiple exchanges are reviewed:

* one failed exchange is sufficient to fail that criterion
* rationale should summarize the strongest failure case
* flagged instances should include representative failures, not necessarily every possible one

**14. Determinism Requirements**

Layer 2 may use AI assistance, but output behavior must still be constrained.

Requirements:

* binary outputs only
* consistent prompt structure
* no narrative drift into unrelated critique
* no macro story comments
* no recommendations outside D1–D3 scope

If a human reviewer is used, the same output schema and binary constraints apply.

**15. Test Plan**

**Unit tests — dialogue extractor**

* finds quoted dialogue blocks correctly
* preserves line ranges
* identifies attribution-containing exchanges
* identifies multi-line exchanges

**Unit tests — tag stripper**

* removes simple tags correctly
* preserves action beats
* does not corrupt dialogue content
* returns deterministic stripped output

**Unit tests — aggregation**

* single D1 fail causes overall Layer 2 fail
* single D2 fail causes overall Layer 2 fail
* single D3 fail causes overall Layer 2 fail

**Integration tests**

* pass fixture returns PASS on all criteria
* attribution-dependent fixture fails D1
* interchangeable-voice fixture fails D2
* repetitive-cadence fixture fails D3

**16. Example Result Shape**

{
 "chapterId": "ch\_078",
 "manuscriptId": "ms\_cartel\_babies",
 "status": "FAIL",
 "attributionIndependence": {
 "status": "FAIL",
 "rationale": "When attribution tags are removed, speaker turns become unclear in the central exchange.",
 "instances": [
 {
 "lineStart": 144,
 "lineEnd": 151,
 "category": "D1",
 "excerpt": "\"Where were you?\" \"At the truck.\" \"Why?\"",
 "rationale": "Speaker identity cannot be recovered confidently without tags."
 }
 ]
 },
 "voiceDifferentiationIntegrity": {
 "status": "PASS",
 "rationale": "The two speakers retain distinct lexical habits and power posture.",
 "instances": []
 },
 "rhythmIntegrity": {
 "status": "FAIL",
 "rationale": "The exchange falls into repetitive beat-and-tag cadence.",
 "instances": [
 {
 "lineStart": 152,
 "lineEnd": 160,
 "category": "D3",
 "excerpt": "\"...\" he said. \"...\" she said. \"...\" he said.",
 "rationale": "Tag placement creates a mechanical metronomic rhythm."
 }
 ]
 },
 "reviewerType": "AI",
 "createdAt": "2026-03-22T20:40:00Z"
}

**17. Integration Contract with PR3**

PR3 Governance calls PR4 only after Layer 1 passes.

Required integration behavior:

* Layer 2 result must be persisted to evidence pack
* any FAIL result must block Wave 16 progression
* governance log must include D failure reason
* chapter state becomes gate15\_failed\_layer2 on failure

PR4 itself does **not** enforce blocking. It only returns canonical results.

**18. Done Definition**

PR4 is complete only when:

* dialogue extractor compiles and passes tests
* tag stripper compiles and passes tests
* Layer 2 review engine returns canonical schema
* D1, D2, D3 all return binary PASS/FAIL
* representative fixtures validate expected failures
* PR3 can consume Layer 2 output without schema mismatch

**19. Next Step**

Proceed to:

**PR5 — Front-End Visibility**

This will expose:

* Gate 15.1 summary card
* Q1–Q5 and D1–D3 results
* flagged line table
* governance log panel
* resubmit / rerun controls

**20. Final System Effect**

After PR4:

* Gate 15.1 no longer checks only counts
* it now verifies actual dialogue architecture
* passing low counts cannot hide weak structural dialogue
* the system can distinguish “clean numbers” from **real authority**

Top of Form

Bottom of Form
