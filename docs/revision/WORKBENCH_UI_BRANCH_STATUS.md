# Revise Workbench UI branch status

Branch: `agent/revise-workbench-ui-card-split`

## Complete

- Dedicated `CopyPasteRewriteCard` with mandatory A/B/C presentation.
- Dedicated `StrategyCard` with one hierarchical plan and no A/B/C semantics.
- Dedicated `WithheldSummary` with no candidate, Generate, Accept, or Trusted Path controls.
- Discriminated `WorkbenchCardViewModel` contracts.
- Pure `adaptWorkbenchOpportunityToCard()` adapter from the current queue payload.
- `WorkbenchCardSurface` switch that renders by `cardType` and exposes only legal actions.
- Live `ReviseCockpitClientWorkflowV2` shell wired to the strict card surfaces.
- Component, adapter, and smoke tests proving cross-type controls do not leak.

## Backend integration status

- PR #1263 is merged to `main` with canonical ledger read-back, Final Review all-bucket parity, latest-per-opportunity rehydration, undo handling, and pending-local precedence.
- PR #1262 is conflict-free against the new `main`; pull-request CI now validates the UI code against the merged #1263 ledger implementation.
- The UI branch does not duplicate or replace the canonical ledger logic from #1263.

## Remaining before merge

- Run repository CI against the current `main` merge result.
- Complete authenticated preview proof for copy-paste, strategy, and held-item states.
- Verify saved decisions rehydrate in V2 after refresh and appear in Final Review.
- Capture screenshots for all three card states and sync/error states.
- Complete keyboard-order, focus, contrast, and responsive-width QA.

## Isolation

This branch does not change persistence, queue classification, admission policy, or queue partitioning. It consumes the canonical ledger endpoint and server authority established on `main`.
