## Summary

Converts the `/evaluate` Recent Evaluations area from a dense technical table into readable user-facing evaluation cards.

## Why

One of the remaining UX gaps is that evaluation history still reads like an internal job table: job ID first, technical columns, and compressed pipeline detail. Authors need to see their submissions as manuscript/evaluation cards with clear status, progress, report access, and timing.

## Changes

- Adds `EvaluationHistoryCard` inside `components/evaluation/EvaluateEntry.jsx`.
- Replaces the Recent Evaluations table with stacked cards.
- Keeps the same job data and actions:
  - Open Report
  - Live Progress / Queued
  - STOP cancellation for active jobs
  - View Details for non-complete terminal states
- Preserves phase breadcrumb visibility, but moves it into a `Process checkpoint` area instead of a table column.
- Adds readable status, submitted date, progress message, progress bar, and evaluation ID display.
- Keeps the empty-state behavior for users with no evaluations.

## Scope

Evaluate page UX only.

No evaluation submission logic, polling, job API, database, scoring, report generation, PDF export, dashboard analytics, Revise, TrustedPath, Storygate, or Agent Readiness behavior changed.

## Acceptance Criteria

- `/evaluate` Recent Evaluations renders as cards instead of a technical table.
- Complete jobs show a clear `Open Report` action.
- Running/queued jobs still show progress and cancellation controls.
- Failed/non-complete terminal jobs still have a details path.
- Phase breadcrumb/checkpoint remains visible without dominating the UI.
- Empty state remains available when there are no evaluations.
