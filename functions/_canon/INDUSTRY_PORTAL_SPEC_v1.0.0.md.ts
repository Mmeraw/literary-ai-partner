# INDUSTRY_PORTAL_SPEC_v1.0.0.md

**Canon Spec — Industry Portal / Agent Dashboard (v1.0.0)**

**Status:** CANON-READY  
**Change Control:** CCR required after freeze  
**Last-Modified:** 2026-01-08  
**Depends on:** EVALUATION_METHOD_CANON.md (v1.0.0) and WORK_TYPE_POLICY_ROUTING_SPEC.md (v1.0.0)

---

## Purpose

Deliver a role-gated Industry Portal (agents/managers/producers/readers) with a dedicated UI and workflow for triaging inbound submissions, recording internal decisions, and communicating with authors—without any leakage into author-facing UI or APIs.

---

## Non-Negotiables

1. Hard route separation under `/agent/*` (or `/industry/*`)
2. No author navigation links or shared UI routes to `/agent/*`
3. No shared components that could leak internal fields (notes/tags/reason codes)
4. Internal decisioning must never be stored in author-visible structures
5. Author-visible statuses must be a mapped subset (never 1:1 with internal pipeline)

---

## 1. Scope (v1)

### In-scope
- Separate Industry sign-in and `/agent` dashboard namespace
- Inbox/pipeline views with filters and actions
- Submission detail drawer view
- Internal decision tracking (append-only audit)
- Agent messaging using templates (with overrides)
- Settings/availability basics

### Out-of-scope (later)
- Analytics dashboards
- Bulk actions beyond simple multi-select pass
- Meeting scheduling and calendar integration
- Export/reporting

---

## 2. URL, Access, and Roles

### Routes
- Public marketing (optional): `/industry`
- Industry sign-in: `/agent/signin`
- Industry app root: `/agent`

### Roles
- **INDUSTRY_USER**: agent/manager/producer/reader
- **INDUSTRY_ADMIN**: org admin (settings/templates/memberships)
- Optional later: **INDUSTRY_ASSISTANT**

### Access Rules
- INDUSTRY_* roles can access `/agent/*`
- AUTHOR roles cannot access `/agent/*` (403 + no UI leakage)
- Industry users can only see submissions assigned/routed to them or visible via org rules
- Authors can never view internal notes/tags/reason codes/assignments/decision history

---

## 3. Information Architecture (Top-Level Sections)

### Left Nav
- Inbox
- In Review
- Decisions
- Settings / Availability
- (Later) Analytics

### Center Pane
- Tabs: All | New | Requested materials | Awaiting reply | Closed

### Right Drawer
- Submission detail view + actions

---

## 4. Primary Views (UI Requirements)

### 4.1 Inbox / Pipeline Table

#### Default Columns
- Project title
- Author / writer name
- Work type (Flash/Micro, Manuscript, Screenplay, etc.)
- Genre / category
- Word count / script length
- Submission date
- Current pipeline status
- Internal tags (agent/org only)
- Key signal badge (policy-family derived; informational only)

#### Filters
- Status: New, In Review, Replied, Passed, On Hold, Requested, Closed
- Work type: Novel/Manuscript, Flash/Micro, Screenplay, TV Pilot, etc. (extensible)
- Genre + age category
- Word count band / script length band
- Date range
- Internal flags (high concept, author AI note, multiple submissions)
- Assigned to: Me / Unassigned / Org member (if org sharing enabled)

#### Row Actions (quick)
- Open detail drawer
- Request materials
- Pass
- Hold
- Assign to colleague (if org allows)
- Tag

---

### 4.2 Submission Detail Drawer

#### Top Strip
- Title, author, work type, genre
- Quick actions: Request materials | Pass | Hold | Send message | Add tag

#### Panels

**A) Submission materials**
- Query letter
- Synopsis
- Sample pages link / Full manuscript link / Script link (permissioned)
- Attachment metadata (name/type/link)

**B) Evaluation intelligence (if enabled; must be policy-safe)**
- policyFamily (MICRO / MANUSCRIPT / SCREENPLAY / NEUTRAL)
- Key signal badge:
  - MICRO_POLICY => CRAFT_ONLY badge required (non-routing)
  - MANUSCRIPT_POLICY => AGENT_REALITY badge allowed
- Headline strengths (2–3)
- Headline concerns (2–3)
- Longform readiness score may display only when policy allows and is labeled correctly

**C) History / audit**
- receivedAt/openedAt/decisionedAt/messagedAt
- actor attribution (industry user)
- org attribution (if applicable)

**D) Internal-only**
- private notes
- internal tags
- reason code (optional)
- assignment

---

## 5. Status Model (Internal Pipeline vs Author-Visible)

### 5.1 Internal Pipeline Status (v1)
- NEW
- IN_REVIEW
- REQUESTED_MATERIALS
- HOLD
- PASSED
- REPLIED
- CLOSED

### 5.2 Allowed Transitions
- NEW → IN_REVIEW
- IN_REVIEW → REQUESTED_MATERIALS | HOLD | PASSED | REPLIED
- REQUESTED_MATERIALS → IN_REVIEW | HOLD | PASSED | REPLIED
- HOLD → IN_REVIEW | PASSED | REPLIED
- PASSED → CLOSED
- REPLIED → CLOSED

### 5.3 Author-Visible Status (Mapped Subset)
- SUBMITTED
- IN_REVIEW
- REQUESTED_MATERIALS
- CLOSED

**Rule:** Author status must never expose internal tags/notes/reason codes. Author-visible status is derived and intentionally coarse.

---

## 6. Policy-Family Integration (Key Signal Badge)

**Goal:** Provide informational context to agents without introducing new gates.

### Rules
- If policyFamily = MICRO_POLICY => keySignalBadge must be CRAFT_ONLY
  - Must include "craft-only / non-routing" semantics
- If policyFamily = MANUSCRIPT_POLICY => keySignalBadge may be AGENT_REALITY
- If policyFamily = SCREENPLAY_POLICY => use screenplay-safe badge (optional)
- If policyFamily = NEUTRAL_POLICY => default to craft-only / type unconfirmed

**No gate decisions are introduced by badges; badges are informational only.**

---

## 7. Templates and Messaging

Templates must resolve in this order:
1. User-level (industryUserId = current user)
2. Org-level (agencyOrgId = org, industryUserId null)
3. Global (agencyOrgId null, industryUserId null)

Authors see only the outgoing message. Authors never see internal tags/templates metadata/reason codes.

---

## 8. Required Tests (Release Blocking)

### A) Access control
- AUTHOR cannot access `/agent/*` (403; no UI render)
- INDUSTRY_USER cannot access author private drafts/workspaces unless explicitly authorized

### B) Data leakage
- Author API responses must never include: `internalNotes`, `internalTags`, `reasonCode`, `assignedToIndustryUserId`, decision history

### C) Policy-family safety
- MICRO_POLICY outputs must enforce CRAFT_ONLY badge
- Forbidden-phrase scanner (micro) must pass (no manuscript routing phrases)

### D) Decision resolution correctness
- Inbox queries must pull latest IndustryDecision by (storygateSubmissionId, scopeKey)
- History view must return append-only chain ordered by decisionedAt