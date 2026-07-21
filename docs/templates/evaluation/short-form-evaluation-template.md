# Short-Form Evaluation Template

**Canonical mode:** `short_form_evaluation`  
**Route:** `SHORT_FORM`  
**Output mode:** `standard_short_form`  
**Typical scope:** excerpt, chapter, story, sample, novella excerpt, nonfiction excerpt, memoir excerpt, or manuscript under 25,000 words  
**Authority:** `docs/governance/evaluation-output-mode-contract.md`  
**Rendering authority:** `docs/templates/evaluation/evaluation-rendering-contract.md`  
**Style authority:** The Chicago Manual of Style governs formatting, grammar, spelling, punctuation, capitalization, heading style, number style, table presentation, and author-facing editorial prose.  
**Product boundary:** This is one of RevisionGrade's two evaluation products. Submissions of 25,000+ words route to `long_form_multi_layer_evaluation`. There is no intermediate long-form mode.  
**Related authority:** Short-form reports evaluate only the submitted text against the canonical 13 story criteria. Runtime may use lightweight internal seed, scaffold, or ledger-support artifacts to preserve context, but short-form reports do not expose or claim Golden Spine, WAVE-level continuity proof, full Story Ledger authority, governed-ledger completeness, or whole-manuscript promise/payoff validation.  
**Runtime impact:** Authoritative rendering contract for web, PDF, DOCX, TXT, and print-friendly views.

---

## Product Promise

A short-form evaluation diagnoses the submitted text against RevisionGrade's 13 story criteria. It gives the author a professional, evidence-backed view of what is working, what is underperforming, and what the highest-value repair targets are in the submitted material.

It evaluates the submitted text only.

It does **not** claim:

- full-manuscript continuity proof;
- Golden Spine coverage;
- WAVE-level long-form continuity coverage;
- Story Ledger completeness;
- whole-manuscript promise/payoff validation;
- DREAM governed-ledger completeness;
- Structural Stack, Arc Map, Layer Analysis, or Cross-Layer Integration;
- Narrative Synthesis sub-scores;
- Market Shelf positioning analysis.

The runtime may create lightweight internal seed or ledger-support artifacts for context preservation, quality control, or downstream handoff. Those artifacts are not author-facing Story Ledger certification and must not be rendered as full Story Ledger authority in a short-form report.

When a short-form submission is part of a larger manuscript, findings are local to the submitted text unless the complete manuscript has been supplied.

When a submission exceeds 25,000 words, it must route to `long_form_multi_layer_evaluation`. No code path may generate a short-form evaluation for a 25,000+ word submission.

---

## Core Principle

A RevisionGrade report must tell the author something **once**.

It may summarize, prioritize, sequence, or explain a recommendation.

It may **not** create multiple competing versions of the same recommendation.

---

## Required Report Shape

### Title Block

```text
# Evaluation Report: [Manuscript Title]

Reference ID: [UUID]

Report Type: Short-Form Evaluation
Overall Score: [XX]/100
Overall Score Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Market Readiness: [Market Ready / Near Market Ready / Not Market Ready]
Market Readiness Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Genre: [Genre]
Genre Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Target Audience: [Pipeline-diagnosed target audience]
Target Audience Confidence: [Very High Confidence / High Confidence / Moderate Confidence / Low Confidence / Insufficient Evidence]
Submitted Word Count: [XXXX]
Estimated Manuscript Pages: [XX] at 250 words/page
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
14. Author-Facing Disclaimer

PDF, DOCX, TXT, web, and print-friendly views must preserve this content and order.

No additional top-level revision inventory may appear.

---

## Internal Pass 2 Recommendation Provenance Contract (Non-Rendered)

This section is not displayed to the author. It governs the Pass 3B synthesis output contract.

- Every final recommendation that retains or consolidates a Pass 2 discovery MUST populate `source_recommendation_ids` with the matching `pass2_recommendation_candidates.source_id` value(s).
- The top-level output MUST contain a `recommendation_lineage` array with exactly one entry per `pass2_recommendation_candidates.source_id`.
- Allowed `recommendation_lineage` outcomes: `materialized` (survives in final recommendations), `consolidated` (merged into another surviving source_id), `suppressed` (dropped with a `governing_rule`, `rationale`, and `evidence`).
- A missing `recommendation_lineage` or missing `source_recommendation_ids` is a contract violation and the synthesis cannot be certified.

---

## Title Block Metadata Contract

The Title Block fields above are required for every completed short-form evaluation.

- **Genre** is required and must carry **Genre Confidence**.
- **Target Audience** is required and must carry **Target Audience Confidence**.
- **Overall Score** is required and must carry **Overall Score Confidence**.
- **Market Readiness** is required and must carry **Market Readiness Confidence**.
- The canonical evaluation document must populate **Genre**, **Target Audience**, **Overall Score**, and **Market Readiness** during report generation.
- The value may be generated by the system and/or LLM as part of canonical document assembly.
- Renderers must not invent, override, omit, or reinterpret **Genre**, **Target Audience**, **Overall Score**, **Market Readiness**, or their confidence labels.
- A missing required value or confidence label is a report-completeness defect.
- **Genre** must still be displayed for every completed short-form evaluation, but **Genre Confidence** must reflect submission scope and word count. Very short samples may identify a provisional genre signal without pretending the evidence is manuscript-scale.
- Canonical short-form scope bands:
	- `micro_excerpt` / `micro_excerpt_diagnostic`: under 1,000 words. Genre Confidence should normally be **Insufficient Evidence** because the sample is too short to assess genre with confidence.
	- `light_chapter` / `short_excerpt_evaluation`: 1,000–3,999 words. Genre Confidence should normally be **Low Confidence** unless the excerpt contains unusually explicit genre evidence.
	- `standard_chapter` / `short_form_pattern_read`: 4,000–7,000 words. Genre Confidence may rise when enough premise, scene pattern, audience signal, and prose register are visible.
	- `multi_chapter`, `novelette`, or `full_short_form_evaluation`: 7,001–24,999 words. Genre Confidence may be moderate or high when repeated signals support the classification.
- When confidence is low because of scope, the Confidence Explanation should say so plainly, for example: "Genre signal is provisional because the submitted text is a micro excerpt / short excerpt and does not provide enough breadth for a confident shelf-level classification."
- **Reading Grade Level** is Title Block metadata only for short-form evaluation.
- **Dialogue/Narrative Ratio** is Title Block metadata only for short-form evaluation.
- Renderers must not create standalone Reading Grade Level or Dialogue/Narrative Ratio sections unless this template is explicitly revised to authorize them.

---

## Canonical Revision Authority

The sole authoritative revision inventory is:

```text
revision_opportunity_ledger_v1
```

Every author-facing repair recommendation must originate from this ledger.

No renderer, template section, synthesis layer, score explanation, readiness assessment, review gate, action list, or revision plan may independently generate new revision tasks.

---

## Revision Surface Ownership

The report contains several surfaces that may discuss revision. Each surface has a different purpose.

Those purposes must not overlap.

---

## 1. Revision Opportunity Summary

### Purpose

Provide aggregate counts only.

### Allowed Fields

```text
Total Revision Opportunities: [XX]
Recommended: [X]
Optional: [X]
Consider: [X]
```

### Allowed Behavior

- Display the count of canonical opportunities.
- Display severity/tier totals.
- Use the exact severity labels: **Recommended**, **Optional**, and **Consider**.

### Forbidden Behavior

This section must not include:

- recommendation text;
- repair instructions;
- action lists;
- strategic advice;
- duplicate opportunity summaries;
- suggested rewrites;
- Revise Queue contents.

This section is informational only.

---

## 2. Top Recommendations

### Purpose

Executive synthesis of the highest-impact revision themes.

### Audience

Authors who want the most important takeaways immediately.

### Allowed Behavior

Top Recommendations may:

- summarize canonical opportunities;
- group related opportunities;
- paraphrase the highest-impact repair themes;
- identify the most important author actions at executive level;
- reference canonical opportunity IDs internally.

### Forbidden Behavior

Top Recommendations must not:

- create new recommendations;
- create new revision opportunities;
- create new counts;
- duplicate full opportunity text;
- become an action-item list;
- include A/B/C rewrite proposals;
- repeat the same recommendation already shown under a criterion.

### Maximum Count

```text
5 Top Recommendations
```

### Traceability Requirement

Each Top Recommendation must reference one or more canonical opportunity IDs internally.

Those IDs must be hidden from author-facing output unless an admin/debug surface explicitly requires them.

---

## 3. Criterion Rationales & Surfaced Opportunities

### Purpose

Canonical author-facing diagnostic surface.

### Ownership

This section owns all detailed revision opportunities shown in the short-form report.

Each surfaced opportunity must map internally to:

```text
revision_opportunity_ledger_v1
```

### Required Opportunity Structure

Each opportunity should use the six-part diagnostic structure when evidence supports it:

1. **Evidence:** where in the submitted text the issue appears.
2. **Symptom:** the observable problem or underperformance.
3. **Cause:** the mechanism producing the symptom.
4. **Fix Direction:** the bounded repair direction.
5. **Reader Effect:** what changes for the reader if repaired.
6. **Mistake-Proofing:** what must not be damaged during repair.

### Allowed Behavior

This section may:

- display surfaced opportunities;
- show zero to three opportunities per criterion;
- show fit statements for strong criteria;
- mark affected criteria internally;
- display "Also affects" when one opportunity touches multiple criteria.

### Forbidden Behavior

This section must not:

- duplicate the same opportunity under multiple criteria;
- clone opportunities with slightly different wording;
- inflate opportunity counts by criterion-local repetition;
- invent opportunities for criteria already performing well;
- create separate revision queues inside each criterion.

### Cross-Criterion Rule

If the same repair applies to multiple criteria, render it **once** and list affected criteria internally or as **Also Affects**.

Do not duplicate the recommendation.

---

## 4. Revise Queue Boundary

### Purpose

Repair execution and author-controlled workflow.

### Ownership

The **Revise Queue** owns the deeper author-controlled repair workflow outside the evaluation report.

### Allowed Behavior in Evaluation Report

The evaluation report may reference Revise Queue availability.

### Forbidden Behavior in Evaluation Report

The evaluation report must not render Revise Queue contents as a second recommendation inventory.

The evaluation report must not imply that repairs have been applied.

---

## Anti-Duplication Rules

A recommendation may appear:

```text
1 time
```

as a canonical opportunity.

It may then be:

- summarized;
- prioritized;
- sequenced;
- cross-referenced;
- grouped.

It may never be recreated as a new action item, strategic revision, queue item, or separate recommendation.

---

## Duplicate Recommendation Prohibition

The following are considered duplicates:

- identical recommendation text;
- semantically equivalent recommendation text;
- identical repair mechanism;
- identical underlying author action;
- identical strategic objective;
- identical manuscript location and fix direction;
- identical cause and reader effect, even if wording differs.

### Example

These are duplicates:

```text
Increase scene tension before the confrontation.
```

```text
Raise suspense leading into the confrontation.
```

Only one canonical opportunity may exist.

---

## Prohibited Top-Level Sections in Short-Form Reports

Short-form reports must never contain the following as separate top-level author-facing sections:

- **Action Items**
- **Strategic Revisions**
- **Revision Queue**
- **Revision Priority Plan**
- **Deep Criterion Analysis**
- **Expanded Criterion Analysis**
- **Releasability Assessment**
- **Review Gate**
- **Additional Recommendations**
- **Suggested Revisions**
- **Strategic Revision Plan**
- **Priority Revision Plan**
- **Repair Plan**
- **Editorial Action Plan**

These concepts belong to longer-form products, Revise Queue, admin/debug surfaces, or internal governance.

They are not authorized as top-level short-form report sections.

---

## Deep Analysis Restriction

Short-form evaluation is diagnostic.

It is not a manuscript-management product.

The report may explain:

```text
Why a score exists.
```

It must not create:

```text
A second recommendation inventory.
```

Any deeper analysis must remain inside the criterion rationale and must not become a new top-level action surface.

---

## Readiness Assessment Restriction

Short-form reports may include:

```text
Market Readiness
```

in the Title Block.

They must not include:

```text
Releasability Assessment
```

as a standalone section.

Reason:

The thirteen story criteria and Market Readiness already evaluate professional readiness for the submitted text.

A second readiness scorecard is redundant and creates conflicting interpretive surfaces.

---

## Review Gate Restriction

Review Gate is an internal governance and validation concept.

Short-form reports must not expose **Review Gate** as a standalone author-facing section.

If Review Gate logic is used internally, its findings must be normalized into:

- criterion confidence;
- report-completeness status;
- author-exposure certification;
- failure diagnosis;
- admin/debug surfaces.

It must not appear as a separate author-facing recommendation section.

---

## Action Item Restriction

**Action Items** are prohibited as a top-level short-form report section.

Their function is already performed by:

- **Top Recommendations**
- **Criterion Rationales & Surfaced Opportunities**
- **Revise Queue** outside the evaluation report

Action Items create duplicate revision inventories and are not authorized.

---

## Pitch Contract

The report must include both pitch surfaces:

```text
## One-Paragraph Pitch

[A concise 3-5 sentence author-facing pitch that captures the core premise, central force, conflict, and tonal register.]

## One-Sentence Pitch

[A single-sentence hook that captures the submitted work's core dramatic situation.]
```

Use the submitted premise when available. Fall back to the Executive Summary only when the premise is unavailable.

---

## Premise Contract

The Premise is a 1-2 sentence elevator pitch that captures the core dramatic situation of the submitted work.

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

## Terminology Contract

### Canonical Author-Facing Terms

Use only these terms in short-form author-facing reports:

- **Revision Opportunities**
- **Top Recommendations**
- **Criterion Rationales & Surfaced Opportunities**
- **Recommended**
- **Optional**
- **Consider**

### Forbidden Synonyms as Inventory Labels

Do not use the following as separate inventory labels:

- Actions
- Action Items
- Strategic Revisions
- Revision Tasks
- Revision Queue
- Revision Priority Plan
- Repair Plan
- Deep Recommendations
- Expanded Recommendations
- Suggested Revisions

---

## Revision Surface Ownership Contract

### Purpose

This contract establishes strict ownership boundaries for revision advice, recommendation generation, author-facing repair guidance, and report architecture in the Short-Form Evaluation Template.

Its purpose is to eliminate:

- duplicated recommendations;
- competing revision inventories;
- repeated action-item sections;
- recommendation inflation;
- multiple sections saying the same thing in different words;
- renderer-specific reinterpretation of revision advice;
- author confusion about which revision list to follow.

This contract is authoritative for:

- **Web**
- **PDF**
- **DOCX**
- **TXT**
- **Print-Friendly Views**
- **UnifiedEvaluationDocument**
- **Revise Queue handoff**
- **Phase 5 Author Exposure certification**

### Core Principle

A RevisionGrade report must tell the author something **once**.

It may summarize, prioritize, sequence, or explain a recommendation.

It may **not** create multiple competing versions of the same recommendation.

### Canonical Revision Authority

The sole authoritative revision inventory is:

```text
revision_opportunity_ledger_v1
```

Every author-facing repair recommendation must originate from this ledger.

No renderer, template section, synthesis layer, score explanation, readiness assessment, review gate, action list, or revision plan may independently generate new revision tasks.

### Opportunity Volume Authority

Opportunity density and opportunity volume are governed by the canonical `OPPORTUNITY_DISCOVERY_POLICY` (`docs/governance/OPPORTUNITY_DISCOVERY_POLICY.md`). The numbers below are **ceilings and expected ranges, not floors or quotas**.

The short-form authoritative guidance is:

- Score 10/10: expected 0–1, hard minimum 0
- Score 9/10: expected 0–1, hard minimum 0
- Score 8/10: expected 1–2, hard minimum 0
- Score 7/10: expected 1–3, hard minimum 0
- Score 6/10: expected 2–4, hard minimum 0
- Score 5/10 or lower: expected 3–5, hard minimum 0

A criterion may return zero recommendations when a governed `recommendation_status` is present and `recommendation_status_rationale` is concrete (≥20 chars). Allowed statuses are defined in `OPPORTUNITY_DISCOVERY_POLICY.governedStatuses`.

Total report cap:

```text
50 revision opportunities
```

No downstream surface may create opportunities beyond the product ceiling or fabricate recommendations absent from the canonical ledger.

### Revision Surface Ownership

The report contains several surfaces that may discuss revision. Each surface has a different purpose. Those purposes must not overlap.

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

Top Recommendations must summarize canonical opportunities. They must reference canonical opportunity IDs internally.

#### 3. Criterion Rationales & Surfaced Opportunities

**Purpose:** Canonical author-facing diagnostic surface.

**Ownership:** This section owns all detailed revision opportunities in the report.

Each opportunity must map internally to `revision_opportunity_ledger_v1`.

**Required Opportunity Structure** (when evidence supports it):

1. **Evidence:** where in the submitted text the issue appears.
2. **Symptom:** the observable problem or underperformance.
3. **Cause:** the mechanism producing the symptom.
4. **Fix Direction:** the bounded repair direction.
5. **Reader Effect:** what changes for the reader if repaired.
6. **Mistake-Proofing:** what must not be damaged during repair.

**Forbidden:**

- duplicate the same opportunity under multiple criteria
- clone opportunities with slightly different wording
- create separate revision queues inside each criterion

#### 4. Revise Queue Boundary

The **Revise Queue** owns the deeper author-controlled repair workflow outside the evaluation report. The evaluation report may reference Revise Queue availability but must not render Revise Queue contents as a second recommendation inventory.

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

### Anti-Duplication Rules

A recommendation may appear **1 time** as a canonical opportunity. It may then be summarized, prioritized, sequenced, cross-referenced, or grouped. It may never be recreated as a new action item, strategic revision, queue item, or separate recommendation.

The following are considered duplicates:

- identical recommendation text
- semantically equivalent recommendation text
- identical repair mechanism
- identical underlying author action
- identical manuscript location and fix direction
- identical cause and reader effect, even if wording differs

### Prohibited Top-Level Revision Sections

Short-form reports must never contain the following as separate top-level author-facing sections:

- **Action Items**
- **Strategic Revisions**
- **Revision Queue**
- **Revision Priority Plan**
- **Deep Criterion Analysis**
- **Expanded Criterion Analysis**
- **Releasability Assessment**
- **Review Gate**
- **Additional Recommendations**
- **Suggested Revisions**
- **Strategic Revision Plan**
- **Priority Revision Plan**
- **Repair Plan**
- **Editorial Action Plan**

These concepts belong to longer-form products, Revise Queue, admin/debug surfaces, or internal governance.

### Deep Analysis Restriction

Short-form evaluation is diagnostic. The report may explain why a score exists. It must not create a second recommendation inventory. Any deeper analysis must remain inside the criterion rationale.

### Readiness Assessment Restriction

Short-form reports may include Market Readiness in the Title Block. They must not include Releasability Assessment as a standalone section. The thirteen story criteria and Market Readiness already evaluate professional readiness.

### Review Gate Restriction

Review Gate is an internal governance concept. Short-form reports must not expose it as a standalone author-facing section.

### Action Item Restriction

**Action Items** are prohibited as a top-level short-form section. Their function is already performed by Top Recommendations, Criterion Rationales & Surfaced Opportunities, and the Revise Queue.

### Terminology Contract

**Canonical author-facing terms:**

- Revision Opportunities
- Top Recommendations
- Criterion Rationales & Surfaced Opportunities
- Recommended / Optional / Consider

**Forbidden synonyms as inventory labels:**

- Actions / Action Items / Strategic Revisions / Revision Tasks / Revision Queue / Revision Priority Plan / Repair Plan / Deep Recommendations / Expanded Recommendations / Suggested Revisions

### Renderer Restrictions

Renderers may format, style, paginate, collapse, expand, wrap, and apply typography. Renderers may not generate recommendations, summarize recommendations independently, create action items, create revision plans, create readiness assessments, create additional inventories, rename sections, reorder sections, suppress canonical opportunities, recalculate counts, or reinterpret severity tiers.

### Severity Tier Contract

Short-form reports use exactly three severity tiers: **Recommended**, **Optional**, **Consider**. Renderers must not rename these tiers. Forbidden aliases include: Critical, High, Medium, Low, Must Fix, Should Fix, Nice to Have, Priority 1/2/3.

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

### Required Rendered Heading Set

Short-form reports must preserve this order:

1. **Title Block**
2. **One-Paragraph Pitch**
3. **One-Sentence Pitch**
4. **Premise** when available
5. **Content Warnings**
6. **Revision Opportunity Summary**
7. **Executive Summary**
8. **Top Strengths**
9. **Top Risks**
10. **Top Recommendations**
11. **13 Criteria Score Grid**
12. **Criterion Rationales & Surfaced Opportunities**
13. **Confidence Explanation**
14. **Author-Facing Disclaimer**

No additional top-level revision inventory may appear.

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

Confidence must use the five canonical confidence labels:

1. **Very High Confidence**
2. **High Confidence**
3. **Moderate Confidence**
4. **Low Confidence**
5. **Insufficient Evidence**

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

Recommendation counts are governed by the canonical `OPPORTUNITY_DISCOVERY_POLICY`. They are **ceilings and expected ranges, not floors**. A valid single recommendation at 9/10 is acceptable; a high-scoring criterion with zero recommendations is acceptable when governed by a valid `recommendation_status`.

Short-form score guidance (expected range / hard minimum):

- Score 10/10: expected 0–1 / hard minimum 0
- Score 9/10: expected 0–1 / hard minimum 0
- Score 8/10: expected 1–2 / hard minimum 0
- Score 7/10: expected 1–3 / hard minimum 0
- Score 6/10: expected 2–4 / hard minimum 0
- Score 5/10 or lower: expected 3–5 / hard minimum 0

**Total cap:** 50 revision opportunities across all criteria combined for short-form evaluations.

Recommendation density should reflect manuscript need, not mechanical quota filling. Do not split one defect into multiple recommendations, duplicate the same recommendation under different wording, or flood a strong manuscript with low-value recommendations merely to approach a cap.

---

## Severity Tier Contract

Short-form reports use exactly three severity tiers:

1. **Recommended**
2. **Optional**
3. **Consider**

### Recommended

High-priority revisions that will meaningfully improve the submitted text.

### Optional

Medium-priority revisions that strengthen craft but are not essential.

### Consider

Lower-priority refinements the author may choose to adopt or defer.

### Renderer Rule

Renderers must not rename these tiers.

Forbidden tier aliases include:

- Critical
- High
- Medium
- Low
- Must Fix
- Should Fix
- Nice to Have
- Priority 1
- Priority 2
- Priority 3

unless those labels are internal-only and never author-facing.

---

## Reading Grade Level Contract

Reading Grade Level is computed algorithmically from the submitted text. It requires no LLM inference.

Display format:

```text
Reading Grade Level: X.X (Flesch-Kincaid)
```

Rendering rule:

Reading Grade Level is Title Block metadata only for short-form evaluation. Renderers must not create a second standalone Reading Grade Level section unless this template is explicitly revised to authorize one.

Critical disclaimer:

Reading Grade Level measures prose complexity, not audience appropriateness. A submission may score at a young-adult reading level while containing graphic violence, sexual content, substance abuse, or other material unsuitable for younger readers. Always cross-reference Content Warnings above for content suitability guidance.

---

## Dialogue vs. Narrative Ratio Contract

Dialogue/Narrative Ratio is computed algorithmically by identifying quoted speech versus narrative prose. It requires no LLM inference.

Display format:

```text
Dialogue/Narrative Ratio: XX% dialogue / XX% narrative
```

Rendering rule:

Dialogue/Narrative Ratio is Title Block metadata only for short-form evaluation. Renderers must not create a second standalone Dialogue vs. Narrative Ratio section unless this template is explicitly revised to authorize one.

Contextual guidance:

Dialogue balance is measured only within the submitted text. Excerpts, chapters, and partial manuscripts may not reflect the dialogue balance of the complete work. Genre expectations vary.

---

## Renderer Restrictions

Renderers may:

- format;
- style;
- paginate;
- collapse;
- expand;
- wrap;
- apply typography.

Renderers may not:

- generate recommendations;
- summarize recommendations independently;
- create action items;
- create revision plans;
- create readiness assessments;
- create additional inventories;
- rename sections;
- reorder sections;
- suppress canonical opportunities;
- recalculate counts;
- reinterpret severity tiers.

---

## UnifiedEvaluationDocument Requirements

`UnifiedEvaluationDocument` must expose:

```text
revision_opportunity_ledger_v1
```

as the sole revision authority.

Every surfaced opportunity must contain:

```text
opportunity_id
criterion
severity
evidence
symptom
cause
fix_direction
reader_effect
mistake_proofing
```

All downstream sections must reference these opportunities.

No downstream section may create additional opportunities.

---

## Confidence Explanation Contract

Confidence explanations must use the five canonical confidence labels.

### Very High Confidence

The submitted text provides broad, repeated, and stable evidence for the field or criterion being evaluated. Diagnostic judgments are strongly supported and unlikely to change materially with ordinary additional context.

### High Confidence

The submitted text provides sufficient evidence for a strong diagnostic judgment. Findings are supported by multiple observable signals in the submission.

### Moderate Confidence

Evidence is present but limited by text length, scope, missing context, or incomplete manuscript coverage.

### Low Confidence

Evidence is thin, localized, unstable, or materially limited. Findings should be treated as cautious and may change with fuller manuscript coverage or stronger evidence.

### Insufficient Evidence

The submission is too fragmented, incomplete, degraded, contradictory, or context-limited to support a reliable conclusion for the field or criterion being evaluated.

---

## Market Readiness Contract

Market Readiness is a professional-readiness indicator and is separate from Overall Score.

Thresholds:

- Market Ready: 90-100
- Near Market Ready: 80-89
- Not Market Ready: Below 80

Market Readiness does not guarantee publication, representation, commercial success, reader reception, or agent interest. It indicates RevisionGrade's assessment of the submitted text's readiness for professional review.

Market Readiness must appear:

- in the Title Block directly beneath Overall Score;
- with Market Readiness Confidence;
- in web, PDF, DOCX, TXT, and print-friendly views;
- using the same wording and thresholds across all evaluation modes.

Market Readiness is derived from Overall Score using the canonical thresholds above.

Renderers must not independently calculate, rename, override, or reinterpret Market Readiness.

The canonical report document is the sole authority.

---

## Required Runtime Enforcement

Introduce or extend:

```text
REVISION_SURFACE_OWNERSHIP_GATE
```

This gate runs before Phase 5 Author Exposure.

---

## Gate Failure Conditions

The gate must fail certification if any of the following occur.

### 1. Multiple Revision Inventories

More than one top-level revision inventory exists.

### 2. Duplicate Recommendations

Recommendation text appears in multiple sections.

### 3. Semantic Duplicates

Recommendations are materially identical despite wording changes.

### 4. Unauthorized Sections

Any prohibited top-level section appears.

### 5. Renderer-Generated Advice

A renderer introduces new recommendations.

### 6. Opportunity Traceability Failure

A recommendation cannot be traced to:

```text
revision_opportunity_ledger_v1
```

### 7. Count Mismatch

The Revision Opportunity Summary count does not match the canonical counted ledger.

### 8. Tier Mismatch

Recommended, Optional, or Consider counts differ across surfaces.

### 9. Surface Parity Failure

Web, PDF, DOCX, TXT, or print-friendly views differ in author-facing revision content.

---

## Phase 5 Author-Exposure Gate

No short-form report may be exposed to the author unless `author_exposure_certification_v1` passes.

Phase 5 certification must verify that the report was assembled from the Short-Form Evaluation Template contract through `UnifiedEvaluationDocument`, that all required Title Block fields and confidence labels are present, and that web, PDF, DOCX, TXT, and print-friendly views preserve the same author-facing content and order.

Renderer parity violations, missing required fields, noncanonical confidence labels, or unauthorized standalone sections block author exposure. They must not be treated as advisory warnings.

A report that violates Revision Surface Ownership:

```text
MUST NOT
```

be shown to the author.

This is a release-blocking defect.

It is not:

- advisory;
- informational;
- a warning;
- acceptable with degraded status;
- acceptable if tests pass elsewhere.

---

## Failure Diagnosis Requirements

If the gate fails, persist:

```text
failure_diagnosis_v1
```

with:

```text
failure_code
renderer
section
field
expected_behavior
actual_behavior
canonical_opportunity_id
remediation_hint
```

The admin dashboard must show the failure reason.

The author-facing page must not show the defective report.

---

## Machine-Checkable Template Requirements

The short-form template must be represented as executable contract data.

At minimum, the contract must define:

```text
section_id
section_title
section_order
required
allowed_revision_surface_role
may_contain_full_opportunities
may_contain_revision_counts
may_contain_recommendation_text
must_reference_revision_opportunity_ledger
forbidden_section_aliases
renderer_visibility
```

---

## Required Section Roles

### Title Block

Role: metadata.

May contain revision recommendations: **No**.

---

### Revision Opportunity Summary

Role: count summary.

May contain revision recommendations: **No**.

May contain counts: **Yes**.

---

### Top Recommendations

Role: executive synthesis.

May contain revision recommendations: **Summary only**.

May create new opportunities: **No**.

Must reference ledger: **Yes**.

---

### Criterion Rationales & Surfaced Opportunities

Role: canonical diagnostic opportunity surface.

May contain full opportunities: **Yes**.

May create new opportunities outside ledger: **No**.

Must reference ledger: **Yes**.

---

### Confidence Explanation

Role: diagnostic confidence explanation.

May contain revision recommendations: **No**.

---

### Author-Facing Disclaimer

Role: legal/product boundary.

May contain revision recommendations: **No**.

---

## Forbidden Rendered Headings

Fail if any of the following appear as top-level headings in a short-form report:

```text
Action Items
Strategic Revisions
Revision Queue
Revision Priority Plan
Deep Criterion Analysis
Expanded Criterion Analysis
Releasability Assessment
Review Gate
Additional Recommendations
Suggested Revisions
Strategic Revision Plan
Priority Revision Plan
Repair Plan
Editorial Action Plan
```

---

## Renderer Output Validation

Before author exposure, validate the actual rendered output for:

- Web visible headings;
- PDF/HTML headings;
- DOCX heading paragraphs;
- TXT section headings.

The validation must inspect rendered output, not just source code.

---

## Explicit Non-Promises

Short-form evaluation must not promise:

- Golden Spine or full-manuscript spine analysis;
- DREAM governed ledgers;
- WAVE-level long-form continuity coverage;
- full Story Ledger extraction;
- whole-manuscript promise/payoff proof;
- Revise Queue execution;
- A/B/C rewrite proposals;
- Structural Stack, Arc Map, or Layer Analysis;
- Cross-Layer Integration or Expanded Criterion Analysis;
- Narrative Synthesis sub-scores;
- Market Shelf positioning analysis;
- publication, agent representation, commercial success, or bestseller status.

If a short-form submission contains a local structural or continuity issue, the report may name it only as local to the submitted text unless the full manuscript was provided.

---

## Formatting Guards

- **CMOS:** Web, PDF, DOCX, TXT, and print views must use Chicago Manual of Style-governed grammar, spelling, punctuation, capitalization, heading style, number style, and table presentation.
- **Headings:** All section headings must start with capital letters and use CMOS-compliant Title Case.
- **Lists:** Use bullets only for short, parallel items where order does not matter. Use numbered markers when sequence, ranking, priority, or first/second/third language matters.
- **List Formatting:** Evaluation reports must not indent bullets or numbered markers. Markers align with the left edge of the section body. Web and HTML/PDF renderers must not use browser-default indented lists, `list-inside`, `pl-5`, or `padding-left: 0.2in`; DOCX renderers must use explicit marker text with zero paragraph and hanging indent instead of native bullet/numbering definitions.
- **Spacing:** Every report section must have visible breathing room before and after it.
- **Metadata Stripping:** Do not include WAVE Governance, gate audit logs, Golden Spine ledgers, execution timestamps, raw pipeline flags, or protected internal terminology.
- **Tables:** Criteria tables must be full width with Score and Confidence columns right-aligned.
- **Score Layout:** Render as a single-line block: `Overall Score: 85/100`. Never split scores across lines.
- **Surface Parity:** PDF, DOCX, TXT, web, and print-friendly views must include the same author-facing content in the same order.
- **Template Authority:** `docs/templates/evaluation/short-form-evaluation-template.md` is the authoritative product contract for short-form reports. `UnifiedEvaluationDocument` is the mandatory renderer adapter, not a competing template.
- **Canonical Authority:** The canonical report document is the sole content authority. Renderers may format content but may not independently generate, summarize, suppress, rename, reorder, reinterpret, or recalculate report content.
- **Renderer Authority:** Renderers may not independently add, remove, rename, reorder, summarize, or recalculate author-facing report content.
- **Release Blocking:** Renderer violations, field omissions, or parity failures block Phase 5 author exposure.

---

## Surface Parity Contract

PDF, DOCX, TXT, web, and print-friendly views must preserve:

- the same author-facing sections;
- the same section order;
- the same score values;
- the same confidence labels;
- the same Genre and Target Audience values;
- the same Genre Confidence and Target Audience Confidence labels;
- the same Market Readiness label;
- the same Market Readiness Confidence label;
- the same revision opportunity counts;
- the same Top Strengths, Top Risks, and Top Recommendations;
- the same surfaced criterion opportunities;
- the same readiness posture.

Renderers may change layout, typography, spacing, and page flow. Renderers may not change substance.

---

## Revise Boundary

Short-form evaluation may identify repair targets. It does not apply repairs. A/B/C repair proposals, author controls, TrustedPath, and manuscript-change application belong to Revise Queue.

When revision opportunities are produced, the required handoff artifact is `revision_opportunity_ledger_v1`. The report may surface summary counts and selected opportunities, but Revise Queue owns the deeper inventory and any author-controlled repair workflow.

---

## Product Philosophy

The author should never finish a report wondering:

```text
Which recommendation list should I follow?
```

The report must provide:

- one source of truth;
- one recommendation inventory;
- one prioritization strategy;
- one repair path.

Everything else exists to explain that path, not duplicate it.
