## Summary

Adds a product doctrine document for the Agent Readiness manuscript-bound workflow.

## Why

Recent PRs corrected the Agent Readiness UX so users first confirm the manuscript, then work through package sections, then generate the final package. This doctrine captures the product rule as a stable reference so future UI/runtime/persistence work does not drift back toward a misleading one-click-first model.

## Changes

- Adds `docs/product/agent-readiness-workflow-doctrine.md`.
- Defines the core rule: `Top = manuscript. Middle = sections. Bottom = final package.`
- Documents default manuscript selection behavior.
- Documents selected-manuscript panel requirements.
- Defines required package sections.
- Clarifies final package action placement and copy.
- Captures export rules, package-status states, dashboard entry points, author-control requirements, and non-promises.
- Keeps current scope focused on book/manuscript submission preparation.
- Explicitly excludes film/TV, screenplay, pitch deck, adaptation, and screen-project workflows until implemented.

## Scope

Documentation/product doctrine only.

No app runtime, UI rendering, database, Agent Readiness generation, export behavior, dashboard routing, Storygate, Revise, TrustedPath, evaluation, scoring, or pipeline behavior changed.

## Acceptance Criteria

- Doctrine document exists under `docs/product/`.
- Document states the workflow order clearly.
- Document describes manuscript defaulting and URL override behavior.
- Document lists required package sections.
- Document clarifies final package generation as the bottom/assembly step.
- Document preserves author control and author-bio fact governance.
- Document avoids unsupported film/TV/screenplay/adaptation scope.
