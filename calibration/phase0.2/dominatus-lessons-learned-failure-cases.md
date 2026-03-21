# DOMINATUS I:4 — Phase 0.2 Lessons-Learned Failure Cases

Purpose: deterministic calibration fixtures for the Lessons Learned Rule Engine (Phase 0.2), derived from existing DOMINATUS baseline vs. gold-standard critiques.

## LLR-001 — Blur, Not Multiplicity

- **Fail trigger**: baseline-style language such as "too many ideas" / "overloaded" with no explicit boundary evidence.
- **DOMINATUS baseline signal**: broad density/overwriting complaint without blur/overlap diagnostics.
- **Expected**: `passed=false`, severity `ERROR`.

## LLR-002 — Authority Transfer Clarity

- **Fail trigger**: POV/authority shift framing without transfer marker or causal justification.
- **DOMINATUS gold-standard signal**: identifies layered authority system and boundary signaling as the real issue.
- **Expected**: `passed=false` when shift is asserted but no marker/justification appears.

## LLR-003 — No Contradictory Diagnostic Framing

- **Fail trigger**: same topical element labeled both strength and weakness without context boundary.
- **DOMINATUS example pattern**: `pacing` praised and condemned simultaneously in high-level bullets.
- **Expected**: `passed=false`, with overlap evidence.

## LLR-004 — Canon-Aware Terminology Discipline

- **Fail trigger A**: non-canonical terms (e.g., "vibes", "just make it cleaner") in formal diagnostics.
- **Fail trigger B**: criterion references that cannot map to active registry canon IDs.
- **Expected**: `passed=false` on either trigger.

## LLR-005 — No Generic Canon-Free Critique

- **Fail trigger**: critique text contains no criteria/wave/structure/canon anchors.
- **DOMINATUS baseline contrast**: general workshop-style readability notes vs. canon-anchored diagnostics.
- **Expected**: `passed=false`, severity `ERROR`.

## Notes

- These are calibration cases, not runtime corpus fixtures.
- Current registry uses internal IDs (`CRIT-*-001`) by design; Doctrine Registry v2.1 ID alignment is tracked separately.
