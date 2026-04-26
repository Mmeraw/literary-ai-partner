# RevisionGrade System Roadmap (V2 – Enforcement First)

---

## 🎯 Core Principle

> If it is not enforced, it is not real.

> Before any enforcement diff, prove the boundary it will be installed at.

This roadmap separates:
- **System Build (what we build)**
- **System Truth (what is provably enforced)**

Certification is based ONLY on enforced invariants.

---

# 🔴 CURRENT PRIORITY: EVAL 2.0 TRUST LAYER

We are not building features.

We are building:

> **A system where invalid evaluation artifacts cannot exist.**

---

# 🧠 EXECUTION MODEL

All work follows this rule:

> **Prove the prerequisite before installing the next layer**

---

# 🔴 EXECUTION BLOCK (ACTIVE)

## STEP 0 — Establish Persistence Boundary (CRITICAL)

Goal:
Create the only door where evaluation results can be persisted.

### 0a — Define boundary
- Create:
  `persistEvaluationResultV2()`
- No logic yet

### 0b — Route all paths
All of the following must:
- route through the function OR
- be removed/quarantined

Paths:
- `processor.ts`
- `store.finalizer.ts`
- `phase2.ts`
- `claimJob.ts`
- `writeArtifact.ts`

### 0c — Enforce via CI
- Repo-wide guard:
  - No writes to `evaluation_artifacts` outside boundary
  - No `status = complete` outside boundary

### Success condition:

```text
grep shows exactly ONE persistence path
```

### Gating rule:

Step 1 and all later steps are blocked until Step 0c is green.

## STEP 1 — Install Enforcement Kernel

Only AFTER Step 0c is complete.

Inside `persistEvaluationResultV2()`:

- `validateEvaluationArtifact()`
- `evaluateQualityGate()`
- `deriveConfidence()`

Rule:
- `FAIL` → no persistence
- `PASS` → atomic write

## STEP 2 — Guard Invariants

Add tests:

- invalid artifact → no DB row
- invalid artifact → no `status = complete`
- no completed job has failed gate

## STEP 3 — Golden Proof (Initial)

Add:

- 1 valid case
- 1 invalid case

Goal:

- prove fail-closed behavior

## STEP 4 — Secondary work (blocked until trust layer lands)

Blocked until the persistence boundary and enforcement kernel are real:

- Liveness & latency
- Observability dashboards
- UX improvements
- Prompt tuning
- Calibration expansion
- Recommendation semantics improvements

---

## 📊 CERTIFICATION DEFINITION

System is CERTIFIED only when:

- U1 ENFORCED
- U2 ENFORCED
- U3 ENFORCED
- Invalid escape rate = 0 on golden set

---

## 🧭 ROADMAP vs WORKBOOK (SOURCE SPLIT)

- `ROADMAP.md` = contract (stable, external, what must be true)
- Workbook/Ledger artifacts = state (live, internal, what is currently true)

If they diverge, treat `ROADMAP.md` as contract authority and reconcile workbook state to match.

---

## 🧱 SYSTEM BUILD ROADMAP (SECONDARY)

These remain important, but are blocked until the trust layer is enforced.

### Liveness & Latency
- worker kickoff improvements
- sub-3-minute E2E execution

### Observability
- per-stage timing
- structured logs
- metrics dashboard

### UX
- job progress UI
- evaluation visibility
- governance transparency

### Prompt & Quality
- calibration
- convergence testing
- recommendation semantics

---

## 🚫 WHAT IS NOT ALLOWED

- No “COMPLETE” without enforcement
- No new persistence paths
- No feature work before enforcement boundary
- No “temporary bypass” flags
- No “deprecated but callable” code paths

---

## 🧠 DEVELOPMENT RULES

- One boundary
- No bypass
- Fail closed
- Prove before proceed
- Enforce before claiming progress

---

## 🔑 FINAL PRINCIPLE

We are not building features.

We are building a system that cannot lie.
