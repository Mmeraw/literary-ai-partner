# Long-Form Evaluation Template

**Canonical mode:** `long_form_evaluation`
**Route:** `LONG_FORM`
**Output mode:** `standard_long_form`
**Typical scope:** manuscript or substantial submission of 25,000+ words that can be evaluated without a separate layer architecture map
**Authority:** `docs/governance/evaluation-output-mode-contract.md`
**Related authority:** existing DREAM long-form specifications remain authoritative where governed ledgers are required.
**Runtime impact:** Documentation only.

---

## Product Promise

A long-form evaluation diagnoses the manuscript at manuscript scale. It evaluates the full 13 story criteria while accounting for continuity, promises, payoff, character/relationship movement, pacing architecture, and readiness risk across the submitted manuscript.

It is deeper than short-form evaluation, but it is not necessarily the full multi-layer / Story Ledger / governed-ledger path.

---

## Required Report Shape

### Title Block

```
# Evaluation Report: [Manuscript Title]

**Report Type:** Long-Form Evaluation
**Overall Score:** [XX]/100
**Verdict:** [Pass/Review]
**Genre:** [Genre]
**Shelf:** [Target Market]
**Submitted Word Count:** [XXXX]
**Estimated Manuscript Pages:** [XXX] at 250 words/page
**Reading Grade Level:** [X.X] (Flesch-Kincaid)
**Dialogue/Narrative Ratio:** [XX]% dialogue / [XX]% narrative
**Date Generated:** [Month Day, Year]
```

### Report Sections

1. Title Block (Title, Report Type, Score, Verdict, Genre, Shelf, Word Count, Pages, Reading Grade Level, Dialogue/Narrative Ratio, Date)
2. Premise (1–2 sentence elevator pitch of the manuscript)
3. Trigger Warnings (Content advisories for readers, if applicable)
4. Executive Verdict (Narrative synthesis of manuscript status)
5. Top Strengths & Top Risks (Parallel bulleted lists)
6. Top Recommendations (Cross-criterion synthesis)
7. 13 Criteria Score Grid (Full-width table: Criterion | Score | Confidence)
8. Expanded Criterion Analysis (Rationales and surfaced opportunities per criterion)
9. Manuscript-Scale Continuity Findings (Editorial diagnosis of promises/payoffs/arc drift)
10. Revision Priority Plan (Location, Operation, Recommendation, Rationale)
11. Confidence Explanation

---

## Required 13 Criteria

Long-form evaluation uses the canonical 13 story criteria:

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

---

## 13 Criteria Score Grid

The score grid must be a full-width table with right-aligned Score and Confidence columns:

| Criterion | Score | Confidence |
| :--- | ---: | ---: |
| Concept & Core Premise | XX/10 | High |
| Narrative Drive & Momentum | XX/10 | High |
| Character Depth & Psychological Coherence | XX/10 | Moderate |
| Point of View & Voice Control | XX/10 | High |
| Scene Construction & Function | XX/10 | High |
| Dialogue Authenticity & Subtext | XX/10 | Moderate |
| Thematic Integration | XX/10 | High |
| World-Building & Environmental Logic | XX/10 | High |
| Pacing & Structural Balance | XX/10 | Moderate |
| Prose Control & Line-Level Craft | XX/10 | High |
| Tonal Authority & Consistency | XX/10 | High |
| Narrative Closure & Promises Kept | XX/10 | Moderate |
| Professional Readiness & Market Positioning | XX/10 | High |

Column widths: Criterion (55%), Score (15%), Confidence (30%).

---

## Top Recommendations Contract

Top Recommendations are executive summaries of the highest-impact manuscript-scale findings.

They must:

- synthesize cross-criterion patterns;
- avoid verbatim duplication of individual criterion opportunities;
- identify the highest-value author actions;
- remain compact enough for report scanning;
- avoid A/B/C rewrite proposals.

---

## Recommendation Density & Total Cap

Recommendation density floors (for criteria scoring ≤8):

- Score ≤5/10: 5–10 recommendations per criterion
- Score 6–7/10: 4–8 recommendations per criterion
- Score 8/10: 2–5 recommendations per criterion
- Score 9–10/10: no recommendations (fit statement only)

**Total cap:** 100 revision opportunities across all criteria combined for long-form evaluations. Prioritize by severity: MUST first, then SHOULD, then COULD.

---

## Criterion Opportunity Contract

Each criterion may show zero to three surfaced opportunities in the report surface. The full set of generated recommendations (up to 100 total) is available in the Revise Queue. Do not flood the report with the full Revise inventory.

Each surfaced opportunity should use this six-part diagnostic structure when evidence supports it:

1. **Evidence** — where in the manuscript the issue appears.
2. **Symptom** — the observable problem or underperformance.
3. **Cause** — the mechanism producing the symptom.
4. **Fix direction** — the bounded repair direction.
5. **Reader effect** — what changes for the reader if repaired.
6. **Mistake-proofing** — what must not be damaged during repair.

Online report rendering should be compact: one primary opportunity visible by default, with additional surfaced opportunities behind a click. Print and downloads should show all surfaced opportunities and diagnostic details.

---

## Premise Contract

The Premise is a 1–2 sentence elevator pitch that captures the core dramatic situation of the manuscript. It must:

- name the protagonist or central force;
- identify the primary conflict or tension;
- convey the emotional/tonal register;
- be author-facing and suitable for query letters, back-cover copy, or marketing;
- never exceed 3 sentences.

---

## Trigger Warnings Contract

Trigger Warnings identify content that may require reader advisories. They appear near the top of the report, immediately after the Premise.

Requirements:

- List specific content categories present in the manuscript (e.g., graphic violence, sexual assault, substance abuse, self-harm, animal cruelty, body horror, child endangerment).
- Only include warnings supported by textual evidence in the manuscript.
- Use plain, direct language — not euphemism or clinical jargon.
- If no trigger-worthy content is detected, display: "No content warnings identified."
- Conclude with advisory note: "Consider including content warnings in book marketing or front matter."

---

## Reading Grade Level Contract

Reading Grade Level is computed algorithmically (Flesch-Kincaid Grade Level formula) from the manuscript text. It requires no LLM inference.

Display format: `Reading Grade Level: X.X (Flesch-Kincaid)`

Include a brief contextual note: "This means the average passage requires reading skills at the [Nth]-grade level. This does not indicate intended audience age — it measures prose complexity only."

**Critical disclaimer (must always appear):** "Reading Grade Level measures prose complexity, NOT audience appropriateness. A manuscript may score at a young-adult reading level (grades 6–8) while containing graphic violence, sexual content, or other material unsuitable for younger readers. Always cross-reference Trigger Warnings above for content suitability guidance."

---

## Dialogue vs. Narrative Ratio Contract

Dialogue/Narrative Ratio is computed algorithmically by identifying quoted speech versus narrative prose. It requires no LLM inference.

Display format: `Dialogue/Narrative Ratio: XX% dialogue / XX% narrative`

Include contextual guidance: "Most commercially successful novels contain 25–35% dialogue. Genre expectations vary: literary fiction trends lower (15–25%), thrillers and romance trend higher (30–45%)."

---

## Long-Form Continuity Surfaces

Long-form evaluation should identify manuscript-scale findings in plain editorial language, including where material:

- promises opened and not paid off;
- payoff that arrives too late, too early, or without adequate preparation;
- protagonist or major-character arc drift;
- relationship movement or stagnation;
- recurring symbol/object lifecycle issues;
- pacing valleys or escalation plateaus;
- closure and readiness risks.

These findings should be rendered for authors as editorial diagnosis, not protected governance language.

---

## Revision Priority Plan

The revision plan must be formatted as a clean editorial workplan. Replace all bracketed system tags with professional editorial headers:

```
**Priority 1: [Descriptive Name]**
*   **Location:** [Chapter/Section]
*   **Operation:** [Add/Edit/Compress/Replace]
*   **Recommendation:** [Editorial guidance]
*   **Rationale:** [Reason for fix]
```

Cross-references must use readable language (e.g., "see Priority 3: Deepen Ending Payoff") instead of system-internal references (e.g., `see revision_plan P3`).

---

## WAVE Boundary

Long-form evaluation may be WAVE-informed. It may identify structural weakness, momentum drag, scene-function failure, voice/POV control issues, prose-control issues, revision order, readiness risk, and evidence-confidence issues.

It must not present WAVE as the revision workflow. WAVE is part of evaluation/readiness reasoning; Revise Queue and TrustedPath are the repair workflows.

---

## DREAM / Governed-Ledger Boundary

Standard long-form evaluation may include compact coverage notes where material, but it does not automatically require the full long-form multi-layer governed-ledger report shape.

When manuscript complexity requires separate layer mapping, Story Ledger extraction, Review Gate readiness, or governed-ledger proof, route/report copy should identify the output as `long_form_multi_layer_evaluation` instead.

---

## Formatting Guards

- **Normalization:** All headings must be Title Case. Replace all system-internal keys (e.g., `narrativeDrive`) with human-readable labels (e.g., Narrative Drive & Momentum).
- **Metadata Stripping:** Do not include raw pipeline flags, execution timestamps, or system-internal terminology in author-facing copy.
- **Tables:** Criteria tables must be full-width with Score and Confidence columns right-aligned.
- **Revision Plan:** Convert all `[KEY: value]` tags into professional editorial headers: Location, Operation, Recommendation, and Rationale.
- **Cross-References:** Replace system-internal references (e.g., `see revision_plan P3`) with readable language (e.g., "see Priority 3: Deepen Ending Payoff").
- **Score Layout:** Render as a single-line block: `Overall Score: 85/100`. Never split scores across lines.
- **Typography:** Maintain clean professional fonts, 1.08–1.15 line spacing, and enforced block spacing before every heading. Retain Unicode punctuation (™, em dashes, en dashes).

---

## Revise Boundary

Long-form evaluation may produce prioritized repair targets. It does not apply repairs. A/B/C repair proposals, author controls, TrustedPath, and manuscript-change application belong to Revise Queue.
