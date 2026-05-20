# corpus/public-domain/integrity-tests/

Deterministic acceptance tests for each public-domain source text.

## Purpose

Before a public-domain file can be used as a calibration fixture, it must pass
the integrity contract defined in `corpus/public-domain/registry.json`.

The verifier script enforces these checks automatically:

```
node scripts/verify-public-domain-corpus.mjs
```

## What is checked per work

- Source text file exists at the clean path
- Word count is within the expected range
- Apostrophe count meets the preservation floor (guards against over-normalization)
- No forbidden source artifacts (Project Gutenberg headers, illustration blocks, etc.)
- Chapter count matches expected value (where applicable)
- Roman numeral chapter sequence is continuous (where applicable)
- Calibration doc exists (where declared)

## Adding a new work

1. Add the work to `corpus/public-domain/registry.json` with a complete `integrity` block
2. Add the clean source text to `corpus/public-domain/clean/`
3. Run `node scripts/verify-public-domain-corpus.mjs`
4. Fix any failures before merging

## Active corpus

8 works — see `registry.json` for the full list.
