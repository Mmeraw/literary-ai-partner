# Reliability Hardening — Patch Reply Snippets

Use these one-paragraph replies to keep scope tight when adjudicating the Reliability Hardening implementation PR.

***

## Variant A — Artifacts missing

> Thanks for the work, but Reliability Hardening does not yet meet the architectural bar locked in the governance brief. We need: (1) a deterministic replay harness in `tests/replays/harness.ts`, (2) a versioned manifest schema in `tests/replays/manifest.types.ts`, (3) at least three committed fixture manifests under `tests/fixtures/replays/` reproducing named failure modes, (4) a blocking CI workflow `.github/workflows/replay-harness.yml`, and (5) replay-level telemetry (`replay_harness_run_count`, `pass_count`, `fail_count`). Once those exist with green CI and zero production scope leakage, this PR will be eligible for closure.

***

## Variant B — Production scope leakage detected

> Reliability Hardening must live entirely in `tests/` and `.github/workflows/`. The current diff modifies production paths (prompts/scoring/QG/UI/SIPOC schema/evaluation passes), which violates the locked brief's scope guard. Please remove all production-path changes and keep this PR strictly to test/CI infrastructure. If a runtime change is genuinely required to make replay possible, open a separate governance lock PR for that change and resubmit Reliability Hardening on top of it.

***

## Variant C — Non-determinism detected

> Gate 1 requires deterministic re-execution. The current harness shows variance across re-runs of the same manifest, which means failures cannot be reliably reproduced and regressions cannot be permanently fixed. Please isolate sources of non-determinism (random seeds, timestamps, network calls, model API coupling) and add the determinism assertion test required by Gate 1.

***

## Variant D — PASS response (all proofs present)

> This meets the Reliability Hardening architectural bar. Deterministic replay harness exists at `tests/replays/harness.ts`, manifest schema is versioned at `schema_version: 1`, three fixture manifests reproduce their named failure modes, the blocking CI workflow runs on every PR, replay-level telemetry emits all required fields, no production-path modifications detected, all prior tests continue to pass, and CI/typecheck/Latency PR Enforcement/Governance Enforcement/Kevlar are green. Reliability Hardening is architecturally complete. The replay harness is now the permanent regression-prevention layer for every named failure mode.

***

## Quick usage notes

- **Variant A** when key artifacts are simply absent.
- **Variant B** the moment any production-path modification appears. Non-negotiable.
- **Variant C** when harness exists but cannot prove determinism.
- **Variant D** only when all 7 gates from `RELIABILITY_HARDENING_ADJUDICATION_TEMPLATE.md` pass and CI is green.
