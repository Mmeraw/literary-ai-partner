# Seed Phase Template Alignment Contract

**Status:** Canonical documentation contract  
**Owner:** Mmeraw  
**Scope:** Seed-phase alignment to output-mode doctrine and templates  
**Runtime impact:** Documentation only. No routing, scoring, gate, schema, database, or worker behavior changes in this contract slice.

---

## Purpose

The seed phase may reduce cold-start extraction drift, but it must not invent parallel template logic.

This contract binds seed behavior to the existing canonical output-mode system so seed artifacts align to the same mode doctrine used by evaluation.

---

## Canonical mode lock

Seed-phase processing must classify and remain aligned to one of the existing canonical modes:

- `short_form_evaluation`
- `long_form_multi_layer_evaluation`

Seed phase must not introduce alternative mode names or aliases.

---

## Template authority lock

Seed-phase scaffold outputs must align to the canonical template authorities:

- `docs/templates/evaluation/short-form-evaluation-template.md`
- `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md`

Alignment means seed hypotheses and routing hints may reference template sections conceptually, but seed must not claim template completion as verified truth.

---

## Governance boundaries

- Seed is scaffold-only and non-governing.
- Seed may shape downstream work but may not authorize downstream truth.
- `accepted_story_ledger_v1` remains the only governing story-understanding authority for Phase 2.
- Seed phase must not bypass Review Gate or Approval Normalizer.
- Seed phase must not emit A/B/C revision proposals into evaluation output.

---

## Evidence and handoff posture

Seed artifacts are handoff inputs, not final report authority.

They may be persisted for retrieval by later steps only under scaffold status semantics and must remain subject to downstream evidence confirmation, normalization, integrity gating, and author review.

---

## Acceptance criteria

- docs-only changes;
- no runtime trust-path changes;
- no mode-name drift;
- no template-name drift;
- no authority leakage from seed to Phase 2 governance.
