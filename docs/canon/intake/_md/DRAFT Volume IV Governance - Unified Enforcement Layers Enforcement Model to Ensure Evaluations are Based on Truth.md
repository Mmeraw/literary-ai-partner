**DRAFT Volume IV Governance - Unified Enforcement Layers Enforcement Model to Ensure Evaluations are Based on Truth**

Mike you have to prove a few things prior to making this final

**1. Definition**

U = Unified Enforcement Layers

The U-Layer Model defines the ordered enforcement system that determines whether an evaluation artifact is considered valid system truth.

**2. Layer Structure**

U1 — Structural Enforcement Layer
U2 — Truth / Fidelity Enforcement Layer
U3 — Consistency / Coherence Enforcement Layer

Each layer governs a distinct failure class and is enforced independently.

**3. Execution Law**

Execution Order:
U1 → U2 → U3

No layer may be bypassed.
Downstream layers assume upstream enforcement is complete.

**4. Core Doctrine**

If it is not enforced at the U-layer level, it is not considered system truth.

Outputs, evaluations, and artifacts that are not enforced are treated as non-authoritative regardless of appearance or plausibility.

**5. RCA Binding (Canonical Authority)**

Each U-layer is defined exclusively by RCA\_IDs.

U1 — Structural Enforcement
- RCA-ATOMIC-PERSISTENCE-001
- RCA-BOUNDARY-SHAPE-001

U2 — Truth / Fidelity Enforcement
- RCA-U2-001
- RCA-U2-002
- RCA-U2-003
- RCA-U2-004
- RCA-U2-005
- RCA-U2-006

U3 — Consistency / Coherence Enforcement
- (RCA-U3-\* — to be defined)

No U-layer exists outside the RCA system.
No RCA\_ID exists outside a U-layer.

**6. Completion Rule**

A U-layer is considered **COMPLETE** only when:

- All associated RCA\_IDs are RESOLVED
- Live production proof exists
- Enforcement is observable in:
 - evaluation\_artifacts
 - evaluation\_jobs.progress.gate\_enforcement

Test coverage alone does not satisfy completion.

**7. Proof Requirement**

All enforcement claims must be supported by **live system evidence**.

Required proof artifacts:

- evaluation\_jobs row (status = complete)
- evaluation\_artifacts row (artifact\_schema = evaluation\_result\_v2)
- progress.gate\_enforcement populated

Required observable fields:

progress.gate\_enforcement.validation\_result
progress.gate\_enforcement.gate\_decision
progress.gate\_enforcement.reason\_codes
progress.gate\_enforcement.validated\_at

Absence of these fields invalidates enforcement claims.

**8. RCA Execution Contract**

Each RCA\_ID must define a strict execution contract.

**8.1 Inputs**

- manuscript\_id
- pipeline pass outputs (Pass 1–3)
- prior artifact state (if applicable)

**8.2 Outputs**

**Artifact-level**

- governance.\*
- criteria[\*].\*
- summary.\*

**DB-level**

- evaluation\_jobs.progress.gate\_enforcement

**8.3 Proof Scripts**

Each RCA must reference canonical proof scripts:

- scripts/e2e-golden-run.sh
- scripts/check-e2e-summary.mjs
- scripts/pipeline/run-phase2-7-real-run.ts
- SQL queries against evaluation\_jobs and evaluation\_artifacts

Scripts are not duplicated in canon; they are referenced as execution surfaces.

**8.4 Metrics**

Each RCA must define measurable input and output metrics.

**Example — RCA-U2-003 (Confidence Derivation)**

INPUT METRICS
- criteria\_with\_evidence\_count
- criteria\_without\_evidence\_count
- weak\_signal\_count

OUTPUT METRICS
- confidence\_label distribution
- confidence\_reason\_count
- score-confidence mismatch rate

**Example — RCA-U2-006 (Anchor Enforcement)**

INPUT METRICS
- criteria\_with\_textual\_anchor\_count
- criteria\_without\_anchor\_count

OUTPUT METRICS
- NO\_TEXTUAL\_ANCHOR\_rate
- false\_positive\_anchor\_rate
- downgrade\_trigger\_rate

**8.5 Thresholds**

Each RCA must define acceptance thresholds.

- false\_positive rates = 0
- enforcement triggers must match 100% of qualifying cases
- mismatch rates must be within defined bounds

Thresholds are required for promotion to RESOLVED.

**9. Promotion Criteria**

An RCA\_ID may be promoted from PARTIAL → RESOLVED only when:

- Code implementation exists on target branch
- Relevant tests pass
- Live evaluation job completes successfully
- Artifact fields are present and correct
- DB enforcement fields are populated
- Observed behavior matches defined metrics and thresholds

Failure of any condition requires status to remain PARTIAL.

**10. Layer Failure Semantics**

Failure at any U-layer results in:

- Fail-closed behavior
- No artifact persistence (if upstream)
- No UI authority (if downstream)

U-layer failures are not recoverable through interpretation, retries, or UI masking.

**11. Enforcement Visibility**

All enforcement must be externally observable.

- No hidden gates
- No implicit logic
- No undocumented transformations

Every enforcement decision must be traceable through:

artifact → governance fields
job → progress.gate\_enforcement
RCA → definition

**12. Prohibited Patterns**

The following are explicitly disallowed:

- Narrative RCA descriptions (5W explanations)
- Editing CSV mirrors directly
- Inferring enforcement without proof
- Declaring completion without live evidence
- Duplicating implementation logic in canon docs

**13. Relationship to Other Volumes**

Volume III (Tools & Implementation)
→ Defines how U-layers are implemented (code, prompts, schemas)

Volume V (Architecture)
→ Defines where U-layers execute in the system pipeline

Volume IV remains the **authority on enforcement truth**.

**14. System Invariant**

If it is not enforced, it is not real.

The U-Layer Model is the mechanism by which this invariant is upheld.

**Volume IV Addendum — U2 RCA Enforcement Mapping**

**U2 — Truth / Fidelity Enforcement Layer**

U2 governs whether an evaluation artifact is intellectually honest relative to its evidence, confidence, scores, synthesis, and UI authority.

U2 is complete only when all six U2 RCA rows are RESOLVED with live proof.

**RCA-U2-003 — Confidence Derivation**

**Purpose**
Confidence must be deterministically derived from evidence topology, not model-emitted authority language.

**Code Surfaces**

lib/evaluation/pipeline/runPipeline.ts
lib/evaluation/schemas/evaluation-result-v2.ts
lib/evaluation/pipeline/propagationIntegrity.ts

**Inputs**

criteria[\*].score
criteria[\*].evidence
criteria[\*].rationale
criteria[\*].reason\_codes

**Required Outputs**

artifact\_content.governance.confidence\_label
artifact\_content.governance.confidence\_reasons
artifact\_content.governance.propagation\_summary
evaluation\_jobs.progress.gate\_enforcement.confidence

**Input Metrics**

criteria\_with\_evidence\_count
criteria\_without\_evidence\_count
weak\_signal\_count
missing\_anchor\_count

**Output Metrics**

confidence\_label\_distribution
confidence\_reason\_count
score\_confidence\_mismatch\_rate

**Promotion Rule**

RESOLVED only if live artifact shows confidence\_label + confidence\_reasons
and those fields trace to criterion evidence topology.

**RCA-U2-006 — Evidence Anchor Enforcement**

**Purpose**
Scorable reasoning must contain concrete textual anchors or be downgraded/flagged.

**Code Surfaces**

lib/evaluation/pipeline/runPass2.ts
lib/evaluation/pipeline/prompts/pass2-editorial.ts
lib/evaluation/pipeline/qualityGate.ts
lib/evaluation/pipeline/\_\_tests\_\_/runPass2.anchor-enforcement.test.ts

**Inputs**

criteria[\*].rationale
criteria[\*].evidence
criteria[\*].textual\_anchor
criteria[\*].score

**Required Outputs**

criteria[\*].reason\_codes
criteria[\*].confidence
criteria[\*].evidence
evaluation\_jobs.progress.gate\_enforcement.reason\_codes

**Required Reason Code**

NO\_TEXTUAL\_ANCHOR

**Input Metrics**

criteria\_with\_textual\_anchor\_count
criteria\_without\_anchor\_count
scorable\_unanchored\_criteria\_count

**Output Metrics**

NO\_TEXTUAL\_ANCHOR\_rate
anchor\_false\_positive\_rate
confidence\_downgrade\_rate

**Promotion Rule**

RESOLVED only if missing-anchor cases are flagged or downgraded
and valid anchored rationale is not falsely penalized.

**RCA-U2-004 — Propagation Layer**

**Purpose**
Weak criterion-level evidence must affect artifact-level authority.

**Code Surfaces**

lib/evaluation/pipeline/runPipeline.ts
lib/evaluation/pipeline/qualityGate.ts
lib/evaluation/schemas/evaluation-result-v2.ts

**Inputs**

criteria[\*].confidence
criteria[\*].reason\_codes
criteria[\*].score
criteria[\*].evidence

**Required Outputs**

artifact\_content.governance.propagation\_summary
artifact\_content.governance.upstreamIntegrity
evaluation\_jobs.progress.propagation\_summary
evaluation\_jobs.progress.gate\_enforcement.confidence

**Input Metrics**

low\_confidence\_criteria\_count
missing\_evidence\_count
weak\_evidence\_count
high\_score\_low\_confidence\_count

**Output Metrics**

upstreamIntegrity\_distribution
propagation\_warning\_count
artifact\_authority\_cap\_rate

**Promotion Rule**

RESOLVED only if weak criterion signals aggregate into artifact-level authority
and are visible in governance/progress fields.

**RCA-U2-001 — Score / Confidence Mismatch**

**Purpose**
A score must not overclaim when confidence is low.

**Code Surface**

lib/evaluation/pipeline/qualityGate.ts

**Inputs**

criteria[\*].score
criteria[\*].confidence
criteria[\*].reason\_codes
artifact\_content.governance.confidence\_label
artifact\_content.governance.propagation\_summary

**Required Outputs**

evaluation\_jobs.progress.gate\_enforcement.reason\_codes
evaluation\_jobs.progress.gate\_enforcement.gate\_decision

**Required Gate Code**

QG\_FIDELITY\_SCORE\_CONFIDENCE\_MISMATCH

**Input Metrics**

high\_score\_low\_confidence\_count
high\_score\_missing\_evidence\_count

**Output Metrics**

score\_confidence\_mismatch\_rate
gate\_block\_rate
authority\_cap\_rate

**Promotion Rule**

RESOLVED only if score >= threshold + low confidence triggers
QG\_FIDELITY\_SCORE\_CONFIDENCE\_MISMATCH or equivalent fail/hold/cap behavior.

**RCA-U2-002 — Pass 3 Anti-Washing**

**Purpose**
Synthesis must not smooth over low-confidence, low-score, or weak-evidence criteria.

**Code Surfaces**

lib/evaluation/pipeline/runPass3Synthesis.ts
lib/evaluation/pipeline/qualityGate.ts

**Inputs**

criteria[\*].score
criteria[\*].confidence
criteria[\*].reason\_codes
criteria[\*].rationale
summary

**Required Outputs**

artifact\_content.summary
artifact\_content.governance.propagation\_summary
evaluation\_jobs.progress.gate\_enforcement.reason\_codes

**Required Gate Code**

QG\_SUMMARY\_OMITS\_WEAKNESS

**Input Metrics**

lowest\_score\_cluster
weakest\_confidence\_cluster
criteria\_with\_blocking\_reason\_codes\_count

**Output Metrics**

summary\_weakness\_reference\_rate
summary\_washing\_violation\_rate
QG\_SUMMARY\_OMITS\_WEAKNESS\_rate

**Promotion Rule**

RESOLVED only if summary references the weakest relevant cluster
or QG\_SUMMARY\_OMITS\_WEAKNESS fires.

**RCA-U2-005 — UI Authority Lock**

**Purpose**
The UI must not present high confidence unless backend governance proves it.

**Code Surfaces**

lib/evaluation/warningClassification.ts
components/report/\*
app/evaluate/[jobId]/page.tsx

**Inputs**

artifact\_content.governance.confidence\_label
artifact\_content.governance.propagation\_summary
evaluation\_jobs.progress.gate\_enforcement
artifact\_validation\_result

**Required Outputs**

UI warning classification
report confidence banner
report authority language

**Input Metrics**

low\_confidence\_artifact\_count
mixed\_integrity\_artifact\_count
gate\_warning\_count

**Output Metrics**

false\_high\_confidence\_banner\_count
ui\_authority\_suppression\_rate
warning\_banner\_accuracy\_rate

**Promotion Rule**

RESOLVED only if PASS + weak/mixed/low-confidence artifact cannot render
a high-confidence user-facing authority banner.

**U2 Dependency Order**

1. RCA-U2-003 — Confidence Derivation
2. RCA-U2-006 — Evidence Anchor Enforcement
3. RCA-U2-004 — Propagation Layer
4. RCA-U2-001 — Score / Confidence Mismatch
5. RCA-U2-002 — Pass 3 Anti-Washing
6. RCA-U2-005 — UI Authority Lock
7. PV115-GOLDEN-FIXTURE — Verification artifact, not RCA

**U2 Completion Rule**

U2 is ENFORCED only when:
- RCA-U2-001 through RCA-U2-006 are RESOLVED
- PV115-GOLDEN-FIXTURE passes
- progress.gate\_enforcement is populated on live proof jobs
- artifact governance fields match required RCA outputs
