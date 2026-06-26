# SIPOC/FIPOC Timing Doctrine

Status: canonical timing doctrine for SIPOC/FIPOC stage budgets  
Scope: Evaluation, Revise, Agent Readiness, Storygate, renderer, and adjacent governance stages

## Binding rule

Each stage shall advance immediately once its acceptance criteria are satisfied. Published maximum durations are safety budgets for processing complexity, infrastructure variability, repository growth, deterministic validation, benchmark digestion, DREAM/governance material digestion, and upstream input assimilation. They are not target runtimes and shall never be interpreted as intentional delays.

## No-rush processing rule

Stage budgets must provide enough headroom for the system to read, reconcile, and digest all required inputs before advancing, including:

- manuscript text and chunk manifests;
- certified upstream artifacts;
- benchmark authorities and gold standards;
- DREAM / Long-Form Multi-Layer governance material;
- calibration baselines;
- story ledgers, evaluation seeds, and revision ledgers;
- deterministic gate diagnostics;
- renderer or ViewModel input contracts.

A stage must not advance merely because a timer is short or because partial data exists. It advances only when its declared acceptance criteria are satisfied.

## Safety-budget interpretation

Published timings are capacity budgets, not sleep timers:

- A stage finishing early must continue immediately if acceptance criteria are complete.
- A stage needing more processing time may use the published maximum to finish required digestion and validation.
- A timeout is a failure-control mechanism, not a pacing mechanism.
- Deterministic gates should remain fast enough to expose regressions, but generous enough to avoid rushing artifact reads, checksum verification, persistence checks, and validation.
- LLM or synthesis stages should receive enough budget to process manuscript scope, benchmark context, DREAM/Long-Form Multi-Layer template obligations, and upstream artifacts without truncation or premature fallback.

## Governance requirement

Every SIPOC/FIPOC timing table should distinguish:

| Field | Meaning |
|---|---|
| Target | Expected normal processing range when inputs are healthy |
| Maximum | Safety budget before timeout/failure handling |
| Acceptance Criteria | The actual condition required to advance |

If target and maximum conflict with acceptance criteria, acceptance criteria govern until the maximum is reached. If the maximum is reached before acceptance criteria are satisfied, the stage must fail closed, degrade with proof, or emit a fit-gap/quality report according to the relevant SIPOC/FIPOC contract.
