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
- `S10b_PHASE5_AUTHOR_EXPOSURE_GATE`
- `S10c_VIEWMODEL_BOUNDARY_GATE`
- `S11_RENDERER`
- `S11a_RENDERER_WEBPAGE`
- `S11b_DOWNLOAD_PIPELINE`

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

## Evidence model v3

The legacy fixture corpus and the v3 evidence model are deliberately separate:

- `npm run sipoc:validate` validates the 13 legacy fixture contracts.
- `npm run sipoc:evidence` validates `evidence-obligations.v3.json`, runs only
  attributable existing tests, and writes the executive evidence dashboard to
  `artifacts/sipoc/evidence-results.v3.json`.

The v3 runner recognizes exactly four evidence kinds:
`runtime_fail_closed`, `static_architecture_invariant`,
`pure_predicate_contract`, and `integration_transactional`. A legacy green
fixture does not automatically count as certification evidence.

Every unresolved obligation is classified into exactly one representation,
evidence, enforcement, or policy gap and carries an exclusive UTC expiry.
Only `satisfied_but_unmapped` may become `satisfied` when its named tests pass;
the runner cannot promote any other state.
