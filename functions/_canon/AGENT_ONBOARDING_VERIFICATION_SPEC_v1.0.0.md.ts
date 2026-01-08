# Canon Spec — Agent Onboarding & Verification (v1.0.0)

**Status:** CANON-READY  
**Change Control:** CCR required after freeze  
**Last-Modified:** 2025-01-08  
**Depends on:** INDUSTRY_PORTAL_SPEC_v1.0.0.md (v1.0.0), INDUSTRY_ENTITIES_v1.0.0.md (v1.0.0), AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0.md (v1.0.0)

---

## Purpose

Define a secure, auditable, and abuse-resistant onboarding and verification process for industry users (agents, managers, producers, executives) who access the Industry Portal (`/agent/*`). This spec governs who may obtain `INDUSTRY_*` roles, how trust is established and revoked, how `AgencyOrg` entities are formed, and how access is rate-limited and audited.

**This document establishes verification as a structural trust gate, not a UI convenience.**

---

## 1. Scope (v1.0.0)

### In-scope
- Industry user onboarding flow
- Verification state machine
- Verification methods and requirements
- AgencyOrg creation and membership rules
- Abuse prevention and rate limiting
- Audit logging for all trust-relevant events

### Out-of-scope (later phases)
- Automated third-party verification APIs
- Paid priority verification
- Deep reputation scoring
- Analytics dashboards for admins

---

## 2. Roles and Actors

### Industry Roles
- **INDUSTRY_USER** — verified industry professional
- **INDUSTRY_ADMIN** — verified industry professional with org admin rights

### System Roles
- **ADMIN_REVIEWER** — internal admin authorized to approve/reject/suspend
- **SYSTEM** — automated enforcement (rate limits, temporary locks)

**Authors never participate in this flow.**

---

## 3. Verification State Machine (Non-Negotiable)

### States

**UNVERIFIED**  
Initial state. User record exists but has no access to `/agent/*` routes.

**PENDING**  
Verification request submitted; awaiting manual review.

**VERIFIED**  
Approved. User granted `INDUSTRY_USER` (or `INDUSTRY_ADMIN`) role and `/agent/*` access.

**SUSPENDED**  
Access revoked after verification due to abuse, policy violation, or security concern.

**REJECTED**  
Verification request denied. No industry access granted.

### Allowed Transitions

- `UNVERIFIED` → `PENDING`
- `PENDING` → `VERIFIED`
- `PENDING` → `REJECTED`
- `VERIFIED` → `SUSPENDED`
- `SUSPENDED` → `VERIFIED` (admin-only, explicit reinstatement)
- `SUSPENDED` → `REJECTED` (permanent removal)

### Forbidden Transitions

- `UNVERIFIED` → `VERIFIED` (no bypass)
- `REJECTED` → `VERIFIED` (requires new request)
- Any → `VERIFIED` without manual admin action

---

## 4. Verification Methods (v1 Requirements)

**All initial verifications require manual review.**

### Allowed Inputs (one or more required)
- Professional email address (agency/production domain preferred)
- LinkedIn profile URL
- IMDb / IMDbPro profile (for producers/executives)
- Agency or production company name
- Role/title description

### Optional Enhancements
- Domain ownership check (email domain vs agency name)
- Prior AgencyOrg invite code (see §6)

### Hard Rule
**No fully automated approval is permitted for first-time verification.**

---

## 5. Access Control Rules

### UNVERIFIED / PENDING / REJECTED users:
- Cannot access `/agent/*`
- Receive `403` on all industry endpoints
- May access only onboarding/status pages

### VERIFIED users:
- Granted `INDUSTRY_USER` role
- May access `/agent/*` routes subject to rate limits

### VERIFIED + org admin flag:
- Granted `INDUSTRY_ADMIN` role
- May manage org settings, invites, and templates

### SUSPENDED users:
- Immediate revocation of `/agent/*` access
- Existing sessions invalidated

---

## 6. AgencyOrg Creation & Membership

### 6.1 Org Creation

An `AgencyOrg` may be created when:
- An `ADMIN_REVIEWER` approves the first `VERIFIED` user for a new agency/company
- Or an `ADMIN_REVIEWER` manually creates the org during verification

The first verified user is assigned:
- `OrgMembership.role = ADMIN`

### 6.2 Joining Existing Orgs

Additional reps may join an existing `AgencyOrg` via:
- Admin-issued invite code
- Manual admin linking during verification

### Rules
- Only `INDUSTRY_ADMIN` may invite org members
- Self-claiming an org without admin approval is **forbidden**
- Duplicate org creation must be reviewed and merged manually

---

## 7. Abuse Prevention & Rate Limiting (v1)

### Access Limits (per INDUSTRY_USER)
- Submission detail views: capped per day
- Message sends: capped per day
- Bulk actions: disabled in v1

### Suspension Triggers (examples)
- Scraping-like access patterns
- Excessive automated requests
- Harassment or policy violations
- Misrepresentation during verification

### Suspension Effects
- Immediate access revocation
- Audit event logged
- Manual review required for reinstatement

### Suspension Scope
- Suspended user's existing queue access revoked immediately
- In-flight messages from suspended user held for admin review
- Submissions previously viewed by suspended user remain in author's record
- **Org-level:** Suspension of one rep does not affect other org members

---

## 8. Audit Events (Required)

**All of the following must be logged (append-only):**

### Verification
- `verification_requested`
- `verification_approved`
- `verification_rejected`
- `verification_suspended`
- `verification_reinstated`

### Access
- `industry_access_granted`
- `industry_access_revoked`

### Organization
- `agency_created`
- `org_membership_added`
- `org_membership_removed`
- `org_role_changed`

### Audit fields (minimum)
- `actorId` (admin/system)
- `targetUserId`
- `agencyOrgId` (if applicable)
- `timestamp`
- `reasonCode` (optional)
- `notes` (internal)

**Audit logs are industry-internal and never author-visible.**

---

## 9. Required Tests (Release Blocking)

### Verification Flow
- `UNVERIFIED` user cannot access `/agent/*`
- `VERIFIED` user can access `/agent/*`
- `SUSPENDED` user receives `403` and session invalidation

### Org Rules
- Non-admin cannot invite org members
- Admin can invite and assign roles
- Duplicate org creation requires admin intervention

### Rate Limits
- Exceeding access limits triggers enforcement
- Enforcement actions logged

### Audit
- Every verification state change emits an audit event
- Every access grant/revoke emits an audit event

---

## 10. Change Control

**This spec governs platform trust and industry access.**

Any change requires a CCR including:
- Rationale
- Affected roles or states
- Updated state transitions
- Updated tests proving enforcement

---

**End of Agent Onboarding & Verification Spec v1.0.0**