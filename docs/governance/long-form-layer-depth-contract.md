# Long-Form Layer Depth Contract

## Purpose

This contract clarifies how RevisionGrade long-form multi-layer evaluation handles manuscript architecture depth.

It is additive authority for:

- `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md`
- `lib/evaluation/pipeline/prompts/pass3b-longform.ts`
- long-form DREAM benchmark contracts under `docs/benchmarks/`
- benchmark-authority renderer contracts under `tests/benchmark-authority/`

## Canonical minimum: 10 core Story Ledger layers

Every long-form multi-layer evaluation must preserve the minimum canonical Story Ledger foundation when the manuscript provides enough evidence.

The minimum core is ten layers:

1. Narrative Arc
2. Character Arc
3. Theme
4. Symbol
5. Relationship Spine
6. Point of View / Perspective
7. World / Setting System
8. Reader Experience
9. Market / Shelf Positioning
10. Narrator Attribution

The tenth layer, Narrator Attribution, is mandatory because narrator identity, narrator distance, narrator authority, and narrator ambiguity can control how every other layer is interpreted. If the narrator cannot be named, the evaluation must say so directly rather than inventing an identity.

A report may compactly represent these ten layers when evidence is limited, but it must not silently flatten them into fewer conceptual categories when the manuscript requires layer-aware analysis.

## Benchmark specialty expansion: up to 45 layers

Flagship or benchmark-specific manuscripts may require specialty layers beyond the ten-layer core. The maximum supported benchmark specialty depth is forty-five layers.

This does not mean every customer report must print forty-five full prose sections. DREAM is a completeness contract, not a section-explosion requirement.

A compliant report may use:

- a 10-layer core Story Ledger surface;
- a compact specialty-layer coverage ledger;
- cross-layer integration notes;
- governed addenda; and
- acceptance checks that prove the specialty layers were detected.

For benchmark-authority fixtures, required specialty layers must be testable. A benchmark such as `Return to the Source` may require detection of Layers 1-45 while still rendering those layers compactly in the author-facing report.

## Required behavior

The evaluator must:

1. Preserve the 10-layer core minimum when evidence supports it.
2. Include Narrator Attribution as the final core Story Ledger layer.
3. Allow benchmark-specific specialty layers up to Layer 45.
4. Avoid forcing decorative or unsupported layers into simple manuscripts.
5. Avoid capping complex benchmark reports at 5-8 structural layers when the benchmark authority requires deeper coverage.
6. Fold specialty-layer coverage into existing report keys rather than adding new top-level JSON keys unless the schema is explicitly revised.
7. Treat benchmark files as the authority for which specialty layers are mandatory for that manuscript.

## Renderer rule

Renderers must preserve whatever layer coverage the canonical report document supplies. They must not independently add, remove, rename, reorder, summarize, suppress, recalculate, or reinterpret layer coverage.

## Current flagship benchmark precedent

`docs/benchmarks/return-to-the-source-dream-longform-multilayer-gold-standard.md` establishes a 45-layer flagship precedent. Its Layers 1-10 align to the universal core surface, while Layers 11-45 are benchmark-specific specialty architecture for cosmological-origin fiction, species-contact architecture, divine-family governance, Aeon/multiverse design, imperfection, free will, and return-to-origin recursion.
