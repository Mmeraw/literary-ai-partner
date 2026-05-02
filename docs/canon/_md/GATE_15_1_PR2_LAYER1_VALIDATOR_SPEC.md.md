**GATE\_15\_1\_PR2\_LAYER1\_VALIDATOR\_SPEC.md**

**RevisionGrade — PR2 Layer 1 Validator Specification**

**Scope:** PR2 only
**Purpose:** Implement the deterministic Layer 1 validator for Gate 15.1 using the canon and schemas established in PR1.

**1. Objective**

PR2 implements **Layer 1 — Quantitative Detection** for Gate 15.1.

This PR must:

* scan chapter text deterministically
* count controlled vocabulary matches by category
* calculate threshold compliance
* map every match to a line number
* capture a context window for every flagged instance
* emit canonical Gate15Result JSON
* support repeatable output for identical input

PR2 does **not** implement:

* Layer 2 structural review
* governance blocking logic
* front-end rendering
* exception approval workflows

**2. PR2 Deliverables**

**New validator files**

* /packages/validators/gate15-layer1.ts
* /packages/validators/gate15-boundary-test.ts
* /packages/validators/tokenization.ts
* /packages/validators/line-map.ts

**Test files**

* /packages/validators/\_\_tests\_\_/gate15-layer1.test.ts
* /packages/validators/\_\_tests\_\_/gate15-boundary-test.test.ts
* /packages/validators/\_\_tests\_\_/tokenization.test.ts
* /packages/validators/\_\_tests\_\_/line-map.test.ts

**Optional fixtures**

* /data/fixtures/gate15-sample-pass.txt
* /data/fixtures/gate15-sample-fail.txt

**3. Source Dependencies**

PR2 depends on PR1 exports:

* GATE\_15\_1
* CONTROLLED\_VOCABULARY
* GATE15\_THRESHOLDS
* Gate15Result
* Layer1Metric
* FlaggedInstance

No PR2 logic may hardcode canon values outside the canon package.

**4. Validator Responsibilities**

The Layer 1 validator must evaluate:

**Q1 — Attribution Density**

Count all Category A matches and compute frequency per 1,000 words.

**Q2 — Soft-Tag Cap**

Count all Category B matches and compare against chapter threshold.

**Q3 — Thought-Verb Tolerance**

Count all Category C matches.

**Q4 — Physiological Filler Cap**

Count all Category D matches and compare against chapter threshold.

**Q5 — Boundary Test**

Run heuristic quote/italics boundary detection and include its result inside Layer 1 output.

**5. Required Exports**

**/packages/validators/gate15-layer1.ts**

import { Gate15Result } from "@/packages/schemas/gate15.schema";

export interface RunGate15Layer1Input {
 manuscriptId: string;
 chapterId: string;
 rawText: string;
 normalizedText?: string;
}

export function runGate15Layer1(input: RunGate15Layer1Input): Gate15Result;

**/packages/validators/gate15-boundary-test.ts**

import { FlaggedInstance } from "@/packages/schemas/gate15.schema";

export interface BoundaryTestResult {
 status: "PASS" | "FAIL";
 instances: FlaggedInstance[];
 requiresLayer2Confirmation: boolean;
}

export function runBoundaryTest(rawText: string): BoundaryTestResult;

**6. Tokenization Rules**

**File**

/packages/validators/tokenization.ts

**Purpose**

Normalize text for deterministic counting while preserving original text for line references.

**Required functions**

export function normalizeWhitespace(text: string): string;
export function countWords(text: string): number;
export function splitWords(text: string): string[];
export function normalizeForMatching(text: string): string;

**Rules**

* collapse repeated spaces for counting
* preserve line breaks for line mapping
* matching should be case-insensitive
* punctuation should not break valid word matching
* phrase matches like “told himself” must be supported

**7. Line Mapping Rules**

**File**

/packages/validators/line-map.ts

**Purpose**

Translate string index matches into user-visible line references.

**Required types**

export interface LineMapEntry {
 lineNumber: number;
 startIndex: number;
 endIndex: number;
 text: string;
}

**Required functions**

export function buildLineMap(text: string): LineMapEntry[];
export function indexToLineNumber(index: number, lineMap: LineMapEntry[]): number;
export function extractContext(text: string, startIndex: number, endIndex: number, radius?: number): string;

**Rules**

* line numbers must be 1-based
* context extraction must be deterministic
* default context radius should be fixed, e.g. 80 characters on each side
* context must not mutate source text

**8. Matching Strategy**

**Canonical rule**

All matching must use the Controlled Vocabulary Register from PR1.

**Match behavior**

* case-insensitive
* whole-word where appropriate
* phrase-aware where appropriate
* deterministic ordering of returned matches

**Important distinction**

Single-word and phrase matches must both be supported.

Examples:

* single word: said
* phrase: held his breath
* phrase: told himself

**Required helper**

export interface MatchResult {
 matchedText: string;
 category: "Q1" | "Q2" | "Q3" | "Q4";
 startIndex: number;
 endIndex: number;
}

export function findControlledVocabularyMatches(
 text: string
): MatchResult[];

**Ordering rule**

Sort matches by:

1. startIndex
2. longest phrase first when overlaps occur

This prevents shorter tokens from splitting valid phrase matches.

Example:

* held his breath should match as one phrase, not just breath

**9. Q1 Logic — Attribution Density**

**Source**

Category A vocabulary

**Required behavior**

1. count all Q1 matches
2. calculate per-1,000-word frequency
3. FAIL if frequency > threshold
4. create flagged instances for all matched items

**Calculation**

per1000 = (count / wordCount) \* 1000;

**Output requirements**

* count
* per1000
* threshold
* status
* instances

**10. Q2 Logic — Soft-Tag Cap**

**Source**

Category B vocabulary

**Required behavior**

1. count all Q2 matches
2. FAIL if count > threshold
3. include all matched instances

**Output requirements**

* count
* threshold
* status
* instances

**11. Q3 Logic — Thought-Verb Tolerance**

**Source**

Category C vocabulary

**Required behavior**

1. count all Q3 matches
2. FAIL if count > threshold
3. include all matched instances

**Note**

PR2 uses strict counting only.
Deeper POV ambiguity handling can be layered later, but this validator must still emit consistent flags.

**12. Q4 Logic — Physiological Filler Cap**

**Source**

Category D vocabulary

**Required behavior**

1. count all Q4 matches
2. FAIL if count > threshold
3. include all matched instances

**13. Q5 Logic — Boundary Test**

**File**

/packages/validators/gate15-boundary-test.ts

**Scope**

PR2 implements a **heuristic boundary test**, not a semantic one.

**It should detect:**

* likely quoted internal thought
* likely italicized audible dialogue
* suspicious quote/italics inconsistencies
* patterns that require Layer 2 confirmation

**Suggested heuristics**

* quoted text followed by thought framing language nearby
* italic-like markup embedded in clear spoken exchanges
* narration indicating speech that is formatted as thought
* obvious internal thought framed in quotes instead of italics

**Output**

Q5 must return:

* count
* status
* instances

**Status rule**

* FAIL if clear mismatch detected
* PASS otherwise
* if ambiguity exists, include instance and set requiresLayer2Confirmation = true

**14. Flagged Instance Construction**

Every flagged match must become a FlaggedInstance.

**Required fields**

* lineNumber
* matchedText
* category
* context
* justificationRequired

**Construction rules**

* use source text for context
* use line map for line number
* set justificationRequired = true for all flagged matches
* category mapping:
  + Category A → Q1
  + Category B → Q2
  + Category C → Q3
  + Category D → Q4
  + boundary mismatch → Q5

**15. Overall Gate Result Assembly**

**File**

/packages/validators/gate15-layer1.ts

The validator must assemble a full Gate15Result object.

**Rules**

* blocking = true
* failureHandlingTriggered = true when any Q check fails
* exceptionLogRequired = true when any flagged instance exists
* overallStatus = FAIL if any Q1–Q5 status = FAIL
* overallStatus = PASS only if all Q1–Q5 checks pass

**Required structure**

Must conform exactly to PR1 schema.

**16. Determinism Requirements**

PR2 must be deterministic.

For identical input:

* same word count
* same matches
* same line numbers
* same context windows
* same PASS/FAIL statuses
* same output ordering

No randomness permitted.

No model-based interpretation permitted inside Layer 1.

**17. Error Handling**

**Required behavior**

If input text is empty or whitespace only:

* return valid Gate15Result
* wordCount = 0
* all metrics count = 0
* all statuses = PASS
* no crash

If malformed input is received:

* throw typed error or return typed failure object per repo convention
* do not silently coerce non-string input

**18. Test Plan**

**Unit tests — tokenization**

* counts words correctly
* normalizes whitespace consistently
* preserves phrase matching capability

**Unit tests — line mapping**

* returns correct line numbers
* extracts stable context windows
* handles first-line and last-line matches correctly

**Unit tests — matching**

* matches single words correctly
* matches phrases correctly
* prefers longest phrase on overlap
* is case-insensitive
* does not produce nondeterministic ordering

**Unit tests — thresholds**

* Q1 FAIL when per1000 > 4
* Q2 FAIL when count > 2
* Q3 FAIL when count > 0
* Q4 FAIL when count > 3

**Unit tests — boundary test**

* flags obvious mismatches
* passes clean formatting cases
* returns deterministic output

**Integration tests**

* assembles full Gate15Result
* sets overallStatus = FAIL when any metric fails
* sets overallStatus = PASS when all metrics pass
* sets blocking = true

**19. Example Result Shape**

{
 "chapterId": "ch\_078",
 "manuscriptId": "ms\_cartel\_babies",
 "wordCount": 3842,
 "overallStatus": "FAIL",
 "blocking": true,
 "layer1": {
 "attributionDensity": {
 "count": 26,
 "threshold": 4,
 "per1000": 6.77,
 "status": "FAIL",
 "instances": [
 {
 "lineNumber": 118,
 "matchedText": "said",
 "category": "Q1",
 "context": "…he said, turning toward the door…",
 "justificationRequired": true
 }
 ]
 },
 "softTags": {
 "count": 4,
 "threshold": 2,
 "status": "FAIL",
 "instances": []
 },
 "thoughtVerbs": {
 "count": 3,
 "threshold": 0,
 "status": "FAIL",
 "instances": []
 },
 "physiologicalFillers": {
 "count": 8,
 "threshold": 3,
 "status": "FAIL",
 "instances": []
 },
 "boundaryTest": {
 "count": 1,
 "status": "FAIL",
 "instances": []
 }
 },
 "failureHandlingTriggered": true,
 "exceptionLogRequired": true,
 "createdAt": "2026-03-22T20:15:00Z"
}

**20. Implementation Notes**

**Important constraint**

PR2 should not know anything about:

* governance state transitions
* UI rendering
* Wave 16 continuation
* exception approval decisions

It only produces the deterministic Layer 1 result.

**Important design goal**

Keep PR2 pure and composable so Governance can call it as a standalone service or package function.

**21. Done Definition**

PR2 is complete only when:

* Layer 1 validator compiles
* boundary test compiles
* all helper utilities compile
* tests pass
* outputs conform to schema
* deterministic behavior is verified
* sample fail/pass fixtures produce expected results

**22. Next Step**

After PR2 merges, proceed to:

**PR3 — Governance Enforcement**

That PR will:

* call the validator after Wave 15
* block scoring on failure
* persist governance logs
* manage chapter state transitions

Top of Form

Bottom of Form
