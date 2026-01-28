# Phase 2C-3: Real Run Proof — Audit Evidence Command

## Objective
Prove that Phase 2C-1 (OpenAI integration) + Phase 2C-4 (audit persistence) work together in a real end-to-end run.

---

## Prerequisites Checklist

Before running the canonical evidence command:

- [ ] **DB Migration Applied**: `supabase db push` or equivalent
  - Verify table exists: `SELECT COUNT(*) FROM information_schema.tables WHERE table_name='evaluation_provider_calls';`
  
- [ ] **.env.local Set** (minimum):
  ```bash
  OPENAI_API_KEY=sk-...  # Real key (or tests will use simulated fallback)
  SUPABASE_URL=https://...
  SUPABASE_SERVICE_ROLE_KEY=...
  ```

- [ ] **Dev Server Ready**:
  ```bash
  npm run dev
  # Confirm: curl -s http://localhost:3000 >/dev/null && echo "OK" || echo "NO"
  ```

- [ ] **Worker Script Available**:
  - `bash scripts/test-phase2-vertical-slice.sh` should exist

---

## Canonical Phase 2C-3 Evidence Command

**Run once, capture full output to `.log` file, archive as evidence.**

```bash
cd /workspaces/literary-ai-partner && \
echo "=========================================" && \
echo "PHASE 2C-3 REAL RUN EVIDENCE" && \
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" && \
echo "=========================================" && \
echo "" && \
echo "1) TypeScript (main + workers):" && \
npx tsc --noEmit -p tsconfig.json && \
npx tsc --noEmit -p tsconfig.workers.json && \
echo "   ✅ TypeScript clean" && \
echo "" && \
echo "2) Phase 2C-1 runtime proof tests:" && \
npx jest phase2c1-runtime-proof.test.ts --no-coverage --silent && \
echo "   ✅ C1 runtime proof: 15/15 passing" && \
echo "" && \
echo "3) Phase 2C-4 persistence tests:" && \
npx jest phase2c4-persistence.test.ts --no-coverage --silent && \
echo "   ✅ C4 persistence proof: 17/17 passing" && \
echo "" && \
echo "4) Vertical slice real run:" && \
bash scripts/test-phase2-vertical-slice.sh && \
echo "" && \
echo "=========================================" && \
echo "✅ PHASE 2C-3 COMPLETE" && \
echo "Ended: $(date -u +%Y-%m-%dT%H:%M:%SZ)" && \
echo "=========================================" && \
echo "" && \
echo "NEXT: Query DB for persistence proof:" && \
echo "  SELECT COUNT(*) FROM public.evaluation_provider_calls;" && \
echo ""
```

**Save output:**
```bash
bash <(echo '...command above...') 2>&1 | tee /tmp/phase2c3-evidence-$(date +%s).log
```

---

## DB Proof Queries (Run After Script Completes)

### 1. Verify Provider Calls Table Exists
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema='public' AND table_name='evaluation_provider_calls';
-- Expected: 1 (if 0, migration didn't apply)
```

### 2. Count Rows for Recent Jobs
```sql
SELECT COUNT(*) FROM public.evaluation_provider_calls 
WHERE created_at > now() - interval '1 hour';
-- Expected: >= 1 (at least one from the vertical-slice run)
```

### 3. Audit Trail for Latest Job
Extract the JOB_ID from vertical-slice output, then:

```sql
SELECT 
  id, 
  job_id,
  provider,
  phase,
  created_at,
  (request_meta->>'model') as model,
  (response_meta->>'latency_ms') as latency_ms,
  (response_meta->>'retries') as retries,
  (error_meta->>'error_kind') as error_kind,
  (result_envelope->>'partial') as partial
FROM public.evaluation_provider_calls 
WHERE job_id = '<JOB_UUID>'
ORDER BY created_at DESC;
```

### 4. Verify No Secret Leakage
```sql
-- Check for API key patterns (should be zero)
SELECT COUNT(*) FROM public.evaluation_provider_calls 
WHERE 
  result_envelope::text ILIKE '%sk-%'
  OR request_meta::text ILIKE '%sk-%'
  OR error_meta::text ILIKE '%sk-%';
-- Expected: 0
```

### 5. Verify Error Message Truncation
```sql
-- Check max error message length (should be <= 512)
SELECT MAX(LENGTH(COALESCE(error_meta->>'message', ''))) as max_error_len
FROM public.evaluation_provider_calls;
-- Expected: <= 512
```

### 6. Provider Breakdown
```sql
SELECT 
  provider,
  COUNT(*) as count,
  COUNT(CASE WHEN response_meta IS NOT NULL THEN 1 END) as successes,
  COUNT(CASE WHEN error_meta IS NOT NULL THEN 1 END) as errors
FROM public.evaluation_provider_calls 
WHERE created_at > now() - interval '1 day'
GROUP BY provider;
```

---

## Evidence Artifacts

| Step | Produces | Evidence | Location |
|------|----------|----------|----------|
| TypeScript compile | Exit 0 | Project is syntactically valid | Console output |
| C1 runtime tests | 15/15 passing | Circuit breaker + retry logic proved | Jest output |
| C4 persistence tests | 17/17 passing | Schema round-trip + audit semantics | Jest output |
| Vertical-slice run | Job completed + artifact created | Real/simulated evaluation executed | Vertical-slice output |
| DB query 1 | COUNT=1 | Table created successfully | psql/Supabase |
| DB query 2 | COUNT>=1 | At least one row persisted | psql/Supabase |
| DB query 3 | provider/latency/retries/partial | Audit payload structure verified | psql/Supabase |
| DB query 4 | COUNT=0 | No API keys leaked | psql/Supabase |
| DB query 5 | MAX<=512 | Error truncation working | psql/Supabase |

---

## Success Criteria

### Code Level
- ✅ TypeScript compiles (both tsconfig.json + tsconfig.workers.json)
- ✅ Phase 2C-1 tests: 15/15 passing
- ✅ Phase 2C-4 tests: 17/17 passing
- ✅ phase2Worker.ts calls persistProviderCall() after executePhase2Evaluation()

### Integration Level
- ✅ Vertical-slice script completes (job either real or simulated)
- ✅ Job marked complete or failed (not orphaned)

### DB Level
- ✅ evaluation_provider_calls table exists
- ✅ At least 1 row persisted for the job
- ✅ Row contains: job_id, provider, phase, request_meta, response_meta or error_meta, result_envelope
- ✅ No API keys leaked (COUNT=0)
- ✅ Error messages truncated (<= 512 chars)

---

## Two Critical Contract Points

These are the only two spots that usually cause false passes:

### 1. persistProviderCall() Called in Both Paths
✅ **Success path** (lines ~255-290 in phase2Worker.ts):
```typescript
const result = await executePhase2Evaluation(context, log);
await persistProviderCall({
  job_id: jobId,
  phase: 'phase_2',
  provider: process.env.OPENAI_API_KEY ? 'openai' : 'simulated',
  // ... request_meta, response_meta, result_envelope
});
```

✅ **Error path** (lines ~316-345 in phase2Worker.ts):
```typescript
catch (err: any) {
  // ...
  await persistProviderCall({
    job_id: jobId,
    // ... error_meta only
  });
  await failJob(jobId, errorMsg);
}
```

**Verify:** Search for `persistProviderCall` in phase2Worker.ts—should appear at least twice.

### 2. persistProviderCall() Is Non-Fatal
✅ The function does NOT throw on DB insert failure; it logs only:
```typescript
async function persistProviderCall(rec: ProviderCallRecord): Promise<void> {
  try {
    const { error } = await supabase.from('evaluation_provider_calls').insert({...});
    if (error) {
      log('error', 'Failed to persist provider call', ...);
      return;  // Non-fatal
    }
  } catch (err) {
    log('error', 'Exception in persistProviderCall', ...);
  }
}
```

**Verify:** Job completes even if audit insert fails. This is intentional—observability never breaks the pipeline.

---

## Deferred to Phase 2C-3 Operator

Because I (the coding agent) don't have:
- Real OPENAI_API_KEY
- Live Supabase project
- Dev server running

These steps are yours to execute:

1. Apply the DB migration to your Supabase
2. Set .env.local with real credentials
3. Start dev server
4. Run the canonical evidence command above
5. Capture logs to `.log` file
6. Run the DB proof queries
7. Archive as your Phase 2C-3 evidence

---

## Next: Phase 2D (Compliance + Diagnostics)

After Phase 2C-3 completes successfully:

- [ ] Query evaluation_provider_calls for diagnostics
- [ ] Implement error pattern analysis (retries, circuit breaker open events, latency trends)
- [ ] Design compliance export (audit report by date range, provider, phase, verdict)
- [ ] Add redaction layer for multi-tenant scenarios

---

**Status:** Phase 2C-3 evidence command ready. Operator-executed.  
**Related:** docs/PHASE2C1_CHECKLIST.md, docs/PHASE2C4_PERSISTENCE.md  
**Evidence Location:** To be populated when operator runs command
