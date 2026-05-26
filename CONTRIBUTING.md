# Contributing to RevisionGrade

---

## 🔴 First Rule

> **If it is not enforced, it is not real.**

All contributions must uphold this.

---

## 🚪 The Persistence Boundary Rule

All evaluation artifacts MUST pass through:

`persistEvaluationResultV2(...)`

You are NOT allowed to:
- Write directly to `evaluation_artifacts`
- Set `evaluation_jobs.status = "complete"` outside the boundary
- Introduce alternate persistence paths

## 🧩 Evaluation Layering Rule

Pass 3 may produce.  
Pass 4 may judge.  
Only the boundary may persist.  
The boundary must validate first.

---

## 🔒 Enforcement-First Development

Before adding any feature:

1. Identify the enforcement boundary
2. Prove it is singular (no bypass paths)
3. Add guard tests
4. Only then extend behavior

---

## 🧪 Required Tests

Every enforcement-related change must include:

### 1. Negative Test

Invalid input MUST:
- not persist
- not mark job complete

### 2. Guard Test

System MUST fail if:
- a new persistence path is introduced
- enforcement is bypassed

---

## 🚫 Forbidden Patterns

Do NOT introduce:

- `skip_gate` flags
- equivalent bypass parameters (renamed forms of `skip_gate`)
- “temporary” bypass logic
- silent fallbacks
- partial persistence (artifact without validation/gate)
- multiple write paths to evaluation artifacts
- “deprecated but callable” persistence paths for V2
- convention-only enforcement (every invariant must be backed by tests and/or CI guard)

---

## 🧠 Persistence Chokepoint Enforcement

A CI guard must enforce that repo-wide search for evaluation artifact writes and V2 completion writes resolves to the single canonical boundary only.

If a new direct persistence path appears outside that boundary, CI must fail.

---

## 🔄 Change Process

For any significant change:

1. Update `ROADMAP.md` if scope or sequence changes
2. Update enforcement logic (if applicable)
3. Add or update tests
4. Verify CI guard passes
5. Verify no bypass exists

---

## 📊 Definition of Done

A task is NOT complete unless:

- enforcement exists
- tests prove enforcement
- no bypass paths exist
- CI guard passes
- PR branch freshness is proven (`Branch-Behind-Base: 0`) and branch is not behind/diverged from base head

---

## 🔄 PR Freshness Contract (Never Behind)

- All PRs must be up-to-date with the latest base branch head at merge time.
- If a PR is `behind` or `diverged`, it must be rebased/reset before merge.
- The PR body must declare:
	- `Branch-Behind-Base: 0`
- This is enforced by CI and required for close/merge readiness.

---

## ⚠️ Common Failure Mode

Adding logic without enforcing the boundary creates:

- false confidence
- silent system failure

Avoid this at all costs.

---

## 🧭 Development Philosophy

We do NOT:

- optimize prematurely
- build UI first
- trust model outputs blindly

We DO:

- enforce invariants
- verify behavior
- block invalid states

---

## 🔑 Final Rule

If a change allows invalid evaluation to exist, it is rejected.
