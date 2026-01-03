# Dashboard & Analytics Jira Automation Rules
## Mechanical Reliability Enforcement

**Purpose:** Ensure Dashboard / Analytics reliability issues are never ignored, never silent, and never tribal-knowledge based.

**Scope:** Applies only to Dashboard (Overview) and Analytics Dashboard pages.

**Does NOT affect:** Governance Epics, release gates, or trust-signal surfaces.

---

## Automation Rule 1 — FUNCTION TEST #9 Failure Handling

**Trigger:**
- Issue created OR transitioned to status FAIL
- AND Field: Test Reference = "FUNCTION TEST #9"

**Conditions:**
- Issue Type = Bug
- Surface = Dashboard OR Analytics

**Actions:**

**Automatically:**
1. Set Priority = High
2. Add Label = trust-surface
3. Add Label = dashboard-reliability
4. Add Comment:
   ```
   This issue affects a customer trust surface (Dashboard / Analytics).
   Per Reliability Policy, silent failures are forbidden and must be resolved.
   ```
5. Assign to:
   - Base44 Engineering Lead (assignee)
   - QA Lead (watcher)

---

## Automation Rule 2 — Repeat Failure Escalation

**Trigger:**
- Bug updated

**Condition:**
- Same Surface (Dashboard or Analytics)
- Same Failure Category
- Count ≥ 3 issues in 7 days

**Actions:**

1. Add Label: reliability-escalation

2. Create linked issue:
   - Type: Task
   - Title: "Dashboard / Analytics Reliability Review"
   - Comment:
     ```
     Repeated failures detected on a trust surface.
     Reliability review required per policy.
     ```

---

## Automation Rule 3 — Resolution Verification

**Trigger:**
- Issue transitioned to Done

**Condition:**
- Test Reference = FUNCTION TEST #9

**Actions:**

1. Require fields:
   - Evidence Attached = YES
   - Re-test Status = PASS

2. If missing → block transition

3. Add Comment:
   ```
   FUNCTION TEST #9 re-run and evidence required for closure.
   ```

---

## Bug Ticket Template (Required for FUNCTION TEST #9 Failures)

**Ticket Type:** Bug  
**Priority:** High (Customer Trust Risk)  
**Surface:** Dashboard / Analytics  
**Policy Reference:** Dashboard & Analytics Reliability Policy  
**Test Reference:** FUNCTION TEST #9

### Summary
Dashboard / Analytics reliability failure detected during FUNCTION TEST #9.

### Failure Category (Select All That Apply)
- [ ] Data freshness violation
- [ ] Missing / stale timestamp
- [ ] Silent failure
- [ ] Infinite loading state
- [ ] Incorrect or inconsistent metrics
- [ ] Partial failure breaks page
- [ ] Error not user-visible
- [ ] Trust signal degradation

### Evidence (Required)
- Screenshot(s): _______________
- Timestamp observed: _______________
- Expected vs actual behavior: _______________
- Browser / environment: _______________
- Date & time of observation: _______________

### Reproduction Steps
1. Navigate to: [URL]
2. Perform: [action]
3. Observe: [failure]

### Expected Behavior
Per Dashboard & Analytics Reliability Policy:
- Explicit freshness
- Deterministic state
- User-visible error or warning
- No silent failures

### Actual Behavior
[Describe exactly what the user sees]

### Impact Assessment
- [ ] Cosmetic
- [ ] Confusing
- [ ] Trust-damaging
- [ ] Customer-visible credibility risk

### Recurrence Tracking
First occurrence? [ ] Yes [ ] No  
Count in last 7 days: [#]

⚠️ If ≥3 occurrences → escalate to reliability review

### Notes
This is not a governance incident.  
This is a product credibility defect.

### Done When
- [ ] Issue resolved
- [ ] FUNCTION TEST #9 re-run
- [ ] PASS recorded
- [ ] Evidence attached

---

## Enforcement Boundary

These automation rules are:
- ✅ Mandatory for Dashboard / Analytics bugs
- ✅ Enforced via Jira automation
- ❌ Not governance incidents
- ❌ Not release-blocking
- ❌ Not Phase-0 gated

But violations must be fixed to maintain product credibility.