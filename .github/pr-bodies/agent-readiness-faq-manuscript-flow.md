## Summary

Updates the Agent Readiness FAQ so the public/support copy matches the new manuscript-bound package workflow.

## Why

PR #690 moved Agent Readiness away from a misleading one-click package action and toward a clearer workflow: select manuscript first, complete sections second, generate final package last. The FAQ should explain that same mental model so users understand why the page starts with manuscript context and why final package generation lives after the section workflow.

## Changes

- Reframes the FAQ headline around building from a selected manuscript, not a blank page.
- Adds a Workflow Order section:
  - Confirm the manuscript
  - Generate and review sections
  - Generate the final package
- Adds the product rule directly: `Top = manuscript. Middle = sections. Bottom = final package.`
- Adds FAQ entries explaining:
  - why manuscript selection is required
  - which manuscript appears by default
  - why final package generation is at the bottom
- Adds `What Makes This Novel Unique` to the package-section list.
- Expands approval doctrine to include manuscript-bound package requirements.

## Scope

Public/support copy only.

No Agent Readiness runtime, generation, persistence, export behavior, dashboard routing, evaluation pipeline, scoring, database, Storygate, Revise, or TrustedPath behavior changed.

## Acceptance Criteria

- Agent Readiness FAQ explains that package generation is manuscript-bound.
- FAQ describes the selected-manuscript-first workflow.
- FAQ no longer implies Agent Readiness starts from a blank page or one top-level package button.
- FAQ explains final package generation as the bottom/assembly step.
- Package section list includes the uniqueness/differentiator section.
- No film/TV, screenplay, adaptation, pitch-deck, or screen-project language is introduced.
