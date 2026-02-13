# Lock Anchor Policy

This document defines how we record and preserve "lock" events for governance phases (Phase 2E, etc.). The goal is to prevent anchor churn and keep audit trails stable over time.

---

## 1. Concepts

- **Phase**: A scoped governance effort (e.g., "Phase 2E — Canonical user_id RLS migrations").
- **CI Lock Commit**: The first commit where the enforcement gate (CI workflow, migration, or equivalent) is implemented and passes with the intended guarantees.
- **Documentation Lock Commit**: The first commit where documentation fully and correctly describes the locked state for that phase (scope, mechanism, evidence, and how to re‑verify).

These two commits are **historical events**, not pointers. Once chosen, they do not change.

---

## 2. Rules

1. **Exactly one CI Lock per phase**

   - Each phase has at most **one** CI Lock Commit.
   - Example: `811fe59` for Phase 2E.

2. **Exactly one Documentation Lock per phase**

   - Each phase has at most **one** Documentation Lock Commit.
   - Example: `e7812b6` for Phase 2E.

3. **Anchors are immutable**

   - After a CI Lock and Documentation Lock are recorded, **they never change**.
   - Later commits (typos, formatting, clarifications, added examples, README links, etc.) are **maintenance**, not new lock events.

4. **New locks require a new phase**

   - If enforcement is fundamentally changed (new migration, new mechanism, new semantics), that is a **new phase** (e.g., Phase 2F or Phase 3), not a mutation of the previous phase's anchors.

5. **Docs may evolve; anchors do not**

   - Documentation files (`PHASE2E_STATUS.md`, `PHASE2E_CANONICAL_EVIDENCE.md`, etc.) can be edited freely **as long as**:
     - The CI Lock and Documentation Lock commit IDs remain unchanged.
     - Descriptions of those commits remain historically accurate.

---

## 3. How to record anchors in a phase doc

Each phase status doc MUST include a small, stable block like this:

```markdown
**Status:** ✅ LOCKED  
**CI Lock Commit:** `811fe59` — brief description  
**Documentation Lock Commit:** `e7812b6` — brief description
```

Optionally, you may also list other commits with labels (e.g., "documentation initial", "metadata correction", "audit trail doc"), but none of those change which commit is the CI Lock or Documentation Lock.

---

## 4. Canonical Anchors Registry

This is the single source of truth for locked phase anchors. **DO NOT MODIFY** these values unless declaring a new phase.

### Phase 2E — Canonical user_id RLS migrations

- **CI Lock:** `811fe59` (refactor CI workflow with Python script, gate passes)
- **Documentation Lock:** `e7812b6` (declare lock with both tables validated)
- **Status:** ✅ LOCKED (2026-02-12)
- **All subsequent commits** (e.g., 20567a9, 761bdd9, 7197a92, 4b7ac07, adcd073): Phase 2E documentation maintenance only

**Rule:** Any commit after e7812b6 that touches Phase 2E documentation is normal maintenance and MUST NOT change these two anchor values.

### Flow 1 — Upload → Evaluate → View Results

**STATUS: 🧪 PRE-LOCK — Evidence gate scaffolded, first deterministic proof captured**

- **CI Lock Anchor:** TBD (first passing GitHub Actions run for `phase1-evidence.yml`)
- **Documentation Lock Anchor:** TBD (after CI evidence transcript + lock declaration)
- **Current evidence:** Local deterministic pass recorded (HEALTH 200, CREATE 201, OWNER 200, OTHER 404)
- **Next step:** Run `phase1-evidence.yml` in GitHub Actions 3+ consecutive times, then assign anchors

- **Requirements before CI/Docs locks:**
  - ✅ Phase 2E RLS gate verified working (run #21964849414, 2026-02-12T21:25:20Z)
  - ✅ Ownership enforcement + production-path mapping fixed (`3f3d870`, `c1dd02e`)
  - ✅ Flow 1 scaffold implemented (`phase1-evidence.yml`, `scripts/evidence-flow1.sh`)
  - ✅ Local deterministic ownership proof passing (2026-02-13)
  - ⏳ Evidence gate (`phase1-evidence.yml`) passing in GitHub Actions
  - ⏳ Evidence gate passes 3+ consecutive CI runs with same codebase

**Process:** Once smoke tests pass, immediately build phase1-evidence.yml CI automation, run gate 3 times, capture evidence, lock both anchors, promote to push trigger.

---

## 5. Enforcement

### Code Review Rule
Changes to CI/Documentation Lock commit IDs in any phase doc should be rejected unless we are explicitly declaring a new phase.

### Assistant/Tooling Rule
Assistants must not "update anchors" for an already locked phase; they may only:
- Read and restate existing anchors
- Add new explanatory text that does not alter anchors

### CI Enforcement (Recommended)
Add a simple grep check to prevent anchor drift:

```bash
# .github/workflows/phase2e-anchor-guard.yml
name: Phase 2E Anchor Guard

on:
  pull_request:
    paths:
      - 'PHASE2E_STATUS.md'
      - 'PHASE2E_CANONICAL_EVIDENCE.md'

jobs:
  verify-anchors:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Verify CI Lock unchanged
        run: |
          if ! grep -q "CI Lock Commit.*811fe59" PHASE2E_STATUS.md; then
            echo "❌ ERROR: Phase 2E CI Lock anchor changed from 811fe59"
            exit 1
          fi
          
      - name: Verify Documentation Lock unchanged
        run: |
          if ! grep -q "Documentation Lock Commit.*e7812b6" PHASE2E_STATUS.md; then
            echo "❌ ERROR: Phase 2E Documentation Lock anchor changed from e7812b6"
            exit 1
          fi
          
      - name: Verify CANONICAL_EVIDENCE anchors
        run: |
          if ! grep -q "CI Lock Commit.*811fe59" PHASE2E_CANONICAL_EVIDENCE.md; then
            echo "❌ ERROR: Canonical evidence CI anchor changed"
            exit 1
          fi
          if ! grep -q "Documentation Lock Commit.*e7812b6" PHASE2E_CANONICAL_EVIDENCE.md; then
            echo "❌ ERROR: Canonical evidence docs anchor changed"
            exit 1
          fi
```

This turns "policy promise" into "enforcement mechanism."

---

## 6. Example: Phase 2E

- **CI Lock:** `811fe59` (refactor CI workflow, gate passes)
- **Documentation Lock:** `e7812b6` (clarify dual commits, validate both tables)
- **Subsequent commits:** 20567a9, 761bdd9, 7197a92, 4b7ac07, adcd073 (documentation clarifications)

The two anchors (`811fe59`, `e7812b6`) never change. Future edits to Phase 2E docs are maintenance only.
