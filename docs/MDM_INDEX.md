# Master Data Management (MDM) — Canon Index

**Status:** NORMATIVE (Index Only)  
**Authority:** Canonical Index (Non-Normative)  
**Purpose:** Defines where canonical rules live, not the rules themselves  
**Last Updated:** 2026-02-08

---

## Purpose

This document provides the authoritative index for RevisionGrade's Master Data Management (MDM) system.

It defines **where canonical rules live**, not the rules themselves.

**No rules are defined here. In conflicts, the target document governs.**

---

## Canonical Documents

### 1. MDM Governance Canon

**[`MDM_WORK_TYPE_CANON_v1.md`](./MDM_WORK_TYPE_CANON_v1.md)**

Defines invariants, named controls, applicability semantics (R/O/NA/C), and hard prohibitions.

**Governs:**
- Invariant MDM-01 (full coverage mandatory)
- Invariant MDM-02 (family as first-class dimension)
- Control RG-NA-001 (Dirty-Data Kill Switch)
- R/O/NA/C enforcement semantics
- Acceptance fixtures and validation rules

---

### 2. Work Type Registry

**[`WORK_TYPE_REGISTRY.md`](./WORK_TYPE_REGISTRY.md)**

Defines all approved Work Types, families, and detection constraints.

**Governs:**
- Canonical Work Type IDs (immutable)
- Work Type labels, descriptions, and detection hints
- Approved family enumeration (10 families)
- Detection confidence policy
- UI contract requirements
- Deprecation and change management rules

---

### 3. Implementation Runbook

**[`MDM_IMPLEMENTATION_RUNBOOK.md`](./MDM_IMPLEMENTATION_RUNBOOK.md)**

Defines how canon is enforced in runtime code, validation, auditing, and CI.

**Governs:**
- Master data anchoring (JSON path and schema)
- Work Type detection → confirmation → routing flow
- Criteria plan construction algorithm
- NA enforcement gates (input + output)
- Audit persistence requirements
- Acceptance fixtures (test code)
- New-hire onboarding curriculum
- Deployment and change workflow

---

## Canon Hierarchy

When determining authority, the following order applies:

1. **MDM Governance Canon** (rules and invariants)
2. **Work Type Registry** (allowed values and definitions)
3. **Implementation Runbook** (enforcement contracts)
4. **Machine master data** (JSON: `functions/masterdata/work_type_criteria_applicability.v1.json`)
5. **Runtime code** (functions: `detectWorkType`, `validateWorkTypeMatrix`, etc.)
6. **Stored evidence** (Supabase: `EvaluationAuditEvent`, job audit logs)

In conflicts between documents at the same level, the **Governance Canon** is authoritative.

In conflicts between documentation and code, **documentation governs** (code must be corrected).

---

## Governance Architecture Summary

**RevisionGrade treats MDM as a first-class governance system.**

Canonical meaning lives in **GitHub** (normative docs + master data), enforcement happens in **runtime validators**, evidence is persisted in **Supabase**, and **Vercel** is a non-canonical execution surface.

NA criteria are structurally prohibited via named control **RG-NA-001** with fail-closed enforcement and audit-grade persistence.

---

## Canon Tier Mapping (What Lives Where)

This is the governance alignment table auditors love.

### 🟩 GitHub — Normative Canon (Source of Truth)

| File | Canon Role |
|------|------------|
| `MDM_WORK_TYPE_CANON_v1.md` | Invariants + controls |
| `WORK_TYPE_REGISTRY.md` | Approved Work Types |
| `MDM_IMPLEMENTATION_RUNBOOK.md` | Enforcement contract |
| `work_type_criteria_applicability.v1.json` | Machine-readable canon |
| Phase C governance docs | Process canon |

**Meaning lives here.**

### 🟦 Supabase — State & Evidence Canon

| Artifact | Role |
|----------|------|
| `evaluation_jobs` | Routing + status evidence |
| `criteria_plan` fields | NA enforcement proof |
| `observability_events` | Audit events (D2) |
| Stored `matrix_version` | Reproducibility |

**What happened lives here.**

### 🟥 Vercel — Execution Surface (Non-Canonical)

| Item | Role |
|------|------|
| Serverless runtime | Executes canon |
| Env vars | Secret injection only |
| Edge config | No semantics allowed |

**Never defines meaning. Only runs code.**

---

## Non-Canonical Artifacts

The following are **non-authoritative** unless explicitly referenced by the canonical documents above:

- Examples, heuristics, and UI hints
- Test fixtures (except acceptance fixtures in Canon + Runbook)
- Metrics, logs, and observability data
- Performance optimizations
- Developer conveniences
- Experimental features
- User-facing help text

These may inform or support, but they do not define correctness.

---

## Change Rule

Any change to the following **must update the relevant canonical document** above or is invalid:

- Work Type IDs, labels, or definitions
- Criteria applicability (R/O/NA/C assignments)
- Family enumeration or taxonomy
- Enforcement semantics (gates, validation, audit requirements)
- Detection → confirmation → routing flow

Changes to non-canonical artifacts (performance, UI polish, logging) do not require canon updates.

**Index Guard:** Changes to this index do not alter system behavior unless the referenced canonical documents are also updated.

---

## For Auditors & Investors

RevisionGrade's Master Data Management system is governed by three binding documents indexed above.

**Thesis:**  
MDM prevents "confident mis-scoring" — where the system confidently applies the wrong rubric to the wrong work type.

**Mechanism:**  
Work Types structurally determine criteria applicability. NA enforcement prevents AI overreach.

**Traceability:**  
Every evaluation stores the Work Type used, criteria plan derived, and NA exclusions applied. Audits are replayable from logs.

**Maturity Indicator:**  
This index + three canonical documents establish RevisionGrade as a **governed evaluation system**, not an opinionated AI.

---

## Quick Start

**New hires:** Read the documents in order (1 → 2 → 3), then complete the onboarding curriculum in the Runbook.

**Auditors:** Start with the Canon (invariants + controls), then verify enforcement in Runbook Part 4–6.

**Investors:** Read Canon Part 9 + Runbook Part 9 (investor summaries), then ask: "How do you prevent wrong-rubric scoring?" (Answer: Control RG-NA-001 + NA gates.)

**Engineers adding a Work Type:** Follow Runbook Part 8 (change management), update Registry + master data JSON, validate fixtures.

---

## References

- **Master Data JSON:** [`functions/masterdata/work_type_criteria_applicability.v1.json`](../functions/masterdata/work_type_criteria_applicability.v1.json)
- **Key Functions:** `detectWorkType`, `validateWorkTypeMatrix`, `buildCriteriaPlan`, `applyNAOutputGate`
- **Audit Schema:** `entities/EvaluationAuditEvent.json`
- **Acceptance Tests:** `functions/testWorkTypeRouting.js`

---

**End of Index**
