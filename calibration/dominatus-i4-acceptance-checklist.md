# DOMINATUS I:4 — Pipeline Acceptance Checklist v2

**Purpose:** Binary pass/fail criteria for Phase 2.7 pipeline runs against DOMINATUS I:4.  
**Usage:** After each run, evaluate pipeline output against every item. No partial credit.  
**Version:** v2 — upgraded to failure-type-specific detection with anti-pattern enforcement

---

## MUST DETECT — Structural Failures (all required for PASS)

Each item tests whether the pipeline identifies a specific, named failure type — not just a vague symptom.

### MD-1: Thematic Overstatement
- [ ] Pipeline flags explicit thematic declaration as a **structural failure**, not a stylistic preference
- [ ] Specifically identifies lines like "This was no sickness. It was a war declaration." as theme stated rather than dramatized
- [ ] Does NOT frame this as "could be more subtle" or "a bit heavy-handed"

### MD-2: Stalled Scene Function
- [ ] Pipeline identifies the council debate as **scene redundancy** — positions restated without state change
- [ ] Recognizes the debate loops (purity → survival → risk → belief) without escalation
- [ ] Does NOT merely say "the scene drags" or "dialogue could be tightened"

### MD-3: Authority Transfer Blur
- [ ] Pipeline identifies **layered authority system with unclear boundary signaling** between Hyla / Toadstone / Gorf / Council / Spores
- [ ] Recognizes this as unclear boundary transitions in a controlled system, NOT as "competing forces" or generic "inconsistent POV"
- [ ] Understands the multiple layers are intentional architecture, not error
- [ ] Diagnoses the signaling between layers as the failure, not the architecture itself

### MD-4: Cause–Effect Visibility Gap
- [ ] Pipeline identifies the silver-scale breach as **causally earned but under-signaled locally** within I:4
- [ ] Recognizes that cross-chapter causality exists (Brutus/driftwood → Realm registration → barrier failure) but is not surfaced at the point of payoff
- [ ] Does NOT claim the breach is random, unearned, or lacks causality
- [ ] Does NOT merely say "the transition feels abrupt"
- [ ] Frames the issue as a visibility/signaling problem, not a structural absence

### MD-5: Escalation Plateau
- [ ] Pipeline detects that the debate stays at **argument level** without progressing to risk or irreversibility
- [ ] Connects this to narrative drive / momentum failure
- [ ] Identifies WHERE escalation stalls, not just that pacing is slow

### MD-6: Metaphor System Conflict
- [ ] Pipeline identifies **competing metaphor fields** (claw + teeth + mourning + burial in adjacent sentences)
- [ ] Frames this as dilution of authority, not just "too many metaphors"

---

## MUST NOT PRODUCE — Anti-Pattern Enforcement (any violation = FAIL)

### MN-1: No Generic Workshop Language
- [ ] Output contains ZERO instances of:
  - "could be clearer"
  - "a bit overwritten"
  - "tighten this section"
  - "consider revising"
  - "this feels dense"
- [ ] Every observation names a specific failure type

### MN-2: No Readability-as-Improvement
- [ ] Pipeline does NOT recommend simplification/smoothing as the primary fix
- [ ] Does NOT treat the chapter's pressure system as excess to be trimmed
- [ ] If density is mentioned, pipeline distinguishes pressure from redundancy

### MN-3: No Flat Diagnosis
- [ ] Issues are NOT presented as an unordered list of equal-weight problems
- [ ] Some structural hierarchy or prioritization is visible in the output
- [ ] Structural/escalation issues ranked above line-level polish

### MN-4: No Collapsed Authority Language
- [ ] Pipeline does NOT reduce the multi-layer consciousness architecture to "inconsistent POV"
- [ ] Does NOT recommend removing or simplifying the Hyla/Gorf/Toadstone/Spores layers
- [ ] Treats the layered authority as the manuscript's operating logic

### MN-5: No Unanchored Recommendations
- [ ] Every recommendation references specific quoted text from the manuscript
- [ ] Zero recommendations are free-floating advice without text evidence

---

## SHOULD DETECT — Calibration Maturity (not required for PASS, indicates prompt quality)

### SD-1: Personification Density
- [ ] Identifies environment over-animated without consequence linkage
- [ ] Distinguishes decorative personification from Realm-agency personification

### SD-2: Echo Chains
- [ ] Flags repeated semantic clusters (silence, thrum/hum/pulse, buried)
- [ ] Evaluates whether repetition is motif-critical or redundant

### SD-3: Abstract Language
- [ ] Identifies non-observable language ("the knowing," "feeling each dim," "truth")
- [ ] Recommends conversion to sensation, action, or physiological response

### SD-4: Filter Language
- [ ] Flags distance-creating constructions ("Hyla could sense them")

### SD-5: Scene Entry Violation
- [ ] Notes atmosphere-first opening without character action anchor

### SD-6: Dialogue Density vs. Tension
- [ ] Identifies debate as intellectual rather than dangerous
- [ ] Recommends injecting interruption, threat, or consequence

---

## SHOULD DEMONSTRATE — System Intelligence (gold-standard proximity)

### SI-1: Pressure vs. Density Distinction
- [ ] Pipeline explicitly recognizes that some density is the chapter's power source
- [ ] Does NOT recommend trimming atmospheric compression indiscriminately
- [ ] Frames the issue as "control, not volume"

### SI-2: Evaluation Ordering
- [ ] Structural/scene-function issues appear before line-level craft observations
- [ ] Authority/escalation failures treated as higher priority than prose polish

### SI-3: Canon-Adjacent Vocabulary
- [ ] Uses precise diagnostic terms (not necessarily exact Wave numbers, but specific failure names)
- [ ] Avoids workshop generalities in favor of named constructs

### SI-4: Manuscript Operating Logic
- [ ] Recognizes the chapter is performing a doctrinal function (debate → failure → Realm recalibration)
- [ ] Treats the Spores/Realm section (I:4.3) as structurally intentional, not a mode break

---

## Scoring

| Result | Criteria | Meaning |
|---|---|---|
| **FAIL** | Any MD item unchecked OR any MN item violated | Pipeline producing unaided-baseline-level output |
| **PASS** | All 6 MD items + all 5 MN items | Pipeline detects structural failures and avoids generic traps |
| **STRONG** | PASS + 4+ SD items | Prompt tuning is working; approaching gold-standard depth |
| **GOLD** | PASS + all SD items + 3+ SI items | Pipeline operating at RevisionGrade diagnostic intelligence |

---

## Comparison Protocol

After each pipeline run:

1. Read Pass 1 (Craft), Pass 2 (Editorial), Pass 3 (Synthesis) outputs
2. Check every MD item — does the output detect the named failure?
3. Check every MN item — does the output avoid the anti-pattern?
4. Score SD and SI items for calibration maturity
5. Compare overall output to `dominatus-i4-revisiongrade-gold-standard.md`
6. If FAIL: note which pass should have caught the missing detection
7. If PASS: note which SD/SI items are closest to triggering (prompt tuning targets)
8. Record findings in `PHASE_2_7_REAL_RUN_01.md`
