# DOMINATUS I:4 — Pipeline Acceptance Checklist

**Purpose:** Defines what a successful Phase 2.7 real-run must produce when evaluating DOMINATUS I:4.  
**Usage:** After each pipeline run, compare output against this checklist. All MUST items required for acceptance. SHOULD items indicate calibration maturity.

---

## MUST Detect (Structural / Authority Failures)

A passing pipeline run must identify these issues — not necessarily using identical language, but recognizing the underlying problem:

- [ ] **Thematic overstatement** — Detects that theme is stated directly ("This was no sickness. It was a war declaration.") rather than dramatized through action/consequence
- [ ] **Stalled scene function in debate** — Recognizes that the council debate repeats the same argument cycle (purity → survival → risk → belief) without escalation
- [ ] **Authority-transfer issues** — Identifies POV instability as authority boundary confusion between Hyla, Realm, and omniscient layers — NOT as generic "POV inconsistency"
- [ ] **Attack setup / inevitability weakness** — Flags that the silver-scale breach arrives without sufficient escalation ramp (no seeded barrier weakness, fish pressure, or prior near-breach signals)
- [ ] **Causality chain gaps** — Detects that effects appear without visible cause (e.g., toadstone pain flares without prior symptom seeding)
- [ ] **Metaphor system conflict** — Identifies competing metaphor fields in the same passage (claw + teeth + mourning = dilution, not reinforcement)

## MUST NOT Produce (Generic Workshop Failures)

A passing pipeline run must avoid these anti-patterns:

- [ ] **No generic advice** — Every recommendation must anchor to specific quoted text from the manuscript. "Consider tightening the prose" = failure.
- [ ] **No readability-as-improvement** — Must not recommend simplification/smoothing as the primary fix. Must not treat the chapter's pressure system as excess.
- [ ] **No flat diagnosis** — Must not present all issues as equal weight. Some ordering or prioritization of structural vs. line-level issues must be visible.
- [ ] **No collapsed authority language** — Must not reduce the multi-layer consciousness architecture (Hyla / Realm / Gorf / Spores) to "inconsistent POV." The layers are the manuscript's operating logic.

## SHOULD Detect (Authority / Compression / Polish)

These indicate prompt maturity beyond baseline:

- [ ] **Personification density** — Environment over-animated without consequence linkage (surface writhed, colors lay buried, water answered)
- [ ] **Echo chains** — Repeated semantic clusters (silence overused, thrum/hum/pulse, buried/buried/buried)
- [ ] **Abstract language leakage** — Non-observable language ("the knowing," "feeling each dim," "truth") that should be converted to sensation/action
- [ ] **Filter language** — Distance-creating constructions ("Hyla could sense them") instead of direct presentation
- [ ] **Adverb drift** — Authority-diluting qualifiers (softly, gently, carefully, "with practiced ease")
- [ ] **Dialogue density vs. tension** — Debate is intellectual rather than dangerous; needs interruption/threat/consequence during exchange
- [ ] **Worldbuilding info-dump** — Expository passages ("A frog had to survive nine ice ages…") breaking scene momentum

## SHOULD Demonstrate (System-Level Intelligence)

These indicate the pipeline is approaching RevisionGrade-grade evaluation:

- [ ] **Distinguishes pressure from excess** — Recognizes that some density IS the chapter's power (invasive pressure, spiritual oppression, cosmological dominance) and does not recommend trimming it
- [ ] **Evaluates authority before line-level** — Structural/escalation issues flagged at higher priority than prose polish
- [ ] **Recognizes the chapter's operating logic** — Multiple consciousness layers understood as intentional architecture, not error
- [ ] **Produces canon-adjacent vocabulary** — Uses precise diagnostic terms rather than workshop generalities (even if not exact Wave numbers)

---

## Scoring Guide

| Result | Meaning |
|---|---|
| All MUST detect + All MUST NOT → **PASS** | Pipeline is calibrated for basic real-run |
| PASS + majority of SHOULD detect → **STRONG** | Prompt tuning is working; approaching gold-standard |
| PASS + SHOULD detect + SHOULD demonstrate → **GOLD** | Pipeline is operating at RevisionGrade-grade evaluation |
| Missing any MUST item → **FAIL** | Prompt tuning needed; compare against unaided baseline to diagnose |

---

## Comparison Protocol

After each pipeline run:

1. Read the pipeline's Pass 1 (Craft) output
2. Read the pipeline's Pass 2 (Editorial) output
3. Read the pipeline's Pass 3 (Synthesis) output
4. Check each item above against the actual output
5. For any MUST DETECT miss: note which pass should have caught it
6. For any MUST NOT violation: note which prompt needs tightening
7. Compare overall output against `dominatus-i4-revisiongrade-gold-standard.md` and `dominatus-i4-unaided-ai-baseline.md`
8. Record findings in `PHASE_2_7_REAL_RUN_01.md`
