# U1.1 Confidence Wiring Plan

Status: Proposed
Date: 2026-04-17
Scope: Planning artifact only. No runtime behavior changes are defined by this document.

## Why this exists

`lib/governance/confidenceDerivation.ts` is now on `main` as the pure U1 confidence derivation layer. It introduces categorical confidence states:

- `high`
- `medium`
- `low`
- `withheld`

That layer is intentionally separate from older numeric confidence surfaces that still exist across the evaluation, reporting, A6, and jobs codepaths. U1.1 defines how those worlds coexist during transition without silently changing semantics.

## Current state on main

### New categorical confidence authority

- `lib/governance/confidenceDerivation.ts`
  - Pure derivation contract
  - Inputs are structured trust/governance/evidence signals
  - Output is categorical confidence plus explicit reasons

### Existing numeric confidence surfaces still in use

- `lib/evaluation/pipeline/runPipeline.ts`
  - `synthesisToEvaluationResult()` sets `governance.confidence` as a numeric `0..1`
  - `synthesisToEvaluationResultV2()` also emits numeric `governance.confidence`
- `lib/evaluation/report-types.ts`
  - `Credibility.confidence` is numeric
- `app/evaluate/[jobId]/page.tsx`
  - Renders `artifact.governance.confidence` as a percentage
- `lib/evaluation/a6/confidence.ts`
  - Derives numeric criterion and overall confidence
- `lib/evaluation/a6/types.ts`
  - A6 criterion and overall confidence fields are numeric
- `lib/jobs/finalize.ts`
  - Computes `confidence_0_1` by averaging pass artifact confidences
- `lib/evaluation/signal/criterionObservability.ts`
  - Already exposes internal banded confidence (`LOW | MEDIUM | HIGH`) for criterion observability, but this is not yet the U1 categorical contract

### Transition reality

There are therefore three distinct confidence vocabularies on `main`:

1. Numeric confidence (`0..1`) used in reports/artifacts/A6/finalizer
2. Observability bands (`LOW | MEDIUM | HIGH`) used inside criterion normalization
3. U1 categorical confidence (`high | medium | low | withheld`) used for evaluation trust-state derivation

U1.1 must prevent these from being conflated.

## Decision 1: canonical authority

U1 categorical confidence becomes the canonical authority for **evaluation trust state**.

Specifically:

- Canonical qualitative trust state must come from `deriveConfidence()`
- The categorical output answers: "How much trust should downstream readers place in this evaluation result?"
- Numeric confidence does **not** remain canonical for trust-state decisions

Numeric confidence remains valid only as secondary telemetry/credibility metadata until explicitly retired or renamed.

### Consequence

After U1.1 wiring begins, downstream code must treat:

- categorical confidence as the authoritative trust label
- numeric confidence as supporting measurement or legacy presentation metadata

## Decision 2: coexistence rules during transition

During transition, categorical and numeric confidence may coexist, but they must not overwrite or silently reinterpret one another.

### Binding rules

1. Additive migration only
   - U1 fields are added alongside legacy numeric fields first
   - Do not repurpose existing numeric fields to carry categorical meaning

2. No synthetic back-conversion
   - Do not infer categorical confidence from legacy numeric confidence alone
   - Do not compress categorical confidence back into a numeric percentage for persistence

3. Clear semantic separation
   - Numeric confidence continues to mean credibility/coverage/stability-style scoring where it already exists
   - Categorical confidence means governed trust-state derived from failures, evidence sufficiency, governance pass/fail, and output validity/quarantine signals

4. Withheld stays first-class
   - `withheld` must not be collapsed into `low`
   - Any outward API/report surface that adopts U1 must preserve `withheld` as a distinct value

5. Reason visibility is part of the contract
   - When categorical confidence is attached to artifacts, the corresponding `reasons` array should be carried with it
   - UI can summarize reasons later, but persistence should not discard them

### Recommended artifact shape for the first transition step

Additive example inside governance metadata:

- `governance.confidence` → keep existing numeric field unchanged for now
- `governance.confidence_label` → new U1 categorical value
- `governance.confidence_reasons` → new U1 reason list
- `governance.confidence_derivation_version` → required, value `u1.v1` on first write

This avoids breaking current readers while making the new authority explicit.

`confidence_derivation_version` must not be invented by the caller. The caller should pass through the exported source constant from `lib/governance/confidenceDerivation.ts`:

- `CONFIDENCE_DERIVATION_VERSION = "u1.v1"`

### Version-bump policy

Any change to `deriveConfidence()` that could produce a different categorical output or reason set for the same inputs requires a version bump.

Examples that require a bump:

- changing precedence between `withheld`, `low`, and `medium`
- changing the threshold semantics of evidence coverage handling
- changing which inputs emit a given reason

Examples that do not require a bump:

- comments only
- refactors that preserve identical outputs for identical inputs
- test-only additions with no behavioral change

## Decision 3: first attachment point

The first attachment point should be the **evaluation artifact governance block at the synthesis/report boundary**, not the finalizer and not A6.

### Recommended first wiring site

Primary write point:

- `lib/evaluation/pipeline/runPipeline.ts`
  - specifically `synthesisToEvaluationResultV2()`
  - optionally mirror in `synthesisToEvaluationResult()` only if legacy consumers still need parity

Primary first reader:

- `app/evaluate/[jobId]/page.tsx`

### Why this is the right first seam

1. It is already outward-facing
   - report rendering already reads governance metadata from the evaluation artifact

2. It minimizes blast radius
   - no need to change pass artifact generation, finalizer math, or A6 scoring heuristics in the first cut

3. It preserves semantic isolation
   - U1 is a trust-state layer for final evaluation output, not a replacement for every numeric heuristic in the system

4. It allows honest dual-display if desired
   - report surface can show categorical trust state and retain legacy numeric confidence during transition

### Why not finalizer first

`lib/jobs/finalize.ts` currently computes numeric `confidence_0_1` by averaging pass artifact confidences. That is a different semantic contract from U1. Wiring U1 there first would force premature decisions about pass-artifact schemas and canonical summary projections.

### Why not A6 first

A6 is explicitly a credibility layer with existing numeric derivation and artifact language. It should not be the first place where U1 is introduced because that would blur "credibility score" and "evaluation trust state" before the transition vocabulary is locked.

### A6 position under this plan

- Keep A6 numeric confidence unchanged in the first U1.1 step
- Later, if desired, add a separately labeled qualitative trust annotation to A6 outputs
- Do not rename existing A6 numeric confidence to pretend it is U1

## Proposed execution sequence

### Step 1 — Attach U1 to evaluation artifacts

In `synthesisToEvaluationResultV2()`:

- derive categorical confidence from governed signals
- write additive governance fields:
  - confidence label
  - confidence reasons
  - derivation version
- leave existing numeric `governance.confidence` unchanged

### Step 2 — Render U1 on the report page

In `app/evaluate/[jobId]/page.tsx`:

- display the categorical trust label as primary confidence language
- keep numeric percentage, if still shown, clearly labeled as legacy/secondary confidence
- preserve `withheld` distinctly

### Step 3 — Define contract updates

Update the relevant report/artifact types so the new fields are explicit and typed.

Likely touch points:

- `lib/evaluation/report-types.ts`
- artifact-facing report/page types
- any schema docs describing evaluation artifact governance metadata

### Step 4 — Evaluate finalizer alignment separately

Only after artifact/report adoption is stable:

- decide whether finalizer summary projections should expose categorical trust state
- if yes, add new summary fields rather than mutating `confidence_0_1`

### Step 5 — Evaluate A6 alignment separately

Only after report/artifact adoption is stable:

- decide whether A6 should expose:
  - numeric credibility confidence only, or
  - numeric credibility confidence plus separate qualitative trust label

## Explicit non-goals for U1.1

U1.1 should not:

- replace all numeric confidence fields in one sweep
- rewrite A6 confidence semantics
- reinterpret observability `confidence_band` as equivalent to U1
- retrofit U1 into pass artifact confidence fields without a separate schema decision
- modify database job lifecycle or validity semantics

## Compatibility shim retirement path

PR #157 required a temporary compatibility shim in `lib/jobs/jobStore.supabase.ts` because some CI/Supabase-backed environments lagged the `evaluation_jobs.validity_status` migration.

That shim is environment hygiene, not U1 doctrine. It now needs explicit retirement criteria.

### Retirement trigger

Remove the shim once all CI-backed and Supabase-backed runtime environments are confirmed to include `evaluation_jobs.validity_status`.

### Required checks before removal

1. Verify the migration has been applied in all active Supabase environments
2. Verify job-system smoke/invariant flows no longer hit `column evaluation_jobs.validity_status does not exist`
3. Verify `/api/jobs` and admin retry/list flows succeed without legacy select fallback
4. Verify CI jobs that previously failed on schema lag run green without probe fallback

### Code to remove when retirement is authorized

From `lib/jobs/jobStore.supabase.ts`:

- `JOB_SELECT_FIELDS_LEGACY`
- `_supportsValidityStatusColumn`
- `isMissingValidityStatusColumnError()`
- `getJobSelectFields()` probe/fallback logic
- conditional omission of `validity_status` on create for legacy schemas

### Post-removal verification

Run the jobs test cluster plus job-system smoke/invariant CI and confirm all Supabase-backed paths use the canonical select/write shape.

## Recommended next implementation ticket

Title:

`U1.1 — attach categorical confidence to evaluation artifact governance and render it on report surface`

Acceptance outline:

- Additive categorical confidence fields attached to evaluation artifact governance metadata
- Report page renders categorical trust state without breaking existing numeric display
- `withheld` preserved as a distinct outward value
- No change to A6 numeric confidence semantics
- No change to finalizer `confidence_0_1` semantics in the first increment
- Compatibility shim tracked separately for removal after environment convergence

## Bottom line

U1 is now a real foundation on `main`, but the transition problem is architectural, not doctrinal.

The safe path is:

- make U1 categorical confidence the canonical trust-state authority
- keep numeric confidence as legacy/secondary metadata during transition
- attach U1 first at the evaluation artifact/report boundary
- retire the `validity_status` compatibility shim only after environment convergence is verified
