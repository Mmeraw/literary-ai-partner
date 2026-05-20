# DREAM Manuscript Integrity Confidence Table

## Purpose

The Manuscript Integrity Confidence Table ensures that DREAM separates document hygiene from story craft.

A long-form report must not treat a TOC artifact, broken anchor, file-title process note, or intentional motif as a story weakness without classification and confidence. It must also not ignore actual manuscript defects that affect publication readiness.

## Required when

Required for every DREAM long-form report.

## Folded report surfaces

This table should be rendered through existing DREAM surfaces, especially:

- `manuscript_integrity_issues`
- `releasability`
- `revision_plan`
- `acceptance_checks.required_detection`
- `acceptance_checks.failure_conditions`

## Minimum row contract

| Field | Requirement |
|---|---|
| Issue label | Short label such as duplicate chapter, TOC mismatch, title process note, anchor issue, missing content, numbering error, or artifact suspected. |
| Location / evidence basis | Chapter, TOC entry, title page, file name, anchor ID, sample window, or other evidence. |
| Integrity class | confirmed_defect, likely_defect, artifact_suspected, intentional_motif_suspected, title_package_hygiene, anchor_toc_issue, needs_manual_verification. |
| Craft impact if true | How the issue would affect reader trust, continuity, market package, pacing, closure, or publication readiness. |
| Recommended action | Verify, repair, rename, normalize, confirm intentional motif, fix anchor, clean title, or leave intact. |
| Confidence | High, Moderate-High, Moderate, Low. |

## Classification rules

- `confirmed_defect`: evidence directly shows a real manuscript/content problem.
- `likely_defect`: evidence strongly suggests a defect but needs verification.
- `artifact_suspected`: likely caused by TOC/rendering/export/sample artifact.
- `intentional_motif_suspected`: repeated title/scene/image may be deliberate mirroring.
- `title_package_hygiene`: file/title card contains process notes or market-facing clutter.
- `anchor_toc_issue`: issue appears in anchors, generated TOC, or navigation metadata rather than body prose.
- `needs_manual_verification`: evidence is insufficient for a firm claim.

## Hard-fail conditions

A DREAM report is incomplete if:

- It claims publication readiness while ignoring title-card/process-note hygiene.
- It treats an artifact as a story defect without caveat.
- It treats likely intentional mirroring as accidental duplication without verification.
- It flags a truncated title from a TOC without checking whether the body title exists in the manuscript evidence.
- It lets document hygiene contaminate narrative-closure or story-structure scoring without explaining the distinction.

## Benchmark obligations

### Cartel Babies

Must distinguish `Canvas Morning` as potential motif versus anchor/TOC/body duplication issue, and must distinguish `Chapter 37 – The Night` as possible TOC artifact versus true title truncation. Process-note title material must be treated as title/package hygiene.

### Let the River Decide

Must distinguish real chronology/location/timeline issues from research-note or documentary-form choices. Cultural/protocol uncertainty must be marked as sensitivity/manual-review risk, not ordinary copy defect.

### Froggin Noggin

Must distinguish intentional paratext/doctrine/epigraph structures from accidental overgrowth, duplication, or continuity drift.

## Implementation note

Integrity findings should be precise and conservative. When uncertain, classify and verify rather than overstate.
