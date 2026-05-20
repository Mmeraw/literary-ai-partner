# DREAM Governed Ledger Specs

This directory breaks the DREAM v2 governed-ledger contract into compact, independently citeable markdown specs.

The governing parent spec remains:

```text
docs/governance/DREAM_OUTPUT_LONG_FORM_SPEC.md
```

These files do not create new public lifecycle statuses, new scoring criteria, or new Pass 3b top-level JSON keys. They define the required editorial completeness obligations that must be folded into the existing DREAM long-form report shape.

## Required ledgers

| Ledger | Purpose | Primary folded report surfaces |
|---|---|---|
| [Character Coverage & Arc Ledger](./CHARACTER_COVERAGE_ARC_LEDGER.md) | Proves protagonists, co-protagonists, major companions, arcs, and ending obligations were accounted for. | `structural_stack`, `layer_analyses`, `criterion_analyses`, `reader_experience`, `acceptance_checks` |
| [Relationship Spine Ledger](./RELATIONSHIP_SPINE_LEDGER.md) | Proves the report detected load-bearing dyads, bridges, trust shifts, and power transfers. | `structural_stack`, `cross_layer_integration`, `reader_experience`, `acceptance_checks` |
| [Symbol-to-Character Payoff Ledger](./SYMBOL_TO_CHARACTER_PAYOFF_LEDGER.md) | Proves symbolic objects/images/names are traced through lifecycle and payoff. | `symbolic_audit`, `cross_layer_integration`, `reader_experience`, `acceptance_checks` |
| [Sensory / Emotional Register Ledger](./SENSORY_EMOTIONAL_REGISTER_LEDGER.md) | Proves the report accounts for sound, touch, sight, smell, and taste as emotional or power systems. | `cross_layer_integration`, `symbolic_audit`, `reader_experience`, `criterion_analyses` |
| [Manuscript Integrity Confidence Table](./MANUSCRIPT_INTEGRITY_CONFIDENCE_TABLE.md) | Separates confirmed defects from artifacts, intentional motifs, anchor/TOC issues, and verification needs. | `manuscript_integrity_issues`, `releasability`, `acceptance_checks` |
| [Evidence Distribution / Confidence Gate](./EVIDENCE_DISTRIBUTION_CONFIDENCE_GATE.md) | Prevents opening-chapter dominance and false high-confidence claims. | `criterion_analyses`, `executive_verdict`, `acceptance_checks`, `calibration_notes` |

## Implementation rule

DREAM is a completeness contract, not a section explosion.

A DREAM report must prove what it detected, what it protected, what it traced, and what would count as a miss — while preserving bounded runtime and the existing report schema.
