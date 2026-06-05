# Long-Form Evaluation Template

**Canonical mode:** `long_form_evaluation`
**Route:** `LONG_FORM`
**Output mode:** `standard_long_form`
**Typical scope:** manuscript or substantial submission of 25,000+ words that can be evaluated without a separate layer architecture map
**Authority:** `docs/governance/evaluation-output-mode-contract.md`
**Rendering authority:** `docs/templates/evaluation/evaluation-rendering-contract.md`
**Style authority:** The Chicago Manual of Style governs formatting, grammar, spelling, punctuation, capitalization, heading style, number style, table presentation, and author-facing editorial prose.
**Related authority:** Existing DREAM long-form specifications remain authoritative where governed ledgers are required.
**Runtime impact:** Authoritative rendering contract for web, PDF, DOCX, TXT, and print-friendly views.

---

## Product Promise

A long-form evaluation diagnoses the manuscript at manuscript scale. It evaluates the full 13 story criteria while accounting for continuity, promises, payoff, character/relationship movement, pacing architecture, and readiness risk across the submitted manuscript.

It is deeper than short-form evaluation, but it is not necessarily the full multi-layer, Story Ledger, or governed-ledger path.

---

## Required Report Shape

### Title Block

```text
# Evaluation Report: [Manuscript Title]

Report Type: Long-Form Evaluation
Overall Score: [XX]/100
Verdict: [Pass/Review]
Genre: [Genre]
Shelf: [Target Market]
Submitted Word Count: [XXXX]
Estimated Manuscript Pages: [XXX] at 250 words/page
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
7. Executive Verdict
8. Top Strengths
9. Top Risks
10. Top Recommendations
11. 13 Criteria Score Grid
12. Expanded Criterion Analysis
13. Manuscript-Scale Continuity Findings
14. Revision Priority Plan
15. Confidence Explanation
16. Author-facing disclaimer

PDF, DOCX, TXT, web, and print-friendly views must preserve this content and order.

---

## Pitch Contract

The report must include both pitch surfaces:

```text
## One-Paragraph Pitch

[A concise 3-5 sentence author-facing pitch that captures the full manuscript's core premise, protagonist or central force, conflict, stakes, and tonal register.]

## One-Sentence Pitch

[A single-sentence hook that captures the manuscript's core dramatic situation.]
```

Use the submitted premise when available. Fall back to the executive verdict or summary only when the premise is unavailable.

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

Priority labels indicate the recommended urgency of each revision opportunity.

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

## Criterion Opportunity Contract

Each criterion may show zero to three surfaced opportunities in the report surface. The full generated recommendation set, up to the mode cap, is available in the Revise Queue. Do not flood the report with the full Revise inventory.

Each surfaced opportunity should use this six-part diagnostic structure when evidence supports it:

1. **Evidence**: where in the manuscript the issue appears.
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

**Total cap:** 100 revision opportunities across all criteria combined for long-form evaluations.

---

## Long-Form Continuity Surfaces

Long-form evaluation should identify manuscript-scale findings in plain editorial language, including where material has:

- promises opened and not paid off;
- payoff that arrives too late, too early, or without adequate preparation;
- protagonist or major-character arc drift;
- relationship movement or stagnation;
- recurring symbol or object lifecycle issues;
- pacing valleys or escalation plateaus;
- closure and readiness risks.

These findings should be rendered for authors as editorial diagnosis, not protected governance language.

---

## Revision Priority Plan

The revision plan must be formatted as a clean editorial workplan. Replace all bracketed system tags with professional editorial headers:

```text
Priority 1: [Descriptive Name]
Location: [Chapter/Section]
Operation: [Add/Edit/Compress/Replace]
Recommendation: [Editorial guidance]
Rationale: [Reason for fix]
```

Cross-references must use readable language, for example, "see Priority 3: Deepen Ending Payoff," instead of system-internal references.

---

## Reading Grade Level Contract

Reading Grade Level is computed algorithmically from the manuscript text. It requires no LLM inference.

Display format: `Reading Grade Level: X.X (Flesch-Kincaid)`

Critical disclaimer: "Reading Grade Level measures prose complexity, not audience appropriateness. A manuscript may score at a young-adult reading level while containing graphic violence, sexual content, or other material unsuitable for younger readers. Always cross-reference Content Warnings above for content suitability guidance."

---

## Dialogue vs. Narrative Ratio Contract

Dialogue/Narrative Ratio is computed algorithmically by identifying quoted speech versus narrative prose. It requires no LLM inference.

Display format: `Dialogue/Narrative Ratio: XX% dialogue / XX% narrative`

Include contextual guidance: "Most commercially successful novels contain 25-35% dialogue. Genre expectations vary: literary fiction trends lower, while thrillers and romance often trend higher."

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

- **CMOS:** Web, PDF, DOCX, TXT, and print views must use Chicago Manual of Style-governed grammar, spelling, punctuation, capitalization, heading style, number style, and table presentation.
- **Headings:** All section headings must start with capital letters and use CMOS-compliant Title Case.
- **Bullets:** Evaluation reports must not indent bullets. Bullet markers align with the left edge of the section body.
- **Spacing:** Every report section must have visible breathing room before and after it.
- **Metadata Stripping:** Do not include raw pipeline flags, execution timestamps, gate audit logs, or protected internal terminology in author-facing copy.
- **Tables:** Criteria tables must be full width with Score and Confidence columns right-aligned.
- **Revision Plan:** Convert all internal tags into professional editorial headers: Location, Operation, Recommendation, and Rationale.
- **Cross-References:** Replace system-internal references with readable language.
- **Score Layout:** Render as a single-line block: `Overall Score: 85/100`. Never split scores across lines.
- **Surface Parity:** PDF, DOCX, TXT, web, and print-friendly views must include the same author-facing content in the same order.

---

## Revise Boundary

Long-form evaluation may produce prioritized repair targets. It does not apply repairs. A/B/C repair proposals, author controls, TrustedPath, and manuscript-change application belong to Revise Queue.
