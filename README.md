# RevisionGrade

## What this repository is optimizing for

RevisionGrade is not currently prioritizing feature velocity.

It is prioritizing **truthful evaluation persistence**.

The governing principle for work in this repository is:

> **If it is not enforced, it is not real.**

That means roadmap claims, completion labels, and UX signals are only meaningful when the runtime prevents invalid states from being persisted.

## Current priority

The active priority is the **Eval 2.0 trust layer**.

The immediate goal is to establish a single persistence boundary for evaluation results and then enforce validation, gating, and confidence derivation at that boundary.

Until that exists, downstream work is secondary.

Read first:

- `ROADMAP.md` — authoritative execution order
- `CONTRIBUTING.md` — contribution rules and forbidden patterns
- `AI_GOVERNANCE.md` — binding AI governance policy
- `docs/JOB_CONTRACT_v1.md` — canonical job status contract

## What must be true before new feature work

Before adding behavior to the evaluation pipeline, the system must prove:

1. There is exactly one persistence boundary for `evaluation_result_v2`
2. Invalid artifacts cannot persist
3. Invalid artifacts cannot mark jobs `complete`
4. CI fails if a bypass path is introduced

If those are not true, the system can still lie, and feature work is premature.

## Canonical persistence direction

All evaluation-result persistence must route through a single named boundary:

`persistEvaluationResultV2(...)`

That boundary is the only place where the system is permitted to:

- validate an evaluation artifact
- apply the quality gate
- derive confidence
- persist the artifact
- mark the job complete

Any alternative write path is a defect.

## What is blocked right now

The following remain intentionally blocked until the trust layer is real:

- liveness and latency improvements
- dashboards and observability polish
- UX progress enhancements
- prompt tuning and calibration expansion
- recommendation semantics improvements

Nice ideas can wait. False confidence cannot.

## Repository rules in one minute

- Do not invent or rename canonical identifiers
- Do not introduce new job statuses
- Do not add bypass flags or silent fallbacks
- Do not write evaluation artifacts outside the canonical boundary
- Do not treat documentation claims as reality unless tests and enforcement prove them

## Development entry points

Use these documents first:

- `ROADMAP.md` — what happens next
- `CONTRIBUTING.md` — how changes are allowed to happen
- `docs/NOMENCLATURE_CANON_v1.md` — canonical identifiers only
- `docs/JOB_CONTRACT_v1.md` — allowed job states only
- `docs/QUICK_START.md` — local setup when you actually need to run the app

## Local setup

When local execution is needed:

1. Install dependencies with `npm install`
2. Configure local environment files as required by the app
3. Run the project checks relevant to your change

If your change affects enforcement or persistence behavior, tests are not optional.

## Definition of done

A change is not done because code exists.

A change is done only when:

- the invariant is enforced
- the tests prove it
- bypass paths do not exist
- CI guards would fail on regression

## Final note

This repository must prefer explicit failure over comforting fiction.

If the system can persist an invalid evaluation, it is not finished.
