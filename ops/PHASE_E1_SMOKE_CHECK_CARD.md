# Phase E1 – Smoke Check Card (Vercel + Supabase)

**Status:** READY TO RUN  
**Scope:** v1.0.1-rrs-100 only (certified release)  
**Goal:** Move from certified readiness → observed reality, with one small ops log.

---

## 0. Preconditions

- Tag `v1.0.1-rrs-100` exists and points to commit `c018221`.
- Vercel project is connected to this GitHub repo.
- Supabase project is provisioned with env vars set in Vercel (or `.env.local` for local testing).
- Phase C/D governance and canon remain locked; no new gates.

---

## 1. Deploy from the certified tag

### Option A: Production Vercel Deploy

1. Trigger a production deployment from **tag** `v1.0.1-rrs-100` (commit `c018221`).
   - Method: Vercel dashboard, GitHub integration, or `vercel deploy --prod --meta v1.0.1-rrs-100`.
2. Wait for Vercel to report a successful build and deployment.
3. Note the production URL (e.g., `https:// <app>.vercel.app`).

### Option B: Local Test Against Staging Supabase

1. Check out commit `c018221`:
   ```bash
   git checkout v1.0.1-rrs-100
   ```
2. Build and run locally:
   ```bash
   npm install
   npm run build
   npm start
   ```
3. Use local URL: `http://localhost:3000`.

### Log (in `ops/PHASE_E_DAY1_LOG.md`)

- Deployment method (Option A or B).
- Timestamp (UTC).
- Target URL and environment (production Vercel or local).
- Vercel project name (if applicable).
- Source: tag `v1.0.1-rrs-100`, commit `c018221`.

---

## 2. Confirm build identity

1. Load the target URL in a browser or via the API.
2. Verify the running app exposes the build identity:
   - Look for a footer badge, status page, or API endpoint documenting the version.
   - Expected values:
     - Tag: `v1.0.1-rrs-100`
     - Commit hash: `c018221`

### Log

- How the identity was verified (e.g., footer, `/api/status`, or `GET /status`).
- Actual values observed.
- ✅ or ⚠️ (expected values match, or mismatch noted).

---

## 3. Error-safety check (D1 behavior)

Goal: Verify that error responses do **not** leak stack traces, secrets, or internal details.

### Steps

1. Trigger a **known-safe error** from the app:
   - Submit an obviously invalid evaluation request (e.g., empty text, invalid work type).
   - Or hit a nonexistent endpoint.
2. In the browser (Network tab) or Vercel logs:
   - Verify the error response.
   - Confirm:
     - ✅ No JavaScript stack trace shown to user.
     - ✅ No Supabase table names, URLs, or internal service details.
     - ✅ No environment variable names or values.
     - ✅ Error message is human-safe (e.g., "Invalid request" or "Please try again").

### Log

- Scenario used (what error triggered).
- Visible error message (exact text).
- Checklist result: no stack trace, no secrets, no Supabase internals.
- ✅ or ⚠️.

---

## 4. End-to-end evaluation

Goal: Verify a full evaluation flows through the system without errors.

### Steps

1. From the **running app** (Vercel or local), start a new evaluation:
   - Submit sample prose or upload a short document.
   - Use a safe work type (e.g., "Manuscript" or "Proposal").
2. Wait for the evaluation to complete.
3. Observe:
   - ✅ No errors during submission.
   - ✅ Evaluation ID is returned.
   - ✅ Agent view renders (displays criteria matrix, applicability, trust header, etc.).
   - ✅ Work type and matrix version are visible and correct.
4. **In Supabase (manual check)**:
   - Open the Supabase dashboard.
   - Inspect the evaluation record:
     - Exists in the correct table.
     - Contains the correct work type.
     - Contains the correct matrix version.
     - Status is `complete` or `success`.

### Log

- Timestamp (UTC).
- Evaluation ID.
- Work type used.
- Matrix version observed.
- One-line summary: e.g., "end-to-end eval PASSED (work type Manuscript, matrix v1.0.1)."
- ✅ or ⚠️.

---

## 5. Forbidden-language / safety behavior

Goal: Verify that disallowed content triggers expected safety controls.

### Steps

1. From the running app, submit content that **should** trigger forbidden-language handling:
   - Submit prose containing language flagged as disallowed per D2/D5 policy.
   - Example: content that violates your content policy or unsafe instruction requests.
2. Observe the response:
   - ✅ The UI returns a safe message (e.g., "This evaluation cannot proceed.").
   - ✅ No disallowed completion is rendered.
   - ✅ No sensitive details about the filtering rule are shown.
   - ✅ Behavior aligns with your D5 (incident readiness) documentation.

### Log

- Input type (describe the content without including PII).
- Observed response (exact message shown to user).
- Whether it matches expectations (✅ or ⚠️).
- Any notes on policy alignment.

---

## 6. Rate-limit and concurrency

Goal: Observe rate-limit behavior and confirm no runaway jobs.

### Steps

1. Using a script, REST client (e.g., VS Code REST extension), or `curl`, send a burst of evaluation requests against the **deployed** API:
   ```bash
   # Example: send 10 requests in quick succession
   for i in {1..10}; do
     curl -X POST https://<app>.vercel.app/api/evaluate \
       -H "Content-Type: application/json" \
       -d '{"text":"Sample text","workType":"Manuscript"}' &
   done
   wait
   ```
2. Observe:
   - ✅ Requests complete without error up to roughly your documented limit (~100/day, ~5 concurrent).
   - ✅ When the limit is hit, you receive a 429 (or documented rate-limit status code).
   - ✅ No runaway jobs or unbounded queues in Vercel logs or Supabase.
   - ✅ System recovers normally after the burst.

### Log

- Timestamp and approximate request count.
- First rate-limit response observed (e.g., "received 429 at request #6").
- Concurrent request count observed (e.g., "~5 in flight simultaneously").
- Runaway job observation: "none detected" or note any concern.
- ✅ or ⚠️.

---

## 7. Ops log location and structure

Create or update: **`ops/PHASE_E_DAY1_LOG.md`**

### Suggested structure

```markdown
# Phase E Day 1 Log
Timestamp: 2026-02-09T18:30:00Z
Environment: Vercel production | local dev
Certified release: v1.0.1-rrs-100 (commit c018221)

## 1. Build identity
- Identity method: [footer | /api/status | other]
- Tag observed: v1.0.1-rrs-100
- Commit observed: c018221
- Result: ✅ PASS

## 2. Error-safety
- Scenario: [describe error trigger]
- Error message: "[exact text seen]"
- No stack trace: ✅ YES
- No secrets: ✅ YES
- No Supabase internals: ✅ YES
- Result: ✅ PASS

## 3. End-to-end evaluation
- Evaluation ID: [ID]
- Work type: Manuscript
- Matrix version: v1.0.1
- Supabase record exists: ✅ YES
- Result: ✅ PASS

## 4. Forbidden-language
- Input type: [safe description, no PII]
- Response observed: "[exact message]"
- Behavior expected: ✅ YES
- Result: ✅ PASS

## 5. Rate-limit / concurrency
- Request count: 10
- Rate-limit hit at: request #6 (429 response)
- No runaway jobs: ✅ YES
- Result: ✅ PASS

## Summary
All Phase E1 smoke checks passed. System ready for E2/E3 operations or quiet observation.

### Next decision
- [ ] Observe quietly for ~24h
- [ ] Proceed to E2 (monitoring/onboarding)
- [ ] Pause
```

---

## 8. After Phase E1

Once all checks are logged:

1. **Do not** change governance, canon, or schema.
2. **Decide separately** on next steps:
   - Observe quietly for ~24h.
   - Proceed to E2 (monitoring, onboarding, user metrics).
   - Pause and maintain "certified & eligible" state.

### Important

**Phase E remains operational observation, not a new gate.**

- If a check shows ⚠️, note it and decide: fix it, document it, or escalate.
- No need to be perfect; you're witnessing behavior, not re-proving compliance.
- Phase C/D remain locked unless you change public behavior.
- CI remains the binding enforcement boundary.

---

## Reference

- Certified release: [v1.0.1-rrs-100](https://github.com/Mmeraw/literary-ai-partner/releases/tag/v1.0.1-rrs-100)
- Phase D proof pack: [evidence/phase-d](evidence/phase-d)
- Governance: [AI_GOVERNANCE.md](../AI_GOVERNANCE.md)
- Canon: [docs/NOMENCLATURE_CANON_v1.md](../docs/NOMENCLATURE_CANON_v1.md)
