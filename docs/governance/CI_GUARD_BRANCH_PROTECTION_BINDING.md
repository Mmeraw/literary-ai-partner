# CI Guard Branch Protection Binding

**Status**: PENDING ADMIN ACTION
**Visibility**: [PROTECTED]
**Repository**: Mmeraw/literary-ai-partner
**Branch**: main
**Required check target**: `CI Guard/ci-guard (pull_request)`
**Source PR**: #423
**Created**: 2026-05-10

## Purpose

Record the required branch-protection binding that turns the CI Guard from an available workflow into merge-time authority.

## Required Admin Action

In GitHub repository settings:

Settings → Branches → main branch protection → Required status checks

Add:

`CI Guard/ci-guard (pull_request)`

## Verification

After binding, verify that `CI Guard/ci-guard (pull_request)` appears as a required check for `main`.

## Governance Meaning

Until this check is required by branch protection, the guard exists but is not mechanically authoritative.

Once required, CI Guard becomes merge-time boundary enforcement for protected/public separation.

## Drift Condition

If the configured required-check name diverges from the value recorded in this file, the repository is considered out of governance alignment until reconciled.

Reconciliation requires either:
- updating this file via governance PR to match the new platform state with documented rationale, or
- restoring the platform state to match the value recorded here.

Drift is itself a governance event and must be addressed before any further enforcement-lane work proceeds.

## Status Log

- 2026-05-10: CI Guard implemented in #423.
- 2026-05-10: Exact required check name confirmed as `CI Guard/ci-guard (pull_request)`.
- 2026-05-10: Admin binding pending.

## Refs

Refs #416, #417, #418, #419, #420, #421, #422, #423
