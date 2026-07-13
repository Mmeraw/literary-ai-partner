# Revision Workbench Components

The dedicated card components in this directory are being introduced in two stages:

1. Define and test the separate interaction models.
2. Wire the existing workbench shell to the discriminated union after the backend queue contract stabilizes.

Current dedicated components:

- `CopyPasteRewriteCard.tsx`
- `StrategyCard.tsx`
- `WithheldSummary.tsx`

The existing `ReviseCockpitClientWorkflowV1` remains the integration shell during the parallel ledger work.
