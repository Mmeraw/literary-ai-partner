# White Glove Factory — PR & Release Excellence Playbook

**Status:** Active
**Audience:** Maintainers, release captains, CI owners
**Goal:** Produce auditable, low-drama, high-confidence merges with deterministic local and CI behavior.

---

## 1) Definition of "White Glove"

A change is **white glove** only when all conditions are true:

1. **Correctness:** behavior matches canonical contracts and runtime authority.
2. **Auditability:** each change is traceable to a single intent.
3. **Determinism:** default local/Codespace runs are stable without hidden dependencies.
4. **Containment:** blast radius is controlled; unrelated refactors are excluded.
5. **Reversibility:** rollback path is explicit, ordered, and tested.

---

## 2) Canonical Guardrails (Non-Negotiable)

Before editing code, verify and obey:

- `AI_GOVERNANCE.md`
- `docs/JOB_CONTRACT_v1.md`
- `docs/NOMENCLATURE_CANON_v1.md`
- `docs/CANONICAL_RUNTIME_OPERATIONS.md`

### Job status canon
Allowed values only:
- `queued`
- `running`
- `complete`
- `failed`

No aliases, no inferred progress, no silent illegal transitions.

---

## 3) Factory Flow (7 Stations)

### Station A — Scope Lock
- State objective, non-objective, and no-touch lanes.
- Example no-touch: active build-fix lane owned by another agent/person.

### Station B — Contract Scan
- Identify affected contracts/enums/authority docs.
- Fail early on ambiguity.

### Station C — Surgical Implementation
- Prefer small edits with high signal.
- Avoid broad formatting or opportunistic rewrites.

### Station D — Deterministic Validation
Run (or CI equivalent):
- lint
- build
- targeted tests
- docs/runtime guard

### Station E — Environment Hardening
- Ensure required env vars are explicit.
- Default test run should not require external services unless intentionally enabled.

### Station F — Commit Curation
Group by intent, e.g.:
1. CI/docs guardrails
2. runtime/pipeline logic
3. tests/fixtures
4. migration/legacy quarantine

### Station G — Launch Kit
Prepare:
- PR body
- labels
- reviewer matrix
- go/no-go gate list
- rollback map
- release note

---

## 4) Validation Standard

Minimum validation required to mark a change "ready":

- `lint` passes
- `build` passes
- pipeline/doc authority guards pass
- CI-mode tests pass (or documented, intentional skips)

### Determinism policy
DB/network-heavy suites should be explicitly gated by env flags where practical (e.g., `RUN_DB_INTEGRATION_TESTS=1`) so default local runs remain stable.

---

## 5) Commit Hygiene Standard

Each commit should satisfy:

- **Single intent** in message and diff
- **Reviewability** (<~15 files when possible; cohesive scope)
- **No temporary artifacts** (`.tmp*`, ad-hoc logs, local scratch files)
- **No secret material** in tracked files

Recommended message pattern:
- `<scope>: <outcome>`
- Example: `evaluation: enforce consequence contract and fail-closed gate handling`

---

## 6) PR Template (Drop-In)

## Summary
- What changed
- Why now
- Risk level

## Scope
- In scope
- Explicitly out of scope

## Validation
- Lint: pass/fail
- Build: pass/fail
- Tests: pass/fail (+ summary)
- Contract/guard checks: pass/fail

## Rollback
- Ordered commit revert map
- Post-rollback verification checklist

## Operational Notes
- Secrets/env assumptions
- Any temporary flags and removal plan

---

## 7) Go / No-Go Gate

### Go
- Contracts respected
- Validation green
- Working tree clean
- Rollback documented

### No-Go
- Contract ambiguity remains
- New unexplained CI failures
- Hidden env/service dependency introduced
- Commit includes non-functional clutter

---

## 8) Rollback Protocol

1. Revert the most recent high-risk slice first (runtime/migration).
2. Re-run build/lint/tests.
3. Execute one end-to-end smoke path.
4. Confirm canonical status transitions remain intact.

Rollback should be scoped, not panic-wide.

---

## 9) Reviewer Matrix

Assign at minimum:
- Runtime/architecture owner
- Data/DB owner
- QA/test owner
- CI/DevOps owner

Each reviewer signs off only their lane; release captain confirms all lanes green.

---

## 10) Anti-Patterns (Do Not Ship)

- Mixing unrelated fixes in one commit
- Silent fallback that masks systemic failure
- Introducing non-canonical vocabulary or statuses
- Depending on undeclared local-only env state
- Leaving debug files in tracked changes

---

## 11) White Glove Completion Checklist

- [ ] Scope lock captured
- [ ] Contract scan complete
- [ ] Surgical edits applied
- [ ] Validation green
- [ ] Env hardening complete
- [ ] Commits curated by intent
- [ ] PR launch kit prepared
- [ ] Rollback documented

---

## 12) Related References

- `docs/CANONICAL_RUNTIME_OPERATIONS.md`
- `docs/JOB_CONTRACT_v1.md`
- `docs/NOMENCLATURE_CANON_v1.md`
- `GOVERNANCE_AUTHORITY_INDEX.md`
- `docs/QUICK_START.md`
