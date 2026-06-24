# Evaluation Output Mode Contract

**Status:** Canonical governance contract  
**Owner:** Mmeraw  
**Scope:** Evaluation output mode boundaries, public/report shape, and template authority

---

## Purpose

RevisionGrade evaluations must route to the correct public-output mode before report synthesis.

This contract prevents mode drift between:

- short-form evaluations;
- long-form evaluations;
- long-form multi-layer evaluations;
- DREAM long-form synthesis;
- Story Ledger / governed-ledger benchmark artifacts.

The contract also prevents a seed, benchmark, DREAM document, or public-domain calibration file from silently replacing the canonical mode/template authority.

---

## Canonical modes

RevisionGrade uses exactly these evaluation modes:

```text
short_form_evaluation
long_form_evaluation
long_form_multi_layer_evaluation
```

No alternate spellings, aliases, or undocumented mode names should be introduced.

---

## Mode boundaries

### `short_form_evaluation`

Used for submissions below the long-form threshold.

Short-form evaluation focuses on the 13 story criteria only. It must not imply full Golden Spine / WAVE / long-form continuity coverage.

Sparse submissions are valid. RevisionGrade permits submissions at 200 words and up. Sparse evidence should be rendered with caution, limited confidence, N/A where appropriate, or Needs Targeting for unsupported Revise items. Sparse evidence must not by itself fail evaluation or Revise.

### `long_form_evaluation`

Legacy compatibility mode only.

New evaluations must not route to this mode. Historical persisted artifacts may retain this value and are rendered via active multi-layer template authority.

### `long_form_multi_layer_evaluation`

Used when the full multi-layer long-form analysis path is active.

This mode may activate governed Story Ledger, DREAM long-form report synthesis, WAVE-informed diagnosis where applicable, and benchmarked ledger completeness obligations.

---

## Benchmark authority boundaries

RevisionGrade-native benchmark families are allowed to define the quality bar for evaluation output, but they do not replace the runtime mode system.

Native benchmark families include:

```text
docs/benchmarks/froggin-noggin-dream.md
docs/benchmarks/froggin-noggin-dream-v2-governed-ledger-addendum.md
docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md
docs/benchmarks/let-the-river-decide-dream-longform-multilayer-gold-standard.md
```

Public-domain calibration artifacts remain `runtime-authority: false` unless explicitly promoted through a later governance decision. They may teach calibration behavior, but they must not replace RevisionGrade-native gold standards.

Do not rewrite preserved manual benchmark bodies merely to conform to this contract. Use front matter, addenda, template notes, and normalization metadata unless the benchmark itself is intentionally being regenerated.

---

## Template authority

The canonical product-output templates live in:

```text
docs/templates/evaluation/short-form-evaluation-template.md
docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
```

These templates define the expected public/report shape for each mode. Runtime code may render the same information differently, but the information hierarchy and boundaries must not contradict this contract.

Seed-phase alignment must follow:

```text
docs/governance/seed-phase-template-alignment-contract.md
```

Seed scaffolds may align to these modes/templates but may not claim governing authority.
