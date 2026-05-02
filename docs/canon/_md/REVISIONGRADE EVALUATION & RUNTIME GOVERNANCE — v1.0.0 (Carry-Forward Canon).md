**REVISIONGRADE EVALUATION & RUNTIME GOVERNANCE — v1.0.0 (Carry-Forward Canon)**

**Status:** CANONICAL
**Applies to:** All evaluation, revision, and output pipelines
**Supersedes:** Base44 runtime assumptions
**Authority:** Product / Governance

**I. CORE PRINCIPLE**

The system must never produce, persist, or present evaluation or revision artifacts that are:

* structurally incomplete
* unverifiable
* silently degraded
* or lacking governance approval

All pipelines are **fail-closed by default**.

**II. CANONICAL PIPELINE AUTHORITY**

**2.1 Single Runtime Truth**

There is **one canonical evaluation pipeline**.

All entrypoints (API routes, workers, scripts, admin tools) MUST route through:

processEvaluationJob → processor → runPipeline → Pass 1–4 → governance → artifact

No alternate evaluation engines are permitted.

**2.2 Pass Structure (Required)**

All full evaluations MUST execute:

| **Pass** | **Function** |
| --- | --- |
| Pass 1 | Structural analysis |
| Pass 2 | Independent scoring |
| Pass 3 | Synthesis (pressure → decision → consequence) |
| Pass 4 | External adjudication (Perplexity) |

No pass may be skipped unless explicitly allowed by canon.

**III. MULTI-MODEL AUTHORITY CHAIN**

**3.1 Primary Evaluation Engine**

OpenAI is the **primary multi-pass evaluator**:

* Pass 1
* Pass 2
* Pass 3

Model selection MUST be:

* explicit
* centralized
* consistent across all pipeline invocations

No mixed model defaults across files.

**3.2 External Adjudication (Required)**

Perplexity Pass 4 is the **required adjudication gate** for:

* evaluation outputs
* revision outputs
* scoring artifacts

**3.3 Persistence Rule (CRITICAL)**

No artifact may be:

* persisted
* rendered
* returned to user

unless ALL are true:

1. OpenAI Pass 1–3 completed successfully
2. Perplexity Pass 4 executed successfully
3. Governance returned **approved**

**3.4 Failure Rule**

If any of the following occur:

* Pass 4 not executed
* Pass 4 invalid (missing evidence / criteria)
* governance = fail

→ **pipeline fails closed**

No output is returned.

**3.5 Authority Clarification**

Perplexity authority is:

* **platform-adjudicative** (validates system output)
* NOT **creative-authoritative** over the human writer

**3.6 Human Supremacy Rule**

The author retains full creative authority.

The system governs:

* what is emitted
* what is trusted
* what is stored

NOT what the author chooses to write.

**IV. PREFLIGHT GOVERNANCE (MANDATORY)**

**4.1 Preflight Before LLM**

No LLM call may occur unless:

preflight.status === "allowed"

**4.2 Preflight Responsibilities**

Preflight MUST validate:

* input size and completeness
* evaluation eligibility
* routing correctness
* criteria applicability (NA gating)
* safety constraints

**4.3 Preflight Failure**

If preflight fails:

* no model call occurs
* user receives structured refusal
* audit log records failure

**V. NO-SILENT-BEHAVIOR DOCTRINE**

**5.1 Prohibited**

The system MUST NOT:

* silently truncate input
* silently downgrade models
* silently skip passes
* silently drop criteria
* silently degrade outputs

**5.2 Required Visibility**

If any of the following occur:

* truncation
* partial coverage
* missing criteria
* degraded evaluation

→ system MUST:

* explicitly state it
* flag it in output
* log it in audit

**VI. COVERAGE & COMPLETENESS**

**6.1 Full Input Coverage**

The system MUST guarantee:

* full input processed
  OR
* explicit coverage declaration

**6.2 Partial Coverage Rule**

If partial:

* MUST include coverage metadata
* MUST cap confidence
* MAY fail closed depending on context

**VII. CONFIDENCE GOVERNANCE**

Confidence MUST be bounded by input scale:

| **Input** | **Max Confidence** |
| --- | --- |
| Paragraph | 40% |
| Scene | 65% |
| Chapter | 75% |
| Multi-chapter | 85% |
| Full manuscript | 95% |

Confidence inflation is prohibited.

**VIII. NA CRITERIA ENFORCEMENT**

**8.1 NA Blocking**

Criteria marked NA MUST NOT:

* appear in outputs
* generate recommendations
* influence scores

**8.2 Output Scrubbing**

System MUST remove:

* NA-derived language
* NA-driven WAVE signals
* invalid reasoning

**IX. PASS 3 SYNTHESIS REQUIREMENT**

**9.1 Mandatory Structure**

All synthesis MUST encode:

Pressure → Decision → Consequence

**9.2 Output Requirement**

Outputs MUST demonstrate:

* causal progression
* narrative consequence
* irreversible state shift

**X. AUDIT & TRACEABILITY**

**10.1 Required Audit Fields**

Every evaluation MUST log:

* event\_id
* request\_id
* timestamp
* pipeline version
* canon version
* model(s) used
* pass outputs
* governance result
* failure codes (if any)

**10.2 Provenance Integrity**

All scores MUST include:

* reasoning
* evidence
* traceable anchors

No orphan reasoning allowed.

**XI. FAIL-CLOSED EXECUTION MODEL**

**11.1 Default Behavior**

All failures → **block output**

**11.2 Examples**

System MUST fail closed if:

* OpenAI response invalid
* Pass missing
* Perplexity missing
* governance invalid
* schema mismatch
* token truncation undetected

**XII. ARCHITECTURAL DISCIPLINE**

**12.1 Single Entry Path**

All evaluation MUST pass through:

processor.ts → runPipeline.ts

**12.2 Legacy Quarantine**

Legacy systems:

* phase2Evaluation
* phase2Worker
* old scripts

MUST be:

* marked deprecated
* blocked from production use

**XIII. IMPLEMENTATION GUARANTEES**

**13.1 Tests Must Enforce Canon**

Tests MUST verify:

* no silent truncation
* pass execution completeness
* Pass 4 execution
* governance enforcement
* output schema integrity

**13.2 Invariants**

Violations MUST trigger:

* test failure
* pipeline block
* audit entry

**XIV. VERSIONING & GOVERNANCE**

**14.1 Canon Version Lock**

This canon MUST be:

* versioned
* referenced in runtime
* included in audit logs

**14.2 Change Protocol**

Changes require:

1. governance approval
2. version increment
3. migration plan
4. test updates

**FINAL SUMMARY**

This carry-forward canon does three critical things:

**1. Preserves the best of Base44**

* contract thinking
* preflight discipline
* audit rigor
* no-silent-behavior

**2. Fixes what was missing**

* single pipeline authority
* model consistency
* fail-closed enforcement

**3. Introduces what you actually need now**

* OpenAI + Perplexity authority chain
* Pass 4 requirement
* synthesis rigor
* coverage guarantees

**What this means for you (practically)**

When you now rewrite your code:

You are not “deciding how it should behave.”

You are **implementing this canon**.

Top of Form

Bottom of Form
