# Golden Fixtures Execution Patch

The previous synthetic DREAM fixture must be replaced with the repository's primary required-gold runtime benchmark fixture.

Because this handoff is intentionally procedural, perform the final substitution locally in Codespace rather than through a remote contents API call.

## Required final state

Only these active fixture files may exist:

```text
tests/benchmark-authority/README.md
tests/benchmark-authority/short-form/expected.json
tests/benchmark-authority/long-form-multi-layer/expected.json
```

This file must not exist:

```text
tests/benchmark-authority/long-form/expected.json
```

## Required product modes

```text
short_form_evaluation
long_form_multi_layer_evaluation
```

Do not reintroduce standalone `long_form_evaluation`.

## Local patch steps

1. Open:

```text
tests/benchmark-authority/long-form-multi-layer/expected.json
```

2. Replace the synthetic fixture identity with the repository's primary required-gold runtime benchmark identity.

The fixture must include:

```json
{
  "schema_version": "report_golden_fixture_v1",
  "mode": "long_form_multi_layer_evaluation",
  "route": "LONG_FORM",
  "word_count_band": "75000+",
  "source_benchmark_path": "docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md",
  "benchmark_role": "required-gold-runtime-authority"
}
```

3. Copy stable public strings from the source benchmark header and major sections into `required_public_strings`.

Use source file:

```text
docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md
```

Use stable strings from:

- front matter;
- report header;
- pitch sections;
- premise;
- revision opportunity summary;
- executive summary;
- top strengths;
- top risks;
- top recommendations;
- 13 criteria score grid;
- surfaced opportunities.

4. Update the DREAM half of:

```text
__tests__/lib/evaluation/benchmarkAuthority.renderer.test.ts
```

Replace synthetic manuscript strings with the same source benchmark strings used in the fixture.

5. Keep the short-form fixture as-is unless it fails the contract test.

## Commands

```bash
find tests/benchmark-authority -maxdepth 3 -type f -print
npx jest --runInBand --runTestsByPath \
  __tests__/lib/evaluation/benchmarkAuthority.contract.test.ts \
  __tests__/lib/evaluation/benchmarkAuthority.renderer.test.ts
```

## Commit

```bash
git add tests/benchmark-authority __tests__/lib/evaluation/benchmarkAuthority.renderer.test.ts
git commit -m "test(rendering): ground golden fixtures in benchmark canon"
git push origin main
```
