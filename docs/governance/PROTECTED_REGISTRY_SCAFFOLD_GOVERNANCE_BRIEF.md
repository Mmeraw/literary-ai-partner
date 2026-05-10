# Protected Registry Scaffold Governance Brief

**Status**: PROPOSED LOCK — becomes LOCKED when merged  
**Scope**: Registry scaffold as ontology source of truth for enforcement consumers  
**Owner**: Mmeraw  
**Created**: 2026-05-10  
**References**: CI_GUARD_GOVERNANCE_BRIEF.md, TRANSLATION_LAYER_GOVERNANCE_BRIEF.md, governance-before-implementation.md

---

## Document Visibility Classification

**This document is itself classified [PROTECTED].**

This brief specifies the structural contract of the protected registry — the ontology substrate consumed by enforcement and translation consumers. The schema is documentable; registry contents are not. This brief defines shape and governance posture only, and intentionally omits identifiers, category instances, literal values, and detection patterns.

---

## Inheritance

This brief inherits and does not re-derive:

- Governance-before-implementation workflow (`governance-before-implementation.md`)
- Translation boundary doctrine (`TRANSLATION_LAYER_GOVERNANCE_BRIEF.md`)
- Disclosure-audit cycle and asymmetric disclosure principle (`governance-before-implementation.md`)
- Boundary integrity doctrine (`CI_GUARD_GOVERNANCE_BRIEF.md`)

It applies the same pattern recursively inside enforcement: **the guard consumes ontology; it does not define ontology**.

---

## Purpose

The protected registry is the canonical ontology source of truth read by enforcement and boundary consumers. It prevents authority drift by ensuring no consumer defines ontology inline. Consumers read one governed substrate; they do not author independent local definitions.

Without this artifact, each consumer can diverge, creating fragmented authority, inconsistent boundary behavior, and reduced causal attribution.

---

## Architectural Position

The registry is a substrate layer between doctrine and consumer implementation:

- Doctrine layer defines boundary principles and governance rules
- Registry layer defines typed ontology structure and carries protected entries
- Consumer layer reads registry shape to execute enforcement or translation behavior

The registry is **declarative, not behavioral**. It does not define merge outcomes, enforcement logic, or validator policy.

---

## Location Decision

Registry location is a top-level classified path:

`protected/registry/`

Rationale:

- Neutral to any single consumer authority (not runtime-owned, not CI-owned)
- Classification visible at path level
- Governance ontology framing is explicit
- Future consumers can inherit without relocation

---

## Structure Decision

Registry is directory-based, not a single file:

- `protected/registry/index.ts` — typed exports and schema aggregation
- `protected/registry/categories/` — additive category modules

Rationale:

- Additive expansion with lower merge-conflict pressure
- Smaller PR surfaces for ontology changes
- Clear audit trails per category module

---

## Schema Contract

The registry publishes a typed shape for consumers while keeping contents protected.

Shape requirements (category-level only):

- Typed entry interface for registry records
- Category/type model for boundary-crossing classes
- Typed escape annotation contract consumed by validators
- Structured validation-result contract for consumer reporting
- Read-only consumer-facing access contract

No schema contents, example values, category instances, or literal identifiers are disclosed in this brief.

---

## Consumer Contract

Consumers are read-only with respect to registry ontology. Consumer capabilities are limited to:

- Membership checks against registry categories
- Retrieval of annotation contract metadata
- Structured validation-result retrieval for reporting

No consumer may mutate registry entries in-process. Ontology change requires a registry-governed PR.

---

## Registry Change Discipline

Registry updates are governance events.

Rules:

- Registry PR must merge before any consuming code PR that depends on the new ontology
- Registry PRs are disclosure-audited and adjudicated as ontology events
- Consumer PRs inherit the merged registry contract; they do not redefine it

This preserves causal attribution across ontology expansion and consumer behavior changes.

---

## Acceptance Criteria

Implementation against this brief is accepted only when all criteria pass:

1. Registry artifact exists at canonical classified path and is [PROTECTED]-governed
2. Registry defines typed shape/contract and remains declarative (non-behavioral)
3. Registry artifact contains no CI-guard or enforcement implementation logic
4. Governance artifacts disclose no registry contents or literal ontology instances
5. Registry changes are PR-governed and auditable as ontology events
6. Registry exposes read-only consumer contract for downstream lanes (next: CI guard implementation)

---

## Non-Goals

This brief does not include:

- CI guard implementation logic
- Translation runtime integration logic
- Export or error-handler consumer integration logic
- Registry detection patterns or matching implementations
- Registry contents, examples, or literal category instances

---

## Refs

Refs #416, #417, #418, #419
