# Golden Fixtures — Real Benchmark Handoff

## Purpose

Replace synthetic golden-fixture data with repo-grounded product fixtures.

Active product modes are exactly:

```text
short_form_evaluation
long_form_multi_layer_evaluation
```

There is no active standalone `long_form_evaluation` product mode. Do not recreate `tests/fixtures/report-golden/long-form/expected.json`.

## Runtime benchmark authority

Use the repository's benchmark index as the authority source:

```text
docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
```

The index declares:

- `Cartel Babies` = required-gold, `runtime-authority: true`, active long-form multi-layer benchmark.
- `Froggin Noggin` = required-gold benchmark authority.
- `Let the River Decide` = calibration-tier benchmark authority.
- `The Lost World of MythOAmphibia / DOMINATUS I` = required-gold candidate.
- Public-domain files such as `Dracula`, `Great Expectations`, `Pride and Prejudice`, and `The Wonderful Wizard of Oz` are calibration only and not RevisionGrade-native runtime authority.

For the first real DREAM renderer golden fixture, use **Cartel Babies** because it is the primary required-gold product/runtime exemplar.

Source file:

```text
docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md
```

Important source facts from the benchmark front matter / header:

```yaml
benchmark-schema: dream-longform-v2-governed-ledgers
evaluation-mode: long_form_multi_layer_evaluation
manuscript: Cartel Babies
author: Michael J. Meraw
route: LONG_FORM
output-mode: multi_layer_long_form
benchmark-tier: required-gold
runtime-authority: true
current-manuscript-observed-word-count: 125004
```

Header values:

```text
Report Type: Long-Form Multi-Layer Evaluation
Overall Score: 76/100
Market Readiness: Not Market Ready
Genre: Upmarket Suspense / Literary Cartel Thriller
Target Audience: Adult readers of literary suspense, borderlands crime fiction, character-driven thrillers, trauma-recovery fiction, and morally complex family dramas
Shelf: Literary Thriller / International Crime / Borderlands Fiction
```

## Required final fixture layout

```text
tests/fixtures/report-golden/README.md
tests/fixtures/report-golden/short-form/expected.json
tests/fixtures/report-golden/long-form-multi-layer/expected.json
```

Forbidden final file:

```text
tests/fixtures/report-golden/long-form/expected.json
```

## Replace DREAM fixture JSON

Write this file exactly:

```text
tests/fixtures/report-golden/long-form-multi-layer/expected.json
```

```json
{
  "schema_version": "report_golden_fixture_v1",
  "fixture_id": "long-form-multi-layer-cartel-babies",
  "mode": "long_form_multi_layer_evaluation",
  "route": "LONG_FORM",
  "word_count_band": "75000+",
  "source_benchmark_path": "docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md",
  "benchmark_role": "required-gold-runtime-authority",
  "manuscript_profile": {
    "title": "Cartel Babies",
    "word_count": 125004,
    "genre": "Upmarket Suspense / Literary Cartel Thriller",
    "target_audience": "Adult readers of literary suspense, borderlands crime fiction, character-driven thrillers, trauma-recovery fiction, and morally complex family dramas"
  },
  "required_surfaces": ["view_model", "txt", "html_pdf", "docx"],
  "expected_section_order": [
    "title_block",
    "one_paragraph_pitch",
    "one_sentence_pitch",
    "premise",
    "executive_summary",
    "top_strengths",
    "top_risks",
    "top_recommendations",
    "criteria_score_grid",
    "criterion_analyses",
    "revision_opportunity_summary",
    "revision_plan",
    "releasability",
    "acceptance_checks",
    "author_disclaimer"
  ],
  "required_public_strings": [
    "Cartel Babies",
    "Long-Form Multi-Layer Evaluation",
    "76/100",
    "Not Market Ready",
    "Upmarket Suspense / Literary Cartel Thriller",
    "Adult readers of literary suspense, borderlands crime fiction, character-driven thrillers, trauma-recovery fiction, and morally complex family dramas",
    "Literary Thriller / International Crime / Borderlands Fiction",
    "When a retired Canadian expatriate is kidnapped on a Sinaloan highway, he must survive cartel captivity long enough for love, loyalty, and a child born into violence to become the only possible path out.",
    "A Canadian expatriate abducted by cartel operatives in Sinaloa is pulled into a hidden camp where survival depends on tactical observation, emotional discipline, and dangerous usefulness.",
    "Cartel abduction and captivity",
    "Threats of execution and disappearance",
    "Child endangerment and trauma",
    "Total Revision Opportunities: 37",
    "Recommended: 18",
    "Optional: 14",
    "Consider: 5",
    "Cartel Babies is a powerful long-form thriller-drama about abduction, captivity, queer partnership, chosen family, cartel infrastructure, and the moral systems that grow inside failed states and informal power structures.",
    "Benchmark verdict: strong manuscript; revise before public release; strong beta / agent-prep candidate after compression, plausibility, and packaging passes.",
    "High-concept hook with literary depth.",
    "Embodied cartel-camp architecture.",
    "Central emotional triad.",
    "Procedural smoothness in the final third.",
    "Benjamin repetition.",
    "Upper-cartel differentiation.",
    "Run a current manuscript-integrity pass.",
    "Compress 8–12% globally without damaging voice.",
    "Make the final protection sequence procedurally resistant.",
    "Concept & Core Premise",
    "Narrative Drive & Momentum",
    "Character Depth & Psychological Coherence",
    "Point of View & Voice Control",
    "Scene Construction & Function",
    "Professional Readiness & Market Positioning",
    "Define the public-facing premise around chosen family under cartel sovereignty, with cartel survival as the engine and Paolito/Paul as the emotional hinge.",
    "For every Benjamin chapter, assign one irreversible new function: contact, failed institution, family rupture, money decision, search action, risk, discovery, or aftercare obligation.",
    "Add credible friction: jurisdiction, documentation, custody, child status, cross-border authority, medical/psych intake, threat assessment, and timing constraints."
  ],
  "required_dream_keys": [
    "executive_summary",
    "top_strengths",
    "top_risks",
    "top_recommendations",
    "criteria_score_grid",
    "criterion_analyses",
    "revision_opportunity_summary",
    "revision_plan",
    "releasability",
    "acceptance_checks"
  ],
  "required_revision_queue_display_rule": {
    "must_render_clean_display_text": true,
    "forbidden_raw_tokens": ["[LOCATION:", "[OPERATION:"]
  },
  "forbidden_public_strings": [
    "revision_opportunity_ledger",
    "revision_canon_metadata",
    "internal_check_id",
    "provider_response",
    "raw_prompt",
    "chain_of_thought",
    "Final External Audit",
    "Golden Spine"
  ]
}
```

## Renderer test alignment

The current renderer test may still build a synthetic DREAM document such as `The Burning Archive`. Replace that synthetic DREAM builder with a Cartel Babies-derived fixture builder or temporarily scope renderer assertions to stable strings available in the Cartel Babies fixture.

Minimum renderer test requirements:

1. The fixture file must load from `tests/fixtures/report-golden/long-form-multi-layer/expected.json`.
2. The test must assert `mode === long_form_multi_layer_evaluation`.
3. No active test may assert or load `long_form_evaluation`.
4. No active test may require `tests/fixtures/report-golden/long-form/expected.json`.
5. Public-domain calibration files must not be used as runtime golden fixtures.

## Commands

```bash
find tests/fixtures/report-golden -maxdepth 3 -type f -print
npx jest --runInBand --runTestsByPath \
  __tests__/lib/evaluation/reportGoldenFixtures.contract.test.ts \
  __tests__/lib/evaluation/reportGoldenFixtures.renderer.test.ts
```

If renderer assertions fail because the test still emits synthetic data, update the test builder to emit Cartel Babies strings above, not the fixture JSON.

## Commit message

```text
test(rendering): ground golden fixtures in real benchmark canon
```
