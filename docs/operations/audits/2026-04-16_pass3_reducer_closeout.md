# Audit Note — #136 Reducer Arc and Repo Hygiene Closeout

**Date:** 2026-04-16  
**Repository:** `Mmeraw/literary-ai-partner`  
**Scope:** Issue #136, PR #138, PR #141, branch cleanup sweep  
**Status:** ✅ Closed and validated

---

## Confirmed

### PR #138 — Pass 3 reducer architecture landed

- **State:** Merged
- **Merge commit:** `9c62200b6ffabc7fc56a5f78043846dac46ffc67`
- **What landed:**
  - Comparison packet path for Pass 3 synthesis input
  - Reducer-first narrowing (no raw Pass1/Pass2 payload reinjection)
  - Coverage-disclosure wiring restored
  - Regression tests and guardrails for reducer behavior

### PR #141 — state machine hardening landed

- **State:** Merged
- **What landed:**
  - `assertValidTransition` enforcement in memory store update paths

### Pass 3 token cap default update landed

- **Commit:** `2e3cf4b`
- **Change:** default `EVAL_PASS3_MAX_TOKENS` raised from `3500` to `5000`
- **Reason:** empirical o3 reasoning headroom requirement even with reduced visible output

---

## Measured outcome (post-merge validation)

Validation set: `Set A`, model `o3`, manuscript `ch11c`, final stable run set at `EVAL_PASS3_MAX_TOKENS=5000` (`r4–r6`).

| Metric | Pre-merge median | Post-merge median | Delta |
|---|---:|---:|---:|
| Pass 3 prompt tokens | ~7,300 | 1,872 | ~-74% |
| Pass 3 completion tokens | ~4,900–6,400 | 2,052 | ~-58% to -68% |
| Pass 3 runtime | ~82.1s | ~2.9s* | ~-96% |
| Total runtime | ~117.3s | 57.0s | ~-51% |
| Quality-gate success rate | 3/3 | 3/3 | held |

\*Pass 3 median is derived from run telemetry split and should be treated as estimated in this note.

Interpretation:

- Pass 3 prompt mass collapsed as intended.
- Pass 3 is no longer the dominant latency source.
- End-to-end runtime dropped materially while quality-gate success held.

---

## Closed as superseded / redundant

### PR #139 — closed (superseded)

- **State:** Closed, not merged
- **Reason:** monotonic `phase_2` route behavior already represented on `main` via later commits (`65993b1`, `ccad6b1`); branch required heavy conflict reconciliation with no net value.

### PR #140 — closed (redundant)

- **State:** Closed, not merged
- **Reason:** `checkDestructionGuards` alias already present on `main`.

---

## Repository hygiene outcome

### Remote branches after cleanup

- `main`
- `feat/repo-rebuild`
- `normalization/reconciliation-v1`

### Pull requests

- Open PR count: `0`

---

## Local state notes

- Working tree is clean.
- Validation/manuscript artifacts were intentionally parked in stash:
  - `stash@{0}: post-merge-hygiene-park-setA-and-manuscripts`
- Additional historical stash remains available:
  - `stash@{1}: post-PR138-local-artifacts-park`

Open local decision points (non-architectural):

1. Whether to promote stashed post-merge evidence folders to committed evidence.
2. Whether restored manuscript inputs should be canonical tracked inputs or remain transient run assets.
3. Whether to keep or retire `.worktrees/prc` (`feat/pr-c-lease-timeout-hardening`) if inactive.

---

## Conclusion

The #136 arc is operationally complete:

- Reducer architecture is merged and validated.
- o3 failure mode caused by undersized Pass 3 cap is resolved at 5000.
- Runtime performance improvement is material and repeatable in the validated run set.
- GitHub repository state is coherent and clean.

Remaining work is administrative/local housekeeping, not architecture rescue.
