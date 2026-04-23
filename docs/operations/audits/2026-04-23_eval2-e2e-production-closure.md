# Audit Note — Eval 2.0 Controlled E2E Reopen Closure

**Date:** 2026-04-23  
**Repository:** `Mmeraw/literary-ai-partner`  
**Scope:** Production worker recovery from pre-claim/runtime blockers through first clean controlled completion  
**Status:** ✅ Primary incident objective closed (controlled path)

---

## Canonical proof case (first clean production E2E)

- **Deploy commit:** `c13c72c`
- **Worker trace:** `a196272a-8d3d-40aa-909b-beeeab2e46ec`
- **Controlled job:** `779a864f-912b-4e5f-9d68-46f69e6e92f6`

### What was proven on this case

- Job claim succeeds.
- Running-state writes persist.
- Manuscript fetch succeeds.
- Pass 1 / Pass 2 / Pass 3 complete.
- Pass 4 no longer blocks this path.
- Artifact persistence succeeds.
- Completion update succeeds.
- Terminal row state is clean:
  - `status = complete`
  - `phase_status = complete`
  - `completed_at = 2026-04-23T20:53:30Z`
  - `lease_until = null`
  - `last_error = null`
  - `overall_score_0_100 = 58`
  - `artifact_id = 5a2ec063` (persisted)

---

## Incident blockers and fixes applied

### 1) Stale auto-fail wrote generated lease column

- **Symptom:** stale cleanup path attempted invalid writes against derived lease-expiry schema shape.
- **Fix:** stale recovery made canonical-first with mixed-schema fallback; writable lease fields only; fail-closed behavior preserved.

### 2) Claim contract parser rejected valid timestamptz offsets

- **Symptom:** claim RPC returned rows, batch aborted on contract parse mismatch.
- **Root cause detail:** strict `z.string().datetime()` parsing rejected PostgreSQL timestamptz offset output (e.g., `+00:00`).
- **Fix:** claim contract parser now accepts offset-form timestamps (`offset: true`), unblocking post-claim execution.
- **Observed failure mode before fix:** row could be claimed and moved to `running`, but processor aborted before `markRunning` persistence, leaving no `started_at`/heartbeat writes.

### 3) Incident proof script execution bug

- **Symptom:** local proof script failed due Python stdin/heredoc misuse.
- **Fix:** script corrected and revalidated.

### 4) Deterministic quality-gate seam failures

- **Symptom A:** `QG_POV_GENERIC_REASONING`
- **Fix A:** narrow Pass 3 backfill for voice mechanism-specific rationale.
- **Symptom B:** `QG_DIALOGUE_ATTRIBUTION_UNDERAUDITED`
- **Fix B:** narrow Pass 3 backfill for dialogue attribution mechanism-specific rationale.

---

## Evidence captured in this session

- **Primary proof source (authoritative):**
  - Vercel function execution trace `a196272a-8d3d-40aa-909b-beeeab2e46ec` for controlled job `779a864f-912b-4e5f-9d68-46f69e6e92f6`, showing full claim → running persistence → manuscript fetch → Pass 1/2/3/4 path → artifact upsert → completion update sequence.
- **Corroborating re-check artifact (archived):**
  - `evidence/incident/canonical-proof-c13c72c-20260423T210106Z.log`
- **Re-check outcome:** deploy SHA confirmed `c13c72c`; canonical job remained `complete` on rerun trigger (`claimed=0` expected for an already-complete row).
- **Operational note:** fresh-job harness is an additional seal only; it is currently gated by missing `AUTH_TOKEN` in shell context and does not invalidate the controlled-path proof.

---

## Secondary items (non-blocking)

1. `url.parse()` deprecation warning.
2. Non-fatal Perplexity cross-check parse/truncation warning.
3. `DIVERGENCE_COLLAPSE_WARNING` telemetry note.
4. Minor terminology drift cleanups (e.g., labels like `canonical_ownership_fields`).
5. Historical sentinel timestamp artifacts were observed on pre-fix polluted rows; do not treat them as current behavior unless reproduced after latest fixes.

These did **not** block controlled-path completion.

---

## Next actions (tight scope)

1. Run `scripts/verify-worker-recovery.sh` as formal fresh-job golden harness in an environment with:
   - `PROD_URL`
   - `CRON_SECRET`
   - `AUTH_TOKEN`
2. Attach resulting log artifact to this closure note.
3. Address secondary cleanup items without broadening architecture changes.

**Operator note:** keep fixes surgical; do not rewrite working seams.
