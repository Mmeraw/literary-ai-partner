**VOLUME V — EXECUTION ARCHITECTURE & INDUSTRY INTERFACE CANON**

**Canon Preservation Mode**: Original authorial content retained. No deletions except true duplicates. Structural consolidation only.

**Purpose**
Volume V defines how the RevisionGrade platform actually runs in production and how its internal evaluations become industry-facing artifacts for authors, agents, and publishers. It is the execution spine: pipelines, orchestration, artifact generation, and reliability rules that turn governance and tooling into a predictable, auditable runtime system.

**What this volume governs**

* End-to-end execution of the Author Execution Pipeline (AEP)
* Multi-pass, multi-AI orchestration and convergence
* Chunking and whole-manuscript assembly behavior
* Execution modes (Trusted Path vs Studio) and their consequences
* UI contracts for human review and override
* Generation and certification of agent- and publisher-facing artifacts
* Reliability, retry, degraded-mode, and incident handling

**How Volume V integrates with other volumes**

* Volume I–II describe the writing and story evaluation engines at a conceptual craft level.
* Volume III defines what the system does technically: schemas, prompts, adapters, gates, and operational rules.
* Volume IV defines what AI is allowed to do: authority limits, canon protection, and governance controls.
* Volume V sits on top of these and defines how the whole system executes and interfaces with the industry—which pipelines must run, in what order, under which governance constraints, and with what external outputs.

Execution architecture in Volume V must never contradict Volumes III and IV; it operationalizes their rules and exposes their results to the outside world in a controlled, certifiable way.

\*\*\*

**V.1 Agent & Publisher Interface Canon**

**Purpose**

Volume V defines how internal evaluations and governance logic are converted into **industry-facing signals** that agents, publishers, and partners can trust.​
It specifies what artifacts are produced, who receives them, when they are generated, and which governance layers certify them.​

**Core Deliverables and Audiences**

For each deliverable, Volume V defines audience, timing, and guarantees:

* **Composite Score Certificate**
  + **Audience:** Agents, publishers, authors.
  + **Generated when:** Manuscript has completed full AEP execution (all required passes) and passed Canon Gate and eligibility thresholds defined in Volume III.
  + **Contains:** Final composite score, evaluation date, mode (Trusted Path / Studio), governance flags.
  + **Guarantees:** Score is derived from canon-compliant pipeline, with traceable provenance and immutable audit record (per Vol III/IV).
* **Criteria Scorecard**
  + **Audience:** Authors, internal editors, occasionally agents who want depth.
  + **Generated when:** Structural evaluation and diagnostic refinement passes are complete.​
  + **Contains:** Per-criterion scores, brief evidence excerpts, high-level recommendations.
  + **Guarantees:** All criteria correspond to canonical registry in Volume III; no ad hoc or hidden criteria.
* **Revision Integrity Report**
  + **Audience:** Authors, agents who worry about over-editing or voice loss.
  + **Generated when:** At least one revision cycle has been completed after initial evaluation.​
  + **Contains:** Before/after comparison, revision lineage, acceptance/rejection rates of suggestions, voice-preservation checks.
  + **Guarantees:** Changes were made under governance constraints (Volume IV) and are fully traceable in the audit spine (Volume III).
* **Market Positioning Brief**
  + **Audience:** Authors, agents, internal biz-dev.
  + **Generated when:** Manuscript reaches or approaches agent-ready threshold but before final submission.
  + **Contains:** Genre positioning, tonal band, comparable titles, likely audience segments.
  + **Guarantees:** Positioning is grounded in manuscript content and canonical evaluation, not purely marketing claims.
* **Comparables & Audience Fit Sheet**
  + **Audience:** Agents, publishers.
  + **Generated when:** Submission kit is assembled.​
  + **Contains:** Short list of comparables, target readership, key differentiators, risk flags.
  + **Guarantees:** Source manuscript, evaluation data, and canon rules used in the analysis are all traceable.

**Trust Signals**

Every external artifact is backed by explicit trust signals:

* **Scoring provenance** — shows which passes, models, and governance checks contributed to the final score (Trifecta + Canon Gate).
* **Human + AI agreement** — highlights where human reviewers confirmed or overrode AI diagnostics.
* **Versioned revision history** — exposes the full change history from initial submission to agent-ready version.
* **Certification bundle** — groups all artifacts into a coherent package with a single certification header indicating mode, date, and governance state at time of generation.​

**V.2 Conceptual Pipeline Architecture**

**Purpose**

This section defines the **conceptual runtime pipeline** that turns raw manuscripts into certified, agent-facing artifacts.​
It abstracts away code-level details from Volume III and focuses on **stages, handoffs, and control points**.​

**End-to-End Flow (Conceptual)**

At the highest level, the pipeline is:

**Ingest → Evaluate → Converge → Govern → Refine → Certify → Export**

* **Ingest:** Manuscript upload, metadata capture, mode selection.
* **Evaluate:** Multi-pass structural and diagnostic evaluation (AEP).​
* **Converge:** Multi-AI comparison and conflict resolution (Trifecta + convergence).​
* **Govern:** Canon Gate, AI governance checks, and human authority review.
* **Refine:** WAVE refinement, revision cycles, integrity tracking.
* **Certify:** Readiness decisions, proof of governance and evaluation quality.
* **Export:** Generation of industry-facing artifacts and submission bundles.​

**Stage Handoffs and Control Points**

For each stage, Volume V defines:

* **Entry conditions:** What must be true for this stage to start.
* **Exit conditions:** What must be produced for downstream stages.
* **Control points:** Where Canon Gate or governance rules can block, reroute, or escalate.

Examples:

* Between **Ingest** and **Evaluate:**
  + Entry: Valid manuscript file, chosen mode (Trusted Path / Studio), basic metadata captured.
  + Control: Mode flag determines whether full governance or exploratory constraints apply.
* Between **Evaluate** and **Converge:**
  + Entry: At least one structural evaluation pass complete with schema-valid artifact.
  + Control: Canon Gate may hard-fail malformed results, preventing convergence from running on invalid data.​
* Between **Govern** and **Refine:**
  + Entry: Canon and governance checks passed, or soft-failed with warnings.
  + Control: Eligibility gates determine whether WAVE tools can act or user must return to structural remediation.​
* Between **Certify** and **Export:**
  + Entry: Manuscript marked agent-ready under defined thresholds and human confirmation (Trusted Path).
  + Control: Certification bundle can only be generated if all required evaluation and governance steps completed successfully.​

**Emission Points**

Volume V also defines **where artifacts are emitted**:

* After **Evaluate:** internal evaluation artifacts, not yet agent-facing.
* After **Converge + Govern:** reconciled, canon-compliant evaluation suitable for use in downstream artifacts.
* After **Refine:** revision-integrity reports showing changes vs original.
* After **Certify:** full external bundle (score certificate, scorecard, positioning, comparables).​

**V.3 AEP One‑Shot Execution Flow (Runtime Spine)**

**Purpose**

AEP (Author Execution Pipeline) defines the **runtime spine** for a single end‑to‑end manuscript run.​
It sequences concrete steps, inputs, outputs, blocking conditions, audit events, and escalation paths.

**STEP 0 — Canon Loader**

* **Inputs:**
  + Canon rules, evaluation criteria, governance locks, formatting protections (from Volumes III & IV).
* **Actions:**
  + Load current canonical criteria and thresholds.
  + Load governance constraints (AI boundaries, formatting locks, POV rules).
  + Load execution mode configuration (Trusted Path vs Studio).​
* **Outputs:**
  + In‑memory “Execution Context” containing canon snapshot + execution configuration for this run.
* **Blocking conditions:**
  + If canon or configuration fails to load or validate → AEP does not start.
* **Audit events:**
  + canon\_loaded with canon version, threshold versions, and governance mode snapshot.
* **Dependencies:**
  + Volume III (criteria, thresholds, gate definitions).
  + Volume IV (AI governance rules, formatting locks, authority model).​

**STEP 1 — Structural Evaluation Pass**

* **Inputs:**
  + Manuscript text (possibly chunked conceptually), execution context, evaluation criteria.
* **Actions:**
  + Apply Story Architecture and canonical story criteria (e.g., 13 criteria).​
  + Compute per‑criterion scores and structural score.
  + Compute composite score and initial eligibility status.
* **Outputs:**
  + Primary evaluation artifact conforming to EvaluationResultV1 (structural focus).​
  + Structural Score, Composite Score, Eligibility Status flags.​
* **Blocking conditions:**
  + If evaluator fails or artifact invalid → Canon Gate will hard‑fail at Step 1.5.​
* **Audit events:**
  + structural\_evaluation\_started / structural\_evaluation\_completed with trace ID, model info, latency, and high‑level outcome.​
* **Escalation path:**
  + If structural evaluation repeatedly fails (e.g., provider outage), job is marked for operational review, not silently dropped.
* **Dependencies:**
  + Volume III (EvaluationResult schema, structural criteria).
  + Volume V (chunking model, described later).​

**STEP 1.5 — Canon Gate (Deterministic Filter)**

* **Inputs:**
  + Structural evaluation artifact from Step 1.
* **Actions:**
  + Validate schema (required fields, types, ranges, trace IDs).​
  + Enforce score bounds and eligibility thresholds.
  + Classify result as PASS, SOFT\_FAIL, or HARD\_FAIL.​
* **Outputs:**
  + Canon Gate verdict + validation report.
  + Flags attached to evaluation artifact (e.g., canon\_status: PASS or SOFT\_FAIL: evidence\_missing).
* **Blocking conditions:**
  + **HARD\_FAIL:** Stop pipeline for this run, trigger retries up to configured limit, then escalate to human ops.
  + **SOFT\_FAIL:** Proceed but mark artifact for later human sampling.
* **Audit events:**
  + canon\_gate\_passed / canon\_gate\_soft\_fail / canon\_gate\_hard\_fail with explicit error codes and reasons.​
* **Escalation path:**
  + Hard fails that persist across retries are sent to a human review queue with full context, not discarded.
* **Dependencies:**
  + Volume III Canon Gate spec.​

**STEP 2 — Diagnostic Refinement Pass**

* **Inputs:**
  + Canon‑validated structural evaluation artifact, execution context, WAVE domain configuration.
* **Actions:**
  + Activate WAVE domains (line‑level authority checks, clarity, pacing refinements).​
  + Identify weaknesses, map them to correction strategies, and assemble a **revision blueprint**.
* **Outputs:**
  + Enriched evaluation artifact with line‑level diagnostics and WAVE suggestions.
  + A structured list of change proposals (not yet applied).​
* **Blocking conditions:**
  + If structural score below hard thresholds, diagnostic refinement may be restricted or forced into “structural fix first” mode.
* **Audit events:**
  + diagnostic\_refinement\_completed with counts of issues found, WAVE suggestions generated, and high‑level severity mix.
* **Escalation path:**
  + Excessive high‑severity findings may trigger recommendation for human editorial review before convergence.
* **Dependencies:**
  + Volume III (WAVE definitions, ChangeProposal structures).
  + Volume IV (authority band, POV doctrine, formatting locks govern what suggestions are permitted).​

**STEP 3 — Multi‑AI Convergence Pass**

* **Inputs:**
  + One or more independent evaluation artifacts (from separate evaluators/providers).​
* **Actions:**
  + Run identical or role‑specific prompts across multiple AI systems (per Volume III prompt registry).​
  + Compare outputs to detect consensus, divergence, and novelty.​
  + Apply convergence strategy (majority vote, weighted merge, consensus, or authority override).
* **Outputs:**
  + Converged evaluation artifact, including explicit labels for consensus zones and divergence zones.​
  + Convergence metadata (confidence scores, provider contributions).
* **Blocking conditions:**
  + If convergence fails (e.g., providers disagree beyond thresholds), system may require human review before artifact can be certified.
* **Audit events:**
  + multi\_ai\_convergence\_completed with measures of agreement, divergence, and confidence.​
* **Escalation path:**
  + Divergences above defined thresholds → mark sections for human review at Step 4.
* **Dependencies:**
  + Volume III (convergence schema and strategies).​
  + Volume IV (governance rules for when AI disagreement requires human authority).​

**STEP 4 — Human Authority Review**

* **Inputs:**
  + Converged AI evaluation artifact with highlighted divergence and high‑severity issues.​
* **Actions:**
  + Human reviewer inspects diagnostics, especially divergence zones and high‑severity findings.​
  + Confirms, amends, or rejects AI findings, with justification.
  + Ensures author voice and canon rules are preserved.​
* **Outputs:**
  + Human‑augmented evaluation artifact, tagged with human decisions and justifications.
  + Resolution of critical divergences.
* **Blocking conditions:**
  + Certification cannot proceed without human review in Trusted Path mode for structural readiness.
* **Audit events:**
  + human\_review\_completed with counts of AI findings upheld/overturned, and rationale for key overrides.
* **Escalation path:**
  + If human reviewer finds systemic AI misbehavior (e.g., repeated canon violations), this triggers governance and model review, not just manuscript-level fixes.
* **Dependencies:**
  + Volume IV (Human Authority Supremacy, oversight protocols).​

**STEP 5 — Execution & Artifact Generation**

* **Inputs:**
  + Human‑reviewed, canon‑compliant evaluation artifact.​
* **Actions:**
  + Generate internal artifacts (diagnostic reports, revision plan).
  + Generate author-facing artifacts (scorecard, recommendations, revision integrity).
  + Generate agent-facing artifacts (Composite Score Certificate, Positioning Brief, Comparables & Audience Fit Sheet).​
  + Attach provenance, governance, and revision lineage data to every artifact.
* **Outputs:**
  + Full artifact bundle ready for export and submission.​
* **Blocking conditions:**
  + If governance or certification checks fail (e.g., missing human approvals), artifact generation is halted or limited to draft mode.
* **Audit events:**
  + artifact\_bundle\_generated with artifact types, certification status, and target audiences recorded.
* **Dependencies:**
  + Volume III (artifact schema definitions and export formats).
  + Volume IV (what must be true about AI/human authority before artifacts can be presented as certified).​

**V.4 Trifecta Model (Three-Pass Evaluation Architecture)**

**Purpose**

The Trifecta Model defines why RevisionGrade uses a **three-pass evaluation structure** instead of a single AI verdict.​
It separates discovery, verification, and convergence into distinct authority layers to increase reliability and reduce undetected errors.​

**Components of the Trifecta**

* **Pass 1 — Primary Structural Evaluator**
  + Role: perform the first, full-coverage structural and criteria evaluation.​
  + Strength: breadth and speed; surfaces most issues.
  + Limitation: fallible; may mis-score or over/under-emphasize certain patterns.
* **Pass 2 — Independent Evaluator**
  + Role: re-evaluate the same manuscript independently, without seeing Pass 1.​
  + Strength: adversarial redundancy; catches blind spots of Pass 1.
  + Limitation: can disagree sharply with Pass 1, requiring resolution.
* **Pass 3 — Convergence / Arbitration Layer**
  + Role: compare Pass 1 and Pass 2 outputs, resolve conflicts using defined strategies, and produce a canonical result.​
  + Strength: converts multiple opinions into a single, traceable outcome.
  + Limitation: must follow strict governance rules; cannot silently ignore major disagreements.​

**Why Single-Pass Is Insufficient**

A single AI evaluation:

* Cannot distinguish between **confident agreement** and **confident but wrong**.
* Provides no internal second opinion.
* Makes it harder for humans and agents to trust the score as a professional signal.​

The Trifecta:

* Increases **diagnostic coverage** (two independent passes).
* Creates explicit **disagreement zones** for human attention.​
* Provides a structured way to combine AI opinions into a single, governed result.​

**Trifecta Outcomes**

For each criterion and key structural dimension:

* **Agreement Zone:** Pass 1 and Pass 2 scores align within tolerance.
  + Treatment: convergence accepts the shared judgment, tagged as high-confidence.​
* **Minor Divergence:** Scores differ within a moderate band.
  + Treatment: convergence applies weighted or consensus logic; may still flag for sampling.​
* **Major Divergence:** Scores differ beyond defined thresholds or disagree on failure vs success.
  + Treatment: convergence flags as a **human review required** item before certification.

The Trifecta ensures that high-stakes decisions (structural passes, agent-ready judgments) are never the product of one unchecked AI pass.

**V.5 Chunking & Manuscript Assembly Architecture**

**Purpose**

Chunking architecture defines how large manuscripts are divided, evaluated, and reassembled into whole-book judgments **without losing narrative integrity**.​

**Why Chunking Exists**

* Technical constraints: AI models have token limits; full manuscripts cannot be evaluated in a single window.
* Precision: evaluating smaller sections improves local diagnostics.
* Reliability: structured chunking allows focused checks (scene, chapter, act).​

**Chunking Philosophy**

Chunking is based on **narrative units**, not arbitrary token counts:

* Preferred units: scenes, contiguous chapters, or structural segments (acts, major turns).​
* Rule: chunk boundaries must align with natural narrative breaks whenever possible to preserve coherence.

When token limits require finer splits, the system:

* Preserves local context (previous/next context summary).
* Records boundary metadata to support downstream reassembly.​

**Chunk Evaluation and Reassembly**

For each chunk:

* Inputs: chunk text, limited context, execution context.
* Outputs: local scores, issues, and signals tagged with precise locations.​

After all chunks are processed:

* A **whole-manuscript reconciliation layer** aggregates chunk-level signals into manuscript-level judgments.​
* Rules define how local failures can affect global scores (e.g., recurrent issues across multiple chunks promote to global concerns).

**Anti-Fragmentation Controls**

To avoid chunk-induced distortions:

* Certain checks (e.g., global pacing, series arc coherence) are run on **synthetic views** that combine multiple chunks or use manuscript summaries.​
* The system tracks patterns across chunks to detect systemic issues (e.g., “pacing drifts in every middle chapter”).

Chunking is an implementation detail in Volume III; Volume V governs **how chunking must preserve narrative meaning** when turning chunk evaluations into whole-book decisions.

**V.6 Multi-AI Orchestration Framework**

**Purpose**

The Multi-AI Orchestration Framework defines how different AI providers and models are used together to produce **cross-validated intelligence** instead of a single opaque output.​

**Independence Rules**

* Each AI system must run **independently** with no access to other systems’ outputs for Pass 1 and Pass 2.​
* Prompts may be identical or role-specific (evaluator vs verifier), but each provider sees only the manuscript and its own instructions.
* No single provider is allowed to unilaterally override convergence decisions defined in canon.​

**Orchestration Flow**

1. The orchestration layer dispatches evaluation requests to selected providers according to capability and configuration.​
2. Each provider returns a structured evaluation conforming to canonical schemas (see Volume III).​
3. Convergence logic compares results, computes agreement metrics, and classifies findings into consensus, divergence, and novelty.​

**Consensus and Divergence Thresholds**

* **Consensus threshold:** difference between providers below X points or equivalent classification.
* **Minor divergence band:** difference between X and Y points; may auto-resolve via weighting.
* **Major divergence threshold:** difference above Y points or conflicting structural verdicts; escalated to human review.​

Thresholds X and Y are governed constants defined and versioned alongside evaluation criteria (Volume III) and AI governance rules (Volume IV).

**Arbitration and Confidence Scoring**

Convergence assigns:

* Confidence scores to each consensus finding based on agreement level, provider reliability, and historical performance.​
* Explicit flags to divergent findings, including recommended reviewer attention level.

The framework ensures:

* No provider can silently dominate results.
* Disagreements are visible and actionable rather than hidden.​

**Failure Isolation and Degraded Mode**

If one provider is degraded or failing:

* Orchestration may temporarily operate in **reduced redundancy mode** (fewer providers, adjusted thresholds).​
* In Trusted Path, this may restrict certification until redundancy is restored or human oversight compensates.
* Failures are logged and visible to operations and governance review, not silently ignored.

**V.7 Provider Abstraction in Runtime**

**Purpose**

This section defines the **runtime role** of provider abstraction: how the system uses adapters to interact with multiple AI providers without coupling core logic to any one vendor.​

**Adapter Role**

* All provider-specific calls pass through a standardized **adapter interface**, as defined in Volume III.
* At runtime, Volume V governs how these adapters are orchestrated, selected, and used in combination.​

**Responsibilities in Execution**

* Normalize prompts: ensure canonical prompts from Volume III are rendered into provider-specific formats without changing meaning.​
* Normalize responses: convert provider outputs into canonical schema objects (EvaluationResult, ConvergenceReport, etc.).
* Handle provider-specific errors and retries according to reliability rules in V.11.​

**Failover and Provider Isolation**

* If one provider fails health checks or exhibits anomalous behavior (high error rates, schema violations), the runtime can **route around** that provider.​
* Core execution logic does not change; only adapter selection and orchestration configuration change.

This preserves:

* Vendor independence
* Stability of evaluation canon
* Smooth integration of new providers as the platform evolves.​

**V.8 Execution Modes (Trusted Path vs Studio)**

**Purpose**

Execution modes define how strictly governance, audit, and certification rules apply to a given run.​

**Mode 1 — Trusted Path**

* For: authors pursuing agent/publisher submissions, professional evaluations.​
* Behavior:
  + Full governance enforcement (Volumes III & IV).
  + Canon Gate and Trifecta are mandatory; human review is required for structural readiness.​
  + Artifact generation produces **certified** outputs suitable for external use.

**Mode 2 — Studio Mode**

* For: exploratory work, internal editors, learning workflows.​
* Behavior:
  + Some gates may be relaxed, but schema integrity and audit minimums remain.
  + Outputs are tagged as **draft**, not certified.
  + Human and AI can experiment with different configurations without affecting Trusted Path guarantees.​

Modes are carried as metadata through the entire pipeline and are visible in all artifacts so agents and partners can distinguish draft from certified outputs.​

**V.9 UI & Human Review Contracts**

**Purpose**

UI and review contracts define how the system presents evaluation state, disagreements, and decisions to humans, and how humans interact with AI suggestions.​

**Status Visibility**

The interface must:

* Show evaluation state (queued, running, gated, refining, certified) clearly.​
* Surface Canon Gate results and governance mode (Trusted Path / Studio).
* Indicate where multi-AI disagreement exists and whether human review is required.​

**Disputed Item Handling**

When AI evaluators disagree with each other or with the human:

* The UI displays both views side-by-side, along with relevant evidence excerpts.​
* The human must choose: uphold one, merge, or override both and document a rationale.
* Each resolution is logged as a discrete audit event.

**Human Override**

Human reviewers and authors:

* Can accept, reject, or modify AI suggestions within canon constraints.​
* Cannot override canon rules (e.g., formatting locks) in Trusted Path, but may do so in narrowly defined Studio Mode contexts with explicit warning.​

This contract ensures that UI behavior is predictable and fully aligned with governance and execution architecture.

**V.10 Artifact Generation & Certification System**

**Purpose**

This section defines how internal evaluation results are transformed into **structured artifact classes**, how those artifacts mature through lifecycle states, and what constitutes a certified agent-facing bundle.​

**Artifact Classes**

* **Internal Diagnostic Artifacts** — used by the system and internal staff; not shown to agents.
* **Author-Facing Artifacts** — evaluation reports, scorecards, revision plans.​
* **Agent-Facing Artifacts** — composite score certificate, positioning brief, comparables sheet.​
* **Audit Artifacts** — logs, verdicts, convergence reports, and governance evidence.

**Artifact Lifecycle**

States:

* Provisional — initial, AI-generated only; not yet governance-complete.​
* Reviewed — human review applied; AI findings may be confirmed or amended.​
* Finalized — content locked for a given version of the manuscript.
* Certified — all required governance and Trifecta checks completed in Trusted Path; safe for agent/publisher use.​

Each state transition is logged with timestamp, actor, previous state, new state, and justification, and is governed by rules consistent with Volumes III and IV.

**Certification Signals**

Certified bundles carry:

* Score provenance (which passes, which providers, what mode).​
* Human + AI agreement markers.
* Versioned revision lineage.​
* Governance mode and Canon Gate status at time of certification.

Agents and publishers can use these to assess reliability and trace evaluations back into the platform if needed.

**V.11 Reliability, Retry, and Incident Model**

**Purpose**

This section defines how the execution spine behaves **under failure**, including retries, partial failures, provider outages, and incidents.​
The patterns described here are implemented in the platform’s job orchestration and validation infrastructure, consistent with Volumes III and IV.

**Retry Strategy**

* Evaluation and artifact-generation steps must be **idempotent** at the job level so they can be safely retried.​
* Each step has defined retry limits and backoff strategies (e.g., N attempts with exponential backoff).
* Retries are logged, not silent, and are distinguishable from first attempts in audit records.​

**Atomicity Rules**

* Critical transitions (e.g., certification, artifact finalization) must be **all-or-nothing**: either the entire transaction commits or it is rolled back cleanly.
* Partial writes that would leave data in ambiguous states are not allowed; if encountered, they must be rolled into error paths and incident handling.

**Partial Failure Handling**

* If a non-critical subsystem fails (e.g., one provider in multi-AI), the system operates in **degraded mode** with clearly marked outputs and possibly restricted certification capabilities.​
* If critical subsystems (Canon Gate, governance checks) fail, Trusted Path runs cannot be certified until recovery and re-execution.

**Dead-Letter / Human Review Queues**

* Jobs that repeatedly fail or produce inconsistent results are routed to a **dead-letter / human review queue**, not discarded.​
* Reviewers can see failure context, error codes, and partial results to decide on remediation.
* Dead-letter queues are monitored as health signals for the overall system.

**Incident Escalation**

* Severe or repeated failures (e.g., systematic Canon Gate schema errors, provider misbehavior) trigger incidence creation and governance review.
* Incidents are documented with cause, impact, mitigation, and follow-up actions.
* Reliability patterns in Volume V are directly connected to the platform’s operational runbooks and reporting, even though those live outside Volume V as implementation detail.​

**Audit Preservation During Failure**

* Audit logging is treated as a **first-class responsibility**: failures in business logic must not prevent audit entries from being written.​
* If logging and core evaluation conflict, the system must fail in a mode that preserves logs or explicitly records logging failure as an incident.

**V.11.A Runtime Operations & Incident Runbook**

Modes

OFF (Incident / Unknown State)

EVAL\_WORKER\_DISABLED=true
EVAL\_WORKER\_AUTO\_KILL=false

Use when:

* jobs are behaving inconsistently
* logs are unclear
* cost is accumulating
* pipeline state is untrusted

Effect:

* no processing
* cron still runs (visibility preserved)
* spend stops
* system state stabilizes

VERIFY (Single Truth Run)

EVAL\_WORKER\_DISABLED=false
EVAL\_WORKER\_AUTO\_KILL=false

Use when:

* a fix has just been deployed
* you need to validate runtime behavior

Procedure

1. Submit exactly one job
2. Watch logs for:

[Worker] Claimed job
ProcessorStageBoundary ... start
[Worker] markRunning persisted

1. Immediately query the row:
   * status = running
   * phase\_status = running
   * started\_at is real (not null / not sentinel)
   * heartbeat\_at is real
   * lease fields present

Decision

* If anything is wrong → return to OFF immediately
* If correct → proceed to ON

ON (Controlled Reopen)

EVAL\_WORKER\_DISABLED=false
EVAL\_WORKER\_AUTO\_KILL=false

Use when:

* VERIFY passed cleanly

Behavior:

* normal processing resumes
* manual kill remains primary safety control

Circuit Breaker Policy (for later, not now)

* Exists: yes
* Trusted: no (yet)

Production posture:

EVAL\_WORKER\_AUTO\_KILL=false

If early automation is needed (cost protection only):

EVAL\_WORKER\_AUTO\_KILL=true
EVAL\_WORKER\_CB\_CONSECUTIVE\_FAILURES=999
EVAL\_WORKER\_CB\_STALE\_RUNNING\_THRESHOLD=3
EVAL\_WORKER\_CB\_NO\_SUCCESS\_MINUTES=20

Interpretation:

* trust runtime degradation signals
* do not trust content failure signals

Patch Boundary (This Cycle)

Only these are considered “real work”:

* remove lease\_expires\_at writes
* harden + log markRunning()
* maintain manual kill switch

Anything else = defer

Success Definition

A single job proves:

* claim succeeds
* markRunning() persists
* row reflects real running state
* pipeline enters Phase 1 without lifecycle corruption

That is enough to move forward.

**V.12 Build / Rollout Sequence**

**Purpose**

This section defines the **recommended build and rollout order** for the execution architecture, ensuring that governance and reliability are in place before advanced tooling and external interfaces.​

**Priority Sequence**

1. **Canon Loader and Criteria Registry**
2. **Core Evaluation Engine (AEP Steps 1–2)**
3. **Canon Gate and Schema Validation**
4. **Chunking and Reconciliation Architecture**
5. **Multi-AI Orchestration and Trifecta**
6. **Human Review Layer**
7. **Artifact Generation and Certification System**
8. **Agent & Publisher Interface Artifacts**
9. **Provider Abstraction and Failover Mechanisms**
10. **UI Contracts and Disputed Item Handling**
11. **Reliability, Retry, and Incident Handling**
12. **Optimization and Cost/Throughput Tuning**

Building in this order ensures that:

* Evaluation never runs without canon and governance in place.
* External-facing artifacts are not exposed until reliability and auditability are established.​
* Subsequent performance and UX tuning do not compromise correctness or governance guarantees.

## Confidence Execution Layer v1

**Purpose**

This layer does **not** replace Confidence Heuristic v1. It operationalizes it at runtime so that confidence becomes a governing force rather than a decorative field.

Built against the canon already present in the repo/archive:

* Confidence must be bounded by input scale.
* Partial coverage must cap confidence and may fail closed.
* Confidence must not substitute for proof.
* Too few scorable criteria must reduce aggregate confidence.
* Acceptance is binary: any applicable failure rejects governed output.

**What already exists**

**Canon already present**

1. **Confidence governance by input scale**
   * Paragraph: max 40%
   * Scene: max 65%
   * Chapter: max 75%
   * Multi-chapter: max 85%
   * Full manuscript: max 95%
2. **Criterion observability / signal sufficiency doctrine**
   * Low evaluability warning when too few criteria are scorable.
   * Scope-limited warning when submission scale constrains scoreability.
   * Status model distinguishing scorable vs non-scorable states.
3. **Gold-standard doctrine**
   * Confidence cannot stand in for evidence.
   * Contradictory framing without differentiation is forbidden.
   * Silent convergence is forbidden.
4. **Binary acceptance doctrine**
   * ACCEPT only if all applicable checks pass.
   * Any applicable failure = REJECT.

**What is missing**

A runtime confidence execution layer that:

1. derives confidence from actual evaluation conditions,
2. propagates uncertainty across Pass 1 → Pass 2 → Pass 3,
3. converts confidence + validity into release behavior,
4. emits auditable confidence traces.

**System design**

**A. Runtime responsibilities**

The Confidence Execution Layer (CEL) sits after pass artifacts exist but before final output is released.

**Inputs**

* input scale metadata
* coverage metadata
* Pass 1 artifacts
* Pass 2 artifacts
* Pass 3 artifacts
* finalizer / validator findings
* contradiction findings
* acceptance decisions (if any)

**Outputs**

* criterion confidence
* aggregate confidence
* confidence band
* confidence factors / reasons
* release decision (ALLOW, ALLOW\_WITH\_ACCEPTANCE, BLOCK)
* audit trace

**B. Core rule**

Confidence is **derived**, never hand-assigned.

**Forbidden**

confidence = 85;

**Required**

confidence = deriveConfidence(context);

**C. Confidence derivation model**

**1. Base cap from input scale**

export type InputScale =

| 'PARAGRAPH'

| 'SCENE'

| 'CHAPTER'

| 'MULTI\_CHAPTER'

| 'FULL\_MANUSCRIPT';

export const MAX\_CONFIDENCE\_BY\_SCALE: Record<InputScale, number> = {

PARAGRAPH: 40,

SCENE: 65,

CHAPTER: 75,

MULTI\_CHAPTER: 85,

FULL\_MANUSCRIPT: 95,

};

This comes directly from the carry-forward canon and must remain binding.

**2. Confidence factors**

Confidence is reduced by structural risk. Start at scale cap and apply penalties.

**Penalty classes**

* partial coverage
* insufficiently scorable criteria
* incomplete criteria
* contradiction without differentiation
* pass disagreement
* missing score with reasoning/evidence present
* governance gate failure
* independence violation
* scope-limited evaluation

**Example penalty model**

export type ConfidencePenaltyCode =

| 'PARTIAL\_COVERAGE'

| 'LOW\_EVALUABILITY'

| 'INCOMPLETE\_CRITERION'

| 'CONTRADICTION'

| 'PASS\_DIVERGENCE'

| 'MISSING\_SCORE'

| 'GATE\_FAILURE'

| 'INDEPENDENCE\_VIOLATION'

| 'SCOPE\_LIMITED';

export const CONFIDENCE\_PENALTIES: Record<ConfidencePenaltyCode, number> = {

PARTIAL\_COVERAGE: 20,

LOW\_EVALUABILITY: 12,

INCOMPLETE\_CRITERION: 8,

CONTRADICTION: 10,

PASS\_DIVERGENCE: 6,

MISSING\_SCORE: 15,

GATE\_FAILURE: 20,

INDEPENDENCE\_VIOLATION: 10,

SCOPE\_LIMITED: 8,

};

These exact numbers can be tuned later, but the mechanism should be fixed now.

**D. Derived context model**

export type ConfidenceBand = 'LOW' | 'MEDIUM' | 'HIGH';

export type ConfidenceFactor = {

code: ConfidencePenaltyCode;

penalty: number;

reason: string;

source:

| 'INPUT'

| 'PASS1'

| 'PASS2'

| 'PASS3'

| 'FINALIZER'

| 'GATE15\_1'

| 'GATE15\_2';

};

export type ConfidenceContext = {

inputScale: InputScale;

fullCoverage: boolean;

partialCoverage: boolean;

scorableCriteriaCount: number;

totalCriteriaCount: number;

incompleteCriteria: string[];

contradictionCount: number;

passDivergenceCount: number;

independenceViolationCount: number;

missingScoreCriteria: string[];

gateFailures: string[];

scopeLimited: boolean;

};

export type ConfidenceResult = {

score: number;

band: ConfidenceBand;

cap: number;

factors: ConfidenceFactor[];

formulaVersion: string;

};

**E. Confidence derivation function**

export function deriveConfidence(ctx: ConfidenceContext): ConfidenceResult {

const cap = MAX\_CONFIDENCE\_BY\_SCALE[ctx.inputScale];

const factors: ConfidenceFactor[] = [];

if (ctx.partialCoverage) {

factors.push({

code: 'PARTIAL\_COVERAGE',

penalty: CONFIDENCE\_PENALTIES.PARTIAL\_COVERAGE,

reason: 'Input was not fully covered; canon requires confidence cap reduction.',

source: 'INPUT',

});

}

if (ctx.scopeLimited) {

factors.push({

code: 'SCOPE\_LIMITED',

penalty: CONFIDENCE\_PENALTIES.SCOPE\_LIMITED,

reason: 'Submission scope constrains scoreability surface.',

source: 'INPUT',

});

}

if (ctx.scorableCriteriaCount < 8) {

factors.push({

code: 'LOW\_EVALUABILITY',

penalty: CONFIDENCE\_PENALTIES.LOW\_EVALUABILITY,

reason: 'Too few scorable criteria to support high-confidence aggregate scoring.',

source: 'FINALIZER',

});

}

for (const criterion of ctx.incompleteCriteria) {

factors.push({

code: 'INCOMPLETE\_CRITERION',

penalty: CONFIDENCE\_PENALTIES.INCOMPLETE\_CRITERION,

reason: `Criterion incomplete: ${criterion}`,

source: 'FINALIZER',

});

}

for (const criterion of ctx.missingScoreCriteria) {

factors.push({

code: 'MISSING\_SCORE',

penalty: CONFIDENCE\_PENALTIES.MISSING\_SCORE,

reason: `Criterion missing score despite other evaluative output: ${criterion}`,

source: 'FINALIZER',

});

}

for (let i = 0; i < ctx.contradictionCount; i++) {

factors.push({

code: 'CONTRADICTION',

penalty: CONFIDENCE\_PENALTIES.CONTRADICTION,

reason: 'Contradictory framing detected without adequate differentiation.',

source: 'GATE15\_2',

});

}

for (let i = 0; i < ctx.passDivergenceCount; i++) {

factors.push({

code: 'PASS\_DIVERGENCE',

penalty: CONFIDENCE\_PENALTIES.PASS\_DIVERGENCE,

reason: 'Material pass divergence remains unresolved.',

source: 'PASS3',

});

}

for (let i = 0; i < ctx.independenceViolationCount; i++) {

factors.push({

code: 'INDEPENDENCE\_VIOLATION',

penalty: CONFIDENCE\_PENALTIES.INDEPENDENCE\_VIOLATION,

reason: 'Independent pass reused non-independent rationale or wording.',

source: 'PASS2',

});

}

for (const gate of ctx.gateFailures) {

factors.push({

code: 'GATE\_FAILURE',

penalty: CONFIDENCE\_PENALTIES.GATE\_FAILURE,

reason: `Governance gate failed: ${gate}`,

source: gate.includes('15.2') ? 'GATE15\_2' : 'GATE15\_1',

});

}

const totalPenalty = factors.reduce((sum, f) => sum + f.penalty, 0);

const score = Math.max(0, Math.min(cap, cap - totalPenalty));

const band: ConfidenceBand =

score >= 80 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';

return {

score,

band,

cap,

factors,

formulaVersion: 'cel-v1',

};

}

**F. Criterion-level confidence**

Aggregate confidence is not enough. Each criterion needs its own confidence result.

**Why**

A run may be strong overall while one criterion is weak, scope-limited, or invalid.

**Criterion confidence context**

export type CriterionConfidenceContext = {

criterion: string;

scorable: boolean;

sufficientSignal: boolean;

hasEvidence: boolean;

hasReasoning: boolean;

hasScore: boolean;

contradictionDetected: boolean;

scopeLimited: boolean;

inputScale: InputScale;

};

**Rule**

* Criterion confidence can never exceed aggregate confidence.
* A criterion with no score cannot claim HIGH confidence.
* A criterion with insufficient signal cannot emit substantive recommendations.

**G. Propagation rules**

This is the part currently missing in most implementations.

**Rule 1 — Upstream weakness propagates forward**

If Pass 1 or Pass 2 marks a criterion incomplete, Pass 3 must either:

* explicitly compensate with stronger manuscript-grounded evidence, or
* carry forward reduced confidence.

**Rule 2 — Final confidence must reflect unresolved pass divergence**

If Pass 1 and Pass 2 materially disagree and Pass 3 does not visibly arbitrate that disagreement, confidence must drop.

**Rule 3 — Invalid criterion prevents false certainty**

A criterion missing score, evidence, or reasoning cannot be hidden inside a normal-looking report.

**H. Release decision layer**

Confidence must feed release control.

export type ReleaseDecision =

| 'ALLOW'

| 'ALLOW\_WITH\_ACCEPTANCE'

| 'BLOCK';

export type ReleaseDecisionContext = {

evaluationStatus: 'VALID' | 'INVALID' | 'DISPUTED';

confidence: ConfidenceResult;

acceptanceRecorded: boolean;

readinessCritical: boolean;

};

export function deriveReleaseDecision(

ctx: ReleaseDecisionContext,

): ReleaseDecision {

if (ctx.evaluationStatus === 'INVALID') return 'BLOCK';

if (ctx.readinessCritical && ctx.confidence.score < 95) {

return ctx.acceptanceRecorded ? 'ALLOW\_WITH\_ACCEPTANCE' : 'BLOCK';

}

if (ctx.confidence.band === 'LOW') {

return ctx.acceptanceRecorded ? 'ALLOW\_WITH\_ACCEPTANCE' : 'BLOCK';

}

return 'ALLOW';

}

This is directly aligned with your Phase 1 requirement:

* below-threshold output is blocked without acceptance,
* release gate cannot be bypassed.

**I. AcceptanceDecision wiring**

The existing AcceptanceDecision doctrine should be wired here, not treated as a separate concern.

export type AcceptanceDecision = {

manuscriptVersionId: string;

claimIds: string[];

confidenceScoreAtDecision: number;

decision: 'ACCEPT' | 'REJECT';

timestamp: string;

immutable: true;

};

**Rule**

If ALLOW\_WITH\_ACCEPTANCE is returned, the system must require a persisted immutable AcceptanceDecision before output can proceed.

**J. Audit output**

Confidence must be fully auditable.

export type ConfidenceAuditRecord = {

eventId: string;

requestId: string;

formulaVersion: string;

inputScale: InputScale;

confidenceCap: number;

derivedConfidence: number;

band: ConfidenceBand;

factors: ConfidenceFactor[];

evaluationStatus: 'VALID' | 'INVALID' | 'DISPUTED';

releaseDecision: ReleaseDecision;

acceptanceDecisionId?: string;

timestamp: string;

};

**Required behavior**

Audit must show:

* why confidence was reduced,
* which stage generated the penalty,
* whether release was blocked or conditionally allowed,
* whether acceptance was recorded.

**K. Minimal repo file plan**

Here is the exact layer to add.

**1. lib/confidence/types.ts**

Shared confidence types.

**2. lib/confidence/constants.ts**

Input caps, penalties, thresholds, formula version.

**3. lib/confidence/deriveConfidence.ts**

Aggregate confidence derivation.

**4. lib/confidence/deriveCriterionConfidence.ts**

Per-criterion confidence.

**5. lib/confidence/deriveReleaseDecision.ts**

Gate behavior from confidence + validity + acceptance.

**6. lib/confidence/buildConfidenceAudit.ts**

Audit record builder.

**7. lib/evaluation/finalizer.ts**

Wire confidence derivation after validation.

**8. lib/evaluation/validate.ts**

Expose structured invalid reasons for confidence penalties.

**9. app/api/jobs/[id]/status/route.ts**

Expose confidence score, band, factors, release decision.

**10. components/EvaluationProgress.tsx**

Show confidence state and invalid reasons in UI.

**L. Runtime wiring sequence**

1. Run Pass 1.
2. Run Pass 2.
3. Run Pass 3.
4. Validate criteria completeness and canonical integrity.
5. Detect contradictions / divergence.
6. Build ConfidenceContext.
7. Derive aggregate confidence.
8. Derive criterion-level confidence.
9. Derive release decision.
10. Emit confidence audit record.
11. Block / allow / conditionally allow.

**M. Example result for the broken N/A case**

**Situation**

* Input scale: CHAPTER
* cap = 75
* one criterion missing numeric score
* criterion had evidence and reasoning
* evaluation therefore invalid

**Result**

* confidence reduced by MISSING\_SCORE
* evaluation status = INVALID
* release decision = BLOCK
* no normal composite output should be shown

This is the operational behavior your canon already implies.

**N. Phase 1 exit criteria alignment**

This layer directly satisfies your existing Phase 1 targets:

**Confidence engine implemented (deterministic)**

Yes — derivation is deterministic and versioned.

**AcceptanceDecision entity live**

Yes — wired into release path.

**Release gate enforcement active**

Yes — BLOCK / ALLOW\_WITH\_ACCEPTANCE / ALLOW.

**Audit trail emitting structured records**

Yes — confidence audit record defined.

**Gold-set infrastructure wired**

Compatible — confidence audit can be checked against calibration later.

**O. What not to do**

Do not:

* invent a second confidence theory,
* hand-assign confidence numbers,
* allow invalid evaluations to look normal,
* allow Pass 3 to erase pass divergence silently,
* let confidence exist without audit trace.

**P. Immediate next implementation step**

Implement the five core files first:

1. lib/confidence/types.ts
2. lib/confidence/constants.ts
3. lib/confidence/deriveConfidence.ts
4. lib/confidence/deriveReleaseDecision.ts
5. lib/confidence/buildConfidenceAudit.ts

Then wire them into the finalizer.

That is the shortest path from “confidence canon exists” to “confidence governs the system.”

**VOLUME V — EXECUTION ARCHITECTURE & INDUSTRY INTERFACE CANON**

**APPENDIX — RUNTIME STATE SYNCHRONIZATION LAW**

**V.RS1 — Single State Model**

All components MUST operate on the same canonical state model:

* routes
* workers
* pipelines
* gates

**V.RS2 — Atomic Phase Boundary**

Phase completion MUST be written atomically.

No intermediate observable state may exist where:

* completion evidence is present
* but phase is still marked running

**V.RS3 — Async Execution Constraint**

Async triggers (API routes):

* MUST NOT perform long-running work inline
* MUST return immediately (202)
* MUST NOT mutate canonical completion state

**V.RS4 — Lease & Heartbeat Consistency**

Lease expiration MUST NOT leave system in:

* running state with no worker
* completed work without completion state

**V.RS5 — Worker Termination Contract**

Workers MUST:

* finalize state explicitly on exit
* never leave partial terminal signals
