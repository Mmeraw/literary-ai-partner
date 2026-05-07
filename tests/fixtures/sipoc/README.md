# SIPOC Fixture Corpus (PR B Foundation)

This directory is the governed fixture corpus foundation for SIPOC certification.

Authority source: `docs/SIPOC_EVALUATION_PROCESS.md`

## Scope (PR B)

- Fixture contract/schema only
- Seed fixtures only (small deterministic set)
- No runtime changes
- No harness implementation
- No CI workflow changes

## Canonical Stage IDs

Fixtures **must** use immutable stage IDs:

- `S01_INTAKE`
- `S02_QUEUE`
- `S03_CLAIM`
- `S04_ROUTING_CHUNKING`
- `S05_PASS1`
- `S06_PASS2`
- `S07_PASS3`
- `S08_ER2_NORMALIZATION`
- `S09_QUALITYGATEV2`
- `S10_PERSISTENCE`
- `S11_RENDERER`

No aliases, no inferred mapping, no silent renames.

## Fixture Validation Contract

Each fixture must validate against `schema.json` and declare:

- `stage_id`
- `invariant_id`
- expected fail-closed behavior
- expected/forbidden failure code families
- required evidence artifact kinds
- authority refs (contract/canon/spec/runtime)

## Seed Corpus Intent

The seed fixtures intentionally encode first-order invariants only:

- canonical status contract
- atomic claim/lease behavior
- pass independence
- score/null separation
- deterministic quality-gate fail-closed semantics
- persistence boundary fail-closed semantics
- render/release gate safety

PR C (harness) will execute these fixtures.
