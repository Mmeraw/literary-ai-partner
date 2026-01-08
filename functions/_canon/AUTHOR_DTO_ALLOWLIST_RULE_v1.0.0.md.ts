# AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0.md

**Canon Spec — Author DTO Allowlist Serialization Rule (v1.0.0)**

**Status:** CANON-READY  
**Change Control:** CCR required after freeze  
**Last-Modified:** 2026-01-08  
**Depends on:** INDUSTRY_ENTITIES_v1.0.0.md (v1.0.0), INDUSTRY_PORTAL_SPEC_v1.0.0.md (v1.0.0), WORK_TYPE_POLICY_ROUTING_SPEC.md (v1.0.0)

---

## Purpose

Make "no internal-field leakage to authors" a structural invariant by requiring allowlist-only serialization for all author-facing outputs, including feature-flagged and shared endpoints, and by enforcing safe error shapes.

---

## 1. Canon Rule (Non-Negotiable)

### 1.1 Allowlist-only author DTOs

Any author-facing endpoint must construct responses exclusively via explicit allowlist DTO mappers ("positive selection").

**Blacklist filtering ("hide these fields") is forbidden.**

### 1.2 No raw entity serialization

Author-facing responses must never return:
- entities / ORM models / DB records
- shared internal DTOs
- internal pipeline/decision objects

**even if filtered.**

All author responses must be produced via dedicated Author DTO mapper functions.

**Author-facing responses must be constructed exclusively from dedicated Author DTO mappers; returning entities, ORM models, or shared 'internal' DTOs is forbidden, even if filtered.**

### 1.3 Shared endpoints and feature flags are included

This rule applies to:
- all `/author/*` endpoints
- any endpoint callable by both AUTHOR and INDUSTRY roles ("shared endpoints")
- any endpoint behind feature flags that could be enabled for authors

**Role-shaped response selection must occur server-side prior to serialization.**

**Shared endpoints** means:
- any endpoint callable by both roles
- any endpoint returning submission/project data used in both UIs
- any endpoint behind feature flags (because flags are a common leak path)

---

## 2. Definitions

### 2.1 Author-facing endpoint

Any endpoint that can be called by an AUTHOR role or returns data rendered in author UI.

### 2.2 Shared endpoint

Any endpoint callable by both roles and/or used by both UIs, including feature-flagged endpoints.

### 2.3 Allowlist DTO mapper

A function that returns only explicitly enumerated fields defined in the Author DTO schema, e.g.:
- `toAuthorSubmissionDTO(...)`
- `toAuthorProjectDTO(...)`

No implicit spreading/serialization of source objects is permitted.

---

## 3. Implementation Pattern (Required)

### 3.1 Dedicated mappers

- `toAuthor*DTO(entity)` → Author*DTO (strict allowlist)
- `toIndustry*DTO(entity)` → Industry*DTO (role-gated allowlist; may be broader)

### 3.2 Legal output paths

- Author endpoints may only return Author*DTO shapes
- Industry endpoints may only return Industry*DTO shapes

### 3.3 Source-of-truth contracts

- Author DTO schemas are the allowlist contract
- Visibility Contract table (INDUSTRY_ENTITIES_v1.0.0.md §4) is the field-level visibility contract

**Any field marked Author=N must never appear in author JSON.**

**Allowlist schemas are machine-readable:**
- Author DTO allowlist is the schema
- Industry DTO allowlist is the schema
- Visibility table is the source-of-truth for allowed fields

**When a field exists in visibility matrix as Author=N, tests fail if it appears in author JSON.**

---

## 4. Error-Path Hardening (Non-Negotiable)

All author-facing errors must use a minimal safe error shape:
- `code`
- `message`
- `requestId`

Author errors must never include:
- stack traces
- debug dumps
- entity snapshots
- internal IDs not required for user support

**All author error responses must use a safe error shape (code, message, requestId) and must never include entity snapshots, stack traces, or debug dumps.**

---

## 5. Required Tests (Release Blocking)

### 5.1 No-leak JSON assertions

For every author-facing endpoint that returns submission/project data:
- Assert absence of banned fields from the Visibility Contract (Author=N fields).

**Build must fail if any banned field appears.**

### 5.2 No raw serialization enforcement

**"No raw entity serialization" tests:**
- Unit/integration tests must ensure author handlers return only Author*DTO schemas (typed checks or schema validation).
- Any attempt to return an entity/ORM model/shared internal DTO to an author must fail tests.
- Scan author endpoints for usage of:
  - `return entity`
  - `return submission`
  - direct JSON serialization of DB objects without mapper

### 5.3 Shared endpoint role-shaping

- Tests must confirm server-side role checks select Author vs Industry DTO paths prior to serialization.
- Feature-flagged endpoints must be covered.

---

## 6. Change Control

This is a security and trust contract.

Any change requires a CCR with:
- rationale
- diff of Author-visible fields
- updated visibility table entries
- updated tests demonstrating continued no-leak guarantees

---

## Release Gate

Any PR that modifies:
- author endpoints
- shared DTOs
- serializer/mappers

must pass:
- "no-leak" tests (absence assertions)
- role-route tests (`/agent` forbidden to authors)