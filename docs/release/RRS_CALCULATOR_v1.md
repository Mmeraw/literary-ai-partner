# Release Readiness Score (RRS) — Calculator

**Status:** NORMATIVE (Scoring Spec)  
**Authority:** Release Governance (Binding)  
**Last Updated:** 2026-02-08  
**Execution Model:** Solo + AI-native

**Change Control:** Weights and thresholds are immutable except via governance PR with explicit rationale and evidence that Phase C/D gates do not reopen.
---

## Purpose

RRS is a **numeric, audit-defensible score (0–100)** derived from gate closure status.

RRS is used to determine whether RevisionGrade may be exposed to:
- **Public users** (threshold ≥ 85)
- **Literary agents** (threshold ≥ 90)

**No partial credit is allowed without evidence.** A gate contributes its full weight only when CLOSED.

---

## Inputs

Each gate has:
- `weight` (integer, percentage points)
- `status` ∈ {OPEN, CLOSED}
- `evidence_links` (required if CLOSED, empty if OPEN)

---

## Formula

For each gate i:

$$score_i = \begin{cases} weight_i & \text{if } status_i = \text{CLOSED} \\ 0 & \text{if } status_i = \text{OPEN} \end{cases}$$

Then:

$$RRS = \sum_{i} score_i$$

**RRS must equal 100 only when all weighted gates are CLOSED.**

---

## Default Gate Weights

### Phase C (60 points) — Governance & Auditability

- **C1:** Failure envelope defined = 10 points
- **C2:** Observability system defined = 10 points
- **C3:** Analytics proof (evidence-run) = 10 points
- **C4:** Observability coverage & completeness = 10 points
- **C5:** MDM governance canon (Work Types) = 20 points

**Subtotal Phase C:** 60 points

### Phase D (40 points) — Exposure Safety

- **D1:** Public UX safety & error contracts = 8 points
- **D2:** Agent trust signals & output clarity = 8 points
- **D3:** Abuse, rate limiting, cost controls = 8 points
- **D4:** Support, rollback, incident readiness = 8 points
- **D5:** Legal, ethical, disclosure alignment = 8 points

**Subtotal Phase D:** 40 points

**Total:** 100 points

---

## Output Fields

Any calculation of RRS must record:

- `rrs_total` (0–100, integer)
- `public_release_allowed` (boolean, true if RRS ≥ 85)
- `agent_onboarding_allowed` (boolean, true if RRS ≥ 90)
- `failed_gates` (list of gate IDs that are OPEN)
- `last_calculated_at` (ISO 8601 timestamp)
- `calculated_by` (actor: "founder", "automated", etc.)

---

## Hard Rules

1. **If any Phase C gate is OPEN:** RRS is still computable, but exposure is disallowed per [PHASE_D_RELEASE_GATES_v1.md](PHASE_D_RELEASE_GATES_v1.md) Invariant D-01.

2. **If any CLOSED gate lacks evidence_links:** That gate must be treated as OPEN. No exceptions.

3. **If any No-Go condition is triggered:** `public_release_allowed = false` and `agent_onboarding_allowed = false` regardless of numeric score.

4. **Weights are immutable** unless a new PRs updates this document and merges to main. No ad-hoc adjustments.

---

## Worked Example

### Example 1: Phase C Complete, Phase D All OPEN (Current State)

| Gate | Weight | Status | Score |
|------|--------|--------|-------|
| C1 | 10 | CLOSED | 10 |
| C2 | 10 | CLOSED | 10 |
| C3 | 10 | CLOSED | 10 |
| C4 | 10 | CLOSED | 10 |
| C5 | 20 | CLOSED | 20 |
| D1 | 8 | OPEN | 0 |
| D2 | 8 | OPEN | 0 |
| D3 | 8 | OPEN | 0 |
| D4 | 8 | OPEN | 0 |
| D5 | 8 | OPEN | 0 |

**RRS = 10 + 10 + 10 + 10 + 20 + 0 + 0 + 0 + 0 + 0 = 60**

**public_release_allowed = false** (60 < 85)  
**agent_onboarding_allowed = false** (60 < 90)

---

### Example 2: Phase C Complete, D1 + D2 CLOSED (After 6 weeks)

| Gate | Weight | Status | Score |
|------|--------|--------|-------|
| C1–C5 | 60 | CLOSED | 60 |
| D1 | 8 | CLOSED | 8 |
| D2 | 8 | CLOSED | 8 |
| D3 | 8 | OPEN | 0 |
| D4 | 8 | OPEN | 0 |
| D5 | 8 | OPEN | 0 |

**RRS = 60 + 8 + 8 + 0 + 0 + 0 = 76**

**public_release_allowed = false** (76 < 85)  
**agent_onboarding_allowed = false** (76 < 90)

**Status:** Controlled beta feasible (invitation-only, agents validate behavior)

---

### Example 3: Full Phase D Complete (Final State, Weeks 11-12)

| Gate | Weight | Status | Score |
|------|--------|--------|-------|
| C1–C5 | 60 | CLOSED | 60 |
| D1 | 8 | CLOSED | 8 |
| D2 | 8 | CLOSED | 8 |
| D3 | 8 | CLOSED | 8 |
| D4 | 8 | CLOSED | 8 |
| D5 | 8 | CLOSED | 8 |

**RRS = 60 + 8 + 8 + 8 + 8 + 8 = 100**

**public_release_allowed = true** ✅ (100 ≥ 85)  
**agent_onboarding_allowed = true** ✅ (100 ≥ 90)

**Status:** Military-grade launch cleared. Public + agent exposure permitted.

---

## Implementation Notes

### Manual Calculation (Current / Recommended Until D1 Closes)

1. Review [PHASE_D_RELEASE_READINESS.md](PHASE_D_RELEASE_READINESS.md) gate status table
2. Sum weights of gates marked CLOSED
3. Record result + timestamp in checklist document
4. Update `rrs_total` in release readiness file

### Automated Calculation (Future, After D1 Closes)

Once D1 gate closes, a small script can:

```bash
# scripts/calculate_rrs.sh
jq '.gates[] | select(.status == "CLOSED") | .weight' docs/release/RRS_STATUS.json | \
  awk '{sum+=$1} END {print "RRS:", sum}'
```

This turns RRS into a CI-gateable signal.

---

## Audit Trail

Every time RRS changes:

1. Gate closure PR must document:
   - Previous RRS
   - New RRS
   - Which gate(s) closed
   - Evidence links

2. Update timestamp in [PHASE_D_RELEASE_READINESS.md](PHASE_D_RELEASE_READINESS.md)

3. Commit message format:
   ```
   docs(release): close gate D[X], RRS [old]% → [new]%
   
   Evidence: [link]
   ```

---

## When to Recalculate

RRS must be **recalculated and updated** when:

- Any gate status changes (OPEN → CLOSED or vice versa)
- Any evidence is removed or invalidated
- Any No-Go condition is triggered or cleared
- Any Phase D governance document is updated materially

It **does not** need recalculation for:
- Cosmetic documentation edits
- Phase C changes (already at 100%, immutable)
- Non-governance PRs (features, bugfixes, etc.)

---

## Thresholds (Canonical)

These thresholds are **binding and immutable** unless updated via PR:

| Exposure Type | Minimum RRS | Rationale |
|---------------|------------|-----------|
| Public users | ≥ 85% | Error safety + agent trust proven |
| Agent onboarding | ≥ 90% | All exposure safety gates except disclosures proven |
| Beta (invitation-only) | ≥ 76% | Agent trust + error safety proven, controlled exposure only |
| No exposure | < 76% | Governance framework only, no external validation |

---

## Final Lock Statement

**RRS is the single numeric signal that determines RevisionGrade exposure readiness.**  
**RRS is calculated from gate closure only, with no sentiment, progress claims, or roadmap assumptions.**  
**RRS may only change when gate evidence is committed and linked.**  
**No exception. No override.**
