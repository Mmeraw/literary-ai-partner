# GITHUB HANDOFF — REVISIONGRADE MASTER ROADMAP + COPILOT INSTRUCTIONS

## What to send GitHub

Commit these files:
- `docs/REVISIONGRADE_MASTER_ROADMAP.md`
- this instruction file if useful as `docs/GITHUB_HANDOFF_MASTER_ROADMAP.md`

## Recommended PR title

`docs(governance): add canon-bound REVISIONGRADE master roadmap`

## Recommended commit message

`docs(governance): add canon-bound REVISIONGRADE master roadmap`

## PR description to paste

### Summary
Add the authoritative `REVISIONGRADE_MASTER_ROADMAP.md` as a governance/control artifact.

This version is explicitly bound to:
- Canon Doctrine Registry
- Volume II — 13 Story Criteria Canon
- Volume II-A — Operational Schema
- Volume III+ Governance / AI Governance / Execution Architecture

### What this does
- defines the authoritative stage order:
  - Stage 2.5 deterministic anchored apply
  - Stage 3 revision-session state machine
  - telemetry/dashboard
  - trajectory/history
  - signal engine
  - marketplace
- adds canon authority chain near the top
- explicitly binds Stage 2.5 and Stage 3 work to canon
- adds artifact-spine language for later telemetry / trajectory / industry-facing outputs
- states non-negotiable invariants for runtime and doctrine enforcement

### Why
The roadmap should function as a control artifact, not just a planning note.
This PR makes the roadmap subordinate to canon and prevents future implementation drift.

### Non-negotiable constraints
- No runtime doctrine invention
- No new criteria, weights, thresholds, or readiness states outside canon
- No enforcement of any rule lacking an ACTIVE Registry entry
- No contradiction of Volume II-A envelopes, constants, or eligibility rules

### Follow-on work
The next execution artifact should be a Canon Enforcement PR spec covering:
- Registry-backed rule enforcement
- eligibility gate enforcement
- criteria/weights/readiness lock to Volume II-A
- evaluation envelope validation

## Instruction block for GitHub Copilot / GitHub AI

Use this exactly:

You are working in the repo `literary-ai-partner`.

Objective:
Add the file `docs/REVISIONGRADE_MASTER_ROADMAP.md` exactly as provided in this PR and preserve it as a governance/control artifact.

Hard requirements:
1. Do not rewrite the roadmap’s doctrine, ordering, or invariants.
2. Do not introduce new criteria, thresholds, weights, readiness states, or canon language not already present in the file.
3. Preserve markdown formatting, headings, emphasis, and wording.
4. Place the file at:
   - `docs/REVISIONGRADE_MASTER_ROADMAP.md`
5. If a docs index or navigation file exists and normally tracks top-level docs, add a minimal link entry only if consistent with existing repo conventions.
6. Do not refactor unrelated files in this PR.

Acceptance criteria:
- file exists at `docs/REVISIONGRADE_MASTER_ROADMAP.md`
- markdown renders cleanly
- no unrelated repo changes
- PR remains docs-only unless a docs index update is strictly required

## Optional second PR after merge

Recommended next PR title:

`governance: add canon enforcement layer and eligibility gate bindings`

Recommended scope:
- Canon Registry enforcement
- Volume II-A envelope lock
- eligibility gate enforcement before refinement
- registry/criteria/readiness validation helpers
