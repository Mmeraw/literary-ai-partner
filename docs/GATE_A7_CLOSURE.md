# Gate A7 — StoryGate Studio / Shareable Report Preview
Closure Evidence

Status: PLANNED  
Owner: Founder / Architect  
Preconditions: A5 CLOSED, A6 CLOSED

---

## 1. Summary

A7 enables secure, read-only sharing of credible evaluation reports via revocable, optionally expirable share links. Shared views are projections of canonical artifacts and do not recompute or mutate evaluation data.

---

## 2. What A7 Guarantees

- Owners can create share links for a job's canonical artifact.
- Share tokens are stored hashed; tokens are never stored in plaintext.
- Shared report view renders from `evaluation_artifacts` only.
- Shared routes are read-only with respect to evaluation data.
- Revocation and expiry deny access immediately (fail-closed).
- A5/A6 invariants remain intact.

---

## 3. Implementation Evidence

### 3.1 Schema & RLS
- Migration: `[TO BE FILLED]`
- Table: `report_shares`
- Indexes: `token_hash` unique, active share per job partial unique
- RLS: owner-only insert/update/select; anon access via server-side validation only

### 3.2 Routes
- `POST /api/report-shares`
- `POST /api/report-shares/{id}/revoke`
- `GET /share/{token}`

### 3.3 Shared UI
- `app/share/[token]/page.tsx` renders:
  - score, summary, rubric explanation, confidence, provenance

---

## 4. CI Proof

CI Run URL: `[TO BE FILLED]`

Required passing evidence:
- Unit tests (token, expiry, validator)
- Integration tests:
  - owner creates share
  - anon views share (markers present)
  - revoked token denied
  - expired token denied
  - non-owner create denied without leakage

Log snippet:
```text
A7 E2E: create share ......... OK
A7 E2E: view share (anon) .... OK
A7 E2E: revoke denied ........ OK
A7 E2E: expire denied ........ OK
```

---

## 5. Golden Spine Update

Gate A7 marked CLOSED with proof link to CI run and this document.

---

## 6. Approval

**Approved by:** Michael Meraw  
**Date:** `[TO BE FILLED]`
