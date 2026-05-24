# CANON CORRECTION PLAYBOOK V1
**RevisionGrade Phase 0 Warmup Artifact**
Version: 1.1.0
Date: 2026-05-24
Source: Distilled from FROGGIN_100P_EVALUATION_FIT_GAP_V1 and FROGGIN_100P_CANON_FIDELITY_FIXTURE_V1
Scope: Abstract governance rules and ledger contracts only — not manuscript-specific. Safe to load on every evaluation job.

> **Phase boundary:** Phase 0 reads DREAM state golden records, lessons learned documents, and governance playbooks ONLY. Phase 0 does NOT read the actual manuscript. Manuscript-specific analysis begins at Phase 1A.

---

## What this playbook is

This is Phase 0's warmup calibration document. It does not describe any specific manuscript. It describes the class of evaluation failure that RevisionGrade's pipeline has produced and must learn to prevent.

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

Phase 0 is the evaluator's **training room**, not the manuscript reading room. It reads DREAM state golden records, lessons learned documents, and governance playbooks. It does NOT touch the actual manuscript. Manuscript reading begins at Phase 1A.

Phase 0 installs the following into the evaluation session before any manuscript pass begins:

### Step 1 — Load known failure patterns

Phase 0 reads the canonical failure modes documented in benchmark correction packages. The evaluator must enter Phase 1A aware of these failure classes:

| Failure class | Description | Correction rule |
|---|---|---|
| **Loudest-lane bias** | Pipeline over-weights primary plot/action lanes; drops lower-frequency emotional, doctrinal, and medicine/object lanes | Phase 1A must map ALL lane types, not just dominant ones |
| **Relationship spine omission** | Cross-world or cross-species relationship arcs filed separately and never merged | Phase 1A must build a relationship spine ledger before any scoring |
| **Object/medicine system blindness** | Named healing agents, relics, or medicine systems classified as descriptive texture rather than plot systems | Phase 1A must extract named object/medicine systems as structural entries |
| **Unsupported vocabulary** | High-frequency training labels (e.g., "poaching") applied without source-text confirmation | Phase 1A must extract vocabulary from the source; do not impose genre defaults |
| **Closure score deflation** | Narrative Closure underscored because relationship arcs were not analyzed | Closure must not be scored until the relationship spine ledger is complete |
| **Already-present recommendation error** | Pipeline recommends adding elements already in the manuscript | All recommendations must pass the Already-Present Gate before entering the Revise queue |

### Step 2 — Install the Phase 1A ledger contract

Phase 0 defines what Phase 1A MUST produce after reading the manuscript. Phase 0 does not produce these ledgers itself — it specifies the requirement that Phase 1A must satisfy.

Phase 1A is required to produce:
1. **Character ledger** — every named character with role, function, and narrative weight
2. **Relationship spine ledger** — every named relationship with function and structural importance
3. **Object / medicine / symbol ledger** — every named system with its plot function
4. **Doctrine / ideology ledger** — every named belief system with its structural role
5. **Structural lane map** — all lanes present in the manuscript, each explicitly included or ruled out with evidence
6. **Canon coverage risk register** — any element that is present but low-evidence, flagged for Phase 2 attention
7. **Source vocabulary extraction note** — genre labels or loaded terms Phase 2 plans to use, confirmed against source text

Phase 1A ledgers must exist before Phase 2 may score any criterion.

### Step 3 — Install the Phase 2 scoring prohibitions

Phase 0 installs these scoring prohibitions into the evaluation session. Phase 2 must not violate them:

- Narrative Closure must NOT be scored until the relationship spine ledger is complete
- Criterion scores must NOT be finalized until all Phase 1A ledgers exist
- A score reduction must NOT be applied to a criterion if the reduction is caused by a ledger gap rather than a manuscript gap
- Recommendations must NOT be generated from unsupported vocabulary

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

## What Phase 0 produces

Phase 0 produces governance artifacts only — no manuscript-specific content. At the end of Phase 0 warmup, the evaluation session has:

1. **Warmup calibration summary** — confirmation that known failure modes have been loaded and are active for this session
2. **Active governance rules** — the five scoring rules (see below) installed and enforced for this session
3. **Phase 1A ledger contract** — the required output list Phase 1A must satisfy before Phase 2 may score
4. **Known failure modes register** — the documented failure classes (loudest-lane bias, relationship spine omission, object blindness, unsupported vocabulary, closure deflation, already-present error) active as guards for this session
5. **Scoring prohibitions** — the explicit list of what Phase 2 may not do until Phase 1A coverage is verified
6. **Recommendation validity rules** — the six-class validity gate (VALID / PARTIALLY_VALID / ALREADY_PRESENT / CANON_FALSE / SOURCE_UNSUPPORTED / VOICE_RISK) installed and active
7. **Handoff instruction to Phase 1A** — confirmation that manuscript reading begins at Phase 1A, along with the ledger contract Phase 1A must fulfill

Phase 0 produces zero criterion scores. Phase 0 produces zero manuscript-specific analysis. Phase 0 does not read the source text.

---

## What Phase 1A must produce after reading the manuscript

Phase 1A is where the manuscript is first read. After completing its source analysis, Phase 1A must have produced all of the following. Phase 2 may not begin until this list is satisfied.

1. **Structural lane map** — every structural lane present in the manuscript, each named and either included with evidence or explicitly ruled minor with a reason. Lane types to map:
   - Primary plot lanes (action/conflict/external goal)
   - Secondary emotional lanes (tenderness, grief, healing, moral weight — often lower frequency but structurally central)
   - Doctrinal / ideological systems (named belief systems, competing doctrines)
   - Medicine / object systems (named substances, tools, healing agents, relics — structural function, not texture)
   - Relationship spines (named character-to-character bonds anchoring emotional, thematic, or arc logic)
   - Low-frequency / high-payoff characters (appear in fewer chapters but carry disproportionate weight)
   - Environmental / ecological systems (named conditions functioning as plot drivers or thematic anchors)

2. **Character ledger** — every named character with: role, structural function, narrative weight, and relationship spine connections

3. **Relationship spine ledger** — every named relationship with: characters involved, function (plot / emotional / thematic), and structural importance (major / minor / ruled out with evidence)

4. **Object / medicine / symbol ledger** — every named object system with: name, structural function, plot engine vs. texture classification, and relationship connections

5. **Doctrine / ideology ledger** — every named belief system with: name, structural role, and relationship to competing doctrines

6. **Canon coverage risk register** — any element present in the source but low-evidence in the ledger, flagged for Phase 2 attention. Format:
   - Entity name
   - Entity type (character / relationship / object / doctrine)
   - Risk description
   - Source evidence note

7. **Source vocabulary extraction note** — any genre label or loaded term Phase 2 plans to use as an evaluation descriptor, confirmed against source text. Format:
   - Candidate label
   - Source-supported: yes / no
   - Source evidence (if yes) or recommended replacement (if no)

8. **Calibration understanding** (≥500 words) — a written description of the manuscript's structural architecture in its own vocabulary: what the dominant lanes are, what the secondary emotional lanes are, what doctrinal/medicine/object systems exist, and what relationship spines are load-bearing. This is the Phase 1A-produced understanding; Phase 0 does not produce it.

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

> Phase 0 trains the evaluator. Phase 1A reads the manuscript. Phase 2 scores only after Phase 1A coverage is verified — because a pipeline that only sees the loudest lanes is not evaluating the manuscript; it is evaluating its own priors.

---

*canon_correction_playbook_v1 — RevisionGrade Phase 0 Warmup Artifact*
*Version 1.1.0 — 2026-05-24*
*Phase 0 governance rules and Phase 1A ledger contract only — no manuscript-specific content — safe to load on any evaluation job*
