# VOLUME II-A — OPERATIONAL SCHEMA

Status: CANONICAL — ACTIVE  
Version: 1.0  
Authority: Mike Meraw  
Canon ID: VOL-IIA-OPS-SCHEMA-V10  
Last Updated: 2026-03-20

---

*Machine-Operational Specification for RevisionGrade Evaluation, Routing, Scoring, and Audit Artifacts*

This is implementation infrastructure, not canon.

It translates doctrine into:

• Criterion registry tables\
• Weight models\
• Threshold constants\
• Routing logic\
• JSON evaluation envelopes\
• Persistence schemas\
• Multi-AI orchestration contracts

Think:

Volume II = Constitution\
Volume II-A = Machine Code

**\*\*\***

**Relationship to Volume II Canon:** This document translates the doctrine of Volume II into structured constants, tables, schemas, and routing rules for GitHub, Supabase, Vercel, and governed multi-AI evaluation pipelines. It does not replace Volume II; it operationalizes it.

# 1. Purpose and authority chain

This specification is the executable companion to Volume II --- The 13 Story Criteria Canon. It exists so the platform can score manuscripts consistently, gate refinement correctly, and emit auditable artifacts.

-   **Authority chain:** Volume II Canon → Volume II-A Operational Schema → application code → database artifacts → dashboards / agent-facing surfaces.

# 2. Criterion registry

Every evaluation must contain exactly the 13 canonical criteria below. No additional criteria may be invented at runtime, and no criterion may be omitted.

  -------------------------------------------------------------------------------------------------------------
  ID             Key            Canonical Name                                Domain             Weight
  -------------- -------------- --------------------------------------------- ------------------ --------------
  1              CONCEPT        Concept & Core Premise                        Macro structural   1.20

  2              MOMENTUM       Narrative Drive & Momentum                    Macro structural   1.20

  3              CHARACTER      Character Depth & Psychological Coherence     Macro structural   1.15

  4              POV_VOICE      Point of View & Voice Control                 Bridge             1.10

  5              SCENE          Scene Construction & Function                 Macro structural   1.10

  6              DIALOGUE       Dialogue Authenticity & Subtext               Bridge             1.00

  7              THEME          Thematic Integration                          Macro structural   0.95

  8              WORLD          World-Building & Environmental Logic          Macro structural   0.95

  9              PACING         Pacing & Structural Balance                   Macro structural   1.15

  10             PROSE          Prose Control & Line-Level Craft              Bridge             1.00

  11             TONE           Tonal Authority & Consistency                 Bridge             0.95

  12             CLOSURE        Narrative Closure & Promises Kept             Macro structural   1.05

  13             MARKET         Professional Readiness & Market Positioning   Market             0.90
  -------------------------------------------------------------------------------------------------------------

# 3. Score scale and banding

Each criterion is scored on a 1--10 integer scale. Half-points are disallowed unless a future version bump explicitly authorizes them.

-   1--3 = Foundational weakness

-   4--6 = Developing but inconsistent

-   7--8 = Strong with minor gaps

-   9--10 = Professional-grade execution

# 4. Weight table and composite scoring

Weighted Composite Score (WCS) = SUM(score × weight) ÷ SUM(weights). This score drives readiness states but does not override hard fail conditions.

-   Structural emphasis is intentional: concept, momentum, character, pacing, and closure materially affect eligibility.

-   Bridge criteria (POV/voice, dialogue, prose, tone) influence readiness but do not rescue broken architecture.

-   Market positioning may depress final readiness but may not block structural refinement on its own.

# 5. Eligibility gate constants

  -----------------------------------------------------------------------------------------------------------------------
  Constant                     Value                Meaning
  ---------------------------- -------------------- ---------------------------------------------------------------------
  WAVE_ELIGIBILITY_MIN_WCS     7.0                  Minimum weighted composite score to unlock Volume I WAVE refinement

  STRUCTURAL_FAIL_THRESHOLD    5                    If any structural criterion falls below 5, WAVE is blocked

  AGENT_READY_WCS              8.5                  Composite threshold for strong professional/agent-ready status

  MARKET_REVIEW_TRIGGER        6                    If MARKET criterion \< 6, flag market-path review
  -----------------------------------------------------------------------------------------------------------------------

Structural criteria for fail-fast purposes: CONCEPT, MOMENTUM, CHARACTER, SCENE, PACING, CLOSURE.

# 6. Criteria-to-WAVE routing map

This map determines which WAVE domains should be emphasized after Criteria scoring. It is routing guidance, not a substitute for human judgment.

  ----------------------------------------------------------------------------------------------------------------------------------------------
  Criterion Key           Primary WAVE Domains    Routing Intent
  ----------------------- ----------------------- ----------------------------------------------------------------------------------------------
  CONCEPT                 Waves 1--3              Narrative architecture, chapter/scene function, foreshadowing

  MOMENTUM                Waves 31--40            Scene-to-scene momentum, hooks, tension escalation, denouement

  CHARACTER               Waves 11--20            Character arc tracking, consistency, relationship dynamics, voice differentiation

  POV_VOICE               Waves 5, 16, 20, 58     POV stability, thought boundaries, voice differentiation, lyric control

  SCENE                   Waves 2--3, 31--32      Chapter/scene function, openings/exits, hook strength

  DIALOGUE                Waves 13--15, 49        Dialogue authenticity, subtext, tag reduction, dialogue spacing

  THEME                   Waves 21, 28, 60        Thematic integration, symbol/motif tracking, repetition as motif

  WORLD                   Waves 22--24, 29        World-building logic, cultural authenticity, setting as character

  PACING                  Waves 31--40, 41--42    Momentum, pacing balance, sentence/paragraph rhythm

  PROSE                   Waves 45--55, 61        Echo detection, abstract diagnosis, punctuation authority, compression, micro-edit precision

  TONE                    Waves 43--44, 58--59    Silence, sound anchors, lyric control, white space

  CLOSURE                 Waves 9, 39--40         Promises/payoffs, climax architecture, exit velocity

  MARKET                  Wave 62                 Agent-readiness final assessment
  ----------------------------------------------------------------------------------------------------------------------------------------------

# 7. Evaluation output schema

Every full evaluation artifact must serialize the following envelope. The shape below is normative even if the underlying storage uses jsonb.

{

\"manuscript_id\": \"uuid-or-bigint\",

\"evaluation_version\": \"VOL-II-A-1.0\",

\"criteria_scores\": \[

{

\"criterion_key\": \"CONCEPT\",

\"score\": 8,

\"band\": \"Strong with minor gaps\",

\"evidence_summary\": \"\...\",

\"priority\": \"HIGH\|MED\|LOW\"

}

\],

\"weighted_composite_score\": 7.9,

\"eligibility_gate\": \"PASS\|BLOCK\",

\"readiness_state\": \"FOUNDATIONAL\|DEVELOPING\|REFINEMENT_ELIGIBLE\|AGENT_READY\",

\"priority_repairs\": \[\"\...\"\],

\"wave_routing_targets\": \[\"W31-40\", \"W45-55\"\],

\"audit\": {

\"ai_systems_used\": 2,

\"convergence_state\": \"AGREE\|DIVERGE\",

\"generated_at\": \"ISO-8601\"

}

}

# 8. Supabase persistence model

-   Authoritative manuscript records live in manuscripts.

-   Chunk-level processing records live in manuscript_chunks when long-form evaluation requires staged chunking.

-   High-level evaluation records live in evaluations.

-   Governed output artifacts live in evaluation_artifacts as jsonb envelopes conforming to this specification.

-   No artifact should be written if fewer than 13 criteria are present or if any criterion key is invalid.

# 9. AI pipeline contract

-   AI System 1 may generate candidate criterion judgments, evidence summaries, and issue flags.

-   AI System 2 must audit, challenge, or converge those judgments before final artifact write.

-   No AI may invent criterion keys, weight values, eligibility thresholds, or routing maps not defined in this schema.

-   Divergence between AI systems must be logged into the audit envelope as a judgment zone, not silently collapsed.

# 10. Implementation invariants

-   Exactly 13 canonical criteria must be present in every full evaluation.

-   Weighted composite scoring must be deterministic for identical inputs.

-   Eligibility gate decisions must be explainable from stored criterion values and thresholds.

-   WAVE may not run when eligibility_gate = BLOCK.

-   Any schema change requires a version bump in this document and a matching registry / code update.

    \*\*\*

**📗 Volume II-A --- Operational Schema (Separate)**

-   **Volume II** = constitutional doctrine

-   **Volume II-A** = execution schema for GitHub, Supabase, Vercel, and governed AI pipelines

**Contains machine-readable execution spec:**

**• Criteria data model\
• Weight constants\
• Threshold constants\
• Criteria↔Wave routing map\
• Evaluation output format**

**🏛 Think Legal System**

**Constitution\
→ principles, rights, structure**

**Statutes / Code\
→ implementation details**

**The Constitution is written.\
Don't bury it in wiring diagrams.**

**✅ Best Practice for the Platform**

**You're building a governance-heavy system.**

**So use this:**

**[/docs\
/canon\
VOLUME_II_STORY_CRITERIA_CANON.md\
/specs\
VOLUME_II_OPERATIONAL_SCHEMA.md]{.mark}**

**This mirrors:**

**• Legal systems\
• Enterprise architecture\
• Platform governance standards**

  -------------------------------------------------------------------------
  **Doctrine & evaluation philosophy**    **Embed in Volume II**
  --------------------------------------- ---------------------------------
  **Data structures & execution logic**   **Separate Operational Schema**

  -------------------------------------------------------------------------

**⚙️ Operational Schema --- What It Is**

**Role:** System Interface Specification\
**Audience:** Engineers + AI runtime systems

This is your:

"How the platform executes the doctrine" document.

It contains:

✔ Data models\
✔ Weight tables\
✔ Threshold constants\
✔ Routing maps\
✔ Output schemas\
✔ Field definitions

It is machine-facing.

**Volume II-A --- Operational Schema**\
Machine-operational spec for:

-   criterion registry

-   score scale and banding

-   weight table

-   eligibility gate constants

-   Criteria↔WAVE routing map

-   evaluation output schema

-   Supabase persistence model

-   two-AI pipeline contract

-   implementation invariants

Top of Form

Below is the **Narrative Diagnostic Grid** --- the operational layer that turns the RevisionGrade canon into something a system (human or AI) can apply **scene-by-scene across a manuscript**.

This is essentially the **evaluation matrix** behind the models we just built.

**REVISIONGRADE CANON ADDENDUM**

**The Narrative Diagnostic Grid**

(Add to **Volume II --- Evaluation Infrastructure**)

**Purpose**

The Narrative Diagnostic Grid evaluates **each scene across the core narrative forces** that govern reader engagement.

Rather than evaluating prose in isolation, the grid analyzes whether the scene contributes to the **operating narrative system**.

The grid measures:

• Authority\
• Energy\
• Motion\
• Pressure\
• Consequence\
• Orientation\
• Information Flow

Together these elements determine whether a scene **strengthens or weakens the narrative engine.**

**The Diagnostic Grid**

  ----------------------------------------------------------------------------------------------------------------------
  **Narrative Force**   **Diagnostic Question**                                     **Scene Signal**
  --------------------- ----------------------------------------------------------- ------------------------------------
  Authority             Does the narrative voice demonstrate control and clarity?   precise language, confident tone

  Energy                Does the scene sustain curiosity or tension?                questions raised, conflict signals

  Motion                Does the scene alter the story's state?                     decision, revelation, shift

  Pressure              Does risk increase or options narrow?                       rising threat or constraint

  Consequence           Will the scene affect later events?                         decisions propagate forward

  Orientation           Can the reader clearly locate characters and actions?       spatial clarity, object anchors

  Information Flow      Is information revealed at an effective pace?               balanced curiosity vs clarity
  ----------------------------------------------------------------------------------------------------------------------

**Scene Scoring Method**

Each dimension can be scored on a **0--2 scale**:

**0 --- absent**\
The scene does not demonstrate the element.

**1 --- present but weak**\
The element exists but contributes minimally.

**2 --- strong**\
The element actively strengthens the narrative system.

**Scene Evaluation Example**

Example scene:

  ---------------------------------------------------------------------------
  **Force**            **Score**   **Reason**
  -------------------- ----------- ------------------------------------------
  Authority            2           controlled voice and clear description

  Energy               2           tension between characters

  Motion               1           information revealed but no decision

  Pressure             1           mild threat introduced

  Consequence          0           no future impact yet

  Orientation          2           clear spatial anchors

  Information Flow     2           curiosity maintained
  ---------------------------------------------------------------------------

Total Score: **8 / 14**

This suggests the scene is engaging but may require **stronger consequence or motion**.

**Diagnostic Interpretation**

Patterns across scenes reveal systemic issues.

Examples:

**Low Motion Across Scenes**

May indicate **narrative stagnation**.

**Low Pressure in Mid-Novel**

May indicate **weak escalation architecture**.

**Low Orientation**

May indicate **spatial confusion or excessive atmosphere**.

**Low Consequence**

May indicate **episodic storytelling rather than causal narrative.**

**Manuscript-Level Analysis**

After evaluating multiple scenes, RevisionGrade can identify patterns such as:

• energy collapse in the middle act\
• weak escalation ladder\
• environmental repetition\
• authority breaks in opening chapters

This allows the system to identify **structural revision priorities**.

**Integration With Existing Criteria**

The grid supports the 13 core evaluation criteria, particularly:

Narrative Drive & Momentum\
Scene Construction & Function\
Prose Control & Line-Level Craft\
Emotional Resonance\
Pacing & Structural Balance

The grid translates these criteria into **operational diagnostics**.

**Canonical Principle**

Narrative strength emerges when scenes simultaneously sustain:

• authority\
• energy\
• motion\
• pressure\
• consequence

When multiple scenes fail these conditions, the manuscript may require **structural revision rather than line editing.**

**Role in RevisionGrade**

The Narrative Diagnostic Grid allows RevisionGrade to perform:

• scene-level evaluation\
• pattern detection across chapters\
• escalation analysis\
• tension density mapping

This transforms literary critique into a **systematic narrative analysis framework.**

Bottom of Form

Bottom of Form
