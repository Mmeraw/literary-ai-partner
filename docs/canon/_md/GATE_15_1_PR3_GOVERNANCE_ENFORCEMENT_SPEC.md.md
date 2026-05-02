**GATE\_15\_1\_PR3\_GOVERNANCE\_ENFORCEMENT\_SPEC.md**

**RevisionGrade — PR3 Governance Enforcement Specification**

**Scope:** PR3 only
**Purpose:** Enforce Gate 15.1 as a **blocking, non-bypassable governance gate** within the pipeline after Wave 15 and before Wave 16.

**1. Objective**

PR3 implements **governance enforcement behavior** for Gate 15.1.

This PR must ensure:

* Gate 15.1 runs automatically after Wave 15
* Chapters **cannot advance** to Wave 16 if Gate 15.1 fails
* Chapters **cannot receive scores** if Gate 15.1 fails
* Chapters are **returned to revision state** on failure
* Exception logging is required for any retained violations
* Governance decisions are **persisted, auditable, and deterministic**

PR3 does **not** implement:

* Layer 1 validator logic (PR2)
* Layer 2 structural review logic (PR4)
* UI rendering (PR5)

**2. Core Governance Principle**

Gate 15.1 is:

* **Mandatory**
* **Blocking**
* **Deterministic (Layer 1)**
* **Non-bypassable without logged exception**

No chapter proceeds beyond Wave 15 without passing Gate 15.1.

**3. Deliverables**

**New / updated files**

/services/governance-engine/src/gate-runner.ts
/services/governance-engine/src/governance-service.ts
/services/chapter-orchestrator/src/run-chapter-pipeline.ts

/packages/storage/governance-log.ts
/packages/storage/evidence-pack.ts

**Tests**

/services/governance-engine/\_\_tests\_\_/gate-runner.test.ts
/services/chapter-orchestrator/\_\_tests\_\_/pipeline-gate15.test.ts

**4. Execution Flow (Authoritative)**

Wave 15 completes
→ invoke Gate 15.1 Layer 1
→ if Layer 1 FAIL → block immediately
→ else → invoke Layer 2 (when required)
→ if Layer 2 FAIL → block
→ else → mark eligible for Wave 16

**5. Gate Runner Implementation**

**File**

/services/governance-engine/src/gate-runner.ts

**Required function**

export async function runGate15\_1(
 input: {
 manuscriptId: string;
 chapterId: string;
 text: string;
 }
): Promise<Gate15Result>;

**Execution steps**

1. call runGate15Layer1()
2. persist Layer 1 result to evidence pack

3. if Layer 1 FAIL:
 → write governance log
 → set chapter state = "gate15\_failed\_layer1"
 → return FAIL (blocking)

4. if Layer 1 PASS:
 → invoke Layer 2 review (PR4 hook)
 → persist Layer 2 result

5. if Layer 2 FAIL:
 → write governance log
 → set chapter state = "gate15\_failed\_layer2"
 → return FAIL (blocking)

6. if both PASS:
 → write governance log
 → set chapter state = "eligible\_for\_wave16"
 → return PASS

**6. Governance Service**

**File**

/services/governance-engine/src/governance-service.ts

**Responsibilities**

* persist governance decisions
* enforce blocking rules
* manage exception requirements
* expose decision API

**Required function**

export async function recordGateDecision(
 decision: GovernanceLog
): Promise<void>;

**Governance decision rules**

| **Condition** | **Result** |
| --- | --- |
| Any Layer 1 FAIL | Block immediately |
| Any Layer 2 FAIL | Block immediately |
| All PASS | Allow progression |

**7. Chapter State Management**

**File**

/services/chapter-orchestrator/src/run-chapter-pipeline.ts

**Required state transitions**

**Success path**

wave15\_complete
→ gate15\_layer1\_pass
→ gate15\_layer2\_pass
→ eligible\_for\_wave16

**Failure path**

wave15\_complete
→ gate15\_failed\_layer1 OR gate15\_failed\_layer2
→ blocked\_in\_revision

**Critical rule**

if (chapter.state === "blocked\_in\_revision") {
 prevent:
 - scoring
 - wave16 execution
}

**8. Blocking Enforcement**

**Absolute constraints**

A chapter **must not**:

* receive evaluation scores
* proceed to Wave 16
* be marked agent-ready

IF:

Gate 15.1 overallStatus === FAIL

**Required guard (global)**

function assertGate15Passed(chapterState: ChapterState) {
 if (
 chapterState === "gate15\_failed\_layer1" ||
 chapterState === "gate15\_failed\_layer2" ||
 chapterState === "blocked\_in\_revision"
 ) {
 throw new Error("Gate 15.1 violation: progression blocked");
 }
}

**9. Governance Log Persistence**

**File**

/packages/storage/governance-log.ts

**Required structure**

export interface GovernanceLog {
 chapterId: string;
 manuscriptId: string;
 gate: "15.1";
 status: "PASS" | "FAIL";
 blocking: boolean;
 reason: string;
 nextState: string;
 timestamp: string;
}

**Example**

{
 "chapterId": "ch\_078",
 "manuscriptId": "ms\_cartel\_babies",
 "gate": "15.1",
 "status": "FAIL",
 "blocking": true,
 "reason": "Q1 threshold exceeded; D1 failed",
 "nextState": "blocked\_in\_revision",
 "timestamp": "2026-03-22T20:15:00Z"
}

**10. Evidence Pack Integration**

**File**

/packages/storage/evidence-pack.ts

**Required behavior**

Each Gate 15.1 run must persist:

validator\_output.json
layer2\_review.json
governance\_log.json
exceptions.json (if any)

**Path**

/storage/evidence/{projectId}/{chapterId}/gate15/

**11. Exception Enforcement**

**Rule**

If flagged instances exist:

exceptionLogRequired = true

**Enforcement behavior**

* chapter cannot be cleared unless:
  + violations are removed
    OR
  + exception logs exist

**Validation hook**

function validateExceptionsResolved(
 gateResult: Gate15Result,
 exceptions: ExceptionLogEntry[]
) {
 if (
 gateResult.overallStatus === "FAIL" &&
 exceptions.length === 0
 ) {
 throw new Error("Unresolved violations: exception log required");
 }
}

**12. API Integration**

**Required endpoints**

POST /api/chapters/:id/gate15/run
GET /api/chapters/:id/gate15/status
GET /api/chapters/:id/governance-log
POST /api/chapters/:id/exceptions
POST /api/chapters/:id/resubmit

**API behavior**

* /run triggers gate execution
* /status returns Gate15Result
* /resubmit re-runs gate after revision
* /exceptions attaches justification entries

**13. Test Plan**

**Unit tests**

* governance decision logic
* state transitions
* blocking enforcement
* exception validation

**Integration tests**

* Layer 1 FAIL blocks scoring
* Layer 2 FAIL blocks progression
* PASS allows Wave 16 execution
* exception required before resubmission clears

**Failure scenario test**

Input: chapter with 600 "said"
Expected:
- Gate FAIL
- state = blocked\_in\_revision
- scoring prevented

**Success scenario test**

Input: cleaned March 21 version
Expected:
- Gate PASS
- state = eligible\_for\_wave16

**14. Determinism Requirement**

PR3 must preserve determinism:

* same input → same governance result
* no manual override without logged exception
* no silent state transitions

**15. Done Definition**

PR3 is complete only when:

* Gate 15.1 runs automatically after Wave 15
* FAIL blocks scoring and progression
* governance logs are persisted
* chapter states update correctly
* exception enforcement is active
* tests pass
* integration with PR2 validator confirmed

**16. Next Step**

Proceed to:

👉 **PR4 — Layer 2 Structural Review Engine**

This will implement:

* attribution independence test
* voice differentiation validation
* rhythm integrity analysis

**17. Final System Effect**

After PR3:

* Gate 15.1 is no longer conceptual
* It is fully enforced in the pipeline
* Manual cleanup of 1,000+ violations becomes impossible
* Dialogue purity becomes a **system guarantee**, not a human effort

Top of Form

Bottom of Form
