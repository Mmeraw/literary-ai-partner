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

Reference ID: [UUID]

Report Type: Long-Form Evaluation
Overall Score: [XX]/100
Overall Score Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Market Readiness: [Market Ready / Near Market Ready / Not Market Ready]
Market Readiness Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Genre: [Genre]
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
13. Manuscript-Scale Continuity Findings
14. Revision Priority Plan
15. Confidence Explanation
16. Author-Facing Disclaimer

PDF, DOCX, TXT, web, and print-friendly views must preserve this content and order.

---

## Title Block Metadata Contract

The Title Block fields above are required for every completed long-form evaluation.

- **Genre** is required and must carry **Genre Confidence**.
- **Target Audience** is required and must carry **Target Audience Confidence**.
- **Shelf** is required for long-form manuscript evaluation and must carry **Shelf Confidence**.
- **Overall Score** is required and must carry **Overall Score Confidence**.
- **Market Readiness** is required and must carry **Market Readiness Confidence**.
- The canonical evaluation document must populate **Genre**, **Target Audience**, **Overall Score**, and **Market Readiness** during report generation.
- The canonical evaluation document must populate **Shelf** during report generation as the manuscript's professional bookstore/library/market-positioning shelf when evidence supports a shelf diagnosis.
- **Shelf** is not the same field as **Target Audience**. **Target Audience** identifies the intended reader group; **Shelf** identifies where the manuscript would be positioned professionally.
- Renderers must not invent, override, omit, or reinterpret **Genre**, **Target Audience**, **Shelf**, **Overall Score**, **Market Readiness**, or their confidence labels.
- A missing required value or confidence label is a report-completeness defect.
- **Reading Grade Level** is Title Block metadata only for standard long-form evaluation.
- **Dialogue/Narrative Ratio** is Title Block metadata only for standard long-form evaluation.
- Renderers must not create standalone Reading Grade Level or Dialogue/Narrative Ratio sections unless this template is explicitly revised to authorize them.

---

## Pitch Contract

The report must include both pitch surfaces:

```text
## One-Paragraph Pitch

[A concise 3-5 sentence author-facing pitch that captures the full manuscript's core premise, protagonist or central force, conflict, stakes, and tonal register.]

## One-Sentence Pitch

[A single-sentence hook that captures the manuscript's core dramatic situation.]
```

Use the submitted premise when available. Fall back to the Executive Summary only when the premise is unavailable.

---

## Premise Contract

The Premise is a 1-2 sentence elevator pitch that captures the full manuscript's core dramatic situation.

It must:

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

If no warning-worthy content is detected, display:

```text
No content warnings identified.
```

Conclude with:

```text
Consider including content warnings in book marketing or front matter.
```

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

---

## Revision Surface Ownership Contract

### Purpose

This contract establishes ownership boundaries for revision advice, recommendation generation, prioritization, sequencing, and author-facing repair guidance in the Long-Form Evaluation Template.

Its purpose is to eliminate:

- duplicated recommendations;
- competing revision inventories;
- recommendation inflation;
- multiple sections presenting the same repair under different names;
- renderer-generated action lists;
- author confusion regarding revision priorities.

### Canonical Revision Authority

The sole authoritative revision inventory is:

```text
revision_opportunity_ledger_v1
```

Every author-facing repair recommendation must originate from this ledger.

No renderer, template section, synthesis layer, readiness surface, continuity surface, prioritization surface, or sequencing surface may independently generate new revision tasks.

### Opportunity Volume Authority

Opportunity density and opportunity volume are governed by this template.

The authoritative limits remain:

- Score 5/10 or lower: 5–10 recommendations
- Score 6–7/10: 4–8 recommendations
- Score 8/10: 2–5 recommendations
- Score 9–10/10: fit statement only

Total report cap:

```text
100 revision opportunities
```

No downstream surface may create opportunities beyond these limits.

### Revision Surface Ownership

#### 1. Revision Opportunity Summary

**Purpose:** Aggregate counts only.

**Allowed:**

- Total Revision Opportunities
- Recommended
- Optional
- Consider

**Forbidden:**

- recommendation text
- repair instructions
- action lists
- strategic advice

#### 2. Top Recommendations

**Purpose:** Executive synthesis.

**Allowed:**

- summary-level recommendations
- grouped themes
- strategic priorities
- max 5 recommendations

**Forbidden:**

- new recommendations
- new opportunities
- duplicate action lists

Top Recommendations must summarize canonical opportunities. They must never create additional opportunities.

#### 3. Criterion Rationales & Surfaced Opportunities

**Purpose:** Canonical author-facing diagnostic surface.

**Ownership:** This section owns all detailed revision opportunities shown in the report.

Each opportunity must map internally to `revision_opportunity_ledger_v1`.

**Required Opportunity Structure** (when evidence supports it):

1. **Evidence:** where in the manuscript the issue appears.
2. **Symptom:** the observable problem or underperformance.
3. **Cause:** the mechanism producing the symptom.
4. **Fix Direction:** the bounded repair direction.
5. **Reader Effect:** what changes for the reader if repaired.
6. **Mistake-Proofing:** what must not be damaged during repair.

**Forbidden:**

- duplicate the same opportunity under multiple criteria
- clone opportunities with slightly different wording
- create separate revision queues inside each criterion

#### 4. Revision Priority Plan

**Purpose:** Sequencing and prioritization of canonical opportunities only.

**Allowed:**

- priority ordering of existing canonical opportunities
- sequencing rationale
- professional editorial headers (Priority, Location, Operation, Recommendation, Rationale)

**Forbidden:**

- new recommendations not in `revision_opportunity_ledger_v1`
- new action items
- new strategic revisions
- independent repair generation

#### 5. Manuscript-Scale Continuity Findings

**Purpose:** Diagnostic only.

**Allowed:**

- continuity observations
- promise/payoff gaps
- character arc drift
- timeline contradictions
- pacing findings

**Forbidden:**

- new revision tasks
- new action items
- new recommendations
- independent repair generation

### Cross-Criterion Opportunity Rendering

When one repair affects multiple criteria, render the opportunity once.

Display:

```text
Also Affects:
- Pacing & Structural Balance
- Dialogue Authenticity & Subtext
```

The opportunity remains owned by a single primary criterion. Duplicate opportunities must not be created for secondary criteria.

### Severity Authority

Severity assignment is determined by the canonical evaluation-generation pipeline.

Allowed values:

- Recommended
- Optional
- Consider

Renderers, templates, and report surfaces may display severity. They may not recalculate, promote, downgrade, or reinterpret severity. The canonical report document is the sole authority.

### Opportunity Traceability

Every surfaced opportunity must retain a canonical opportunity identifier.

Author-facing surfaces must not display identifiers.

Renderers may expose identifiers through:

- hidden metadata
- HTML data attributes
- admin/debug surfaces

Example:

```html
<div data-opportunity-id="OPP-00124">
```

Identifiers exist for traceability, auditability, de-duplication, and Revise Queue handoff.

### Print-Friendly Surface

Print-friendly view refers to browser-generated print output derived from the canonical report document. It is not an independent report type. It must satisfy the same content, section order, revision ownership rules, and parity requirements as web, PDF, DOCX, and TXT surfaces.

### Prohibited Top-Level Revision Sections

Long-form reports must never contain the following as separate top-level author-facing sections:

- **Action Items**
- **Strategic Revisions**
- **Revision Queue** (as a printed report section)
- **Deep Criterion Analysis** (as a separate recommendation inventory)
- **Expanded Criterion Analysis**
- **Releasability Assessment** (if it repeats all 13 criteria)
- **Review Gate** (as a new recommendation list)
- **Additional Recommendations**
- **Suggested Revisions**
- **Strategic Revision Plan**
- **Editorial Action Plan**

### Runtime Enforcement: REVISION_SURFACE_OWNERSHIP_GATE

This gate runs before Phase 5 Author Exposure. The gate must fail certification if:

1. More than one top-level revision inventory exists.
2. Recommendation text appears in multiple sections.
3. Semantically duplicate recommendations exist.
4. Unauthorized revision sections appear.
5. Renderers generate new recommendations.
6. Recommendations cannot be traced to `revision_opportunity_ledger_v1`.
7. Opportunity volume exceeds canonical limits.
8. Severity is modified downstream.
9. Revision surfaces violate ownership boundaries.

### Phase 5 Author Exposure Rule

A report that violates Revision Surface Ownership **MUST NOT** be shown to the author. This is a release-blocking defect. Not advisory. Not informational. Not a warning.

### Failure Diagnosis

If the gate fails, persist `failure_diagnosis_v1` with: failure_code, renderer, section, field, expected_behavior, actual_behavior, canonical_opportunity_id, remediation_hint.

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

Confidence must use the five canonical confidence labels:

1. **Very High Confidence**
2. **High Confidence**
3. **Moderate Confidence**
4. **Low Confidence**
5. **Insufficient Evidence**

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

## Criterion Rationales & Surfaced Opportunities Contract

Long-form evaluation must use the shared section heading **Criterion Rationales & Surfaced Opportunities**. Long-form-specific continuity and revision-plan sections follow after that shared section; they do not replace or rename it.

Each criterion may show zero to three surfaced opportunities in the report surface. The full generated recommendation set, up to the mode cap, is available in the Revise Queue. Do not flood the report with the full Revise inventory.

Each surfaced opportunity should use this six-part diagnostic structure when evidence supports it:

1. **Evidence:** where in the manuscript the issue appears.
2. **Symptom:** the observable problem or underperformance.
3. **Cause:** the mechanism producing the symptom.
4. **Fix Direction:** the bounded repair direction.
5. **Reader Effect:** what changes for the reader if repaired.
6. **Mistake-Proofing:** what must not be damaged during repair.

Online report rendering should be compact: one primary opportunity visible by default, with additional surfaced opportunities behind a click. Print and downloads should show all surfaced opportunities and diagnostic details.

---

## Recommendation Density & Total Cap

Recommendation density floors for criteria scoring 8/10 or lower:

- Score 5/10 or lower: 2-5 recommendations per criterion
- Score 6-7/10: 1-3 recommendations per criterion
- Score 8/10: 0-2 recommendations per criterion
- Score 9-10/10: no recommendations; fit statement only

**Total cap:** 100 revision opportunities across all criteria combined for long-form evaluations.

---

## Manuscript-Scale Continuity Findings

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

Display format:

```text
Reading Grade Level: X.X (Flesch-Kincaid)
```

Rendering rule:

Reading Grade Level is Title Block metadata only for standard long-form evaluation. Renderers must not create a second standalone Reading Grade Level section unless this template is explicitly revised to authorize one.

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

Dialogue/Narrative Ratio is Title Block metadata only for standard long-form evaluation. Renderers must not create a second standalone Dialogue vs. Narrative Ratio section unless this template is explicitly revised to authorize one.

Contextual guidance:

Genre expectations vary. Dialogue ratio should be interpreted within the context of genre, narrative mode, and author intent.

---

## Market Readiness Contract

Market Readiness is a professional-readiness indicator and is separate from Overall Score.

Thresholds:

- Market Ready: 90-100
- Near Market Ready: 80-89
- Not Market Ready: Below 80

Market Readiness does not guarantee publication, representation, commercial success, reader reception, or agent interest. It indicates RevisionGrade's assessment of the submitted manuscript's readiness for professional review.

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

The submitted manuscript provides broad, repeated, and stable evidence across the manuscript. Diagnostic judgments are strongly supported and unlikely to change materially with ordinary additional context.

### High Confidence

The submitted manuscript provides sufficient evidence for a strong diagnostic judgment. Findings are supported by multiple observable signals across the submission.

### Moderate Confidence

Evidence is present but limited by manuscript scope, missing context, ambiguity, partial coverage, or incomplete manuscript condition.

### Low Confidence

Evidence is thin, localized, unstable, or materially limited. Findings should be treated as cautious and may change with fuller manuscript coverage or stronger evidence.

### Insufficient Evidence

The submission is too fragmented, incomplete, degraded, contradictory, or context-limited to support a reliable conclusion for the field or criterion being evaluated.

---

## WAVE Boundary

Long-form evaluation may be WAVE-informed. It may identify structural weakness, momentum drag, scene-function failure, voice/POV control issues, prose-control issues, revision order, readiness risk, and evidence-confidence issues.

It must not present WAVE as the revision workflow. WAVE is part of evaluation/readiness reasoning; Revise Queue and TrustedPath are the repair workflows.

WAVE, Gate 15 / Canon Governance, Dialogue Canon, and Final External Audit defects that affect author-facing correctness must block Phase 5 author exposure until resolved or explicitly downgraded by a canonical nonblocking rule. They must not be shipped as advisory-only failures.

---

## DREAM / Governed-Ledger Boundary

Standard long-form evaluation may include compact coverage notes where material, but it does not automatically require the full long-form multi-layer governed-ledger report shape.

When manuscript complexity requires separate layer mapping, Story Ledger extraction, Review Gate readiness, governed-ledger proof, or DREAM-level continuity architecture, route/report copy should identify the output as:

```text
long_form_multi_layer_evaluation
```

---

## Phase 5 Author-Exposure Gate

No long-form report may be exposed to the author unless `author_exposure_certification_v1` passes.

Phase 5 certification must verify that the report was assembled from the Long-Form Evaluation Template contract through `UnifiedEvaluationDocument`, that all required Title Block fields and confidence labels are present, and that web, PDF, DOCX, TXT, and print-friendly views preserve the same author-facing content and order.

Renderer parity violations, missing required fields, noncanonical confidence labels, unresolved author-facing WAVE/Gate 15/Dialogue Canon/Final External Audit failures, or unauthorized standalone sections block author exposure. They must not be treated as advisory warnings.

---

## Explicit Non-Promises

Long-form evaluation must not promise:

- publication;
- agent representation;
- commercial success;
- bestseller status;
- screenplay viability;
- Storygate acceptance;
- WAVE certification;
- Revise Queue execution.

---

## Formatting Guards

- **CMOS:** Web, PDF, DOCX, TXT, and print views must use Chicago Manual of Style-governed grammar, spelling, punctuation, capitalization, heading style, number style, and table presentation.
- **Headings:** All section headings must start with capital letters and use CMOS-compliant Title Case.
- **Lists:** Use bullets only for short, parallel items where order does not matter. Use numbered markers when sequence, ranking, priority, or first/second/third language matters.
- **List Formatting:** Evaluation reports must not indent bullets or numbered markers. Markers align with the left edge of the section body. Web and HTML/PDF renderers must not use browser-default indented lists, `list-inside`, `pl-5`, or `padding-left: 0.2in`; DOCX renderers must use explicit marker text with zero paragraph and hanging indent instead of native bullet/numbering definitions.
- **Spacing:** Every report section must have visible breathing room before and after it.
- **Metadata Stripping:** Do not include raw pipeline flags, execution timestamps, gate audit logs, or protected internal terminology in author-facing copy.
- **Tables:** Criteria tables must be full width with Score and Confidence columns right-aligned.
- **Revision Plan:** Convert all internal tags into professional editorial headers: Location, Operation, Recommendation, and Rationale.
- **Cross-References:** Replace system-internal references with readable language.
- **Score Layout:** Render as a single-line block: `Overall Score: 85/100`. Never split scores across lines.
- **Surface Parity:** PDF, DOCX, TXT, web, and print-friendly views must include the same author-facing content in the same order.
- **Template Authority:** `docs/templates/evaluation/long-form-evaluation-template.md` is the authoritative product contract for standard long-form reports. `UnifiedEvaluationDocument` is the mandatory renderer adapter, not a competing template.
- **Canonical Authority:** The canonical report document is the sole content authority. Renderers may format content but may not independently generate, summarize, suppress, rename, reorder, reinterpret, or recalculate report content.
- **Renderer Authority:** Renderers may not independently add, remove, rename, reorder, summarize, or recalculate author-facing report content.
- **Release Blocking:** Renderer violations, field omissions, parity failures, or unresolved author-facing governance defects block Phase 5 author exposure.

---

## Revise Boundary

Long-form evaluation may produce prioritized repair targets. It does not apply repairs. A/B/C repair proposals, author controls, TrustedPath, and manuscript-change application belong to Revise Queue.

When revision opportunities are produced, the required handoff artifact is `revision_opportunity_ledger_v1`. The report may surface summary counts and selected opportunities, but Revise Queue owns the deeper inventory and any author-controlled repair workflow.
