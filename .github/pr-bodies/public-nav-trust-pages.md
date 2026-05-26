## Summary

Surfaces the newer trust, FAQ, and package-support pages in the public navigation, resources hub, and footer.

## Why

Several completed public pages were hard to discover from the main site shell. The header Resources dropdown still exposed only the older resource set, while newer trust/support pages such as Privacy & Research Controls, Security & Access Controls, Genre & Classification FAQ, Storygate FAQ, and Agent Readiness FAQ were not consistently surfaced.

## Changes

- Expands the HeaderNav Resources dropdown to include:
  - Resources Hub
  - The Black Box Problem
  - Methodology
  - Editorial Doctrine
  - Privacy & Research Controls
  - Security & Access Controls
  - Genre & Classification FAQ
  - Storygate Studio FAQ
  - Agent Readiness FAQ
- Updates active-route coverage for the new resource/trust pages.
- Renames Agent Readiness dropdown entry from `Generate Full Agent Package` to `Package Workspace` to match the new manuscript-selection workflow.
- Adds Security & Access Controls and Agent Readiness FAQ cards to `/resources`.
- Reworks the footer into Product / Resources / Trust & Support link groups so important pages are discoverable outside the header menu.

## Scope

Navigation/discovery only.

No auth, pricing, evaluation pipeline, report generation, Agent Readiness generation, Storygate runtime, database, or package persistence behavior changed.

## Acceptance Criteria

- Header Resources dropdown exposes the new trust and FAQ pages.
- Header Resources active state covers the new resource/trust routes.
- Agent Readiness dropdown uses package-workspace language instead of implying one-click package generation.
- Resources hub includes Security & Access Controls and Agent Readiness FAQ cards.
- Footer links include product, resource, and trust/support destinations.
- No film/TV, screenplay, adaptation, pitch-deck, or screen-project language is introduced.
