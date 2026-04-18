## Objective

Implement the first narrow U2 propagation-integrity slice:

**unresolved Pass 1 incompleteness must affect final confidence instead of being silently ignored.**

U1 and U1.1 established deterministic confidence derivation and artifact wiring. This issue begins U2 by ensuring upstream weakness propagates into downstream confidence.

## Problem

The system can detect incompleteness upstream, but confidence derivation does not yet fully express that unresolved signal.

That creates a silent integrity gap:
- weakness is observed
- canonical output is still produced
- final confidence may not acknowledge unresolved incompleteness

## Scope

This issue implements exactly **one** new propagation rule.

### Included

- extend the confidence inputs with:
  - `pass1IncompleteCount: number`
- wire a real Pass 1 incompleteness signal from existing pass/finalizer data
- add one derivation rule for unresolved incompleteness:
  - `pass1_incompleteness_unresolved`
- bump the derivation version because confidence semantics change
- add focused tests for zero, below-threshold, at-threshold, and resolved cases

### Not included

- Pass 2 divergence propagation
- broader Pass 3 propagation work
- contradiction detection
- UI changes
- DB schema changes
- release-gate changes

## Correctness rule

For this issue, “incomplete” means:

> unresolved incompleteness after downstream convergence/resolution,
> not raw Pass 1 findings.

If a weakness was detected in Pass 1 but resolved later, it must not penalize confidence here.

## Acceptance criteria

- confidence inputs include `pass1IncompleteCount`
- confidence derivation can express `pass1_incompleteness_unresolved`
- derivation version is bumped from `u1.v1`
- existing U1 regression tests remain green
- targeted U2.1 tests pass

## Pre-flight scope evidence

Mandatory grep confirmed the existing signal family before implementation:

- `lib/evaluation/pipeline/runPipeline.ts` emits `INCOMPLETE_CRITERIA_WARNING`
- `lib/evaluation/pipeline/runPipeline.ts` threads those warnings into governance warnings
- Pass prompts are already vocabulary-locked around `WEAK` signal strength
- `qualityGate.ts` distinguishes weak signal from truly applicable/scorable states

This issue maps that existing incompleteness surface into confidence derivation. It does not invent a new upstream concept.
