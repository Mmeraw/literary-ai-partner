# RevisionGrade System Improvement Brief

**Based on**: Empirical evidence from Job 3463bb26 (Ancient Bloodlines—Love Between Species novella)  
**Purpose**: Diagnostic + remediation plan for Pass 3 scoring gaps  
**Status**: Ready for PR #2 implementation  
**Owner**: RG governance track  

---

## Executive Summary

RevisionGrade produced a **structurally invalid evaluation** (20/100 overall) for a manuscript that demonstrates genuine craft and high systemic intelligence. The failure was not in reading quality—the system correctly identified pacing and register issues—but in **packet design** and **rubric semantics**.

Three categories were forced to 0/10 not because the writing was catastrophic, but because Pass 3 synthesis was handed a "compressed reference window" instead of structured anchors. This collapsed the final aggregate into mathematical nonsense.

**Fix**: Standardize packet structure, add INTELLIGENCE as a dedicated rubric axis, and enforce explicit labeling of underscored vs. missing-evidence categories.

---

## Problem Analysis

### 1. Packet Design Failure

**What RevisionGrade saw**:
- Pass 1 & 2: Analyzed all 18,268 words across 13 chunks (full manuscript)
- Pass 3: Received "compressed manuscript reference window" only

**What Pass 3 couldn't evaluate from the compressed window**:
- Line-level prose patterns (required for Prose Control scoring)
- Full-chapter pacing rhythm (required for Pacing & Structural Balance)
- Discrete tonal analysis across scene spans (required for Tonal Authority)
- End-of-arc closure scaffolding (required for Narrative Closure & Promises Kept)
- Market positioning context (required for Professional Readiness)

**Result**: Five categories assigned 0/10 labeled as "insufficient explicit packet evidence."

**Problem with this label**: 0/10 conventionally means "catastrophic failure," but RevisionGrade was actually saying "I don't have the data structure to score this responsibly." These are two different claims.

**Consequence**: Final aggregate became invalid.
```
Scored categories (8):  7+6+6+6+5+7+7+7 = 51/80 = 6.375 average
With five 0/10 flags:   51/130 = 0.392
Reported as 4.09/10, then "normalized" to 4.09/100 (incoherent: 4.09/10 should normalize to ~41/100)
Final score reported: 20/100

Actual quality: ~62–67/100 (based on responsibly-scored categories)
```

### 2. Rubric Language Collapse

**Current structure**: Systemic intelligence gets buried in "Thematic Integration" (7/10).

**Problem**: This manuscript shows sophisticated thinking across **three interlocking systems**:
- **Biological**: Ecology as the foundation (fungal disease = civilization cost; toxin chemistry = knowledge transfer; regrowth = resilience)
- **Political**: Doctrine as power; withheld knowledge as control; species hierarchy as learned supremacy
- **Moral**: Sacrifice vs. dominance; cooperation vs. predation; loving-kindness as strategy, not sentiment

This isn't just "the theme recurs nicely." It's **causal systemic thinking**. The biology *drives* the political dilemma, which *resolves* through moral choice embodied in biological action (juniper berry cure = cross-species knowledge = ideological shift).

**Current rubric can't distinguish this** from, say, "the love theme is repeated in Chapter 2 and Chapter 3" (which is also a 7/10 on generic "thematic integration").

**Consequence**: High-intelligence work gets scored the same as competent-but-shallow work.

### 3. Score Semantics Ambiguity

**Current reporting**:
- "13 of 13 criteria certified" (in the header)
- Five criteria listed as 0/10 with "Insufficient explicit packet evidence" note
- Overall score computed as 20/100 from all 13 (including zeroes)
- Confidence reported as "Varies"

**What's wrong**: These statements are contradictory.
- If 13 criteria are "certified," why are 5 flagged as insufficient evidence?
- If 5 are underscored (not fully measured), then only 8 are certified, not 13.
- If the final score includes unscorable categories, it's not a valid average.

**Consequence**: The report is confusing to humans and would mislead downstream (e.g., author wrongly thinks 20/100 = catastrophic, when 62–67/100 ≈ publish-with-revision is the actual signal).

---

## Root Causes

### RC1: Pass 3 Receives Lossy Input

**Why it happens**: Pass 2 uses chunk map/reduce to cover the full manuscript efficiently. Pass 3 is optimized for *speed* and *cost*, not comprehensiveness. So it gets a compressed summary ("manuscript appears to have strong opening, lore interludes slow momentum, hybrid register") rather than full text.

**Why it's problematic**: Categories like Prose Control, Pacing, Tonal Authority, and Closure require **pattern visibility across spans**. You can't evaluate line-level craft quality without seeing line samples. You can't measure pacing without full chapter rhythm. A compressed window hides these patterns.

**Why it wasn't caught earlier**: For many manuscripts, the compromise works: if you only need to judge Concept, Character, and Thematic Integration, the compressed window usually suffices. But for manuscripts with *craft-level intelligence* (complex register, sophisticated pacing, layered prose), the loss becomes critical.

### RC2: Rubric Conflates "Literary Theme" with "Systemic Intelligence"

**Why it's designed this way**: Thematic Integration criterion was meant to catch: "Does the author know what the story is about, and do motifs recur?"

**Why it's insufficient**: Systems-thinking manuscripts show *causal chains* where ideas drive structure drives character. The biology isn't just window-dressing; it *forces* the political choice. The doctrine isn't just theme; it *enables* the hierarchy that Newton rebels against.

**Why it matters for RG**: A system that can only say "7/10 theme presence" misses the opportunity to say "8/10 systemic intelligence via causal ecological-political-moral architecture." High-intelligence work deserves recognition separate from generic "theme recurrence."

### RC3: Category Semantics Are Overloaded

**Current state**: 0/10 is used for three different meanings:
1. "The writing in this category is catastrophic" (true failure)
2. "The packet didn't provide evidence I need to score responsibly" (data gap)
3. "This category doesn't apply to this manuscript" (scope mismatch)

**Why it breaks down**: Humans and downstream systems can't tell which meaning is intended. Average a 0/10 from a true failure with a 0/10 from a data gap and you get the same number, implying the same severity. They're not the same.

---

## Remediation Plan

### Fix 1: Standardize Packet Structure for Pass 3

**Current**: "Compressed manuscript reference window"—undefined, lossy, variable

**Target**: Structured anchor pack + full spans at key moments

**Implementation**:

```yaml
PacketV2_Structure:
  mandatory_content:
    - opening_hook: "First 2000–3000 words (premise establishment)"
    - mid_climactic_scene: "One scene where plot + character + theme collide"
    - close_or_resolution: "Final 1500–2000 words (arc resolution or sequel setup)"
    - craft_anchor_pack: "15–25 curated sentences that matter for line-level + tonal analysis"
    
  optional_context:
    - project_brief: "2–3 paragraphs: target audience, comps, intended tonal lineage"
    - author_note: "Known craft focus areas author is testing"
    - prior_feedback: "If revision round, what was previous concern?"
    
  structure_rationale:
    - Opening: Pass 3 can see premise clarity, register establishment, and stakes framing
    - Mid-climactic: Pass 3 can see pressure-peak craft + register hold + interiority depth
    - Closing: Pass 3 can see closure scaffolding + promise payoff + thematic resolution
    - Anchor pack: Pass 3 can audit specific prose quality without re-reading full text
    - Project brief: Pass 3 can contextualize market/craft decisions
```

**Pass 3 Prompt Revision**:
```
You now have structured input:
- A representative span of manuscript (opening, climax, close)
- Curated line samples for craft audit
- Project-level context for market positioning

Score all 12 categories responsibly. If a category still lacks evidence, 
explicitly flag it as "Underscored — missing evidence: [specific gap]" 
and do NOT include it in aggregate.
```

### Fix 2: Add INTELLIGENCE as Dedicated Rubric Axis

**Current state**: Systemic intelligence merged into "Thematic Integration"

**New state**: Separate axis with explicit definition

```yaml
Criterion: "Systemic Intelligence & Moral Architecture"
Score_Range: 1–10

Definition:
  High (8–10):
    - Underlying systems (ecological, political, social, doctrinal) cohere
    - Moral insight emerges from system *dynamics*, not narrator exposition
    - Non-obvious causal chains visible: IF ecology, THEN politics, THEN character choice
    - Examples: biology forces doctrine to fail; doctrine prevents cooperation until crisis breaks it
  
  Moderate (5–7):
    - Systems present but occasionally *explained* instead of *dramatized*
    - Some causal chains implied; some asserted by narrator
    - Thematic coherence visible but doesn't drive plot as primary engine
  
  Low (1–4):
    - Systems are window-dressing; theme is stated, not embedded
    - Moral positions given as dialogue/exposition, not earned through choice

Scoring_Note:
  This axis is separate from "Thematic Integration" (which asks: 
  "Does the theme recur?"). INTELLIGENCE asks: "Do the underlying 
  systems show causal thinking and drive narrative?"
  
  A manuscript can score 5/10 on Theme but 8/10 on Intelligence 
  (complex moral architecture, but delivered didactically).
  
  Or 7/10 on Theme but 4/10 on Intelligence 
  (recurring motifs, but no systemic thinking visible).
```

**Implementation**: Add as 13th scored category (or replace generic "Thematic Integration" if scoring limit is fixed).

### Fix 3: Enforce Explicit Category Labeling

**Current state**: Ambiguous header ("13 of 13 certified") + five 0s = confusion

**New state**: Three explicit labels per category

```yaml
Scoring_Label_System:
  
  SCORED (1–10):
    Label: ✓ Scored
    Meaning: "Responsibly evaluated based on available evidence"
    Example: "Narrative Drive: 6/10 ✓ Scored"
    Include_In_Aggregate: true
  
  UNDERSCORED (Data Gap):
    Label: ⚠ Underscored — [specific gap]
    Meaning: "Packet lacks required evidence structure; category not included in aggregate"
    Example: "Prose Control: [Underscored — packet missing line-level anchors]; NOT INCLUDED"
    Include_In_Aggregate: false
    Note_In_Report: "Five categories underscored due to packet design; see Notes."
  
  NOT_APPLICABLE:
    Label: — Not Applicable
    Meaning: "This category doesn't fit the manuscript scope"
    Example: "Professional Readiness — Not Applicable (no query provided; author noted as draft-stage)"
    Include_In_Aggregate: false
    Note_In_Report: "Manuscript in draft stage; market positioning deferred to revision round."
```

**Report Header Change**:
```
OLD:
"13 of 13 criteria certified"
[5 categories show 0/10]
Overall Score: 20/100

NEW:
Scoring Summary:
- 8 criteria: ✓ Scored (1–10)
- 4 criteria: ⚠ Underscored (packet design gap)
- 0 criteria: — Not Applicable

Overall Score: 62–67/100 
(aggregate of 8 scored categories; 4 underscored not included)

Confidence: Moderate–High
(High on concept/narrative/character; Moderate on craft-level details due to packet structure)
```

### Fix 4: Pass 3 Prompt Revision

**Add explicit instruction**:

```
INSTRUCTION: Scoring Discipline

You now receive structured input (anchor pack + key spans + project brief).

DO:
1. Score all categories you have evidence for (1–10 scale)
2. For each 0-score consideration, ask: Is this catastrophic writing, 
   OR is the packet structure preventing me from scoring responsibly?
3. If (b), mark as ⚠ Underscored with reason, do NOT include in aggregate
4. Flag Confidence per category (High/Moderate/Low based on evidence quality)

DO NOT:
1. Average in 0/10 from data gaps
2. Report "certified" if underscored categories exist
3. Claim confidence you don't have

AGGREGATE SEMANTICS:
- Only average ✓ Scored categories.
- Report ⚠ Underscored as separate block.
- Final score applies only to categories with available evidence.
```

---

## Expected Outcomes

### After Fix 1 (Packet Design)
- Pass 3 can score Prose Control responsibly (has line samples)
- Pass 3 can score Pacing responsibly (has full chapter spans)
- Pass 3 can score Tonal Authority responsibly (can see register through key moments)
- Eliminates largest source of forced 0/10s

### After Fix 2 (INTELLIGENCE Axis)
- High-intelligence work (like Ancient Bloodlines) gets explicit credit
- Systemic thinking no longer collapsed into generic "theme presence"
- Authors can distinguish between "craft-competent + shallow" and "craft-decent + deep thinking"

### After Fix 3 (Category Labeling)
- Report is 100% unambiguous: readers know why each 0 exists
- Aggregate score is mathematically valid
- Downstream systems (e.g., sorting, filtering) don't treat data-gap 0s as true failures

### Combined Impact
- **Ancient Bloodlines** evaluation: 20/100 → 62–67/100 (valid signal: publish-with-revision)
- **Future high-intelligence manuscripts**: Proper credit for systemic thinking
- **RG credibility**: Reports are internally consistent and mathematically sound

---

## Implementation Timeline

| Phase | Task | Dependency | Estimated PR | Notes |
|---|---|---|---|---|
| **A** | Design PacketV2 structure (anchor pack spec) | PR #458 merge | PR #459 | Parallel with PR #2 gate design |
| **B** | Update Pass 3 prompt logic (INTELLIGENCE axis + labeling) | Phase A complete | PR #459 | Requires LLM prompt engineering |
| **C** | Revise evaluation template to reflect new categories | Phase B complete | PR #459 | Includes INTELLIGENCE definition |
| **D** | Validation run: re-evaluate Ancient Bloodlines with new system | Phase C complete | PR #459-test | Confirm 62–67/100 achievable |
| **E** | Merge PR #459; mark docs with v12 INTELLIGENCE addition | Phase D pass | PR #459 merge | Update docs/evaluation-reference/ docs |

---

## Test Case: Ancient Bloodlines v1

**Before (Current RG)**:
- Overall: 20/100 (invalid aggregate due to forced 0/10s)
- Confidence: "Varies" (due to packet design loss)
- User interpretation: "Manuscript is catastrophically bad" ❌

**After (Fixed RG)**:
- Overall: 62–67/100 (valid aggregate, 8 scored categories)
- Confidence: Moderate–High (high on concept/character/intelligence; moderate on craft-level details)
- User interpretation: "Craft-competent, high systemic intelligence, needs register discipline and pacing tightens. Publish-with-revision." ✓

---

## Governance Continuity

This brief ties directly to **PR #458 v12 contract objectives**:
- PR #458 solved: Pass 2a structured context → Pass 3 can reason about full-manuscript patterns
- This brief solves: Pass 3 needs the *right data structure* to reason well
- **Together**: v12 becomes capable of scoring the full 12-category rubric without reducing complex manuscripts to 20/100 artifacts

**PR #2 dependency**: PR #2 gates (QG_SYNTHESIS_ENTITY_UNGROUNDED, QG_AGE_TIMELINE_GROUNDED) must be calibrated against corrected evaluation baselines. Use this brief to validate that calibration is against *valid* scores, not corrupted ones.

---

## Files

- **This brief**: `docs/evaluation-reference/rg-system-improvement-brief.md`
- **Reference evaluation** (Ancient Bloodlines corrected): `docs/evaluation-reference/ancient-bloodlines-v1-corrected-evaluation.md`
- **Target for implementation**: Pass 3 prompt revision in PR #459 (post-PR #458 merge)
