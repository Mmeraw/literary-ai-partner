# RevisionGrade Evaluation Output Mode Contract

**Status:** Canonical documentation contract  
**Owner:** Mmeraw  
**Scope:** Short-form, long-form, and long-form multi-layer evaluation outputs  
**Runtime impact:** Documentation only. This contract does not change scoring, pipeline execution, provider calls, WAVE governance, database schema, or Revise behavior.

---

## Purpose

RevisionGrade supports three evaluation-output modes. They share the same editorial standard, but they must not promise the same depth of analysis.

The modes are:

1. `short_form_evaluation`
2. `long_form_evaluation`
3. `long_form_multi_layer_evaluation`

This contract prevents public copy, benchmark files, corpus artifacts, generated reports, and templates from implying that all submissions receive the same analysis depth.

---

## Universal boundaries

All evaluation modes must preserve these boundaries:

- Evaluation diagnoses the manuscript. Revise applies or manages repairs later.
- Top Recommendations are summary-level and must not be verbatim copies of criterion opportunities.
- Criterion opportunities use the six-part diagnostic contract when there is a meaningful opportunity: Evidence, Symptom, Cause, Fix direction, Reader effect, and Mistake-proofing.
- Eval output does not include A/B/C rewrite proposals. A/B/C belongs in Revise Queue.
- Eval output does not expose the full Revise Queue inventory.
- Author-facing reports must not expose engine/provider/prompt/version/internal governance telemetry unless the author has explicitly granted support access under the support-access model.
- Protected WAVE/governance internals must not appear in public report copy.

---

## Mode 1 — Short-form evaluation

**Canonical label:** `short_form_evaluation`  
**Typical threshold:** submissions under 25,000 words  
**Route:** `SHORT_FORM`

Short-form evaluation uses the 13 story criteria only. It may diagnose craft, scene, voice, pacing, theme, closure, and market-readiness issues in the submitted excerpt or short work, but it must not imply full-manuscript continuity proof.

### Required output surfaces

- Manuscript / submission metadata.
- Executive summary.
- Overall score and verdict.
- The 13 story criteria.
- Criterion rationales.
- Top Recommendations as summary-level guidance.
- Up to the top three criterion opportunities per criterion when warranted.
- Download/print versions that show all surfaced criterion opportunities and diagnostic details.

### Explicit non-promises

Short-form evaluation must not promise:

- Golden Spine analysis.
- DREAM governed ledgers.
- long-form continuity proof.
- full-manuscript promise tracking.
- WAVE-level manuscript architecture coverage.
- full Story Ledger extraction.

Short-form may identify a local continuity, promise, or closure concern, but it must frame that concern as local to the submitted text unless additional manuscript evidence was supplied.

---

## Mode 2 — Long-form evaluation

**Canonical label:** `long_form_evaluation`  
**Typical threshold:** 25,000+ words  
**Route:** `LONG_FORM`  
**Output mode:** `standard_long_form`

Long-form evaluation applies manuscript-scale analysis to a substantial or complete manuscript without requiring separate layer architecture rendering.

### Required output surfaces

- Manuscript metadata including word count, route, and output mode.
- Executive verdict.
- Overall score or readiness score.
- Full 13-criteria score grid.
- Criterion rationales.
- Top Recommendations as paraphrased executive summaries.
- Up to the top three criterion opportunities per criterion when warranted.
- Evidence-backed diagnosis across the manuscript.
- Plain-editorial long-form continuity findings.
- Promise / payoff / closure tracking where material.
- Character, relationship, symbol, and evidence coverage where material.
- Revision priority order in plain editorial language.
- Download/print versions that show all surfaced criterion opportunities and diagnostic details.

### WAVE boundary

Long-form evaluation may be WAVE-informed, but author-facing copy must describe findings in plain editorial language. WAVE must not be represented as a revision process or as manuscript-change application.

---

## Mode 3 — Long-form multi-layer evaluation

**Canonical label:** `long_form_multi_layer_evaluation`  
**Typical threshold:** 25,000+ words plus multi-layer/multi-voice complexity  
**Route:** `LONG_FORM`  
**Output mode:** `multi_layer_long_form`

Long-form multi-layer evaluation is the deepest evaluation mode. It is used when a manuscript contains multiple timelines, voice lanes, symbolic systems, doctrine/canon layers, identity systems, research-heavy ambiguity, structural paratext, or other architecture that would be flattened by a standard long-form report.

### Existing DREAM authority

RevisionGrade already has DREAM long-form specifications and governed-ledger templates. This contract does not replace them. It names the product-facing mode and clarifies that DREAM/governed-ledger material belongs specifically to long-form multi-layer evaluation unless a standard long-form manuscript materially requires a compact version of a ledger.

Existing DREAM templates/specs remain authoritative for:

- governed ledger requirements;
- layer-aware long-form completeness;
- Story Ledger / Review Gate behavior where applicable;
- protected WAVE/governance boundaries;
- DREAM benchmark addenda.

### Required output surfaces

- All standard long-form surfaces.
- Story Ledger / layer-aware architecture map where applicable.
- Review Gate readiness surfaces where applicable.
- Governed ledgers proving character, relationship, symbol, sensory/emotional, integrity, and evidence-distribution coverage where applicable.
- Cross-layer synthesis.
- Layer-aware revision sequencing.
- Golden Spine / WAVE-informed readiness findings where appropriate, rendered in plain editorial language.
- Long-form continuity and coverage proof.
- Download/print versions that show all surfaced criterion opportunities and diagnostic details.

### Explicit boundary

Long-form multi-layer evaluation does not perform revision. It prepares the diagnosis, evidence, ledgers, and prioritized targets that later feed Revise Queue or TrustedPath.

---

## Benchmark and corpus normalization rule

Benchmark and corpus files must identify the evaluation mode they represent.

Native RevisionGrade benchmarks should use one of:

- `short_form_evaluation`
- `long_form_evaluation`
- `long_form_multi_layer_evaluation`

Public-domain calibration artifacts remain `runtime-authority: false` unless explicitly promoted through a later governance decision. They may teach calibration behavior, but they must not replace RevisionGrade-native gold standards.

Do not rewrite preserved manual benchmark bodies merely to conform to this contract. Use front matter, addenda, template notes, and normalization metadata unless the benchmark itself is intentionally being regenerated.

---

## Template authority

The canonical product-output templates live in:

```text
docs/templates/evaluation/short-form-evaluation-template.md
docs/templates/evaluation/long-form-evaluation-template.md
docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
```

These templates define the expected public/report shape for each mode. Runtime code may render the same information differently, but the information hierarchy and boundaries must not contradict this contract.

Seed-phase alignment must follow:

```text
docs/governance/seed-phase-template-alignment-contract.md
```

Seed scaffolds may align to these modes/templates but may not claim governing authority.
