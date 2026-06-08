# Sister renderer comparison evidence — 2026-06-08

These notes document the four user-visible outputs from the same `Sister` short-form evaluation run. They are committed as QA evidence so GitHub/Codex can inspect the renderer/export gaps.

## Source files uploaded by user

- `Evaluation Report Sister WEBPAGE VIEW (different format)(1).pdf` — browser print of the webpage report. Visual page count: 16 pages. Shows browser headers/footers, URL, timestamp, and page numbers.
- `revision-grade-sister (1).pdf` — product PDF export. Visual page count: 10 pages. Uses a different design/layout from the webpage/browser print.
- `revision-grade-sister (1).docx` — product Word export. Visual page count: 6 pages. Collapses hierarchy and shows truncation/ellipsis symptoms.
- `revision-grade-sister (1).txt` — product TXT export. Closest to canonical structured content; includes score, market readiness, score grid, rationales, and surfaced opportunities.

## Defects to inspect

1. **Renderer divergence:** webpage/browser print, product PDF, Word, and TXT do not feel like four projections of one canonical report artifact.
2. **Different output lengths:** webpage/browser print is 16 pages, product PDF is 10 pages, Word is 6 pages. Different pagination is acceptable; materially different density, hierarchy, truncation, and layout are not.
3. **Word export formatting collapse:** the Word file compresses the report, loses much of the premium hierarchy, and shows truncation/ellipsis symptoms such as `Total…` / `Low…` in the Revision Opportunity Summary.
4. **PDF export layout mismatch:** product PDF uses a different card/grid visual system from the webpage/browser print.
5. **Upstream content corruption survives all renderers:** malformed language appears in generated content and is rendered faithfully by the output adapters.
6. **Pitch/premise repetition:** one-paragraph pitch, one-sentence pitch, and premise are too similar and feel padded rather than premium.

## Expected architecture

Evaluation data should produce one canonical evaluation artifact, then one canonical report/template model per mode:

- `short_form_evaluation`
- `long_form_evaluation`
- `long_form_multi_layer_evaluation`

Web, PDF, DOCX, and TXT should be output adapters only.

If any export constructs sections independently, reorders fields independently, truncates independently, or uses separate content assembly logic, it is not behaving as a canonical renderer projection.

## Required GitHub/Codex investigation

Trace one field and one section from canonical evaluation artifact to all four outputs:

- Overall Score
- Market Readiness
- Genre / Genre Expectations
- Target Audience
- Revision Opportunity Summary
- Executive Summary
- 13 Criteria Score Grid
- Criterion Rationales & Surfaced Opportunities

For each output path, identify whether it consumes:

1. the canonical artifact;
2. the same mode template;
3. the same report-section schema;
4. a shared renderer model;
5. an output adapter only.

If the answer differs for webpage, PDF, DOCX, or TXT, the renderer architecture is still split-brain.