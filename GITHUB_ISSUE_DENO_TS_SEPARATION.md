# Issue: Separate Deno tests from Node/TypeScript compilation gate

## Problem
`npx tsc --noEmit` currently fails due to Deno-based test files using:
- remote URL imports (e.g., https://deno.land/…)
- global Deno namespace

This prevents repo-wide TypeScript compilation from being used as a single, honest quality gate.

## Current State
- Slice-scoped TS gates work (example: lib/reliability compiles cleanly).
- Repo-wide TS gate fails because Deno tests are included in the TS program.

## Goal
Make it possible to run:
- a Node/TypeScript compilation gate (tsc) for the Node app + libraries
- a Deno test gate (deno test) for Deno-only test files
…without either polluting the other.

## Proposed Approaches
### Option A (Preferred): Dedicated tsconfigs
- Keep `tsconfig.json` for Node/Next/Vite code only.
- Add `tsconfig.node.json` (or similar) excluding Deno tests explicitly.
- Add a `tsconfig.deno.json` only if needed for editor tooling (not for tsc).

### Option B: Move Deno tests under a dedicated directory
- Example: `deno_tests/**`
- Ensure Node tsconfig excludes that directory.

### Option C: Rename Deno test files to make exclusion trivial
- Example suffix: `*.deno.ts`
- Exclude via tsconfig "exclude" patterns.

## Acceptance Criteria
- `npx tsc --noEmit -p <node-tsconfig>` exits 0 in CI.
- `deno test <deno-path>` runs in CI (or local) without Node tooling involvement.
- No Deno remote URL imports are pulled into the Node TypeScript program.
- Docs updated to state the authoritative gates (Node tsc + Jest, plus Deno test where applicable).

## Notes
This is infrastructure/quality-gate plumbing and should remain separate from functional changes (dead-letter logic, job contracts, migrations, etc.).
