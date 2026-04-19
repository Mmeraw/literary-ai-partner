# LLR-003 v2 Locked Spec

> This spec supersedes all prior LLR-003 analysis in docs/archive/llr-003-pre-v2/.
> See 00_ARCHIVE_MANIFEST.md for the archive boundary.

## Status
Locked for implementation after Pass 4 cross-check hardening.

## Keep unchanged
- ACTIVE_RULES registry shape
- existing utility helpers except the old LLR-003 trigger path
- LLR-001, LLR-002, LLR-004, and LLR-005
- registry-grounded canonical mapping discipline

## Delete from LLR-003
- bag-of-tokens overlap as the contradiction trigger
- corpus-wide differentiator scanning
- the assumption that shared craft vocabulary implies contradiction
- noisy broad tension markers

## Replace with
1. Pair-local evaluation across each strength/risk pair
2. Canon-derived craft anchors with a minimal synonym layer
3. Bounded matching only
4. Pair-local scope/contrast detection only
5. ERROR only for explicit polarity collision without local scope
6. WARNING only for weaker tension without scope
7. Shared topical overlap alone becomes audit evidence only

## Minimal synonym layer
- voice -> pov, point of view
- narrativeDrive -> momentum, drive, propulsion
- sceneConstruction -> scene, staging
- worldbuilding -> world, setting
- proseControl -> prose, line-level
- narrativeClosure -> closure, ending, resolution

## Required evidence payload
Each evaluated pair should record:
- strength
- risk
- shared_anchor
- matched_polarity if any
- local_differentiator if any
- decision: clean | audit_topical | warning_tension | error_polarity

## Named trap that must ship with this rewrite
Severity handling must fail only on ERROR. Warning-only outcomes must not flip the rule or pipeline into a failed state.

## Out of scope
- embeddings
- fuzzy NL contradiction reasoning
- telemetry dashboard work
- broader heuristic expansion
- changes to non-003 lessons-learned rules
