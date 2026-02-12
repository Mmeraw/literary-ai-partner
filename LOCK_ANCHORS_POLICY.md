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

## 4. Enforcement

- **Code review rule**: changes to CI/Documentation Lock commit IDs in any phase doc should be rejected unless we are explicitly declaring a new phase.

- **Assistant/tooling rule**: assistants must not "update anchors" for an already locked phase; they may only:
  - Read and restate existing anchors.
  - Add new explanatory text that does not alter anchors.

---

## Example: Phase 2E

- **CI Lock:** `811fe59` (refactor CI workflow, gate passes)
- **Documentation Lock:** `e7812b6` (clarify dual commits, validate both tables)
- **Subsequent commits:** 20567a9, 761bdd9, 7197a92, 4b7ac07 (documentation clarifications)

The two anchors (`811fe59`, `e7812b6`) never change. Future edits to Phase 2E docs are maintenance only.
