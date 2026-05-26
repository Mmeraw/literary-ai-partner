## Summary

Adds a direct Agent Readiness package CTA to the dashboard's Current Manuscript Focus card.

## Why

PR #690 made Agent Readiness manuscript-bound and added table-level entry points. The dashboard's most prominent manuscript area should also offer the next logical action when the latest evaluation is complete: build the Agent Readiness package for that manuscript.

## Changes

- Adds a dashboard helper to build `/agent-readiness?manuscriptId=...&evaluationJobId=...` links.
- Adds a guard so the focus-card CTA appears only for completed/non-running/non-failed evaluations.
- Adds `Build Agent Readiness Package` to the Current Manuscript Focus action stack for eligible latest manuscripts.
- Leaves failed/running evaluations focused on `Open details`/progress instead of package generation.

## Scope

Dashboard UX/routing only.

No Agent Readiness generation logic, persistence, export behavior, evaluation pipeline, scoring, database schema, or Storygate eligibility behavior changed.

## Acceptance Criteria

- Latest completed dashboard manuscript has a visible `Build Agent Readiness Package` action in Current Manuscript Focus.
- CTA links to `/agent-readiness` with both `manuscriptId` and `evaluationJobId`.
- Running or failed latest evaluations do not show the Agent Readiness CTA.
- Existing `Open latest report`, `Continue Revise`, and `Re-evaluate` actions remain available.
