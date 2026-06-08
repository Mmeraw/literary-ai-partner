# Engineering execution brief — Issue #1021 (renderer contract mismatch)

Date: 2026-06-08

## Problem statement (authoritative)

This is not primarily a visual-design defect.

It is a **product contract defect**:

1. UI/download copy promises premium/matching exports.
2. Active download route serves canonical simplified renderers.
3. Legacy premium renderer functions still exist in code but are not the active GET path.
4. Users receive outputs that do not match promised presentation quality/consistency.

## Code evidence (line-level)

### Promise layer

- `components/reports/DownloadReportButton.tsx:18`
  - "Professional branded PDF with cover page, scores, and full analysis."
- `components/reports/DownloadReportButton.tsx:23`
  - "Formatted Word document matching the webpage report."

### Active delivery layer

- `app/api/reports/[jobId]/download/route.ts:2660`
  - TXT path uses `buildCanonicalTemplateTxt(canonicalDoc)`
- `app/api/reports/[jobId]/download/route.ts:2672`
  - PDF path uses `renderCanonicalTemplateHtml(canonicalDoc)`
- `app/api/reports/[jobId]/download/route.ts:2702`
  - DOCX path uses `buildCanonicalTemplateDocx(canonicalDoc)`

### Legacy premium code present (not active GET path)

- `app/api/reports/[jobId]/download/route.ts:1557` (`renderPremiumReportHtml`)
- `app/api/reports/[jobId]/download/route.ts:1782` (`buildPdfReport`)
- `app/api/reports/[jobId]/download/route.ts:1806` (`buildDocx`)

---

## Execution order (must follow)

1. **Renderer contract decision + unification**
2. **Deterministic language-quality gate**
3. **DOCX professional structure upgrade**
4. **Header/hero redesign polish**

Do not begin with CSS refinement.

---

## Phase 1 — Renderer contract unification (P0)

## Goal

Single authoritative section/presentation model consumed by web/pdf/docx/txt adapters.

## Required decisions

- Choose one renderer contract source of truth:
  - Option A: Canonical template model (`canonicalDoc`) + premium adapter styling
  - Option B: Premium model normalized as canonical contract and reused by all exports

## Required invariants

- Same section tree order across outputs
- Same field semantics across outputs
- Adapter-only differences for medium constraints (HTML/PDF/DOCX/TXT)
- No output-specific content assembly divergence

## Implementation steps

1. Add explicit renderer contract doc in `docs/` (single source of truth for section tree + required fields).
2. In `app/api/reports/[jobId]/download/route.ts`, remove ambiguous dual-path behavior:
   - keep one active composition path for all formats
   - deprecate or delete dead/legacy premium builders if not selected
3. Align UI copy in `DownloadReportButton.tsx` to actual behavior until parity is complete.

## Exit criteria

- Promise text is truthful.
- PDF/DOCX/TXT all derive from one authoritative section model.

---

## Phase 2 — Language-quality gate (P0)

## Goal

Prevent malformed prose from shipping in any export.

## Current gap

`validateDownloadParity` validates presence/completeness, not prose integrity.

## Implementation steps

1. Add deterministic text-integrity checks before export finalization:
   - malformed connector patterns (`would because`, stitched fragments)
   - sentence integrity checks for executive summary and recommendations
   - reject/repair policy must be explicit and deterministic
2. Integrate gate into download/export pipeline with auditable failure codes.
3. Keep passive observability only (per governance), no silent mutation of control flow.

## Exit criteria

- Known malformed fragments are blocked from final artifacts.
- Failures are explicit and debuggable.

---

## Phase 3 — DOCX professional structure (P1)

## Goal

DOCX output meets professional editorial report standards.

## Required structure

- Cover/title page composition
- Running header + footer + page numbering
- Defined style hierarchy (Title/Heading1/2/3/Body/List)
- Controlled page behavior (keep-with-next, widow/orphan handling)
- Stable spacing and table legibility

## Implementation steps

1. Upgrade DOCX adapter to explicitly include:
   - section headers/footers
   - paragraph keep-with-next for headings
   - widow/orphan controls where supported
   - consistent style map and spacing constants
2. Add snapshot-level DOCX structure assertions (zip XML checks) in tests.

## Exit criteria

- DOCX no longer reads as plain text dump.
- Header/footer/style/pagination controls are present in generated artifact.

---

## Phase 4 — Header/hero redesign (P2)

## Goal

Premium visual composition after architecture and quality gates are stable.

## Recommended layout

- Two-zone hero:
  - left: title/report identity/ref
  - right: score card
- Full-width metadata band under hero with consistent grid logic
- No-wrap for critical labels (e.g., Market Readiness)
- Long-field handling (Target Audience) with controlled wrapping/clamp policy

## Exit criteria

- Top section passes premium screenshot test (trust/intentional composition at first glance).

---

## Test plan additions

1. `download_renderer_parity_short_form.test.ts`
   - assert same section/field presence across web/pdf/docx/txt adapters.
2. `download_language_quality_gate.test.ts`
   - fixtures for malformed recommendation/executive-summary fragments.
3. `docx_professional_contract.test.ts`
   - assert header/footer parts, page numbers, style hierarchy markers.
4. `download_promise_alignment.test.tsx`
   - UI description must match active renderer path.

---

## Risk controls

- Keep changes behind a feature flag if needed (`download_renderer_contract_v2`).
- Roll out to internal/staging first with artifact diff checks.
- Preserve previous artifacts for regression comparison in QA evidence folder.

---

## Definition of done (Issue #1021)

Issue closes only when:

1. Promise text and runtime behavior match.
2. One authoritative renderer contract powers all outputs.
3. Language contamination is blocked deterministically.
4. DOCX meets professional structure contract.
5. Header polish is applied on top of stable architecture.
