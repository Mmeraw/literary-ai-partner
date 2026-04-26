# PR #228 — Artifact Gate Enforcement Spec

Status: Draft for review (spec-only branch; no enforcement code changes in this branch)
Depends on: PR #227 (deterministic artifact measurement/logging)

## Objective

Move artifact acceptance authority into the canonical gate chain:

1. `gates.ts` is the canonical judge
2. `qualityGate.ts` consumes gate verdicts and enforces fail-close behavior
3. `runPipeline.ts` propagates governed failure state
4. `processor.ts` orchestrates only and never judges artifact validity

## Non-goals

- No new job statuses (must remain: `queued` | `running` | `complete` | `failed`)
- No processor-side acceptance logic
- No prompt, auth, env, migration, or unrelated infra scope

## Canonical API Contract

### `gates.ts`

Add:

- `evaluateArtifactGate(input): ArtifactGateDecision`

Input (minimum):

- `criteria`: normalized artifact criteria
- `ledger`: score ledger (`rawTotal`, `maxTotal`, `normalized`, `weighting`)
- `excellenceFilter`: excellence verdict + blockers
- `validationResult`: deterministic validator output (`result`, `reasonCodes`, details)

Output:

- `verdict`: `"PASS" | "HOLD" | "FAIL"`
- `reasonCodes`: string[]
- `validatedAt`: ISO timestamp
- `enforcementMode`: `"enforce" | "log"` (for observability only; control flow must still honor canonical rules)

Rules:

- Structural/blocking reason codes => `FAIL`
- Advisory/non-blocking reason codes => `HOLD`
- No codes => `PASS`

## `qualityGate.ts` Integration

`runQualityGateV2(...)` must call `evaluateArtifactGate(...)` and include result in gate telemetry:

- If gate verdict is `FAIL`: return `pass=false`, set deterministic `QG_*` failure code(s), block downstream persistence
- If gate verdict is `HOLD`: return `pass=true` with warnings + reason codes surfaced
- If gate verdict is `PASS`: normal successful flow

## `runPipeline.ts` Behavior

Pipeline must propagate governed failure consistently:

- When `qualityGate.pass=false` due to artifact gate `FAIL`, return pipeline failure (`ok:false`) with governed code and details
- Do not silently downgrade failures to warnings

## `processor.ts` Responsibilities (explicit)

Processor must:

- run pipeline
- respect pipeline result
- persist only when pipeline returns success

Processor must not:

- call artifact validator as acceptance authority
- map reason codes to acceptance outcomes
- bypass gate verdicts

## Telemetry and Artifact Transparency

Persisted transparency fields must include:

- `artifact_validation_result`
- `artifact_reason_codes`
- `artifact_validated_at`
- `score_ledger`
- `excellence_filter`

For denominator policy continuity from Slice 1, keep:

- `governance.transparency.score_denominator_policy`

## Error/Status Contract

- Illegal/failed acceptance must end in `failed` job status (no synthetic status values)
- Suggested error code family: `ARTIFACT_VALIDATION_*` or governed `QG_*` mapping
- DB writes for final success must not occur on `FAIL`

## Test Matrix (required before merge)

1. PASS path
   - artifact gate verdict `PASS`
   - pipeline succeeds
   - persistence occurs

2. HOLD path
   - artifact gate verdict `HOLD`
   - pipeline succeeds
   - persistence occurs
   - reason codes/warnings are present

3. FAIL path
   - artifact gate verdict `FAIL`
   - `runQualityGateV2` returns `pass=false`
   - pipeline returns `ok:false`
   - processor does not persist completion artifact

4. Regression lock: processor non-authority
   - ensure processor does not contain acceptance decision logic

5. E2E lock
   - invalid artifact cannot pass to final persistence

## Migration / Refactor Notes

Expected touch points:

- `lib/evaluation/pipeline/gates.ts`
- `lib/evaluation/pipeline/qualityGate.ts`
- `lib/evaluation/pipeline/runPipeline.ts`
- `lib/evaluation/processor.ts`
- `__tests__/lib/evaluation/processor.canonical-pipeline.test.ts`
- `tests/evaluation/pipeline/pipeline-e2e.test.ts`
- `lib/evaluation/pipeline/__tests__/qualityGateV2.test.ts`

## Implementation Guardrails

- Keep PR #228 focused on acceptance-authority transfer only
- Keep deterministic behavior and explicit reason-code mapping
- Prefer fail-closed over silent acceptance
- No hidden control-flow changes in observability code
