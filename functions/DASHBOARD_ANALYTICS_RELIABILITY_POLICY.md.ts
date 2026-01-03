# Dashboard & Analytics Reliability Policy
## One-Page, Binding, Non-Governance

**Applies To:** Dashboard (Overview), Analytics  
**Owner:** Base44 Engineering + QA  
**Status:** Mandatory Reliability Policy (Non-Release-Blocking)

---

## 1. Purpose

Dashboard and Analytics are trust surfaces.  
Even when core governance is perfect, broken or misleading dashboards destroy customer confidence.

This policy ensures Dashboard & Analytics behave like a world-class product, not a demo.

---

## 2. Scope

**This policy applies to:**
- Dashboard → Overview
- Dashboard → Analytics

**It does NOT apply to:**
- Evaluation, Outputs, Storygate, Industry (covered by governance Epics)
- Static pages (FAQ, Methodology)

---

## 3. Reliability Standards (Required)

### 3.1 Data Freshness
- Dashboard must show "Last updated at" timestamp
- Freshness thresholds:
  - Dashboard: ≤ 5 minutes
  - Analytics: ≤ 15 minutes
- Stale data must display an explicit warning
- ❌ Silent staleness is forbidden

### 3.2 Data Integrity
- Metrics must reconcile with underlying audit/events
- No inferred, guessed, or placeholder numbers
- No unexplained discrepancies between Dashboard and Analytics

### 3.3 Loading & Error States
- Deterministic loading state
- Explicit empty state when no data exists
- Explicit error state when data unavailable
- No infinite spinners
- No disappearing UI

### 3.4 Partial Failure Handling
- One failed metric must not break the page
- Failed panels show error; others continue to render

### 3.5 User Trust Signals
- No flickering numbers
- No contradictory panels
- No unexplained resets or drops

---

## 4. QA Enforcement

**FUNCTION TEST #9 — Required**

Executed:
- Pre-release
- After analytics/data changes
- After incidents

Mode: Observational only (no code changes)

Results Classification:
- **PASS** → no action
- **FAIL** → bug ticket required
- Repeat FAIL (3× in 7 days) → reliability escalation

---

## 5. Monitoring (Lightweight, Mandatory)

Synthetic checks must exist for:
- Dashboard freshness (5 min)
- Analytics freshness (15 min)
- Sample reconciliation (hourly)
- Error visibility (continuous)

Alerts:
- Notify Engineering + QA
- Do not block release
- Must generate a ticket

---

## 6. Enforcement Boundary

This policy is:
- ✅ Mandatory
- ❌ Not governance
- ❌ Not Phase-0 gated
- ❌ Not release-blocking

But violations must be fixed.

---

## 7. Why This Exists

Customers forgive missing features.  
They do not forgive dashboards that lie, stall, or look broken.

This policy protects:
- Trust
- Retention
- Brand credibility

---

## 8. Related Documents

- `DASHBOARD_ANALYTICS_RELIABILITY_CONTRACT.md` — Full specifications
- `DASHBOARD_ANALYTICS_QA_WALKTHROUGH.md` — FUNCTION TEST #9
- `DASHBOARD_ANALYTICS_JIRA_AUTOMATION.md` — Enforcement automation
- `DASHBOARD_ANALYTICS_STATUS_MESSAGES.md` — Customer-facing transparency

---

## 9. Review & Evolution

This policy is reviewed quarterly.

Updates require stakeholder alignment, not release-blocking approval.