# Renderer gap diagnosis — Sister short-form evaluation

Date observed: 2026-06-08  
Evaluation: `Sister`  
Mode shown: `Short-Form Evaluation`  
Reference ID observed in webpage print: `85cbfca8-ad58-4297-8a76-cb98636e123b`

## Observed output mismatch

The user uploaded four outputs from what should be the same canonical evaluation report:

| Output | Observed behavior | QA concern |
|---|---|---|
| Webpage browser print PDF | 16 pages; premium card-like layout; browser header/footer/URL/page numbers visible | Looks like a browser print, not a controlled product export |
| Product PDF export | 10 pages; different visual system from webpage | Suggests separate PDF renderer or separate layout contract |
| Word export | 6 pages; compressed hierarchy; truncation/ellipsis symptoms | Suggests DOCX export is not faithfully projecting canonical report sections |
| TXT export | Structured and closest to full canonical content | Appears most faithful to the report object, but still contains upstream content defects |

## Concrete content defects

These defects appear to be upstream content/model/pipeline issues, not merely styling issues.

### Broken executive summary sentence

Observed text:

> However, uneven pacing—especially the dense INSITE opening and summary-heavy middle—limited dialogue, scattered line-level errors. Main weaknesses center on narrative closure.

Problem:

- The sentence is grammatically malformed.
- It reads like a stitched fragment where the connective phrase was dropped.
- This should fail a deterministic text-quality gate before export.

Expected:

- No final report should persist/export with malformed executive-summary prose.
- Renderer should not be responsible for fixing this; artifact finalization or quality gate should block it.

### Malformed surfaced opportunity

Observed text:

> Insert one concrete stakes beat that lands the deferred decision at the current scene turn; At the scene level, studies are mixed on the success of safe injection sites. would because the stakes signal arrives too late in the passage, diffusing narrative urgency at the turn.

Problem:

- The passage includes template/pipeline contamination.
- `would because` is syntactically invalid.
- The source quote appears to have been jammed into a recommendation sentence.

Expected:

- Surfaced opportunities should have a strict schema: quote, diagnosis, recommendation, rationale, priority/confidence.
- No generated card should pass with malformed text assembly.

### Pitch/premise repetition

Observed:

- One-paragraph pitch, one-sentence pitch, and premise repeat substantially similar language.

Problem:

- Feels padded and non-premium.
- These sections should be purpose-distinct.

Expected:

- One-sentence pitch: concise hook.
- One-paragraph pitch: fuller narrative/commercial framing.
- Premise: underlying dramatic/argumentative engine, not a near-duplicate.

## Visual/layout defects by output

### Webpage browser print

Symptoms:

- Includes browser metadata: timestamp, page title, URL, page count.
- First page has a polished report feel, but as a print artifact it still looks accidental.
- Header card and submission preview do not map cleanly to product PDF/DOCX presentation.

Expected:

- Web view may be interactive/responsive.
- Print/PDF export should be controlled by a print/export stylesheet or renderer adapter, not browser chrome.

### Product PDF

Symptoms:

- Uses a different visual grammar than webpage browser print.
- Different page count and density.
- Appears to render a different layout model rather than the same report model.

Expected:

- PDF should be a governed export projection of the same canonical section tree.
- Visual differences are acceptable only as output-adapter constraints, not as independent section construction.

### Word export

Symptoms:

- Only 6 pages.
- Metadata and summary sections collapse into plain document flow.
- Revision Opportunity Summary shows truncation/ellipsis symptoms.
- Hierarchy, cards, badges, tables, and spacing are not premium enough.

Expected:

- DOCX should preserve professional hierarchy using Word-native styles:
  - title;
  - subtitle/report type;
  - metadata table;
  - score grid table;
  - section headings;
  - properly indented bullets/numbering;
  - no ellipsis/truncation caused by layout.

### TXT export

Symptoms:

- Closest to canonical content.
- Uses structured separators and contains the full score grid.
- Still includes malformed upstream language.

Expected:

- TXT may be plain, but should be a faithful complete projection of the canonical artifact.
- It should not be the only output that feels complete.

## Required architectural test

Codex/GitHub should trace these from data source to output:

1. `overallScore`
2. `marketReadiness`
3. `genre`
4. `genreExpectations`
5. `targetAudience`
6. `revisionOpportunitySummary`
7. `executiveSummary`
8. `topRecommendations`
9. `criteriaScoreGrid`
10. `criterionRationales`
11. `surfacedOpportunities`

For each field/section, answer:

- Where is it generated?
- Where is it validated?
- Where is it normalized into the canonical artifact?
- Which renderer consumes it for webpage?
- Which renderer consumes it for PDF?
- Which renderer consumes it for DOCX?
- Which renderer consumes it for TXT?
- Are any sections re-created or transformed independently per output?

## Acceptance standard

The fix is not complete until the four outputs demonstrate this invariant:

> Same artifact. Same section tree. Same semantic content. Output-specific styling only.

A screenshot/PDF/DOCX/TXT comparison test should be added as a regression fixture for this `Sister` report or a sanitized equivalent.