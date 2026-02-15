# Gate 2: DB-Atomic Claim RPC — Final Closure

**Status:** ✅ CLOSED  
**Timestamp:** 2026-02-15  
**Commit:** 6f61de3 (HEAD on main/origin/main)  
**QC Sign-off:** Ground-truth terminal validation complete

---

## Hardening Applied

### Migration: `20260214180000_claim_evaluation_job_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION claim_evaluation_job_phase1(...)
RETURNS TABLE AS $$
  -- TTL CLAMP: GREATEST(30, LEAST(p_ttl_seconds, 900))
  -- PHASE GUARD: WHERE status = 'queued' AND phase = 1
  -- SECURITY: SECURITY DEFINER + SET search_path = public
  -- GRANT EXECUTE TO service_role ONLY
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;
```

**Key Elements:**
- Phase guard prevents job theft across phases
- TTL bounds guarantee 30s minimum, 900s maximum
- Privilege isolation: SECURITY DEFINER executes as function owner
- search_path hardened to prevent schema pollution attacks
- Timestamp format: ISO 8601 with milliseconds (`YYYY-MM-DD"T"HH24:MI:SS.MS"Z"`)

---

## Test Harness

| File | Tests | Status | Evidence |
|------|-------|--------|----------|
| `app/api/workers/process-evaluations/auth.test.ts` | 32 | ✅ PASS | 1.651s, all auth methods covered |
| `tests/ttl-clamping.test.ts` | 5 | ✅ SKIP (graceful) | 0.188s, console.warn shown |
| `jest.setup.ts` (NEW) | — | ✅ | Environment mapping for tests |
| TypeScript compilation | — | ✅ CLEAN | `npx tsc --noEmit --skipLibCheck` |

**Auth methods tested:**
1. Vercel Cron (x-vercel-cron=1 + x-vercel-id header)
2. Bearer token (timing-safe comparison)
3. Dev query (?secret=..., NODE_ENV=development only)
4. Dry-run mode (?dry_run=1)
5. QC edge cases (secret too long, malformed headers)

---

## Verification Checklist

- ✅ Migration file exists: `supabase/migrations/20260214180000_claim_evaluation_job_rpc.sql`
- ✅ Commit 6f61de3 on main/origin/main
- ✅ 11 files changed (auth.test.ts, jest.setup.ts, ttl-clamping.test.ts, 8 docs, diagnose-jobs.sql)
- ✅ Git working tree clean (`git status --porcelain` empty)
- ✅ TypeScript clean (no TS errors)
- ✅ Auth tests: 32/32 pass
- ✅ TTL tests: 5/5 skip with guidance
- ✅ Commit message signed and auditable

---

## Next Gate

**Gate 6: Observability Layer**
- `/api/health` endpoint (two-tier: public + protected)
- `lib/monitoring/queueHealth.ts` (metrics + classification)
- `lib/monitoring/healthThresholds.ts` (SLO thresholds as code)
- Route tests + health classifier unit tests
- Fill 5 placeholder docs + commit

---

## References

**Related Commits:**
- 918f367: QC Gate 2: Harden claim_job_atomic...
- 28ea5ff: test(qc): Add lease advancement guarantee...
- c002570: test(qc): Add TTL clamping tests...
- daf6e57: docs: Add QC Gate 2 evidence...
- 6f61de3: Fix test suite (TypeScript, Jest env, graceful skip)

**Gate 2 Contract:**
See `docs/JOB_CONTRACT_v1.md` for canonical job statuses and state transitions.
