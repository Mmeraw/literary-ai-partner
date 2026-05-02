**GATE 15 MASTER DOCTRINE (V1)
ULTRA-EXPANDED ENGINEERING + NEOPHYTE SPEC**

*RevisionGrade Canon — Master Interaction Doctrine for Gate 15.1 and Gate 15.2*

# 1. PURPOSE

This document defines the master doctrine governing the relationship between Gate 15.1 and Gate 15.2. It exists to remove ambiguity. It is written for two audiences at once: engineers who must implement the system, and new employees who must understand what the system is doing, why it is doing it, and what words such as 'pass', 'block', and 'continue' actually mean in operational terms.

This is not a summary note. It is a binding system manual. It establishes sequence, authority, definitions, failure effects, allowed transitions, and conflict-resolution rules. Its purpose is to ensure that no person reading it has to guess how Gate 15 behaves.

# 2. WHY GATE 15 EXISTS

Gate 15 exists because narrative text can fail in two different ways before full evaluation begins.

* First, the text can be mechanically noisy. Dialogue tags can be excessive. Attribution can be doing work that structure should be doing. Internal thought and spoken dialogue can be mixed incorrectly. This is the Gate 15.1 problem.
* Second, the text can be mechanically cleaned in a way that damages meaning. Voice can be flattened. Character contradiction can be erased. Necessary friction can be removed in the name of tidiness. This is the Gate 15.2 problem.

Most systems handle only the first problem. RevisionGrade is designed to handle both. That is why Gate 15 is not a single gate. It is a paired-gate architecture.

# 3. HIGH-LEVEL SYSTEM TRUTH

Gate 15.1 and Gate 15.2 must remain separate. They are related, but they are not the same thing.

* Gate 15.1 validates structural purity.
* Gate 15.2 validates semantic preservation.
* Gate 15.1 removes false positives caused by noise.
* Gate 15.2 removes false positives caused by destructive overcorrection.

In plain terms: Gate 15.1 cleans the signal. Gate 15.2 ensures that cleaning the signal did not destroy what mattered.

# 4. DEFINITIONS — CORE TERMS

## 4.1 PASS

PASS means the gate has completed its required checks and has found no blocking condition. PASS does not mean the writing is perfect. PASS means the text is valid enough to proceed to the next defined stage.

* For Gate 15.1, PASS means the text is structurally valid for downstream narrative evaluation.
* For Gate 15.2, PASS means that structural cleanup has not caused unacceptable semantic damage.

## 4.2 FAIL

FAIL means the gate has identified at least one condition that the doctrine defines as disqualifying for progression. FAIL is not a casual warning. FAIL changes system behavior.

* A FAIL result halts the current path of progression.
* A FAIL result triggers a defined failure path.
* A FAIL result must be logged, surfaced, and preserved in audit history.

## 4.3 BLOCK

BLOCK is the enforcement action the system takes after a FAIL. It means the chapter is not permitted to move forward in the pipeline.

* BLOCK prevents the next gate or next wave from executing.
* BLOCK prevents scoring if the doctrine says scoring depends on passing the failed gate.
* BLOCK forces the chapter into a revision or exception-handling path.

In simple language: FAIL is the judgment. BLOCK is the system consequence.

## 4.4 CONTINUE

CONTINUE means the chapter is permitted to proceed to the next defined stage in the pipeline. CONTINUE happens only after a PASS state, or after a formally approved exception if the doctrine allows one.

* CONTINUE is not a general green light to do anything.
* CONTINUE means only: move from the current valid stage to the next authorized stage.

## 4.5 REVISION

REVISION is the correction phase entered after a block. It means the chapter must be changed, justified, or resubmitted before it can re-enter the governed path.

## 4.6 EXCEPTION

An exception is a formally logged justification for retaining something that would otherwise count as a violation. An exception does not erase the flag. It converts an unresolved issue into an explicitly governed retention path.

## 4.7 OVERRIDE

An override is an authority action that permits progression despite a normal blocking condition. Overrides are dangerous and therefore tightly constrained. If an override exists, it must be explicit, logged, reviewable, and doctrinally permitted.

Important distinction: an exception justifies a flagged item; an override changes whether a blocking condition blocks the pipeline.

## 4.8 STATE

A state is the chapter's current governed position in the system. A state is not a comment or impression. It is a formal machine-readable condition that determines what may happen next.

## 4.9 STATE TRANSITION

A state transition is a movement from one valid state to another. State transitions must be explicit, logged, and legal under doctrine.

## 4.10 STRUCTURAL VALIDITY

Structural validity means the chapter is mechanically and formally stable enough to be evaluated without distortion caused by dialogue noise, boundary confusion, or attribution dependence.

## 4.11 SEMANTIC INTEGRITY

Semantic integrity means the chapter still preserves intended force, contradiction, texture, voice, and behavior after structural cleanup. A text can be structurally cleaner and semantically worse. Gate 15.2 exists to detect that.

# 5. GATE 15 ARCHITECTURE

Gate 15 is a sequential pair:

* Wave 15 completes
* Gate 15.1 executes
* Gate 15.2 executes
* Wave 16 begins only if both gates pass

This architecture is mandatory. Gate 15.2 is not a substitute for Gate 15.1. Gate 15.1 is not allowed to pretend that semantic preservation is someone else's problem.

# 6. GATE 15.1 — ROLE

Gate 15.1 is the Dialogue & Attribution Purity Gate. It is concerned with structural purity. Its job is to determine whether the chapter's dialogue and internal/external boundary mechanics are valid enough to trust the next stages of evaluation.

* It detects attribution density problems.
* It detects overuse of soft tags.
* It detects redundant thought-verbs when POV is already established.
* It detects physiological filler overload.
* It tests whether italics and quotation boundaries are being used correctly.
* It tests whether dialogue can stand without attribution crutches.

# 7. GATE 15.2 — ROLE

Gate 15.2 is the Overcorrection Firewall. It is concerned with semantic preservation. Its job is to determine whether cleanup, correction, or enforcement has damaged the living function of the prose.

* It protects voice from flattening.
* It protects contradiction from being 'tidied away.'
* It protects behavioral specificity.
* It protects force, threat, asymmetry, and pressure.
* It detects when correct-looking prose has become dead prose.

# 8. EXECUTION ORDER LAW

Gate 15.1 must always run before Gate 15.2. This is absolute.

Reason: semantic-preservation review is meaningful only after structural validity has been established. If the structure is still broken, Gate 15.2 would be operating on unstable input and could not produce trustworthy results.

# 9. STRUCTURAL PRIORITY LAW

If Gate 15.1 fails, Gate 15.2 must not execute.

This prevents a common governance error: trying to save meaning inside a text that is still mechanically invalid. Meaning cannot legitimize broken structure. Structure must first become valid enough for meaning-protection review to matter.

# 10. NON-OVERRIDE LAW

Gate 15.2 may not override structural failures from Gate 15.1.

This is one of the most important rules in the whole system. It prevents the semantic gate from becoming a loophole.

* A chapter does not pass because it is interesting.
* A chapter does not pass because the voice is strong.
* A chapter does not pass because the contradiction is intentional.
* If Gate 15.1 says the structure is invalid, that invalidity must be addressed first.

# 11. SIMPLE WALKTHROUGH FOR NEW EMPLOYEES

Imagine a chapter with strong, vivid dialogue—but every line needs 'he said' or 'she asked' for the reader to know who is speaking.

* Gate 15.1 sees that as structural weakness because the dialogue is dependent on attribution.
* The chapter fails Gate 15.1.
* The system blocks progression.
* Gate 15.2 never runs, because there is no point assessing preserved meaning in dialogue that is still structurally dependent.

Now imagine a second chapter where the dialogue was cleaned so aggressively that each speaker sounds the same and their original friction disappears.

* Gate 15.1 may pass, because the tags are reduced and the structure is cleaner.
* Gate 15.2 then runs and detects semantic flattening.
* The chapter fails Gate 15.2.
* The system blocks progression again—but for a different reason.

# 12. WHAT 'BLOCKED' MEANS IN PRACTICE

When a chapter is blocked, the following are true unless a more specific doctrine says otherwise:

* The next pipeline stage may not execute.
* The chapter may not be marked eligible for the next wave.
* Scoring, if dependent on this gate, may not proceed.
* The current failure reason must be stored.
* The user must be able to see what blocked the chapter.
* The system must define what action is required to clear the block.

# 13. WHAT 'CONTINUE' MEANS IN PRACTICE

When a chapter continues, the following are true:

* The current gate has completed successfully.
* The chapter is allowed to move into the next authorized state.
* The next stage may begin.
* The pass result and associated evidence must still be stored.

Continue does not mean 'done forever.' It means 'valid to proceed from here.'

# 14. FAILURE HIERARCHY

## 14.1 Gate 15.1 Failure

This is a structural failure. The text is not yet trustworthy enough for downstream evaluation.

* Effect: block progression
* Effect: force revision or exception handling
* Effect: prevent downstream use of the chapter as valid evaluative input

## 14.2 Gate 15.2 Failure

This is a semantic-preservation failure. The text may be structurally cleaner, but the meaning has become damaged or over-simplified.

* Effect: block progression
* Effect: force revision or exception handling
* Effect: prevent a false belief that 'cleaner' automatically means 'better'

# 15. CONFLICT RESOLUTION

If the gates appear to disagree, resolve the situation in this order:

* First ask whether Gate 15.1 passed. If not, stop there. Structural failure governs.
* If Gate 15.1 passed, then evaluate Gate 15.2.
* If Gate 15.2 fails after Gate 15.1 passes, the text is structurally valid but semantically compromised.
* That is not a contradiction. It is a valid sequential finding.

# 16. STATE MODEL

The chapter should move through the Gate 15 portion of the state model as follows:

* wave15\_complete
* gate15\_1\_running
* gate15\_1\_pass OR gate15\_1\_fail
* if gate15\_1\_pass → gate15\_2\_running
* gate15\_2\_pass OR gate15\_2\_fail
* if gate15\_2\_pass → eligible\_for\_wave16
* if either gate fails → blocked\_in\_revision

# 17. STATE DEFINITIONS

## 17.1 gate15\_1\_running

The system is actively executing Gate 15.1 checks.

## 17.2 gate15\_1\_pass

Gate 15.1 completed and found no blocking structural defect.

## 17.3 gate15\_1\_fail

Gate 15.1 completed and found a blocking structural defect.

## 17.4 gate15\_2\_running

The system is actively executing Gate 15.2 checks after structural validity has been confirmed.

## 17.5 gate15\_2\_pass

Gate 15.2 completed and found no blocking semantic-preservation defect.

## 17.6 gate15\_2\_fail

Gate 15.2 completed and found a blocking semantic-preservation defect.

## 17.7 blocked\_in\_revision

The chapter may not proceed and must re-enter a revision or exception path.

## 17.8 eligible\_for\_wave16

The chapter has passed both required gates and may proceed to Wave 16.

# 18. ENGINE CONTRACT — IMPLEMENTATION MEANING

For engineers, the minimum correct control logic is:

runGate15Pipeline(chapter):
 result15\_1 = runGate15\_1(chapter)
 persist(result15\_1)

 if result15\_1.status == "FAIL":
 setState("blocked\_in\_revision")
 return BLOCK

 result15\_2 = runGate15\_2(chapter)
 persist(result15\_2)

 if result15\_2.status == "FAIL":
 setState("blocked\_in\_revision")
 return BLOCK

 setState("eligible\_for\_wave16")
 return CONTINUE

# 19. WHAT MUST BE PERSISTED

At minimum, the system must persist:

* gate id
* chapter id
* run timestamp
* pass/fail result
* failure reason
* line-level or unit-level supporting evidence where available
* current chapter state after the gate decision
* exception status if any

# 20. WHAT THE UI MUST SHOW

A new employee or user should not have to inspect logs to know what happened.

* current Gate 15.1 status
* current Gate 15.2 status
* whether progression is blocked
* why it is blocked
* what action is needed next
* whether an exception exists
* what state the chapter is currently in

# 21. COMMON MISUNDERSTANDINGS TO PREVENT

* Passing Gate 15.1 does not mean the chapter is good. It means the chapter is structurally valid enough to continue.
* Failing Gate 15.2 does not mean Gate 15.1 was wrong. It means structural correctness did not preserve meaning sufficiently.
* An exception is not the same thing as a pass.
* A warning is not the same thing as a block.
* Continue does not mean publish-ready. It means eligible for the next governed step.

# 22. FINAL DOCTRINE

Gate 15 is a dual-layer truth-enforcement system.

* Gate 15.1 ensures the text is structurally valid.
* Gate 15.2 ensures the structurally valid text has not been semantically damaged.
* Structure is validated before meaning is protected.
* Meaning may not overrule structural invalidity.
* A chapter reaches Wave 16 only after both truths have been enforced.

This doctrine exists so that no engineer implements the gates in the wrong order, no reviewer confuses structural pass with semantic pass, and no new employee is forced to infer what the system means by words like pass, fail, block, continue, exception, or override.
