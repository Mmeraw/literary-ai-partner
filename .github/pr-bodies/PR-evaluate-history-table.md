## Summary

Replaces the `/evaluate` Recent Evaluations gallery/cards with a compact row-based job table.

## Changes

- Converts each evaluation from a large card into a single compact row.
- Adds columns: Status, Evaluation ID, Submitted, Phase, Next Action, Report, Actions.
- Keeps Evaluation ID visible and clickable for every job.
- Shows full UUID in the Evaluation ID tooltip while displaying the short ID in the row.
- Shows a report/detail hyperlink in the Report column when the report is available.
- Shows `—` for unreleased reports instead of wasting space.
- Keeps Live Progress / STOP for active jobs and View Details for all jobs.
- Removes the large nested Input → Action → Output panel and repeated status language.
- Updates history copy to describe a compact job table instead of manuscript cards.

## Scope

UI-only change in `components/evaluation/EvaluateEntry.jsx` plus this PR body.

No changes to:
- evaluation pipeline
- job creation
- Supabase schema
- scoring
- prompts
- report generation
- WAVE / Phase 0 / Phase 1A / Pass 3A / Phase 2 logic

## Acceptance Criteria

- Desktop Recent Evaluations renders as table rows, not cards.
- Each job appears as one compact row.
- Status, Evaluation ID, Submitted, Phase, Next Action, Report, and Actions are visible.
- Evaluation ID links to `/evaluate/[jobId]`.
- Complete jobs show a report hyperlink.
- Failed/unreleased jobs show `—` in the Report column but still link to details through Evaluation ID and Actions.
- The row layout allows scanning 10+ jobs with much less scrolling.

No-Pipeline-Impact: Confirmed — presentation-only UI change.

<!-- pr-type: ui -->
