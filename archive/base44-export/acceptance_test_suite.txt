# ACCEPTANCE TEST SUITE
**Release-Blocking Validation**

**Status:** Approved  
**Version:** 1.0  
**Date:** 2026-01-04  
**Authority:** RevisionGrade Quality Standard

---

## Purpose

This document defines the complete set of acceptance tests that **MUST PASS** before any release affecting confidence scoring, release gates, or governance layers.

**No exceptions.**  
**No "mostly working."**  
**100% pass rate or release blocked.**

---

## Test Categories

### A. Determinism Tests
### B. Evidence Presence Tests
### C. Consistency Tests
### D. Penalty Tests
### E. Formula Correctness Tests
### F. Release Gate Tests

---

## A. DETERMINISM TESTS

### Test A1: Same Input → Same Confidence

**Objective:** Validate deterministic behavior

**Setup:**
- Fixed manuscript snapshot (ID + version)
- Fixed claim extraction
- Fixed genre profile

**Procedure:**
1. Run `computeConfidence()` 10 times
2. Compare all outputs

**Pass Criteria:**
- Every `confidencePct` identical
- Every `band` identical
- Every `requiresAuthorAcceptance` identical
- Every `reasons` array identical (order-independent)

**Evidence Required:**
- Test log showing 10 identical outputs
- Timestamp confirmation (all runs within 1 minute)

---

### Test A2: Versioned Inputs Change Outputs Only When Expected

**Objective:** Validate version isolation

**Setup:**
- Manuscript version V1 and V2 (no text change)
- Same evaluation logic

**Procedure:**
1. Evaluate V1
2. Evaluate V2
3. Compare results

**Pass Criteria:**
- Results identical (version ID doesn't affect confidence)

**Evidence Required:**
- Side-by-side result comparison
- Confirmation: text unchanged between versions

---

## B. EVIDENCE PRESENCE TESTS

### Test B1: No Spans → E=0

**Objective:** Validate missing evidence detection

**Setup:**
- Claim with `textSpans = []`

**Procedure:**
1. Run `scoreEvidencePresence(claim)`

**Pass Criteria:**
- E == 0.0
- `confidencePct` very low (likely 0-20 depending on other dims)
- Reasons include: "No textual evidence spans provided."

**Evidence Required:**
- Function output log

---

### Test B2: Direct Quote/Action → E=1

**Objective:** Validate strong evidence recognition

**Setup:**
- Claim with at least one span marked `DIRECT_QUOTE` or `DIRECT_ACTION`

**Procedure:**
1. Run `scoreEvidencePresence(claim)`

**Pass Criteria:**
- E == 1.0
- Reasons include: "Direct textual evidence found"

**Evidence Required:**
- Function output log

---

### Test B3: Implied Evidence → E=0.5

**Objective:** Validate partial evidence scoring

**Setup:**
- Claim with strongest span marked `IMPLIED`

**Procedure:**
1. Run `scoreEvidencePresence(claim)`

**Pass Criteria:**
- E == 0.5
- Reasons include: "Evidence is implied"

**Evidence Required:**
- Function output log

---

## C. CONSISTENCY TESTS

### Test C1: No Contradictions/Drift → C=1

**Objective:** Validate clean consistency scoring

**Setup:**
- ManuscriptIndex returns: `contradictions=0`, `drift=0`

**Procedure:**
1. Run `scoreEvidenceConsistency(claim, manuscriptIndex)`

**Pass Criteria:**
- C == 1.0
- Reasons include: "No contradictions or drift detected."

**Evidence Required:**
- Function output log

---

### Test C2: Drift Only → C=0.5

**Objective:** Validate minor drift detection

**Setup:**
- ManuscriptIndex returns: `contradictions=0`, `drift>0`

**Procedure:**
1. Run `scoreEvidenceConsistency(claim, manuscriptIndex)`

**Pass Criteria:**
- C == 0.5
- Reasons include: "Minor drift detected"

**Evidence Required:**
- Function output log

---

### Test C3: Contradiction Present → C=0

**Objective:** Validate contradiction detection

**Setup:**
- ManuscriptIndex returns: `contradictions>0`

**Procedure:**
1. Run `scoreEvidenceConsistency(claim, manuscriptIndex)`

**Pass Criteria:**
- C == 0.0
- Reasons include: "Conflicting evidence detected"

**Evidence Required:**
- Function output log

---

## D. PENALTY TESTS

### Test D1: No Flags → A=0, I=0

**Objective:** Validate clean claim (no penalties)

**Setup:**
- Claim has no `AMBIGUOUS` or `INFERRED` flags

**Procedure:**
1. Run `scoreAmbiguityPenalty(claim)` and `scoreInferencePenalty(claim)`

**Pass Criteria:**
- A == 0.0
- I == 0.0

**Evidence Required:**
- Function output logs

---

### Test D2: High Ambiguity → A=1

**Objective:** Validate maximum ambiguity penalty

**Setup:**
- Claim flagged `AMBIGUOUS`
- `quantifyAmbiguity(claim)` returns `HIGH`

**Procedure:**
1. Run `scoreAmbiguityPenalty(claim)`

**Pass Criteria:**
- A == 1.0
- Reasons include: "High ambiguity present."

**Evidence Required:**
- Function output log

---

### Test D3: High Inference → I=1

**Objective:** Validate maximum inference penalty

**Setup:**
- Claim flagged `INFERRED`
- `quantifyInference(claim)` returns `HIGH`

**Procedure:**
1. Run `scoreInferencePenalty(claim)`

**Pass Criteria:**
- I == 1.0
- Reasons include: "Heavy inference required."

**Evidence Required:**
- Function output log

---

## E. FORMULA CORRECTNESS TESTS

### Test E1: Known Numeric Outcome

**Objective:** Validate formula implementation

**Setup:**
Force dimensions:
- E=1, C=1, S=1, A=0.5, I=0.0

**Expected Calculation:**
```
raw = (1+1+1)/3 = 1.0
pen = (0.5+0)/2 = 0.25
confidence = 1.0 * (1-0.25) = 0.75 => 75%
band = LOW (since 75% < 80%)
```

**Pass Criteria:**
- `confidencePct == 75`
- `band == LOW`
- `requiresAuthorAcceptance == true`

**Evidence Required:**
- Function output log
- Manual calculation confirmation

---

### Test E2: Band Boundary Test (95%)

**Objective:** Validate HIGH band threshold

**Setup:**
Construct dimensions to yield exactly 0.95 (95%)

**Pass Criteria:**
- `confidencePct == 95`
- `band == HIGH`
- `requiresAuthorAcceptance == false`

**Evidence Required:**
- Function output log

---

### Test E3: Band Boundary Test (80%)

**Objective:** Validate MEDIUM band threshold

**Setup:**
Construct dimensions to yield exactly 0.80 (80%)

**Pass Criteria:**
- `confidencePct == 80`
- `band == MEDIUM`
- `requiresAuthorAcceptance == true`

**Evidence Required:**
- Function output log

---

### Test E4: Band Boundary Test (79%)

**Objective:** Validate LOW band threshold

**Setup:**
Construct dimensions to yield exactly 0.79 (79%)

**Pass Criteria:**
- `confidencePct == 79`
- `band == LOW`
- `requiresAuthorAcceptance == true`

**Evidence Required:**
- Function output log

---

## F. RELEASE GATE TESTS

### Test F1: Missing Confidence Blocks Release

**Objective:** Validate hard gate enforcement

**Setup:**
- Output bundle with at least one claim without confidence metadata

**Procedure:**
1. Call `canRelease(outputBundle)`

**Pass Criteria:**
- Returns `(false, "BLOCKED: Missing confidence metadata.")`
- Export attempt blocked at API level

**Evidence Required:**
- API response (403 Forbidden)
- Gate function output log

---

### Test F2: Below-Threshold Readiness-Critical Blocks Release

**Objective:** Validate threshold enforcement

**Setup:**
- Readiness-critical claim at 94% confidence
- No acceptance decision on file

**Procedure:**
1. Call `canRelease(outputBundle)`

**Pass Criteria:**
- Returns `(false, "BLOCKED: Below-threshold readiness-critical claim...")`
- Export attempt blocked

**Evidence Required:**
- API response (403 Forbidden)
- Gate function output log

---

### Test F3: Below-Threshold + Explicit Acceptance → Conditional Release

**Objective:** Validate acceptance bypass (with labeling)

**Setup:**
- Readiness-critical claim at 85% confidence
- Valid `AcceptanceDecision` on file (decision='accepted')

**Procedure:**
1. Call `canRelease(outputBundle)`

**Pass Criteria:**
- Returns `(true, "OK")`
- Output labeled **"Conditionally Ready"** (NOT "Ready")
- Acceptance decision referenced in output metadata

**Evidence Required:**
- API response (200 OK with conditional label)
- Output metadata showing acceptance linkage

---

### Test F4: No Admin Bypass

**Objective:** Validate no privilege escalation

**Setup:**
- Admin user authenticated
- Below-threshold output without acceptance

**Procedure:**
1. Attempt export as admin

**Pass Criteria:**
- Blocked identically to non-admin user
- No special override path available

**Evidence Required:**
- API response (403 Forbidden)
- Audit log showing admin attempt was blocked

---

### Test F5: Direct API Call Blocked

**Objective:** Validate gate enforcement at all layers

**Setup:**
- Below-threshold output
- Directly call export API (bypass UI)

**Procedure:**
1. POST to `/api/export/...` with manuscript ID

**Pass Criteria:**
- Request blocked with 403
- Gate check executed before export logic

**Evidence Required:**
- API response
- Backend logs showing gate check ran

---

## G. GOLD-SUITE INTEGRATION TESTS

### Test G1: Gold Manuscript Regression

**Objective:** Validate no accuracy degradation

**Setup:**
- Gold-standard manuscript set (20 manuscripts minimum)
- Known truth set

**Procedure:**
1. Run evaluation on all gold manuscripts
2. Compare to truth set
3. Compute accuracy

**Pass Criteria:**
- Accuracy ≥92%
- No new false certainty (high-confidence errors)
- Confidence drift <5%

**Evidence Required:**
- Calibration report
- Pass/fail per manuscript

---

### Test G2: Confidence Calibration

**Objective:** Validate confidence means what it claims

**Setup:**
- All gold manuscripts evaluated

**Procedure:**
1. Group claims by confidence band
2. Compute actual correctness per band

**Pass Criteria:**
- HIGH band (≥95%): actual correctness ≥95%
- MEDIUM band (80-94%): actual correctness 80-94%
- LOW band (<80%): no requirement (expected low)

**Evidence Required:**
- Calibration curve
- Band-by-band accuracy table

---

## H. TEST EXECUTION REQUIREMENTS

### Automation
- All tests A1-F5 **MUST** be automated
- Gold-suite tests (G1-G2) run on every release candidate

### CI Integration
- Tests run on every PR affecting:
  - Confidence scoring
  - Release gates
  - Evaluation logic

### Blocking Behavior
- **ANY failing test blocks merge**
- No manual override
- Must fix test or fix code

### Evidence Retention
- Test logs retained for 90 days
- Evidence attached to every release ticket

---

## I. TEST MAINTENANCE

### Test Review Cadence
- Quarterly review of test suite
- Add tests for any new incident classes

### Test Version Control
- Tests versioned with evaluation logic
- Breaking test changes require governance approval

---

**Authority:** RevisionGrade Quality Standard  
**Binding Status:** Release-Blocking  
**Implementation Owner:** Base44  
**Test Definition Owner:** RevisionGrade  
**Review Cycle:** Quarterly