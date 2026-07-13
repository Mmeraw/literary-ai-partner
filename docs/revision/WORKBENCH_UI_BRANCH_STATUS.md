# Revise Workbench UI branch status

Branch: `agent/revise-workbench-ui-card-split`

## Complete

- Dedicated `CopyPasteRewriteCard` with mandatory A/B/C presentation.
- Dedicated `StrategyCard` with one hierarchical plan and no A/B/C semantics.
- Dedicated `WithheldSummary` with no candidate, Generate, Accept, or Trusted Path controls.
- Discriminated `WorkbenchCardViewModel` contracts.
- Pure `adaptWorkbenchOpportunityToCard()` adapter from the current queue payload.
- `WorkbenchCardSurface` switch that renders by `cardType` and exposes only legal actions.
- Component and adapter tests proving cross-type controls do not leak.

## Remaining before merge

- Wire `ReviseCockpitClientWorkflowV1` to `WorkbenchCardSurface` after the parallel ledger/queue contract settles.
- Rebase on Devin's backend branch once its payload contract is final.
- Run repository CI and authenticated preview proof.
- Capture screenshots for copy-paste, strategy, and held-item states.

## Isolation

This branch does not change persistence, queue classification, admission policy, or queue partitioning.
