# Short-Form Evaluation Template

**Canonical mode:** `short_form_evaluation`
**Route:** `SHORT_FORM`
**Typical scope:** excerpt, chapter, story, sample, or manuscript under 25,000 words
**Authority:** `docs/governance/evaluation-output-mode-contract.md`
**Runtime impact:** Documentation only.

---

## Product Promise

A short-form evaluation diagnoses the submitted text against RevisionGrade's 13 story criteria. It gives the author a professional, evidence-backed view of what is working, what is underperforming, and what the highest-value repair targets are in the submitted material.

It does **not** claim full-manuscript continuity proof.

---

## Required Report Shape

### Title Block

```
# Evaluation Report: [Manuscript Title]

**Report Type:** Short-Form Evaluation
**Overall Score:** [XX]/100
**Verdict:** [Pass/Review]
**Genre:** [Genre]
**Submitted Word Count:** [XXXX]
**Date Generated:** [Month Day, Year]
```

### Report Sections

1. Title Block (Title, Report Type, Score, Verdict, Genre, Word Count, Date)
2. Executive Summary (Compact narrative synthesis)
3. Top Strengths & Top Risks (Parallel bulleted lists)
4. Top Recommendations (Cross-criterion summary)
5. 13 Criteria Score Grid (Full-width table: Criterion | Score | Confidence)
6. Criterion Rationales & Surfaced Opportunities (Six-part diagnostic structure)
7. Confidence Explanation
8. Download/print rendering that expands surfaced criterion opportunities

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

## Recommendation Density & Total Cap

Recommendation density floors (for criteria scoring ≤8):

- Score ≤5/10: 5–10 recommendations per criterion
- Score 6–7/10: 4–8 recommendations per criterion
- Score 8/10: 2–5 recommendations per criterion
- Score 9–10/10: no recommendations (fit statement only)

**Total cap:** 50 revision opportunities across all criteria combined for short-form evaluations. Prioritize by severity: MUST first, then SHOULD, then COULD.

---

## Criterion Opportunity Contract

Each criterion may show zero to three surfaced opportunities in the report surface. The full set of generated recommendations (up to 50 total) is available in the Revise Queue. Do not invent opportunities when a criterion is already performing well.

Each surfaced opportunity should use this six-part diagnostic structure when evidence supports it:

1. **Evidence** — where in the submitted text the issue appears.
2. **Symptom** — the observable problem or underperformance.
3. **Cause** — the mechanism producing the symptom.
4. **Fix direction** — the bounded repair direction.
5. **Reader effect** — what changes for the reader if repaired.
6. **Mistake-proofing** — what must not be damaged during repair.

Online report rendering should be compact: one primary opportunity visible by default, with additional surfaced opportunities behind a click. Print and downloads should show all surfaced opportunities and diagnostic details.

---

## Explicit Non-Promises

Short-form evaluation must not promise:

- Golden Spine / full-manuscript spine analysis;
- DREAM governed ledgers;
- WAVE-level long-form continuity coverage;
- full Story Ledger extraction;
- whole-manuscript promise/payoff proof;
- Revise Queue execution;
- A/B/C rewrite proposals.

If a short-form submission contains a local structural or continuity issue, the report may name it only as local to the submitted text unless the full manuscript was provided.

---

## Formatting Guards

- **Normalization:** All headings must be Title Case. Replace all system-internal keys (e.g., `narrativeDrive`) with human-readable labels (e.g., Narrative Drive & Momentum).
- **Metadata Stripping:** Do not include WAVE Governance, Gate audit logs, Golden Spine ledgers, or execution timestamps.
- **Tables:** Criteria tables must be full-width with Score and Confidence columns right-aligned.
- **Score Layout:** Render as a single-line block: `Overall Score: 85/100`. Never split scores across lines.
- **Typography:** Maintain clean professional fonts, 1.08–1.15 line spacing, and enforced block spacing before every heading.

---

## Revise Boundary

Short-form evaluation may identify repair targets. It does not apply repairs. A/B/C repair proposals, author controls, TrustedPath, and manuscript-change application belong to Revise Queue.
