# Pipeline Certification v3 — Handoff to Codex (single implementation authority)

**Author:** Devin (investigator / policy designer). **Status:** analysis + ratified policy artifacts only. **No implementation code is included.** Codex owns implementation from here.

## 0. Base / branch facts
- **Repo:** `literary-ai-partner` (origin remote is authoritative).
- **Base commit (branch point):** `e45d5cd03499423ebf3d87c7f47c9b9417a5b6bd` — `fix(phase3): classify recommendation provenance as internal (#1377)` (origin/main @ 2026-07-21).
- **Branch:** `devin/1784704016-sipoc-evidence-harness`.
- **What this branch contains:** ONLY the three files in this handoff folder. Zero production runtime changes, zero schema/harness/registry edits. I stopped before authoring evidence, awaiting a taxonomy decision (see §4).

## 1. Ratified decisions (do not re-litigate)
- **Option A**, not Option B. All **27** boundaries must be **evidence-derived at activation** — including the 6 currently `proven`. No grandfathering.
- **Transition matrix** (ratified): self allowed; only forward trust transitions allowed; regressions denied; unknown/undefined fail closed; `→ proven` requires evidence derivation; `proven` cannot regress via ordinary edit; no numeric/linear status rank. Full 6×6 in `sipoc_gate_ci_policy.v3.md`.
- **Fit-gap** is a separate severity axis (`ok > gap > critical`); all worsening transitions fail. **Do not change `fitGapStatus`.**
- **Scope:** editing `PROCESS_REGISTRY.certificationStatus` in `lib/evaluation/fipocRegistry.ts` is IN scope (governance metadata). Everything else in execution paths is OUT: no model-call, evaluation, chunking, aggregation, persistence, report, WAVE, DREAM, or Revise logic. Do **not** touch `fitGapStatus` or `ARTIFACT_REGISTRY`.
- **Precondition verified:** `certificationStatus` is metadata-only. Readers are `scripts/export-fipoc-registries.ts` (export), `app/api/admin/artifact-health/route.ts` (admin readout), and tests. No execution path branches on it. (`hardStopGovernance.ts:~305` reads a runtime artifact's local `fitGapStatus`, NOT the registry field.)
- **v3 predicate** `deriveCertificationStatus(e)` — must NOT be relaxed, and must NOT read the authored `certificationStatus` field. See policy doc for the exact predicate.
- **Stable obligation IDs** (e.g. `S07_PASS3.contract`, `S07_PASS3.failclosed.03`, `S07_PASS3.runtime`) — evidence identity is by stable ID, not prose. Rewording ≠ evidence removal.
- **Debt register:** exclusive `expires_before_utc` semantics (`NOW_utc < expires_before_utc`). WAVE/DREAM shared expiry `2026-09-30T00:00:00Z`. First expiry `2026-08-05`. Full untruncated contract strings. Count may exceed the historical 21 (21 was a snapshot, not a cap).
- **Scope discipline (per user):** do NOT clean/archive/delete/refactor unrelated material in this PR. If unrelated tech debt is found, log it separately (Issue/TODO), don't fix it here. Keep the PR reviewable.

## 2. Path decision in force
**Path 1: expand the evidence harness FIRST, then activate the gate.** Do not relax the predicate (Path 2 rejected). Do not demote boundaries merely because the current harness cannot represent them (Path 3 rejected). Sequence: expand schema/harness → map complete attributable evidence for all six → rerun strict v3 derivation → only then activate Option A + gate.

## 3. Harness state (verified under repo-pinned Node 24, `npm ci` only)
- Toolchain: `.nvmrc = 24`, workflow `node-version: 24`. Ran `Node v24.18.0` / `npm v11.16.0`. `npm ci` did not modify `package.json`/`package-lock.json`.
- 13 fixtures, all green: validate 13/13, coherence 13/13, runtime 13/13.
- **Schema gap:** `tests/fixtures/sipoc/schema.json` `stage_id` enum is coarse `S01_INTAKE … S11_RENDERER`. It has **no** `S10b_PHASE5_AUTHOR_EXPOSURE_GATE`, `S10c_VIEWMODEL_BOUNDARY_GATE`, `S11a_RENDERER_WEBPAGE`, `S11b_DOWNLOAD_PIPELINE`. The enum + filename-prefix map is **duplicated** in `scripts/validate-sipoc-fixtures.ts` and `scripts/run-sipoc-harness.ts` (StageId union) — all three must be updated together.
- Generated artifacts (`artifacts/sipoc/failure-matrix.json`, `sipoc-results.json`, `sipoc-runtime-results.json`) carry run timestamps; I restored them so they are NOT in this branch. Treat them as generated output.

## 4. THE OPEN BLOCKER — evidence-kind taxonomy (needs user ratification before authoring)
Mechanical finding against production code:
- All **6** `proven` boundaries declare `failureCodes: []` in the registry. `S11a`/`S11b` declare **no `codeSurfaces`**.
- Codes like `PHASE5_RENDER_PARITY_FAIL`, `VIEWMODEL_BOUNDARY_CONTAMINATION`, `PHASE5_SCORE_DRIFT`, `DOWNLOAD_PARITY_FAILED`, `DOWNLOAD_FORMAT_UNSUPPORTED` exist ONLY as declarations in `lib/governance/failureRecoveryPolicy.ts` and contract constants in `lib/evaluation/contracts/evaluationProductContract.ts`. **No live evaluation path emits them.**
- "renderer-local sanitization/score/recommendation/recounting detected" rules are enforced **by construction** (`FORBIDDEN_RENDERER_INPUTS`, `rendererMaySynthesize:false`, `mayCreateNewOpportunities:false`) — a **static architectural invariant**, not a runtime fail-closed code.

The v3 evidence model only has runtime-style kinds. Writing "runtime probes" for these would fabricate predicates that don't exist in production — the decorative certification this effort is trying to kill. **Proposed 3-kind taxonomy (UNRATIFIED):**
- `runtime_fail_closed` — probe drives real production code, asserts the real canonical failure code (e.g. S02 canonical-status/transition; S10b DCIP/final-audit via pure `evaluateAuthorExposureCertification`).
- `static_architecture_invariant` — proven by an import-boundary / forbidden-input contract test (renderer purity, ViewModel contamination). No runtime emitter; guarantee is structural.
- `io_bound_predicate` — real path needs DB/network; proven in-memory by exercising the real exported predicate/constant, explicitly labeled as not proving the I/O itself (existing `probeS03`/`probeS10` precedent).

## 5. Six-boundary evidence inventory & strict v3-derived status
Under strict v3 as currently expressible, NONE of the six derive to `proven`; four are structurally unrepresentable. This reflects a harness/evidence-model gap, NOT demonstrated boundary failure — so no demotion should be committed until the harness can express them.

| Boundary | Dirty rules | Fixtures keyed | Harness | v3-derived | Classification | Missing evidence |
|---|---|---|---|---|---|---|
| S02_QUEUE | 2 (`non-canonical status`, `illegal transition`) | 1 (`s02.queue.canonical-status-only`, inv `QUEUE_CANONICAL_STATUS_ONLY`) | PASS | partial | evidence partial + contract unmapped | fail-closed fixture for `illegal transition`; positive contract proof |
| S03_CLAIM | 3 (`null worker_pulse_at`, `overlapping lease`, `non-production worker id`) | 1 (`s03.claim.atomic-single-claimer` → `CLAIM_CONFLICT` = overlapping lease) | PASS | partial | evidence partial | fail-closed for `null worker_pulse_at` + `non-production worker id`; contract proof |
| S10b_PHASE5_AUTHOR_EXPOSURE_GATE | 14 | 0 (no `S10b` in enum) | n/a | high_risk | unrepresentable by harness | schema stage-id + 14 fail-closed + contract + runtime |
| S10c_VIEWMODEL_BOUNDARY_GATE | 4 | 0 | n/a | high_risk | unrepresentable by harness | schema stage-id + 4 fail-closed + contract + runtime |
| S11a_RENDERER_WEBPAGE | 6 | 0 keyed (only coarse `S11_RENDERER`) | (coarse PASS) | high_risk | unrepresentable by harness | schema stage-id + fixtures keyed to S11a |
| S11b_DOWNLOAD_PIPELINE | 4 | 0 keyed | (coarse PASS) | high_risk | unrepresentable by harness | schema stage-id + fixtures keyed to S11b |

Evidence kinds per boundary (drivable vs static vs io): S02 = 2 runtime / 0 static / 0 io. S03 = 0 / 0 / 3. S10b ≈ 5 runtime / 4 static / 5 io. S10c = 0 / 4 / 0. S11a = 0 / 6 / 0. S11b ≈ 1 runtime / 3 static / 0.

## 6. Recommended implementation sequence for Codex
1. Get the user's ratification of the §4 taxonomy (or an alternate treatment of architectural-invariant rules). Do not author evidence until this is settled.
2. Governance/test-infra PR: extend `schema.json` enum + `evidence_kind` field; update the duplicated stage lists in `scripts/validate-sipoc-fixtures.ts` and `scripts/run-sipoc-harness.ts`; add first-class `S10b/S10c/S11a/S11b`.
3. Author attributable evidence for all six under the correct kind (parameterized fixtures may cover multiple stable obligation IDs; not one file per rule; each obligation must trace to a passing negative case). No production runtime logic changes.
4. Run `sipoc:validate` / `:coherence` / `:runtime` / `:analyze` under Node 24; apply strict v3; report derived status for the six.
5. THEN (separate step, with approval) activate Option A: derive all 27, edit only `PROCESS_REGISTRY.certificationStatus`, regenerate debt register, add authority module + gate + workflow + CODEOWNERS + tests, verify no execution files changed.
6. Keep scope narrow; log unrelated debt separately; stop before opening PR for review.

## 7. Files in this handoff
- `certification_debt_register.v3.yml` — ratified v3 debt register (stable IDs, full contracts, exclusive expiry).
- `sipoc_gate_ci_policy.v3.md` — ratified v3 policy: transition matrix, strict derive predicate, stable obligation IDs, protected-main comparison, deterministic regeneration, exclusive UTC expiry, injectable `SIPOC_GATE_NOW`, debt checks, contamination protection, branch protection/CODEOWNERS guidance, required verdict table + test list.
