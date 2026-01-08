# WORK TYPE POLICY ROUTING SPECIFICATION v1.0.0

**Status:** CANONICAL (Phase 1.5 Semantic Alignment)  
**Effective Date:** 2026-01-08  
**Supersedes:** Ad-hoc language generation in Phase 1/2  
**Authority:** Phase 1 Output Surface Governance  

---

## PURPOSE

This specification resolves the policy routing defect where short texts (e.g., 86-word micro-fiction) were correctly evaluated under `MICRO_POLICY` thresholds but incorrectly described using `MANUSCRIPT_POLICY` language (e.g., "8.0 readiness floor," "professional routing," "Agent-Reality Grade").

**Key Principle:** Once `workTypeUi` is determined, it is **authoritatively bound** to a specific policy family. All subsequent language, gates, score interpretation, and recommendation framing must align with that family's routing spec.

---

## POLICY FAMILIES

### 1. MICRO_POLICY
**Applies to:** Flash Fiction, Micro-Fiction, Poetry, Vignettes  
**Word Range:** 50-2000 words  
**Evaluation Focus:** Craft excellence, compression, moment impact  

**Routing Spec:**
- **No readiness floors** (not submission-ready; purely craft feedback)
- **No Phase 2 gates** (matrixPreflight blocks Phase 2 for micro)
- **No agent-reality language** ("submission-ready," "professional tier")
- **Allowed language:** "craft score," "compression," "moment quality"

**Forbidden Phrases:**
- "readiness floor"
- "professional routing"
- "Agent-Reality Grade"
- "submission-ready"
- "agent-viable"
- "Phase 2"
- "StoryGate eligible"

---

### 2. MANUSCRIPT_POLICY
**Applies to:** Novels, Novellas, Full-Length Manuscripts  
**Word Range:** 40,000+ words  
**Evaluation Focus:** Submission readiness, agent decision simulation  

**Routing Spec:**
- **8.0 readiness floor** (Phase 2 gate)
- **Coverage + Integrity gates**
- **Agent-Reality Grade** (simulates agent triage)
- **Allowed language:** "submission-ready," "professional tier," "market positioning"

**Forbidden Phrases (for non-manuscripts):**
- N/A (this is the default for full manuscripts)

---

### 3. SCREENPLAY_POLICY
**Applies to:** Screenplays, TV Scripts, Feature Films  
**Word Range:** Varies (10,000-30,000 typical)  
**Evaluation Focus:** Screen-specific craft, scene economy, visual storytelling  

**Routing Spec:**
- **6.5 readiness floor** (lower than manuscript; spec script focus)
- **Industry-specific language:** "spec-ready," "coverage-worthy," "reader pass"
- **Allowed language:** "visual clarity," "scene function," "screen craft"

**Forbidden Phrases:**
- "Agent-Reality Grade" (use "Reader Grade")
- "manuscript" (use "script")

---

### 4. NEUTRAL_POLICY
**Applies to:** Unclassified, Experimental, Non-standard formats  
**Word Range:** Any  
**Evaluation Focus:** Generic craft feedback without routing claims  

**Routing Spec:**
- **No gates**
- **No readiness claims**
- **Allowed language:** "craft analysis," "structural notes," "feedback"

**Forbidden Phrases:**
- "readiness floor"
- "submission-ready"
- "professional tier"

---

## BINDING SELECTOR LOGIC

### Input: `workTypeUi` (string)
**Examples:** `"Flash Fiction / Micro"`, `"Novel"`, `"Screenplay"`, `"Unclassified"`

### Binding Table:
```
workTypeUi → policyFamily

"Flash Fiction / Micro" → MICRO_POLICY
"Poetry" → MICRO_POLICY
"Vignette" → MICRO_POLICY
"Novel" → MANUSCRIPT_POLICY
"Novella" → MANUSCRIPT_POLICY
"Full-Length Manuscript" → MANUSCRIPT_POLICY
"Screenplay" → SCREENPLAY_POLICY
"TV Script" → SCREENPLAY_POLICY
"Feature Film" → SCREENPLAY_POLICY
"Unclassified" → NEUTRAL_POLICY
"Experimental" → NEUTRAL_POLICY
```

---

## ENFORCEMENT MECHANISM

### Phase 1: Binding at Evaluation Entry
1. `matrixPreflight` determines `workTypeUi` based on word count + heuristics
2. `workTypeUi` is passed to evaluation function
3. Evaluation function invokes `getPolicyFamily(workTypeUi)` → `policyFamily`
4. **All subsequent LLM prompts, copy blocks, and UI messaging MUST use `policyFamily` routing spec**

### Phase 2: Copy Block Routing
- Copy blocks are stored in `COPY_BLOCKS_{FAMILY}.md` (e.g., `COPY_BLOCKS_MICRO.md`)
- **No ad-hoc language generation**—all user-facing text comes from locked copy blocks
- Example:
  - `MICRO_POLICY` → Use `COPY_BLOCKS_MICRO.md` → "Craft Score: 8.5/10"
  - `MANUSCRIPT_POLICY` → Use `COPY_BLOCKS_MANUSCRIPT.md` → "Agent-Reality Grade: 85/100"

---

## REGRESSION TEST REQUIREMENT

**Test Case:** 86-word flash fiction input

**Expected Behavior:**
1. `matrixPreflight` → `workTypeUi = "Flash Fiction / Micro"`
2. Policy Routing → `policyFamily = MICRO_POLICY`
3. Evaluation output:
   - ✅ "Craft Score: 8.5/10"
   - ❌ "Agent-Reality Grade: 85/100" (VIOLATION)
   - ❌ "8.0 readiness floor" (VIOLATION)
   - ❌ "Phase 2 allowed" (VIOLATION)

**Pass Criteria:** No manuscript-specific language in output

---

## HARD CONSTRAINTS

1. **Deterministic Binding:** `workTypeUi` → `policyFamily` is a lookup table, not LLM-inferred
2. **No Cross-Contamination:** Micro-works cannot use manuscript routing language
3. **Locked Copy Blocks:** All user-facing messaging comes from canonical copy files
4. **Phase 1.5 Scope:** This is a semantic alignment fix, NOT a Phase 1 reopening

---

## IMPLEMENTATION CHECKLIST

- [ ] Create `getPolicyFamily(workTypeUi)` function
- [ ] Create `COPY_BLOCKS_MICRO.md` canonical copy
- [ ] Create `COPY_BLOCKS_MANUSCRIPT.md` canonical copy
- [ ] Update `evaluateQuickSubmission.js` to route via `policyFamily`
- [ ] Update `getEvaluationResultForUI.js` to enforce policy-specific messaging
- [ ] Write regression test: 86-word flash fiction → no manuscript language

---

**Sealed:** 2026-01-08  
**Canon Owner:** RevisionGrade Product Team  
**Change Protocol:** Requires Phase 2 governance review