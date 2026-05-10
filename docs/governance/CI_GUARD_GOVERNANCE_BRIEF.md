# CI Guard Governance Brief

**Status**: PROPOSED LOCK — becomes LOCKED when merged  
**Scope**: Mechanical enforcement of the translation boundary at merge time  
**Owner**: Mmeraw  
**Created**: 2026-05-10  
**References**: TRANSLATION_LAYER_GOVERNANCE_BRIEF.md, governance-before-implementation.md, AI_GOVERNANCE.md

---

## Brief Visibility Classification

**This document is itself classified [PROTECTED].**

This brief specifies the enforcement boundary and behavioral contract for the CI guard. Specific protected identifier patterns, registry contents, registry expansion workflows, and annotated exception records are intentionally omitted from this document and maintained only within the protected registry and enforcement implementation. This brief specifies what the guard does and why — not what it matches or how its detection patterns are expressed.

This brief may be cited in internal RevisionGrade governance and adjudication contexts. It must not be reproduced verbatim outside internal governance, and must not be referenced in user-facing surfaces, CI log messages visible to end users, or public documentation.

---

## Foundational Principle

> **The system is operationally inspectable without being architecturally reconstructable.**

This is the single sentence the CI guard enforces mechanically. Everything in this brief derives from it.

Users and contributors may observe what RevisionGrade produces — scores, feedback, fit/gap framing, editorial guidance — without being able to reconstruct the protected architecture that produces it. The CI guard is the first permanent, merge-time mechanism that makes this principle non-bypassable by human error, fatigue, or oversight.

This boundary is referenced from `TRANSLATION_LAYER_GOVERNANCE_BRIEF.md`, which locks the membrane itself. This brief locks the enforcement mechanism.

---

## What the Guard Protects

The guard enforces one category of boundary: **boundary-crossing references**.

A boundary-crossing reference is any token, identifier, or structural pattern that belongs exclusively to the internal protected architecture and has no legitimate presence in a user-facing surface.

The boundary-crossing reference categories are documented in the protected registry. The CI guard reads from that registry at enforcement time. The brief does not enumerate the categories' contents.

**User-facing surfaces in scope** for guard enforcement:

- API response payloads delivered to calling clients
- Exported artifacts delivered to end users
- Error messages and user-facing status strings
- Rendered UI state (strings, labels, codes shown to users)

**Surfaces explicitly out of scope** (not enforced by this guard):

- Server-side logs (not user-facing)
- Internal test fixtures (covered by escape valve, see below)
- Database schema column names (separate governance lane)
- Developer-mode stack traces (not delivered to users in production)
- Analytics events (separate pipeline governance; access-controlled; not user-facing by definition used here)

The boundary between in-scope and out-of-scope is the delivery of content to an external caller or user. If it crosses the wire to a non-internal surface, the guard applies.

---

## Registry Separation

The protected registry lives at `lib/translation/canonical-registry.ts`.

It is:

- **Repo-internal**: not published, not exported, not referenced from public documentation
- **Version-controlled**: every change is a committed PR, not a configuration edit
- **Access-segregated**: readable only within the private repository boundary; not logged in CI artifacts

The CI guard reads from the registry at enforcement time. Adding a new protected identifier category or expanding an existing category requires a **registry PR** (governance action) before any code PR that would reference the new category. This sequencing is mandatory and mirrors the governance-before-implementation pattern already canonical in this repo.

The brief does not reference the registry's specific contents. Registry contents are the registry's concern.

---

## Enforcement Behavior

**Pass condition**: The PR diff introduces no boundary-crossing reference in any in-scope user-facing surface.

**Fail condition**: The PR diff introduces one or more boundary-crossing references in any in-scope user-facing surface.

**On failure**:

- The CI check fails and blocks merge
- The failure message identifies the surface where the violation was detected (file path, line number) but does not reproduce the registry pattern that triggered it
- No override path exists; the PR cannot merge while the check is failing
- Resolution: either remove the boundary-crossing reference, or open a registry PR first (if the identifier is genuinely new and legitimately intended for an internal surface that was mis-scoped as user-facing)

**On pass**:

- The CI check reports clean
- No enumeration of checked patterns appears in the pass message
- The pass message confirms: "Translation boundary: clean"

---

## Escape Valve — Annotated Exceptions

Some legitimate code contexts contain boundary-crossing references intentionally: test fixtures that exercise the translation layer's own mapping logic, migration scripts that read old internal field names to convert them, and internal-only utilities that are not user-facing by design.

These contexts may use a validated annotation:

```
// @InternalOnly — validator-confirmed, not user-facing
```

Rules:

- The annotation must appear on the same line as or immediately preceding the flagged reference
- The annotation is `validator-confirmed` meaning the CI guard explicitly recognizes it and suppresses the violation — it is not a comment-only suppression
- Annotated exceptions are logged in the CI output as `[ANNOTATED EXCEPTION: <file>:<line>]` for auditability
- Annotation use is auditable: the count of annotated exceptions per PR is reported in the CI summary

The escape valve is narrow by design. If annotated exceptions grow beyond a small number in any single PR, that is a signal the scope boundary is being misapplied, not that the escape valve needs to expand.

---

## Acceptance Criteria

This is a binary gate. Partial credit does not exist.

| Gate | Condition | Pass |
|------|-----------|------|
| G1 | CI guard runs on every PR diff targeting `main` | Yes / No |
| G2 | Guard reads exclusively from protected registry (no hardcoded patterns) | Yes / No |
| G3 | Failure blocks merge with no override path | Yes / No |
| G4 | Failure message identifies surface location without reproducing registry pattern | Yes / No |
| G5 | Annotated exceptions are logged and counted in CI summary | Yes / No |
| G6 | Pass message contains no enumeration of checked patterns | Yes / No |
| G7 | Registry expansion requires a registry PR before the consuming code PR | Yes / No |

All seven gates must pass. Any single gate failing means the implementation PR does not merge.

---

## Non-Goals

The CI guard is **not** a security scanner, compliance filter, content moderator, linter, or comprehensive IP protection system. It enforces one boundary: boundary-crossing references in user-facing surfaces.

Calling this guard a "security" component is explicitly incorrect. Its role is **boundary integrity enforcement** — a governance function, not a security function.

---

## Inheritance

This brief inherits and does not re-derive: disclosure discipline, asymmetric disclosure principle, and translation boundary definition — all locked in `governance-before-implementation.md` and `TRANSLATION_LAYER_GOVERNANCE_BRIEF.md`. The CI guard makes those doctrines mechanically enforceable at merge time.

---

## Disclosure Audit (required before lock)

Before this brief is submitted as a governance PR, it must pass the five-stage disclosure-audit cycle locked in `governance-before-implementation.md`:

1. **Initial doctrine draft** — present
2. **Review pressure** — self-review or external: confirm no boundary-crossing reference category is enumerated; confirm registry contents are absent; confirm no regex or detection pattern is disclosed
3. **Disclosure audit** — programmatic grep for ontology leakage
4. **Abstraction tightening** — cut any enumeration that survived review pressure
5. **Governance lock** — merge with [PROTECTED] classification and negative-space adjudication stamp

The brief in its current form defers all detection patterns, all registry contents, and all specific identifier categories to the protected registry. If review pressure surfaces any leaked enumeration, it must be cut before the PR opens.
