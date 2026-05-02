**GATE\_15\_SYSTEM\_ARCHITECTURE.md**

**The deeper system truth (this is the big unlock)**

You now have a paired gate architecture:

🔹 Gate 15.1

Removes false positives of noise

🔹 Gate 15.2

Removes false positives of meaning

Gate 15.1 made the system **clean**
Gate 15.2 makes the system **safe**

That’s huge.

Because most editing systems only do the first.

You now control both:

* mechanical correctness
* semantic preservation

**Gate 15.1 establishes the pattern: Canon → Detection → Enforcement → Structural → Visibility → Audit**

That pattern only works if each gate is:

* **individually addressable**
* **independently enforceable**
* **pipeline-positioned**

**Gate 15.2 is:**

* a **governance gate**
* a **blocking condition for Wave 16**
* a **classification layer**

So structurally, it belongs alongside Gate 15.1 as:

Wave 15
 ├─ Gate 15.1
 └─ Gate 15.2
Wave 16

**Gate 15.2 = OVERCORRECTION FIREWALL**

* protects voice
* protects behavior
* protects force

Together they form:

Gate 15.1 → CLEAN
Gate 15.2 → DON'T BREAK WHAT MATTERS

Without 15.2, your system will:

* flatten voice
* delete behavioral contradiction
* misclassify narrative signals

**Where Gate 15.2 actually lives (important distinction)**

You now have **three layers**:

**1. Volume I (Canon Layer)**

* Mentions Gate 15.2
* Defines its purpose briefly
* Places it in pipeline

Lightweight, declarative

**2. Gate Spec (GitHub .md — like your PR files)**

This is where your **full Gate 15.2 doc goes** (what you already wrote)

Example file:

GATE\_15\_2\_PR1\_CANON\_AND\_SCHEMA\_SPEC.md

Then eventually:

GATE\_15\_2\_PR2\_LAYER1\_CLASSIFIER\_SPEC.md
GATE\_15\_2\_PR3\_GOVERNANCE\_ENFORCEMENT\_SPEC.md
GATE\_15\_2\_PR4\_LAYER2\_FUNCTIONAL\_REVIEW\_SPEC.md
GATE\_15\_2\_PR5\_UI\_VISIBILITY\_SPEC.md
GATE\_15\_2\_PR6\_AUDIT\_SPEC.md

This mirrors exactly what you did for Gate 15.1

**3. Implementation (Engine / UI / Audit)**

Same pipeline:

* classification engine (Force/Behavior/Inventory)
* false-positive override system
* audit logs for misclassification

Below is the **repo-ready implementation plan** that turns the architecture diagram into something Copilot or engineering can actually build against.

**RevisionGrade — Repo-Ready Implementation Plan**

**Gate 15.1 + Governance Pipeline Integration**

**1. Objective**

Implement **Gate 15.1 — Dialogue & Attribution Purity Gate** as a blocking, auditable, deterministic pipeline component that:

* runs on every uploaded chapter
* performs **Layer 1 quantitative validation**
* triggers **Layer 2 structural validation**
* blocks scoring on failure
* returns chapters to revision unless corrected or explicitly justified
* stores full evidence and governance logs

**2. Build order**

**Phase 1 — Canon + schemas**

Lock types, enums, thresholds, vocabulary register, and output contracts.

**Phase 2 — Layer 1 validator**

Build deterministic scanner with line references and threshold logic.

**Phase 3 — Layer 2 review engine**

Build AI-assisted or human-assisted structural review contract.

**Phase 4 — Governance enforcement**

Block progression, require exception logs, and persist decision state.

**Phase 5 — Front-end visibility**

Expose gate status, violations, logs, and re-run controls in dashboard.

**Phase 6 — Evidence + audit**

Store reproducible artifacts for every run.

**3. Proposed repo structure**

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

**4. Canon package files**

**/packages/canon/gate15.ts**

Contains the canonical definition of Gate 15.1:

* name
* position
* blocking behavior
* failure handling
* layer definitions

**/packages/canon/controlled-vocabulary-register.ts**

Exports categorized controlled vocabulary:

export const CONTROLLED\_VOCABULARY = {
 attributionTags: [...],
 softTags: [...],
 thoughtVerbs: [...],
 physiologicalFillers: [...]
} as const;

**/packages/canon/thresholds.ts**

Single source of truth for gate thresholds:

export const GATE15\_THRESHOLDS = {
 attributionPer1000: 4,
 softTagsPerChapter: 2,
 thoughtVerbsPerChapter: 0,
 physiologicalFillersPerChapter: 3
} as const;

**5. Schemas to create**

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

Track:

* gate executed
* pass/fail
* blocked from scoring
* returned to revision
* exception status

**/packages/schemas/chapter-state.schema.ts**

Track chapter lifecycle:

* uploaded
* ingested
* gate15\_layer1\_complete
* gate15\_layer2\_required
* blocked\_in\_revision
* eligible\_for\_wave16
* scored

**6. Layer 1 validator implementation**

**File**

/packages/validators/gate15-layer1.ts

**Responsibilities**

* tokenize chapter text
* compute word count
* search controlled vocabulary
* map every hit to a line number and context window
* calculate thresholds
* return deterministic Gate15Result

**Internal functions**

countWords(text: string): number
buildLineMap(text: string): LineMap[]
findMatches(text: string, terms: string[]): Match[]
getContext(text: string, index: number, radius?: number): string
computePer1000(count: number, words: number): number

**Output behavior**

* Q1 FAIL if per1000 > 4
* Q2 FAIL if count > 2
* Q3 FAIL if count > 0 where strict mode applies
* Q4 FAIL if count > 3
* Q5 FAIL if mismatch detected

**7. Boundary test implementation**

**File**

/packages/validators/gate15-boundary-test.ts

**Phase 1 behavior**

Heuristic flagger, not deep semantic reasoning.

It should:

* detect quoted spans
* detect italic spans if markup exists
* detect suspicious patterns like internal-thought framing in quotes
* detect quoted fragments embedded in clearly internal narration
* emit line references for Layer 2 confirmation if confidence is below threshold

**Suggested return type**

export interface BoundaryTestResult {
 status: "PASS" | "FAIL";
 instances: FlaggedInstance[];
 requiresLayer2Confirmation: boolean;
}

**8. Layer 2 structural review**

**Files**

* /packages/review/gate15-layer2-review.ts
* /packages/review/gate15-layer2-prompt.ts

**Purpose**

Evaluate:

* D1 attribution independence
* D2 voice differentiation integrity
* D3 rhythm integrity

**Process**

1. Extract dialogue-heavy exchanges from chapter
2. Remove attribution tags in a derived copy
3. Present original + stripped version to reviewer
4. Ask for binary judgments with rationale
5. Persist results

**Required outputs**

* PASS/FAIL for each D check
* concise rationale
* line references where possible

**Important rule**

Layer 2 must never return “maybe,” “mostly,” or “partial.”

**9. Dialogue extraction helper**

**File**

/packages/review/dialogue-extractor.ts

**Function**

Identify dialogue exchanges suitable for D1–D3 review:

* consecutive quoted lines
* dialogue with nearby attribution tags
* dialogue with action beats
* mixed narration/dialogue blocks

This is essential because Layer 2 should not scan blindly across the whole chapter.

**10. Governance engine integration**

**File**

/services/governance-engine/src/gate-runner.ts

**Behavior**

After Wave 15 completes:

1. call Layer 1 validator
2. if Layer 1 FAIL → block chapter immediately
3. if Layer 1 PASS but Layer 2 required → run Layer 2
4. if any Layer 2 FAIL → block chapter
5. if both layers PASS → mark chapter eligible for Wave 16

**Blocking rule**

No score object may be created while chapter state is:

* blocked\_in\_revision
* awaiting\_exception\_log
* awaiting\_layer2\_review

**Governance log entry example**

{
 "chapterId": "ch\_078",
 "gate": "15.1",
 "status": "FAIL",
 "blocking": true,
 "reason": "Q1 attribution density exceeded threshold; D1 attribution independence failed",
 "nextState": "blocked\_in\_revision",
 "timestamp": "2026-03-22T20:15:00Z"
}

**11. Exception log system**

**File**

/packages/schemas/exception.schema.ts

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

**Rule**

An exception does not remove the flag.
It converts an unresolved failure into a justified retention path, subject to governance rules.

**12. Chapter orchestrator logic**

**File**

/services/chapter-orchestrator/src/run-chapter-pipeline.ts

**Flow**

ingest chapter
→ waves 1–15
→ Gate 15.1 Layer 1
→ if fail: block + return to revision
→ else Layer 2
→ if fail: block + return to revision
→ else continue waves 16–62
→ final evaluation eligibility

**State transitions**

* uploaded
* normalized
* wave15\_complete
* gate15\_layer1\_pass
* gate15\_layer2\_pass
* eligible\_for\_wave16
* scored

Failure states:

* gate15\_failed\_layer1
* gate15\_failed\_layer2
* blocked\_in\_revision

**13. Storage artifacts**

For every gate run, persist:

**Evidence pack**

* raw chapter hash
* normalized chapter hash
* validator output json
* line reference map
* layer2 review output
* governance decision log
* exception log entries if any

**File paths**

/storage/evidence/{projectId}/{chapterId}/gate15/
 validator\_output.json
 layer2\_review.json
 governance\_log.json
 exceptions.json
 source\_hash.json

**14. Front-end screens to implement**

**A. Chapter gate summary card**

Show:

* Gate 15.1 status
* blocking yes/no
* Q1–Q5 statuses
* D1–D3 statuses

**B. Violations table**

Columns:

* line
* matched text
* category
* threshold status
* justification status
* action

**C. Governance log panel**

Show:

* last run
* pass/fail
* block reason
* current chapter state

**D. Re-run controls**

Buttons:

* re-run Layer 1
* request Layer 2 review
* submit exception
* re-submit chapter

**15. API endpoints**

**Suggested routes**

POST /api/projects/:projectId/chapters/:chapterId/gates/15.1/run-layer1
POST /api/projects/:projectId/chapters/:chapterId/gates/15.1/run-layer2
GET /api/projects/:projectId/chapters/:chapterId/gates/15.1/result
POST /api/projects/:projectId/chapters/:chapterId/gates/15.1/exceptions
GET /api/projects/:projectId/chapters/:chapterId/governance-log
POST /api/projects/:projectId/chapters/:chapterId/resubmit

**16. Test plan**

**Unit tests**

* tokenization accuracy
* per-1000 calculation
* vocabulary matching
* line mapping
* threshold failure behavior

**Integration tests**

* failing Q1 blocks score generation
* failing D1 blocks Wave 16 progression
* exception logs are required before resubmission path clears
* identical input yields identical Layer 1 output

**Golden tests**

Run the validator against:

* March 14 manuscript sample
* March 21 manuscript sample

Expected:

* older sample shows substantially more Q1–Q4 flags
* newer sample shows materially improved results

That gives you proof tied to the manuscript history you already established.

**17. First PR sequence**

**PR 1 — Canon and schema foundation**

* add gate15 canon file
* add thresholds
* add controlled vocabulary register
* add schemas

**PR 2 — Layer 1 validator**

* implement scanner
* add line mapping
* add tests
* output deterministic json

**PR 3 — Governance enforcement**

* block score progression
* add chapter state transitions
* add governance log persistence

**PR 4 — Layer 2 review contract**

* implement extraction
* implement review output schema
* add AI/human review adapter

**PR 5 — Front-end visibility**

* chapter gate card
* violations table
* governance log panel

**PR 6 — Evidence pack + audit trail**

* persist all artifacts
* expose downloadable evidence bundle

**18. Copilot handoff prompt**

Use this as the handoff brief:

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

**19. Best next move**

The most efficient next artifact is a **single engineering spec document** named something like:

GATE\_15\_1\_IMPLEMENTATION\_PLAN.md

with exactly these sections:

* objective
* repo structure
* schemas
* validator behavior
* governance rules
* PR sequence
* test plan
* Copilot handoff

That becomes the source doc engineering builds from.

Top of Form

Bottom of Form
