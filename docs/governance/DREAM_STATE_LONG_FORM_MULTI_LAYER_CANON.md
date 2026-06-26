# DREAM State Long-Form Multi-Layer Evaluation Canon

**Status:** Draft governance canon  
**Owner:** Mmeraw  
**Created:** 2026-05-16  
**Rebased:** 2026-05-18  
**Updated:** 2026-06-26  
**Scope:** DREAM long-form multi-layer evaluation documents, benchmark fixtures, and async DREAM worker artifacts.

## Purpose

This canon defines the target shape of DREAM long-form multi-layer evaluation output while preserving the current async DREAM worker architecture.

It applies to:

- manual benchmark fixtures,
- renderer targets for DREAM long-form multi-layer reports,
- async worker artifacts persisted as `longform_document_v1`,
- docs/tests validating benchmark shape and rendering coverage.

It does **not** require synchronous DREAM generation inside `runPipeline()`.

## Runtime Architecture Boundary

DREAM synthesis must remain downstream async-worker-owned unless explicitly redesigned with timeout and reliability proof.

| Concern | Owner |
|---|---|
| Pass 1 / Pass 2 / Pass 3 governed evaluation | main evaluation pipeline |
| DREAM long-form multi-layer document generation | async DREAM worker (`/api/workers/process-dream`) |
| `longform_document_v1` persistence | async DREAM worker / artifact persistence |
| DREAM report rendering | report/evaluate renderers via canonical template + UED |

## Canonical Section and Criteria Discipline

DREAM output must preserve:

- canonical 13 criteria,
- canonical long-form multi-layer template authority,
- score/metadata parity with canonical persisted evaluation artifacts,
- layer-aware rows only when manuscript architecture warrants them.

## Legacy Name Mapping

| Legacy identifier | Canonical successor |
|---|---|
| `DREAM_STATE_LONGFORM_CANON.md` | `DREAM_STATE_LONG_FORM_MULTI_LAYER_CANON.md` |

Legacy naming may remain as a historical alias, but active downstream governance references should use the multi-layer canonical filename.

## Closure Principle

DREAM long-form multi-layer output is a report-quality target and async artifact contract. It translates governed evaluation truth into richer editorial output without destabilizing the main evaluation critical path.
