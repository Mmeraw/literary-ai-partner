# Revise Workbench UI Card Contract

This contract governs presentation only. It does not change queue classification, persistence, admission, or ledger behavior.

## Copy-paste rewrite

- Exactly three executable candidates: A, B, and C.
- A is the recommended repair.
- B is a rhythm/cadence variant.
- C is a bolder but governed rendering shift.
- Accept A/B/C and Trusted Path are available only for this card type.

## Revision strategy

- One unified strategy plan.
- Optional subordinate implementation approaches rendered hierarchically.
- Optional author decision and safeguards.
- No A/B/C labels.
- No Accept controls.
- No Trusted Path.
- Any illustrative prose is non-executable and must not appear as a peer candidate set.

## Withheld

- Excluded from the active editing queue.
- Visible in a non-interactive held-items summary.
- Clear hold reason, missing context, and recovery action.
- No candidate prose, Generate, Accept, or Trusted Path controls.

## Integration boundary

The UI consumes a discriminated union:

```ts
type WorkbenchCardViewModel =
  | CopyPasteCardViewModel
  | StrategyCardUiViewModel
  | WithheldCardViewModel
```

Backend queue, persistence, and admission work remains independently scoped.
