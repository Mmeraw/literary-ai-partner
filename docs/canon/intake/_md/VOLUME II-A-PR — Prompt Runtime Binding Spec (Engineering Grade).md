**VOLUME II-A-PR — Prompt Runtime Binding Spec (Engineering Grade)**

**Executable system specification for the RevisionGrade evaluation pipeline.**
This is not guidance. This is binding architecture.

**SECTION 0: SYSTEM AUTHORITY MODEL (ABCDEFG)**

This section defines who holds authority at each stage of the evaluation lifecycle. Everything else depends on it. Without this, the system is an AI scoring tool. With it, the system is a governed evaluation engine with authority transfer.

**ABC — Author / Benchmark / Calibration**

ABC represents the **pre-submission domain controlled by the author**. It consists of three components:

* **A — Authorial Intent.** The thematic, narrative, and philosophical purpose of the work as defined by the author.
* **B — Benchmark.** The author's attempt to measure the work against perceived market standards, comparable titles, or internal expectations.
* **C — Calibration.** Iterative revision performed by the author to align the manuscript with intended quality or benchmark targets.

ABC is inherently subjective and bias-prone. No evaluation generated within ABC is considered authoritative within the RevisionGrade system.

**D — Market Demarcation**

D represents the **boundary between subjective authorship and objective evaluation**. Upon submission, the manuscript is transformed into an artifact. Authorial intent is no longer privileged, and all subsequent evaluation is conducted against market-aligned criteria. This transformation is irreversible within a given evaluation cycle. All evaluation downstream of D must treat the manuscript as a standalone artifact, independent of author explanation or intent.

**EFG — Excellence / Filtering / Gating**

EFG represents the **evaluation engine** and governs all post-demarcation analysis.

* **E — Evaluate.** Independent analysis of the artifact across the 13 Story Criteria. Implemented through Pass 1 (structural) and Pass 2 (editorial).
* **F — Filter.** Synthesis and reconciliation of evaluation outputs through Pass 3 (convergence). Conflicts are surfaced, not smoothed.
* **G — Gate.** Final validation through the Finalizer. Determines whether the evaluation meets canonical standards for acceptance.

**Authority Transition Model**

| **Stage** | **Authority** |
| --- | --- |
| Before D | Author (ABC) |
| After D | System (EFG) |

The system does not interpret intent — it evaluates execution.

**Core Principles**

1. Intent is not evidence.
2. Evaluation is artifact-based, not author-based.
3. All outputs must be evidence-backed and traceable.
4. The system enforces standards — it does not assist or encourage.
5. Failure to meet standards results in rejection, not reinterpretation.

**Why this matters:**Without ABCDEFG, the system evaluates based on author intent, which is subjective and non-verifiable.
With ABCDEFG, evaluation becomes artifact-based, traceable, and enforceable.

**SECTION 1: PURPOSE**

This document defines the binding contract between:

* **Volume II Canon** (evaluation doctrine)
* **Evaluator Prompts** (Pass 1, Pass 2, Pass 3)
* **Code Validators** (EG enforcement)
* **Finalizer** (deterministic gate)

This is an executable specification governing how doctrine becomes enforceable evaluation.

**SECTION 2: SYSTEM PRINCIPLE (LOCKED)**

**Dual-Layer Authority Model**

| **Layer** | **Role** |
| --- | --- |
| **Prompt Layer** | Teaches the AI how to evaluate (behavior) |
| **Code Layer** | Enforces whether the output is valid (truth) |

**Non-negotiable rule:** No canonical artifact may rely on prompt compliance alone. AI can sound correct while being wrong. The code layer decides whether the output lives or dies.

I f the code layer did not exist, the system would produce convincing but unverifiable evaluations, making it indistinguishable from opinion.

**SECTION 3: PIPELINE OVERVIEW**

text

SUBMIT → PASS 1 → PASS 2 → PASS 3 → FINALIZER → VALID / INVALID / DISPUTED

| **Step** | **Function** |
| --- | --- |
| **Pass 1** | Structural Detection — finds what is happening. Pure mechanics, no interpretation. |
| **Pass 2** | Editorial Interpretation — decides what it means. Filters false positives. |
| **Pass 3** | Convergence — resolves disagreements. Does NOT smooth conflict — exposes it. |
| **Finalizer** | Accepts or rejects output. No AI allowed here. Code-only validation. |

Why this structure exists:
Each pass isolates a different type of error. Combining them would cause signal contamination, where interpretation overrides detection or vice versa.

**SECTION 4: PROMPT ARCHITECTURE**

**4.1 — Static System Prompt (always loaded)**

Contains:

* ABCDEFG authority identity (compressed, ~300–350 tokens max — identity and authority model only, not the full document)
* Evaluation philosophy
* Canonical output schema
* EG awareness (awareness only — enforcement happens in code)
* Stage-specific evaluator identity

Static prompts must remain concise and stable.

**Never included in static prompt:**

* Full detection specs
* Full diagnostic systems

**4.2 — Dynamic Injection (loaded per pass)**

For each criterion (max ~80 tokens per criterion):

* Definition (1 line)
* Observable Signals (bullet list)
* Failure Modes
* False Positive Filters
* Scoring Anchors (3/5/7/9 compressed)
* Score Cap Rules

Diagnostics are injected **only** if referenced by criterion dependencies. Detection specs are injected selectively to avoid prompt overload.

**SECTION 5: PASS DIFFERENTIATION**

**Pass 1 — Structural Detection**

* Emphasize observable signals, failure modes, score caps, and structural thresholds
* De-emphasize literary interpretation
* Pass 1 should answer: **what failed, where, and by what mechanism**
* Detect signals → Apply score caps → Output evidence-based scoring

**Why interpretation is prohibited:**
Interpretation introduces bias before structural truth is established. Pass 1 must remain mechanical to prevent false positives from entering the system.

**Pass 2 — Editorial Interpretation**

* Emphasize false positives, tonal nuance, literary authority, and interpretive discipline
* Pass 2 should answer: **what the structural findings mean aesthetically, and whether apparent weaknesses are genuine or false positives**
* Detect false positives → Apply literary judgment

**Pass 3 — Convergence**

* Receives Pass 1 and Pass 2 outputs
* Reconciles disagreement using shared evidence, scoring anchors, and cap rules
* **Must surface conflict rather than smooth it**
* Apply scoring anchors → Resolve or flag DISPUTED

**Finalizer — Deterministic Validation Only**

* Not an evaluator
* Cannot reinterpret, infer, repair, or smooth
* May only validate or reject based on validity state, EG compliance, and completeness
* **No LLM. Code-only.**

**SECTION 6: SCORE LOGIC**

**Prompt Layer uses:**

* Scoring bands (3, 5, 7, 9)
* Observable signals
* Scoring anchors
* False-positive filters
* Criterion definitions

**Code Layer enforces:**

* Score caps
* Completeness
* Evidence validation
* Invalidation rules

**Critical Rule**

**Scores must be derived from the lowest satisfied band. Upward justification is prohibited.** Not "this feels like an 8" — scores come from the lowest level where all signals are confirmed.

A score cannot exceed what the evidence supports. If evidence only satisfies band 5, the score cannot be 7 or higher under any condition.

(This is a **core enforcement truth** — must exist)

**SECTION 7: EG VALIDATORS (CODE-ENFORCED)**

These are hard rules. If any fail, the evaluation is **INVALID**.

| **Rule** | **What It Enforces** |
| --- | --- |
| **EG-6: Evidence Required** | Every criterion must include at least one real evidence anchor with valid start/end positions that map to manuscript text. Prevents hallucination. |
| **EG-7: Generic Language Prohibition** | Rationale fields are scanned for banned phrases ("this feels...", "could be stronger...", any claim without mechanism). Forces precision. |
| **EG-8: All Criteria Present** | All 13 criteria must exist. |
| **EG-9: Structural Completeness** | Each criterion must contain score + evidence + reasoning. Presence without structural completeness is invalid. |

Why these exist:
These rules prevent hallucination, vagueness, incompleteness, and structural corruption. Without EG enforcement, the system produces outputs that appear correct but cannot be trusted.

**SECTION 8: VALIDITY STATES**

| **State** | **Meaning** |
| --- | --- |
| **VALID** | All rules satisfied — accepted |
| **INVALID** | Missing evidence, incomplete, or rule violation — rejected |
| **DISPUTED** | Conflicting evaluator outputs, unresolved — no canonical artifact produced |

**SECTION 9: DISPUTED LOGIC (LOCKED)**

**When it triggers:**

If |Pass1Score − Pass2Score| ≥ 3 **AND** no overlapping evidence anchors → **DISPUTED**

**What happens:**

* No canonical artifact is produced
* Conflict is surfaced, not resolved
* DISPUTED evaluations cannot produce canonical artifacts and must be returned with conflict exposed

**What does NOT trigger DISPUTED:**

* Stylistic variation
* Tone differences
* Subjective preference

Why DISPUTED exists:
When two valid evaluators disagree without shared evidence, forcing a resolution would introduce false certainty. DISPUTED preserves truth by exposing conflict rather than hiding it.

**SECTION 10: FINALIZER CONTRACT**

text

function finalizeEvaluation():

if fails(EG-6): return INVALID

if fails(EG-7): return INVALID

if fails(EG-8): return INVALID

if fails(EG-9): return INVALID

if disputed: return DISPUTED

return VALID

This is the enforcement core. It removes all interpretation. The Finalizer does not think — it checks.

Why this must be code-only:
If the Finalizer used AI, it could reinterpret invalid outputs as valid, breaking the enforcement boundary. The Finalizer must remain deterministic to preserve system integrity.

**SECTION 11: TOKEN STRATEGY**

| **Concern** | **Strategy** |
| --- | --- |
| **Why it matters** | Too much input causes AI quality to degrade |
| **Pass 1 & 2** | ~5,000 tokens total budget (system prompt ~500, dynamic injection ~1,400, user input ~3,000) |
| **Pass 3** | Reduced injection, ~2,500–3,500 tokens |
| **Injection rule** | Only inject criterion-relevant diagnostics per pass — avoid full-canon monolith prompts |
| **Model recommendation** | Pass 1 & 2: gpt-4o preferred, 4o-mini acceptable with tight compression. Pass 3: gpt-4o required for convergence quality. |

Core constraint:
As prompt size increases, model reasoning quality decreases. Precision is achieved through selective injection, not completeness.

**SECTION 12: CRITERION ROUTING MATRIX**

This defines which diagnostic systems are injected alongside each criterion:

| **Criterion** | **Diagnostic Systems** |
| --- | --- |
| Narrative Drive | Pressure Graph, Escalation Ladder, Compulsion Model |
| Character | DAM (Differentiated Authority Model), Internalization Model |
| Dialogue | DAM, Authority Leak |
| Prose | Breath Timing, Authority Compression |
| Tone | Tonal Integrity Model |
| Scene | Scene Function Model |
| Pacing | Escalation Ladder, Rhythm Model |

**SECTION 13: CRITERION TEMPLATE (MANDATORY)**

Every criterion in the system must contain:

1. **Definition** — what the criterion measures
2. **Observable Signals** — what a reader or evaluator can detect
3. **Failure Modes** — what breakdown looks like
4. **False Positives** — what looks like success but isn't
5. **Scoring Anchors** — what scores 3, 5, 7, and 9 look like concretely
6. **Score Caps** — hard limits (e.g., "if X is missing, score cannot exceed Y")
7. **System Dependencies** — which diagnostic systems inform this criterion
8. **Detection Hooks** — what the evaluator looks for in the text

**SECTION 14: CRITERION DETECTION SPECS (7 OF 13)**

*Note: POV/Voice exists in Volume II. Narrative Drive, Character Depth, and Scene Construction were previously defined. The following 7 complete the set.*

**14.1 — Concept / Core Premise**

**Weight: 0.10 (foundational)**

**What it measures:** Whether the central narrative proposition generates inherent tension, sustains a full-length work, and differentiates itself within its market category. Not "is this a good idea" — rather, does the premise contain an engine that produces conflict, escalation, and consequence without external forcing.

**Observable Signals:**

* Central dramatic question identifiable within the first 10% of the manuscript
* Premise creates structural inevitability — characters placed in conditions where conflict is unavoidable
* Concept produces multiple valid story directions, not a single-track plot
* Premise contains an inherent contradiction or tension, not just a situation
* Comparable titles exist but the angle of approach is distinguishable

**Failure Modes:**

* Premise requires extensive setup before it generates tension (delayed engine)
* Concept is a situation, not a conflict — characters exist in interesting conditions but nothing forces change
* Central question can be answered simply — no sustained ambiguity
* Premise depends on character stupidity or information withholding to function
* Derivative without transformation — recognizable source without new angle

**False Positives:**

* High-concept hook ≠ narrative premise (a marketable logline may not sustain 100K words)
* Interesting world ≠ concept (setting is not premise)
* Topical subject matter ≠ inherent tension (relevance is not narrative propulsion)

**System Dependencies:** Narrative Escalation Ladder, Story Failure Map (Zone 1: Concept Instability), Professional Manuscript Read Test (Page 1 authority check)

**Scoring Anchors:**

* **Score 3:** Central question unclear or absent by end of chapter 3; premise requires external forcing to generate conflict
* **Score 5:** Premise identifiable but generates only one axis of tension; escalation requires plot injection rather than emerging from concept
* **Score 7:** Premise sustains multiple tension axes and produces organic escalation; minor dependency on convenience or coincidence
* **Score 9:** Premise generates inevitable, multi-axis conflict; every major character structurally positioned in opposition; concept alone produces escalation without authorial intervention

**Score Cap:** If the central dramatic question is not identifiable within the first three chapters, Concept cannot exceed 5.

**14.2 — Dialogue / Authenticity & Subtext**

**Weight: 0.06**

**What it measures:** Whether dialogue performs narrative work beyond information delivery. Dialogue must reveal power dynamics, character psychology, and unstated tension. It must sound like it belongs to the specific character speaking in the specific situation they occupy.

**Observable Signals:**

* Characters identifiable by speech patterns without attribution tags
* Information asymmetry present — characters know different things and speech reflects it
* Subtext layer present — what characters say diverges from what they mean
* Power dynamics shift within conversations, not just between them
* Dialogue advances plot, character understanding, or threat perception
* Attribution minimal — physical action replaces said-bookisms

**Failure Modes:**

* Lecture cadence — one character explains while another asks enabling questions
* Voice flattening — all characters speak with equivalent vocabulary, rhythm, and register
* Exposition delivery — dialogue exists to inform the reader, not perform character work
* On-the-nose dialogue — characters state feelings, motivations, or thematic points directly
* Ping-pong dialogue — alternating lines of equal length with no power asymmetry

**False Positives:**

* Witty dialogue ≠ subtext (cleverness without tension is decorative)
* Realistic speech patterns ≠ authenticity (phonetic realism often reduces readability)
* Conflict in dialogue ≠ subtext (arguing openly is surface tension)

**System Dependencies:** DAM (Differentiated Authority Model), Authority Leak Detection, Character Depth

**Scoring Anchors:**

* **Score 3:** Characters interchangeable in speech; dialogue primarily delivers information; no subtext layer
* **Score 5:** Some voice differentiation; subtext in key scenes but absent in transitions; occasional lecture cadence
* **Score 7:** Strong voice differentiation; subtext operational in most scenes; power dynamics visible; minor exposition delivery
* **Score 9:** Every conversation performs multiple functions simultaneously; characters identifiable by speech alone; subtext drives scenes more than surface content; silence carries equal weight to speech

**14.3 — Thematic Integration**

**Weight: 0.07**

**What it measures:** Whether the work's thematic architecture operates through dramatization rather than declaration. Themes must be embedded in character decisions, consequences, imagery, and structural patterns — not stated by characters or narrator.

**Observable Signals:**

* Thematic concerns expressed through character behavior under pressure, not reflection
* Recurring motifs accumulate meaning without being explained
* Characters on different sides of the thematic question make defensible choices — the work doesn't stack the deck
* Central thematic proposition is complicated, not confirmed, by the ending
* Theme emerges from collision of plot and character, not from narration

**Failure Modes:**

* Thesis sentences — narrator or character states the meaning of events
* Stacked deck — all narrative evidence supports one thematic conclusion
* Thematic orphans — motifs appear once without accumulation or payoff

**14.3 — Thematic Integration (continued)**

**Weight: 0.07**

* Thematic separation — the meaningful parts of the story are segregated from the plot (reflective passages between action sequences)
* Symbolism over function — objects or events exist primarily for symbolic value rather than narrative necessity

**False Positives:**

* "The story is about something" ≠ thematic integration (having a subject is not the same as embedding a thematic argument through dramatization)
* Recurring imagery ≠ integration if the imagery is ornamental rather than functionally tied to character experience
* Character reflects on meaning — this is often a failure signal, not a success signal

**System Dependencies:** Authority Leak Detection (thesis sentences are authority leaks), Narrative Physics Doctrine (theme must emerge from consequence, not commentary), Late-Stage Authority Compression (interpretive echoes are compression targets)

**Scoring Anchors:**

* **Score 3:** Theme stated by narrator or character; no thematic work performed through action or consequence
* **Score 5:** Theme identifiable through events but also stated directly; imagery present but not accumulative; mild deck-stacking
* **Score 7:** Theme primarily dramatized; minimal direct statement; motifs accumulate; thematic counter-arguments present but underdeveloped
* **Score 9:** Theme fully embedded in action and consequence; no thesis sentences; motifs gain meaning through structural position; the ending complicates rather than confirms

**Score Cap:** If any character directly states the thematic point of the work, Theme cannot exceed 6.

**14.4 — World-Building / Environmental Logic**

**Weight: 0.08**

**What it measures:** Whether the physical, social, and institutional environment of the story operates under consistent internal rules that the reader can learn and predict from. Not about the volume of detail — about the coherence of the system.

**Observable Signals:**

* Characters interact with their environment as a constraint — it limits options, forces decisions
* Social hierarchies, institutional rules, and power structures behave consistently
* Physical geography influences plot logistics — distances, access, visibility matter
* The world contains details the author doesn't explain — evidence that the system extends beyond what's shown
* Environment produces consequences — weather delays, institutional failures, resource scarcity

**Failure Modes:**

* Convenience geography — distances, access, and timing adjust to serve the plot
* Institutional inconsistency — rules or systems behave differently in different scenes without explanation
* Tourism writing — world details are delivered as description rather than encountered through character action
* Static environment — the world does not react to character decisions or story events
* Research dump — specialized knowledge delivered in blocks rather than integrated into character experience

**False Positives:**

* Detailed description ≠ world-building (volume of environmental detail may signal prose bloat, not environmental logic)
* Exotic setting ≠ world-building (unusual locations are not inherently more coherent than familiar ones)
* Accurate real-world detail ≠ internal logic (factual accuracy and narrative coherence are separate qualities)

**System Dependencies:** Scene Entry Doctrine (environmental description vs. action-anchored entry), Environmental Echo Chain detection, Atmospheric Authority Diagnostic (Layer 1 vs. Layer 2), Object Anchoring Principle

**Scoring Anchors:**

* **Score 3:** Environment functions as backdrop; geography or institutions adjust for plot convenience; no constraint-based interaction
* **Score 5:** Environment mostly consistent but characters rarely interact with it as a constraint; some tourism writing; world doesn't react to events
* **Score 7:** Environment operates as a system; characters navigate constraints; minor convenience issues; institutional logic mostly holds
* **Score 9:** World functions as a character — it constrains, enables, and reacts; all institutional and physical rules hold under examination; details imply a system larger than what's shown

**14.5 — Pacing / Structural Balance**

**Weight: 0.09 (structural)**

**What it measures:** The rhythm of tension and release across the full manuscript, and whether the structural proportions (act balance, scene density, escalation timing) produce sustained engagement rather than fatigue or drift.

**Observable Signals:**

* Tension and release alternate — no extended sequences of unrelieved pressure or unrelieved calm
* Act proportions are functional — the middle doesn't sag and the ending doesn't rush
* Scene length varies purposefully — compression during high-stakes sequences, expansion during orientation or emotional processing
* The reader's cognitive load is managed — information delivery is spaced, not clustered
* Recovery scenes exist but perform work — character deepening, setup, foreshadowing — rather than simply pausing

**Failure Modes:**

* Mid-novel stagnation — the Escalation Ladder plateaus at Level 2–3 for extended stretches
* Front-loading — strongest material concentrated in Act I, diminishing returns thereafter
* Rushed ending — compression in final 15% indicates insufficient structural planning
* Uniform scene density — all scenes approximately the same length and intensity regardless of narrative function
* Breathless pacing — no recovery moments; the narrative runs hot continuously, producing fatigue instead of engagement

**False Positives:**

* Fast-paced ≠ well-paced (relentless forward motion without variation produces flatness, not momentum)
* Short chapters ≠ good pacing (chapter breaks are a surface feature; pacing is a pressure feature)
* Lots of events ≠ structural balance (event density can mask structural drift)

**System Dependencies:** Narrative Pressure Graph (pressure pattern analysis), Breath Timing system (sentence variance, cadence shifts), Escalation Ladder (progressive stake increases), Reader Compulsion Model (compulsion density)

**Scoring Anchors:**

* **Score 3:** Narrative pressure flatlines for 3+ consecutive chapters; no identifiable tension/release rhythm; act proportions severely imbalanced
* **Score 5:** Pressure pattern recognizable but includes significant plateaus; some structural imbalance (sagging middle or rushed ending); scene density largely uniform
* **Score 7:** Pressure increases overall with functional variation; act proportions work; minor pacing issues (one recovery scene too long, one transition too fast)
* **Score 9:** Pressure graph shows clear, purposeful architecture; scene length and density serve function; tension/release rhythm sustains engagement; structural proportions feel inevitable

**Score Cap:** If the Narrative Pressure Graph shows a plateau of 4+ consecutive chapters with no measurable pressure increase, Pacing cannot exceed 5.

**14.6 — Prose Control / Line-Level Craft**

**Weight: 0.06**

**What it measures:** Whether every sentence is intentional — precise in word choice, purposeful in rhythm, and free from mechanical artifacts that reduce narrative authority. This is not about beautiful writing but about control.

**Observable Signals:**

* Sentence length varies with narrative function — short for impact, long for immersion, medium for transit
* Word choice is specific rather than approximate — the precise noun, not the adjective-propped general noun
* No unmotivated repetition — repeated words or structures serve emphasis, not inattention
* Filtering language is absent or minimal — "he saw," "she felt," "he noticed" removed in close POV
* Paragraph architecture creates white space that functions as pacing

**Failure Modes:**

* Mechanical repetition — same sentence structures in sequence without rhythmic purpose
* Adjective dependency — prose relies on modifiers instead of precise nouns and verbs
* Filter words in close POV — "he realized," "she noticed," "he could see"
* Dangling modifiers, misplaced clauses, unclear antecedents
* Overwriting — prose calls attention to itself rather than to the story
* Purple prose — ornamental language that prioritizes sound over meaning

**False Positives:**

* Lyrical writing ≠ prose control (ornamental prose often signals reduced control, not increased control)
* Simple prose ≠ weak prose (stripped, precise prose is often the highest form of control)
* Long sentences ≠ complexity (syntactic complexity without clarity is a failure)
* Absence of errors ≠ craft (mechanically clean prose can still lack authority)

**System Dependencies:** Authority Leak Detection (confirmation sentences, thesis statements), Breath Timing system (sentence variance as a prose signal), Authority Compression (redundant explanation detection), Atmospheric Repetition Indicator

**Scoring Anchors:**

* **Score 3:** Sentence rhythm uniform; word choice approximate; filter words frequent; mechanical repetition present across paragraphs
* **Score 5:** Some rhythmic variation; word choice mostly adequate with occasional precision; filter words reduced but present; minor mechanical issues
* **Score 7:** Clear rhythmic control; word choice specific; filter words rare; paragraph architecture intentional; minor overwriting in 1–2 passages
* **Score 9:** Every sentence performs work; rhythm serves function; word choice precise throughout; white space and paragraph architecture contribute to pacing; prose is invisible — it serves the story without calling attention to itself

**14.7 — Tonal Authority / Consistency**

**Weight: 0.06**

**What it measures:** Whether the work sustains a coherent emotional and aesthetic register appropriate to its genre, stakes, and audience — and whether deviations from that register are intentional shifts or control failures.

**Observable Signals:**

* Tone identifiable within the first page and sustained across the manuscript
* Tonal shifts correspond to narrative events — escalation darkens tone, revelation creates dissonance — rather than appearing randomly
* Register consistency within POV — characters don't shift between formal and colloquial without motivation
* The relationship between humor and gravity (if both exist) is managed — neither undercuts the other unintentionally
* Genre-appropriate tone — literary suspense reads differently from literary comedy, and the work knows which it is

**Failure Modes:**

* Tonal whiplash — sudden, unmotivated shifts between registers (serious scene followed by jokey narration)
* Tonal flattening — the same emotional register maintained regardless of stakes; everything at the same temperature
* Tonal uncertainty — the manuscript reads as though the author isn't sure whether they're writing literary fiction, thriller, or commercial fiction
* Performative gravitas — the prose reaches for weight or seriousness the story hasn't earned
* Inadvertent comedy — phrasing or imagery creates unintended humor in serious moments

**False Positives:**

* Consistent voice ≠ tonal authority (a flat, unchanging tone is consistent but not authoritative)
* Dark subject matter ≠ tonal authority (darkness is a subject, not a register)
* Elevated language ≠ tonal authority (formal prose can lack authority just as easily as informal prose)

**System Dependencies:** DAM (voice differentiation across POVs), Authority Leak Detection (performative gravitas often manifests as authority leaks), Breath Timing (tonal shifts often correlate with rhythm shifts)

**Scoring Anchors:**

* **Score 3:** Tone unidentifiable or inconsistent; unmotivated register shifts; genre uncertainty evident
* **Score 5:** Tone identifiable but not sustained; some unmotivated shifts; genre mostly clear but occasional uncertainty
* **Score 7:** Tone sustained across majority of manuscript; shifts correspond to events; genre-appropriate register; minor tonal inconsistencies in 1–2 passages
* **Score 9:** Tone fully authoritative and sustained; every shift intentional and earned; register control precise across all POVs; genre identity unmistakable from the first page

**SECTION 15: PROMPT INJECTION RUNTIME BINDING (DETAILED)**

**Binding Principle**

Prompt layer teaches the evaluator how to think. Code layer decides whether the output is valid enough to live. No canonical artifact may rely on prompt compliance alone.

**Static vs. Dynamic Content Per Pass**

**Static (always loaded, all passes):**

* ABCDEFG authority model
* Evaluation philosophy
* Canonical output schema
* Awareness of EG rules
* Stage-specific evaluator identity

**Dynamic (loaded per pass, selectively):**

* Criterion detection specs (only those relevant to the pass)
* Diagnostic systems (only if referenced by criterion dependencies)
* Work-type or mode-specific inserts
* Score-cap rules
* False-positive filters

**Evidence-Anchor Validation Against Manuscript Offsets**

EG-6 requires that evidence anchors include valid start/end character positions that map to actual manuscript text. The code layer must:

* Verify that char\_start and char\_end fall within the manuscript's character range
* Verify that the text at those positions matches the quoted snippet
* Reject the criterion if positions are invalid or text doesn't match

**Generic-Language and Mechanism Checks**

EG-7 requires scanning all rationale fields for:

* Banned phrases: "this feels...", "this could be stronger...", "this works well but...", any claim without mechanism
* Missing mechanism: all critique must identify a system failure, map to criteria or execution layer, and include causal explanation
* Missing location: claims must include scene/paragraph reference AND mechanism (what failed structurally)

**SECTION 16: DEDUPE REQUIREMENT**

All duplicate doctrine must be replaced with cross-references prior to runtime injection. The same canonical principle must not appear in multiple injected blocks. Each doctrine point has one canonical location; all other references point to it.

**SECTION 17: IMPLEMENTATION MAPPING**

**Target Files**

| **File** | **Purpose** |
| --- | --- |
| pass1-craft.ts | Replace system prompt; build structural dynamic injection |
| pass2-editorial.ts | Parallel architecture with editorial weighting and false-positive emphasis |
| pass3-synthesis.ts | Replace weighted-average verdict logic with evidence-based convergence and DISPUTED handling |
| gates.ts | Implement EG-6, EG-7, EG-8, EG-9 validators |
| config.ts | Host model-selection and token-budget policy |
| canonicalCriteria.ts | Preserve existing locked weight map as immutable |

**Implementation Order**

1. Replace prompt builders (Pass 1, 2, 3)
2. Replace weighted average with convergence logic
3. Add gates.ts and finalizer logic
4. Run Jest tests
5. Tune models/token budgets

**Critical Rules**

* Do not redesign doctrine.
* Do not simplify Finalizer.
* Do not reintroduce weighted averages.
* Do not bypass EG validation.
* Do not change canonical criteria.

**System Boundary**

Prompt layer teaches. Code layer decides whether output is allowed to live.

**SECTION 18: IMPLEMENTATION CHECKLIST**

* Add criterion detection-spec routing matrix by pass
* Define static vs. dynamic prompt content for each evaluator pass
* Implement evidence-anchor validation against manuscript offsets
* Implement generic-language and mechanism checks in gates.ts
* Add DISPUTED threshold logic and canonical rejection behavior
* Preserve canonicalCriteria.ts weights as immutable runtime inputs
* Set model/token policy in config.ts and document upgrade thresholds

**SECTION 19: TESTABILITY REQUIREMENT**

Every criterion must have:

* Known **low-band** test samples (what a score of 3 looks like)
* Known **high-band** test samples (what a score of 9 looks like)
* **Deterministic rejection tests** — engineering must verify that:
  + Prompts produce expected structured outputs
  + Validators reject malformed or unsupported evaluations deterministically
  + Silent failures are impossible

**FINAL TRUTH**

If you remember nothing else from this document, remember this:

**AI suggests. Code decides. Only validated outputs survive.**

*End of VOLUME II-A-PR — Prompt Runtime Binding Spec (Engineering Grade)*
