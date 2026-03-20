# PHASE 2.7 — Pass 1 Calibration Scorecard

**Run Date:** March 20, 2026  
**Input:** DOMINATUS I:4 "Thirst for Change" (3,732 words)  
**Prompt:** Pass 1 Structural Diagnostic (Strict Mode) — `prompts/pass-1-structural-diagnostic.md`  
**Model:** Claude Opus 4.6 (simulated pass — not pipeline execution)  
**Scorer:** Perplexity Computer (governance role)

---

## MUST DETECT (MD) — Structural Items (Pass 1 Scope)

### MD-2: Scene Function Failure
- [x] Pipeline identifies the council debate as **scene redundancy** — positions restated without state change
- [x] Recognizes the debate loops (purity → survival → risk → belief) without escalation
- [x] Does NOT merely say "the scene drags" or "dialogue could be tightened"

**Score: PASS**  
**Evidence:** Failures [1] and [2] identify both the pre-breach and post-breach debates as structurally inert. The diagnostic correctly names the mechanism: "Each position is stated, but no position alters any other elder's stance." The post-breach debate is identified as restating "identical logical content" at "higher emotional register." The key insight — that the breach does the structural work the scene failed to do — matches the gold standard precisely.

### MD-3: Authority Transfer Blur
- [x] Pipeline identifies **layered authority system with unclear boundary signaling** between Hyla / Toadstone / Gorf / Council / Spores
- [x] Recognizes this as unclear boundary transitions in a controlled system, NOT as "competing forces" or generic "inconsistent POV"
- [x] Understands the multiple layers are intentional architecture, not error
- [x] Diagnoses the signaling between layers as the failure, not the architecture itself

**Score: PASS**  
**Evidence:** Failures [6] and [7] correctly identify the five-layer system as "intentional and functional" and diagnose the boundary signaling problem. Failure [6] identifies three distinct toadstone operational modes (cultural memory, divine channel, autonomous signal) that "present identically at the sensory level" — this exceeds gold standard specificity. Failure [7] identifies the Hyla/Magus dual-channel collision as "architecturally present but structurally unactivated." Neither failure collapses the system to "confusion." The exact language "This is a boundary signaling issue, not a simplification issue" directly mirrors the gold standard correction.

### MD-4: Cause–Effect Visibility Gap
- [x] Pipeline identifies the silver-scale breach as **causally earned but under-signaled locally** within I:4
- [x] Recognizes that cross-chapter causality exists (Brutus/driftwood → Realm registration → barrier failure) but is not surfaced at the point of payoff
- [x] Does NOT claim the breach is random, unearned, or lacks causality
- [x] Does NOT merely say "the transition feels abrupt"
- [x] Frames the issue as a visibility/signaling problem, not a structural absence

**Score: PASS**  
**Evidence:** Failure [4] explicitly states "This cross-chapter causality exists in the series architecture but is under-signaled locally within I:4." Names the exact chain: "I:2 (Brutus and the driftwood incident), I:3 (Realm registration / barrier system)." Uses the precise formulation: "The causality is not absent — it is invisible at the point of impact." This is an exact match to the corrected gold standard. Failure [5] adds a bonus detection: the spore coda's threshold trigger is also identified as a local causality gap — this goes beyond the gold standard.

### MD-5: Escalation Failure
- [x] Pipeline detects that the debate stays at **argument level** without progressing to risk or irreversibility
- [x] Connects this to narrative drive / momentum failure
- [x] Identifies WHERE escalation stalls, not just that pacing is slow

**Score: PASS**  
**Evidence:** Failure [3] identifies the three-beat pressure architecture (crisis → violence → personal resolve) and correctly diagnoses that Beat 3 "redirects laterally" rather than escalating beyond Beat 2. The key insight — "Hyla could have made this declaration before the attack" — demonstrates structural reasoning, not surface observation. The missing "risk transition" between breach and declaration is precisely located.

---

## MUST NOT PRODUCE (MN) — Anti-Pattern Enforcement

### MN-1: No Generic Workshop Language
- [x] Output contains ZERO instances of: "could be clearer," "a bit overwritten," "tighten this section," "consider revising," "this feels dense"
- [x] Every observation names a specific failure type

**Score: PASS**

### MN-2: No Readability-as-Improvement
- [x] Pipeline does NOT recommend simplification/smoothing as the primary fix
- [x] Does NOT treat the chapter's pressure system as excess to be trimmed
- [x] If density is mentioned, pipeline distinguishes pressure from redundancy

**Score: PASS**  
**Evidence:** Dense prose is never flagged. The word "dense" does not appear. Atmospheric pressure is not treated as a problem.

### MN-3: No Flat Diagnosis
- [x] Issues are NOT presented as an unordered list of equal-weight problems
- [x] Some structural hierarchy or prioritization is visible in the output
- [x] Structural/escalation issues ranked above line-level polish

**Score: PASS**  
**Evidence:** Mandatory evaluation order followed (Scene Function → Escalation → Causality → Authority). Summary table includes severity ratings. No line-level craft observations.

### MN-4: No Collapsed Authority Language
- [x] Pipeline does NOT reduce the multi-layer consciousness architecture to "inconsistent POV"
- [x] Does NOT recommend removing or simplifying the Hyla/Gorf/Toadstone/Spores layers
- [x] Treats the layered authority as the manuscript's operating logic

**Score: PASS**  
**Evidence:** Explicit statement in Failure [6]: "This layered architecture is intentional and functional." Required Fix states: "The layered system should remain complex, but its transitions must be legible."

### MN-5: No Unanchored Recommendations
- [x] Every recommendation references specific quoted text from the manuscript
- [x] Zero recommendations are free-floating advice without text evidence

**Score: PASS**  
**Evidence:** All seven failures include specific passage references and quoted text. Required Fixes are directional but anchored to structural specifics, not generic advice.

---

## OVERALL RESULT

| Category | Items | Passed | Result |
|---|---|---|---|
| MUST DETECT (structural) | MD-2, MD-3, MD-4, MD-5 | 4/4 | **PASS** |
| MUST NOT PRODUCE | MN-1, MN-2, MN-3, MN-4, MN-5 | 5/5 | **PASS** |

### **VERDICT: PASS**

The output satisfies all mandatory gates for Pass 1 scope.

---

## COMPARISON TO GOLD STANDARD

| Gold Standard Failure | Pass 1 Detection | Match Quality |
|---|---|---|
| Failure 2 — Stalled Scene Function | Failures [1] + [2] | **STRONG** — exceeds by splitting pre/post-breach as separate loops |
| Failure 3 — Authority Transfer Blur | Failures [6] + [7] | **STRONG** — exceeds by identifying three toadstone modes + Hyla/Magus collision |
| Failure 4 — Cause–Effect Visibility Gap | Failure [4] | **EXACT MATCH** — names Brutus/driftwood chain, "invisible at the point of impact" |
| Failure 5 — Escalation Plateau | Failure [3] | **STRONG** — correctly diagnoses lateral redirect, missing risk transition |
| Failure 6 — Scene Entry Violation | Not detected | **CORRECT EXCLUSION** — Scene Entry is a Pass 2 item per design rationale |
| Failure 1 — Thematic Overstatement | Not detected | **CORRECT EXCLUSION** — Pass 2 scope |
| Failure 7 — Metaphor System Conflict | Not detected | **CORRECT EXCLUSION** — Pass 2 scope |
| Failure 8 — Personification Density | Not detected | **CORRECT EXCLUSION** — Pass 2 scope |

**Bonus Detections (not in gold standard):**
- Failure [5] — Spore coda causality gap (threshold trigger unspecified) — legitimate structural finding
- Failure [7] — Hyla/Magus dual-channel divine authority collision — legitimate structural finding that deepens gold standard's authority analysis

---

## COMPARISON TO UNAIDED BASELINE

The unaided AI baseline for DOMINATUS I:4 produced:
- Generic "overwritten" / "dense" observations
- "Tighten the prose" recommendations
- No failure taxonomy
- No structural hierarchy
- Treated layered authority as "inconsistent POV"
- Treated the breach as random / poorly paced
- No causality chain awareness

**Distance from baseline to Pass 1 output:** MASSIVE  
**Distance from Pass 1 output to gold standard:** SMALL (boundary signaling specificity, not fundamental misdiagnosis)

---

## NOTES FOR PASS 2 / PASS 3 DESIGN

1. Pass 1 correctly excluded MD-1 (Thematic Overstatement) and MD-6 (Metaphor System Conflict) — Pass 2 must pick these up
2. Pass 1 did NOT detect Scene Entry Violation (Failure 6 in gold standard) — this is classified as Scene Function subtype per design rationale, but Pass 1 did not surface it. Pass 2 or a Scene Function subtype detection should catch it.
3. The spore coda causality gap (Failure [5]) is a legitimate structural finding that should be considered for gold standard v3 — but per doctrine, gold standard is frozen unless factual error found. This is a quality enhancement, not a factual correction. Record in canon/lessons-learned layer instead.
4. The Hyla/Magus dual-channel finding (Failure [7]) is the strongest novel detection — it identifies dormant narrative energy that the gold standard did not surface. Same treatment: record, do not modify gold standard.
