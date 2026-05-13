# Ancient Bloodlines Benchmark Gate — Gold-Standard GitHub Brief

This benchmark is enforceable today, but the acceptance bar is higher than a green CI run. Ancient Bloodlines should serve as a truth-governance gate for RevisionGrade, not merely a fixture-presence check.

## Core instruction

Treat Ancient Bloodlines as gold-standard only when a passing run guarantees behavioral truth:

- canon continuity is preserved,
- claims are evidence- and coverage-bounded,
- uncertified manuscript-wide scoring fails closed,
- downgrade happens before serialization and before persistence,
- emotional posture remains evidence-honest,
- output remains useful for downstream Revise.

## What is already good

- Benchmark command exists and executes in CI.
- CI gate is wired for pull requests and pushes.
- Benchmark fixtures (model, anchors, canon-presence) are present.
- Release-gate policy is documented.

These are required preconditions, not the final acceptance bar.

## Gold-standard acceptance bar

A passing benchmark must prove all of the following.

### 1) Canon continuity enforcement

Fail if recurring continuity-bearing actors disappear without insufficiency disclosure.

For Ancient Bloodlines, recurring anchors include antagonistic/social-pressure roles, authority roles, herd-structure dynamics, and continuity-bearing relationships.

### 2) Evidence-grounded evaluation behavior

Fail if manuscript-wide closure/readiness/thematic certainty is asserted without sufficient coverage.

Unsupported confidence theater is a regression.

### 3) Coverage and certification invariants

Certification must be computed from coverage and route inputs.

For uncertified LONG_FORM conditions, manuscript-wide `SCORABLE` states must not survive.

### 4) Two-boundary downgrade enforcement

Downgrade behavior must be enforced:

- before public serialization,
- before persistence/finalization.

A compliant UI is insufficient if invalid certainty can still persist internally.

### 5) Criterion-scope governance

Criterion scope must be policy-locked (canonical), not prompt-chosen ad hoc.

### 6) Emotional-governance integrity

Tone and confidence posture must degrade under uncertified coverage.

Local strengths can be retained only when evidence-grounded.

### 7) Evaluate-to-Revise usefulness

Output must remain revision-actionable: evidence anchors, continuity-bearing risks, and ranked revision priorities must survive compression.

### 8) Short-form honesty

Concision is allowed; erasing materially active story architecture is not.

## Required benchmark artifacts

- `testdata/evaluation/ancient-bloodlines.shortform.model.json`
- `testdata/evaluation/ancient-bloodlines.evidence-anchors.json`
- `testdata/evaluation/ancient-bloodlines.canon-presence.json`
- `tests/evaluation/benchmarks/ancient-bloodlines.shortform.spec.ts`
- `tests/evaluation/benchmarks/ancient-bloodlines.fixture.spec.ts`
- `tests/evaluation/benchmarks/ancient-bloodlines.governance.spec.ts`
- CI workflow benchmark step
- release-gate policy documentation

Fixture presence alone is insufficient; each artifact must participate in a behavioral assertion.

## Required test philosophy

Prioritize invariants over snapshots:

1. Canon-presence regression tests
2. Coverage/certification fail-closed tests
3. Serialization/persistence boundary tests
4. Evidence-anchor integrity tests
5. Revision-handoff usefulness tests
6. Snapshot structure tests

If CI is green while the system can still emit polished false certainty, the benchmark is not gold-standard.

## Ancient Bloodlines-specific failure rule

The suite must fail if output looks clean but omits materially active continuity-bearing actors or herd-social forces that are visibly on-page in the evaluated material.

## Release rule

No release is valid unless Ancient Bloodlines is green on main **and** the benchmark enforces truth-governance behavior (not fixture existence).

## Final acceptance sentence

The benchmark is truly complete only when a green run means this:

RevisionGrade cannot pass Ancient Bloodlines while flattening canon continuity, overstating certainty, or emitting evaluation output too lossy to guide Revise on the real manuscript.
