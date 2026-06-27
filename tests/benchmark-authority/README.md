# Benchmark Authority Contracts

These are executable benchmark contracts — machine-readable representations of RevisionGrade's gold standards that prove every renderer faithfully implements the benchmark.

They are not test fixtures. They are the authority chain:

```text
Benchmark → Contract → Renderer → Verify
```

Each contract declares:

- the canonical product mode;
- the manuscript profile used to exercise that mode;
- required public strings that every renderer must emit;
- expected section order;
- strings that must never leak to author-facing surfaces.

Every commit can prove that nothing drifted. If any renderer changes, the benchmark contract immediately says: "This output no longer represents the gold standard."

## Active contracts

| Contract | Mode | Purpose |
|---|---|---|
| `short-form/expected.json` | `short_form_evaluation` | Short report, no DREAM sections |
| `long-form-multi-layer/expected.json` | `long_form_multi_layer_evaluation` | Full DREAM multi-layer report |

## Retired mode rule

`long_form_evaluation` is not an active customer-facing product mode. Standard long-form has been retired/archived; active long manuscripts resolve to the long-form multi-layer DREAM surface. Do not add `long-form/expected.json` or any new active benchmark contract for `long_form_evaluation`.
