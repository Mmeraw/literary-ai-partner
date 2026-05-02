**GATE 15.2 — OVERCORRECTION FIREWALL GATE**

*Ultra-Expanded Canonical and Engineering Specification — Engineer + Neophyte Edition*

This document defines Gate 15.2 at full doctrine and implementation depth. It is written so that engineers can build it without guessing and new employees can understand it without prior system knowledge.

# 1. IDENTITY AND CLASSIFICATION

Name: Gate 15.2 — Overcorrection Firewall Gate

Status: Canonical — Mandatory

Type: Pre-Evaluation Governance Gate (Blocking)

Primary Function: Semantic Preservation

Pipeline Position: After Gate 15.1 and before Wave 16

Primary Volume: Volume IV — Governance

Secondary Volumes:

* Volume I — WAVE Canon (pipeline position and craft relation)
* Volume II — Evaluation Canon (criterion impact and invalidation rules)
* Volume III — Tools and Implementation (classifiers, schemas, review tools)
* Volume V — Architecture and runtime enforcement (execution behavior, persistence, audit)

# 2. WHAT THIS GATE IS FOR

Gate 15.2 exists to stop the system from confusing cleanliness with quality. A manuscript can be mechanically improved and still become narratively worse. When revisions or enforcement remove noise, they may also remove force, contradiction, specificity, danger, asymmetry, or voice. Gate 15.2 exists to detect that kind of damage.

In plain language: Gate 15.1 asks whether the text is structurally clean enough to trust. Gate 15.2 asks whether the cleaned text is still alive.

# 3. THE SYSTEM PROBLEM GATE 15.2 SOLVES

Without Gate 15.2, a system can produce prose that looks better on the surface while being weaker underneath. This failure happens when correction removes the very thing that gave the text identity.

* A dangerous line becomes neutral.
* A contradictory character becomes tidy and predictable.
* An unstable emotional beat becomes overly explained.
* A distinct voice becomes generic.
* A pressured scene becomes orderly and flat.

This is not a stylistic preference issue. It is an evaluation-safety issue. If the system cannot detect overcorrection, it will reward prose that is compliant but dead.

# 4. CORE DEFINITIONS

## 4.1 Semantic Integrity

Semantic integrity means the text still preserves meaning, force, contradiction, behavioral truth, tonal asymmetry, and voice after structural enforcement or correction.

## 4.2 Overcorrection

Overcorrection is any change that improves formal cleanliness while reducing narrative force, distinctiveness, contradiction, or meaning.

## 4.3 Flattening

Flattening is the reduction of distinct, specific, or dangerous language into safer, more generic, more interchangeable language.

## 4.4 Behavioral Truth

Behavioral truth means a character still acts, speaks, and reacts in a way consistent with the character’s established nature, pressure, and contradiction.

## 4.5 Force

Force means the pressure carried by the line, exchange, paragraph, or scene. It includes threat, emotional charge, asymmetry, compression, and impact.

## 4.6 PASS

PASS means Gate 15.2 found no blocking semantic damage. The text remains meaningfully intact and may proceed to Wave 16.

## 4.7 FAIL

FAIL means Gate 15.2 found semantic damage severe enough to invalidate progression. The text may be cleaner, but it is no longer trustworthy as preserved narrative material.

## 4.8 BLOCK

BLOCK is the system consequence of a FAIL. BLOCK means the chapter cannot proceed to the next stage. It must enter revision or exception handling.

## 4.9 CONTINUE

CONTINUE means the chapter is allowed to proceed because semantic integrity has been preserved.

## 4.10 EXCEPTION

An exception is a documented, reviewable justification for allowing a flagged condition to remain. An exception does not erase the finding. It records why the system or reviewer chose to permit it.

## 4.11 OVERRIDE

An override is a governance-level action that permits progression despite a normal block. Overrides are dangerous and must be rare, explicit, logged, and doctrinally permitted.

# 5. RELATIONSHIP TO GATE 15.1

Gate 15.2 must remain separate from Gate 15.1. The two gates solve different categories of failure.

* Gate 15.1 removes false positives of noise.
* Gate 15.2 removes false positives of meaning.
* Gate 15.1 validates structural purity.
* Gate 15.2 validates semantic preservation.

The correct relationship is sequential, not merged:

* Wave 15 completes
* Gate 15.1 executes
* Gate 15.2 executes
* Wave 16 begins only if both gates pass

# 6. EXECUTION ORDER LAW

Gate 15.1 must always execute before Gate 15.2.

Reason: semantic-preservation review only makes sense once structural validity has been confirmed. Gate 15.2 may not operate on structurally invalid text.

# 7. STRUCTURAL PRIORITY LAW

If Gate 15.1 fails, Gate 15.2 must not execute.

This prevents a critical governance error: trying to preserve meaning inside a text that is still mechanically invalid.

# 8. NON-OVERRIDE LAW

Gate 15.2 may not override structural failure from Gate 15.1.

Meaning cannot justify broken structure. A line can be powerful and still mechanically invalid. That power does not erase the need for structural correction.

# 9. PROTECTION LAW

Gate 15.2 exists to protect the living function of the text. It does not exist to excuse looseness or resist valid structure. Its task is to detect when good correction has become bad correction.

# 10. WHAT GATE 15.2 EXAMINES

Gate 15.2 examines whether structural cleanup or enforcement has damaged any of the following semantic domains:

* Voice Preservation
* Behavioral Integrity
* Contradiction Retention
* Force and Pressure Preservation
* Tone Preservation
* Inventory Preservation
* Intentional Roughness Preservation

# 11. DETECTION AREA A — VOICE PRESERVATION

This area asks whether the text still sounds like itself. A structurally improved paragraph may still fail if its distinctive diction, cadence, compression, or tonal signature has been neutralized.

* Do characters still sound distinct from one another?
* Does the narrator still sound like the narrator?
* Has roughness that served identity been wrongly cleaned away?
* Has the line become generically 'well written' but no longer specific?

# 12. DETECTION AREA B — BEHAVIORAL INTEGRITY

This area asks whether the character still behaves like the same person under the same pressure. Overcorrection often harms behavior by smoothing away inconsistency, sharpness, or irrationality that was actually doing character work.

* Did the character lose their edge?
* Did the character become more polite, more coherent, or more balanced than they should be?
* Did revision erase stress behavior that mattered?
* Did the dialogue become emotionally safer than the character would actually sound?

# 13. DETECTION AREA C — CONTRADICTION RETENTION

This area asks whether contradiction has been removed in the name of clarity. Many strong scenes depend on contradiction: a character says one thing and means another, wants two opposite things, or behaves against their stated position.

* Did the revision over-explain what was productively unstable?
* Did it resolve tension that should have remained unresolved?
* Did it remove paradox, ambivalence, or split motive that the scene needed?

# 14. DETECTION AREA D — FORCE AND PRESSURE PRESERVATION

This area asks whether the scene still carries the same pressure after cleanup. A sentence can be cleaner and still less dangerous.

* Did revision reduce compression?
* Did revision remove bite, threat, or velocity?
* Did the exchange become orderly where it was meant to feel unstable?
* Did a tense scene become merely clear?

# 15. DETECTION AREA E — TONE PRESERVATION

This area asks whether the tonal identity of the passage survives. A grim paragraph should not become merely serious. A jagged exchange should not become merely readable.

# 16. DETECTION AREA F — INVENTORY PRESERVATION

Inventory means the set of narrative signals carried by a passage: force, threat, contradiction, character-specific behavior, tonal cues, and relationship asymmetries. Gate 15.2 must detect when revision has reduced the text’s working inventory.

# 17. DETECTION AREA G — INTENTIONAL ROUGHNESS PRESERVATION

Not all roughness is error. Some roughness is signal. Some asymmetry, friction, compression, or awkwardness is the very thing creating force. Gate 15.2 must distinguish between bad noise and meaningful roughness.

# 18. FAILURE CONDITIONS

Gate 15.2 fails if any of the following are true:

* Voice becomes generic or homogenized.
* Characters become interchangeable.
* Behavior loses pressure-specific truth.
* Meaningful contradiction is erased.
* Tension is reduced by cleanup.
* The prose becomes safer but weaker.
* Inventory loss is severe enough to change scene function.
* Correction improves order while damaging life.

# 19. WHAT PASS LOOKS LIKE

Gate 15.2 passes when:

* The text remains distinct after correction.
* Behavior still feels true to the character.
* Contradiction that matters is still present.
* Pressure remains active.
* Tone remains recognizable.
* The passage is cleaner without being domesticated.

# 20. WHAT FAIL LOOKS LIKE

Gate 15.2 fails when:

* A hard line becomes neutral.
* A dangerous line becomes polite.
* A complicated motive becomes simple explanation.
* A character stops sounding like themself.
* The scene loses friction but gains tidiness.

# 21. SIMPLE EXAMPLE FOR NEW EMPLOYEES

Suppose a character originally says something clipped, defensive, and slightly cruel. An overzealous correction rewrites the line to be more explicit, smoother, and more grammatically complete.

* Gate 15.1 may pass because the structure is cleaner.
* Gate 15.2 may fail because the line no longer sounds like the character and no longer carries the same force.

This is the exact kind of situation Gate 15.2 exists to catch.

# 22. GOVERNANCE EFFECT

If Gate 15.2 fails:

* The chapter is blocked.
* The chapter may not proceed to Wave 16.
* Scoring may not proceed if Wave 16 eligibility depends on this gate.
* The failure reason must be logged.
* The user must be told what kind of semantic damage was detected.
* Revision or formal exception handling is required.

# 23. SCORING VALIDITY CONSTRAINT

No evaluation result may be treated as fully trustworthy if Gate 15.2 has failed. A structurally valid but semantically damaged chapter is not valid evaluative input.

# 24. STATE MODEL INTEGRATION

The Gate 15.2 state path should be:

* gate15\_2\_running
* gate15\_2\_pass OR gate15\_2\_fail
* eligible\_for\_wave16 OR blocked\_in\_revision

# 25. STATE DEFINITIONS

## 25.1 gate15\_2\_running

The system is actively evaluating semantic-preservation risk after Gate 15.1 has passed.

## 25.2 gate15\_2\_pass

The chapter remains semantically intact and may proceed.

## 25.3 gate15\_2\_fail

The chapter has sustained semantic damage significant enough to block progression.

## 25.4 blocked\_in\_revision

The chapter may not continue and must re-enter revision or exception handling.

## 25.5 eligible\_for\_wave16

The chapter has passed both Gate 15.1 and Gate 15.2 and may proceed to Wave 16.

# 26. IMPLEMENTATION MODEL — LAYER STRUCTURE

Gate 15.2 should be built in two layers, parallel in spirit to Gate 15.1 but different in function.

## 26.1 Layer 1 — Classification Layer

This layer performs structured semantic-risk detection. It does not make vague literary comments. It classifies likely semantic damage across defined channels.

* Voice Loss
* Behavior Loss
* Contradiction Loss
* Force Loss
* Inventory Loss

## 26.2 Layer 2 — Functional Review Layer

This layer performs confirmation review. It examines the original and corrected forms and decides whether the passage remains alive.

* PASS/FAIL only
* No 'maybe'
* No 'mostly'
* No partial approval language

# 27. PROPOSED REPO STRUCTURE

A repo-ready structure should mirror the Gate 15.1 plan but use Gate 15.2-specific naming.

/packages
 /canon
 gate15-2.ts
 gate15-2-thresholds.ts
 gate15-2-classification-register.ts
 /schemas
 gate15-2.schema.ts
 gate15-2-governance.schema.ts
 gate15-2-exception.schema.ts
 /classifiers
 gate15-2-layer1.ts
 gate15-2-force.ts
 gate15-2-behavior.ts
 gate15-2-inventory.ts
 /review
 gate15-2-layer2-review.ts
 gate15-2-layer2-prompt.ts
 gate15-2-passage-extractor.ts
 /storage
 gate15-2-evidence-pack.ts
 gate15-2-governance-log.ts
/services
 /governance-engine
 /chapter-orchestrator

# 28. CANON PACKAGE FILES

/packages/canon/gate15-2.ts should contain:

* name
* position
* blocking behavior
* failure handling
* classification channels
* relationship to Gate 15.1

/packages/canon/gate15-2-classification-register.ts should define protected semantic domains:

* voice
* behavior
* contradiction
* force
* inventory
* tone

# 29. SCHEMAS TO CREATE

Suggested base schema:

export type PassFail = "PASS" | "FAIL";

export interface SemanticFlaggedInstance {
 lineNumber?: number;
 matchedText?: string;
 category: "VOICE" | "BEHAVIOR" | "CONTRADICTION" | "FORCE" | "INVENTORY" | "TONE";
 rationale: string;
 context?: string;
 requiresJustification: boolean;
}

export interface SemanticLayer1Metric {
 status: PassFail;
 confidence: number;
 rationale: string;
 instances: SemanticFlaggedInstance[];
}

export interface SemanticLayer2Result {
 status: PassFail;
 rationale: string;
 reviewerType: "AI" | "HUMAN";
 instances?: SemanticFlaggedInstance[];
}

export interface Gate15\_2Result {
 chapterId: string;
 manuscriptId: string;
 overallStatus: PassFail;
 blocking: boolean;
 layer1: {
 voicePreservation: SemanticLayer1Metric;
 behavioralIntegrity: SemanticLayer1Metric;
 contradictionRetention: SemanticLayer1Metric;
 forcePreservation: SemanticLayer1Metric;
 inventoryPreservation: SemanticLayer1Metric;
 };
 layer2?: {
 semanticReview: SemanticLayer2Result;
 };
 failureHandlingTriggered: boolean;
 exceptionLogRequired: boolean;
 createdAt: string;
}

# 30. LAYER 1 CLASSIFIER RESPONSIBILITIES

/packages/classifiers/gate15-2-layer1.ts should:

* Compare original and corrected text where available
* Detect likely voice flattening
* Detect likely contradiction loss
* Detect likely behavior smoothing
* Detect likely force reduction
* Return deterministic classification output

Internal helpers might include:

detectVoiceFlattening()
detectBehaviorLoss()
detectContradictionLoss()
detectForceReduction()
detectInventoryReduction()

# 31. LAYER 2 FUNCTIONAL REVIEW

Layer 2 should review extracted passages that carry high semantic risk. It should compare the relevant forms and decide whether the protected function survived.

Required outputs:

* PASS/FAIL only
* concise rationale
* line references where possible
* domain classification of loss

# 32. GOVERNANCE ENGINE INTEGRATION

After Gate 15.1 passes:

* call Gate 15.2 Layer 1 classifier
* if Layer 1 fails or requires escalation, run Layer 2 review
* if Layer 2 fails, block chapter
* if Gate 15.2 passes, mark chapter eligible for Wave 16

No chapter may proceed while state is:

* gate15\_2\_running
* awaiting\_semantic\_review
* blocked\_in\_revision
* awaiting\_exception\_log

# 33. GOVERNANCE LOG EXAMPLE

{
 "chapterId": "ch\_078",
 "gate": "15.2",
 "status": "FAIL",
 "blocking": true,
 "reason": "Voice flattening and contradiction loss detected after structural cleanup",
 "nextState": "blocked\_in\_revision",
 "timestamp": "2026-03-22T20:15:00Z"
}

# 34. EXCEPTION LOG RULES

An exception does not erase semantic loss. It records why the system or reviewer chose to permit a flagged retention path.

export interface Gate15\_2ExceptionLogEntry {
 chapterId: string;
 gate: "15.2";
 category: string;
 lineNumber?: number;
 matchedText?: string;
 justification: string;
 approvedBy: "AI" | "HUMAN";
 timestamp: string;
}

# 35. UI REQUIREMENTS

The UI must make Gate 15.2 understandable to a non-engineer.

* Gate 15.2 status
* blocking yes/no
* what was lost
* why the system thinks it was lost
* what the user must do next
* whether an exception exists

# 36. API ENDPOINTS

POST /api/projects/:projectId/chapters/:chapterId/gates/15.2/run-layer1
POST /api/projects/:projectId/chapters/:chapterId/gates/15.2/run-layer2
GET /api/projects/:projectId/chapters/:chapterId/gates/15.2/result
POST /api/projects/:projectId/chapters/:chapterId/gates/15.2/exceptions
GET /api/projects/:projectId/chapters/:chapterId/gates/15.2/governance-log

# 37. TEST PLAN

Unit tests:

* voice-flattening detection
* behavior-loss detection
* contradiction-loss detection
* force-loss detection
* deterministic output on identical input

Integration tests:

* Gate 15.2 fail blocks Wave 16 progression
* Gate 15.2 pass permits progression after Gate 15.1 pass
* Exception logs are required where doctrine demands them

Golden tests:

* older rougher chapter sample vs revised sample
* sample where mechanical cleanup improved text without semantic loss
* sample where cleanup flattened voice and should fail

# 38. PR SEQUENCE

* PR 1 — Canon and schema foundation
* PR 2 — Layer 1 semantic classifiers
* PR 3 — Governance enforcement and state transitions
* PR 4 — Layer 2 review contract and extractor
* PR 5 — Front-end visibility
* PR 6 — Evidence pack and audit trail

# 39. COPILOT HANDOFF PROMPT

Use this as a direct handoff brief:

Implement Gate 15.2 in the RevisionGrade repo as a blocking semantic-preservation gate that runs after Gate 15.1 and before Wave 16.

Requirements:
1. Create canonical files for Gate 15.2, semantic classification domains, and governance definitions.
2. Create schemas for gate results, governance logs, chapter state, evidence packs, and exception logs.
3. Implement Layer 1 semantic classifiers for:
 - voice flattening
 - behavior loss
 - contradiction loss
 - force reduction
 - inventory loss
4. Integrate governance behavior:
 - fail blocks progression
 - fail returns chapter to revision
 - no progression to Wave 16 without pass
5. Implement Layer 2 review contract:
 - PASS/FAIL only
 - concise rationale
 - review original vs corrected passage behavior
6. Persist evidence artifacts and governance logs.
7. Add deterministic tests and blocking-behavior tests.

Deliver code in PR order:
PR1 canon+schemas
PR2 semantic classifiers
PR3 governance enforcement
PR4 layer2 review
PR5 front-end visibility
PR6 evidence pack

# 40. FINAL DOCTRINE

Gate 15.2 exists so that structural improvement never becomes narrative destruction. It ensures that the system does not reward prose for becoming cleaner if that cleanliness is purchased by losing voice, force, contradiction, or behavioral truth.

Gate 15.1 makes the text clean. Gate 15.2 ensures it is still alive. Both are required for valid evaluation.
