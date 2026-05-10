# Registry First Population Governance Brief

**Status**: PROPOSED LOCK — becomes LOCKED when merged
**Visibility**: [PROTECTED]
**Scope**: First ontology population — proof of enforcement correctness, not protection coverage
**Source PRs consumed**: #420, #421, #422, #423, #424, #425
**Created**: 2026-05-10

## Purpose

The protected registry is currently empty. CI Guard is operationally bound but has nothing to detect. This brief locks the minimal scope and proof contract for the first ontology population that converts the boundary from operationally inert to operationally active.

The first population is **proof, not policy**.

## Inheritance

This brief inherits, without re-derivation:

- #418 disclosure-audit cycle and asymmetric disclosure principle
- #419 boundary integrity doctrine
- #420 protected registry scaffold doctrine
- #421 CI guard implementation contract doctrine
- #424 and #425 binding record contract

The guard consumes ontology; it does not define ontology.

## Scope In

The first registry-population implementation PR shall include exactly:

1. One **synthetic protected reference** used solely for proof of enforcement behavior
2. One synthetic fixture proving positive detection in an in-scope path
3. One synthetic fixture proving validator-confirmed `@InternalOnly` exception acceptance
4. One synthetic fixture proving clean pass with no false positives

These cases collectively validate positive detection, exception discipline, clean pass behavior, and merge-time gating.

## Scope Out

The first registry-population implementation PR shall not:

- Expand beyond one synthetic proof reference
- Add broad coverage or topology modeling
- Change guard logic, scope rules, workflow, or schema
- Modify branch protection configuration
- Disclose canonical protected identifiers in this brief

## Synthetic Proof Contract

The first population must make the following enforcement behavior observable:

1. **Violation case**: in-scope synthetic boundary-crossing reference without annotation fails CI Guard
2. **Exception case**: same synthetic reference with validator-confirmed `@InternalOnly` passes CI Guard
3. **Clean case**: in-scope code without boundary-crossing reference passes CI Guard

The implementation PR’s own merge under bound rule serves as a clean-path gating confirmation.

## Acceptance Criteria

The follow-on implementation PR is accepted only if all are true:

1. Exactly one synthetic proof reference is populated in the registry
2. The three synthetic fixtures exist and execute in tests
3. CI Guard behavior is verified for violation, exception, and clean cases
4. No changes to scope rules, schema, validator, reporter, workflow, or branch protection
5. Disclosure audit passes with no canonical identifier leakage

## Disclosure Discipline

Fixtures are governed by the same disclosure discipline:

- Synthetic literals only (no canonical identifier exposure)
- No schema disclosure in fixtures or brief
- No ontology enumeration in this brief

## Next Verification (Post-merge)

After the first population implementation merges, open a deliberately violating synthetic PR (no annotation) to confirm merge gating blocks integration under required CI Guard. This is the first explicit self-protecting boundary demonstration.

## Refs

Refs #416, #417, #418, #419, #420, #421, #422, #423, #424, #425
