# CANON CORRECTION PLAYBOOK V1
**RevisionGrade Phase 0 Warmup Artifact**
Version: 1.0.0
Date: 2026-05-24
Source: Distilled from FROGGIN_100P_EVALUATION_FIT_GAP_V1 and FROGGIN_100P_CANON_FIDELITY_FIXTURE_V1
Scope: Abstract calibration rules — not manuscript-specific. Safe to load on every evaluation job.

---

## What this playbook is

This is Phase 0's warmup calibration document. It does not describe any specific manuscript. It describes the class of evaluation failure that RegisionGrade's pipeline has produced and must learn to prevent.

Load this before scoring begins. Do not load the full benchmark correction documents (truth target, fit-gap) in production — they are training references for humans and regression tests, not live-prompt context.

---

## The core failure pattern to avoid

> **A pipeline that only evaluates the loudest plot lanes is not evaluating the manuscript. It is evaluating its own prior assumptions about what matters.**

RevisionGrade's evaluation pipeline has a documented failure mode: when a manuscript contains multiple structural worlds at different frequency levels, the pipeline defaults to the highest-frequency lanes and silently drops the lower-frequency ones — even when those lanes carry the manuscript's deepest emotional, thematic, and medicinal/object machinery.

This failure produces:
- Missing characters who are structurally essential
- Missing relationship spines that anchor the emotional arc
- Missing object/medicine/doctrine systems that explain the world's internal logic
- Artificially low criterion scores (especially Character, Scene Construction, Dialogue, Worldbuilding, Thematic Integration, and Narrative Closure) caused not by manuscript weakness but by evaluator blindness
- Recommendations to "add" or "develop" elements that are already present

---

## Phase 0 Warmup Protocol

Before any scoring pass begins, Phase 0 must complete the following structural mapping. Do not proceed to Phase 1A / Story Ledger until this mapping exists.

### Step 1 — Identify all structural lanes

For every manuscript, map the following lane types. Each lane must be explicitly named or ruled out with evidence.

| Lane type | What to look for | Common failure mode |
|---|---|---|
| **Primary plot lanes** | The loudest action/conflict threads (main antagonist, primary POV character's external goal) | Rarely missed — low risk |
| **Secondary emotional lanes** | Characters and relationships that carry the manuscript's tenderness, grief, healing, or moral weight — often at lower narrative frequency than plot lanes | **High miss risk** — pipeline over-weights action frequency |
| **Doctrinal / ideological systems** | Named belief systems, religious structures, philosophical frameworks, competing doctrines | Often collapsed into "worldbuilding flavor" instead of structural engine |
| **Medicine / object systems** | Named substances, tools, or systems that function as plot engines (healing agents, weapons, currencies, relics) | Frequently classified as descriptive texture rather than structural element |
| **Relationship spines** | Named character-to-character bonds that anchor emotional, thematic, or arc logic | Cross-world or cross-species relationships especially prone to omission |
| **Low-frequency / high-payoff characters** | Characters who appear in fewer chapters but carry disproportionate emotional or thematic weight | Pipeline may exclude from analysis if page-count threshold is too high |
| **Environmental / ecological systems** | Named environmental conditions (blight, contamination, dead zones, weather) that function as plot drivers or thematic anchors | Often reduced to "setting" rather than "structural consequence" |

### Step 2 — Build the ledger before scoring

Phase 0 must instruct the Story Ledger (Phase 1A) to produce all of the following before any criterion is scored:

1. **Character ledger** — every named character with role, function, and narrative weight
2. **Relationship spine ledger** — every named relationship with function and structural importance
3. **Object / medicine / symbol ledger** — every named system with its plot function
4. **Doctrine / ideology ledger** — every named belief system with its structural role
5. **Canon coverage risk flags** — any ledger entry with low source evidence should be flagged for human review, not silently dropped

### Step 3 — Validate coverage before scoring

Before Phase 2 scores any criterion, the pipeline must confirm:

- [ ] All named characters in the ledger have been assigned a role and structural weight
- [ ] All named relationship spines in the ledger have been flagged as major or minor with evidence
- [ ] All object/medicine systems in the ledger have been assigned a function
- [ ] No character, relationship, or system has been dropped without an explicit "minor — excluded with evidence" note
- [ ] The closure criterion will not be scored until the relationship spine ledger is complete

---

## The Five Scoring Governance Rules

These rules must be enforced across all evaluations, on all manuscripts.

### Rule 1 — Do not score closure without relationship-spine coverage

Narrative Closure measures how well the manuscript's arcs resolve within scope. It cannot be scored accurately if major relationship spines are missing from the analysis. If the relationship spine ledger is incomplete, the Closure score is invalid.

> **Closure score must be invalidated and flagged if any relationship spine remains unanalyzed.**

### Rule 2 — Do not recommend adding what is already present

Before generating any recommendation that begins with "add," "introduce," "establish," or "create" — check the character ledger, relationship spine ledger, and object/medicine ledger. If the recommended element is already listed, the recommendation must be reclassified as:

- `ALREADY_PRESENT` — do not generate as a Revise task
- Replace with: "elevate," "re-echo," "foreground," "strengthen the payoff of," or "sharpen"

### Rule 3 — Source-ground loaded vocabulary before use

Some labels carry genre or cultural assumptions that may not match the source text's own vocabulary. Before using a high-frequency training association as an evaluation label, confirm it is supported by the source text's own language.

**Examples of labels that require source confirmation:**
- "poaching" / "poacher" → confirm source text uses this word or an equivalent; if not, use the text's own vocabulary (e.g., "frog capture," "environmental contamination," "predation")
- "trafficking" → same confirmation rule
- "cult" → use the text's own doctrine name if present
- "fantasy" / "sci-fi" → use the text's own genre markers

> **If the label is not in the source text, do not use it as an evaluation term. Extract vocabulary from the manuscript.**

### Rule 4 — Low-frequency does not mean low-importance

A character, relationship, or system that appears in fewer chapters or words than the primary plot lanes may still be structurally central. Structural importance is determined by:

- Whether the character/system carries emotional weight disproportionate to page count
- Whether the character/system is load-bearing for the manuscript's thematic architecture
- Whether removing it would collapse a key arc or leave a scoring criterion ungrounded

> **Page-count frequency is not a valid proxy for structural importance. Evaluate by function, not frequency.**

### Rule 5 — Multi-world manuscripts require multi-lane analysis

When a manuscript contains two or more distinct world-systems (e.g., human world + frog polity + newt counter-world; real world + fantasy world; present + past), each world must be assigned its own structural lane in the analysis. The pipeline must not collapse multi-world manuscripts into a single dominant frame.

> **A manuscript with N structural worlds must produce N structural lane analyses. Missing a world entirely is a critical evaluation failure.**

---

## The Recommendation Validity Gate

Every recommendation generated by the evaluation pipeline must carry one of the following validity classifications before it is allowed to enter a Revise queue:

| Classification | Meaning | Revise queue action |
|---|---|---|
| `VALID` | Supported by evidence; gap confirmed; fix is appropriate | Allow |
| `PARTIALLY_VALID` | Direction correct; example or framing needs adjustment | Allow with revision note |
| `ALREADY_PRESENT` | Element is already in the manuscript | Block; replace with elevate/sharpen task |
| `CANON_FALSE` | Contradicts established manuscript canon | Block; flag for human review |
| `SOURCE_UNSUPPORTED` | Uses vocabulary not supported by source text | Block; rephrase using source vocabulary |
| `VOICE_RISK` | Structurally plausible but risks damaging manuscript voice | Allow only with explicit voice-preservation instruction |

---

## What Phase 0 should produce

At the end of Phase 0 warmup, the pipeline should have:

1. A **structural lane map** naming all lanes present in the manuscript and flagging any with low evidence
2. A **calibration understanding** (≥500 words) that describes the manuscript's architecture in its own vocabulary — what the dominant lanes are, what the secondary emotional lanes are, what doctrinal/medicine/object systems exist, and what relationship spines are load-bearing
3. A **coverage risk register** — any lane, character, or system that is present but low-evidence, flagged for careful attention in Phase 1A
4. A **vocabulary extraction note** — any genre labels or loaded terms the pipeline plans to use, confirmed against source text before Phase 1A begins

Phase 0 produces zero criterion scores. It produces structural mapping only. The scores come in Phase 2, after the ledgers are built.

---

## Benchmark reference

This playbook was distilled from the following benchmark correction package. These files are the evidence base — do not load them into production prompts, but use them for regression testing and pipeline training.

| File | Location | Purpose |
|---|---|---|
| `canon_corrected_truth_target_v1.md` | `docs/evaluation/fixtures/froggin-100p/` | Gold-standard corrected evaluation (human-readable) |
| `evaluation_fit_gap_v1.md` | `docs/evaluation/fixtures/froggin-100p/` | 10-part adjudication of the failure specimen (human-readable) |
| `canon_fidelity_fixture_v1.json` | `docs/evaluation/fixtures/froggin-100p/` | Machine-readable CI gate (regression testing) |

Failure specimen: `fa730c9c-e41b-4fc2-b37e-52db365b9b17` (overall 66/100, delta -8 from truth target, 6 critical canon misses, 3 structural lanes entirely absent).

---

## One-sentence Phase 0 instruction

> Before scoring, map every structural lane, build every ledger, confirm every name against the source text, and do not proceed until coverage is verified — because a pipeline that only sees the loudest lanes is not evaluating the manuscript.

---

*canon_correction_playbook_v1 — RevisionGrade Phase 0 Warmup Artifact*
*Version 1.0.0 — 2026-05-24*
*Abstract rules only — safe to load on any manuscript job*
