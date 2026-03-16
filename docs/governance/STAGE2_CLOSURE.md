# Stage 2 Closure — Diagnostic Findings Layer

**Status:** CLOSED  
**Date:** 2026-03-16  
**Acceptance:** 15 / 15 checks passing  
**PRs:** #32 (runtime logic), #33 (tooling stability)  

---

## Problem

Stage 2 introduced the diagnostic findings layer — the pipeline that evaluates a manuscript, generates actionable findings, synthesizes revision proposals, and applies them as anchored edits.

The initial implementation had several reliability gaps:

1. **Non-deterministic proposal readiness** — synthesis could silently fail, producing zero proposals with no signal to the caller.
2. **Race conditions** — findings could exist before synthesis completed, causing downstream steps to operate on incomplete data.
3. **Missing telemetry** — no lifecycle signals to trace a revision session from start to finish.
4. **Duplicate proposals** — re-runs could produce duplicate `(location_ref, rule)` pairs.
5. **Source mutability risk** — source text could be modified after anchoring, invalidating applied edits.

## Fix Architecture

### Engine Recovery Path
Added recovery logic so the engine retries synthesis when it detects zero proposals after an otherwise successful findings run.

### Smoke Readiness Polling
Smoke tests now poll for `proposal_ready_actionable_findings` with retry, replacing brittle single-check assertions.

### Duplicate Guard
A `(location_ref, rule)` uniqueness constraint prevents duplicate proposals on re-synthesis.

### Source Immutability Enforcement
Source text is confirmed immutable post-anchoring via `SOURCE_IMMUTABLE_CONFIRMED` telemetry signal.

## Telemetry Signals

The revision engine now emits the following lifecycle signals:

| Signal | Meaning |
|--------|--------|
| `PROPOSAL_SYNTHESIS_STARTED` | Synthesis invoked |
| `PROPOSAL_SYNTHESIS_COMPLETED` | Synthesis finished (success or zero results) |
| `PROPOSAL_GENERATED` | Individual proposal row created |
| `PROPOSAL_ANCHOR_CREATED` | Anchor mapped to source location |
| `APPLY_ANCHORED_SUCCESS` | Anchored edit applied to session |
| `REVISION_SESSION_FINALIZED` | Session marked complete |
| `SOURCE_IMMUTABLE_CONFIRMED` | Source text unchanged after anchoring |

## Acceptance Run (15/15)

All 15 smoke checks pass deterministically:

- Session creation
- Findings generation
- Actionable findings count
- Proposal-ready actionable findings count
- Proposal synthesis lifecycle
- Proposal row creation
- Anchor creation
- Anchored apply
- Session finalization
- Source immutability
- Duplicate guard
- Telemetry completeness
- Recovery from zero-proposal state
- Retry convergence
- End-to-end determinism

## Commits

| Commit | Scope |
|--------|-------|
| PR #33 (c9618f6) | tsconfig excludes + .vscode/settings for Codespaces stability |
| PR #32 (squash) | Deterministic proposal readiness + synthesis telemetry + duplicate guard |

## Next: Stage 3

Proposal readiness should be promoted from inferred behavior to a persisted state machine on `revision_sessions`. See Stage 3 planning docs.
