# Report Golden Fixtures

These fixtures define the product-level golden surface for RevisionGrade reports.

They are intentionally mode-level fixtures, not live generated output. The contract is:

```text
UED / certified report data → EvaluationReportViewModel → TXT / HTML-PDF / DOCX
```

Each fixture declares:

- the canonical product mode;
- the manuscript profile used to exercise that mode;
- required public fields that every renderer must expose;
- expected section order;
- mode-specific required strings;
- strings that must never leak to author-facing surfaces.

The first contract test validates the fixture package itself. Follow-up renderer tests should load these fixtures and assert that ViewModel, TXT, HTML/PDF, and DOCX outputs preserve all required public strings without leaking forbidden internals.

## Fixtures

| Fixture | Mode | Purpose |
|---|---|---|
| `short-form/expected.json` | `short_form_evaluation` | Short report, no DREAM sections |
| `long-form/expected.json` | `long_form_evaluation` | Standard long-form report boundary |
| `long-form-multi-layer/expected.json` | `long_form_multi_layer_evaluation` | Full DREAM multi-layer report |
