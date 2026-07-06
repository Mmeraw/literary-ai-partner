# Benchmark Authority Nomenclature

Controlled vocabulary for the Benchmark Authority Library. Every manifest entry, contract, and benchmark source document must use terms from this lexicon. No synonyms, no ad-hoc labels.

## Product Modes (evaluation pipeline)

| Canonical Term | Description |
|---|---|
| `short_form_evaluation` | Short-form single-pass evaluation (< 10k words) |
| `long_form_multi_layer_evaluation` | DREAM long-form multi-layer evaluation (multi-pass, layered analysis) |

The retired `long_form_evaluation` mode is intentionally excluded. Active long manuscripts resolve to `long_form_multi_layer_evaluation`.

## Output Families

| Canonical Term | Description |
|---|---|
| DREAM Long-Form Multi-Layer Evaluation | Public product label for the multi-layer DREAM report surface |
| Short-Form Evaluation | Public product label for the short-form report surface |

## Benchmark Tiers (manifest `tier` field)

| Tier | Meaning | Runtime Authority | Fixture Builder Required |
|---|---|---|---|
| `required-gold` | Native GOLD standard. Governs production runtime. Failure blocks release. | `true` | Yes |
| `required-gold-candidate` | Promoted to GOLD pending full validation. Governs runtime provisionally. | `true` | Yes |
| `calibration` | Native benchmark used for scoring calibration. Does not govern runtime. | `false` | Yes |
| `calibration-only` | Public-domain or external benchmark exercising renderer parity only. Never runtime authority. | `false` | Yes (unless `contract_only: true`) |

## Benchmark Roles (source document `benchmark-role` field)

| Role | Description |
|---|---|
| `gold-standard-short-form` | GOLD standard for short-form evaluation |
| `gold-standard-long-form-multi-layer` | GOLD standard for DREAM long-form multi-layer evaluation |
| `gold-standard-long-form-multi-layer-candidate` | Candidate for GOLD standard promotion |
| `gold-standard-long-form-multi-layer-extension` | Architectural/genre addendum to an existing GOLD standard |
| `gold-standard-story-ledger` | GOLD standard for Story Ledger answer keys |
| `gold-standard-story-ledger-addendum` | Addendum to a Story Ledger GOLD standard |
| `flagship-gold-standard-long-form-multi-layer` | Flagship/reference GOLD standard (highest-authority teaching benchmark) |
| `calibration-short-form` | Calibration benchmark for short-form evaluation |
| `public-domain-calibration` | Public-domain text used for teaching/calibration |
| `public-domain-calibration-addendum` | Addendum to a public-domain calibration benchmark |

## Runtime Authority

A benchmark has `runtime_authority: true` if and only if:
- It is tier `required-gold` or `required-gold-candidate`
- Its contract is used to validate production renderer behavior
- Failure of its contract assertions can block a release

Public-domain benchmarks (`calibration-only`) can **never** have `runtime_authority: true`.

## Manifest Fields

| Field | Required | Type | Description |
|---|---|---|---|
| `id` | yes | string | Unique contract identifier |
| `mode` | yes | string | Product mode (see above) |
| `tier` | yes | string | One of the allowed tiers (see above) |
| `runtime_authority` | yes | boolean | Whether this benchmark governs production |
| `dir` | yes | string | Directory containing the contract file |
| `contract_file` | yes | string | Filename of the expected.json contract |
| `contract_only` | no | boolean | If true, skipped by renderer harness (contract test still validates) |
| `benchmark_status` | no | string | Additional status qualifier (e.g. `"candidate"`) |

## Contract Fields

| Field | Required | Description |
|---|---|---|
| `schema_version` | yes | Always `"benchmark_authority_contract_v1"` |
| `contract_id` | yes | Must match manifest `id` |
| `mode` | yes | Must match manifest `mode` |
| `benchmark_tier` | yes | Must match manifest `tier` |
| `runtime_authority` | yes | Must match manifest `runtime_authority` |
| `score_authority` | yes | Provenance of scores: `"truth-target"`, `"calibration-benchmark"`, `"fixture-scaffold"` |
| `scores_are_authoritative` | yes | Whether scores represent canon truth |
| `score_source` | conditional | Required if `scores_are_authoritative: true` |
| `required_public_strings` | yes | Universal strings asserted in TXT + HTML + DOCX |
| `surface_required_strings` | no | Per-surface strings (defaults to empty per surface) |
| `forbidden_public_strings` | yes | Strings that must never appear in any public surface |
| `required_criterion_keys` | yes | Canonical criterion keys the fixture must exercise |

## Score Authority

| Value | Meaning |
|---|---|
| `truth-target` | Scores derived from a verified truth-target document with explicit provenance |
| `calibration-benchmark` | Scores from a public-domain calibration benchmark |
| `fixture-scaffold` | Scores are non-authoritative scaffolding for renderer exercise only |

## Invariant Rules

1. **Tier enum**: manifest `tier` must be one of: `required-gold`, `required-gold-candidate`, `calibration`, `calibration-only`
2. **Public-domain cannot govern runtime**: if tier is `calibration-only`, then `runtime_authority` must be `false`
3. **Required-gold requires runtime authority**: if tier is `required-gold`, then `runtime_authority` must be `true`
4. **Candidate requires status field**: if tier is `required-gold-candidate`, then `benchmark_status` must be `"candidate"`
5. **Contract-only means no renderer harness**: if `contract_only: true`, the renderer parity harness skips this entry
6. **Builder required unless contract-only**: every manifest entry with `contract_only` absent or `false` must have a registered fixture builder
7. **Provenance rule**: if `scores_are_authoritative: true`, then `score_source` must be a non-empty path
8. **No fabricated metadata**: `word_count` must be verifiable or `null`; use `word_count_band` for estimates
