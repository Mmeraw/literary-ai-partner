# Long-Form Evaluation Template

> **RETIRED. Historical artifacts only. Do not use for new evaluation generation.**

This template mode and its canonical mode identifier `long_form_evaluation` are retired for all new job routing.

- Retired canonical mode: `long_form_evaluation`
- Replacement for all new 25,000+ word submissions: `long_form_multi_layer_evaluation`
- Full archived content: `docs/templates/evaluation/archive/long-form-evaluation-template.archived.md`

## Runtime Policy

- New evaluations must never route to `long_form_evaluation`.
- Historical persisted artifacts already tagged `templateMode = long_form_evaluation` remain renderable via legacy render paths in the download route and `reportHeaderPolicy`.
- Pipeline prompt builders (`pass3b-longform.ts`, `editorialDreamSeedGenerator.ts`) must not load this template for new jobs.
- `inferCanonicalEvaluationModeFromWordCount(25_000)` returns `long_form_multi_layer_evaluation`. No code path may override this for new submissions.

## Two-Product Model

RevisionGrade now operates two evaluation products:

1. **Short-Form Evaluation** (`short_form_evaluation`) — submissions under 25,000 words
2. **Long-Form Multi-Layer Evaluation** (`long_form_multi_layer_evaluation`) — submissions of 25,000+ words

There is no intermediate long-form mode.

## Authority

The definitive product templates are:

- `docs/templates/evaluation/short-form-evaluation-template.md`
- `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md`

These are Level 1 Golden Records. All downstream systems (UED, renderers, benchmarks, contracts) derive from them.
