# RevisionGrade DREAM Output Long-Form Multi-Layer Specification

**Status:** PROPOSED LOCK — DREAM long-form multi-layer completeness contract  
**Owner:** Mmeraw  
**Created:** 2026-05-14  
**Updated:** 2026-06-26  
**Scope:** Canonical long-form multi-layer manuscript evaluations (`long_form_multi_layer_evaluation`) with historical compatibility for legacy standard long-form artifacts  
**Visibility:** [PROTECTED] implementation authority; public report surfaces must expose only plain editorial output

---

## Purpose

This specification defines what a successful RevisionGrade long-form multi-layer evaluation must produce.

It is the canonical successor to the legacy long-form naming surface and aligns with:

- `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md` (product authority)
- `docs/templates/evaluation/evaluation-rendering-contract.md` (renderer authority)
- `docs/governance/DREAM_OUTPUT_SPEC.md` (shared DREAM contract)

DREAM remains a completeness contract (coverage, continuity, ledger integrity, and evidence discipline). It is not a competing template authority and must not recalculate canonical scores.

---

## Canonical Product Boundary

For all new submissions with word count $\ge 25{,}000$:

- canonical evaluation mode: `long_form_multi_layer_evaluation`
- canonical route: `LONG_FORM`
- canonical output-mode family: long-form multi-layer, with adaptive depth where applicable

There is no intermediate new-routing mode between short-form and long-form multi-layer.

Historical `long_form_evaluation` artifacts may remain renderable for compatibility, but must not be used as the route target for new jobs.

---

## Runtime Boundary

DREAM long-form document synthesis remains async-worker-owned and must not be silently reintroduced into the synchronous critical path of `runPipeline()`.

Canonical async artifact contract remains:

- `longform_document_v1` (DREAM synthesis output)
- `final_external_audit_v1` (post-synthesis release audit)

---

## Authority and Inheritance

This specification inherits from, and must not contradict:

- `docs/governance/DREAM_OUTPUT_SPEC.md`
- `docs/canon/registered/volumes/VOLUME-II-STORY-EVALUATION-CRITERIA.md`
- `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md`
- `docs/templates/evaluation/evaluation-rendering-contract.md`

If a conflict appears, resolve by authority order:

1. Product template and rendering contract (author-facing structure)
2. DREAM output governance (completeness + artifact boundaries)
3. Runtime implementation

---

## Legacy Name Mapping

| Legacy identifier | Canonical successor |
|---|---|
| `DREAM_OUTPUT_LONG_FORM_SPEC.md` | `DREAM_OUTPUT_LONG_FORM_MULTI_LAYER_SPEC.md` |
| standard long-form naming in governance prose | long-form multi-layer canonical naming |

The legacy filename may remain as an archival compatibility pointer but must not be treated as active naming authority.

---

## Non-Promises and Safety

This spec does not authorize:

- publication guarantees,
- market-outcome guarantees,
- renderer-side recomputation of scores,
- template-authority override by DREAM synthesis.

---

## Migration Note

Downstream authority registries, SIPOC references, phase-0 warmup manifests, and benchmark reference links should point to this file for active governance naming.
