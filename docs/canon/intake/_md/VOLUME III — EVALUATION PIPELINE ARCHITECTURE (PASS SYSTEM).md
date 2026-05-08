**VOLUME III — EVALUATION PIPELINE ARCHITECTURE (PASS SYSTEM)**

**RevisionGrade Canon — v1.0 (Draft for Lock)**

**1. Purpose**

This volume defines the **multi-pass evaluation architecture** of the RevisionGrade system.

It establishes how manuscript evaluation transitions from:

* **analysis → divergence → convergence → revision action**

This system ensures:

* deterministic structural evaluation
* independent analytical validation
* controlled convergence into final truth
* alignment with WAVE-based revision execution

This volume is not advisory.
It defines the **evaluation pipeline through which all manuscripts must pass**.

**2. System Overview**

The RevisionGrade Evaluation Pipeline is composed of three mandatory passes:

Original Manuscript
 ↓
Pass 1 — Structural Evaluation (Deterministic)
 ↓
Pass 2 — Independent Evaluation (Divergent)
 ↓
Pass 3 — Convergence (Truth Resolution)
 ↓
WAVE Revision Engine
 ↓
Final Chapter Output

No stage may be skipped.
No stage may be merged.
No stage may be bypassed.

**3. Pipeline Law**

**III.PL1 — Sequential Execution Rule**

All passes must execute in strict order:

Pass 1 → Pass 2 → Pass 3 → WAVE

No pass may begin until the prior pass is complete and valid.

**III.PL2 — Non-Bypass Rule**

No manuscript may:

* skip a pass
* combine passes
* proceed to WAVE without convergence

Violation invalidates the evaluation.

**III.PL3 — Determinism Requirement**

For identical input:

* Pass 1 must produce identical output
* Pass 2 must produce independently consistent output
* Pass 3 must produce identical convergence outcomes

**III.PL4 — Authority Separation Rule**

Each pass operates under distinct authority:

* Pass 1 → Structural Authority
* Pass 2 → Independent Analytical Authority
* Pass 3 → Convergence Authority

No pass may assume the role of another.

**4. Pass 1 — Structural Evaluation (Deterministic)**

**III.P1.1 — Purpose**

Pass 1 establishes **baseline structural truth**.

It evaluates:

* narrative structure
* pacing architecture
* scene function
* structural coherence

**III.P1.2 — Behavior**

Pass 1 must:

* use canonical criteria only
* produce evidence-backed findings
* operate deterministically
* avoid stylistic or interpretive drift

**III.P1.3 — Output Requirements**

Each criterion must include:

* Structural Finding
* Evidence
* Structural Impact
* Judgment

**III.P1.4 — Constraints**

Pass 1:

* MUST NOT speculate
* MUST NOT generalize
* MUST NOT produce generic critique
* MUST remain within structural scope

**III.P1.5 — Output Nature**

Pass 1 produces:

* **grounded, repeatable structural analysis**

It does not resolve disagreement.
It does not finalize truth.

**5. Pass 2 — Independent Evaluation (Divergence)**

**III.P2.1 — Purpose**

Pass 2 introduces **independent analytical perspective**.

It exists to:

* validate or challenge Pass 1
* expose hidden weaknesses
* prevent single-perspective bias

**III.P2.2 — Independence Rule**

Pass 2 must:

* operate without reliance on Pass 1 conclusions
* evaluate the manuscript independently
* generate its own reasoning

**III.P2.3 — Divergence Requirement**

Pass 2 must:

* allow disagreement with Pass 1
* surface alternative interpretations
* identify structural conflicts

Agreement is allowed.
Forced agreement is prohibited.

**III.P2.4 — Output Requirements**

Must match Pass 1 structure:

* Criterion
* Finding
* Evidence
* Impact
* Judgment

**III.P2.5 — Constraints**

Pass 2:

* MUST NOT collapse into Pass 1
* MUST NOT mirror Pass 1 language
* MUST maintain analytical independence

**III.P2.6 — Output Nature**

Pass 2 produces:

* **parallel structural truth candidate**

It expands the system’s perception space.

**6. Pass 3 — Convergence (Truth Resolution)**

**III.P3.1 — Purpose**

Pass 3 resolves:

* agreement
* disagreement
* structural conflicts

It produces **final evaluation truth**.

**III.P3.2 — Convergence Law**

Pass 3 must:

1. Identify agreement between Pass 1 and Pass 2
2. Identify disagreement explicitly
3. Resolve differences with justification
4. Produce unified final judgment

**III.P3.3 — Prohibited Behavior**

Pass 3 must NOT:

* silently overwrite disagreement
* collapse one pass into another
* average outputs without reasoning

**III.P3.4 — Output Requirements**

For each criterion:

* Agreement Status (Agree / Disagree)
* Conflict Description (if applicable)
* Resolution Logic
* Final Judgment

**III.P3.5 — Final Output**

Pass 3 produces:

* **canonical structural truth**
* **final criterion judgments**
* **resolved evaluation state**

**III.P3.6 — Authority**

Pass 3 is the only stage that:

* finalizes evaluation outcomes
* prepares data for revision execution

**7. WAVE Revision Engine Integration**

**III.W1 — Purpose**

The WAVE system converts evaluation output into **revision action**.

**III.W2 — Input Requirements**

WAVE receives:

* Pass 3 final judgments
* structural strengths
* structural weaknesses
* dominant narrative patterns

**III.W3 — WAVE Mapping**

Evaluation output must map to:

* Opening Wave (setup strength / weakness)
* Rising Wave (progression / escalation)
* Pressure / Collapse (tension architecture)
* Resolution Wave (payoff integrity)

**III.W4 — Function**

WAVE:

* prioritizes revisions
* sequences improvements
* ensures narrative flow integrity

**III.W5 — Constraint**

WAVE must NOT:

* reinterpret evaluation
* override Pass 3 conclusions

It operates strictly as:
👉 **execution layer for revision**

**8. Output Integration**

**III.O1 — Final Chapter Output**

The system must produce:

* Converged evaluation (Pass 3)
* WAVE-guided revision priorities
* structured revision targets

**III.O2 — Validity Requirement**

No output is valid unless:

* all three passes completed
* convergence performed
* WAVE mapping applied

**9. Failure Conditions**

Evaluation is INVALID if:

* any pass is missing
* Pass 2 lacks independence
* Pass 3 lacks explicit convergence
* disagreement is unresolved
* WAVE is applied without convergence

**10. System Guarantee**

When properly executed:

* no structural weakness goes unchallenged
* no bias dominates evaluation
* no disagreement is hidden
* no revision occurs without grounded truth

This produces:

👉 **deterministic, multi-perspective, converged narrative evaluation**

**11. Final Doctrine**

The Evaluation Pipeline is not a review process.
It is:

**the mechanism by which narrative truth is discovered, tested, and resolved before revision occurs.**

**12. Next Step (Locked Sequence)**

Next:

👉 **Pass 2 Prompt Specification (Independent Evaluation Engine)**
→ introduces divergence logic
→ enforces independence
→ prevents collapse into Pass 1

**VOLUME III — EVALUATION PIPELINE ARCHITECTURE (PASS SYSTEM)**

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

Top of Form

**SECTION III.2 — PASS ROLE BOUNDARIES (REVISED)**

This section defines the authoritative role boundaries for Pass 1, Pass 2, and Pass 3 within the Evaluation Pipeline. These boundaries are strict and enforceable. Any deviation constitutes a pipeline violation.

PURPOSE

To ensure:

- signal independence (Pass 1 vs Pass 2)

- controlled convergence (Pass 3)

- prevention of scope inflation

- correct separation between local evaluation and global synthesis

PASS OWNERSHIP DEFINITIONS

PASS 1 — STRUCTURAL / CRAFT EVALUATION

Scope:

- Evaluates structural, mechanical, and craft-level execution

- Operates on a bounded input unit (chunk or defined segment)

Owns:

- structural clarity

- pacing mechanics

- scene construction

- syntax-level craft signals

- technical execution patterns

Must NOT:

- incorporate Pass 2 reasoning

- infer thematic or interpretive intent beyond structural evidence

- perform cross-chunk or cross-chapter reasoning

- produce manuscript-level conclusions

PASS 2 — EDITORIAL / LITERARY EVALUATION

Scope:

- Evaluates interpretive, thematic, and narrative effectiveness

- Operates on the same bounded input unit as Pass 1

- Must remain independent of Pass 1 output

Owns:

- narrative impact

- thematic coherence

- character interpretation

- emotional and literary resonance

Must NOT:

- access or incorporate Pass 1 output

- perform structural diagnosis beyond interpretive observation

- perform cross-chunk or cross-chapter reasoning

- produce manuscript-level conclusions

PASS 3 — LOCAL CONVERGENCE ENGINE

Scope:

- Reconciles Pass 1 and Pass 2 outputs for the SAME bounded input unit only

- Produces a unified, evidence-backed local synthesis

Owns:

- agreement detection between Pass 1 and Pass 2

- divergence identification and explicit arbitration

- final local scoring for each criterion

- evidence-backed rationale at the local level

Must NOT:

- compute full manuscript conclusions

- merge global recommendations across chunks

- decide final manuscript verdicts for multi-chunk inputs

- perform cross-chapter or cross-section reasoning

- act as final authority for evaluation acceptance

- re-evaluate the manuscript independently of Pass 1 and Pass 2

PASS 3 OUTPUT CONSTRAINT

Pass 3 output is defined as:

- a LOCAL SYNTHESIS ARTIFACT

- valid only for the bounded input unit it was generated from

It is NOT:

- a manuscript-level evaluation

- a final system verdict

- a complete representation of the entire work

INVARIANTS

1. Pass 1 and Pass 2 remain strictly independent.

2. Pass 3 operates only on Pass 1 and Pass 2 outputs for the same unit.

3. No pass may claim authority beyond its defined scope.

4. Manuscript-level judgment is not permitted within Pass 1, Pass 2, or Pass 3.

5. All global reasoning is deferred to higher-level synthesis layers.

Violation of any invariant results in:

- pipeline invalidation

- governance rejection (fail-closed)

---

**SECTION III.3 — HIERARCHICAL EVALUATION MODEL**

This section defines the multi-level evaluation architecture required to support full-manuscript analysis while preserving local evaluation integrity.

OVERVIEW

The Evaluation Pipeline is hierarchical. Evaluation proceeds from local units upward to global synthesis. No single pass is responsible for full-manuscript reasoning.

The hierarchy is defined as:

LEVEL 1 — LOCAL EVALUATION (CHUNK LEVEL)

Components:

- Pass 1 (Structural)

- Pass 2 (Editorial)

- Pass 3 (Local Convergence)

Input:

- bounded manuscript segment (chunk)

Output:

- CHUNK SYNTHESIS ARTIFACT

Characteristics:

- fully evaluated

- evidence-backed

- self-contained

- no cross-chunk awareness

---

LEVEL 2 — AGGREGATION (SECTION / CHAPTER LEVEL)

Purpose:

- combine multiple chunk synthesis artifacts

- detect recurring patterns and signals

Owns:

- repetition detection

- pattern frequency analysis

- structural drift identification

- pressure continuity across adjacent segments

- clustering of weaknesses and strengths

Characteristics:

- primarily deterministic

- may include limited synthesis

- operates on structured outputs (not raw manuscript text)

Output:

- SECTION / CHAPTER AGGREGATION ARTIFACT

Must NOT:

- fabricate new evidence

- override chunk-level truth without justification

- act as final manuscript authority

---

LEVEL 3 — MANUSCRIPT SYNTHESIS (GLOBAL LEVEL)

Purpose:

- produce a unified, manuscript-level evaluation using aggregated data

Input:

- aggregation artifacts (not raw manuscript text as primary source)

Owns:

- full manuscript conclusions

- global recommendation synthesis

- narrative arc assessment

- thematic consistency evaluation across the work

- identification of systemic strengths and weaknesses

Characteristics:

- may use model-based synthesis

- must remain grounded in aggregated evidence

- must not bypass lower-level outputs

Output:

- MANUSCRIPT SYNTHESIS ARTIFACT

---

LEVEL 4 — DETERMINISTIC GOVERNANCE & FINALITY

Purpose:

- enforce truth, completeness, and acceptance criteria

Owns:

- coverage validation

- evidence validation

- criteria completeness (all 13 required)

- contradiction detection

- confidence bounding

- final verdict eligibility

Key Rules:

- No final verdict without sufficient coverage

- No final verdict from sampled input alone

- Confidence must reflect actual evaluated scope

- Unsupported manuscript sizes must fail or downgrade explicitly

Output:

- FINAL EVALUATION RESULT (only if eligible)

---

SUPPORTED MANUSCRIPT SCOPE (LAUNCH CONSTRAINT)

At launch, the system guarantees full-governance evaluation for manuscripts up to:

MAX\_SUPPORTED\_WORD\_COUNT = 160,000 words

For manuscripts exceeding this threshold:

- full evaluation is not guaranteed

- system must either:

- reject the input, OR

- downgrade to a non-final / partial evaluation mode

---

ARCHITECTURAL INVARIANTS

1. Evaluation flows upward: chunk → aggregation → manuscript → governance

2. No lower level may assume knowledge of higher levels

3. No higher level may bypass validated lower-level outputs

4. Sampling (e.g., beginning/middle/end) is NOT sufficient for final evaluation

5. All final judgments must be grounded in evaluated coverage

---

CANONICAL FLOW

Chunk Input

→ Pass 1 / Pass 2

→ Pass 3 (Local Convergence)

→ Aggregation Layer

→ Manuscript Synthesis

→ Deterministic Governance

→ Final Result (if eligible)

---

This hierarchical model replaces any prior assumption that a single pass (including Pass 3) can produce a complete manuscript evaluation.

All pipeline implementations MUST conform to this structure.Bottom of Form

**SECTION III.4 — PASS SYSTEM REDEFINITION (CHUNK-SCOPED EVALUATION)**

This section formally redefines the role, scope, and limitations of Pass 1, Pass 2, and Pass 3 within the Evaluation Pipeline.

These definitions are canonical and override prior interpretations.

---

I. CORE PRINCIPLE

Passes operate at the CHUNK level only.

No pass may:

- reason across the full manuscript

- produce global conclusions

- issue final verdicts

- merge cross-chunk outputs

All passes are LOCAL evaluators.

Global reasoning is performed exclusively by downstream aggregation and synthesis layers.

---

II. PASS 1 — STRUCTURAL / CRAFT EVALUATION

Purpose:

Evaluate mechanical, structural, and execution-level writing quality.

Scope:

- single chunk only

Responsibilities:

- structural clarity

- sentence-level execution

- pacing at local scale

- dialogue clarity (must align with Gate 15.1)

- mechanical correctness

- local narrative pressure detection

Output:

- criterion-level craft\_score

- evidence spans

- structural observations

Restrictions:

- MUST NOT interpret theme

- MUST NOT assign meaning beyond text

- MUST NOT infer author intent

- MUST NOT perform cross-chunk reasoning

---

III. PASS 2 — EDITORIAL / INTERPRETIVE EVALUATION

Purpose:

Evaluate narrative meaning, thematic coherence, and interpretive signals.

Scope:

- single chunk only

Responsibilities:

- thematic signal detection

- character interpretation (local scope)

- narrative implication within chunk

- tone and voice interpretation

- local narrative momentum

Output:

- criterion-level editorial\_score

- interpretive rationale

- evidence spans

Restrictions:

- MUST NOT override Pass 1 structural findings

- MUST NOT assume global arc knowledge

- MUST NOT perform cross-chapter reasoning

- MUST NOT produce final recommendations at manuscript level

---

IV. PASS 3 — LOCAL SYNTHESIS ENGINE

Purpose:

Reconcile Pass 1 and Pass 2 outputs for a single chunk.

Scope:

- single chunk only

Responsibilities:

- compare craft\_score vs editorial\_score

- expose agreement and divergence

- perform bounded arbitration

- produce final\_score\_0\_10 per criterion

- generate unified local recommendations

- enforce pressure → decision → consequence logic

Output:

- chunk-level unified evaluation (CHUNK SYNTHESIS ARTIFACT)

---

V. PASS 3 — HARD RESTRICTIONS (NON-NEGOTIABLE)

Pass 3 MUST NOT:

- compute full manuscript conclusions

- merge global recommendations

- decide final verdict for long manuscripts

- perform cross-chapter reasoning

- act as a final authority

- infer systemic patterns beyond the chunk

Violation of these rules invalidates the output.

---

VI. PASS INTERACTION MODEL

Pass 1 → independent structural analysis

Pass 2 → independent interpretive analysis

Pass 3 → reconciliation of Pass 1 and Pass 2 only

No pass may:

- call another pass dynamically

- modify upstream pass outputs

- re-evaluate raw manuscript text outside its scope

---

VII. PASS OUTPUT REQUIREMENTS

Each pass must:

1. Produce complete coverage of all criteria

2. Provide evidence-backed reasoning

3. Respect chunk boundaries

4. Maintain deterministic structure

5. Avoid hallucinated evidence

---

VIII. FAILURE CONDITIONS

A pass is invalid if:

- required criteria are missing

- evidence is absent or unverifiable

- cross-chunk reasoning is detected

- outputs contradict schema requirements

Invalid pass outputs MUST:

- be rejected

- trigger retry or failure

- not propagate downstream

---

IX. CONSEQUENCE OF THIS REDEFINITION

1. Pass 3 is no longer a global synthesis engine

2. Chunk evaluation becomes deterministic and scalable

3. Manuscript-level reasoning is relocated to:

- aggregation layer

- manuscript synthesis layer

- governance layer

---

X. ALIGNMENT WITH LARGE-MANUSCRIPT ARCHITECTURE

This pass model enables:

- bounded evaluation regardless of manuscript size

- parallel chunk processing

- scalable evaluation up to extreme word counts

- deterministic recomposition of results

---

This section establishes the authoritative definition of the Pass System.

All prior interpretations of Pass 3 as a global evaluator are deprecated.

SECTION III.5 — FINAL PIPELINE DIAGRAM + STATE MODEL

This section defines the canonical execution flow, state transitions, and orchestration model for the hierarchical Evaluation Pipeline.

This model is authoritative and governs all runtime implementations.

---

I. PIPELINE OVERVIEW

The Evaluation Pipeline is a staged, hierarchical system:

CHUNK LAYER

→ Pass 1 (Structural)

→ Pass 2 (Editorial)

→ Pass 3 (Local Synthesis)

AGGREGATION LAYER

→ Chapter / Section Aggregation

MANUSCRIPT LAYER

→ Manuscript Synthesis

GOVERNANCE LAYER

→ Deterministic Finality Decision

Each layer produces a persisted artifact.

Each layer depends strictly on validated outputs from the prior layer.

---

II. EXECUTION FLOW (LINEARIZED)

1. INGESTION

- receive manuscript

- compute word\_count

- validate against supported\_word\_count\_max

2. CHUNKING

- split manuscript into ordered chunks

- persist chunk boundaries

3. CHUNK EVALUATION (PARALLEL)

For each chunk:

3.1 Pass 1 (Structural)

3.2 Pass 2 (Editorial)

3.3 Pass 3 (Synthesis)

→ produce CHUNK SYNTHESIS ARTIFACT

4. CHUNK COMPLETION BARRIER

Condition:

- all chunks completed successfully

If NOT:

→ FAIL (fail-closed)

5. AGGREGATION

- group chunks by chapter/section

- compute pattern-level signals

- produce AGGREGATION ARTIFACTS

6. MANUSCRIPT SYNTHESIS

- combine aggregation artifacts

- derive global patterns

- compute manuscript-level scores

- produce MANUSCRIPT SYNTHESIS ARTIFACT

7. GOVERNANCE

- evaluate coverage

- evaluate evidence sufficiency

- apply deterministic rules

- decide:

- completed

- partial\_result

- failed

8. FINAL RESULT

- persist FINAL EVALUATION RESULT

- expose to API/UI

---

III. STATE MACHINE

Allowed job states:

- initialized

- chunking

- evaluating\_chunks

- aggregating

- synthesizing

- governing

- completed

- partial

- failed

---

STATE TRANSITIONS:

initialized → chunking

chunking → evaluating\_chunks

evaluating\_chunks → aggregating

(only if all chunks complete)

evaluating\_chunks → failed

(if any chunk fails)

aggregating → synthesizing

aggregating → failed

(if aggregation fails)

synthesizing → governing

synthesizing → failed

governing → completed

governing → partial

governing → failed

---

IV. PARALLELISM MODEL

Chunk evaluation MUST support parallel execution.

Rules:

1. Each chunk is independently evaluated.

2. No shared mutable state between chunk evaluations.

3. Results are persisted independently.

4. Aggregation waits on full completion barrier.

---

V. FAIL-CLOSED EXECUTION

The pipeline MUST fail closed.

Failure at any stage:

→ immediate halt

→ no downstream execution

→ no final result artifact

Partial outputs may exist internally but MUST NOT be exposed as final.

---

VI. COVERAGE ENFORCEMENT

Coverage is enforced at multiple levels:

Chunk:

- always full

Aggregation:

- computed from chunk completeness

Manuscript:

- computed from aggregation completeness

Governance:

- determines if coverage is sufficient for finality

---

VII. LARGE-MANUSCRIPT BEHAVIOR

For manuscripts exceeding supported\_word\_count\_max:

Options:

A. HARD LIMIT MODE

- reject input

B. PARTIAL MODE

- evaluate subset

- mark coverage\_mode = "partial"

- prohibit final completion

C. EXTENDED MODE (future)

- process full manuscript

- require distributed execution

The selected mode MUST be explicit.

---

VIII. ARTIFACT FLOW GUARANTEE

Each stage must:

1. Read only validated upstream artifacts

2. Produce exactly one downstream artifact (per unit)

3. Persist artifact before advancing

No stage may:

- bypass artifact persistence

- overwrite prior artifacts silently

---

IX. ORCHESTRATION CONTRACT

The orchestrator (runPipeline or equivalent) MUST:

- enforce state transitions

- enforce completion barriers

- enforce fail-closed behavior

- track progress deterministically

- emit pipeline\_events for every transition

---

X. OBSERVABILITY REQUIREMENTS

The system MUST expose:

- current\_state

- progress\_percent

- chunk\_completion\_status

- failure\_reason (if any)

- coverage\_percent

These must be available to:

- API consumers

- UI

- audit logs

---

XI. FUTURE EXTENSIBILITY

The architecture supports:

- distributed chunk processing

- multi-model evaluation per pass

- adaptive chunk sizing

- multi-language support

- streaming evaluation pipelines

These extensions must not violate core invariants.

---

XII. CANONICAL GUARANTEES

This pipeline guarantees:

1. Deterministic structure

2. Scalable evaluation

3. Explicit coverage truth

4. Strict governance enforcement

5. No silent failure or silent success

---

This state model and execution flow are canonical.

All implementations must conform without deviation.

SECTION III.6 — CHUNKING STRATEGY + TOKEN BUDGET CONTROL

This section defines the canonical chunking model and token budget constraints for the Evaluation Pipeline.

This is a critical control layer.

Improper chunking or prompt construction will cause:

- latency spikes

- model failure

- incomplete outputs

- hallucinated reasoning

- timeout errors (symptom, not cause)

---

I. CORE PRINCIPLE

Evaluation must be bounded.

No pass may exceed a controlled token window.

Chunking is not optional — it is the primary scaling mechanism.

---

II. CHUNK SIZE DEFINITION

Chunk size MUST be defined in characters, not tokens.

Canonical defaults:

- target\_chunk\_chars: 8,000 – 12,000 characters

- hard\_max\_chunk\_chars: 15,000 characters

Approximate token equivalent:

- ~2,000 – 3,500 tokens per chunk

---

III. CHUNK BOUNDARY RULES

Chunks MUST:

1. Be contiguous

2. Preserve ordering

3. Avoid mid-sentence splits where possible

4. Prefer paragraph boundaries

5. Maintain deterministic reconstruction

Each chunk MUST include:

- chunk\_index

- char\_start

- char\_end

---

IV. PROMPT BUDGET ALLOCATION

Each pass has a fixed token budget.

Example allocation:

Pass 1:

- system prompt: fixed

- manuscript chunk: full chunk

- max output tokens: bounded (e.g., 2000)

Pass 2:

- same as Pass 1

Pass 3 (CRITICAL):

Inputs:

- pass1Json (TRUNCATED)

- pass2Json (TRUNCATED)

- manuscript reference window (TRUNCATED)

Hard rule:

Pass 3 MUST NOT receive:

- full Pass 1 output

- full Pass 2 output

- full manuscript chunk simultaneously

---

V. PASS 3 INPUT COMPRESSION (MANDATORY)

Before calling Pass 3:

You MUST compress inputs.

Required transformations:

1. pass1Json → summary form

- keep:

- scores

- key rationale (shortened)

- critical evidence only

2. pass2Json → same compression

3. manuscriptText → reference window only

- max 2,000–4,000 chars

---

VI. PASS 3 TOKEN BUDGET LIMIT

Pass 3 total input MUST NOT exceed safe limits.

Recommended:

- input tokens ≤ 8,000

- output tokens ≤ 3,000

Violation results in:

- degraded model performance

- truncation

- timeout risk

---

VII. WHY PASS 3 FAILS (ROOT CAUSE)

If Pass 3 is timing out, the cause is:

- oversized prompt

- redundant JSON

- excessive evidence payload

- unbounded manuscript inclusion

NOT:

- insufficient timeout duration

Increasing timeout does NOT fix the problem.

---

VIII. CHUNK COUNT SCALING

Example:

160,000-word manuscript

≈ 800,000 characters

At 10,000 chars per chunk:

→ ~80 chunks

System must handle:

- 80 parallel chunk evaluations

- aggregation across 80 artifacts

- synthesis from aggregated structure

---

IX. AGGREGATION TOKEN CONTROL

Aggregation must NOT rehydrate all chunk JSON.

Instead:

- operate on summarized signals

- use statistical aggregation

- cluster recommendations

- avoid full-text recomposition

---

X. MANUSCRIPT SYNTHESIS TOKEN CONTROL

Manuscript synthesis must:

- consume aggregation artifacts (not raw chunks)

- operate on compressed signals

- limit input size

---

XI. ANTI-PATTERN (FORBIDDEN)

The following is explicitly forbidden:

- feeding entire manuscript into any single pass

- feeding full Pass 1 + Pass 2 outputs into Pass 3

- concatenating all chunk outputs into one prompt

- using model context as a substitute for architecture

These patterns WILL fail at scale.

---

XII. IMPLEMENTATION REQUIREMENTS

The system MUST implement:

- deterministic chunk generator

- prompt input window builder

- JSON compression layer for pass outputs

- token budget guards (pre-call validation)

---

XIII. TOKEN GUARD (MANDATORY)

Before any model call:

IF estimated\_tokens(input) > limit:

→ reject OR compress

→ log violation

No call may proceed without passing token guard.

---

XIV. FUTURE EXTENSIONS

The system may support:

- adaptive chunk sizing

- semantic chunking (scene-aware)

- sliding window evaluation

- multi-pass refinement loops

These must still obey token constraints.

---

XV. CANONICAL GUARANTEE

This system guarantees:

- bounded evaluation complexity

- scalability to large manuscripts

- consistent model performance

- elimination of timeout-as-design-failure

---

This section is mandatory for all pipeline implementations.

Violations will result in non-deterministic system behavior.
