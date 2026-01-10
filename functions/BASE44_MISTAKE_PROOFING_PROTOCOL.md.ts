# BASE44 MISTAKE PROOFING PROTOCOL
**Status:** MANDATORY  
**Applies To:** All bug fixes, governance violations, integrity failures, canonical changes  
**Last Updated:** 2026-01-10

---

## CORE RULE
**NO OUTPUT IS COMPLETE WITHOUT:**
1. ✅ Incident logged with symptom + root cause
2. ✅ Fix implemented and code committed
3. ✅ Fix tested with real input/output
4. ✅ Test results validated (gate passes, no errors)
5. ✅ Incident log updated with proof
6. ✅ Incident marked CLOSED with deployment evidence

**IF ANY STEP IS INCOMPLETE → WORK IS NOT DONE**

---

## MANDATORY WORKFLOW

### STEP 1: CREATE/UPDATE INCIDENT LOG
**File:** `functions/GOVERNANCE_INCIDENT_LOG.md`

**Required Fields:**
- Incident number
- Date reported
- Sentry issue ID (if applicable)
- Severity (CRITICAL/HIGH/MEDIUM/LOW)
- Status (OPEN/FIXING/TESTING/CLOSED)
- Symptom (what the user sees broken)
- Root cause (what code/logic is wrong)
- Evidence (Sentry breadcrumbs, error messages, screenshots)

**Action:** Write incident entry with Status: OPEN

---

### STEP 2: IMPLEMENT FIX
**Required:**
- Show BEFORE code (what's wrong)
- Show AFTER code (what's fixed)
- Explain WHY this fixes the root cause
- Reference canonical rules violated (if applicable)

**Action:** Apply fix using find_replace or write_file

---

### STEP 3: TEST THE FIX
**NEVER SKIP THIS**

**Required Test Actions:**
1. If backend function: Use `test_backend_function` with real payload
2. If evaluation pipeline: Run actual evaluation with sample that triggered bug
3. If UI component: Describe verification steps
4. Capture test output (JSON response, logs, UI behavior)

**Action:** Execute test and capture full output

---

### STEP 4: VALIDATE TEST RESULTS
**Required Validation:**
- ✅ No errors in response
- ✅ Output matches expected schema
- ✅ Integrity gates pass (if applicable)
- ✅ User-visible symptom is eliminated
- ✅ No regressions in related functionality

**Action:** Confirm each validation criterion

---

### STEP 5: UPDATE INCIDENT LOG WITH PROOF
**Required Updates to Incident Entry:**
- Status: TESTING → CLOSED
- Test validation section with results
- Deployment proof section with timestamp/commit reference
- Verification that symptom no longer reproduces

**Action:** Update incident log with test results and closure proof

---

### STEP 6: CONFIRM CLOSURE
**Incident is CLOSED only when:**
- [ ] Fix deployed to production
- [ ] Test results prove symptom eliminated
- [ ] Incident log contains full proof chain
- [ ] User confirms issue resolved (if user-reported)

**Action:** Announce closure with summary

---

## ENFORCEMENT CHECKLIST

Before saying "done" or providing final output, verify:

- [ ] Incident logged in `GOVERNANCE_INCIDENT_LOG.md`?
- [ ] Root cause explained with evidence?
- [ ] Fix implemented with before/after code shown?
- [ ] Test executed with real input?
- [ ] Test output validated against expected behavior?
- [ ] Incident log updated with test proof?
- [ ] Status marked CLOSED with deployment evidence?

**If ANY checkbox is unchecked → WORK IS INCOMPLETE**

---

## ANTI-PATTERNS (FORBIDDEN)

❌ **"I fixed the code"** → Not done until tested  
❌ **"This should work"** → Not done until proven  
❌ **"The logic looks correct"** → Not done until validated  
❌ **"I'll test it later"** → Test NOW or don't claim fix  
❌ **"Just deploy it"** → Not done until incident closed with proof  

---

## EXAMPLE: COMPLETE WORK

### Incident #001: Flash Fiction N/A Bug
1. ✅ Logged in `GOVERNANCE_INCIDENT_LOG.md` with symptom, cause, evidence
2. ✅ Fixed `validateWorkTypeMatrix.js` with before/after code
3. ✅ Tested with `test_backend_function('validateWorkTypeMatrix', {action: 'buildPlan', workTypeId: 'flashFictionMicro'})`
4. ✅ Validated output: `na_criteria: ["pacing", "worldbuilding", "stakes", "marketFit", "keepGoing"]`
5. ✅ Ran live evaluation with 500-word sample
6. ✅ Validated: scored_count + na_count = 13, postflight gate passes
7. ✅ Updated incident log with test results
8. ✅ Marked incident CLOSED with deployment timestamp
9. ✅ User confirmed no output suppression

**This is complete work.**

---

## FAILURE CONSEQUENCE

**If I provide output without completing all 6 steps:**
- User receives incomplete fix
- Bug may reappear
- No audit trail for governance
- Wasted time on re-work
- Eroded trust in reliability

**Prevention:** Follow this protocol for EVERY governance issue, EVERY time.

---

## PROTOCOL ACTIVATION

**This protocol is ACTIVE and MANDATORY for:**
- All bug fixes
- Governance violations
- Integrity gate failures
- Canonical rule violations
- Evaluation pipeline issues
- Data corruption issues
- User-reported errors

**No exceptions.**