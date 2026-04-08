# VOLUME II-A-PR — Prompt Runtime Binding Spec
## Engineering Edition | RevisionGrade Evaluation System

**Classification:** Canonical Doctrine — Evaluation Engine
**Authority:** WAVE Revision Guide Canon v1.1.0
**Scope:** All 13 WAVE criteria as prompt injection specifications
**Status:** Binding on all evaluation pipeline prompts

---

## PURPOSE AND AUTHORITY

This volume defines how WAVE literary doctrine is injected into live GPT evaluation prompts. It is not a reader guide. It is a runtime binding specification: each criterion section defines exactly what the AI must do, refuse, and report when evaluating that criterion.

### Authority Chain

1. WAVE Revision Guide (docs/WAVE_REVISION_GUIDE_CANON.md) — canonical
2. Volume II-A-PR (this file) — prompt runtime translation
3. lib/evaluation/doctrine.ts — injection module
4. lib/evaluation/processor.ts — enforcement
5. Report UI — output

If this document conflicts with WAVE canon, WAVE canon governs.
If the processor output conflicts with this document, the processor is wrong.

---

## TIER ARCHITECTURE

WAVE criteria are organized into three tiers. Tier weight governs score normalization and narrative summary priority.

| Tier | Label | Criteria | Weight |
|------|-------|----------|--------|
| T1 | Foundation | concept, narrativeDrive, character, voice | 40% |
| T2 | Execution | sceneConstruction, dialogue, theme, worldbuilding | 35% |
| T3 | Craft Mastery | pacing, proseControl, tone, narrativeClosure, marketability | 25% |

**Tier 1 gating rule:** If any T1 criterion scores < 4.0, the evaluation must flag a Tier 1 failure. The report narrative must address this before all else.

---

## SCORING PROTOCOL

- All criteria scored 1.0–10.0 (one decimal place)
- 1.0–3.9: Foundational failure — must identify specific root cause
- 4.0–5.9: Below threshold — needs substantial revision
- 6.0–7.4: Functional — competent but not yet distinctive
- 7.5–8.9: Strong — agent-submittable range
- 9.0–10.0: Exceptional — reserve for work achieving full criterion intent

**Score inflation prohibition:** The AI must not award scores above 7.4 unless the manuscript provides specific, quotable evidence of distinction. Hedged praise is not evidence.

---

## CRITERION SPECIFICATIONS

### 1. concept (T1 — Foundation)
**Label:** Conceptual Originality & Premise Strength

**Prompt binding:** Evaluate whether the core premise generates genuine dramatic tension that cannot be easily replicated by formula. Assess if the concept operates at multiple levels simultaneously.

**Must evaluate:**
- Premise originality within its genre/form
- Inherent dramatic tension in the concept itself
- Multi-layered potential (does the concept sustain novel-length inquiry?)
- Conceptual freshness vs. derivative construction

**Must refuse:** Awarding above 7.0 for premises that are competent reframings of familiar setups unless execution evidence justifies elevation.

---

### 2. narrativeDrive (T1 — Foundation)
**Label:** Narrative Drive & Story Engine

**Prompt binding:** Evaluate the engine that compels continued reading. Assess whether the narrative generates its own momentum through dramatic questions, escalating stakes, and reader investment.

**Must evaluate:**
- Story engine identification (what makes the reader turn pages?)
- Dramatic question clarity and evolution
- Stakes escalation architecture
- Reader investment mechanisms beyond plot curiosity
- Momentum sustainability across the evaluated section

**Must refuse:** Conflating plot activity with narrative drive. A chapter full of events can still have zero drive if the reader has no reason to care.

---

### 3. character (T1 — Foundation)
**Label:** Character Construction & Interior Life

**Prompt binding:** Evaluate characters as autonomous psychological constructs, not as vehicles for plot delivery. Assess whether characters possess interior lives that generate behavior the reader can track but not fully predict.

**Must evaluate:**
- Psychological dimensionality (contradictions, desire vs. need)
- Behavioral authenticity under pressure
- Interior life evidence (thoughts, observations, self-deception)
- Character-driven vs. plot-driven action ratio
- Relational dynamics and power exchanges

**Must refuse:** Praising character work solely because a character is sympathetic. Likability is not craft.

---

### 4. voice (T1 — Foundation)
**Label:** Point of View & Narrative Voice

**Prompt binding:** Evaluate the governing intelligence of the narration. Voice is not style alone — it is the total sensibility through which the reader experiences the story. Assess whether the voice has authority, consistency, and earned distinctiveness.

**Must evaluate:**
- POV discipline and consistency
- Narrative distance calibration (is it intentional?)
- Voice-as-worldview: does the narrating consciousness filter reality?
- Tonal authority (does the voice own its register?)
- Distinction from generic literary voice

**Must refuse:** Awarding high scores for "beautiful prose" that lacks a governing intelligence. Pretty sentences are not voice.

---

### 5. sceneConstruction (T2 — Execution)
**Label:** Scene Construction & Dramatic Architecture

**Prompt binding:** Evaluate scenes as self-contained dramatic units with internal architecture. Each scene must justify its existence through a shift in power, knowledge, or emotional state.

**Must evaluate:**
- Scene-level dramatic arc (entry state vs. exit state)
- Power dynamics and shifts within scenes
- Sensory grounding and spatial awareness
- Scene transitions and connective tissue
- Economy: does every scene earn its word count?

**Must refuse:** Passing scenes that exist only to convey information. Exposition disguised as scene is still exposition.

---

### 6. dialogue (T2 — Execution)
**Label:** Dialogue Craft & Subtext

**Prompt binding:** Evaluate dialogue as action, not transcription. Characters in effective dialogue are always doing something — negotiating, deflecting, performing, revealing. Assess the gap between what is said and what is meant.

**Must evaluate:**
- Subtext density (the said vs. the meant)
- Character differentiation through speech patterns
- Dialogue as action (power moves, emotional maneuvering)
- Avoidance of on-the-nose declaration
- Integration with physical action and silence

**Must refuse:** Praising dialogue that is merely realistic. Transcription of how people actually talk is not craft; compression and selection are.

---

### 7. theme (T2 — Execution)
**Label:** Thematic Integration & Resonance

**Prompt binding:** Evaluate theme as emergent architecture, not stated message. Theme in literary fiction arises from the collision of character, situation, and world — it is never delivered as lecture.

**Must evaluate:**
- Thematic emergence through dramatic action
- Thematic layering (multiple themes in productive tension)
- Avoidance of didacticism and thesis-statement fiction
- Symbolic architecture (imagery, motif, echo)
- Thematic coherence across narrative elements

**Must refuse:** Identifying a theme and calling it executed. Presence of a theme is not integration of a theme.

---

### 8. worldbuilding (T2 — Execution)
**Label:** World-Building & Environmental Authority

**Prompt binding:** Evaluate worldbuilding as sensory and systemic credibility, not just setting detail. The world must feel governed by rules the reader can intuit even if never stated. Applies to all genres — a kitchen in Culiacán requires worldbuilding as much as a space station.

**Must evaluate:**
- Environmental authority (does the world feel lived-in?)
- Sensory specificity beyond visual description
- Systemic coherence (economics, power, culture)
- World-as-pressure: does the environment shape character behavior?
- Research integration vs. info-dump

**Must refuse:** Equating quantity of detail with quality of worldbuilding. A single telling detail outweighs a paragraph of description.

---

### 9. pacing (T3 — Craft Mastery)
**Label:** Pacing & Temporal Control

**Prompt binding:** Evaluate the author's control of narrative time — acceleration, deceleration, compression, and expansion. Pacing is rhythm at the structural level.

**Must evaluate:**
- Rhythm of tension and release across the section
- Scene-to-scene tempo variation
- Compression and expansion choices
- White space and silence as pacing tools
- Reader fatigue management

**Must refuse:** Equating fast pacing with good pacing. Deliberate slowness in service of effect is mastery.

---

### 10. proseControl (T3 — Craft Mastery)
**Label:** Prose Control & Line-Level Craft

**Prompt binding:** Evaluate the sentence-level precision and intentionality of the prose. Every word must earn its place. Assess whether the author controls their instrument or is controlled by it.

**Must evaluate:**
- Sentence-level precision and economy
- Rhythmic variation and musicality
- Image quality and freshness
- Verb strength and specificity
- Avoidance of cliché, dead metaphor, and filler

**Must refuse:** Praising ornate prose that lacks precision. Complexity is not quality; intentionality is.

---

### 11. tone (T3 — Craft Mastery)
**Label:** Tonal Authority & Consistency

**Prompt binding:** Evaluate the author's command of emotional register across the section. Tone is the emotional weather of the prose — it must be governed, not accidental.

**Must evaluate:**
- Tonal consistency within scenes
- Intentional tonal shifts vs. accidents
- Register appropriateness to content
- Tonal integrity under dramatic pressure
- Control of irony, earnestness, and ambiguity

**Must refuse:** Confusing consistent tone with monotone. Tonal range within consistency is the mark of command.

---

### 12. narrativeClosure (T3 — Craft Mastery)
**Label:** Narrative Closure & Promise Fulfillment

**Prompt binding:** Evaluate whether the section fulfills the promises it makes to the reader. Closure is not resolution — it is the sense that the narrative contract has been honored.

**Must evaluate:**
- Promise/payoff architecture
- Intentional ambiguity vs. unfinished business
- Emotional closure even when plot remains open
- Setup/callback integrity
- Reader satisfaction calibration

**Must refuse:** Penalizing open endings that are intentionally designed. Evaluate the author's intent, then evaluate execution of that intent.

---

### 13. marketability (T3 — Craft Mastery)
**Label:** Professional Readiness & Market Positioning

**Prompt binding:** Evaluate whether this manuscript section demonstrates the cohesion, clarity, and craft level expected by literary agents and acquiring editors. This is not about commercial appeal — it is about professional readiness.

**Must evaluate:**
- Agent-submission readiness of the prose
- Genre/category positioning clarity
- Comparable title awareness (does it know what shelf it sits on?)
- Professional-grade polish vs. workshop-grade effort
- Distinction factor: what makes this manuscript stand out in a pile?

**Must refuse:** Awarding high marketability to work that is merely competent. The market rewards distinction, not adequacy.

---

## PROMPT INJECTION FORMAT

The doctrine injection module (lib/evaluation/doctrine.ts) must deliver criterion-specific prompt context to the GPT evaluation call in the following structure:

```
For criterion "[key]":
- Label: [label]
- Tier: [T1/T2/T3]
- You MUST evaluate: [must_evaluate items]
- You MUST REFUSE to: [must_refuse items]
- Score range: 1.0-10.0 (one decimal)
- Evidence requirement: Cite specific passages from the manuscript
```

---

## GOVERNANCE

- This document is versioned alongside the codebase
- Changes require WAVE Revision Guide review
- The doctrine.ts module must be regenerated when this document changes
- All 13 criteria must be present in every evaluation; partial evaluation is a hard error
- Canon Version: v1.0.0
- Last Updated: 2026-04-07
