# U2/U3 Readiness Checklist

## U2 Proof Gate (Required Before U3 Work)

Run closure proof only from a real `/api/jobs` production path.

Required sequence:

1. Run a real job through `/api/jobs` and capture `jobId`.
2. Collect proof JSON:
   - `PROOF_JOB_ID=<jobId> SUPABASE_URL=<prod-url> SUPABASE_SERVICE_KEY=<service-key> node scripts/collect-u2-proof.mjs > proof.json`
3. Manually review `/evaluate/<jobId>/report` and update checklist fields in `proof.json`:
   - `verificationChecklist.bottomWeaknessInSummary = "PASS"`
   - `verificationChecklist.confidenceBannerMatchesLabel = "PASS"`
   - `verificationChecklist.noFalseHighConfidenceAuthority = "PASS"`
4. Validate proof (fail-fast):
   - `cat proof.json | node scripts/validate-u2-proof.mjs`

Closure gate: U2 is not closure-eligible unless validator output is `U2 proof validation passed ✅`.

## U3 Prep Guardrails

U3 prep is allowed only while this prerequisite remains true in `ROADMAP.md`:

- `U3: BLOCKED UNTIL U2 ENFORCED`

If that line is removed or changed before U2 closure proof is complete, CI must fail.

## Evidence Expectations

- Persisted job status must be `complete`.
- `u2Proof` must include:
  - `confidenceLabel`
  - `confidenceReasons`
  - `propagation`
  - `anchors`
  - `reasonCodes`
- Manual verification checklist keys above must be `PASS` (no `PENDING`).
