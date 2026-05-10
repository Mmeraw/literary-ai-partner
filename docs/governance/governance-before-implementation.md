# Governance-Before-Implementation Workflow

**Status**: Canonical RevisionGrade engineering pattern (proven 4× as of 2026-05-09).

## What this is

A repeatable two-phase PR workflow that separates **architectural contracts** from **runtime implementation**. The contract lands first, in a governance PR. Implementation lands second, against the locked contract.

This is how RevisionGrade preserves causal attribution: when an improvement (or regression) appears, you can trace it cleanly to the lane that produced it instead of debugging through entangled changes.

## When to use it

Use this pattern for any change that:

- Introduces or modifies a runtime telemetry contract.
- Establishes new acceptance criteria for downstream lanes.
- Creates a measurement instrument other lanes will consume.
- Changes the meaning of an existing field, structure, or guard.
- Sits on the critical path between intake and final evaluation output.

If the change is purely a bugfix or implementation-only refactor that does not alter contracts, a single PR is fine.

## The two phases

### Phase A — Governance lock PR

Output: a markdown brief in repo. No runtime code. No tests of runtime behavior.

The brief defines:

- **Scope (in)**: what this lane will do.
- **Non-goals (out)**: what this lane explicitly will not do.
- **Required telemetry / API contract**: exact field names, types, allowed values.
- **Acceptance gate**: a 4–5 point binary checklist (pass/fail).
- **Required tests**: named tests with assertion descriptions.
- **Strategic position**: why this lane exists now and how downstream lanes consume it.

The governance PR description includes the latency PR enforcement template sections (`## Summary`, `## Scope`, `## Contract Integrity`, `## Behavioral Quality`, `## Latency Evidence`, `## Risks & Anomalies`) with truthful `N/A` where the PR does not affect that dimension.

The governance PR merges first. After merge, the brief is canonical.

### Phase B — Implementation PR

Output: runtime code + tests, scoped tightly to the locked brief.

Constraints:

- The PR description references the merged brief by file name.
- The PR cannot expand scope beyond the locked brief.
- All required tests from the brief must exist and pass.
- All required telemetry/API contract elements from the brief must be live in code.
- Adjudication uses the binary gate from the brief, no partial credit.

If implementation reveals the brief was wrong, **do not silently expand scope**. Stop, open a follow-up governance PR, then resume implementation against the corrected brief.

## Adjudication

Each lane has a paired `PR_<N>_ADJUDICATION_TEMPLATE.md` with a binary pass/fail matrix. When the implementation PR's CI is green, post the adjudication comment with each gate stamped PASS or FAIL.

- All gates PASS + CI green → merge, declare lane architecturally complete, open the next lane.
- Any gate FAIL → request a narrow follow-up patch (no scope expansion). Use `PR_<N>_PATCH_REPLY_SNIPPETS.md` for ready-to-paste reply variants.

## Why this works

1. **Causal attribution is preserved**: when score quality changes, you can identify which lane caused it.
2. **Scope leakage is prevented**: locked briefs make scope expansion visible and reviewable.
3. **Telemetry is never deferred**: contracts force telemetry to ship in the same PR as the runtime change that generates the data.
4. **Reviewers have a fixed instrument**: adjudication templates eliminate ad-hoc judgment.
5. **Future lanes inherit clean foundations**: each merged lane is a stable substrate for the next.

## Proven applications

| Lane | Governance PR | Implementation PR | Outcome |
|---|---|---|---|
| #291 routing/substrate activation | (pre-pattern, original PR) | PR #291 | ✅ Merged |
| #291 canonical-source provenance | (audit-driven follow-up) | PR #404 | ✅ Merged |
| #292 SIPOC instrument | PR #405 (governance) | PR #406 (implementation) | ✅ Merged |
| #293 seed-band governance | PR #407 (governance) | `feat/293-calibrated-divergence-governance` | 🚧 Active |

## Required artifacts per lane

For each major lane, maintain four artifacts in repo root:

1. `PR_<N>_EXECUTION_BRIEF.md` — the locked contract
2. `PR_<N>_ADJUDICATION_TEMPLATE.md` — the binary pass/fail matrix
3. `PR_<N>_PATCH_REPLY_SNIPPETS.md` — ready-to-paste reply variants for incomplete artifacts
4. (Optional) `PR_<N>_NEXT_LANE_DIRECTIVE.md` — public sequencing communication

## Anti-patterns to avoid

- **Folding governance into implementation**: blends architectural truth with runtime details and contaminates causal attribution.
- **"Mostly fixed" merges**: partial credit erodes the binary gate over time.
- **Telemetry as future work**: telemetry deferred is telemetry never built. The contract must require it land in the same PR as the runtime change.
- **Premature hard-fail enforcement**: governance gates without distributional data block legitimate runs. Use observation phases first (see #293 Phase 1).
- **Scope expansion mid-implementation**: open a follow-up governance PR instead.

## Pattern naming convention

- Governance PRs: `governance(#<N>): <verb> <subject>` (e.g., `governance(#292): lock SIPOC coverage metrics`)
- Implementation PRs: `feat(<area>): <verb> <subject>` or `fix(<area>): <verb> <subject>`
- Branch names: `governance/<n>-<short-name>` for governance, `feat/<n>-<short-name>` or `fix/<n>-<short-name>` for implementation.

## Maintainers

When in doubt: add the governance PR. The cost of a 1-file markdown PR is negligible. The cost of a contract drift bug discovered three lanes later is enormous.
