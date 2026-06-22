# Long-Form Multi-Layer Evaluation Template

**Canonical mode:** `long_form_multi_layer_evaluation`  
**Route:** `LONG_FORM`  
**Output mode:** `multi_layer_long_form`  
**Typical scope:** 25,000+ word manuscript — adaptive depth for both straightforward novels and manuscripts with multi-layer, multi-voice, symbolic, documentary, canon/doctrine, research-heavy, paratextual, or structurally complex architecture  
**Authority:** `docs/governance/evaluation-output-mode-contract.md`  
**Rendering authority:** `docs/templates/evaluation/evaluation-rendering-contract.md`  
**Style authority:** The Chicago Manual of Style governs formatting, grammar, spelling, punctuation, capitalization, heading style, number style, table presentation, and author-facing editorial prose.  
**Product boundary:** This is one of RevisionGrade's two evaluation products. All submissions of 25,000+ words route here. There is no intermediate long-form mode. The retired `long_form_evaluation` mode exists only for historical artifact rendering.  
**Related authority:** Existing DREAM long-form specifications and DREAM governed-ledger templates remain authoritative for completeness details.  
**Runtime impact:** Authoritative rendering contract for web, PDF, DOCX, TXT, and print-friendly views.

---

## Product Promise

A long-form multi-layer evaluation is RevisionGrade's novel-scale evaluation product. It diagnoses manuscripts of 25,000+ words at full manuscript scale, adapting its depth to the manuscript's architecture.

For straightforward novels (single timeline, single POV, linear structure), it produces a complete manuscript-scale evaluation with continuity analysis, revision sequencing, and readiness posture.

For manuscripts with complex architecture (multiple timelines, multiple voice lanes, symbolic systems, canon/doctrine layers, identity systems, research-heavy ambiguity, paratext, documentary structures, nested narratives, mythic or metaphysical planes, or other layered structures), it additionally preserves and evaluates the layer architecture that simpler reports would flatten.

It evaluates the full 13 story criteria while also accounting for continuity, promises, payoff, character/relationship movement, pacing architecture, layer integrity, evidence distribution, governed-ledger completeness where applicable, and readiness risk across the submitted manuscript.

This template does not replace existing DREAM templates. It defines the product-facing output mode that uses DREAM, Story Ledger, Review Gate, and governed-ledger depth where applicable.

Long-form multi-layer evaluation is a depth mode. It is not a quality tier, premium badge, publication promise, Storygate acceptance promise, or substitute for Revise Queue.

### Adaptive Depth Principle

This template serves ALL 25,000+ word manuscripts. Sections marked `where applicable` are populated only when the manuscript's architecture materially benefits from them. A 60,000-word linear thriller will naturally produce fewer layer-specific sections than a 200,000-word multi-timeline fantasy. This is correct behavior — not a deficiency.

The pipeline must not:

- generate decorative placeholder sections to fill bulk;
- force layer analysis where no meaningful layers exist;
- inflate sections to match a complex manuscript's output shape;
- reduce evaluation depth merely because a manuscript is architecturally simple.

Every populated section must earn its presence through manuscript evidence.

---

## Required Report Shape

### Title Block

```text
# Evaluation Report: [Manuscript Title]

Reference ID: [UUID]

Report Type: Long-Form Multi-Layer Evaluation
Overall Score: [XX]/100
Overall Score Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Market Readiness: [Market Ready / Near Market Ready / Not Market Ready]
Market Readiness Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Genre: [Pipeline-diagnosed genre]
Genre Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Target Audience: [Pipeline-diagnosed target audience]
Target Audience Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Shelf: [Pipeline-diagnosed manuscript shelf]
Shelf Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Submitted Word Count: [XXXX]
Estimated Manuscript Pages: [XXX] at 250 words/page
Reading Grade Level: [X.X] (Flesch-Kincaid)
Dialogue/Narrative Ratio: [XX]% dialogue / [XX]% narrative
Date Generated: [Month Day, Year]
```

### Required Shared Sections

**Core sections (always produced):**

1. Title Block
2. One-Paragraph Pitch
3. One-Sentence Pitch
4. Premise, when available
5. Content Warnings
6. Revision Opportunity Summary
7. Executive Summary
8. Top Strengths
9. Top Risks
10. Top Recommendations
11. 13 Criteria Score Grid
12. Criterion Rationales & Surfaced Opportunities (expanded format: What Is Working / What Weakens Impact / Revision Queue per criterion)

**Mode-specific sections (always produced for all 25k+ manuscripts):**

13. Narrative Synthesis (holistic craft sub-scores + executive verdict)
14. Market Shelf (professional positioning analysis)
15. Layer-Aware Revision Sequencing
16. Long-Form Continuity and Coverage Proof
17. Readiness / Releasability Posture

**Mode-specific sections (where applicable — produced when manuscript architecture requires):**

18. Structural Stack or layer-aware architecture map
19. Arc Map
20. Layer-by-Layer Analysis
21. Cross-Layer Integration
22. Review Gate readiness surface
23. Governed ledgers or compact governed-ledger addenda

**Closing sections (always produced):**

24. Confidence Explanation
25. Author-Facing Disclaimer

PDF, DOCX, TXT, web, and print-friendly views must preserve this content and order. Downloads must expand surfaced criterion opportunities and diagnostic details.

Renderers must not independently add, remove, rename, reorder, summarize, suppress, recalculate, or reinterpret author-facing report content.

Sections marked `where applicable` are omitted entirely when the canonical report document does not include them. Renderers must not synthesize placeholders or decorative stubs for omitted optional sections.

---

## Title Block Metadata Contract

The Title Block fields above are required for every completed long-form multi-layer evaluation.

- **Genre** is required and must carry **Genre Confidence**.
- **Target Audience** is required and must carry **Target Audience Confidence**.
- **Shelf** is required and must carry **Shelf Confidence**.
- **Overall Score** is required and must carry **Overall Score Confidence**.
- **Market Readiness** is required and must carry **Market Readiness Confidence**.
- The canonical evaluation document must populate these fields during report generation.
- Values may be generated by the system and/or LLM as part of canonical document assembly.
- **Target Audience** identifies the intended reader group.
- **Shelf** identifies the manuscript's professional bookstore/library/market-positioning shelf.
- **Target Audience** and **Shelf** must not be collapsed into one field.
- Renderers must not invent, override, omit, or reinterpret any Title Block field or field-specific confidence label.
- A missing required Title Block field or required confidence label is a report-completeness defect.
- **Reading Grade Level** is deterministic Title Block metadata only.
- **Dialogue/Narrative Ratio** is deterministic Title Block metadata only.
- Renderers must not create standalone Reading Grade Level or Dialogue/Narrative Ratio sections unless this template is explicitly revised to authorize them.

---

## Canonical Confidence Labels

Use these five labels exactly:

1. **Very High Confidence**
2. **High Confidence**
3. **Moderate Confidence**
4. **Low Confidence**
5. **Insufficient Evidence**

Do not use legacy confidence labels such as `Mixed`, `Medium`, `Unclear`, or unqualified `High / Moderate / Low` in report output.

Confidence is field-specific. Do not use one global confidence value as a substitute for Genre Confidence, Target Audience Confidence, Shelf Confidence, Overall Score Confidence, Market Readiness Confidence, criterion confidence, or layer confidence.

Confidence must not be inflated merely because the report completed successfully. Confidence reflects evidence quality and diagnostic reliability, not pipeline completion.

---

## Optional Section Inclusion Rule

Sections marked `where applicable` must follow these rules:

- If the canonical report document does not include the section, omit it entirely.
- Do not synthesize placeholders, decorative stubs, or renderer-generated substitutes.
- If the canonical report document includes the section with evidence limits, render it using evidence-limited author-facing wording rather than suppressing it.
- Renderers must not make independent decisions about whether an optional section is conceptually useful; they render what the canonical report document supplies.

---

## Pitch Contract

The report must include both pitch surfaces:

```text
## One-Paragraph Pitch

[A concise 3-5 sentence author-facing pitch that captures the manuscript's premise, protagonist or central force, layer architecture when relevant, conflict, stakes, tonal register, and market-facing dramatic appeal.]

## One-Sentence Pitch

[A single-sentence hook that captures the manuscript's core dramatic situation.]
```

Use the submitted premise when available. Fall back to the Executive Summary only when the premise is unavailable.

The pitch must remain author-facing. It must not expose protected analysis labels, internal governance terminology, gate names, reducer language, artifact status, phase names, or pipeline metadata.

The pitch may mention layered architecture only when it improves professional positioning. It should not make the manuscript sound more complex than it is.

---

## Premise Contract

The Premise is a 1-2 sentence elevator pitch that captures the manuscript's core dramatic situation.

It must:

- name the protagonist or central force;
- identify the primary conflict or tension;
- convey the emotional or tonal register;
- account for layered architecture when necessary;
- remain author-facing and suitable for query letters, back-cover copy, or marketing;
- never exceed three sentences.

When a manuscript uses multiple timelines, voices, documentary layers, or symbolic systems, the premise should identify the central unifying pressure rather than listing every layer.

---

## Content Warnings Contract

Content Warnings identify content that may require reader advisories. They appear near the top of the report, after the pitch and premise surfaces.

Requirements:

- List specific content categories present in the manuscript.
- Only include warnings supported by textual evidence in the submission.
- Use plain, direct language, not euphemism or clinical jargon.
- Do not infer content warnings from genre alone.
- Do not include warnings for material not present in the submitted manuscript.

If no warning-worthy content is detected, display:

```text
No content warnings identified.
```

Conclude with:

```text
Consider including content warnings in book marketing or front matter.
```

Reading Grade Level measures prose complexity, not audience appropriateness. A manuscript may score at a young-adult reading level while containing graphic violence, sexual content, substance abuse, or other material unsuitable for younger readers. Always cross-reference Content Warnings for content suitability guidance.

---

## Revision Opportunity Summary

Every completed report must include aggregate revision-opportunity counts:

```text
## Revision Opportunity Summary

Total Revision Opportunities: [XX]
Recommended: [X]
Optional: [X]
Consider: [X]
```

Recommendation tiers indicate the suggested urgency of each revision opportunity:

- **Recommended**: High-priority revisions that will meaningfully improve the manuscript.
- **Optional**: Medium-priority revisions that strengthen craft but are not essential.
- **Consider**: Lower-priority refinements the author may choose to adopt or defer.

Revision Opportunity Summary must aggregate surfaced opportunities and deeper Revise Queue inventory without implying that all repairs are applied in the evaluation report.

---

## Existing DREAM Authority

RevisionGrade already has DREAM long-form specifications and governed-ledger documents. Those documents remain authoritative for the detailed governed-ledger contract.

This template clarifies that DREAM surfaces belong to the long-form multi-layer product mode when a manuscript requires them.

Existing DREAM authority controls:

- governed ledgers;
- character, relationship, symbol, sensory/emotional, integrity, and evidence-distribution coverage;
- layer-aware completeness;
- Story Ledger / Review Gate behavior where applicable;
- protected WAVE/governance boundaries;
- benchmark addenda and DREAM compliance notes.

This template governs the author-facing report surface. Existing DREAM documents govern the deeper completeness and artifact requirements behind the surface.

---

## Story Ledger Boundary

Story Ledger surfaces may appear when they materially assist evaluation.

Story Ledger presence does not imply:

- manuscript approval;
- market readiness;
- readiness certification;
- Review Gate passage;
- Storygate eligibility;
- governed-ledger completeness;
- publication recommendation;
- Revise Queue execution.

Story Ledger is an evaluation aid, not a publication recommendation or acceptance signal.

Story Ledger content must be rendered in author-facing editorial language. It must not expose raw extraction artifacts, internal schema labels, gate audit logs, reducer status, phase logs, or protected pipeline terminology.

---

## Multi-Layer Eligibility and Adaptive Behavior

All manuscripts of 25,000+ words route to this template. There is no separate standard long-form mode for new submissions.

The template adapts its depth based on manuscript architecture:

**Always produced (all 25k+ manuscripts):**

- Full 13 criteria evaluation with expanded criterion analysis
- Narrative Synthesis with holistic sub-scores
- Market Shelf positioning
- Continuity and Coverage Proof
- Layer-Aware Revision Sequencing
- Readiness / Releasability Posture

**Produced where applicable (complex manuscripts only):**

- Structural Stack / Architecture Map (when multiple operating layers exist)
- Arc Map (when act-level decomposition aids revision)
- Layer-by-layer analysis (when distinct layers require independent assessment)
- Cross-Layer Integration (when layer interaction creates diagnostic value)
- Governed-ledger addenda (when symbol/doctrine/character systems need continuity proof)
- Review Gate readiness surface (when readiness artifacts support it)

**Signals that trigger expanded layer analysis:**

- multiple timelines;
- multiple voice lanes;
- symbolic systems;
- canon or doctrine structures;
- documentary or paratext architecture;
- nested narratives;
- research-heavy ambiguity;
- identity systems requiring continuity verification;
- recurring object or relic systems;
- complex relationship engines;
- world/canon systems that affect plot logic;
- layered historical, speculative, mythic, or institutional structures.

Multi-Layer Evaluation is a depth mode, not a quality tier.

A manuscript does not receive layer sections merely because it is long, ambitious, literary, experimental, or difficult. The layered architecture must be relevant to evaluation accuracy. Simpler manuscripts receive the full core evaluation without forced layer sections.

---

## Required 13 Criteria

Long-form multi-layer evaluation still uses the canonical 13 story criteria. Story Ledger / DREAM depth does not replace the 13 criteria.

1. Concept & Core Premise
2. Narrative Drive & Momentum
3. Character Depth & Psychological Coherence
4. Point of View & Voice Control
5. Scene Construction & Function
6. Dialogue Authenticity & Subtext
7. Thematic Integration
8. World-Building & Environmental Logic
9. Pacing & Structural Balance
10. Prose Control & Line-Level Craft
11. Tonal Authority & Consistency
12. Narrative Closure & Promises Kept
13. Professional Readiness & Market Positioning

The 13 criteria remain the primary author-facing evaluation structure even when DREAM, Story Ledger, Review Gate, or governed-ledger outputs are used behind the report.

---

## 13 Criteria Score Grid

The score grid must be a full-width table with right-aligned Score and Confidence columns:

| Criterion | Score | Confidence |
| :--- | ---: | ---: |
| Concept & Core Premise | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Narrative Drive & Momentum | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Character Depth & Psychological Coherence | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Point of View & Voice Control | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Scene Construction & Function | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Dialogue Authenticity & Subtext | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Thematic Integration | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| World-Building & Environmental Logic | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Pacing & Structural Balance | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Prose Control & Line-Level Craft | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Tonal Authority & Consistency | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Narrative Closure & Promises Kept | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |
| Professional Readiness & Market Positioning | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence |

Column widths: Criterion (55%), Score (15%), Confidence (30%).

Scores must be rendered as `XX/10`, not as decimals, percentages, letter grades, or badges.

The score grid must not include internal artifact status, governance flags, phase labels, pass labels, audit status, or raw ledger completeness percentages.

---

## Layer-Specific Supplemental Score Surfaces

Use only when the manuscript's architecture requires them. These supplemental surfaces do not replace the canonical 13 criteria.

| Supplemental Surface | Score | Confidence | Summary Finding |
| :--- | ---: | --- | --- |
| Layer & Mode Integration | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence | [Finding] |
| Layer Coherence | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence | [Finding] |
| Doctrine / Glyph System Integrity | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence | [Finding] |
| Canon & Continuity Integrity | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence | [Finding] |
| Symbol / Object Lifecycle Integrity | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence | [Finding] |
| Evidence Distribution Integrity | XX/10 | Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence | [Finding] |

---

## Top Recommendations Contract

Top Recommendations are cross-layer executive summaries of the highest-impact findings.

They must:

- synthesize the manuscript's largest cross-layer risks or opportunities;
- avoid verbatim duplication of individual criterion opportunities;
- remain author-facing and plain-language;
- identify the highest-value author actions;
- remain compact enough for report scanning;
- avoid protected WAVE/governance terminology;
- avoid A/B/C rewrite proposals.

Top Recommendations should prioritize manuscript-level leverage over isolated line edits unless line-level craft is the dominant readiness risk.

---

## Criterion Rationales & Surfaced Opportunities Contract

Long-form multi-layer evaluation uses an expanded criterion analysis format. For each of the 13 criteria, the report must include:

### Per-Criterion Expanded Format

```text
## [Criterion Name] — [X]/10 ([Confidence Label])

### What Is Working

• [Evidence-grounded observation of what the manuscript does well for this criterion.]
• [Additional working observation, with textual evidence.]
• [2–4 total observations, each citing manuscript evidence.]

### What Weakens Impact

• [Evidence-grounded observation of underperformance.]
• [Additional weakness observation, with textual evidence.]
• [2–4 total observations, each citing manuscript evidence.]

### Revision Queue

1. Location: [Chapter/Section] | Operation: [Add/Edit/Compress/Replace/Clarify] | Recommendation: [Specific editorial guidance] | Acceptance: [Condition that proves the fix worked without damage.]
2. [Additional prioritized revision recommendations, 2–5 per criterion for scores ≤8.]
```

For criteria scoring 9–10/10, use a fit statement in place of What Weakens Impact and Revision Queue. Do not invent problems for criteria that are performing well.

### Surfaced Opportunities

The report must also surface the highest-priority opportunities in the six-part diagnostic structure:

1. **Evidence:** where in the manuscript or layer the issue appears.
2. **Symptom:** the observable problem or underperformance.
3. **Cause:** the mechanism producing the symptom.
4. **Fix Direction:** the bounded repair direction.
5. **Reader Effect:** what changes for the reader if repaired.
6. **Mistake-Proofing:** what must not be damaged during repair.

Each criterion may show zero to three surfaced opportunities in the compact report surface. The full opportunity inventory belongs in Revise Queue.

Online report rendering should be compact: one primary opportunity visible by default, with additional surfaced opportunities and the expanded analysis (What Is Working / What Weakens Impact / Revision Queue) behind a click or in a collapsible panel. Print and downloads must show all expanded analysis and diagnostic details.

Do not invent opportunities for criteria that are already performing well. For strong criteria, use a fit statement rather than unnecessary repair work.

---

## Recommendation Density & Total Cap

Recommendation density floors for criteria scoring 8/10 or lower:

- Score 5/10 or lower: 5-10 recommendations per criterion
- Score 6-7/10: 4-8 recommendations per criterion
- Score 8/10: 2-5 recommendations per criterion
- Score 9-10/10: no recommendations; fit statement only

**Total cap:** 100 revision opportunities across all criteria combined for long-form multi-layer evaluations.

Recommendation density should reflect manuscript need, not mechanical quota filling. Do not flood a strong manuscript with low-value recommendations merely to fill a cap.

---

## Narrative Synthesis Contract

Narrative Synthesis is a required section for all long-form multi-layer evaluations. It provides a holistic craft assessment that synthesizes across the 13 criteria and any layer-specific findings into a unified editorial verdict.

### Required Sub-Scores

```text
## Narrative Synthesis

Quality Score: [X]/10 — [One-sentence craft quality summary]
Readiness Score: [X]/10 — [One-sentence professional readiness summary]
Commercial Score: [X]/10 — [One-sentence market viability summary]
Literary Score: [X]/10 — [One-sentence literary distinction summary]

### Executive Verdict

[2–4 paragraph editorial verdict synthesizing the manuscript's overall position.
Must address: what the manuscript achieves, where it falls short, the relationship
between craft quality and market readiness, and the highest-leverage next step for
the author.]
```

### Sub-Score Definitions

- **Quality Score:** Overall craft execution across all 13 criteria. Reflects prose control, structural coherence, character depth, and technical skill.
- **Readiness Score:** How close the manuscript is to professional submission. Reflects completeness, consistency, market formatting, and agent/editor expectations.
- **Commercial Score:** Market viability within the diagnosed genre and shelf. Reflects hook clarity, audience targeting, genre conventions, and competitive positioning.
- **Literary Score:** Artistic distinction and lasting reader impact. Reflects thematic depth, originality, voice authority, and literary ambition beyond genre formula.

### Relationship to Other Sections

Narrative Synthesis must not repeat the 13 criteria verbatim. It must synthesize across them.

Narrative Synthesis sub-scores may differ from Overall Score. Overall Score is a weighted composite; Narrative Synthesis sub-scores are distinct diagnostic lenses. A manuscript may score high on Quality and Literary but low on Commercial.

The Executive Verdict must be original editorial prose, not a concatenation of criterion rationales.

### UED Field Mapping

Narrative Synthesis maps to `modeSpecific.crossLayerSynthesis` in the UnifiedEvaluationDocument. The normalizer must resolve dream-derived sub-scores and executive verdict into the EvaluationReportViewModel's modeSections.

---

## Market Shelf Contract

Market Shelf is a required section for all long-form multi-layer evaluations. It provides professional positioning analysis for the manuscript within the diagnosed genre ecosystem.

### Required Fields

```text
## Market Shelf

Best Shelf: [Primary genre/sub-genre shelf placement]
Marketable Hook: [1–2 sentence pitch-ready hook for agents/publishers]

### Shelf Neighbors
• [Comparable title 1] — [Why comparable: shared element]
• [Comparable title 2] — [Why comparable: shared element]
• [Comparable title 3] — [Why comparable: shared element]
• [3–5 comparable titles total]

### Comparison Space
• [Market positioning statement 1: where this manuscript sits relative to current market]
• [Market positioning statement 2: audience overlap or gap]
• [2–4 positioning observations]

### What Not to Become
• [Anti-comparison 1: what this manuscript should avoid being mistaken for]
• [Anti-comparison 2: market trap or false genre signal]

### Market Danger
[1–2 sentences identifying the primary market risk — e.g., overcrowded shelf, unclear audience,
genre-blending confusion, or positioning that undercuts the manuscript's strengths.]
```

### Relationship to Title Block

Market Shelf expands on the Title Block's `Shelf` field. The Title Block provides the one-line shelf label; this section provides the full positioning analysis.

### Non-Promises

Market Shelf must not promise:

- agent interest;
- publisher acquisition;
- commercial success;
- bestseller potential;
- specific advance ranges;
- film/TV adaptation interest.

Market Shelf identifies professional positioning. It does not guarantee market outcomes.

### UED Field Mapping

Market Shelf maps to `modeSpecific.readinessReleasabilityPosture` in the UnifiedEvaluationDocument. The normalizer must resolve market_shelf dream data (best_shelf, marketable_hook, shelf_neighbors, comparison_space, market_danger) into the EvaluationReportViewModel's modeSections.

---

## Structural Stack Contract

Structural Stack is produced where applicable — when the manuscript has identifiable operating layers that benefit from architectural inventory.

### Format

```text
## Structural Stack

| Layer | Function | Status | Revision Note |
| :--- | :--- | :--- | :--- |
| [Layer name] | [What this layer does for the manuscript] | [Functioning / Underdeveloped / Contradictory / Decorative] | [Brief editorial note or "None needed"] |
| [Layer name] | [Function] | [Status] | [Note] |
```

### Rules

- Each layer must be a genuinely identifiable operating system in the manuscript (not a synthetic category).
- Status must use one of four canonical values: Functioning, Underdeveloped, Contradictory, Decorative.
- Layer names must be author-facing (e.g., "Timeline: Present Day", "Voice: Narrator", "Symbol System: Water/Drowning") — not internal pipeline labels.
- The Structural Stack must not grow beyond what the manuscript's architecture supports.

### UED Field Mapping

Structural Stack maps to `modeSpecific.storyLedgerArchitectureMap` in the UnifiedEvaluationDocument.

---

## Arc Map Contract

Arc Map is produced where applicable — when act-level structural decomposition provides editorial value for revision planning.

### Format

```text
## Arc Map

| Act | Chapters | Primary Function | Revision Priority |
| :--- | :--- | :--- | :--- |
| Act I | [Chapter range] | [Setup / Inciting / Escalation / etc.] | [High / Medium / Low / None] |
| Act II | [Chapter range] | [Function] | [Priority] |
| Act III | [Chapter range] | [Function] | [Priority] |
```

### Rules

- Act decomposition must reflect the manuscript's actual structure (not a forced three-act template).
- Chapter ranges must be accurate to the submitted text.
- Primary Function must be a plain-language editorial descriptor.
- Revision Priority identifies which acts need the most attention.
- Arc Map must not be produced for manuscripts where act-level thinking adds no editorial value (e.g., short linear narratives that happen to exceed 25k words).

### UED Field Mapping

Arc Map is carried within `modeSpecific.storyLedgerArchitectureMap` in the UnifiedEvaluationDocument.

---

## Layer-Aware Surfaces

Render layer-aware analysis when the manuscript requires it. Depending on manuscript architecture, this may include:

- timeline / era lanes;
- narrator / voice lanes;
- canon / doctrine systems;
- symbolic systems;
- relationship engines;
- object / symbol lifecycles;
- identity / pronoun verification where relevant;
- location / timeline continuity;
- threat / pressure / ending-state analysis;
- source-integrity or author-context surfaces.

Do not render layer sections as decorative bulk. Each layer must explain what it proves, what is unresolved, and why it matters to the manuscript's evaluation.

Layer-aware analysis should distinguish between:

- a layer that is functioning;
- a layer that is present but underdeveloped;
- a layer that contradicts another layer;
- a layer that creates reader confusion;
- a layer that is decorative rather than structural.

Layer sections must remain author-facing. Avoid internal labels unless they are also reader-facing concepts in the manuscript.

---

## Story Ledger or Layer-Aware Architecture Map Contract

When included, the Story Ledger or layer-aware architecture map must summarize the manuscript's major operating layers in readable editorial language.

It may identify:

- principal story lanes;
- major timeline lanes;
- voice or narrator lanes;
- symbolic or object systems;
- institutional, doctrinal, mythic, or canon systems;
- recurring emotional, sensory, or thematic patterns;
- key continuity dependencies;
- payoff dependencies;
- unresolved architecture risks.

The architecture map should answer three questions:

1. **What architecture is present?**
2. **How does that architecture affect reader experience?**
3. **Where does the architecture strengthen or weaken the manuscript's readiness?**

The map must not become a raw database dump. It must be selective, legible, and tied to evaluation.

---

## Governed-Ledger Boundary

Governed ledgers or compact governed-ledger addenda may appear when they materially improve evaluation clarity.

They must be author-facing and compact unless the output mode specifically requires expanded governed-ledger appendices.

Governed-ledger surfaces may summarize:

- character movement;
- relationship movement;
- symbol/object lifecycle;
- sensory/emotional distribution;
- integrity or contradiction risks;
- evidence distribution;
- promise/payoff dependencies;
- continuity dependencies.

Governed ledgers must not expose raw artifact keys, extraction internals, protected schema language, execution timestamps, reducer status, or gate audit logs.

A governed ledger is evidence support for evaluation. It is not a guarantee of quality, completeness, readiness, publication, or Storygate acceptance.

---

## Review Gate Boundary

Review Gate is a validation and handoff surface. It should not open merely because some story layers exist. It requires the relevant artifacts and readiness proof defined by the current Phase Architecture and DREAM governance docs.

Author-facing copy should describe Review Gate as a readiness/review checkpoint, not as hidden machine integrity language.

Review Gate readiness surfaces may appear where applicable, but they must not imply:

- automatic pass;
- guaranteed recovery;
- publication readiness;
- Storygate acceptance;
- WAVE certification;
- governed-ledger completeness beyond supported evidence.

If Review Gate evidence is incomplete, degraded, or unavailable, the report must say so in author-facing language and avoid overconfident conclusions.

---

## Cross-Layer Synthesis Contract

Cross-Layer Synthesis explains how the manuscript's major layers interact.

It should identify:

- where layers reinforce one another;
- where layers compete for attention;
- where one layer overpowers another;
- where layer transitions confuse the reader;
- where a symbol, voice, timeline, or doctrine system strengthens the central story;
- where layered architecture creates readiness risk.

Cross-Layer Synthesis must be diagnostic, not decorative. It should help the author understand how the manuscript's architecture works as a whole.

It must not repeat the 13 criteria section verbatim. It should synthesize across criteria and across layers.

---

## Layer-Aware Revision Sequencing Contract

Layer-Aware Revision Sequencing identifies the safest order of repair when layered architecture is present.

It should prioritize repairs that protect manuscript architecture before recommending local polish.

Example sequencing principles:

- Repair continuity contradictions before line edits.
- Repair promise/payoff gaps before tightening prose.
- Repair voice-lane confusion before dialogue polish.
- Repair timeline logic before pacing compression.
- Repair symbol/object lifecycle confusion before thematic sharpening.
- Repair ending-state clarity before market-positioning polish.

The sequencing plan must use professional editorial language.

Format:

```text
Priority 1: [Descriptive Name]
Layer / Location: [Layer, chapter, section, or manuscript region]
Operation: [Add/Edit/Compress/Replace/Clarify/Reorder]
Recommendation: [Editorial guidance]
Rationale: [Reason for fix]
```

Cross-references must use readable language, for example, "see Priority 3: Clarify the Doctrine Layer," instead of system-internal references.

---

## Long-Form Continuity and Coverage Proof

Long-Form Continuity and Coverage Proof should identify manuscript-scale findings in plain editorial language, including where material has:

- promises opened and not paid off;
- payoff that arrives too late, too early, or without adequate preparation;
- protagonist or major-character arc drift;
- relationship movement or stagnation;
- recurring symbol or object lifecycle issues;
- timeline contradictions or gaps;
- voice-lane instability;
- layer-to-layer contradiction;
- pacing valleys or escalation plateaus;
- closure and readiness risks.

Coverage proof must not claim total certainty where evidence is incomplete. It should state confidence limitations clearly.

These findings should be rendered for authors as editorial diagnosis, not protected governance language.

---

## Readiness / Releasability Posture

Readiness / Releasability Posture summarizes whether the manuscript appears ready for professional review, needs targeted revision, or requires substantial structural repair before submission or market-facing packaging.

It should account for:

- Overall Score;
- Overall Score Confidence;
- Market Readiness;
- Market Readiness Confidence;
- Genre;
- Genre Confidence;
- Target Audience;
- Target Audience Confidence;
- Shelf;
- Shelf Confidence;
- criterion scores;
- criterion confidence levels;
- revision opportunity density;
- layer integrity;
- continuity risk;
- closure risk;
- professional positioning risk.

Readiness / Releasability Posture must not guarantee publication, representation, reader reception, sales, Storygate acceptance, bestseller status, or adaptation viability.

It should be framed as a professional-readiness assessment, not an outcome promise.

---

## Reading Grade Level Contract

Reading Grade Level is computed algorithmically from the manuscript text. It requires no LLM inference.

Display format:

```text
Reading Grade Level: X.X (Flesch-Kincaid)
```

Rendering rule:

Reading Grade Level is Title Block metadata only for long-form multi-layer evaluation. Renderers must not create a second standalone Reading Grade Level section unless this template is explicitly revised to authorize one.

Critical disclaimer:

Reading Grade Level measures prose complexity, not audience appropriateness. A manuscript may score at a young-adult reading level while containing graphic violence, sexual content, substance abuse, or other material unsuitable for younger readers. Always cross-reference Content Warnings above for content suitability guidance.

---

## Dialogue vs. Narrative Ratio Contract

Dialogue/Narrative Ratio is computed algorithmically by identifying quoted speech versus narrative prose. It requires no LLM inference.

Display format:

```text
Dialogue/Narrative Ratio: XX% dialogue / XX% narrative
```

Rendering rule:

Dialogue/Narrative Ratio is Title Block metadata only for long-form multi-layer evaluation. Renderers must not create a second standalone Dialogue vs. Narrative Ratio section unless this template is explicitly revised to authorize one.

Contextual guidance:

Genre expectations vary. Dialogue ratio should be interpreted within the context of genre, narrative mode, and author intent.

Do not present a universal target dialogue ratio. Do not imply that literary fiction, memoir, serious nonfiction, experimental fiction, thriller, romance, or commercial fiction must conform to a single dialogue percentage.

---

## Market Readiness Contract

Market Readiness is a professional-readiness indicator and is separate from Overall Score.

Thresholds:

- Market Ready: 90-100
- Near Market Ready: 80-89
- Not Market Ready: Below 80

Market Readiness does not guarantee:

- publication;
- representation;
- commercial success;
- reader reception;
- agent interest;
- Storygate acceptance;
- screenplay viability;
- bestseller status.

Market Readiness indicates RevisionGrade's assessment of the submitted manuscript's readiness for professional review.

Market Readiness must appear:

- in the Title Block directly beneath Overall Score;
- with Market Readiness Confidence;
- in web views;
- in PDF;
- in DOCX;
- in TXT;
- in print-friendly views.

Renderers must not independently calculate, rename, override, or reinterpret Market Readiness.

The canonical report document is the sole authority.

---

## Confidence Explanation Contract

Confidence explanations must use the five canonical confidence labels.

### Very High Confidence

The submitted manuscript provides broad, repeated, and stable evidence across the manuscript and, where applicable, across relevant layers. Diagnostic judgments are strongly supported and unlikely to change materially with ordinary additional context.

### High Confidence

The submitted manuscript provides sufficient evidence for a strong diagnostic judgment. Findings are supported by multiple observable signals across the submission and, where applicable, across relevant layers.

### Moderate Confidence

Evidence is present but limited by manuscript scope, missing context, ambiguity, partial coverage, incomplete manuscript condition, or layer complexity.

### Low Confidence

Evidence is thin, localized, unstable, or materially limited. Findings should be treated as cautious and may change with fuller manuscript coverage or stronger evidence.

### Insufficient Evidence

The submission is too fragmented, incomplete, degraded, contradictory, or context-limited to support a reliable conclusion for the field, criterion, or layer being evaluated.

---

## WAVE Boundary

WAVE may inform long-form multi-layer evaluation, but public report copy must render WAVE-derived findings as plain editorial diagnosis:

- structural weakness;
- momentum drag;
- scene-function failure;
- voice / POV issue;
- prose-control issue;
- revision order;
- readiness risk;
- evidence-confidence issue;
- character / relationship payoff risk.

WAVE must not be presented as the revision workflow. WAVE is part of evaluation/readiness reasoning; Revise Queue and TrustedPath are the repair workflows.

Do not label author-facing repair work as WAVE execution.

WAVE, Gate 15 / Canon Governance, Dialogue Canon, and Final External Audit defects that affect author-facing correctness must block Phase 5 author exposure until resolved or explicitly downgraded by a canonical nonblocking rule. They must not be shipped as advisory-only failures.

---

## DREAM / Governed-Ledger Boundary

Standard long-form multi-layer evaluation may include Story Ledger, Review Gate, and compact governed-ledger surfaces where material, but it does not automatically require every DREAM governed-ledger appendix to be printed in full.

When manuscript complexity requires separate layer mapping, Story Ledger extraction, Review Gate readiness, governed-ledger proof, or DREAM-level continuity architecture, route/report copy should identify the output as:

```text
long_form_multi_layer_evaluation
```

DREAM and governed-ledger details must be rendered as author-facing editorial diagnosis unless the user-facing product explicitly exposes an appendix or advanced report surface.

---

## Phase 5 Author-Exposure Gate

No long-form multi-layer report may be exposed to the author unless `author_exposure_certification_v1` passes.

Phase 5 certification must verify that the report was assembled from the Long-Form Multi-Layer Evaluation Template contract through `UnifiedEvaluationDocument`, that all required Title Block fields and confidence labels are present, and that web, PDF, DOCX, TXT, and print-friendly views preserve the same author-facing content and order.

Renderer parity violations, missing required fields, noncanonical confidence labels, unresolved author-facing WAVE/Gate 15/Dialogue Canon/Final External Audit failures, or unauthorized standalone sections block author exposure. They must not be treated as advisory warnings.

---

## Explicit Non-Promises

Long-form multi-layer evaluation must not promise:

- publication;
- agent representation;
- commercial success;
- bestseller status;
- screenplay viability;
- Storygate acceptance;
- WAVE certification;
- Revise Queue execution;
- governed-ledger completeness beyond supported evidence;
- Review Gate passage unless actually supported;
- reader approval;
- market demand.

If the manuscript is strong, the report may say so. It must still avoid outcome guarantees.

---

## Formatting Guards

- **CMOS:** Web, PDF, DOCX, TXT, and print views must use Chicago Manual of Style-governed grammar, spelling, punctuation, capitalization, heading style, number style, and table presentation.
- **Headings:** All section headings must start with capital letters and use CMOS-compliant Title Case.
- **Lists:** Use bullets only for short, parallel items where order does not matter. Use numbered markers when sequence, ranking, priority, or first/second/third language matters.
- **List Formatting:** Evaluation reports must not indent bullets or numbered markers. Markers align with the left edge of the section body. Web and HTML/PDF renderers must not use browser-default indented lists, `list-inside`, `pl-5`, or `padding-left: 0.2in`; DOCX renderers must use explicit marker text with zero paragraph and hanging indent instead of native bullet/numbering definitions.
- **Spacing:** Every report section must have visible breathing room before and after it.
- **Metadata Stripping:** Do not include raw pipeline flags, execution timestamps, gate audit logs, reducer status, model/provider labels, or protected internal terminology in author-facing copy.
- **Tables:** Criteria tables must be full width with Score and Confidence columns right-aligned.
- **Revision Plan:** Convert all internal tags into professional editorial headers: Location, Layer / Location, Operation, Recommendation, and Rationale.
- **Cross-References:** Replace system-internal references with readable language.
- **Score Layout:** Render as a single-line block: `Overall Score: 85/100`. Never split scores across lines.
- **Surface Parity:** PDF, DOCX, TXT, web, and print-friendly views must include the same author-facing content in the same order.
- **Download Expansion:** PDF, DOCX, TXT, and print-friendly views must expand surfaced criterion opportunities and diagnostic details.
- **Template Authority:** `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md` is the authoritative product contract for long-form multi-layer reports. `UnifiedEvaluationDocument` is the mandatory renderer adapter, not a competing template.
- **Canonical Authority:** The canonical report document is the sole content authority. Renderers may format content but may not independently generate, summarize, suppress, rename, reorder, reinterpret, or recalculate report content.
- **Renderer Authority:** Renderers may not independently add, remove, rename, reorder, summarize, or recalculate author-facing report content.
- **Release Blocking:** Renderer violations, field omissions, parity failures, or unresolved author-facing governance defects block Phase 5 author exposure.
- **Layer Labels:** Layer labels must be author-facing and manuscript-relevant. Do not expose protected internal tags.
- **Governance Language:** Protected WAVE, DREAM, Review Gate, and governed-ledger terms must be surfaced only where product-facing doctrine permits them and must be explained in plain author-facing language.

---

## Surface Parity Contract

PDF, DOCX, TXT, web, and print-friendly views must preserve:

- the same author-facing sections;
- the same section order;
- the same score values;
- the same confidence labels;
- the same Genre, Target Audience, and Shelf values;
- the same Genre Confidence, Target Audience Confidence, and Shelf Confidence labels;
- the same Market Readiness label;
- the same Market Readiness Confidence label;
- the same revision opportunity counts;
- the same Top Strengths, Top Risks, and Top Recommendations;
- the same surfaced criterion opportunities;
- the same readiness posture.

Renderers may change layout, typography, spacing, and page flow. Renderers may not change substance.

---

## Revise Boundary

Long-form multi-layer evaluation prepares diagnosis, evidence, ledgers, and prioritized targets. It does not apply repairs.

A/B/C repair proposals, author controls, TrustedPath, accepted/rejected/custom decisions, and manuscript-change application belong to Revise Queue.

The evaluation report may identify repair targets and sequencing. It must not imply that repairs have been applied to the manuscript.

When revision opportunities are produced, the required handoff artifact is `revision_opportunity_ledger_v1`. The report may surface summary counts and selected opportunities, but Revise Queue owns the deeper inventory and any author-controlled repair workflow.
