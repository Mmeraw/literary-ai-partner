# First Real Ontology Population Governance Brief

**Status**: PROPOSED LOCK — becomes LOCKED when merged
**Visibility**: [PROTECTED]
**Scope**: First real protected-reference category population — transition from proof to production enforcement
**Source PRs consumed**: #420, #421, #422, #423, #424, #425, #426, #427
**Created**: 2026-05-10

## Purpose

The protected registry currently contains only the synthetic proof token `ZXQ_SYNTHETIC_PROOF_TOKEN` (from #427). This brief authorizes the first transition from proof-exercised enforcement to production-enforced protection by populating the first real protected-reference category with 1–3 canonical protected identifiers.

The boundary mechanism is proven. The enforcement loop is verified. The next step is making the protection operationally meaningful against real protected concepts.

This brief specifies **what categories to populate** and **acceptance criteria** without disclosing the ontology entries themselves.

## Inheritance

This brief inherits without re-derivation:

- #418 disclosure-audit cycle and asymmetric disclosure
- #419 boundary integrity doctrine
- #420 registry scaffold doctrine  
- #421 CI guard implementation contract
- #424, #425 binding record contract
- #426 first population proof contract
- #427 proof-of-enforcement implementation

The guard consumes ontology; it does not define ontology. The registry PR precedes any consumer-expansion PR.

## Scope In

The first real ontology population implementation PR shall:

1. **Populate exactly one category** — a single protected-reference category with 1–3 entries from the canonical set
2. **Preserve the synthetic proof token** — `ZXQ_SYNTHETIC_PROOF_TOKEN` remains in the registry alongside real entries for backward compatibility with #427 tests
3. **Add one enforcement test** — a targeted test that proves the guard detects real protected entries in in-scope paths, accepts `@InternalOnly` annotations on them, and produces clean execution on non-violating code
4. **Disclose zero category contents** — the category file(s) will carry [PROTECTED] headers; the brief itself will not enumerate or hint at the entries
5. **Disclosure audit succeeds 11/11** — same audit surface as #427, with special attention to no enumerated protected identifiers in fixtures or abstract discussion

## Scope Out

The first real ontology population implementation PR shall **not**:

- Populate multiple categories (exactly one)
- Add more than 3 entries (minimize initial surface)
- Change guard logic, scope rules, workflow, or schema
- Modify branch protection configuration
- Update the synthetic proof token (it remains as backward-compat proof that #427 still works)
- Disclose the category name, entry names, or entry semantics in this brief or in comments
- Attempt comprehensive coverage (this is activation, not taxonomy)

## Enforcement Discipline

After this PR merges:

- The guard will detect both the real protected entries and the synthetic proof token in in-scope paths
- Any PR that introduces real protected entries in user-facing code without annotation will fail CI Guard
- The `@InternalOnly` annotation discipline remains the exception path for both synthetic and real entries
- The first deliberately-failing synthetic PR (documented in #426 but executed after this PR) will remain valid — the guard will detect `ZXQ_SYNTHETIC_PROOF_TOKEN` just as it does now

## Acceptance Criteria

The follow-on implementation PR is accepted only if all are true:

1. **Exactly one category is populated** with 1–3 entries from the canonical protected set
2. **No additional categories exist** (one category only)
3. **Synthetic proof token coexists** — `ZXQ_SYNTHETIC_PROOF_TOKEN` remains in synth-proof.ts unchanged
4. **One enforcement test exercises** — positive detection, exception acceptance, and clean execution on the real entries
5. **No changes to guard, scope, schema, workflow, or branch protection**
6. **The guard correctly detects all entries** — both real and synthetic, in in-scope paths
7. **Annotation discipline works** — `@InternalOnly` on real entries is accepted by validator
8. **Disclosure audit succeeds** — 11/11 checks with zero enumeration of protected identifiers in brief + implementation + tests
9. **PR's own merge under bound rule produces no findings** — clean execution verified by merge itself

## Disclosure Discipline

Category files and test fixtures follow the same recursive protection principle:

- [PROTECTED] headers on all category and test files
- No naming hints at category semantic (names can be abstract/opaque)
- No enumerated identifiers in this brief
- Fixtures use synthetic literals only, no real protected entry samples
- No schema field examples drawn from real entries

The protection principle extends to the governance brief itself: this file authorizes real population without revealing what is being populated.

## Verification Sequence

The implementation PR will be processed as:

1. Disclosure audit (pre-merge)
2. Targeted enforcement test run
3. Full guard regression test suite
4. Infrastructure audit across all changed files
5. Adjudication
6. Merge under bound CI Guard rule

The PR's own merge under the required check is the empirical verification that real ontology is now guarded end-to-end.

## Next Inflection Point

After this PR merges, the next major event is:

The first deliberately-failing synthetic PR — a PR that intentionally violates by introducing a boundary-crossing reference without annotation, designed to be mechanically rejected by CI Guard to further prove the boundary is operationally authoritative.

This brief does not include that deliberately-failing test; it is a separate verification PR executed after real ontology population is live.

## Refs

Refs #416, #417, #418, #419, #420, #421, #422, #423, #424, #425, #426, #427
