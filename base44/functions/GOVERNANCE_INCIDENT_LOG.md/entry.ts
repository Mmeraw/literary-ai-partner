# GOVERNANCE INCIDENT LOG
**Purpose:** Track all canonical violations, integrity failures, and governance fixes  
**Status:** ACTIVE  
**Last Updated:** 2026-01-10

---

## INCIDENT #001: Flash Fiction MDM Matrix Bug
**Date Reported:** 2026-01-10  
**Sentry Issue:** 26f9ad35  
**Severity:** CRITICAL  
**Status:** FIXED ✅

### Root Cause Analysis
The MDM matrix for `flashFictionMicro` in `validateWorkTypeMatrix.js` was missing N/A criteria definitions, causing:
- **Expected Behavior:** 5-6 criteria scored, 7-8 criteria marked N/A for micro samples (≤500 words)
- **Actual Behavior:** All 13 criteria marked as R/O, LLM scored only 5, leaving 8 unscored and unmarked
- **Integrity Violation:** `na_criteria: []` (empty) when should contain ~7 items
- **Postflight Gate:** Correctly blocked with `SCORED_COUNT_MISMATCH` (expected 13, got 5)
- **User Impact:** No evaluation output displayed for Huhu flash fiction submissions

### Evidence (Sentry Breadcrumbs)
```
expected_scored: 13
scored_count: 5
na_criteria: []
work_type: flashFictionMicro
failures: ["SCORED_COUNT_MISMATCH", "CRAFT_SCORE_DENOMINATOR_SUSPECT"]
```

### Canonical Violation
- **Rule Violated:** MDM Rule M1 (Full Coverage) + Sample Scope Enforcement Canon v1.0.0
- **Component:** `validateWorkTypeMatrix.js` lines 80-87
- **Before State:**
  ```javascript
  "flashFictionMicro": {
      "family": "Prose Fiction", // WRONG - should be "micro"
      "criteria": {
          "pacing": "R",        // WRONG - should be "NA"
          "worldbuilding": "O", // WRONG - should be "NA"
          "stakes": "R",        // WRONG - should be "NA"
          "marketFit": "O",     // WRONG - should be "NA"
          "keepGoing": "R"      // WRONG - should be "NA"
      }
  }
  ```

### Fix Applied
**File:** `functions/validateWorkTypeMatrix.js` lines 80-87  
**After State:**
```javascript
"flashFictionMicro": {
    "family": "micro", // FIXED - enables Sample Scope Enforcement trigger
    "criteria": {
        "hook": "R",           // ✓ Hook assessment valid for flash
        "voice": "R",          // ✓ Voice is critical in flash fiction
        "character": "C",      // ✓ Conditional (requires 200+ words + multiple characters)
        "conflict": "R",       // ✓ Conflict/tension assessable in flash
        "theme": "R",          // ✓ Theme central to flash fiction
        "pacing": "NA",        // ✓ N/A - pacing requires chapter-level structure
        "dialogue": "C",       // ✓ Conditional (requires dialogue detection)
        "worldbuilding": "NA", // ✓ N/A - no worldbuilding depth in <500 words
        "stakes": "NA",        // ✓ N/A - stakes require longer narrative arc
        "linePolish": "R",     // ✓ Line-level craft critical for flash
        "marketFit": "NA",     // ✓ N/A - market readiness not assessable from micro
        "keepGoing": "NA",     // ✓ N/A - momentum not meaningful in single-beat flash
        "technical": "R"       // ✓ Format/structure always assessed
    }
}
```

### Justification for N/A Criteria
1. **pacing (NA):** Flash fiction (≤500 words) is typically a single beat/moment. Pacing requires multi-scene structure.
2. **worldbuilding (NA):** Micro samples lack space for immersive worldbuilding detail. Setting is implied, not built.
3. **stakes (NA):** Stakes require setup, escalation, payoff. Flash fiction operates on implication, not stakes architecture.
4. **marketFit (NA):** Marketability assessment requires substantial sample (3000+ words). Micro excerpts don't signal genre/commercial fit.
5. **keepGoing (NA):** "Would they turn the page?" only applies to chapter endings. Flash fiction is a complete experience, not a momentum test.

### Conditional Criteria (C)
- **character (C):** Assessed if ≥200 words AND multiple characters detected
- **dialogue (C):** Assessed if quoted speech + attribution tags detected

### Test Validation (Required)
- [ ] Test flashFictionMicro 500-word sample
- [ ] Verify `na_criteria: [...]` contains 5 N/A items (pacing, worldbuilding, stakes, marketFit, keepGoing)
- [ ] Verify `scored_count: 6-8` (depends on dialogue/character conditionals)
- [ ] Verify `scored_count + na_count = 13`
- [ ] Verify postflight gate **passes** with no warnings

### Deployment Proof Required
- [ ] Provide deployment timestamp for `validateWorkTypeMatrix.js`
- [ ] Provide test result JSON from new evaluation
- [ ] Confirm Sentry Issue #26f9ad35 no longer reproduces

### Related Canon Documents
- `functions/_canon/INTEGRITY_GATE_SPEC_v1.0.0.md` (Integrity Gate contract)
- `functions/_canon/SAMPLE_SCOPE_CRITERIA_APPLICABILITY_CANON_v1.0.0.md` (Sample Scope rules)
- `functions/EVALUATE_ENTRY_CANON.md` (Evaluation entry contract)

---

## INCIDENT #002: [Template - Copy for New Incidents]
**Date Reported:**  
**Sentry Issue:**  
**Severity:**  
**Status:**  

### Root Cause Analysis

### Evidence

### Canonical Violation

### Fix Applied

### Test Validation

### Deployment Proof