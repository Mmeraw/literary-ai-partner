# Governance Authority Index

**Last Updated:** 2026-02-07  
**Status:** All 4 rules complete and enforced  

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
- **Artifacts**:
  1. Failure envelope definition (shape for all error states)
  2. Observability v1 (structured logs, queries, dashboards)
  3. Retry/deadletter path formalization
  4. Structured alerting thresholds

**Starting Point**: [PHASE_C_RELIABILITY_ROADMAP.md](PHASE_C_RELIABILITY_ROADMAP.md) (to be created)

---

## Related Documents

- [docs/CANONICAL_VOCABULARY.md](docs/CANONICAL_VOCABULARY.md) — Vocabulary rules detail
- [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md) — RPC contract definition
- [lib/jobs/canon.ts](lib/jobs/canon.ts) — Type enforcement implementation
- [scripts/canon-audit-banned-aliases.sh](scripts/canon-audit-banned-aliases.sh) — CI gate script

---

**Authority**: This index is the single source of truth for governance rule status. When in doubt about what's governed and what's not, consult this document.
