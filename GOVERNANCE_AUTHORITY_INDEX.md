# Governance Authority Index

**Last Updated:** 2026-02-08  
**Status:** All 5 rules complete and enforced  

---

## ✅ Canonical Governance Rules (All Closed)

### 1. Fresh Database Rule
**Status**: ✅ CLOSED  
**Evidence**: [GOVERNANCE_CLOSEOUT_A4_COMPAT_CONTRACTS.md](GOVERNANCE_CLOSEOUT_A4_COMPAT_CONTRACTS.md)  
**PRs**: #9, #10  
**Rule**: Each migration must run cleanly from an empty DB. Use drop+create for signature changes.  
**Enforcement**: CI gate validates migration atomicity; violations block merge.

### 2. Immutable Public API Rule
**Status**: ✅ CLOSED  
**Evidence**: [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md)  
**PRs**: Core design, enforced by CI  
**Rule**: RPC signatures are immutable; use `c_*` compat wrappers + `p_*` canonical functions.  
**Enforcement**: Canon Guard validates JOB_CONTRACT_v1 compliance on every commit.

### 3. Compilation Boundary Rule
**Status**: ✅ CLOSED  
**Evidence**: [GOVERNANCE_CLOSEOUT_A4_COMPAT_CONTRACTS.md](GOVERNANCE_CLOSEOUT_A4_COMPAT_CONTRACTS.md) + PR #19  
**PRs**: #19  
**Rule**: Workers consume compiled `.js`, not `.ts` sources; do not mix bundler and node16 in one config.  
**Enforcement**: `tsconfig.workers.json` separated from `tsconfig.json` enforces boundary at compile time.

### 4. Canonical Vocabulary Rule
**Status**: ✅ CLOSED  
**Evidence**: [GOVERNANCE_CLOSEOUT_CANONICAL_VOCABULARY.md](GOVERNANCE_CLOSEOUT_CANONICAL_VOCABULARY.md)  
**PRs**: #20  
**Rule**: All job lifecycle terminology uses canonical values (status, phase, phase_status) enforced at write boundaries.  
**Enforcement**: `lib/jobs/canon.ts` validators + `canon-audit-banned-aliases.sh` CI gate + type system guarantees.

### 5. Master Data Management (MDM) Work Type Rule
**Status**: ✅ CLOSED  
**Evidence**: [docs/MDM_INDEX.md](docs/MDM_INDEX.md) (Canvas Index)  
**PRs**: #21  
**Rule**: Every text submission must route to exactly one Work Type; that Work Type structurally determines criteria applicability (R/O/NA/C). NA criteria are hard-prohibited via named control RG-NA-001 and fail-closed enforcement gates.  
**Canon Documents**:
  - [docs/MDM_WORK_TYPE_CANON_v1.md](docs/MDM_WORK_TYPE_CANON_v1.md) — Invariants MDM-01 (full coverage) / MDM-02 (family dimension), control RG-NA-001 (Dirty-Data Kill Switch), R/O/NA/C semantics
  - [docs/WORK_TYPE_REGISTRY.md](docs/WORK_TYPE_REGISTRY.md) — 25 canonical Work Types with immutable IDs, 10 families, detection policy, UI contract
  - [docs/MDM_IMPLEMENTATION_RUNBOOK.md](docs/MDM_IMPLEMENTATION_RUNBOOK.md) — Runtime validation, NA gates (input + output), audit persistence, new-hire onboarding
**Enforcement**: Master data path `functions/masterdata/work_type_criteria_applicability.v1.json` + `validateWorkTypeMatrix()` load-time validation + acceptance fixtures + audit-grade persistence of `criteria_plan` and NA exclusions.

---

## Governance Design Pattern

Each closed governance rule follows this artifact pattern:

1. **Problem**: What caused the failure?
2. **Root Cause**: Why did it happen?
3. **Resolution**: What changed?
4. **Governance Rule**: The enforceable canon
5. **Proof**: PR merges + CI validation
6. **Enforcement Mechanism**: What prevents regression?

See individual closeout documents for full detail.

---

## CI Enforcement Checkpoints

| Gate | What It Validates | Blocks Merge If |
|------|-------------------|---|
| **Canon Guard** | JOB_CONTRACT_v1 compliance | Contract violations detected |
| **TypeScript** | Compilation boundary + type safety | Type errors or compilation fails |
| **canon-audit-banned-aliases.sh** | Semantic drift (legacy aliases in storage) | Banned terms found in DB writes |
| **Smoke Tests** | Canonical values used at runtime | Tests fail with assertions |
| **Migration Validation** | Fresh database rule compliance | Migration fails from empty DB |

---

## Future: Strict Mode Enablement

After 1–2 releases stabilize canonical vocabulary enforcement, enable:

```bash
scripts/canon-audit-banned-aliases.sh --strict
```

This upgrades CI from advisory (logs warnings) to blocking (rejects PRs).

---

## Next Phase: C — Operational Hardening

With governance complete, the system moves to:

- **Goal**: "Every job completes or fails transparently, and system health can be assessed in <30s"
- **D1 (Failure Envelope)**: ✅ CLOSED (Spec-Complete, Infra-Blocked)
  - Evidence: [GOVERNANCE_CLOSEOUT_PHASE_C_D1_FAILURE_ENVELOPE.md](GOVERNANCE_CLOSEOUT_PHASE_C_D1_FAILURE_ENVELOPE.md)
  - Quick Reference: [D1_CLOSURE_QUICKREF.md](D1_CLOSURE_QUICKREF.md)
  - Specification: [docs/FAILURE_ENVELOPE_v1.md](docs/FAILURE_ENVELOPE_v1.md)
  - Proof blocker: IPv6-only Supabase DNS meets IPv4-only GitHub runners (infrastructure, not code)
  
- **D2 (Observability Logging)**: ✅ CLOSED (Spec-Complete, Minimal Wiring)
  - Evidence: [GOVERNANCE_CLOSEOUT_PHASE_C_D2_OBSERVABILITY.md](GOVERNANCE_CLOSEOUT_PHASE_C_D2_OBSERVABILITY.md)
  - Contract: [docs/LOGGING_SCHEMA_v1.md](docs/LOGGING_SCHEMA_v1.md)
  - Lifecycle wiring: Minimal (job.failed only); broader emissions deferred to post-D4
  
- **D3 (Observability Queries)**: ✅ CLOSED (Evidence-Run; Infra-Blocked)
  - Evidence: Inline in [PHASE_C_EVIDENCE_PACK.md](PHASE_C_EVIDENCE_PACK.md) + [evidence/phase-c/d3/](evidence/phase-c/d3/)
  - Queries: [docs/queries/OBSERVABILITY_QUERIES_v1.sql](docs/queries/OBSERVABILITY_QUERIES_v1.sql)
  
- **D4 (Observability Coverage)**: ✅ CLOSED (Artifact Created, Checklist Documented)
  - Evidence: [GOVERNANCE_CLOSEOUT_PHASE_C_D4_COVERAGE.md](GOVERNANCE_CLOSEOUT_PHASE_C_D4_COVERAGE.md)
  - Coverage: [docs/PHASE_C_D4_OBSERVABILITY_COVERAGE.md](docs/PHASE_C_D4_OBSERVABILITY_COVERAGE.md)
  
- **D5 (Health Dashboard)**: ⏳ PENDING

**Starting Point**: [PHASE_C_EVIDENCE_PACK.md](PHASE_C_EVIDENCE_PACK.md)

---

## Related Documents

- [docs/CANONICAL_VOCABULARY.md](docs/CANONICAL_VOCABULARY.md) — Vocabulary rules detail
- [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md) — RPC contract definition
- [docs/LOGGING_SCHEMA_v1.md](docs/LOGGING_SCHEMA_v1.md) — Observability logging contract (Phase C D2)
- [lib/jobs/canon.ts](lib/jobs/canon.ts) — Type enforcement implementation
- [scripts/canon-audit-banned-aliases.sh](scripts/canon-audit-banned-aliases.sh) — CI gate script

---

**Authority**: This index is the single source of truth for governance rule status. When in doubt about what's governed and what's not, consult this document.
