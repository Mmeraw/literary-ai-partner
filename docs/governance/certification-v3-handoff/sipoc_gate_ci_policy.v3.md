# Certification Gate — Proposed CI Policy & Tests (v3, no implementation code)

**Goal:** make `lib/evaluation/fipocRegistry.ts` *authoritative* — activate the governance system that already exists. One narrow **CI-governance** PR; no evaluation-runtime code touched (Pass 1/2/3, chunking, aggregation, persistence, Revise, WAVE, DREAM). Model: **safety cases** — a boundary is trusted only to the level its *evidence* supports; the registry states a claim, the gate verifies the claim never exceeds the evidence. Companion: `certification_debt_register.yml` (21 time-boxed certification debts).

## What changed v2 → v3 (the seven review points)
1. **Status ordering was a false total order** → replaced with an explicit **transition matrix** that **fails closed on any transition not in the allow-list** (Part B0.1). No numeric rank for certification status.
2. **Part D (runtime drift)** → confirmed **deferred** to a follow-on PR.
3. **Evidence obligations now have stable IDs** → `EVIDENCE_REDUCTION` compares **id sets** vs main, never prose (Part B0.3, register `schema_version: 3`).
4. **Truncated contract proofs were a real bug** (my `[:120]` slice, e.g. S07 ended `"…ledger name authority. Every me"`) → **fixed**; register now carries full, untruncated `rule` text. Verified against committed bytes.
5. **Generic runtime proof** → each runtime/contract obligation now requires `harness_invariant_id`, `call_path`, and (for negatives) `negative_cases`; blanket "sipoc:runtime PASS" is gone.
6. **Circular derivation** → the actual boolean predicate for `deriveCertificationStatus` is written out (Part B0.2).
7. **Ambiguous midnight expiry** → replaced `expiry_utc` (inclusive) with `expires_before_utc` (**exclusive**): valid iff `NOW_utc < expires_before_utc`.

---

## Repository findings (grounded)
- **No status authority exists today** (only an unrelated job-lifecycle `statusRank` in `lib/jobs/useJobs.tsx`). This policy must *establish* it — hence Part B0 is the thing to ratify.
- **Status is declared twice** (registry + `docs/SIPOC_EVALUATION_PROCESS.md`) → registry is sole authority; disagreement fails `COMPETING_STATUS_SOURCE`.
- **Evidence is thin** (~1–2 fixtures/stage; several boundaries have none) → obligations are declared and mostly `REQUIRED_TO_RETIRE`, not assumed satisfied.

## The two defects this closes
1. **Structural** — `sipoc-certification.yml` has no `pull_request` trigger ⇒ runs post-merge, can't block a PR.
2. **Semantic** — `analyze-sipoc-results.ts` fails only on seeded-fixture failure; never reads `certificationStatus`/`fitGapStatus`.

---

## Part B0 — the status authority (new: `lib/evaluation/certificationStatusAuthority.ts`)

### B0.1 Certification-status transition **matrix** (not a rank) — *ratify this*
Statuses conflate several axes (maturity, activity, risk, control presence), so they are **not** linearly ordered. The gate governs the transition `main_status → head_status` via an explicit allow-list; **anything not listed fails closed** (`UNDEFINED_OR_REGRESSED_TRANSITION`).

```
ALLOWED_TRANSITIONS (main → head):     # self-transition always allowed for every status
  missing_critical → { emerging, high_risk, partial, active_partial, proven }
  high_risk        → { emerging, partial, active_partial, proven }
  emerging         → { partial, active_partial, proven }
  partial          → { active_partial, proven }
  active_partial   → { proven }
  proven           → { }                # proven may only stay proven
# every pair NOT above (e.g. proven→partial, active_partial→high_risk, emerging→high_risk)
# is DENIED. Default = FAIL. No cell is silently permitted.
```
`→ proven` is additionally gated by B0.2 (evidence), so it can never be reached by editing the field.

### B0.2 `deriveCertificationStatus(evidence)` — the actual predicate — *ratify this*
Evidence per boundary (computed from `evidence_obligations`, all must reference passing fixtures/invariants at PR head):
- `dirtyDeclared` = registry declares ≥1 dirty-data rule (⇒ ≥1 `fail_closed` obligation exists)
- `contractOK` = the `contract_proof` obligation is `SATISFIED` (fixture + `harness_invariant_id` present and passing)
- `fcTotal` / `fcOK` = count of `fail_closed` obligations / how many are `SATISFIED`
- `runtimeOK` = the `runtime_proof` obligation is `SATISFIED`

```
deriveCertificationStatus(e):
  if not e.dirtyDeclared:                              return 'missing_critical'   # failure modes not even enumerated
  if not e.contractOK:                                 return 'high_risk'          # contract itself unproven
  if e.fcOK == 0 and not e.runtimeOK:                  return 'emerging'
  if 0 < e.fcOK < e.fcTotal:                           return 'partial'
  if e.fcOK == e.fcTotal and not e.runtimeOK:          return 'active_partial'
  if e.fcOK == e.fcTotal and e.runtimeOK:              return 'proven'
  return 'high_risk'                                   # fail-closed default
```
Pure; reads fixtures/harness results only; no model calls, no pipeline code.

> **Activation decision — ratify one:** none of the 21 debts have `SATISFIED` evidence yet, so `deriveCertificationStatus` would return `high_risk`/`missing_critical` for most, which would not equal their currently-*authored* `declared_status`.
> - **(A) strict:** seed each debt's `declared_status` from `deriveCertificationStatus` (honest, but most boundaries visibly drop to `high_risk`/`missing_critical` on day one).
> - **(B) pragmatic (recommended):** enforce `STATUS_CLAIM_MISMATCH` **only for claims of `proven`** (you can never claim `proven` without derived evidence); accept below-`proven` authored values as the debt baseline, and let remediation PRs move them upward through the B0.1 matrix as evidence lands.
> I recommend **(B)**: it makes `proven` un-fakeable immediately without a 21-boundary day-one alarm, and the transition matrix still blocks regressions from the authored baseline.

### B0.3 fit-gap axis
`FIT_GAP_ORDER = ok > gap > critical` (a genuine single axis). Any rightward move vs main baseline is `FIT_GAP_REGRESSION` (`ok→gap`, `ok→critical`, `gap→critical`).

---

## Part A — real PR gate
`sipoc-certification.yml`: add `pull_request:` (keep `push`/`dispatch`); run the verdict script; mark **required status check** (Part C). Checkout with `fetch-depth: 0` (or explicit `git fetch origin main`) so baselines read **protected main**, and run against **PR head**.

## Part B — verdict script (new: `scripts/sipoc-certification-gate.ts`)
Pure. Reads registry + `certification_debt_register.yml` (PR head), the same on `origin/main` (baseline), fixture inventory (both refs), and injectable clock `SIPOC_GATE_NOW` (default `Date.now()`). Fails on any:

| code | condition |
|------|-----------|
| `UNCERTIFIED_BOUNDARY_NO_DEBT` | boundary not `proven` and no matching debt |
| `STATUS_CLAIM_MISMATCH` | declared status ≠ `deriveCertificationStatus(evidence)` (scope per activation decision B0.2) |
| `DEBT_EXPIRED` | `NOW_utc ≥ expires_before_utc` (exclusive) |
| `UNDEFINED_OR_REGRESSED_TRANSITION` | `main→head` status transition not in the B0.1 allow-list (fail-closed default) |
| `FIT_GAP_REGRESSION` | fit-gap moved rightward vs main baseline |
| `EVIDENCE_REDUCTION` | a boundary's obligation **id set** (or count of passing fixtures for its stage) is smaller at head than on main |
| `DOWNSTREAM_CONTAMINATION_INCREASE` | a debt boundary's `downstream_consumers_baseline` set grew vs main |
| `DEBT_ORPHAN` | debt `boundary` absent from registry |
| `DEBT_EXTENSION_UNAPPROVED` | vs main: `expires_before_utc` extended, tier weakened, target lowered, or obligation ids removed, without the CODEOWNERS-gated change in this PR |
| `SCOPE_EXPANSION` | evidence obligations narrowed / consumer scope changed so that less is proven than main required |
| `COMPETING_STATUS_SOURCE` | a doc (e.g. `SIPOC_EVALUATION_PROCESS.md`) declares a status disagreeing with the registry |
| `REGISTER_DRIFT` / `REGISTER_NONDETERMINISTIC` | regenerating the register from the registry at PR head diffs the committed file, or regeneration isn't byte-stable across two runs |

## Part C — no silent debt edits + branch protection
- **CODEOWNERS** (`@Mmeraw`): `certification_debt_register.yml`, `sipoc-certification.yml`, `scripts/sipoc-certification-gate.ts`, `certificationStatusAuthority.ts`.
- **Branch protection on `main`:** require the `sipoc-certification` check; require Code-Owner review for those paths; require branch up-to-date before merge (so main-baseline is meaningful); no admin bypass.
- **Solo-owner acknowledgement:** Code-Owner review = **visibility** (no silent/accidental debt edit via an unrelated PR), **not** segregation of duties. The teeth are the machine checks, which no approval can bypass (`DEBT_EXPIRED`, `STATUS_CLAIM_MISMATCH`, `UNDEFINED_OR_REGRESSED_TRANSITION`, …). Add a second owner later for true two-person control.

## Part D — runtime drift detection (DEFERRED, specified)
Follow-on PR: every production deploy runs the SIPOC runtime harness against the deployed build and re-proves each `proven` boundary's obligations; failure alerts / auto-demotes derived status. Out of scope for the gate PR (needs a running deployment); recorded so it isn't lost.

---

## Tests (`tests/sipoc/certification-gate.test.ts`, pure/unit)
1. all-proven + all-evidence → pass.
2. uncertified + no debt → fail `UNCERTIFIED_BOUNDARY_NO_DEBT`.
3. uncertified + valid debt → pass.
4. `expires_before_utc` exclusivity: `NOW = expiry-1s` pass; `NOW = expiry` **fail** `DEBT_EXPIRED`; `NOW = expiry+1s` fail. (asserts the exclusive boundary explicitly)
5. injectable clock via `SIPOC_GATE_NOW`.
6. transition matrix: each allowed edge passes; each denied edge (`proven→partial`, `active_partial→high_risk`, `emerging→high_risk`) fails `UNDEFINED_OR_REGRESSED_TRANSITION`; a made-up/unknown status → fails (fail-closed default).
7. fit-gap: `ok→gap`, `ok→critical`, `gap→critical` fail; `critical→gap` passes.
8. `deriveCertificationStatus` truth table: one case per predicate branch (missing_critical / high_risk / emerging / partial / active_partial / proven).
9. claim ≠ derived → `STATUS_CLAIM_MISMATCH` (in the ratified scope).
10. evidence reduction by **id** (remove an obligation id / delete a passing fixture) vs main → `EVIDENCE_REDUCTION`; reword a `rule` string with the same id → **no** false trigger.
11. downstream consumer added to a debt boundary → `DOWNSTREAM_CONTAMINATION_INCREASE`.
12. new non-proven boundary, no debt → fail (guards "boundary 22").
13. orphan debt → `DEBT_ORPHAN`.
14. expiry extended / tier weakened / obligation id removed vs main w/o CODEOWNERS change → `DEBT_EXTENSION_UNAPPROVED`.
15. doc/registry status disagreement → `COMPETING_STATUS_SOURCE`.
16. register regen ≠ committed → `REGISTER_DRIFT`; regen byte-deterministic across two runs.
17. **golden snapshot:** today's register + today's registry → **pass**; delete any one debt → exactly that boundary fails; add a 22nd non-proven boundary → fail.

## Rollout
1. Land B0 + A + B + C with all 21 debts → gate required; existing debts time-boxed and merge-permitted; boundary #22 blocked day one.
2. Remediate worst-first by tier; each PR retires one debt by supplying its obligations (flip `evidence_state`→`SATISFIED`, fill `harness_invariant_id`/`call_path`/`negative_cases`) so `deriveCertificationStatus` returns `proven` — same PR.
3. Register empties ⇒ every boundary evidence-`proven` ⇒ gate becomes the permanent "boundary #N must be proven" guard; Part D keeps it fresh post-deploy.

## Out of scope
No runtime/pipeline changes. No new framework. Codex = independent post-hoc reviewer confirming scope containment and zero runtime files touched.
