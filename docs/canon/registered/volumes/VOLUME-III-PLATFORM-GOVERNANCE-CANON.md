# VOLUME III — PLATFORM GOVERNANCE CANON

Status: CANONICAL — ACTIVE  
Version: 1.0 (MASTER)  
Authority: Mike Meraw  
Canon ID: VOL-III-PLATFORM-GOV-V10  
Last Updated: 2026-03-20

---

**VOLUME III**

**PLATFORM GOVERNANCE CANON**

**(MASTER v1.0)**

Version: VOL-III-1.0

**Status: LOCKED CANON**

Authority: Mike Meraw, Founder and CEO

Date: March 2026

*RevisionGrade*

*Manuscript Evaluation Intelligence*

**TABLE OF CONTENTS**

**HOW TO READ THIS DOCUMENT**

This document serves three distinct audiences with different needs:

**For Investors and Non-Technical Stakeholders**

**What you need to know:** RevisionGrade operates on mechanical, repeatable rules --- not subjective human judgment. This document shows you the exact decision logic that ensures consistent, scalable evaluation at 100,000+ users.

**Read these sections:**

-   Purpose & 5W+H Framework (Part A, Section 1)

-   System Constants (Part C, Section 5) --- the numbers that control everything

-   Workflow Routing Rules (Part C, Section 6) --- when tools unlock

-   Operational Flow Control (Part C, Section 8) --- the full user journey

**For Product Managers and Operations Staff**

**What you need to know:** How gates fire, when tools activate, what thresholds control access, and how to tune the system for optimal user experience.

**Read these sections:**

-   All of the above, plus:

-   Enforcement Consequences (Part C, Section 9) --- what happens when manuscripts fail

-   Operational Governance Hooks (Part C, Section 11) --- how governance works in practice

**For Engineers and Technical Leadership**

**What you need to know:** Every implementation detail, data contract, and architectural constraint required to build and maintain the system.

**Read:** Every section.

**PART A --- GOVERNANCE FOUNDATIONS (WHY + WHO + WHAT)**

**SECTION 1 --- WHY: PURPOSE AND DESIGN RATIONALE**

**Why RevisionGrade Exists**

RevisionGrade was built to solve a fundamental problem in manuscript evaluation: the absence of objective, repeatable, professional-grade assessment before writers submit to agents and publishers.

Traditional manuscript evaluation is inconsistent, expensive, and often unreliable. RevisionGrade provides diagnostic intelligence that helps writers understand whether their work is truly ready for professional review.

**Why These Governance Rules Matter**

The platform enforces strict operational discipline because:

-   **Author trust depends on transparency** --- every evaluation must be explainable and auditable

-   **Professional integrity requires restraint** --- the system must not ghostwrite, over-edit, or mask structural failure

-   **Scalability requires determinism** --- behavior must be consistent, testable, and repeatable across 100,000+ users

-   **Commercial viability requires governance** --- investors, partners, and acquirers need confidence that the system is controllable and defendable

**Core Design Philosophy**

RevisionGrade follows a harm-reduction editing philosophy:

**Do not improve what is already working.**

This principle prevents:

-   Over-editing and style erasure

-   AI hallucination edits

-   Mechanical rewriting without editorial justification

-   Generic polish that degrades authorial voice

**Operating Tenets**

**Key operating tenets:**

1.  Silence is allowed

2.  Style is not an error

3.  Voice preservation is mandatory

4.  Over-editing degrades authority

5.  Intervention requires detectable failure mode

This philosophy ensures RevisionGrade behaves like a disciplined professional editor, not a generative rewriter.

**SECTION 2 --- WHO: AUTHORITY AND RESPONSIBILITY**

**Governance Authority Chain**

RevisionGrade operates under a clear authority chain:

1.  **Product Canon** --- defines platform purpose and user outcomes

2.  **Governance Canon (this document)** --- defines non-negotiable operational rules

3.  **Operational Specifications** --- define implementation mechanics

4.  **Application Code** --- enforces governance constraints

5.  **Data Artifacts** --- provide auditability and traceability

**Change Control**

Only designated governance authorities can modify canonical rules. All changes require:

-   Proposal documentation (ChangeProposal schema)

-   Impact analysis

-   Backward compatibility assessment

-   Migration plan (if required)

-   Audit trail

**System Users**

**Authors**

-   Submit manuscripts for evaluation and receive diagnostic feedback

-   Must address structural failures before polish tools activate

**Literary Agents and Publishers**

-   Receive readiness signals and validated manuscripts

-   Receive only manuscripts that have cleared eligibility gates

**Internal Operations Staff**

-   Manage workflows, resolve escalations, and maintain system integrity

-   Enforce canon rules and cannot override governance constraints

**Accountability Model**

**Authors are responsible for their own writing.**

RevisionGrade provides diagnostic guidance but does not ghostwrite or fabricate strength.

**The system is responsible for:**

-   Accurate, consistent evaluation against canonical criteria

-   Transparent explanation of all scoring and feedback

-   Professional honesty about manuscript readiness

-   Preservation of authorial voice and intent

**Operations staff are responsible for:**

-   Enforcing eligibility gates

-   Maintaining audit trails

-   Escalating failures appropriately

-   Never overriding canon constraints

**SECTION 3 --- WHAT: GOVERNANCE DOCTRINES**

**Five Core Doctrines**

RevisionGrade enforces five non-negotiable doctrines:

**1. Platform Integrity Doctrine**

**System behavior must be deterministic, testable, and auditable.**

-   All evaluations produce consistent results for identical inputs

-   System behavior must be verifiable through automated tests

-   All decisions must be traceable through audit logs

**2. User Trust Doctrine**

**All scoring and feedback must be explainable to non-technical users.**

-   Every score must include plain-language justification

-   Visual readiness indicators must be clear and actionable

-   Pass/fail signals must be unambiguous

-   No \"black box\" decisions --- all reasoning must be surfaceable

**3. Separation of Concerns Doctrine**

**Evaluation logic, scoring logic, and presentation layers must remain decoupled.**

-   Evaluation engines must not depend on UI implementation

-   Scoring algorithms must be independent of data persistence

-   Presentation can change without affecting core evaluation logic

-   This enables testing, swapping providers, and independent evolution

**4. Eligibility Gate Doctrine**

**Structural evaluation must precede refinement workflows.**

-   Authors cannot access polish tools until structural criteria are met

-   Cosmetic refinement on broken structure is blocked

-   Gate clearance is explicit, traceable, and enforced

-   This prevents false readiness signals and professional rejection risk

**5. Artifact Persistence Doctrine**

**All evaluations generate durable records for audit and comparison.**

-   Every evaluation produces an immutable score artifact

-   Version history preserves revision lineage

-   Human and AI inputs are separately recorded

-   Score changes require justification logging

**System Mode Definition**

RevisionGrade operates in Diagnostic Mode, not Creative Mode.

**The system WILL:**

1.  Diagnose structural and craft issues

2.  Suggest corrections with explicit justification

3.  Preserve author voice and intent

4.  Flag detectable failure modes

**The system WILL NOT:**

1.  Ghostwrite content

2.  Replace author intent

3.  Polish structural failure

4.  Mask weak foundations

5.  Generate creative content on the author\'s behalf

**Professional Honesty Mandate:** If a manuscript is not ready, the system must say so clearly.

**Edit Definition**

**Every correction must include:**

1.  **Rule Triggered** --- which canon rule flagged the issue

2.  **Original Text** --- exact source wording

3.  **Revised Text** --- exact proposed change

4.  **Justification** --- why the change improves clarity or authority

**Enforcement Rule:** If any element is missing, the edit is blocked.

Why this matters:

-   Ensures author trust

-   Provides transparent revision logic

-   Enables professional auditability

-   Creates AI accountability

**PART B --- ENFORCEMENT ARCHITECTURE (HOW)**

**SECTION 4 --- HOW: EDITORIAL INTELLIGENCE AND ENFORCEMENT**

**Three-Layer Editorial Intelligence Model**

RevisionGrade uses a three-layer editorial intelligence model that separates what is detected, what it means, and what action is justified.

**Layer 1: Detection --- \"What is happening in the text?\"**

This layer scans for observable patterns:

1.  Repeated words

2.  Passive voice

3.  POV shifts

4.  Cliches

5.  Structural drift

6.  Pacing slowdowns

**This layer does not interpret quality. It only flags signals.**

*Think: Pattern recognition, not judgment.*

**Layer 2: Judgment --- \"Is this a problem?\"**

This layer evaluates whether the detected pattern is:

1.  Intentional craft

2.  Acceptable stylistic choice

3.  Weak execution

4.  Structural failure

**It answers: Is this signal harmful, neutral, or beneficial?**

  ----------------------------------- ---------------------------------------
  **Detection**                       **Judgment**

  Repetition detected                 May be rhetorical emphasis → Preserve

  Repetition detected                 May be lazy phrasing → Revise

  POV shift detected                  May be artistic → Preserve

  POV drift detected                  May confuse readers → Correct
  ----------------------------------- ---------------------------------------

*Think: Editorial reasoning, not automation.*

**Layer 3: Action --- \"What should be done?\"**

Only after judgment is complete does the system decide:

1.  **Preserve** --- leave unchanged

2.  **Refine** --- tighten or clarify

3.  **Replace** --- propose alternatives

**This ensures: No edit occurs without editorial justification.**

**Critical Rule: No edit without passing all three layers.**

This architecture prevents over-editing, style erasure, AI hallucination edits, and mechanical rewriting. It ensures RevisionGrade behaves like a disciplined professional editor, not a generative rewriter.

**Pattern Trigger Registry**

Each writing rule is encoded as a structured enforcement pattern:

1.  Trigger Pattern --- what signals the rule

2.  Detection Logic --- how the pattern is identified

3.  Severity Level --- low, medium, high, critical

4.  Action Path --- Preserve / Refine / Replace

**Example: POV Drift**

-   Rule: POV Drift

-   Trigger: Perspective shift within scene

-   Severity: High

-   Action: Correct perspective continuity

This transforms editorial standards into executable platform intelligence.

**Active WAVE Enforcement Modules**

Volume I defines WAVE writing standards. Volume III enforces them as operational system logic.

**Active WAVE Enforcement Modules:**

1.  **Body-Part Cliche Detection** --- flags overused sensory shortcuts that weaken originality

2.  **POV Integrity Enforcement** --- prevents unintentional perspective drift

3.  **Motif Echo Compression** --- removes repeated thematic restatements

4.  **Cadence Regulation** --- improves sentence rhythm and narrative flow

This turns writing doctrine into active quality-control systems.

**Editorial Non-Interference Doctrine**

**The system must NOT:**

1.  Edit writing that is already effective

2.  Replace voice with generic polish

3.  Remove intentional silence

4.  \"Improve\" stylistic identity

**Operating principles:**

-   Precision over volume of edits

-   Voice preservation is mandatory

-   Over-editing degrades authority

-   Professional writing relies on restraint

**PART C --- OPERATIONAL SPECIFICATION (WHEN + WHERE)**

**SECTION 5 --- SYSTEM CONSTANTS**

**Purpose**

**What constants are:** The numeric thresholds that mechanically control when tools activate, when gates block, and when manuscripts are ready for professional submission.

**Why they matter:** These numbers are not arbitrary. They represent the boundary between manuscripts that are ready for refinement and those that need structural repair first.

**Business impact:** Properly tuned constants prevent user frustration (gates too strict) and protect professional reputation (gates too loose).

**Eligibility Thresholds**

**Core thresholds that control workflow progression:**

  --------------------------------- ------------------- ----------- ---------------- ----------------------------------------------------------------------------------------------------------
  **Constant**                      **Typical Value**   **Range**   **Adjustable**   **Purpose**

  **ELIGIBILITY_MIN_SCORE**         60                  50-70       Yes              Minimum composite score required for any refinement tools. Below this, manuscript needs structural work.

  **STRUCTURAL_FAIL_THRESHOLD**     50                  40-60       Yes              Score below which structural failure is declared. User redirected to remediation guidance.

  **REFINEMENT_UNLOCK_THRESHOLD**   65                  60-75       Yes              Score required to unlock WAVE refinement tools. Ensures foundation is solid before polish.

  **AGENT_READY_THRESHOLD**         80                  75-85       Yes              Score required to unlock submission kit for agent query. Professional-grade benchmark.
  --------------------------------- ------------------- ----------- ---------------- ----------------------------------------------------------------------------------------------------------

**Detailed Threshold Explanations**

**ELIGIBILITY_MIN_SCORE (Default: 60)**

**What it controls:** The absolute minimum score a manuscript must achieve before any refinement tools are available.

**User experience:**

-   **Below threshold:** All refinement tools disabled. User sees: \"Your manuscript needs structural attention before refinement tools can help.\"

-   **At or above threshold:** Basic refinement tools unlock (depending on other thresholds).

**Why this number:** 60 represents \"fundamentally sound but needs work.\" Below 60 suggests structural issues that polish cannot fix.

**Tuning considerations:**

-   **Too low (\< 55):** Users waste time polishing broken manuscripts

-   **Too high (\> 65):** Users feel frustrated by tool lockout

-   **Recommended:** Start at 60, adjust based on user success rates

**STRUCTURAL_FAIL_THRESHOLD (Default: 50)**

**What it controls:** The score below which the system declares structural failure and redirects users to remediation resources.

**User experience:**

-   **Below threshold:** Red indicator: \"Structural failure detected. Address these issues before proceeding.\"

-   **At or above threshold:** User can continue, though refinement tools may still be locked.

**Why this number:** 50 represents \"major structural problems.\" Scores below 50 typically indicate:

-   Weak opening hooks

-   Poor pacing or structure

-   Inconsistent POV

-   Underdeveloped character arcs

**Tuning considerations:**

-   **Too low (\< 45):** Users bypass structural guidance when they need it most

-   **Too high (\> 55):** False positives increase, damaging user trust

-   **Recommended:** 50 is calibrated to match professional editorial judgment

**REFINEMENT_UNLOCK_THRESHOLD (Default: 65)**

**What it controls:** The score required to unlock WAVE refinement tools --- the polish-phase features that tighten prose, improve clarity, and enhance voice.

**User experience:**

-   **Below threshold:** WAVE tools remain locked. User sees: \"Reach 65+ to unlock refinement tools.\"

-   **At or above threshold:** \"Generate Alternates\" button activates, WAVE suggestions appear, interactive editing enabled.

**Why this number:** 65 represents \"solid foundation, ready for polish.\" At this level:

-   Structure is sound

-   Pacing works

-   Character arcs are clear

-   Prose needs tightening, not rebuilding

**Tuning considerations:**

-   **Too low (\< 60):** Users polish weak structure, masking problems instead of fixing them

-   **Too high (\> 70):** Users who could benefit from refinement are blocked

-   **Recommended:** 65 balances foundation strength with practical usability

**AGENT_READY_THRESHOLD (Default: 80)**

**What it controls:** The score required to unlock the submission kit --- query letter tools, professional export formats, and agent-ready packaging.

**User experience:**

-   **Below threshold:** Submission kit grayed out. User sees: \"Reach 80+ to unlock submission tools.\"

-   **At or above threshold:** \"Generate Submission Kit\" button unlocks, query letter template tools available, professional export formats enabled.

**Why this number:** 80 represents \"publication-quality material.\" At this level:

-   Manuscript is structurally excellent

-   Prose is tight and confident

-   Voice is clear and consistent

-   Material is ready for agent/publisher review

**Tuning considerations:**

-   **Too low (\< 75):** Users submit underdeveloped work, damaging their professional reputation

-   **Too high (\> 85):** Users miss submission opportunities due to unnecessarily high bar

-   **Recommended:** 80 aligns with professional editorial standards for agent submission

**Configuration and Tuning**

**Implementation note: These values should be:**

-   Configurable via environment variables (ELIGIBILITY_MIN_SCORE=60)

-   Adjustable via admin panel (for ops-led tuning)

-   Never hardcoded in application logic

**Operational tuning process:**

1.  Monitor gate fire rates and user progression rates

2.  Analyze manuscripts that cluster near thresholds

3.  Adjust thresholds in 5-point increments

4.  Observe user behavior and success rates for 2 weeks

5.  Stabilize or iterate

**Business intelligence: Track these metrics per threshold:**

-   **Block rate:** % of users blocked by each gate

-   **Progression rate:** % of users who clear each gate after remediation

-   **Submission success rate:** % of agent-ready manuscripts that receive agent interest

**SECTION 6 --- WORKFLOW ROUTING RULES**

**Purpose**

**What routing rules are:** The \"if-then\" logic that determines which tools and features are available to users based on their manuscript\'s evaluation score.

**Why they matter:** Routing rules enforce the \"structure before polish\" doctrine mechanically. Users cannot bypass structural work by skipping ahead to refinement.

**User impact:** Clear, predictable progression. Users understand exactly what they need to do to unlock the next set of tools.

**Structural Gate**

**Rule: Block all refinement tools when structural score is below threshold.**

**Decision logic:**

> if (composite_score \< STRUCTURAL_FAIL_THRESHOLD) {
>
> disable_all_refinement_tools();
>
> display_structural_remediation_guidance();
>
> block_eligibility_gate();
>
> route_to_structural_resources();
>
> }

**What happens:**

-   **UI behavior:** All refinement buttons disabled and grayed out

-   **User messaging:** \"Structural issues detected. Address foundation before polish.\"

-   **Routing:** User redirected to structural remediation resources (tutorials, guides, examples)

-   **Tool access:** No WAVE tools, no \"Generate Alternates,\" no submission kit

**Why this matters:** Prevents cosmetic polish on broken manuscripts. Ensures authors fix foundation first --- otherwise they waste time and receive professional rejection.

**Business rationale:** Protecting user success rates protects platform reputation. Authors who submit structurally weak work damage their careers and blame the platform.

**Operational note: Track structural failure rates by user cohort. High failure rates may indicate:**

-   Poor onboarding (users don\'t understand expectations)

-   Misaligned marketing (attracting unprepared authors)

-   Need for pre-evaluation guidance tools

**Refinement Enablement**

**Rule: Enable WAVE refinement tools when eligibility threshold is satisfied.**

**Decision logic:**

> if (composite_score \>= REFINEMENT_UNLOCK_THRESHOLD) {
>
> enable_wave_refinement_tools();
>
> surface_polish_suggestions();
>
> allow_interactive_editing();
>
> display_success_message();
>
> }

**What happens:**

-   **UI behavior:** WAVE tools become active, \"Generate Alternates\" button enabled

-   **User messaging:** \"Refinement tools unlocked. Your manuscript is ready for polish.\"

**Feature access: Users can now:**

-   Generate prose alternates for selected passages

-   Accept/reject WAVE suggestions

-   Request targeted refinements

-   View detailed style analysis

**Why this matters:** Users feel progress. After clearing the structural gate, they gain access to powerful polish tools that make immediate, visible improvements.

**Business rationale:** Unlocking tools at the right moment creates positive momentum. Users see the platform as a partner in their success, not a gatekeeper.

**Operational note: Monitor refinement tool usage rates. Low usage may indicate:**

-   Tools unlocked too late (threshold too high)

-   Tools not valuable enough (quality issue)

-   Onboarding doesn\'t explain tool benefits

**Submission Enablement**

**Rule: Enable agent submission kit generation when manuscript reaches agent-ready threshold.**

**Decision logic:**

> if (composite_score \>= AGENT_READY_THRESHOLD) {
>
> enable_submission_kit_generation();
>
> surface_query_letter_tools();
>
> allow_professional_export();
>
> display_celebration_message();
>
> }

**What happens:**

-   **UI behavior:** \"Generate Submission Kit\" button unlocks, celebration animation

-   **User messaging:** \"Congratulations! Your manuscript is agent-ready.\"

**Feature access: Users can now:**

-   Generate query letter templates

-   Export manuscript in professional formats (DOCX, PDF)

-   Download submission package

-   Access agent contact database (if integrated)

**Why this matters:** This is the culmination of the user journey. Unlocking submission tools is a clear signal: \"Your work is ready for professional consideration.\"

**Business rationale:** Agent-ready certification builds user confidence and platform credibility. Authors trust that RevisionGrade\'s standards align with professional expectations.

**Operational note: Track submission kit generation rates and agent response rates (if trackable). Low response rates may indicate:**

-   Threshold too low (certifying unprepared work)

-   Query letter templates need improvement

-   Market timing or genre mismatch issues

**SECTION 7 --- EVALUATION ARTIFACT SPINE**

**Purpose**

**What the artifact spine is:** The durable data structure that records every evaluation, every score, every revision, and every user decision. It is the source of truth for all system behavior.

**Why it matters:** Without durable artifacts, the system has no memory. Users cannot track progress, engineers cannot debug, and auditors cannot verify behavior.

**Business impact: Artifact spine enables:**

-   **User trust:** Full history of all evaluations and decisions

-   **Operational debugging:** Engineers can trace every system action

-   **Governance compliance:** Auditors can verify behavior matches policy

-   **Product intelligence:** Analytics on user progression and success

Every evaluation generates a JSON artifact that conforms to EvaluationResultV1 schema. Here is what it contains and why:

**Evaluation Identity**

**Purpose: Uniquely identifies this evaluation and links it to the user and manuscript.**

**Fields:**

-   **Evaluation ID** --- UUID (e.g., eval_a3f2c19b)

    -   Why: Enables audit trail lookup and parent-child linking

-   **Schema Version** --- Semantic version (e.g., v1.0)

    -   Why: Enables schema evolution and migration

-   **Timestamp** --- ISO-8601 format (e.g., 2026-03-09T14:30:00-07:00)

    -   Why: Proves evaluation chronology, supports dispute resolution

-   **User ID** --- Author who submitted (e.g., user_mike_meraw)

    -   Why: Links evaluation to account, enables user-level analytics

-   **Manuscript ID** --- Target of evaluation (e.g., ms_cartel_babies_v5)

    -   Why: Links evaluation to specific manuscript version

*Investor perspective: These identity fields prove RevisionGrade is enterprise-grade. Every action is traceable, auditable, and immutable.*

**Criteria Scores**

**Purpose: Records the AI\'s judgment on each canonical criterion and provides evidence for that judgment.**

**Fields:**

-   **Per-criterion scores** --- Numeric (0-100) for each criterion

    -   Example: { \"opening_hook\": 72, \"pacing\": 68, \"character_development\": 81 }

    -   Why: Granular diagnostic detail, not just one composite number

-   **Per-criterion evidence** --- Text excerpts (max 200 chars each)

    -   Example: \"Opening hook: \'The desert swallowed sound.\' Strong sensory anchor.\"

    -   Why: Justifies the score, teaches the user, enables dispute resolution

-   **Per-criterion recommendations** --- Specific guidance (max 300 chars each)

    -   Example: \"Consider tightening the second paragraph to maintain opening momentum.\"

    -   Why: Actionable next steps, not vague criticism

-   **Composite score** --- Weighted aggregate (0-100)

    -   Why: Single number for gate logic and user progress tracking

*Investor perspective: Granular scoring proves the system is diagnostic, not just \"AI says good/bad.\" Evidence + recommendations = defensible, explainable evaluation.*

**Metadata**

**Purpose: Records how the evaluation was performed and by what system.**

**Fields:**

-   **Engine metadata** --- Model used, provider, version

    -   Example: { \"model\": \"gpt-4-turbo\", \"provider\": \"OpenAI\", \"version\": \"2024-03\" }

    -   Why: Enables model comparison, debugging, and version-based filtering

-   **Traceability IDs** --- Pass 1, Pass 2, Pass 3 correlation

    -   Example: { \"pass1_id\": \"p1_a3f2\", \"pass2_id\": \"p2_b8d1\", \"pass3_id\": \"p3_c4e7\" }

    -   Why: Links multi-pass evaluations for convergence analysis

-   **Governance metadata** --- Mode (Trusted Path / Studio), canon compliance flags

    -   Example: { \"mode\": \"trusted_path\", \"canon_compliant\": true, \"overrides\": \[\] }

    -   Why: Proves governance was enforced, or documents authorized overrides

*Investor perspective: Traceability metadata proves RevisionGrade is production-grade. Every evaluation is reproducible, debuggable, and auditable.*

**Notes**

**Purpose: Captures human and AI observations that don\'t fit into structured scores.**

**Fields:**

-   **Human notes** --- User-entered annotations

    -   Example: \"I disagree with the pacing score --- this slow build is intentional.\"

    -   Why: Captures authorial intent, informs dispute resolution

-   **AI notes** --- System-generated observations

    -   Example: \"POV shift detected in Chapter 3 may confuse readers.\"

    -   Why: Surfaces patterns that don\'t map cleanly to single criteria

-   **Disputed items** --- Author challenges to suggestions

    -   Example: { \"criterion\": \"pacing\", \"reason\": \"Intentional slow build\", \"timestamp\": \"\...\" }

    -   Why: Tracks disagreements, informs model tuning, protects user trust

*Investor perspective: Notes prove the system respects authorial intent. RevisionGrade is a diagnostic partner, not an authoritarian rewriter.*

**Revision Lineage**

**Purpose: Tracks the full history of manuscript evolution.**

**Fields:**

-   **Parent evaluation ID** --- Link to previous evaluation

    -   Example: \"parent_eval_id\": \"eval_x7d2a91b\"

    -   Why: Enables before/after comparison, tracks improvement over time

-   **Revision chain** --- Full history of manuscript versions

    -   Example: \[\"eval_v1\", \"eval_v2\", \"eval_v3\", \"eval_v4\"\]

    -   Why: Shows user progress, proves iterative improvement

-   **Diff summary** --- Changes since last evaluation

    -   Example: { \"words_added\": 1200, \"paragraphs_revised\": 14, \"structural_changes\": 3 }

    -   Why: Quantifies revision effort, surfaces high-churn areas

*Investor perspective: Revision lineage proves RevisionGrade drives measurable improvement. Users don\'t just get scores --- they get better over time.*

**Schema Conformance**

**Non-negotiable rule: All evaluation artifacts MUST conform to EvaluationResultV1 schema.**

**What this means:**

-   Every field must be present (or explicitly null if optional)

-   Data types must match exactly (no strings where numbers expected)

-   Nested structures must follow schema hierarchy

-   Schema version must be declared in every artifact

**Enforcement:** Canon Gate (Pass 1.5) validates schema conformance before allowing evaluation to progress.

**Business impact: Schema conformance enables:**

-   **Reliable analytics** --- All data in predictable structure

-   **Safe migrations** --- Schema versioning enables evolution

-   **Third-party integrations** --- Partners can trust data contracts

**SECTION 8 --- OPERATIONAL FLOW CONTROL (Full User Journey)**

**Overview**

**What operational flow is:** The end-to-end sequence of states a manuscript moves through from initial upload to professional submission.

**Why it matters:** Clear flow control ensures users always know where they are, what happens next, and what they need to do to progress.

**Business impact:** Predictable flow = lower support costs, higher user confidence, faster time-to-submission.

**End-to-End Pipeline:**

Submit → Evaluate → Validate → Gate → Refine → Approve → Export

Each stage has specific triggers, actions, and outcomes. Below is the detailed breakdown.

**Stage 1: Submit**

**What happens: User uploads manuscript, system records version and queues evaluation job.**

**User actions:**

1.  User navigates to \"New Evaluation\" page

2.  Uploads manuscript file (DOCX, PDF, or TXT)

3.  Selects mode: Trusted Path (governance-enforced) or Studio Mode (exploratory)

4.  Confirms submission

**System actions:**

1.  Generate unique manuscript_id and job_id

2.  Store manuscript in object storage (S3 or equivalent)

3.  Queue evaluation job in job processing system

4.  Return confirmation + estimated completion time to user

**UI feedback:**

-   \"Manuscript uploaded successfully\"

-   \"Estimated evaluation time: 3-5 minutes\"

-   Progress indicator (spinner or percentage bar)

**Data recorded:**

-   Manuscript ID, user ID, timestamp

-   File size, word count, estimated read time

-   Mode selection (Trusted Path / Studio)

*Business note: Fast upload + clear time estimate = reduced user anxiety.*

**Stage 2: Evaluate**

**What happens: Multi-pass AI evaluation against canonical criteria.**

**Pass 1: Primary Evaluator**

-   AI evaluator scores manuscript against all canonical criteria

-   Generates per-criterion scores, evidence excerpts, recommendations

-   Produces EvaluationResultV1 JSON artifact

-   Writes result to database

**Pass 1.5: Canon Gate Validation**

-   System validates evaluation artifact against schema

-   Checks score ranges, required fields, traceability IDs

-   Classifies result: PASS, SOFT_FAIL, or HARD_FAIL

-   Blocks progression on HARD_FAIL, flags SOFT_FAIL for review

Halt conditions: persistent schema violations, provider API failure, token budget exceeded, timeout (\>60 seconds).

Soft fail → proceed but mark for spot-check audit

After 3 failures → escalate to human review queue

Hard fail → retry up to 3 times with adjusted prompt

Retry logic:

Soft Fail --- recommendations too brief (\<50 chars), evidence excerpts missing, low confidence (\<0.5), incomplete justifications → warning logged, evaluation proceeds with flag, human review recommended

Hard Fail --- schema validation fails, required fields missing, invalid data types, score out of range (not 0--100), missing traceability IDs → evaluation blocked, error logged, retry with corrected prompt

Failure classification:

Canon Gate does NOT check: editorial quality, scoring accuracy, or recommendation appropriateness (those are judgment-layer concerns).

Schema conformity --- data types, ranges, and formats valid

Canon rule adherence --- all required criteria scored, no missing fields

Structural compliance --- evaluation output conforms to EvaluationResultV1 schema

Canon Gate validation scope:

**Pass 2: Independent Verification (if multi-AI enabled)**

-   Second AI evaluator scores independently (no access to Pass 1 results)

-   Generates second evaluation artifact

-   System compares Pass 1 and Pass 2 for consistency

**Pass 3: Convergence Authority (if multi-AI enabled)**

-   Third AI reviews both Pass 1 and Pass 2 results

-   Resolves disagreements using convergence strategy (majority vote, weighted merge, consensus)

-   Produces final canonical evaluation result

**Duration: Typically 2-5 minutes end-to-end.**

**User experience during evaluation:**

-   Progress indicator: \"Evaluating\... Pass 1 complete. Validating\...\"

-   No interaction required --- user can close browser and return later

*Business note: Multi-pass evaluation proves RevisionGrade is rigorous, not arbitrary.*

**Stage 3: Validate**

**What happens: Canon Gate performs final validation before surfacing results to user.**

**Validation checklist:**

-   Schema conformity (all required fields present, correct data types)

-   Score integrity (all scores 0-100, no outliers)

-   Traceability IDs present and unique

-   Evidence excerpts present for each criterion

-   Recommendations present where score below threshold

**Validation outcomes:**

-   **PASS:** Evaluation cleared for user display

-   **SOFT_FAIL:** Evaluation proceeds with warning flags

-   **HARD_FAIL:** Evaluation blocked, error logged, retry triggered

**Retry logic:**

-   Hard fail → retry up to 3 times with adjusted prompt

-   After 3 failures → escalate to human ops review queue

-   User notified: \"Evaluation encountered an issue. Support team notified.\"

*Business note: Validation guarantees users never see malformed or incomplete results.*

**Stage 4: Gate**

**What happens: Eligibility Gate applies threshold logic and determines tool access.**

**Gate logic:**

> if (composite_score \< STRUCTURAL_FAIL_THRESHOLD) {
>
> result = \"STRUCTURAL_FAILURE\";
>
> disable_all_tools();
>
> route_to_remediation();
>
> }
>
> else if (composite_score \< REFINEMENT_UNLOCK_THRESHOLD) {
>
> result = \"NEEDS_IMPROVEMENT\";
>
> disable_refinement_tools();
>
> allow_basic_review();
>
> }
>
> else if (composite_score \< AGENT_READY_THRESHOLD) {
>
> result = \"REFINEMENT_READY\";
>
> enable_wave_tools();
>
> disable_submission_kit();
>
> }
>
> else {
>
> result = \"AGENT_READY\";
>
> enable_all_tools();
>
> celebration_mode();
>
> }

**UI indicators:**

-   **Red:** \"Structural failure detected\"

-   **Yellow:** \"Needs improvement\"

-   **Green:** \"Ready for refinement\"

-   **Blue:** \"Agent-ready\"

**Routing:**

-   Structural failure → remediation resources

-   Needs improvement → diagnostic review + guidance

-   Refinement ready → WAVE tools unlocked

-   Agent ready → submission kit unlocked

*Business note: Clear visual indicators + routing prevent user confusion.*

**Stage 5: Refine**

**What happens: User interacts with WAVE refinement tools, accepts/rejects suggestions.**

**User actions:**

1.  Review WAVE suggestions (prose alternates, clarity improvements, voice tightening)

2.  Select passages for refinement

3.  Generate alternates for selected text

4.  Accept/reject suggestions

5.  Annotate disputed items

**System actions:**

1.  Log every accept/reject decision with timestamp

2.  Update manuscript version on accept

3.  Store original version in revision history

4.  Update composite score after revisions (if re-evaluation triggered)

**UI workflow:**

-   Split-pane view: original on left, suggestion on right

-   \"Accept\" / \"Reject\" / \"Dispute\" buttons

-   \"Why this change?\" explanation for each suggestion

-   \"Undo\" option for recent accepts

**Data recorded:**

-   Every suggestion shown to user

-   User decision (accept/reject/dispute)

-   Justification text (if dispute)

-   Time spent reviewing each suggestion

*Business note: Accept/reject logging proves RevisionGrade respects authorial control.*

**Stage 6: Approve**

**What happens: Author marks manuscript as \"ready for submission.\"**

**User actions:**

1.  Review final evaluation results

2.  Optionally request final re-evaluation

3.  Confirm: \"I\'m ready to submit this manuscript\"

4.  Select submission targets (agents, publishers, contests)

**System actions:**

1.  Final evaluation run (if requested)

2.  Lock manuscript version as \"submission-ready\"

3.  Generate submission kit:

    -   Professional export formats (DOCX, PDF)

    -   Query letter template

    -   Synopsis template

    -   Submission checklist

4.  Finalize audit trail

**UI feedback:**

-   \"Submission kit ready\"

-   Downloadable package with all materials

-   Link to agent contact database (if integrated)

*Business note: Submission kit generation is the platform\'s value delivery moment.*

**Stage 7: Export**

**What happens: User downloads professional export formats and submission materials.**

**Export options:**

-   **Manuscript:** DOCX (industry standard), PDF (print-ready)

-   **Query letter:** DOCX template with populated fields

-   **Synopsis:** 1-page and 3-page versions

-   **Cover letter:** Template for specific agents/publishers

**Submission package contents:**

1.  Polished manuscript (final revision-locked version)

2.  Query letter with personalization fields

3.  Synopsis (short and long)

4.  Author bio template

5.  Submission checklist

**Metadata embedded in exports:**

-   Evaluation ID (for audit trail)

-   Composite score (for reference)

-   Export timestamp (proves version)

*Business note: Professional export formats prove RevisionGrade is publication-focused, not just a diagnostic tool.*

**Pipeline Summary Table**

  -------------- -------------- -------------------------------- -------------------------------- -----------------------
  **Stage**      **Duration**   **User Involvement**             **Key System Actions**           **Outcome**

  **Submit**     30 sec         High (upload + mode selection)   Store file, queue job            Job queued

  **Evaluate**   2-5 min        None (background processing)     Multi-pass AI evaluation         Evaluation complete

  **Validate**   5-10 sec       None (automatic)                 Canon Gate schema check          PASS/FAIL verdict

  **Gate**       Instant        View results                     Apply threshold logic            Tools unlocked/locked

  **Refine**     30-120 min     High (review + accept/reject)    Log decisions, update versions   Manuscript improved

  **Approve**    5-10 min       Medium (confirm + download)      Lock version, generate kit       Submission-ready

  **Export**     1-2 min        Low (download)                   Generate professional formats    Materials delivered
  -------------- -------------- -------------------------------- -------------------------------- -----------------------

**SECTION 9 --- ENFORCEMENT CONSEQUENCES**

**Hard Fail --- Structural Failure Block**

**Definition: Structural failure that blocks all refinement tools until core issues are resolved.**

**Triggers:**

-   Composite score \< STRUCTURAL_FAIL_THRESHOLD (default: 50)

-   Critical criterion fails validation (e.g., opening hook \< 40, pacing \< 45)

-   Schema violation detected (evaluation artifact malformed)

-   Canon Gate hard fail (data integrity issue)

**What happens:**

1.  Structural block activated --- No refinement tools available

2.  All polish tools disabled --- WAVE, Generate Alternates, submission kit all grayed out

3.  User redirected to remediation guidance --- Tutorials, examples, structural worksheets

4.  Evaluation results surfaced --- Detailed breakdown of what failed and why

**User experience:**

-   **Red indicator:** \"Structural failure detected\"

-   **Blocked UI:** Clear explanation of what needs fixing

-   **Guidance links:** \"Address these issues before proceeding\"

-   **No workarounds:** Cannot bypass block without improving score

**Messaging examples:**

-   \"Your manuscript\'s opening hook needs strengthening before refinement tools can help.\"

-   \"Pacing issues detected. Fix structural flow before polishing prose.\"

-   \"Character development is underdeveloped. Build stronger arcs before refinement.\"

**Why this is necessary:**

-   Prevents users from polishing broken structure (wasted effort)

-   Protects users from professional rejection (weak submissions damage careers)

-   Maintains platform credibility (RevisionGrade certified = professional quality)

**Operational monitoring:**

-   Track hard fail rates by user cohort

-   Identify common failure patterns

-   Develop targeted remediation content for high-frequency issues

-   Monitor progression rates (what % of users clear hard fails after remediation)

*Business impact: Hard fails may feel harsh, but they protect user success. Better to block unprepared work than certify material that will be rejected.*

**Soft Fail --- Warning-Level Issues**

**Definition: Warning-level issues that do not block workflow progression but flag areas needing attention.**

**Triggers:**

-   Score just above structural threshold but below refinement threshold (e.g., 55-64)

-   Minor canon violations (e.g., occasional POV slip, isolated pacing dip)

-   Low confidence scores (AI uncertainty about judgment)

-   Incomplete recommendations (evidence present but guidance thin)

**What happens:**

1.  Guidance issued --- Specific improvement suggestions surfaced

2.  Refinement permitted --- User can proceed with caution

3.  Warning indicators displayed --- Yellow banners with actionable next steps

4.  Audit log flagged --- Soft fail recorded for potential human review

**User experience:**

-   **Yellow indicator:** \"Improvement recommended\"

-   **Access to refinement tools preserved** --- User not blocked

-   **Warning banners:** \"These areas need attention\"

-   **Optional \"Review Warnings\" panel** --- Detailed breakdown of issues

**Messaging examples:**

-   \"Your manuscript is eligible for refinement, but addressing these pacing concerns will strengthen it further.\"

-   \"Minor POV inconsistencies detected. Review Chapter 7 for perspective stability.\"

-   \"Consider tightening the middle section before submitting to agents.\"

**Why soft fails are valuable:**

-   Provide guidance without blocking progress

-   Build user awareness of craft issues

-   Create improvement opportunities without gatekeeping

-   Maintain platform credibility (not everything is binary pass/fail)

**Operational monitoring:**

-   Track soft fail rates and resolution rates

-   Identify which warnings users act on vs ignore

-   Measure correlation between soft fail resolution and agent response rates

-   Tune warning thresholds to balance helpfulness with noise

*Business impact: Soft fails demonstrate RevisionGrade is a diagnostic partner, not a harsh gatekeeper. Users appreciate honest feedback that doesn\'t block them.*

**Enforcement Philosophy**

**Core principle: Honest feedback serves users better than false confidence.**

**Why RevisionGrade blocks weak work:**

-   Protecting user careers from premature submission

-   Maintaining platform credibility (agent-ready certification must mean something)

-   Teaching craft through enforced sequencing (structure before polish)

**Why RevisionGrade allows soft fails to progress:**

-   Not every issue is critical

-   Authors deserve control over their risk tolerance

-   Learning happens through iteration, not perfection

**Balancing act:**

-   **Too strict:** Users abandon platform in frustration

-   **Too loose:** Platform loses credibility, users submit unprepared work

**Operational tuning:** Monitor block rates, progression rates, and user satisfaction scores to find optimal balance.

**SECTION 10 --- ENGINEERING ARCHITECTURE PRINCIPLES**

**Stateless Evaluation Services**

**Principle:** Evaluation services must not retain state between requests.

**What this means:**

-   Every evaluation request contains all necessary inputs (manuscript text, criteria, mode, user ID)

-   Services do not store session state in memory

-   Results are written to database immediately upon completion

-   Services can be terminated and restarted without losing work

**Why this matters:**

-   **Horizontal scaling:** Add more evaluation workers instantly to handle load spikes

-   **Retry safety:** Failed evaluations can be retried without side effects

-   **Crash recovery:** Service crashes do not corrupt ongoing evaluations

-   **Cost efficiency:** Stateless services can be run on cheap, interruptible compute

**Implementation requirements:**

-   All evaluation inputs passed explicitly in request payload

-   No server-side session state (no in-memory job queues)

-   Results stored in database before response returned

-   Idempotent evaluation endpoints (retrying same request produces same result)

**Anti-patterns to avoid:**

-   Storing partial evaluation results in service memory

-   Using in-memory job queues that disappear on restart

-   Assuming service instances persist across requests

*Investor perspective: Stateless architecture proves RevisionGrade can scale cost-efficiently. Compute costs scale linearly with usage, not exponentially.*

**Versioned Scoring Models**

**Principle:** All scoring models must be versioned and traceable.

**What this means:**

-   Every evaluation artifact includes schema_version field (e.g., \"v1.0\")

-   Every evaluation artifact includes model_version field (e.g., \"gpt-4-turbo-2024-03\")

-   Model changes trigger version increments

-   Historical evaluations remain valid even as models evolve

**Why this matters:**

-   **Reproducibility:** Engineers can debug by re-running old model versions

-   **Model comparison:** A/B test new models against old ones with real data

-   **Migration safety:** Gradual rollout of new models without breaking old evaluations

-   **Compliance:** Auditors can verify which model version produced which result

**Implementation requirements:**

-   Schema version embedded in every EvaluationResultV1 artifact

-   Model version recorded in engine_metadata field

-   Migration paths documented for schema upgrades

-   Backward compatibility maintained for at least 2 schema versions

**Versioning strategy:**

-   **Major version (v1 → v2):** Breaking schema changes (e.g., removing fields)

-   **Minor version (v1.0 → v1.1):** Additive changes (e.g., new optional fields)

-   **Patch version (v1.0.0 → v1.0.1):** Bug fixes, no schema changes

**Anti-patterns to avoid:**

-   Silent model upgrades without version tracking

-   Schema changes without migration scripts

-   Losing ability to reproduce old evaluation results

*Investor perspective: Versioned models prove RevisionGrade is production-grade. System evolves without breaking existing functionality.*

**Immutable Audit Records**

**Principle:** Once written, audit records cannot be modified or deleted.

**What this means:**

-   Audit log is append-only (no UPDATE or DELETE operations)

-   Every system action is logged: evaluation start, evaluation complete, gate fired, tool unlocked, user decision

-   Logs include: timestamp, actor (user or system), action, outcome, context

-   Logs are stored separately from application database (isolated, tamper-resistant)

**Why this matters:**

-   **Trust:** Users and auditors can verify system behavior after the fact

-   **Compliance:** Meets regulatory requirements for financial/legal industries

-   **Forensics:** Engineers can diagnose production issues by replaying event logs

-   **Governance:** Proves governance rules were enforced (or documents overrides)

**Implementation requirements:**

-   Append-only audit log table (no primary key updates, no deletes)

-   Cryptographic hashing for tamper detection (each log entry includes hash of previous entry)

-   Separate audit storage from application database (different schema, possibly different database)

-   Retention policy: minimum 7 years (industry standard for audit logs)

**Audit log schema example:**

> {
>
> \"audit_id\": \"audit_x7d2a91b\",
>
> \"timestamp\": \"2026-03-09T14:30:00Z\",
>
> \"actor\": \"user_mike_meraw\",
>
> \"action\": \"evaluation_complete\",
>
> \"outcome\": \"PASS\",
>
> \"context\": {
>
> \"evaluation_id\": \"eval_a3f2c19b\",
>
> \"composite_score\": 78,
>
> \"gate_result\": \"REFINEMENT_READY\"
>
> },
>
> \"previous_hash\": \"sha256:abc123\...\",
>
> \"current_hash\": \"sha256:def456\...\"
>
> }

**Anti-patterns to avoid:**

-   Storing audit logs in same database as application data (vulnerability to mass deletion)

-   Allowing UPDATE or DELETE on audit log entries (defeats purpose)

-   Logging too little (missing critical decision points)

*Investor perspective: Immutable audit logs prove RevisionGrade is enterprise-ready. System behavior is fully traceable and tamper-resistant.*

**API-First Architecture**

**Principle:** All system functionality exposed via well-defined APIs.

**What this means:**

-   Every workflow (submit, evaluate, refine, export) has a corresponding REST endpoint

-   UI components call APIs; they do not embed business logic

-   APIs use JSON schema validation on all inputs

-   APIs return standardized error responses (HTTP status codes + error payloads)

-   APIs are versioned (v1, v2) with documented deprecation policy

**Why this matters:**

-   **Testability:** APIs can be tested independently of UI

-   **Modularity:** Swap out UI frameworks without touching business logic

-   **Integrations:** Third-party tools can integrate via public APIs

-   **Mobile apps:** Future mobile app can use same APIs as web UI

**Implementation requirements:**

-   REST endpoints for all workflows (POST /api/v1/evaluations, GET /api/v1/evaluations/:id)

-   JSON schema validation on all inputs (reject malformed requests immediately)

Standardized error responses:

> {
>
> \"error\": \"VALIDATION_FAILED\",
>
> \"message\": \"Manuscript file missing\",
>
> \"details\": { \"field\": \"manuscript_file\", \"issue\": \"required\" }
>
> }

-   API versioning with clear deprecation timeline (e.g., v1 deprecated 6 months after v2 launch)

**API design principles:**

-   **Idempotency:** Retrying same request produces same result (safe to retry on network failure)

-   **Pagination:** Large result sets paginated (default 100 items per page)

-   **Rate limiting:** Prevent abuse (e.g., 1000 requests per hour per user)

-   **Authentication:** All endpoints require valid API key or session token

**Anti-patterns to avoid:**

-   Embedding business logic in UI components

-   Different behavior for API vs UI paths

-   Breaking API changes without versioning

-   Inconsistent error responses

*Investor perspective: API-first architecture proves RevisionGrade is platform-ready. Future integrations, mobile apps, and partnerships are all feasible.*

**SECTION 11 --- OPERATIONAL GOVERNANCE HOOKS**

**Canon Gate Integration**

**Hook point:** Between Pass 1 and Pass 2 in evaluation pipeline.

**Purpose:** Enforces governance constraints mechanically before results reach users.

**How it works:**

1.  Pass 1 evaluation completes, produces EvaluationResultV1 artifact

2.  Artifact piped to Canon Gate validator service

3.  Canon Gate checks:

    -   Schema conformity (all required fields present, correct types)

    -   Score integrity (0-100 range, no outliers)

    -   Evidence completeness (excerpts present for each criterion)

    -   Traceability IDs (unique, properly formatted)

4.  Canon Gate classifies result: PASS, SOFT_FAIL, or HARD_FAIL

5.  Classification determines routing:

-   **PASS:** Progress to Pass 2 or surface to user

-   **SOFT_FAIL:** Flag for human review, allow progression

-   **HARD_FAIL:** Block progression, retry evaluation, escalate if persistent

**Configuration:**

-   Canon Gate rules defined in /lib/canon/gate-rules.json

-   Validation scripts in /lib/canon/validators/

-   Invoked via canon-guard.sh wrapper script

**Operational monitoring:**

-   Track Canon Gate pass/fail rates

-   Alert on high HARD_FAIL rates (indicates model quality issue)

-   Review SOFT_FAIL samples periodically (tune warning thresholds)

*Business note: Canon Gate is the mechanical implementation of \"governance is enforced, not optional.\"*

**Trusted Path Enforcement**

**Hook point:** At workflow entry (manuscript submission).

**Purpose:** Applies governance rules for publication-grade artifacts while allowing exploratory work in Studio Mode.

**How it works:**

1.  User uploads manuscript, selects mode: Trusted Path or Studio Mode

2.  Mode flag stored in job metadata: { \"mode\": \"trusted_path\" } or { \"mode\": \"studio_mode\" }

3.  Mode determines governance behavior throughout workflow

**Trusted Path mode:**

-   Canon locks enabled (cannot bypass eligibility gates)

-   Audit trail required (all decisions logged)

-   Overrides disabled (no admin shortcuts)

-   Results marked as \"governance-enforced\"

**Studio Mode:**

-   Canon locks relaxed (can override gates for testing)

-   Audit trail optional (exploratory work not logged)

-   Overrides allowed (admin can bypass gates)

-   Results marked as \"draft\" (not publication-ready)

**Mode switching:**

-   User must explicitly confirm mode switch

-   Switching from Trusted Path → Studio = \"Convert to draft?\"

-   Switching from Studio → Trusted Path = \"Lock governance and start fresh evaluation?\"

**UI indicators:**

-   **Trusted Path:** Blue banner \"Governance Enforced\"

-   **Studio Mode:** Orange banner \"Draft Mode --- Governance Relaxed\"

*Business note: Mode selection gives users flexibility without compromising governance for publication-grade work.*

**Studio Mode Overrides**

**Hook point:** Throughout refinement workflow.

**Purpose:** Allows flexible exploration and testing without governance constraints blocking experimentation.

**What can be overridden in Studio Mode:**

-   Eligibility gates: Admin can unlock refinement tools even if score below threshold

-   Canon locks: Admin can disable WAVE rule enforcement temporarily

-   Audit logging: Exploratory actions not logged (reduces noise)

-   Score thresholds: Admin can test different threshold values

**What CANNOT be overridden (even in Studio Mode):**

-   Schema conformity (evaluation artifacts must still be valid JSON)

-   Data persistence (results still stored, even if marked \"draft\")

-   Traceability IDs (all evaluations still uniquely identified)

**Override logging:**

-   Every override logged with: timestamp, admin user, reason, affected evaluation

-   Overrides visible in ops dashboard (for audit and QA)

-   High override rates flag for governance review

**Access control:**

-   Only admin users can enable Studio Mode overrides

-   Role-based permissions prevent abuse

-   Override actions require justification text

*Business note: Studio Mode enables learning, testing, and experimentation without corrupting production governance.*

**SECTION 12 --- DATA HANDLING RULES**

**Persistence Requirements**

**What must be stored:**

-   Every evaluation result (EvaluationResultV1 artifact)

-   All job state transitions (queued → running → complete → failed)

-   User accept/reject decisions for WAVE suggestions

-   Disputed item logs (author challenges to AI recommendations)

-   Revision lineage chains (parent-child links between manuscript versions)

**Storage format:**

-   JSON conforming to canonical schemas

-   Immutable once written (append-only, no updates)

-   Indexed by key fields: evaluation_id, user_id, manuscript_id, timestamp

**Retention policy:**

-   Active evaluations: Indefinite (as long as user account active)

-   Historical evaluations: Minimum 3 years

-   Audit logs: Minimum 7 years (industry standard)

**Database structure:**

-   **Primary database:** PostgreSQL for transactional data (evaluations, jobs, users)

-   **Audit log database:** Separate PostgreSQL instance or append-only log store

-   **Object storage:** S3 or equivalent for manuscript files and exports

*Business note: Comprehensive persistence enables user trust, operational debugging, and compliance.*

**Verification Requirements**

**What must be verified:**

-   **Schema conformance:** Every artifact validated against JSON schema before storage

-   **Score range validity:** All scores 0-100, no outliers

-   **Required field presence:** No null values where required

-   **Traceability ID uniqueness:** No duplicate evaluation IDs

-   **Timestamp chronological consistency:** Timestamps make sense (no future dates, proper ordering)

**Verification timing:**

-   **Pre-storage:** Canon Gate validation before writing to database

-   **Post-storage:** Periodic audit sweeps (nightly job checks all stored artifacts)

-   **On-demand:** Admin verification tools for spot-checking specific evaluations

**What happens on verification failure:**

-   **Pre-storage failure:** Evaluation blocked, error logged, retry triggered

-   **Post-storage failure:** Audit alert triggered, ops team notified, manual review required

*Business note: Verification prevents corrupt data from entering system and enables confident data analysis.*

**Traceability**

**What must be traceable:**

-   Every evaluation to its source manuscript (manuscript_id link)

-   Every revision to its parent evaluation (parent_eval_id link)

-   Every score change to its justification (notes field)

-   Every job to its initiating user (user_id link)

**Implementation:**

-   **Correlation IDs throughout pipeline:** Every request tagged with trace_id, propagated through all services

-   **Parent-child relationships in database:** Foreign key constraints enforce referential integrity

-   **Audit log cross-referencing:** Every audit entry includes evaluation_id and user_id

-   **Trace ID propagation:** All services include trace_id in logs and error messages

**Traceability benefits:**

-   **User support:** Customer support can trace user\'s full history

-   **Debugging:** Engineers can follow request through entire pipeline

-   **Compliance:** Auditors can verify system behavior for specific evaluations

-   **Analytics:** Product team can analyze user progression patterns

*Business note: Full traceability is the foundation of trust. Users and auditors can verify everything.*

**PART D --- IMPLEMENTATION ARTIFACTS**

**SECTION 13 --- CANONICAL SCHEMAS AND CONTRACTS**

**Versioning Injection**

**All implementation artifacts MUST include:**

> \"platform_governance_version\": \"VOL-III-1.0\"

This field is required in all evaluation artifacts, change proposals, audit verdicts, and exchange contracts.

**ChangeProposal JSON Schema**

> {
>
> \"\$schema\": \"http://json-schema.org/draft-07/schema#\",
>
> \"title\": \"ChangeProposal\",
>
> \"type\": \"object\",
>
> \"required\": \[
>
> \"proposal_id\",
>
> \"created_at\",
>
> \"author\",
>
> \"scope\",
>
> \"change_type\",
>
> \"summary\",
>
> \"artifacts\"
>
> \],
>
> \"properties\": {
>
> \"proposal_id\": { \"type\": \"string\" },
>
> \"created_at\": { \"type\": \"string\", \"format\": \"date-time\" },
>
> \"author\": { \"type\": \"string\" },
>
> \"scope\": {
>
> \"type\": \"string\",
>
> \"enum\": \[\"schema\", \"governance\", \"prompt\", \"workflow\",
>
> \"ui\", \"adapter\", \"multi-ai\"\]
>
> },
>
> \"change_type\": {
>
> \"type\": \"string\",
>
> \"enum\": \[\"add\", \"modify\", \"deprecate\", \"remove\", \"replace\"\]
>
> },
>
> \"summary\": { \"type\": \"string\" },
>
> \"rationale\": { \"type\": \"string\" },
>
> \"impact_analysis\": { \"type\": \"string\" },
>
> \"artifacts\": {
>
> \"type\": \"array\",
>
> \"items\": { \"type\": \"string\" }
>
> },
>
> \"backwards_compatibility\": { \"type\": \"boolean\" },
>
> \"migration_required\": { \"type\": \"boolean\" },
>
> \"risk_level\": {
>
> \"type\": \"string\",
>
> \"enum\": \[\"low\", \"medium\", \"high\", \"critical\"\]
>
> }
>
> }
>
> }

**AuditVerdict JSON Schema**

> {
>
> \"\$schema\": \"http://json-schema.org/draft-07/schema#\",
>
> \"title\": \"AuditVerdict\",
>
> \"type\": \"object\",
>
> \"required\": \[
>
> \"audit_id\",
>
> \"timestamp\",
>
> \"auditor\",
>
> \"target\",
>
> \"verdict\"
>
> \],
>
> \"properties\": {
>
> \"audit_id\": { \"type\": \"string\" },
>
> \"timestamp\": { \"type\": \"string\", \"format\": \"date-time\" },
>
> \"auditor\": { \"type\": \"string\" },
>
> \"target\": { \"type\": \"string\" },
>
> \"verdict\": {
>
> \"type\": \"string\",
>
> \"enum\": \[\"pass\", \"conditional_pass\", \"fail\"\]
>
> },
>
> \"confidence\": {
>
> \"type\": \"number\",
>
> \"minimum\": 0,
>
> \"maximum\": 1
>
> },
>
> \"findings\": {
>
> \"type\": \"array\",
>
> \"items\": { \"type\": \"string\" }
>
> },
>
> \"required_actions\": {
>
> \"type\": \"array\",
>
> \"items\": { \"type\": \"string\" }
>
> },
>
> \"evidence_links\": {
>
> \"type\": \"array\",
>
> \"items\": { \"type\": \"string\", \"format\": \"uri\" }
>
> }
>
> }
>
> }

**ConvergenceResult Schema**

> {
>
> \"\$schema\": \"http://json-schema.org/draft-07/schema#\",
>
> \"title\": \"ConvergenceResult\",
>
> \"type\": \"object\",
>
> \"required\": \[
>
> \"convergence_id\",
>
> \"timestamp\",
>
> \"inputs\",
>
> \"strategy\",
>
> \"result\"
>
> \],
>
> \"properties\": {
>
> \"convergence_id\": { \"type\": \"string\" },
>
> \"timestamp\": { \"type\": \"string\", \"format\": \"date-time\" },
>
> \"inputs\": {
>
> \"type\": \"array\",
>
> \"items\": { \"type\": \"string\" }
>
> },
>
> \"strategy\": {
>
> \"type\": \"string\",
>
> \"enum\": \[\"majority_vote\", \"weighted_merge\",
>
> \"consensus\", \"authority_override\"\]
>
> },
>
> \"result\": { \"type\": \"object\" },
>
> \"confidence\": {
>
> \"type\": \"number\",
>
> \"minimum\": 0,
>
> \"maximum\": 1
>
> },
>
> \"notes\": { \"type\": \"string\" }
>
> }
>
> }

**Multi-AI Data Exchange Contract**

Purpose: Defines the canonical structure for exchanging evaluation or revision data between independent AI systems.

> {
>
> \"exchange_version\": \"1.0\",
>
> \"sender\": \"system_identifier\",
>
> \"recipient\": \"system_identifier\",
>
> \"timestamp\": \"ISO-8601\",
>
> \"payload_type\": \"evaluation \| revision \| audit \| convergence\",
>
> \"payload_schema\": \"schema_identifier\",
>
> \"payload\": {},
>
> \"trace_id\": \"string\",
>
> \"integrity_hash\": \"sha256\"
>
> }

**SECTION 14 --- PROMPT REGISTRY**

**PROMPT-AEP-PASS1**

**SYSTEM**

You are an evaluator operating under the Author Evaluation Protocol (AEP). Your task is to assess narrative material using canonical criteria.

**USER**

Provide evaluation of the supplied text.

**TASK**

Perform structured evaluation:

-   Score each canonical criterion

-   Provide evidence excerpts

-   Provide revision recommendations

-   Produce structured result envelope

**OUTPUT FORMAT**

Must conform to EvaluationResultV1 schema.

**PROMPT-AEP-PASS2**

**SYSTEM**

You are a secondary evaluator performing independent assessment.

**USER**

Re-evaluate the same material independently.

**TASK**

-   Avoid influence from PASS1

-   Provide independent scoring

-   Flag disagreements

-   Suggest convergence notes

**OUTPUT FORMAT**

Must conform to EvaluationResultV1.

**PROMPT-AEP-PASS3**

**SYSTEM**

You are a convergence authority.

**USER**

Given PASS1 and PASS2 outputs, produce final convergence.

**TASK**

-   Compare results

-   Apply convergence strategy

-   Resolve conflicts

-   Produce canonical result

**OUTPUT FORMAT**

Must conform to ConvergenceResult schema.

**SECTION 15 --- IMPLEMENTATION SPECIFICATIONS**

**Provider-Agnostic Adapter Layer**

**Purpose:** Decouples canonical system logic from model/provider specifics.

**Rules:**

1.  Core logic must never call provider APIs directly

2.  All provider interactions occur through adapters

3.  Adapters must implement a common interface

4.  Failure handling must be standardized

5.  Retry logic must be adapter-contained

**ModelAdapter Interface Contract:**

> interface ModelAdapter {
>
> evaluate(input: CanonicalInput): Promise\<CanonicalOutput\>;
>
> healthCheck(): Promise\<boolean\>;
>
> providerName(): string;
>
> }

**This enables:**

-   Model-agnostic routing

-   Output normalization

-   Failover handling

-   Capability registry

-   Vendor lock-in prevention

**Author Studio UI Behavior Specification**

**UI Canon Rules:**

1.  All user-visible changes must be traceable

2.  Canonical formatting locks cannot be overridden

3.  Structural canon must render identically across sessions

4.  Editing modes must respect Trusted Path constraints

5.  UI must surface governance state (draft, verified, locked)

Button Action Logic

\"Run Evaluation\" button:

Disabled if: manuscript not uploaded, or evaluation already in progress

Enabled if: manuscript present, no active evaluation

Action: Initiates Pass 1 evaluation via Trusted Path

\"Generate Alternates\" button:

Disabled if: eligibility gate not cleared, or structural failure detected

Enabled if: gate cleared, user in Studio Mode

Action: Surfaces WAVE refinement suggestions

\"Accept Change\" button:

Action: Logs acceptance, updates manuscript version, preserves original in history

Required: Justification text if in Trusted Path mode

\"Reject Change\" button:

Action: Logs rejection with reason, preserves suggestion in disputed-items log

Disputed-Item Review Flow

When a user disputes an AI suggestion:

1\. Capture reason for dispute (required field)

2\. Log dispute with timestamp and user ID

3\. Flag suggestion as \"author-disputed\"

4\. If dispute rate exceeds 20%, surface to human reviewer

Human Override Controls

Available in Studio Mode only.

What can be overridden:

Eligibility gate status (for testing)

WAVE rule enforcement (temporary disable)

Score thresholds (exploratory analysis)

What cannot be overridden (regardless of mode):

Schema conformity

Audit logging

Data persistence

Traceability IDs

Approval Workflow States

Evaluation lifecycle progresses through these states:

1\. Draft --- manuscript uploaded, no evaluation run

2\. Evaluating --- Pass 1, 1.5, 2, or 3 in progress

3\. Gated --- evaluation complete, eligibility gate blocking refinement

4\. Cleared --- gate passed, refinement tools unlocked

5\. Revised --- author accepted changes, new version created

6\. Final --- author marked as ready for submission

State transitions are logged with: timestamp, actor, previous state, new state, and justification.

Conflict Resolution UX

When Pass 1 and Pass 2 scores disagree:

Surface both scores side-by-side

Highlight areas of disagreement

Show Pass 3 convergence reasoning

Allow user to drill into evidence for each pass

Visual treatment for disagreement severity:

Consensus (Pass 1 ≈ Pass 2): green indicator

Minor disagreement (±10 points): yellow indicator

Major disagreement (±20+ points): red indicator, auto-flag for review

**Trusted Path vs Studio Mode**

  ----------------- ------------------------------------------ ----------------------------------------
  **Aspect**        **Trusted Path**                           **Studio Mode**

  **Governance**    Canon-enforced                             Relaxed

  **Outputs**       Canon-locked, publication-grade            Draft-state, exploratory

  **Editing**       Restricted, rule-triggered only            Flexible, human-in-loop

  **Audit Trail**   Required                                   Optional

  **Use Case**      Final evaluation before agent submission   Iterative drafting and experimentation
  ----------------- ------------------------------------------ ----------------------------------------

Mode switch must be explicit and traceable.

**Implementation Priority Order**

The following sequence ensures each layer builds on a stable foundation.

Phase 1 --- Core Pipeline Infrastructure

What to build: Manuscript upload and storage, job queue and state management, evaluation result persistence, basic audit logging.

Why first: Nothing else works without the data foundation.

Milestone: System can accept uploads, queue evaluations, and store results.

Phase 2 --- Canon Enforcement Layer

What to build: Canonical criteria registry, schema validation (Canon Gate Pass 1.5), rule-triggered edit logic, nomenclature canon validation.

Why second: Ensures all subsequent features respect governance from day one.

Milestone: Canon Gate blocks malformed evaluations; rule violations are logged.

Phase 3 --- AI Orchestration

What to build: Provider-agnostic adapter layer, multi-pass evaluation workflow (Pass 1, 2, 3), convergence logic, prompt registry integration.

Why third: Connects evaluation intelligence to infrastructure.

Milestone: End-to-end evaluation runs; multi-AI convergence produces final result.

Phase 4 --- User Interface Surface

What to build: Author dashboard, evaluation results display, eligibility gate UI, refinement tool UI (Studio Mode), approval workflows.

Why fourth: Users need to see and act on evaluations.

Milestone: Authors can view results, accept/reject suggestions, track revisions.

Phase 5 --- Reporting and Artifacts Layer

Milestone: Full audit trail accessible; users can export results; ops can monitor system health.

Why fifth: Enables transparency, trust, and operational visibility.

What to build: Audit trail UI, version history, disputed-items log, analytics dashboard (for ops), export/download features.

Engineering Reference Artifacts

Purpose: Canonical file locations and naming conventions for the engineering team. All paths are relative to repository root.

Schema Files

Location: /schemas

evaluation-result-v1.ts --- EvaluationResultV1 TypeScript schema

criteria-keys.ts --- Immutable canonical criteria registry

job-contract-v1.ts --- Job state and lifecycle contract

Usage: Import schemas directly; do not duplicate or modify.

Type Definitions

Location: /lib/types

canon.ts --- Canon validation types

jobs.ts --- Job queue and state types

adapter.ts --- Provider adapter interface types

Prompt Templates

Location: /lib/prompts

aep-pass1.txt --- Pass 1 primary evaluation prompt

aep-pass2.txt --- Pass 2 independent verification prompt

aep-pass3.txt --- Pass 3 convergence authority prompt

Usage: Load at runtime; do not hardcode prompts in application logic.

Adapter Implementations

Location: /lib/adapters

adapter-interface.ts --- ModelAdapter interface definition

openai-adapter.ts --- OpenAI implementation

anthropic-adapter.ts --- Anthropic implementation

adapter-factory.ts --- Provider selection and routing logic

Database Migrations

Location: /migrations

Naming convention: YYYYMMDD_HHMM_description.sql

All migrations must be reversible (include DOWN script)

Test migrations on dev environment before production

Log all schema changes in ChangeProposal format

Configuration Files

Location: /config

canon-thresholds.json --- Eligibility gate score thresholds

provider-config.json --- AI provider settings and failover rules

feature-flags.json --- Feature toggles for staged rollout

CI/CD Orchestration Pipelines

Location: /.github/workflows

canon-validation.yml --- Runs on every PR to validate canon compliance

schema-check.yml --- Validates schema changes against contracts

integration-tests.yml --- Full evaluation pipeline end-to-end tests

Documentation

Location: /docs

/docs/api-contracts --- Evaluation, jobs, and auth API endpoint specs

/docs/ui-behavior --- Button logic, mode switching, conflict resolution UX specs

/docs/state-machines --- Evaluation lifecycle and job transition diagrams (Mermaid format)

**PART E --- GOVERNANCE AUTHORITY AND COMPLETION**

**SECTION 16 --- COMPLETION STATUS**

**Definition of Complete**

**Volume III is complete when:**

A developer who has never met the system author can implement the full system without interpretation.

**Implementation Completeness Rule:**

An engineer who has never met the system author can:

1.  Implement all workflow routing logic using only this document

2.  Configure eligibility gates and thresholds correctly

3.  Build data persistence layer conforming to artifact spine

4.  Enforce consequences for structural failures

5.  Integrate governance hooks mechanically

6.  Verify implementation against completion criteria

*Test of completeness: Hand this document to a senior engineer unfamiliar with RevisionGrade. Can they build the operational system without additional clarification? If yes, document is complete.*

**What This Document Enables**

**For new employees:**

-   Understand what RevisionGrade does and why

**For engineers:**

-   Build features that respect governance constraints

-   Implement workflow routing logic without interpretation or guesswork

-   Build gates and thresholds with confidence in correctness

-   Implement data schemas knowing they match canonical contracts

-   Debug production issues using traceability and audit trails

**For operations staff:**

-   Support users and enforce eligibility gates

-   Understand when gates fire and why tools unlock

-   Tune thresholds to optimize user experience

-   Monitor system health using defined metrics

-   Troubleshoot user issues with full visibility into workflow state

**For product managers:**

-   Configure system behavior to balance strictness with usability

-   Analyze user progression through defined workflow stages

-   Identify drop-off points and optimize conversion

-   Make data-driven decisions about threshold tuning

**For investors and acquirers:**

-   Evaluate system maturity and scalability

-   Verify system behavior matches governance claims

-   Trace every decision to its mechanical implementation

-   Assess operational maturity and technical depth

-   Confirm platform is production-ready and scalable

**For partners:**

-   Integrate with confidence in system behavior

**SECTION 17 --- GOVERNANCE AUTHORITY**

**Primary Author:** Mike Meraw, Founder and CEO, RevisionGrade

**Change Control:**

All modifications to this document require:

1.  ChangeProposal submission (conforming to ChangeProposal JSON schema)

2.  Rationale statement explaining why change is needed

3.  Impact analysis covering affected systems and users

4.  Governance review by technical leadership

5.  Approval logged in audit trail

**Audit Requirements:**

All changes to this document are logged with:

-   Timestamp of change

-   Author of change

-   Summary of modifications

-   Justification for modifications

**Version:** 1.0 (MASTER) --- LOCKED CANON

**APPENDIX --- QUICK REFERENCE TABLES**

**Threshold Summary**

  --------------------------------- ----------- ------------------------------------------------------
  **Threshold**                     **Value**   **Triggers**

  **STRUCTURAL_FAIL_THRESHOLD**     50          Hard fail, all tools blocked, remediation guidance

  **ELIGIBILITY_MIN_SCORE**         60          Minimum for any refinement access

  **REFINEMENT_UNLOCK_THRESHOLD**   65          WAVE tools enabled, polish-phase begins

  **AGENT_READY_THRESHOLD**         80          Submission kit unlocked, professional export enabled
  --------------------------------- ----------- ------------------------------------------------------

**Gate Classification**

  ----------------- ------------------------ ---------------------------- -----------------------------------------------------------------------
  **Score Range**   **Classification**       **Tools Available**          **User Message**

  \< 50             **Structural Failure**   None (blocked)               \"Structural issues detected. Address foundation before polish.\"

  50-59             **Needs Improvement**    Review only                  \"Manuscript needs work before refinement tools unlock.\"

  60-64             **Eligible (Basic)**     Basic review + diagnostics   \"Basic review tools available. Improve score to unlock refinement.\"

  65-79             **Refinement Ready**     WAVE tools + alternates      \"Refinement tools unlocked. Polish your manuscript.\"

  80+               **Agent Ready**          All tools + submission kit   \"Congratulations! Your manuscript is agent-ready.\"
  ----------------- ------------------------ ---------------------------- -----------------------------------------------------------------------

**Pipeline Stage Summary**

  -------------- -------------- ----------------------------------- -------------------------
  **Stage**      **Duration**   **Key Actions**                     **Outcome**

  **Submit**     30 sec         Upload file, select mode            Job queued

  **Evaluate**   2-5 min        Multi-pass AI evaluation            Evaluation complete

  **Validate**   5-10 sec       Canon Gate schema check             PASS/FAIL verdict

  **Gate**       Instant        Apply threshold logic               Tools unlocked/locked

  **Refine**     30-120 min     Review suggestions, accept/reject   Manuscript improved

  **Approve**    5-10 min       Lock version, generate kit          Submission-ready

  **Export**     1-2 min        Download professional formats       Materials delivered
  -------------- -------------- ----------------------------------- -------------------------

**Cross-References**

**Volume IV --- AI Governance Canon**

-   Change control procedures (how to update AI behavior)

-   Audit verification protocols (how to verify AI compliance)

-   Governance authority documentation (who approves AI changes)

**Volume V --- Execution Architecture**

-   Deployment workflows (how system is deployed to production)

-   Retry and atomicity rules (how failures are handled)

-   Operational runbooks (step-by-step ops procedures)

-   Sprint execution materials (how team executes builds)

**END OF DOCUMENT**

VOLUME III --- PLATFORM GOVERNANCE CANON (MASTER v1.0) --- LOCKED CANON
