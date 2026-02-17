# Gate A7 — QA / QC Plan (Proof Gates)

Status: PLANNED  
Owner: Founder / Architect  
Scope: Tests + Proof required to close A7

---

## 1. Test Matrix

### 1.1 Unit Tests

| Area | Test | Pass Criteria |
|------|------|---------------|
| Token | generate token | length >= 43 chars (base64url), randomness |
| Token | hash token | deterministic for same input |
| Token | constant-time compare | helper used consistently |
| Expiry | expired token | denied |
| Revocation | revoked token | denied |
| JSON | ReportContent validator | rejects malformed credibility |

---

### 1.2 Integration Tests (E2E)

#### A7-E2E-01 Owner creates share link
- Seed: completed job with A6 artifact present
- Action: POST /api/report-shares
- Expect: 201 + share_url returned
- Expect: row exists in report_shares with token_hash only

#### A7-E2E-02 Anon views share
- Action: GET /share/{token}
- Expect: 200
- Expect: HTML contains markers:
  - "Evaluation Report"
  - "Score Explanation"
  - "Confidence"
  - "Provenance"

#### A7-E2E-03 Revoked share denied
- Action: revoke then view
- Expect: 404

#### A7-E2E-04 Expired share denied
- Action: create with short expiry; simulate time or set expires_at in test
- Expect: 404

#### A7-E2E-05 Non-owner cannot create share
- Action: create share with different user
- Expect: 404 or 403 (policy choice)
- Must not reveal job existence

---

## 2. QC Gates (Fail CI)

CI must fail if:

- shared route imports chunk-level evaluation tables
- shared route writes to evaluation_jobs or evaluation_artifacts
- artifact validator allows missing credibility when overall_score exists
- token_hash stored or returned in plaintext
- RLS policies permit broad selects of report_shares by anon

---

## 3. Evidence Artifact

The gate closes only with:
- CI run URL
- log snippet showing E2E tests green
- proof markers from the rendered share HTML
