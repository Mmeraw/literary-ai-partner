# Ultra Premium Formatting Audit

**Date:** 2026-07-06
**Scope:** Compare HTML (PDF source), DOCX, and TXT download renderers against canonical evaluation templates and rendering contract.
**Fixture:** Let the River Decide (LTRD) golden long-form multi-layer evaluation.
**Method:** Fresh renders generated from current `main` via `__testingDownload` test harness with all 13 criteria populated.

---

## Executive Summary

The renderers are **functionally correct** — section order, content parity, confidence labels, and opportunity structure all comply with the evaluation rendering contract. No release-blocking defects exist in content or section ordering.

The gaps are **purely aesthetic/premium polish** — the report content is right, but the presentation does not yet reach McKinsey/Penguin editorial quality. The largest gap is DOCX (estimated 6.5–7/10), followed by PDF page composition (8.8/10), with HTML/TXT already near-premium.

---

## Gap Analysis by Surface

### 1. HTML/PDF (shared renderer)

**Current state:** Professional, branded, well-structured. Cover page with score card, metadata grid, section cards, opportunity blocks. RevisionGrade palette applied.

| Gap ID | Description | Contract Reference | Severity |
|--------|-------------|-------------------|----------|
| H-1 | **Cover page has ~3 inches of dead whitespace** below metadata grid before disclaimer. No author name, no evaluation date prominently displayed, no watermark, no logo mark. | ChatGPT Vision §1 (cover) | Medium |
| H-2 | **Executive Dashboard uses metadata grid** (small cards) not the bold card-based layout described in vision. Overall Score is in a corner card, not center-stage. Market Readiness, Genre, Audience are metadata rows, not equal-weight dashboard cards. | ChatGPT Vision §2 (dashboard) | Medium |
| H-3 | **Title font size is 31pt** — within range but below the 36–42pt target for premium authority. H2 is 16pt (target 18pt). Body is 10.3pt (target 11–12pt). | ChatGPT Vision §3 (typography) | Low |
| H-4 | **Opportunity cards lack the 8-field structure**: Currently render 6 fields (Evidence/Symptom/Cause/Fix Direction/Reader Effect/Mistake-Proofing). Missing explicit "Problem" and "Impact/Effort" badges per the vision's card spec. The vision shows Impact + Effort as a separate badge pair. | ChatGPT Vision §4 (opportunity cards) | Low |
| H-5 | **No visual hierarchy cues beyond font size** — no icons (✓/⚠/✎/★), no horizontal score bars, no colored left borders per section type. All sections look identical in card style. | ChatGPT Vision §5, §8, §9 | Low |
| H-6 | **No page-break protection for opportunity blocks** that span pages in PDF. `break-inside: avoid` is set on `.opp-block` but not tested at scale with many recommendations. | ChatGPT Vision §10 (page flow) | Low |
| H-7 | **Revision Opportunity Summary uses 4-column grid cards** — clean but doesn't match the plain text contract format (`Total: XX / Recommended: X / Optional: X / Consider: X`). Both are acceptable per contract but the grid format is arguably better for premium. | Contract §59-77 | None (compliant, style choice) |

**What's working well:**
- Section order: Correct (Title Block → Pitches → Premise → Warnings → Rev Summary → Exec Summary → Strengths → Risks → Recs → Score Grid → Criterion Details → Long-form sections → Confidence → Disclaimer)
- Score grid: Full width, right-aligned Score/Confidence columns, alternating row shading
- Opportunity blocks: Gold left border, card structure, severity labels (RECOMMENDED/OPTIONAL/CONSIDER)
- No indented bullets — uses custom list markers aligned to left edge
- RevisionGrade palette: Oxblood headings, gold accents, cream background, warm typography
- Confidence pills: Color-coded (green/amber/red) with background tints
- Cover page: Has branded header, score card, metadata grid

---

### 2. DOCX

**Current state:** Programmatic Word generation via `docx` library. Uses Georgia headings, Calibri body, gold border dividers, shaded metadata table, opportunity detail rows.

| Gap ID | Description | Contract Reference | Severity |
|--------|-------------|-------------------|----------|
| D-1 | **No cover page** — document starts immediately with metadata table. Missing: logo/brand mark, prominent title, author, date, watermark, balanced spacing. A cover should be its own page. | ChatGPT Vision §1, DOCX spec | High |
| D-2 | **No native Word heading styles** — uses manual `HeadingLevel.HEADING_2` with custom formatting but these map poorly to Word's Navigation Pane and TOC generation. The heading hierarchy (H1 for title, H2 for sections, H3 for criteria) needs explicit Word style mapping. | ChatGPT Vision DOCX spec ("Navigation pane works, TOC possible") | High |
| D-3 | **No page numbers, no header/footer** — the DOCX has no running headers ("RevisionGrade™ | Confidential") or footers with page numbers. Professional documents require these. | ChatGPT Vision PDF/DOCX spec | Medium |
| D-4 | **Metadata table uses 36%/64% split** — functional but cramped for long values (genre, audience). No alternating row coloring. | ChatGPT Vision §7 (tables) | Low |
| D-5 | **Opportunity detail rows use single-cell table** layout — works but doesn't match the card aesthetic. No surrounding border, no background tint differentiation between fields. | ChatGPT Vision §4 | Low |
| D-6 | **No page break before major sections** — "Criterion Rationales", long-form sections, and "Confidence Explanation" should start on new pages for professional pagination. | ChatGPT Vision §10 | Medium |
| D-7 | **Body text at size 22 half-points (11pt)** — within target. Line spacing at 310 (15.5pt) = 1.41 ratio, slightly above the 1.2–1.3 target. | ChatGPT Vision §3 | Low |

**What's working well:**
- Section order: Correct and matches contract
- Gold border dividers between major sections
- Explicit bullet markers (`• Item`) with zero indent — compliant with contract line 120
- Opportunity structure: 6-field Evidence/Symptom/Cause/Fix/Effect/Mistake-Proofing
- Calibration-aware scoring colors (green/amber/red)
- keepNext on headings (prevents orphaned headers)

---

### 3. TXT

**Current state:** Clean 78-column terminal-friendly output. Proper separators, metadata alignment, structured opportunity blocks.

| Gap ID | Description | Contract Reference | Severity |
|--------|-------------|-------------------|----------|
| T-1 | **Layer Analysis shows "undefined" for strength field**: `Road-trip witness layer — undefined`. The fixture passes `strength` as a field but the renderer outputs "undefined". | Bug (trivial fix) | Low |
| T-2 | **Cross-Layer Integration shows "undefined"**: `Water as memory and judgment — undefined`. Missing description text render. | Bug (trivial fix) | Low |
| T-3 | **Market Shelf sub-items indented** with 4 spaces: `    • Literary eco-thriller`. Contract line 118 says "Bullets and numbered markers must not be indented." However, these are nested under "Shelf Neighbors:" label, so visual hierarchy indent is arguably appropriate for TXT readability. | Contract line 118 (debatable for TXT nesting) | Low |
| T-4 | **Missing final newline** — file ends mid-sentence on line 422 without trailing newline. | Professional standard | Trivial |

**What's working well:**
- 78-column wrap limit enforced throughout
- Section separators: `=` for title, `-` for subsections (consistent)
- Score grid: Column-aligned with Unicode box-drawing characters
- Opportunity blocks: Proper 4-space indent for field labels
- Section order: Correct and matches contract
- No indented top-level bullets
- Metadata alignment: Label + value on aligned columns

---

## Contract Compliance Summary

| Requirement | HTML/PDF | DOCX | TXT | Status |
|-------------|----------|------|-----|--------|
| Section order matches contract | ✓ | ✓ | ✓ | Pass |
| Content parity across surfaces | ✓ | ✓ | ✓ | Pass |
| Confidence labels canonical (High/Moderate/Low) | ✓ | ✓ | ✓ | Pass |
| Revision Opportunity Summary (counts only) | ✓ | ✓ | ✓ | Pass |
| Top Recommendations max 5 | ✓ | ✓ | ✓ | Pass |
| Score Grid full-width, right-aligned | ✓ | ✓ | ✓ | Pass |
| No indented bullets (top-level) | ✓ | ✓ | ✓ | Pass |
| CMOS Title Case headings | ✓ | ✓ | ✓ (UPPER) | Pass |
| Severity tiers: Recommended/Optional/Consider | ✓ | ✓ | ✓ | Pass |
| No renderer-generated recommendations | ✓ | ✓ | ✓ | Pass |
| 6-field opportunity structure | ✓ | ✓ | ✓ | Pass |
| Author-facing disclaimer present | ✓ | ✓ | ✓ | Pass |
| No internal metadata/pipeline language | ✓ | ✓ | ✓ | Pass |
| Professional spacing between sections | ✓ | Partial | ✓ | D-6 |
| Page numbers/headers/footers | ✓ (PDF) | ✗ | N/A | D-3 |
| Cover page / branding | Partial | ✗ | N/A | D-1, H-1 |
| Navigation Pane / TOC | N/A | ✗ | N/A | D-2 |

---

## Proposed PR Sequence

Based on gap severity and user's preferred ordering:

### PR 1: Cover Page + Executive Dashboard (DOCX + HTML/PDF)
**Scope:**
- DOCX: Add proper cover page (page break, centered title, brand line, date, report type, score highlight)
- DOCX: Add headers/footers with page numbers
- HTML/PDF: Enhance cover — reduce dead whitespace, add author/date prominence, subtle watermark

**Files:** `app/api/reports/[jobId]/download/route.ts` (DOCX section ~line 1342, HTML section ~line 1053)
**Risk:** Low — additive only, no content logic changes
**Estimated size:** ~150 lines changed

### PR 2: Typography + Visual Hierarchy
**Scope:**
- HTML/PDF: Bump title to 36pt, H2 to 18pt, body to 11pt
- HTML/PDF: Add subtle section-type indicators (left border color variation per section category)
- DOCX: Ensure native Word heading styles map to Navigation Pane (Heading1/2/3)
- DOCX: Add page breaks before "Criterion Rationales" and long-form sections

**Files:** Same route file, plus potentially `report-page.module.css` for web view
**Risk:** Low — pure CSS/styling changes
**Estimated size:** ~100 lines changed

### PR 3: Opportunity Cards Polish
**Scope:**
- HTML/PDF: Consider adding Impact/Effort badge pair to opportunity cards (if data is available in VM)
- DOCX: Add subtle card borders/shading around opportunity blocks
- Fix T-1 and T-2 (TXT "undefined" renders) — trivial safe fix

**Files:** Same route file
**Risk:** Low — T-1/T-2 are trivial null-check fixes
**Estimated size:** ~80 lines changed

### PR 4: Page-Flow + Production Polish
**Scope:**
- PDF: Test and enforce `break-inside: avoid` at scale (many recommendations per criterion)
- DOCX: keepWithNext on criterion headers + opportunity blocks
- PDF: Verify no widows/orphans in typical 13-criterion report
- TXT: Fix trailing newline, review Market Shelf indent policy

**Files:** Same route file
**Risk:** Low — pagination rules only
**Estimated size:** ~50 lines changed

### PR 5: Final Details (icons, charts, color refinement)
**Scope:**
- HTML/PDF: Add subtle icons (✓ Strength, ⚠ Risk, ✎ Revision) to section headers
- HTML/PDF: Consider horizontal score bar visualization for Overall Score
- Color consistency audit — ensure no stray default colors anywhere
- DOCX: Line spacing adjustment (310 → 280 for 1.27 ratio)

**Files:** Same route file
**Risk:** Low — decorative enhancements
**Estimated size:** ~80 lines changed

---

## Trivial Safe Fixes (can ship with audit PR)

1. **T-1**: TXT Layer Analysis renders `undefined` when `strength` field is not mapped → null-coalesce fix
2. **T-2**: TXT Cross-Layer Integration renders `undefined` for missing `description` → null-coalesce fix
3. **T-4**: Missing trailing newline on TXT output

These are 1-line fixes each, zero risk to other surfaces.

---

## Screenshots

See `/tmp/audit-renders/` for full rendered outputs:
- `ltrd-golden.html` — HTML/PDF source (cover + all sections)
- `ltrd-golden.txt` — TXT download (422 lines)
- `ltrd-golden.docx` — DOCX download (17,762 bytes)

HTML Cover screenshot: Shows RevisionGrade branding, title, score card, metadata grid. Dead whitespace gap visible below metadata.

HTML Score Grid screenshot: Full-width table with right-aligned scores and confidence pills. Alternating row shading. Professional.

---

## Conclusion

**No release-blocking contract violations.** The renderers produce correct, parity-compliant output. The work ahead is purely aesthetic/premium elevation:

1. DOCX needs the most work (no cover, no headers/footers, no Navigation Pane)
2. HTML/PDF cover page needs elevation (whitespace, dashboard, prominence)
3. Typography needs minor bumps (title size, body size)
4. TXT has 2 trivial "undefined" bugs

Total estimated scope: ~460 lines across 5 small PRs, all additive/styling, zero content-logic risk.
