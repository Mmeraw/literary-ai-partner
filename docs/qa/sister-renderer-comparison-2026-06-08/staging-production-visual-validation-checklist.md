# Staging/Production visual validation checklist — Sister exports

Date: 2026-06-08  
Scope: post-Option-A lock verification for **newly generated** artifacts (not legacy files)

## Goal

Validate real user-facing quality for current canonical exports:

- Web page render
- Downloaded PDF
- Downloaded DOCX
- Downloaded TXT

This checklist complements (does not replace) automated parity/comparator tests.

---

## Preconditions

- Use one fresh Sister-like job ID in staging and one in production.
- Confirm latest commits are deployed (includes PDF polish + DOCX uplift).
- Ensure the same job is used for all 4 outputs in each environment.

Record:

- Environment: `staging` / `production`
- Job ID:
- Export timestamp:
- App commit SHA (if available):

---

## Artifact capture

For each environment, save these files under a dated evidence folder:

1. Web page browser-print PDF
2. Product PDF export
3. Product DOCX export
4. Product TXT export
5. Screenshot: top-of-report hero/header (web)
6. Screenshot: first page of product PDF
7. Screenshot: first page of DOCX in Word/LibreOffice

---

## Acceptance checklist (visual + contract)

### A) Cover/header quality

- [ ] PDF has branded title/hero (not plain dump)
- [ ] Score/readiness card is visible and legible at first glance
- [ ] Metadata band is balanced (no broken grid, no overlap)
- [ ] No browser chrome appears in **product** PDF

### B) DOCX professional structure

- [ ] Title page feels intentionally composed (not plain paragraphs)
- [ ] Header/footer present with page numbering
- [ ] Section heading hierarchy is consistent
- [ ] Score grid table is readable and aligned
- [ ] Spacing/pagination feel professional (no abrupt visual collapse)

### C) Content integrity

- [ ] No malformed fragments (e.g., `would because`, `benefit from one because`)
- [ ] No off-topic contamination phrases
- [ ] Top strengths/risks/recommendations are complete and readable
- [ ] Executive summary reads as coherent prose

### D) Cross-format parity sanity

- [ ] All 14 canonical top-level sections are present in each output
- [ ] Same score and market-readiness semantics across formats
- [ ] No critical section appears truncated in PDF/DOCX

---

## Regression comparator run

Run comparator on the new capture set and attach output JSON.

Expected minimums (quality gate suggestion):

- PDF coverage >= 13/14
- DOCX coverage = 14/14
- No new contamination codes relative to TXT baseline

If comparator passes but visual quality fails, file as **presentation defect** (not parity defect).

---

## Sign-off template

### Environment: staging

- Job ID:
- Comparator result:
- Visual verdict: PASS / FAIL
- Notes:

### Environment: production

- Job ID:
- Comparator result:
- Visual verdict: PASS / FAIL
- Notes:

---

## Triage mapping

- If visual hero/cover quality fails only in PDF: assign `PDF_PRESENTATION`
- If DOCX layout/hierarchy fails: assign `DOCX_STRUCTURE`
- If malformed prose appears: assign `LANGUAGE_GATE`
- If section presence diverges: assign `RENDERER_PARITY`
