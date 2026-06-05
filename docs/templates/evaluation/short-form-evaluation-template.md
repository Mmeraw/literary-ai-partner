# Short-Form Evaluation Template

**Canonical mode:** `short_form_evaluation`
**Route:** `SHORT_FORM`
**Typical scope:** excerpt, chapter, story, sample, or manuscript under 25,000 words
**Authority:** `docs/governance/evaluation-output-mode-contract.md`
**Rendering authority:** `docs/templates/evaluation/evaluation-rendering-contract.md`
**Style authority:** The Chicago Manual of Style governs formatting, grammar, spelling, punctuation, capitalization, heading style, number style, table presentation, and author-facing editorial prose.
**Runtime impact:** Authoritative rendering contract for web, PDF, DOCX, TXT, and print-friendly views.

---

## Product Promise

A short-form evaluation diagnoses the submitted text against RevisionGrade's 13 story criteria. It gives the author a professional, evidence-backed view of what is working, what is underperforming, and what the highest-value repair targets are in the submitted material.

It does **not** claim full-manuscript continuity proof.

---

## Required Report Shape

### Title Block

```text
# Evaluation Report: [Manuscript Title]

Report Type: Short-Form Evaluation
Overall Score: [XX]/100
Verdict: [Pass/Review]
Genre: [Genre]
Submitted Word Count: [XXXX]
Reading Grade Level: [X.X] (Flesch-Kincaid)
Dialogue/Narrative Ratio: [XX]% dialogue / [XX]% narrative
Date Generated: [Month Day, Year]
```

### Required Shared Sections

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
12. Criterion Rationales & Surfaced Opportunities
13. Confidence Explanation
14. Author-facing disclaimer

PDF, DOCX, TXT, web, and print-friendly views must preserve this content and order.

---

## Pitch Contract

The report must include both pitch surfaces:

```text
## One-Paragraph Pitch

[A concise 3-5 sentence author-facing pitch that captures the core premise, central force, conflict, and tonal register.]

## One-Sentence Pitch

[A single-sentence hook that captures the submitted work's core dramatic situation.]
```

Use the submitted premise when available. Fall back to the executive summary only when the premise is unavailable.

---

## Revision Opportunity Summary

Every completed report must include aggregate revision-opportunity counts:

```text
## Revision Opportunity Summary

Total Revision Opportunities: [XX]
High Priority: [X]
Medium Priority: [X]
Low Priority: [X]
```

Priority labels are polite alternatives to MUST / SHOULD / COULD labels.

---

## Required 13 Criteria

Short-form evaluation uses the canonical 13 story criteria:

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

Top Recommendations are executive summaries of the highest-impact findings across the submission.

They must:

- be paraphrased summary-level recommendations;
- avoid verbatim repetition of criterion opportunities;
- focus on the highest-impact author actions;
- remain compact and readable;
- not include A/B/C rewrite options.

---

## Criterion Opportunity Contract

Each criterion may show zero to three surfaced opportunities in the report surface. The full set of generated recommendations, up to the mode cap, is available in the Revise Queue. Do not invent opportunities when a criterion is already performing well.

Each surfaced opportunity should use this six-part diagnostic structure when evidence supports it:

1. **Evidence**: where in the submitted text the issue appears.
2. **Symptom**: the observable problem or underperformance.
3. **Cause**: the mechanism producing the symptom.
4. **Fix Direction**: the bounded repair direction.
5. **Reader Effect**: what changes for the reader if repaired.
6. **Mistake-Proofing**: what must not be damaged during repair.

Online report rendering should be compact: one primary opportunity visible by default, with additional surfaced opportunities behind a click. Print and downloads should show all surfaced opportunities and diagnostic details.

---

## Recommendation Density & Total Cap

Recommendation density floors for criteria scoring 8/10 or lower:

- Score 5/10 or lower: 5-10 recommendations per criterion
- Score 6-7/10: 4-8 recommendations per criterion
- Score 8/10: 2-5 recommendations per criterion
- Score 9-10/10: no recommendations; fit statement only

**Total cap:** 50 revision opportunities across all criteria combined for short-form evaluations.

---

## Premise Contract

The Premise is a 1-2 sentence elevator pitch that captures the core dramatic situation of the submitted work. It must:

- name the protagonist or central force;
- identify the primary conflict or tension;
- convey the emotional or tonal register;
- be author-facing and suitable for query letters, back-cover copy, or marketing;
- never exceed three sentences.

---

## Content Warnings Contract

Content Warnings identify content that may require reader advisories. They appear near the top of the report, after the pitch and premise surfaces.

Requirements:

- List specific content categories present in the manuscript.
- Only include warnings supported by textual evidence in the submission.
- Use plain, direct language, not euphemism or clinical jargon.
- If no warning-worthy content is detected, display: "No content warnings identified."
- Conclude with: "Consider including content warnings in book marketing or front matter."

---

## Formatting Guards

- **CMOS:** Web, PDF, DOCX, TXT, and print views must use Chicago Manual of Style-governed grammar, spelling, punctuation, capitalization, heading style, number style, and table presentation.
- **Headings:** All section headings must start with capital letters and use CMOS-compliant Title Case.
- **Bullets:** Evaluation reports must not indent bullets. Bullet markers align with the left edge of the section body.
- **Spacing:** Every report section must have visible breathing room before and after it.
- **Metadata Stripping:** Do not include WAVE Governance, gate audit logs, Golden Spine ledgers, execution timestamps, raw pipeline flags, or protected internal terminology.
- **Tables:** Criteria tables must be full width with Score and Confidence columns right-aligned.
- **Score Layout:** Render as a single-line block: `Overall Score: 85/100`. Never split scores across lines.
- **Surface Parity:** PDF, DOCX, TXT, web, and print-friendly views must include the same author-facing content in the same order.

---

## Explicit Non-Promises

Short-form evaluation must not promise:

- Golden Spine or full-manuscript spine analysis;
- DREAM governed ledgers;
- WAVE-level long-form continuity coverage;
- full Story Ledger extraction;
- whole-manuscript promise/payoff proof;
- Revise Queue execution;
- A/B/C rewrite proposals.

If a short-form submission contains a local structural or continuity issue, the report may name it only as local to the submitted text unless the full manuscript was provided.

---

## Revise Boundary

Short-form evaluation may identify repair targets. It does not apply repairs. A/B/C repair proposals, author controls, TrustedPath, and manuscript-change application belong to Revise Queue.
