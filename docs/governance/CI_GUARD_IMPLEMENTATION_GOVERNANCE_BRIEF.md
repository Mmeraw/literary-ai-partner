# CI Guard Implementation Governance Brief

**Status**: PROPOSED LOCK — becomes LOCKED when merged  
**Scope**: Implementation contract for merge-time CI guard that consumes protected registry ontology  
**Owner**: Mmeraw  
**Created**: 2026-05-10  
**References**: PROTECTED_REGISTRY_SCAFFOLD_GOVERNANCE_BRIEF.md, CI_GUARD_GOVERNANCE_BRIEF.md, governance-before-implementation.md

---

## Document Visibility Classification

**This document is itself classified [PROTECTED].**

This brief specifies the implementation contract for the CI guard. Enforcement behavior is documentable; ontology contents are not. The brief defines obligations, interfaces, trigger authority, reporting contract, and acceptance gates — not implementation code, registry entries, or matching patterns.

---

## Inheritance

This brief inherits and does not re-derive:

- Governance-before-implementation doctrine
- Translation boundary doctrine
- Disclosure-audit and asymmetry doctrine
- Boundary integrity doctrine for CI guard
- Protected registry scaffold doctrine

Operational principle: **the guard consumes ontology; it does not define ontology**.

---

## Purpose

This brief locks the contract that implementation must satisfy in Cycle 13B-impl. It is the bridge from locked doctrine to operational enforcement code.

The contract defines:

- where the guard implementation lives
- how it consumes the registry
- what enforcement authority it has at merge time
- how exceptions are validated and logged
- what tests must prove

---

## Three-Layer Topology

The architecture is intentionally separated at path level:

- Ontology substrate: `protected/registry/`
- Enforcement implementation: `scripts/ci-guard/`
- Governance doctrine: `docs/governance/`

This separation is mandatory and non-negotiable for implementation acceptance.

---

## Consumer Discipline

Implementation must satisfy all consumer-discipline constraints:

- Guard reads ontology exclusively through the registry's exported read-only consumer contract.
- Guard must not define inline ontology categories or local substitute registries.
- Guard must not mutate registry state in-process or at build-time.
- Registry contract ownership remains upstream (registry PR governance), not in guard implementation.
- Enforcement semantics remain local to guard code; ontology semantics remain local to registry artifacts.

Any violation fails implementation acceptance regardless of other passing checks.

---

## Trigger and Merge Authority

Enforcement trigger surface is:

- GitHub Actions workflow on pull request events
- Branch protection requiring guard check success for merge

Pre-commit hooks are out of scope and non-authoritative.

Merge-time enforcement is authoritative and required.

---

## Escape Valve Discipline

Exception discipline remains validator-first and auditable:

- `@InternalOnly` annotation is accepted only when validator-confirmed
- comment-only suppression is invalid
- accepted exceptions must be surfaced in CI summary reporting
- exception counts must be visible per PR

This preserves governed exceptions rather than silent bypass behavior.

---

## Failure Mode Contract

On invalid boundary-crossing detection outside valid exceptions:

- guard fails closed
- merge is blocked by required-check policy
- CI summary reports category-level violation context and file/path location
- reporting must not disclose registry contents or literal protected entries
- structured workflow artifact is emitted for audit retrieval

On internal guard errors (registry read failure, validator error, scope evaluation error), fail closed.

---

## Test Contract

Implementation PR must prove:

1. violation is detected in in-scope user-facing surface
2. validator-confirmed exception is accepted and logged
3. out-of-scope surfaces do not produce false positives
4. guard reads only through registry consumer interface
5. inline ontology definitions are absent from guard code
6. any runtime/validation error produces fail-closed outcome

Test assets must avoid canonical ontology disclosure.

---

## Acceptance Criteria

Cycle 13B-impl is accepted only when all pass:

1. Implementation path is `scripts/ci-guard/` and remains separated from ontology path
2. Registry consumption is read-only and contract-bound
3. No inline ontology definitions or registry mutations exist in guard implementation
4. Guard is enforced via GitHub Actions + branch protection required check
5. Escape valve is validator-confirmed and auditable in CI summary
6. Guard emits structured workflow artifact for audit retrieval
7. Guard fails closed on detection-path and execution-path errors
8. Test contract is fully satisfied
9. No regex or registry-content disclosure appears in implementation docs, workflow messaging, or fixtures

---

## Non-Goals

This brief does not include:

- implementation code
- workflow YAML implementation
- registry entries or schema contents
- literal failure-message examples containing protected tokens
- integration for other consumers (translation runtime, export sanitizer, error normalization)

---

## Refs

Refs #416, #417, #418, #419, #420
