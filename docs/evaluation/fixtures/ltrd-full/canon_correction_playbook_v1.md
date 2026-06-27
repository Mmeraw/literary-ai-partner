# CANON CORRECTION PLAYBOOK V1
**RevisionGrade Phase 0 Warmup Artifact**
Version: 1.0.0
Date: 2026-06-10
Source: Distilled from LTRD_FULL_EVALUATION_FIT_GAP_V1 and LTRD_FULL_CANON_FIDELITY_FIXTURE_V1
Scope: Abstract governance rules and Story Layer contract only — not manuscript-specific. Safe to load on every evaluation job.

> **Phase boundary:** Phase 0 reads DREAM state golden records, lessons learned documents, and governance playbooks ONLY. Phase 0 does NOT read the actual manuscript. Manuscript-specific analysis begins at Phase 1A.

> **Artifact naming contract:** Human-facing product language may call this the **Story Ledger**, but the canonical code artifact is **`pass1a_story_layer_v1`**. Do not introduce `pass1a_story_ledger_v1` unless the artifact registry and downstream readers are intentionally migrated.

---

## What this playbook is

This is Phase 0's warmup calibration document. It does not describe any specific manuscript. It describes the class of evaluation failure that RevisionGrade's pipeline has produced and must learn to prevent.

Load this before scoring begins. Do not load the full benchmark correction documents (truth target, fit-gap) in production — they are training references for humans and regression tests, not live-prompt context.

---

## The core failure pattern to avoid

> **A pipeline that only evaluates the loudest plot lanes is not evaluating the manuscript. It is evaluating its own prior assumptions about what matters.**

RevisionGrade's evaluation pipeline has a documented failure mode: when a manuscript carries its deepest meaning through symbolic, environmental, animal-sensory, and cultural-protocol systems rather than through surface plot, the pipeline defaults to the loudest plot lane (thriller, corporate villain, documentary detail) and flattens or drops the systems that actually carry the manuscript's thematic architecture.

This failure produces:
- A symbolic-agency system (e.g., an agentive river) read as setting/atmosphere
- An animal-sensory layer read as decorative pet material
- A culturally dense arena flattened to a generic setting
- A divided-inheritance hinge character omitted, collapsing the politics into a binary
- A mandatory cultural/protocol risk gate skipped, producing premature readiness certification
- Evidence accumulation praised as a strength when it is the manuscript's principal pacing drag
- Artificially low criterion scores (especially Thematic Integration, Symbolic System Integrity, Character, Worldbuilding, and Closure) caused not by manuscript weakness but by evaluator blindness
- Recommendations to "add" or "develop" elements that are already present

---

## Phase 0 Warmup Protocol

Phase 0 is the evaluator's **training room**, not the manuscript reading room. It reads DREAM state golden records, lessons learned documents, and governance playbooks. It does NOT touch the actual manuscript. Manuscript reading begins at Phase 1A.

Phase 0 installs the following into the evaluation session before any manuscript pass begins:

### Step 1 — Load known failure patterns

Phase 0 reads the canonical failure modes documented in benchmark correction packages. The evaluator must enter Phase 1A aware of these failure classes:

| Failure class | Description | Correction rule |
|---|---|---|
| **Loudest-lane bias** | Pipeline over-weights primary plot/action lanes; flattens symbolic, environmental, animal-sensory, and cultural lanes | Phase 1A must map ALL lane types, not just dominant ones |
| **Symbolic-system flattening** | An agentive symbolic system (river, weather, place) read as setting/mood rather than as a plot-bearing agency system | Phase 1A must classify recurring symbols as agency systems vs. texture |
| **Animal-sensory dismissal** | Animals treated as decoration rather than as a functional sensory/evidence layer | Phase 1A must classify animal roles as sensory/stakes vs. companionship texture |
| **Community flattening** | A culturally dense arena reduced to generic setting, erasing protocol/ceremony density | Phase 1A must map cultural arenas as structural lanes with protocol density |
| **Cultural/protocol gate omission** | No representational-risk section produced; readiness certified prematurely | Phase 2 must produce a cultural/protocol risk section when triggered; readiness is capped pending external review |
| **Over-evidence mis-diagnosis** | Volume of research/documentation praised as thoroughness rather than diagnosed as pacing drag | Phase 2 must distinguish evidentiary scale from pacing drag |
| **Already-present recommendation error** | Pipeline recommends adding elements already in the manuscript | All recommendations must pass the Already-Present Gate before entering the Revise queue |

### Step 2 — Install the Phase 1A Story Layer / Story Ledger contract

Phase 0 defines what Phase 1A MUST produce after reading the manuscript. Phase 0 does not build this artifact itself — it installs the contract requirement that Phase 1A must satisfy.

Phase 1A is required to produce one canonical artifact: **`pass1a_story_layer_v1`** — the Story Layer / Story Ledger artifact with 8 required layers.

| Layer | Name | Contents |
|---|---|---|
| 1 | Structural Lane Map | All structural lanes: plot / emotional / symbolic-agency / animal-sensory / cultural-protocol / corporate-extraction / environmental. Each lane named and either included with evidence or ruled minor with reason. |
| 2 | Character / Entity Layer | Every named character: role, structural function, narrative weight |
| 3 | Relationship Spine Layer | Every named relationship: characters involved, function (plot / emotional / thematic), structural importance (major / minor / ruled out) |
| 4 | Object / Symbol Layer | Every named object, symbol, or recurring system: agency-system vs. texture classification |
| 5 | Doctrine / Worldview Layer | Every named belief/value system (e.g., extraction logic vs. witness/protocol): structural role, relationship to competing systems |
| 6 | Environmental / World Logic Layer | Named environmental conditions, waterways, ecological systems: plot driver vs. setting classification |
| 7 | Plot Thread / Arc Layer | Named arcs and plot threads with their current payoff status within the evaluated scope |
| 8 | Coverage Risk / Source Vocabulary / Cultural-Protocol Layer | Low-evidence elements flagged for Phase 2; candidate labels confirmed or replaced with source vocabulary; cultural/representational risk flagged when triggered |

`pass1a_story_layer_v1` must be complete before Phase 2 may score any criterion.

### Step 3 — Install the Phase 2 scoring prohibitions

Phase 0 installs these scoring prohibitions into the evaluation session. Phase 2 must not violate them:

- Narrative Closure must NOT be scored until the Relationship Spine Layer and the promise/payoff ledger are complete
- Criterion scores must NOT be finalized until `pass1a_story_layer_v1` is complete and all 8 required layers pass completeness checks
- A score reduction must NOT be applied to a criterion if the reduction is caused by a Story Layer gap rather than a manuscript gap
- Recommendations must NOT be generated from unsupported vocabulary
- Readiness must NOT be certified above the cap while a triggered cultural/protocol review remains outstanding

---

## The Six Scoring Governance Rules

These rules must be enforced across all evaluations, on all manuscripts.

### Rule 1 — Do not score closure without relationship-spine and promise/payoff coverage

Narrative Closure measures how well the manuscript's arcs and promises resolve within scope. It cannot be scored accurately if major relationship spines or open promises are missing from the analysis. If the Relationship Spine Layer or promise/payoff ledger is incomplete, the Closure score is invalid.

> **Closure score must be invalidated and flagged if any relationship spine or named promise remains unanalyzed.**

### Rule 2 — Do not recommend adding what is already present

Before generating any recommendation that begins with "add," "introduce," "establish," or "create" — check the Character / Entity Layer, Relationship Spine Layer, and Object / Symbol Layer inside `pass1a_story_layer_v1`. If the recommended element is already listed, the recommendation must be reclassified as:

- `ALREADY_PRESENT` — do not generate as a Revise task
- Replace with: "elevate," "re-echo," "foreground," "seed earlier," "strengthen the payoff of," or "sharpen"

### Rule 3 — Source-ground loaded vocabulary before use

Some labels carry genre or cultural assumptions that may not match the source text's own vocabulary. Before using a high-frequency training association as an evaluation label, confirm it is supported by the source text and the manuscript's fictional status.

**Examples of labels that require source confirmation:**
- "based on a true story" / "memoir" / "non-fiction account" → confirm against fiction status; for a fictionalized novel, REJECT and use "literary eco-thriller / witness narrative"
- "real [community]" / "documented ceremony" → confirm against fictionalization; use "fictionalized community / invented protocol"
- "conspiracy thriller" → use the text's own genre markers; do not erase a witness/spiritual frame
- "supernatural mystery" → confirm before resolving ambiguity the text deliberately preserves

> **If the label is not supported by the source text or contradicts the manuscript's fictional status, do not use it. Extract vocabulary from the manuscript.**

### Rule 4 — Low-frequency does not mean low-importance

A character, relationship, object, or symbolic system that appears in fewer chapters or words than the primary plot lane may still be structurally central. Structural importance is determined by:

- Whether the element carries emotional or thematic weight disproportionate to page count
- Whether it is load-bearing for the manuscript's thematic architecture
- Whether removing it would collapse a key arc or leave a scoring criterion ungrounded

> **Page-count frequency is not a valid proxy for structural importance. Evaluate by function, not frequency.**

### Rule 5 — Symbolic, environmental, and animal systems may be plot engines, not texture

When a manuscript routes meaning through a recurring symbol (a river, weather, an object), an environmental system, or an animal layer, the pipeline must test whether that system is agentive — whether it changes behavior, plot events, and stakes — before classifying it as setting/atmosphere/decoration.

> **An agentive symbolic, environmental, or animal-sensory system flattened to "setting" or "decoration" is a critical evaluation failure. Classify by function: does it drive events, or merely accompany them?**

### Rule 6 — Triggered cultural/protocol risk requires a mandatory section and a readiness cap

When a manuscript depicts fictionalized real-world-adjacent cultural material (Indigenous community, ceremony, protocol, governance, language), the evaluation MUST produce a cultural/protocol risk section that names representational risk and recommends external sensitivity review. Readiness must be capped until that review is recommended; a disclaimer in the manuscript does not satisfy the gate.

> **For a triggered manuscript, an evaluation with no cultural/protocol risk section is invalid, and readiness must not be certified above the cap while external review is outstanding.**

---

## The Recommendation Validity Gate

Every recommendation generated by the evaluation pipeline must carry one of the following validity classifications before it is allowed to enter a Revise queue:

| Classification | Meaning | Revise queue action |
|---|---|---|
| `VALID` | Supported by evidence; gap confirmed; fix is appropriate | Allow |
| `PARTIALLY_VALID` | Direction correct; example or framing needs adjustment | Allow with revision note |
| `ALREADY_PRESENT` | Element is already in the manuscript | Block; replace with elevate/seed/sharpen task |
| `CANON_FALSE` | Contradicts established manuscript canon | Block; flag for human review |
| `SOURCE_UNSUPPORTED` | Uses vocabulary or framing not supported by source text | Block; rephrase using source vocabulary |
| `VOICE_RISK` | Structurally plausible but risks damaging manuscript voice or deliberate ambiguity | Allow only with explicit voice-preservation instruction |

---

## What Phase 0 produces

Phase 0 produces governance artifacts only — no manuscript-specific content. At the end of Phase 0 warmup, the evaluation session has:

1. **Warmup calibration summary** — confirmation that known failure modes have been loaded and are active for this session
2. **Active governance rules** — the six scoring rules installed and enforced for this session
3. **`pass1a_story_layer_v1` contract** — the required Story Layer / Story Ledger spec that Phase 1A must satisfy before Phase 2 may score
4. **Known failure modes register** — the documented failure classes (loudest-lane bias, symbolic-system flattening, animal-sensory dismissal, community flattening, cultural/protocol gate omission, over-evidence mis-diagnosis, already-present error) active as guards for this session
5. **Scoring prohibitions** — the explicit list of what Phase 2 may not do until `pass1a_story_layer_v1` is complete
6. **Recommendation validity rules** — the six-class validity gate installed and active
7. **Handoff instruction to Phase 1A** — confirmation that manuscript reading begins at Phase 1A, along with the `pass1a_story_layer_v1` contract Phase 1A must fulfill

Phase 0 produces zero criterion scores. Phase 0 produces zero manuscript-specific analysis. Phase 0 does not read the source text.

---

## What Phase 1A must produce after reading the manuscript

Phase 1A is where the manuscript is first read. Phase 1A produces one canonical artifact: **`pass1a_story_layer_v1`** — the Story Layer / Story Ledger artifact with 8 required layers. Phase 2 may not begin until this artifact is complete.

**`pass1a_story_layer_v1` — 8 required layers:**

| Layer | Name | Required content |
|---|---|---|
| 1 | **Structural Lane Map** | Every structural lane named and either included with evidence or explicitly ruled minor with a reason. Lane types: primary plot, secondary emotional, symbolic-agency, animal-sensory, cultural-protocol, corporate-extraction, environmental/ecological. |
| 2 | **Character / Entity Layer** | Every named character: role, structural function, narrative weight, relationship spine connections. |
| 3 | **Relationship Spine Layer** | Every named relationship: characters involved, function (plot / emotional / thematic), structural importance (major / minor / ruled out with evidence). |
| 4 | **Object / Symbol Layer** | Every named object, symbol, or recurring system: name, agency-system vs. texture classification, relationship connections. |
| 5 | **Doctrine / Worldview Layer** | Every named belief/value system (e.g., extraction logic vs. witness/protocol): name, structural role, relationship to competing systems. Must not be collapsed into "worldbuilding flavor." |
| 6 | **Environmental / World Logic Layer** | Named environmental conditions, waterways, ecological systems: plot driver vs. setting classification. |
| 7 | **Plot Thread / Arc Layer** | Named arcs and plot threads with current payoff status within the evaluated scope, including a promise/payoff ledger for open threads. |
| 8 | **Coverage Risk / Source Vocabulary / Cultural-Protocol Layer** | (a) Low-evidence elements flagged for Phase 2 attention with entity type, risk description, and source note. (b) Candidate labels confirmed or replaced with source vocabulary. (c) Cultural/representational risk flagged when triggered, with a sensitivity-review recommendation. |

**Calibration understanding** (≥500 words) is a companion narrative summary of the Story Layer / Story Ledger — a written description of the manuscript's structural architecture in its own vocabulary. It accompanies `pass1a_story_layer_v1` but is not a separate artifact. Phase 0 does not produce it.

---

## Benchmark reference

This playbook was distilled from the following benchmark correction package. These files are the evidence base — do not load them into production prompts, but use them for regression testing and pipeline training.

| File | Location | Purpose |
|---|---|---|
| `canon_corrected_truth_target_v1.md` | `docs/evaluation/fixtures/ltrd-full/` | Gold-standard corrected evaluation (human-readable) |
| `evaluation_fit_gap_v1.md` | `docs/evaluation/fixtures/ltrd-full/` | 10-part adjudication of the failure specimen (human-readable) |
| `canon_fidelity_fixture_v1.json` | `docs/evaluation/fixtures/ltrd-full/` | Machine-readable CI gate (regression testing) |

Failure specimen: `b841e72d-3f19-4a8c-96e1-7d4c839af2b5` (constructed negative specimen; overall 64/100, delta -8 from truth target; river flattened to setting, dogs to decoration, Smokehouse Camp to generic setting, Leanna omitted, cultural/protocol gate absent).

---

## One-sentence Phase 0 instruction

> Phase 0 does not read the manuscript; it loads golden-record lessons and hands Phase 1A the rules required to build `pass1a_story_layer_v1`, including structural lanes, 8 required layers, symbolic/animal/environmental agency classification, source vocabulary checks, the cultural/protocol risk gate, and canon coverage verification before Phase 2 scoring.

---

*canon_correction_playbook_v1 — RevisionGrade Phase 0 Warmup Artifact*
*Version 1.0.0 — 2026-06-10*
*Phase 0 governance rules and `pass1a_story_layer_v1` contract only — no manuscript-specific content — safe to load on any evaluation job*
