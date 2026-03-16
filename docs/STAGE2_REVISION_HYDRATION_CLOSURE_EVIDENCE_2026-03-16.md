# Stage 2 Revision Hydration Closure Evidence (2026-03-16)

Repository: `Mmeraw/literary-ai-partner`  
Branch: `cronauthfix`

## Scope

This packet closes the question: **does finalize-time hydration preserve source immutability while keeping strict apply behavior?**

It also records stale-session smoke-harness behavior and fresh-run outcomes.

## Code-state evidence (live diffs)

### 1) `lib/manuscripts/hydrateVersions.ts`

Verified additions in working tree:

- `hydrateSourceVersionIfMissing(versionId, options)`
- `options.persist?: boolean`
- `persist` default is `true`
- when `persist === false`, function returns normalized text **without** updating `manuscript_versions`
- missing-source detection includes `NULL`, empty string, and whitespace

### 2) `lib/revision/apply.ts`

Verified live behavior:

- imports `hydrateSourceVersionIfMissing`
- for empty source text, calls:

`hydrateSourceVersionIfMissing(sourceVersion.id, { persist: false })`

- fails closed if hydration cannot resolve text
- uses hydrated in-memory `sourceText` for strict apply
- strict apply remains fail-closed (no proposal-skipping behavior)

### 3) `scripts/revision-stage2-smoke.mjs`

Verified live behavior:

- explicit `EVALUATION_RUN_ID` that already has an applied session fails early with actionable message
- auto-discovery searches recent completed runs and selects a run with no existing `revision_sessions` row

## Runtime evidence

## A) Stale-session rejection is explicit

Run with previously applied evaluation:

- `EVALUATION_RUN_ID=25b05913-acc9-4900-b9a1-6e72abbebf48`

Observed behavior:

- script exits early with clear message:
  - already has an applied revision session (`ff4fef9c-3c13-4fe4-b47c-b4e0d4d49ffe`)
  - advises choosing a different run or clearing stale session/proposals

## B) Fresh-run success evidence

Previously captured successful fresh runs:

1. `6e4f7361-04d1-4273-a2d8-f07d28802151`
2. `2d123bfc-8e14-428e-a5df-977f6fe3ed53`

Success profile (both):

- findings generated: `13`
- actionable findings: `13`
- proposals generated: `13`
- accepted proposals: `3`
- `source_unchanged: true`
- `result_text_changed: true`

## C) Empty-source immutability retest (critical)

Selected fresh empty-source candidate:

- `evaluation_run_id`: `c2486925-8085-4a05-87d0-916a7a64ab0f`
- source `raw_len` before run: `0`

Smoke run result:

- finalize failed with strict apply mismatch:
  - `Proposal ... original_text not found in source text`

Post-failure verification query result:

- `source_raw_len`: `0` (unchanged)
- latest `revision_sessions` row status: `open`
- `result_version_id`: `null`
- derived versions count from source: `0`

Interpretation:

- failure is now a strict-anchor/proposal-quality issue
- finalize-time hydration did **not** mutate source version text

## Operational conclusion

Current state is closure-ready for hydration immutability:

- non-mutating finalize hydration is active in live code
- strict apply remains fail-closed
- stale-session ambiguity is handled by explicit smoke-harness checks
- fresh-run end-to-end success has been demonstrated on multiple runs

Remaining open area (separate concern):

- improve proposal anchoring/location-aware apply for cases where strict single-anchor match fails after hydration

## Files referenced

- `lib/manuscripts/hydrateVersions.ts`
- `lib/revision/apply.ts`
- `scripts/revision-stage2-smoke.mjs`
- `scripts/revision-stage2-hydrate.mjs`
- `package.json`
