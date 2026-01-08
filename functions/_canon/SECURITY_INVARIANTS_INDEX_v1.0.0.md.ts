# SECURITY_INVARIANTS_INDEX_v1.0.0.md

**Canon Index — Security & Trust Invariants (v1.0.0)**

**Status:** CANON-READY  
**Change Control:** CCR required after freeze  
**Last-Modified:** 2026-01-08  
**Depends on:** WORK_TYPE_POLICY_ROUTING_SPEC.md (v1.0.0), INDUSTRY_PORTAL_SPEC_v1.0.0.md (v1.0.0), INDUSTRY_ENTITIES_v1.0.0.md (v1.0.0), AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0.md (v1.0.0)

---

## Purpose

Provide a single authoritative index of the security/trust canon documents that define:
- what policy semantics are allowed (by work type)
- who can access industry vs author surfaces
- which fields can be exposed to which role
- how author outputs are mechanically prevented from leaking internal data

These invariants are non-negotiable and must be enforced via code structure and CI gates, not convention.

---

## 1. Canon Invariant Cluster (Binding)

### 1) WORK_TYPE_POLICY_ROUTING_SPEC.md (v1.0.0)

**Role:** Policy-family binding for evaluation semantics and allowed/forbidden copy by workTypeUi.

**Primary risk controlled:** semantic drift (Micro receiving Manuscript routing language).

---

### 2) INDUSTRY_PORTAL_SPEC_v1.0.0.md (v1.0.0)

**Role:** Hard route separation and industry UI architecture under `/agent/*`, distinct from author UI.

**Primary risk controlled:** accidental cross-surface exposure (authors landing in industry views).

---

### 3) INDUSTRY_ENTITIES_v1.0.0.md (v1.0.0)

**Role:** Minimal industry entity set + DTO contracts + Visibility Contract table (Author vs Industry field matrix).

**Primary risk controlled:** internal fields (notes/tags/reason codes/pipeline) appearing in author outputs.

---

### 4) AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0.md (v1.0.0)

**Role:** Allowlist-only author serialization; bans raw entity/internal DTO returns; mandates safe error shapes; defines release-blocking tests.

**Primary risk controlled:** leakage via reused internal DTOs, feature-flagged endpoints, and error payloads.

---

## 2. Enforcement Requirements (Release Blocking)

Any release affecting submissions, evaluations, or messaging must satisfy:
- workTypeUi → policyFamily selector correctness and copy safety
- `/agent/*` route and role gating (author forbidden)
- author DTO allowlist serialization (no raw entities/internal DTOs)
- "no-leak" assertions from Visibility Contract
- safe author error shapes (code, message, requestId)

---

## 3. Default Visibility Principle (Invariant)

**New fields added to any entity are AUTHOR-INVISIBLE by default.**

Author visibility requires:
- explicit allowlist addition in Author DTO schemas
- visibility table update (Author=Y)
- passing no-leak tests

---

## 4. Change Control

Any change to these invariants requires a CCR including:
- rationale
- affected surfaces and roles
- diffs to visibility table and/or allowlists
- updated tests demonstrating continued guarantees