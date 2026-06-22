# Surface Parity Matrix

**Purpose:** Permanent QA artifact mapping every template-required field to its renderer in each of the five evaluation surfaces. Any cell marked ❌ is a parity violation that must be fixed before merge.

**Authority:** `docs/templates/evaluation/short-form-evaluation-template.md`  
**Runtime enforcement:** `lib/evaluation/pipeline/templateCompletenessGate.ts` (pre-persist) and `validateDownloadParity()` in the download route (pre-serve).

---

## Title Block Fields

| # | Field | Template | Webpage | PDF | DOCX | TXT |
|---|-------|----------|---------|-----|------|-----|
| 1 | Manuscript Title | Required | `page.tsx` title block | Cover page heading | Title paragraph | Line 1 header |
| 2 | Reference ID | Required | `page.tsx` title block | Title block line | Title paragraph | Header line |
| 3 | Report Type | `Short-Form Evaluation` / `Long-Form Multi-Layer Evaluation` (historical: `Long-Form Evaluation`) | Title block badge | Cover grid `renderMetric` | `metaRow` | Header line |
| 4 | Overall Score | `[XX]/100` | Score circle + label | Cover grid `renderMetric` | `metaRow` | Header line |
| 5 | Market Readiness | `Market Ready / Near Market Ready / Not Market Ready` | Badge via canonical title block | Cover badge + canonical title block | `metaRow` verdict | `Market Readiness:` line |
| 6 | Genre | Required (AI-diagnosed) | Title block `genre` | Cover grid `renderMetric` | `metaRow` | Header line |
| 7 | Target Audience | Required (pipeline-diagnosed) | Title block `targetAudience` | Cover grid `renderMetric` | `metaRow` | Header line |
| 8 | Shelf | Required for long-form and long-form multi-layer | Title block for long-form modes | Cover grid for long-form modes | `metaRow` for long-form modes | Header line for long-form modes |
| 9 | Submitted Word Count | `[XXXX]` | Title block | Cover grid `renderMetric` | `metaRow` | Header line |
| 10 | Estimated Manuscript Pages | `[XX] at 250 words/page` | Title block | Cover grid `renderMetric` | `metaRow` | Header line |
| 11 | Reading Grade Level | `[X.X] (Flesch-Kincaid)` | Title block | Cover grid `renderMetric` | `metaRow` | Header line |
| 12 | Dialogue/Narrative Ratio | `[XX]% / [XX]%` | Title block | Cover grid `renderMetric` | `metaRow` | Header line |
| 13 | Date Generated | `[Month Day, Year]` | Title block | Cover grid `renderMetric` | `metaRow` | Header line |

## Required Sections (14)

| # | Section | Template Lines | Webpage | PDF | DOCX | TXT |
|---|---------|---------------|---------|-----|------|-----|
| 1 | Title Block | §Title Block | ✅ `page.tsx` header | ✅ Cover page | ✅ Title paragraphs | ✅ Header block |
| 2 | One-Paragraph Pitch | §Pitch Contract | ✅ Pitch section | ✅ `buildReportPitches` | ✅ Pitch paragraphs | ✅ Pitch lines |
| 3 | One-Sentence Pitch | §Pitch Contract | ✅ Pitch section | ✅ `buildReportPitches` | ✅ Pitch paragraphs | ✅ Pitch lines |
| 4 | Premise | §Premise Contract | ✅ When enrichment exists | ✅ When enrichment exists | ✅ When enrichment exists | ✅ When enrichment exists |
| 5 | Content Warnings | §Content Warnings | ✅ Trigger warnings list | ✅ Content warnings section | ✅ Warning paragraphs | ✅ Warning lines |
| 6 | Revision Opportunity Summary | §Revision Opportunity | ✅ Opportunity counts | ✅ Summary grid | ✅ Summary table | ✅ Summary lines |
| 7 | Executive Summary | §Required Shared | ✅ Summary section | ✅ Summary section | ✅ Summary paragraphs | ✅ Summary lines |
| 8 | Top Strengths | §Required Shared | ✅ Strengths list | ✅ Strengths section | ✅ Strength bullets | ✅ Strength lines |
| 9 | Top Risks | §Required Shared | ✅ Risks list | ✅ Risks section | ✅ Risk bullets | ✅ Risk lines |
| 10 | Top Recommendations | §Top Recommendations | ✅ Unconditional render | ✅ Unconditional render | ✅ Unconditional render | ✅ Unconditional render |
| 11 | 13 Criteria Score Grid | §Score Grid | ✅ Criteria table | ✅ Score table | ✅ Score table rows | ✅ Score lines |
| 12 | Criterion Rationales & Opportunities | §Criterion Opportunity | ✅ Criterion cards | ✅ Criterion sections | ✅ Criterion sections | ✅ Criterion blocks |
| 13 | Confidence Explanation | §Required Shared | ✅ Inline panel | ✅ Confidence section | ✅ Confidence section | ✅ Confidence block |
| 14 | Author-facing Disclaimer | §Required Shared | ✅ Footer disclaimer | ✅ Footer section | ✅ Footer paragraphs | ✅ Footer lines |

## Per-Criterion Fields

| Field | Template | Webpage | PDF | DOCX | TXT |
|-------|----------|---------|-----|------|-----|
| Criterion Name | 13 canonical keys | ✅ Card header | ✅ Section header | ✅ Heading | ✅ Section header |
| Score (0-10) | `XX/10` | ✅ Score badge | ✅ Score cell | ✅ Score cell | ✅ Score line |
| Confidence Level | `High/Moderate/Low` | ✅ Confidence badge | ✅ Confidence cell | ✅ Confidence cell | ✅ Confidence line |
| Rationale | Required | ✅ Rationale text | ✅ Rationale paragraph | ✅ Rationale paragraph | ✅ Rationale text |
| Evidence Anchors | Required for score ≤ 8 | ✅ Evidence quotes | ✅ Evidence quotes | ✅ Evidence quotes | ✅ Evidence quotes |
| Surfaced Opportunities (0-3) | 6-part diagnostic | ✅ Opportunity cards | ✅ Opportunity sections | ✅ Opportunity sections | ✅ Opportunity blocks |

## 6-Part Diagnostic Structure (per opportunity)

| Field | Template | Webpage | PDF | DOCX | TXT |
|-------|----------|---------|-----|------|-----|
| Evidence | Where in text | ✅ | ✅ | ✅ | ✅ |
| Symptom | Observable problem | ✅ | ✅ | ✅ | ✅ |
| Cause | Mechanism | ✅ | ✅ | ✅ | ✅ |
| Fix Direction | Bounded repair | ✅ | ✅ | ✅ | ✅ |
| Reader Effect | Impact if repaired | ✅ | ✅ | ✅ | ✅ |
| Mistake-Proofing | Must not damage | ✅ | ✅ | ✅ | ✅ |

## Enforcement Gates

| Gate | Location | When | What It Checks |
|------|----------|------|----------------|
| Template Completeness | `templateCompletenessGate.ts` | Before artifact persistence | All 14 sections present, 13 criteria exact, density floors, meaningful content (not placeholders), genre not a format word, confidence levels valid |
| Download Parity | `download/route.ts` `validateDownloadParity()` | Before serving any download | Artifact completeness verified before generating PDF/DOCX/TXT |
| Canonical View Model | `buildMetadata()` in `download/route.ts` | All download builders | Single metadata extraction function shared by PDF, DOCX, TXT builders — ensures identical field values |

## How to Use This Matrix

1. **Before merging any PR that touches evaluation rendering:** Re-verify this matrix against the changed surfaces. Every cell must be ✅.
2. **When adding a new template field:** Add it to this matrix FIRST, then implement in all 5 surfaces, then verify.
3. **When investigating a parity bug:** Use this matrix to identify which surface is missing the field.
4. **CI enforcement:** The `templateCompletenessGate.ts` enforces the pipeline-side contract. The `validateDownloadParity()` gate enforces the download-side contract.

---

*Last updated: PR #1007 — surface parity enforcement*
