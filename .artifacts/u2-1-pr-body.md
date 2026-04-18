## Summary

Implements U2.1, the first propagation-integrity rule.

Unresolved incompleteness detected upstream in Pass 1 now affects final confidence instead of being silently ignored.

## Why

U1 established deterministic confidence derivation.
U1.1 wired that derivation into the final artifact.

This PR begins U2 by making confidence reflect a real upstream weakness signal:
**unresolved Pass 1 incompleteness**.

## What changed

- extended the confidence inputs with `pass1IncompleteCount`
- added the confidence reason `pass1_incompleteness_unresolved`
- added a narrow derivation rule for unresolved Pass 1 incompleteness
- bumped `CONFIDENCE_DERIVATION_VERSION` from `u1.v1` to `u2.v1`
- added focused tests for threshold and resolved-case behavior

## Scope control

### Included
- one new confidence input
- one new reason
- one derivation rule
- focused tests

### Not included
- Pass 2 divergence propagation
- broader Pass 3 propagation work
- contradiction detection
- UI changes
- DB schema changes
- release-gate changes

## Correctness boundary

This PR does **not** penalize raw Pass 1 findings.

It only penalizes **unresolved** incompleteness that remains after downstream convergence/resolution.

## Pre-flight scope evidence

The mandatory grep was used to lock scope to real existing signals:

- `runPipeline.ts` defines and emits `INCOMPLETE_CRITERIA_WARNING`
- governance warnings already carry these incompleteness signals downstream
- Pass 1 and Pass 2 prompts are locked to the `WEAK` signal vocabulary
- `qualityGate.ts` already treats weak signal as meaningful governed state

This PR only propagates that established signal family into confidence.

## Verification

- [x] focused derivation tests pass
- [x] existing finalizer confidence tests pass
- [x] broader governance and jobs suites pass
- [x] no compile errors in changed files
