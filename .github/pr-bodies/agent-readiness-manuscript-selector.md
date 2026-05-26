## Summary

Reworks `/agent-readiness` so the page starts with manuscript context instead of a premature `Generate Complete Package` CTA.

## Why

Agent Readiness is manuscript-bound. The current page implies a user can click one top-level button to generate a complete package, but the actual workflow requires a completed manuscript evaluation and section-by-section package work first.

## Changes

- Converts `/agent-readiness` into a dynamic server page that loads dashboard evaluation rows.
- Auto-selects the latest completed/evaluation-ready manuscript by default.
- Honors URL overrides from dashboard links:
  - `manuscriptId`
  - `evaluationJobId`
- Adds a Selected Manuscript panel where the old top CTA sat:
  - manuscript dropdown
  - Latest Evaluation: Complete
  - Readiness Score
  - Package Status
  - View Evaluation Report
- Excludes running and failed evaluations from Agent Readiness manuscript options.
- Passes selected manuscript/evaluation IDs into section links.
- Disables section generation when no manuscript is available.
- Moves the package-level action below the six section cards and renames it `Generate Final Package`.
- Adds dashboard table links to start Agent Readiness directly for eligible completed evaluations.

## Scope

UX and routing/state context only.

No Agent Readiness generation model, persistence schema, export renderer, Storygate eligibility logic, scoring logic, evaluation pipeline, or database migration is changed.

## Follow-up seam

`Package Status` currently defaults to `Not Started` until package persistence exists. Future PR should wire this to `agent_readiness_packages` / section persistence once that table/service is introduced.

## Acceptance Criteria

- `/agent-readiness` no longer shows `Generate Complete Package` near the top.
- The top workflow block shows selected manuscript context.
- The latest completed eligible manuscript is selected by default.
- Users can choose other completed eligible manuscripts from a dropdown.
- Dashboard can open Agent Readiness with manuscript/evaluation context.
- Final package generation appears after the required sections, not before them.
- Failed/running evaluations are not eligible manuscript choices.
