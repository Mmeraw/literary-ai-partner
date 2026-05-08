**GATE\_15\_1\_IMPLEMENTATION\_PLAN.md**

**RevisionGrade — Gate 15.1 Implementation Plan**

**Status:** Draft for lock
**Scope:** Repo-ready engineering spec
**Purpose:** Implement Gate 15.1 as a blocking, auditable, deterministic pre-evaluation gate between Wave 15 and Wave 16.

**1. Objective**

Implement **Gate 15.1 — Dialogue & Attribution Purity Gate** in the RevisionGrade pipeline so that every chapter:

* is scanned automatically after Wave 15
* is blocked from scoring if Gate 15.1 fails
* is returned to revision if violations are unresolved
* cannot advance to Wave 16 or beyond without passing both layers
* produces reproducible evidence and governance logs
* supports explicit exception logging where a flagged instance is intentionally retained

Gate 15.1 has two required layers:

**Layer 1 — Quantitative Detection**

Detects and counts flagged language and formatting violations.

**Layer 2 — Structural Validation**

Confirms that dialogue works without attribution crutches and that rhythm and voice remain strong.

**2. Canonical Position**

Gate 15.1 sits:

* **after Wave 15 — Dialogue Tag Reduction**
* **before Wave 16 — Internal Thought Boundary Check**

It is:

* mandatory
* blocking
* deterministic at Layer 1
* governance-bound
* non-bypassable without logged justification

**3. Functional Requirements**

**3.1 Layer 1 must detect:**

* attribution density
* soft-tag usage
* thought-verb usage
* physiological filler usage
* quote/italics boundary mismatches

**3.2 Layer 2 must evaluate:**

* attribution independence
* voice differentiation integrity
* rhythm integrity

**3.3 Governance must enforce:**

* no scoring if Gate 15.1 fails
* no Wave 16 progression if Gate 15.1 fails
* revision return loop on failure
* explicit exception logging for retained flagged instances

**3.4 Evidence system must persist:**

* validator output
* line references
* structural review output
* governance decision log
* exception log
* source hashes

**4. Repo Structure**

/apps
 /web
 /app
 /dashboard
 /projects/[projectId]
 /chapters/[chapterId]
 /governance
 /evidence

/services
 /ingestion-service
 /chapter-orchestrator
 /dialogue-purity-engine
 /governance-engine
 /wave-engine

/packages
 /canon
 gate15.ts
 controlled-vocabulary-register.ts
 thresholds.ts
 /schemas
 gate15.schema.ts
 governance.schema.ts
 evidence.schema.ts
 chapter-state.schema.ts
 exception.schema.ts
 /validators
 gate15-layer1.ts
 gate15-boundary-test.ts
 tokenization.ts
 line-map.ts
 /review
 dialogue-extractor.ts
 gate15-layer2-review.ts
 gate15-layer2-prompt.ts
 /storage
 evidence-pack.ts
 governance-log.ts
 /shared
 types.ts
 constants.ts
 utils.ts

/data
 /fixtures
 /goldens
 /test-manuscripts

**5. Canon Files**

**/packages/canon/gate15.ts**

Defines the canonical structure of Gate 15.1:

* gate name
* gate ID
* position
* layers
* blocking status
* failure handling
* pipeline rule

**/packages/canon/controlled-vocabulary-register.ts**

Exports the Appendix A controlled vocabulary:

export const CONTROLLED\_VOCABULARY = {
 attributionTags: [...],
 softTags: [...],
 thoughtVerbs: [...],
 physiologicalFillers: [...]
} as const;

**/packages/canon/thresholds.ts**

Defines threshold constants:

export const GATE15\_THRESHOLDS = {
 attributionPer1000: 4,
 softTagsPerChapter: 2,
 thoughtVerbsPerChapter: 0,
 physiologicalFillersPerChapter: 3
} as const;

**6. Schemas**

**/packages/schemas/gate15.schema.ts**

export type PassFail = "PASS" | "FAIL";

export interface FlaggedInstance {
 lineNumber: number;
 columnStart?: number;
 columnEnd?: number;
 matchedText: string;
 category: "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "D1" | "D2" | "D3";
 subcategory?: string;
 context: string;
 justificationRequired: boolean;
}

export interface Layer1Metric {
 count: number;
 threshold?: number;
 per1000?: number;
 status: PassFail;
 instances: FlaggedInstance[];
}

export interface Layer2Result {
 status: PassFail;
 rationale: string;
 reviewerType: "AI" | "HUMAN";
 instances?: FlaggedInstance[];
}

export interface Gate15Result {
 chapterId: string;
 manuscriptId: string;
 wordCount: number;
 overallStatus: PassFail;
 blocking: boolean;
 layer1: {
 attributionDensity: Layer1Metric;
 softTags: Layer1Metric;
 thoughtVerbs: Layer1Metric;
 physiologicalFillers: Layer1Metric;
 boundaryTest: Layer1Metric;
 };
 layer2?: {
 attributionIndependence: Layer2Result;
 voiceDifferentiationIntegrity: Layer2Result;
 rhythmIntegrity: Layer2Result;
 };
 failureHandlingTriggered: boolean;
 exceptionLogRequired: boolean;
 createdAt: string;
}

**/packages/schemas/governance.schema.ts**

Tracks:

* gate execution
* pass/fail result
* blocking state
* reason
* next chapter state
* timestamp

**/packages/schemas/chapter-state.schema.ts**

Tracks lifecycle:

* uploaded
* normalized
* wave15\_complete
* gate15\_layer1\_pass
* gate15\_layer2\_required
* gate15\_layer2\_pass
* blocked\_in\_revision
* eligible\_for\_wave16
* scored

**/packages/schemas/exception.schema.ts**

export interface ExceptionLogEntry {
 chapterId: string;
 gate: "15.1";
 lineNumber: number;
 matchedText: string;
 category: string;
 justification: string;
 approvedBy: "AI" | "HUMAN";
 timestamp: string;
}

**7. Layer 1 Validator**

**File**

/packages/validators/gate15-layer1.ts

**Responsibilities**

* normalize chapter text
* count words
* scan controlled vocabulary
* map matches to line numbers
* collect context windows
* calculate thresholds
* emit deterministic JSON result

**Core logic**

**Q1 — Attribution Density**

Use all Category A words from the controlled vocabulary register.

Rule:

* count matches
* compute per-1000-word rate
* FAIL if greater than 4 per 1,000

**Q2 — Soft-Tag Cap**

Use all Category B words.

Rule:

* FAIL if count exceeds 2 per chapter unless justified

**Q3 — Thought-Verb Tolerance**

Use all Category C words.

Rule:

* FAIL if count exceeds zero when POV is clear and italics are present
* may flag for human confirmation in ambiguous formatting cases

**Q4 — Physiological Filler Cap**

Use all Category D words.

Rule:

* FAIL if count exceeds 3 per chapter

**Q5 — Boundary Test**

Heuristic detection for:

* quoted internal thought
* italicized audible dialogue
* mismatches between form and function

Rule:

* FAIL on clear mismatch
* may escalate to Layer 2 confirmation where ambiguity exists

**8. Helper Utilities**

**/packages/validators/tokenization.ts**

Functions for:

* word counting
* sentence splitting
* normalized token extraction

**/packages/validators/line-map.ts**

Functions for:

* converting string indices to line numbers
* building context windows
* preserving line references after normalization

**Required helpers**

countWords(text: string): number
buildLineMap(text: string): LineMap[]
findMatches(text: string, terms: string[]): Match[]
getContext(text: string, index: number, radius?: number): string
computePer1000(count: number, words: number): number

**9. Boundary Test Module**

**File**

/packages/validators/gate15-boundary-test.ts

**Purpose**

Perform initial line-level checks on:

* quoted spans
* italic spans
* suspicious formatting behavior

**Phase 1 behavior**

This is heuristic, not deep semantic classification.

It should:

* detect quote spans
* detect italics if markup or import formatting exists
* flag likely audible/internal mismatches
* return line references for review

**Return contract**

export interface BoundaryTestResult {
 status: "PASS" | "FAIL";
 instances: FlaggedInstance[];
 requiresLayer2Confirmation: boolean;
}

**10. Layer 2 Structural Review**

**Files**

* /packages/review/dialogue-extractor.ts
* /packages/review/gate15-layer2-review.ts
* /packages/review/gate15-layer2-prompt.ts

**Purpose**

Assess:

* D1 attribution independence
* D2 voice differentiation integrity
* D3 rhythm integrity

**Process**

1. Extract dialogue-heavy exchanges from chapter
2. Produce a derived copy with dialogue tags removed
3. Present original and stripped versions for review
4. Collect binary judgments with rationale
5. Persist results

**Rules**

* no partial credit
* no “mostly”
* no “uncertain”
* each D check must return PASS or FAIL

**11. Dialogue Extractor**

**File**

/packages/review/dialogue-extractor.ts

**Responsibilities**

Find candidate exchanges for Layer 2:

* consecutive dialogue blocks
* dialogue with nearby tags
* mixed dialogue/action sequences
* high-risk exchanges likely to fail D1–D3

This reduces review noise and improves consistency.

**12. Governance Enforcement**

**File**

/services/governance-engine/src/gate-runner.ts

**Enforcement sequence**

After Wave 15:

1. run Gate 15.1 Layer 1
2. if Layer 1 FAIL → block chapter immediately
3. if Layer 1 PASS → run Layer 2 when required
4. if any Layer 2 FAIL → block chapter
5. if both layers PASS → allow progression to Wave 16

**Blocking behavior**

No score object may be created while chapter state is:

* blocked\_in\_revision
* awaiting\_exception\_log
* awaiting\_layer2\_review

**Governance log example**

{
 "chapterId": "ch\_078",
 "gate": "15.1",
 "status": "FAIL",
 "blocking": true,
 "reason": "Q1 attribution density exceeded threshold; D1 attribution independence failed",
 "nextState": "blocked\_in\_revision",
 "timestamp": "2026-03-22T20:15:00Z"
}

**13. Chapter Orchestrator**

**File**

/services/chapter-orchestrator/src/run-chapter-pipeline.ts

**Flow**

ingest chapter
→ waves 1–15
→ Gate 15.1 Layer 1
→ if fail: block + return to revision
→ else Gate 15.1 Layer 2
→ if fail: block + return to revision
→ else continue waves 16–62
→ final evaluation eligibility

**State transitions**

Success path:

* uploaded
* normalized
* wave15\_complete
* gate15\_layer1\_pass
* gate15\_layer2\_pass
* eligible\_for\_wave16
* scored

Failure path:

* gate15\_failed\_layer1
* gate15\_failed\_layer2
* blocked\_in\_revision

**14. Exception Logging**

**Rule**

A flagged instance may be retained only with explicit logged justification.

**Important constraint**

An exception does not erase the flag.
It records an intentional retention path subject to governance visibility.

**Required fields**

* chapterId
* gate
* line number
* matched text
* category
* narrative justification
* approver
* timestamp

**15. Evidence Pack Storage**

For every gate run, persist:

* raw chapter hash
* normalized chapter hash
* validator output
* line reference map
* Layer 2 review output
* governance decision log
* exception log entries

**Storage path**

/storage/evidence/{projectId}/{chapterId}/gate15/
 validator\_output.json
 layer2\_review.json
 governance\_log.json
 exceptions.json
 source\_hash.json

**16. Front-End Requirements**

**Chapter Gate Summary Card**

Display:

* Gate 15.1 status
* blocking state
* Q1–Q5 results
* D1–D3 results

**Violations Table**

Columns:

* line
* matched text
* category
* threshold status
* justification status
* action

**Governance Log Panel**

Display:

* last run timestamp
* pass/fail
* block reason
* chapter state

**Controls**

Buttons:

* re-run Layer 1
* request Layer 2 review
* submit exception
* re-submit chapter

**17. API Endpoints**

POST /api/projects/:projectId/chapters/:chapterId/gates/15.1/run-layer1
POST /api/projects/:projectId/chapters/:chapterId/gates/15.1/run-layer2
GET /api/projects/:projectId/chapters/:chapterId/gates/15.1/result
POST /api/projects/:projectId/chapters/:chapterId/gates/15.1/exceptions
GET /api/projects/:projectId/chapters/:chapterId/governance-log
POST /api/projects/:projectId/chapters/:chapterId/resubmit

**18. Test Plan**

**Unit tests**

* word counting
* per-1000 calculations
* vocabulary matching
* line mapping
* threshold logic
* deterministic output

**Integration tests**

* Q1 fail blocks scoring
* D1 fail blocks Wave 16 progression
* exception logs required before cleared resubmission
* identical input yields identical Layer 1 output

**Golden tests**

Run against:

* March 14 manuscript sample
* March 21 manuscript sample

Expected outcome:

* older sample produces materially higher Q1–Q4 flags
* newer sample shows significant improvement

This ties validator credibility to known manuscript evolution.

**19. PR Sequence**

**PR 1 — Canon + schemas**

* add gate15 canon file
* add controlled vocabulary register
* add thresholds
* add schemas

**PR 2 — Layer 1 validator**

* implement scanner
* add line mapping
* add tests
* emit deterministic JSON

**PR 3 — Governance enforcement**

* block score progression
* add chapter state transitions
* persist governance logs

**PR 4 — Layer 2 review contract**

* add dialogue extractor
* add review schema
* add AI/human review adapter

**PR 5 — Front-end visibility**

* chapter gate card
* violations table
* governance panel
* re-run controls

**PR 6 — Evidence + audit**

* persist evidence packs
* expose downloadable audit artifacts

**20. Copilot Handoff**

Implement Gate 15.1 in the RevisionGrade repo as a blocking pre-evaluation gate between Wave 15 and Wave 16.

Requirements:
1. Create canonical files for Gate 15.1, thresholds, and Controlled Vocabulary Register.
2. Create schemas for gate results, governance logs, chapter state, evidence packs, and exception logs.
3. Implement Layer 1 deterministic validator:
 - attribution density per 1000 words
 - soft-tag cap
 - thought-verb tolerance
 - physiological filler cap
 - boundary-test flagging
 - line references and context windows
4. Integrate governance behavior:
 - fail blocks scoring
 - fail returns chapter to revision
 - no progression to Wave 16 without pass
5. Implement Layer 2 review contract for:
 - attribution independence
 - voice differentiation integrity
 - rhythm integrity
6. Persist evidence artifacts and governance logs.
7. Add tests for deterministic output and blocking behavior.

Deliver code in PR order:
PR1 canon+schemas
PR2 layer1 validator
PR3 governance enforcement
PR4 layer2 review
PR5 front-end visibility
PR6 evidence pack

**21. Done Definition**

Gate 15.1 is complete only when:

* Layer 1 runs automatically and deterministically
* Layer 2 can return binary PASS/FAIL results
* scoring is blocked on failure
* Wave 16 progression is blocked on failure
* exception logs are required for retained flagged instances
* evidence packs are persisted
* dashboard visibility is live
* tests pass
* golden comparison against March 14 and March 21 samples confirms expected behavior

**22. Best Next Artifact**

The next strongest companion doc would be:

**GATE\_15\_1\_PR1\_CANON\_AND\_SCHEMA\_SPEC.md**

That would let Copilot start immediately on PR 1 without translating anything.

Top of Form

Bottom of Form
