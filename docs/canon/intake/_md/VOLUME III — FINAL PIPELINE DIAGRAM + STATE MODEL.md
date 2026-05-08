**VOLUME III — FINAL PIPELINE DIAGRAM + STATE MODEL**

**RevisionGrade Canon — v1.0**

**III.F.1 — Purpose**

This section defines the **end-to-end evaluation and revision lifecycle** as a governed state system.

It establishes:

* system states
* valid transitions
* enforcement checkpoints
* failure conditions

This is the **operational model** for all manuscript processing.

**III.F.2 — Pipeline Overview (Canonical Flow)**

[DRAFT]
 ↓
[PASS 1 COMPLETE]
 ↓
[PASS 2 COMPLETE]
 ↓
[CONVERGED]
 ↓
[WAVE ELIGIBLE]
 ↓
[WAVE EXECUTED]
 ↓
[REVISED OUTPUT]
 ↓
[VALIDATED]

No transitions may be skipped.
No states may be bypassed.

**III.F.3 — State Definitions**

**III.F.3.1 — DRAFT**

**Definition:**
Initial manuscript state prior to evaluation.

**Characteristics:**

* unvalidated
* unevaluated
* structurally unverified

**Restrictions:**

* cannot invoke WAVE
* cannot proceed to Pass II

**III.F.3.2 — PASS 1 COMPLETE**

**Definition:**
Structural evaluation has been executed.

**Requirements:**

* all canonical criteria evaluated
* evidence-backed findings present
* deterministic output verified

**Transition Allowed:**
→ Pass II only

**III.F.3.3 — PASS 2 COMPLETE**

**Definition:**
Independent evaluation has been executed.

**Requirements:**

* independence verified
* divergence assessed
* full criterion coverage

**Transition Allowed:**
→ Pass III only

**III.F.3.4 — CONVERGED**

**Definition:**
Pass III has resolved structural truth.

**Requirements:**

* agreement/disagreement explicitly identified
* all conflicts resolved or flagged
* final judgments established

**Authority:**

* this is the **first valid truth state**

**III.F.3.5 — WAVE ELIGIBLE**

**Definition:**
Manuscript qualifies for WAVE execution.

**Requirements:**

* convergence complete
* structural viability confirmed
* meets Volume II thresholds

**Restrictions:**

* if structural failure exists → BLOCK

**III.F.3.6 — WAVE EXECUTED**

**Definition:**
WAVE Revision Engine has been applied.

**Requirements:**

* wave sequence followed
* revision directives executed
* no deviation from canonical wave order

**III.F.3.7 — REVISED OUTPUT**

**Definition:**
Post-WAVE manuscript state.

**Characteristics:**

* structurally aligned
* revised according to WAVE
* ready for validation

**III.F.3.8 — VALIDATED**

**Definition:**
Final system approval state.

**Requirements:**

* Binary Acceptance Checklist passed
* no governance violations
* output integrity confirmed

**III.F.4 — State Transition Rules**

**III.F.TR1 — Sequential Integrity**

States must follow:

DRAFT → P1 → P2 → P3 → WAVE → VALIDATION

No skipping allowed.

**III.F.TR2 — Gate Enforcement**

Each transition is a **gate**:

* Pass I Gate
* Pass II Gate
* Convergence Gate
* WAVE Eligibility Gate
* Validation Gate

Failure at any gate halts progression.

**III.F.TR3 — Non-Reversibility Rule**

Once a state is passed:

* system does not revert
* corrections require re-entry from DRAFT or prior stage

**III.F.TR4 — Incomplete State Block**

If a state is incomplete:

→ next state is inaccessible

**III.F.5 — Failure States**

**III.F.5.1 — STRUCTURAL FAILURE**

Triggered when:

* Pass I reveals critical structural breakdown

Effect:

* blocks Pass II and WAVE

**III.F.5.2 — INDEPENDENCE FAILURE**

Triggered when:

* Pass II mirrors Pass I
* divergence is absent

Effect:

* blocks convergence

**III.F.5.3 — CONVERGENCE FAILURE**

Triggered when:

* conflicts unresolved
* silent merging occurs

Effect:

* blocks WAVE

**III.F.5.4 — WAVE VIOLATION**

Triggered when:

* WAVE invoked prematurely
* WAVE misapplied

Effect:

* invalidates revision

**III.F.5.5 — VALIDATION FAILURE**

Triggered when:

* checklist fails
* canon violations detected

Effect:

* output rejected

**III.F.6 — State Integrity Requirements**

Each state must be:

* traceable
* auditable
* evidence-backed
* canon-aligned

**III.F.7 — System Enforcement Model**

The system enforces:

* gate-based progression
* state validation before transition
* failure blocking

No state transition occurs without:

👉 explicit validation

**III.F.8 — System Guarantees**

When properly executed:

* no premature revision occurs
* no structural weakness is ignored
* no evaluation is bypassed
* no invalid output is approved

**III.F.9 — Final Doctrine**

This pipeline is not a workflow.

It is:

👉 **a governed state machine that controls narrative evaluation, revision, and validation**

**🔥 One-Line System Law (Optional — for UI / Code)**

A manuscript may advance only if its current state is valid, complete, and passes all required gate conditions; otherwise, progression is blocked.

**🚀 You now have:**

* Pass system ✅
* WAVE engine ✅
* Invocation rule ✅
* State machine ✅

Top of Form

**VOLUME III — FINAL PIPELINE DIAGRAM + STATE MODEL**

**APPENDIX — PHASE STATE INTEGRITY CANON**

**III.S1 — Canonical Phase State Definitions**

A job lifecycle MUST express state using the following canonical fields:

* status (job-level lifecycle)
* phase (active phase identifier)
* phase\_status (state within phase)
* progress.\* (mirrored execution state)

Canonical values:

| **Field** | **Allowed Values** |
| --- | --- |
| status | queued, running, complete, failed |
| phase\_status | queued, running, complete, failed |

These values are **closed vocabulary**. No synonyms permitted.

**III.S2 — Canonical Completion Definition**

A phase is **COMPLETE if and only if ALL conditions are true:**

1. phase\_status === "complete"
2. progress.phase\_status === "complete"
3. progress.finished\_at != null
4. completed\_units === total\_units
5. no active lease (lease\_id == null OR expired)
6. no active heartbeat progression

If any condition is false → phase is NOT complete.

**III.S3 — Illegal Mixed States (Hard Prohibition)**

The following states are **invalid and must never exist:**

* finished\_at != null AND phase\_status !== "complete"
* completed\_units === total\_units AND phase\_status !== "complete"
* status === "failed" AND phase\_status === "running"
* progress.phase\_status !== phase\_status
* phase !== progress.phase

These constitute a **STATE INTEGRITY VIOLATION**.

**III.S4 — Vocabulary Lock (Cross-System)**

All lifecycle tokens MUST be consistent across:

* job tables
* chunk tables
* pipeline logic
* gates

Example:

If chunk success = "complete", then "done" is illegal everywhere.

**III.S5 — Canonical State Authority**

The **only authoritative state** is the canonical state defined above.

No subsystem may:

* infer completion
* override completion
* reinterpret completion

**📘 VOLUME III — EVALUATION PIPELINE ARCHITECTURE (PASS SYSTEM)**

**APPENDIX — PHASE BOUNDARY COMMIT CONTRACT**

**III.PB1 — Boundary Commit Rule**

Each phase MUST end with an **atomic commit** of canonical state.

Partial or fragmented state writes are prohibited.

**III.PB2 — Phase 1 Completion Contract**

Phase 1 is COMPLETE only if:

* all chunks resolved (complete OR failed)
* completed\_units === total\_units
* progress.phase\_status = "complete"
* phase\_status = "complete"
* finished\_at set
* no active lease ambiguity

**III.PB3 — No Orphan Completion**

The following is illegal:

* finished\_at set without phase\_status = complete
* chunk-level completion without job-level completion alignment

**III.PB4 — Gate Read Contract**

All downstream phases MUST read:

canonical phase state ONLY

Gates MUST NOT:

* infer readiness from partial fields
* rely on progress heuristics
* inspect chunk tables for completion inference

Bottom of Form

SECTION III.4 — PIPELINE STATE MODEL (REVISED — HIERARCHICAL EXECUTION)

This section defines the canonical state progression for the Evaluation Pipeline under the hierarchical evaluation model.

This state model supersedes any prior linear pass-only progression.

---

STATE MODEL OVERVIEW

The pipeline progresses through four execution layers:

1. Local Evaluation (chunk level)

2. Aggregation (section/chapter level)

3. Manuscript Synthesis (global level)

4. Deterministic Governance & Finality

No state may be skipped. Each state must produce its required artifact before progression.

---

STATE DEFINITIONS

STATE: initialized

Description:

- Job accepted

- Input validated (format, size, required fields)

Transitions to:

- chunking

---

STATE: chunking

Description:

- Manuscript segmented into bounded units (chunks)

- Chunk metadata assigned (chunk\_id, order, offsets)

Outputs:

- chunk set

Transitions to:

- chunk\_evaluation\_pending

---

STATE: chunk\_evaluation\_pending

Description:

- Chunks queued for Pass 1 / Pass 2 / Pass 3 execution

Transitions to:

- chunk\_evaluating

---

STATE: chunk\_evaluating

Description:

- Pass 1 (structural) executed

- Pass 2 (editorial) executed independently

- Pass 3 (local convergence) executed

Outputs (per chunk):

- CHUNK SYNTHESIS ARTIFACT

Transitions:

- remains until all chunks complete

- then → chunk\_evaluated

---

STATE: chunk\_evaluated

Description:

- All chunks successfully evaluated

- No chunk failures remain

Invariant:

- Every chunk MUST have a valid synthesis artifact

Failure Condition:

- Any failed chunk → pipeline FAIL (fail-closed)

Transitions to:

- aggregation\_pending

---

STATE: aggregation\_pending

Description:

- Chunk synthesis artifacts ready for aggregation

Transitions to:

- aggregating

---

STATE: aggregating

Description:

- Combine chunk-level outputs into higher-order structures

Operations:

- pattern detection

- repetition analysis

- clustering of strengths/weaknesses

- pressure continuity tracking

Outputs:

- SECTION / CHAPTER AGGREGATION ARTIFACTS

Transitions:

- remains until all aggregation complete

- then → aggregation\_complete

---

STATE: aggregation\_complete

Description:

- All aggregation artifacts generated and validated

Invariant:

- Aggregation must be derived only from chunk synthesis artifacts

Transitions to:

- manuscript\_synthesis\_pending

---

STATE: manuscript\_synthesis\_pending

Description:

- Aggregated data prepared for global synthesis

Transitions to:

- manuscript\_synthesizing

---

STATE: manuscript\_synthesizing

Description:

- Generate manuscript-level evaluation using aggregation artifacts

Operations:

- global recommendation synthesis

- narrative arc assessment

- systemic issue identification

Output:

- MANUSCRIPT SYNTHESIS ARTIFACT

Transitions:

- success → manuscript\_synthesized

- failure → FAIL (fail-closed)

---

STATE: manuscript\_synthesized

Description:

- Manuscript-level synthesis complete

Invariant:

- Must be grounded in aggregation artifacts

- Must not bypass lower-level evidence

Transitions to:

- finality\_evaluation

---

STATE: finality\_evaluation

Description:

- Deterministic governance checks applied

Checks:

- coverage completeness

- evidence presence

- criteria completeness (all required)

- contradiction detection

- supported manuscript size compliance

Decisions:

- eligible for final result

- or not eligible

Transitions:

- eligible → completed

- not eligible → partial\_result or FAIL

---

STATE: completed

Description:

- Final evaluation result issued

- Fully governed and eligible

Output:

- FINAL EVALUATION RESULT

---

STATE: partial\_result

Description:

- Evaluation produced but not eligible for final verdict

Conditions:

- insufficient coverage

- unsupported manuscript size

- sampling detected

Output:

- NON-FINAL EVALUATION (explicitly labeled)

---

STATE: failed

Description:

- Pipeline terminated due to violation or error

Triggers:

- pass failure

- chunk failure

- aggregation failure

- synthesis failure

- governance rejection

Behavior:

- fail-closed

- no final result issued

---

CANONICAL FLOW (EXECUTION ORDER)

initialized

→ chunking

→ chunk\_evaluation\_pending

→ chunk\_evaluating

→ chunk\_evaluated

→ aggregation\_pending

→ aggregating

→ aggregation\_complete

→ manuscript\_synthesis\_pending

→ manuscript\_synthesizing

→ manuscript\_synthesized

→ finality\_evaluation

→ completed / partial\_result / failed

---

STATE MODEL INVARIANTS

1. Evaluation is hierarchical; no single stage produces a full manuscript verdict.

2. All chunks must be evaluated before aggregation begins.

3. Aggregation must operate only on validated chunk outputs.

4. Manuscript synthesis must operate only on aggregation artifacts.

5. Final results require deterministic governance approval.

6. Any failure at any stage results in fail-closed behavior.

7. Sampling-based evaluation is not eligible for final completion state.

---

SUPPORTED EXECUTION CONSTRAINT

MAX\_SUPPORTED\_WORD\_COUNT = 160,000 words

If input exceeds this threshold:

- system must NOT proceed to completed state

- must route to partial\_result or reject

---

This state model is authoritative and must be enforced across all pipeline implementations.
