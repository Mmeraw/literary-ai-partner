# 13 Story Evaluation Criteria (Agents, Editors, and Script Readers)

Applies to novels, narrative nonfiction, film, and TV scripts. Includes explicit industry red-flag checks and a meta-layer for professional viability.

---

This rubric is production-ready: **13 Story Evaluation Criteria** unify craft, structure, and explicit industry red-flag checks in a single scoring spine. Each criterion is mapped to a stable JSON key for consistent evaluation, UI display, and data storage. A separate meta-layer (14–19) captures acquisition heuristics—market identity, cognitive load, concept-to-execution fit, distinctiveness, longevity, and professional readiness—kept out of the public UI but used internally to modulate Marketability and the final 'Would they keep reading?' gate.

## A. Core 13 Criteria (Public Rubric + Code-Safe Labels)

**Scoring:** 1–10 per criterion (10 = submission-ready). Red-flag checks are embedded under the most relevant criteria to match real-world agent and script-reader rejection triggers.

---

### 1. Opening Hook — `opening_hook`

- Does the opening line and first page create immediate curiosity, tension, or surprise?
- By page 5, can a reader answer: who is this about, what is wrong, and why now?
- By pages 10–15, is the inciting incident or central disruption on the page or strongly foreshadowed, and is the premise legible?

**Red-flag checks:**
- No wake-up routine, dream sequence, or static backstory/info-dump opening.
- Early pages do not delay live scene pressure with heavy exposition.
- Primary protagonist is clearly identifiable and emotionally anchored within the opening pages.
- No 'nothing happens' opening: a concrete disruption is present or strongly foreshadowed by ~10–15 pages.

---

### 2. Narrative Voice & Style — `narrative_voice_style`

- Is the voice distinct, confident, and appropriate to the story's tone and medium?
- Does the prose feel deliberate (not generic), with control of rhythm, image, and clarity under pressure?
- Under high tension, does the voice hold rather than flatten into bland exposition?

**Red-flag checks:**
- POV discipline is controlled: no unintentional head-hopping or unclear vantage; the reader always knows whose experience they inhabit in each scene.

---

### 3. Character Depth & Introduction — `character_depth_introduction`

- Are the primary protagonist and core cast introduced through action under pressure (not static biography)?
- Do early scenes show what characters want, fear, and will do to get what they need?
- Do relationships arrive with subtext and power dynamics, not labels?

**Red-flag checks:**
- Protagonist is not passive or purely reactive: goals, stakes, and contradictions are clear early.

---

### 4. Conflict, Tension & Escalation — `conflict_tension_escalation`

- Does every major scene contain conflict (internal, interpersonal, systemic, environmental)?
- Do obstacles and complications escalate over time, forcing harder choices?
- Are there any long flat stretches where nothing is really at risk?

**Red-flag checks:**
- No repetitive scene pattern where conflict appears, resolves instantly, and leaves the narrative unchanged (e.g., '20 pages of story spread over 100 pages').

---

### 5. Thematic Resonance — `thematic_resonance`

- Do themes emerge from character choice and consequence rather than being stated directly?
- Do motifs/symbols recur with escalation (new meaning/pressure), not repetition or explanation dumps?
- Are thesis/moral lines rare, earned, and in-character (not author commentary)?

---

### 6. Structure, Pacing & Flow — `structure_pacing_flow`

- Do chapters/scenes end on a turn, decision, reveal, or new pressure that propels the reader forward?
- Is there a recognizable escalation arc (setup, rising complications, midpoint pivot, crisis, climax, aftermath)?
- Does each scene have a clear job (reveal, escalate, decide, reverse, pay off) and leave the story in a different state than it began?

**Red-flag checks:**
- No early chapter spends more than a short paragraph in static backstory or system explanation without live scene pressure.
- Story logic remains coherent: no major 'wait, that makes no sense' moments caused by missing steps or contradictions.

---

### 7. Dialogue & Subtext — `dialogue_subtext`

- Does dialogue sound like people under specific pressure (not transcripts or essays)?
- Do key exchanges carry subtext—what's avoided, denied, or contradicted by behavior?
- In high-stress moments, does speech roughen naturally (fragments, interruptions, misfires) instead of staying essay-clean?

---

### 8. Worldbuilding & Immersion — `worldbuilding_immersion`

- Is setting revealed through action, conflict, and choice rather than static lore dumps?
- Are sensory details concrete and selective, creating atmosphere without overloading the reader?
- Do systems (institutions, rules, power structures) feel consistent and credible once established?

**Red-flag checks:**
- Scene openings quickly anchor who is present, where we are, and what is physically happening before extended dialogue or abstraction (no anchoring failure).
- World rules stay consistent; no world-rule violations that break trust.

---

### 9. Stakes & Emotional Investment — `stakes_emotional_investment`

- Is it always clear what the character stands to lose or gain in the current scene and in the story overall?
- Do later choices cost more than earlier ones—emotionally, socially, practically?
- Does the reader have reasons to care beyond abstract 'the world will change' stakes?

---

### 10. Line-Level Craft & Polish — `line_level_craft_polish`

- Is the prose free of redundancy, filler (including reflexives, filler hedges, and AI-adjacent clichés), summary-voice drift, and cliché patterns flagged in the WAVE Guide?
- Does sentence rhythm modulate with scene pressure (not all staccato, not all run-on)?
- Are grammar, punctuation, and formatting clean enough that they never distract from the story?

**Red-flag checks:**
- For screenplays: industry-standard formatting, minimal parentheticals, and no obvious typos or basic craft errors that kill trust immediately.

---

### 11. Marketability & Genre Position — `marketability_genre_position`

- Does the work occupy a recognizable lane while still feeling fresh?
- Can an agent/producer plausibly name 2–3 recent comps (or adjacent references) this could sit beside?
- Would a one-sentence pitch make sense to a non-writer: who, what problem, what unique angle?

**Red-flag checks:**
- Package alignment: query/logline, comps, and opening pages deliver the same tonal promise, genre lane, and stakes (no mismatch).
- Length, category, and audience expectations fall within a normal range for the lane (or the deviation is justified and market-savvy).

---

### 12. Narrative Closure & Promises Kept — `narrative_closure_promises_kept`

- Do all major character threads either resolve on-page or receive an intentional on-page treatment (e.g., "we never saw X again")?
- Do key conflicts/subplots either resolve, transform, or get explicitly abandoned (with emotional cost), rather than simply disappearing?
- Are major story questions/promises answered, reframed, or clearly left to haunt the reader (not just forgotten)?

**Red-flag checks:**
- Unintentional loose ends: prominent characters, conflicts, or promised revelations vanish without consequence or explicit closure.
- Chekhov violations: emphasized story elements ("guns") are planted with implied payoff and then never used or accounted for.
- Ambiguity is acceptable only when it is intentional, thematically aligned, and clearly framed as unresolved-on-purpose.

---

### 13. 'Would They Keep Reading?' Gate — `would_keep_reading_gate`

- By ~50 pages (or ~15–25 screenplay pages, or equivalent % of script pages), has the story delivered at least one game-changing turn, reveal, or escalation?
- At that point, would a busy agent/editor/script reader feel compelled to request the full (not just mildly interested)?
- If the answer is anything less than 'yes, absolutely,' the manuscript/script fails the spine test regardless of sentence-level beauty.

---

## B. Industry Viability & Professional Readiness (Internal Meta-Layer)

These do not need separate public scores. Use them internally to adjust Criterion 11 and the final Gate (Criterion 13).

### 14. Clarity of Market Identity (Immediate Shelf Recognition) — `market_identity_clarity`
- Can it be described in one sentence that communicates genre, tone, and hook without apology or caveats?

### 15. Reader Momentum & Cognitive Load — `reader_momentum_cognitive_load`
- Does the story reward attention, or punish it (orientation friction; too many names/terms/timelines/abstractions too fast)?

### 16. Concept-to-Execution Alignment — `concept_to_execution_alignment`
- Would a reader who bought it for the concept feel satisfied by the execution and tonal delivery?

### 17. Distinctiveness Without Gimmickry — `distinctiveness_without_gimmickry`
- Is it memorable for how it is told, without leaning on shock/novelty to compensate for thin structure?

### 18. Longevity & Reread Value — `longevity_reread_value`
- Does it feel durable and layered—like the start of an authorial voice, not a one-off stunt?

### 19. Professional Readiness (Hidden Filter) — `professional_readiness_hidden_filter`
- Does it signal 'this writer is ready' (control, restraint, revision literacy), not 'teaching craft required'?

---

## C. Base44 Implementation Notes (Canonical Keys + Output Fields)

Keep one canonical rubric. Expose only the 13 criteria publicly; use the meta-layer internally to influence overall scoring.

### Recommended stable JSON keys (public 13)
- `opening_hook`
- `narrative_voice_style`
- `character_depth_introduction`
- `conflict_tension_escalation`
- `thematic_resonance`
- `structure_pacing_flow`
- `dialogue_subtext`
- `worldbuilding_immersion`
- `stakes_emotional_investment`
- `line_level_craft_polish`
- `marketability_genre_position`
- `narrative_closure_promises_kept`
- `would_keep_reading_gate`

### Per-criterion output fields
- `score` (1–10 integer)
- `rationale` (3–6 sentences)
- `strengths` (array, optional)
- `risks` (array, optional)
- `must_fix_to_reach_10` (array of 3 items)

### Integrated industry red-flag checks (no extra public criteria)
- POV discipline / head-hopping → `narrative_voice_style`; `worldbuilding_immersion`
- Wake-up/dream/info-dump openings → `opening_hook`; `structure_pacing_flow`
- Inciting incident too slow / premise unclear → `opening_hook`
- Backstory/exposition overload → `structure_pacing_flow`; `line_level_craft_polish`
- Anchoring failure (can't picture the scene) → `worldbuilding_immersion`
- Thin/repetitive conflict → `conflict_tension_escalation`
- Logic holes / inconsistent rules → `structure_pacing_flow`; `worldbuilding_immersion`
- Formatting/professionalism issues (scripts) → `line_level_craft_polish`
- Market misfit / package mismatch → `marketability_genre_position`
- Loose ends / Chekhov violations → `narrative_closure_promises_kept