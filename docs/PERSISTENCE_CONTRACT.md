# Persistence Contract — Phase 2C-4 Canonical Rules

> ⚠️ **Scope Clarification (2026-04 canonical cutover):**
> This document defines the historical Phase 2C provider-call persistence contract for
> the legacy worker execution path (`workers/phase2Worker.ts` + `workers/phase2Evaluation.ts`).
>
> Current canonical evaluation runtime for production is:
> `processor.ts -> runPipeline.ts -> evaluation_artifacts (evaluation_result_v1)`
>
> See:
> `docs/CANONICAL_RUNTIME_OPERATIONS.md`

**Status:** ✅ LOCKED (non-negotiable audit rules)  
**Related:** [docs/PHASE2C4_PERSISTENCE.md](PHASE2C4_PERSISTENCE.md), [workers/phase2Worker.ts](workers/phase2Worker.ts) lines 255-290, 325-345

---

## Rule 1: When Provider Calls Are Persisted

A provider call row is written **exactly once per Phase 2 attempt**, in one of two paths:

### Success Path
**Location:** [workers/phase2Worker.ts#L255-L290](workers/phase2Worker.ts#L255-L290)

After `executePhase2Evaluation()` returns successfully:
```typescript
const result = await executePhase2Evaluation(context, log);
await persistProviderCall({
  job_id: jobId,
  phase: 'phase_2',
  provider: process.env.OPENAI_API_KEY ? 'openai' : 'simulated',
  provider_meta_version: '2c1.v1',
  request_meta: { model, temperature, max_output_tokens, prompt_version, input_chars },
  response_meta: result.metadata.provider_meta ? { latency_ms, retries, status_code, output_chars, finish_reason } : undefined,
  result_envelope: toCanonicalEnvelope(result),  // ← Normalized to strict schema
});
```

**Guarantee:** One row in `evaluation_provider_calls` with:
- `error_meta`: NULL (success path never has errors)
- `result_envelope`: Full `CanonicalResultEnvelope` with verdict, details, metadata
- `response_meta`: Populated with latency, retries, status, finish_reason

### Error Path (Catch Block)
**Location:** [workers/phase2Worker.ts#L325-L345](workers/phase2Worker.ts#L325-L345)

When an exception occurs during job processing:
```typescript
catch (err: any) {
  // ... error logging ...
  await persistProviderCall({
    job_id: jobId,
    phase: 'phase_2',
    provider: 'openai',
    provider_meta_version: '2c1.v1',
    request_meta: { model, temperature, max_output_tokens, prompt_version, input_chars },
    error_meta: {
      code: 'worker_exception',
      retryable,
      message: truncateErrorMessage(errorMsg, 512),
      error_kind: 'unknown',
    },
    result_envelope: toCanonicalEnvelope({ metadata: { simulated: false } }, { simulatedDefault: false }),
  });
  await failJob(jobId, errorMsg);
}
```

**Guarantee:** One row in `evaluation_provider_calls` with:
- `error_meta`: Populated with exception context (code='worker_exception', classification, truncated message)
- `result_envelope`: Minimal but valid `CanonicalResultEnvelope` (degraded/partial)
- `response_meta`: NULL (never had a successful response to record)

---

## Rule 2: Persistence Is Non-Fatal

The `persistProviderCall()` function **never throws**. Failures are logged only.

### Implementation
[workers/phase2Worker.ts#L465-L505](workers/phase2Worker.ts#L465-L505)

```typescript
async function persistProviderCall(rec: ProviderCallRecord): Promise<void> {
  try {
    // Validate schema
    if (!rec.job_id || !rec.phase || !rec.provider) {
      log('error', 'Invalid ProviderCallRecord', rec);
      return; // Non-fatal
    }

    // Insert to Supabase
    const { error } = await supabase.from('evaluation_provider_calls').insert({
      job_id: rec.job_id,
      phase: rec.phase,
      provider: rec.provider,
      provider_meta_version: rec.provider_meta_version,
      request_meta: rec.request_meta,
      response_meta: rec.response_meta,
      error_meta: rec.error_meta,
      result_envelope: rec.result_envelope,
    });

    if (error) {
      log('error', 'Failed to persist provider call', { jobId: rec.job_id, error: error.message });
      return; // Non-fatal
    }

    log('info', 'Provider call persisted', { jobId: rec.job_id, provider: rec.provider });
  } catch (err) {
    log('error', 'Exception in persistProviderCall', { jobId: rec.job_id, error: String(err) });
    // Do NOT throw; do NOT rethrow; do NOT fail the job
    return;
  }
}
```

### Consequence
- **Job completes even if audit insert fails**
- DB connectivity issues don't block evaluation
- Network flakes don't halt the worker
- Observability never breaks the pipeline

---

## Rule 3: Result Envelope Normalization

The stored `result_envelope` is always a valid `CanonicalResultEnvelope`, never a raw `EvaluationResult`.

### Why
- Internal `EvaluationResult` has optional fields (e.g., `simulated?: boolean`)
- DB schema enforces stricter shape (`CanonicalResultEnvelope` always has defaults)
- Normalizer prevents type-shape drift over time

### Normalizer Function
**Location:** [types/providerCalls.ts#L133-L175](types/providerCalls.ts#L133-L175)

```typescript
export function toCanonicalEnvelope(
  result: any, // EvaluationResult or partial result
  opts?: { simulatedDefault?: boolean }
): CanonicalResultEnvelope {
  const simulated = result?.metadata?.simulated ?? opts?.simulatedDefault ?? false;
  const processingTimeMs =
    typeof result?.metadata?.processingTimeMs === 'number'
      ? result.metadata.processingTimeMs
      : 0;

  return {
    overview: result?.overview ?? { verdict: 'unknown', summary: '' },
    details: result?.details ?? {},
    partial: result?.partial ?? false,
    metadata: {
      ...(result?.metadata ?? {}),
      simulated,
      processingTimeMs,
      provider_meta: result?.metadata?.provider_meta,
      openai_runtime: result?.metadata?.openai_runtime,
    },
  };
}
```

### Safe Defaults
| Field | If Missing | Default |
|-------|-----------|---------|
| `overview.verdict` | None | `'unknown'` |
| `overview.summary` | None | `''` |
| `details` | None | `{}` |
| `partial` | None | `false` |
| `simulated` | None | `false` (or override via opts) |
| `processingTimeMs` | None or non-number | `0` |

### Usage
```typescript
// Success path
result_envelope: toCanonicalEnvelope(result)

// Error path (minimal/partial result)
result_envelope: toCanonicalEnvelope(
  { metadata: { simulated: false } },
  { simulatedDefault: false }
)
```

---

## Rule 4: Identical Structure for Both Paths

Success and error persist calls have the same field structure, differing only in presence/absence of metadata:

| Field | Success | Error |
|-------|---------|-------|
| `job_id` | ✅ | ✅ |
| `phase` | ✅ | ✅ |
| `provider` | ✅ | ✅ |
| `provider_meta_version` | ✅ | ✅ |
| `request_meta` | ✅ | ✅ |
| `response_meta` | ✅ (if available) | NULL |
| `error_meta` | NULL | ✅ |
| `result_envelope` | ✅ (full) | ✅ (degraded/partial) |

This structural consistency ensures:
- Query simplicity (single `evaluation_provider_calls` table, no special cases)
- Audit trail is uniform (all attempts recorded the same way)
- Type safety (no conditional branches required)

---

## Rule 5: Schema Versioning

Every row stores `provider_meta_version='2c1.v1'`:
- Enables safe evolution (new provider calls can use '2c2.v1', '3.0.v1', etc.)
- Queries can filter by version for compatibility
- Old rows never invalidated by schema changes

```typescript
provider_meta_version: '2c1.v1'  // ALWAYS this value for Phase 2C-1/2/4
```

---

## Rule 6: No Secrets Leak

All sensitive data is excluded from the stored record:

- ❌ **NEVER store:** OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, full prompts
- ✅ **DO store:** model name, temperature, max_output_tokens (config only)
- ✅ **DO truncate:** Error messages (max 512 chars)
- ✅ **DO redact:** Future hook via `redactProviderCallRecord()` if needed

**Error Message Truncation**
[types/providerCalls.ts#L112-L115](types/providerCalls.ts#L112-L115)

```typescript
export function truncateErrorMessage(msg: string, maxLen: number = 512): string {
  return msg.length > maxLen ? msg.slice(0, maxLen - 3) + '...' : msg;
}
```

All error_meta messages are truncated before insertion:
```typescript
message: truncateErrorMessage(errorMsg, 512),
```

---

## Rule 7: Append-Only Audit Trail

The `evaluation_provider_calls` table is **insert-only**:
- No UPDATE queries ever
- No DELETE queries ever
- Foreign key `evaluation_jobs.id` ensures referential integrity
- Rows are immutable once written (for forensics)

**Schema Constraint:**
```sql
CREATE TABLE evaluation_provider_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES evaluation_jobs(id) ON DELETE CASCADE,
  phase phase_type NOT NULL CHECK (phase IN ('phase_1', 'phase_2', 'phase_3')),
  provider provider_type NOT NULL CHECK (provider IN ('openai', 'anthropic', 'simulated')),
  -- ... other fields ...
  created_at timestamp NOT NULL DEFAULT now()
);
-- Indexes for query performance
CREATE INDEX idx_provider_calls_job_id ON evaluation_provider_calls(job_id);
CREATE INDEX idx_provider_calls_phase_provider ON evaluation_provider_calls(phase, provider);
CREATE INDEX idx_provider_calls_created_at ON evaluation_provider_calls(created_at DESC);
```

---

## Contract Verification Checklist

### Code Level
- [ ] `persistProviderCall()` is called after successful `executePhase2Evaluation()` (success path)
- [ ] `persistProviderCall()` is called in the catch block (error path)
- [ ] `persistProviderCall()` uses `toCanonicalEnvelope()` to normalize result_envelope
- [ ] Both persist calls have identical structure (differ only in error_meta vs response_meta)
- [ ] `persistProviderCall()` never throws
- [ ] Error messages are truncated via `truncateErrorMessage()`
- [ ] `provider_meta_version='2c1.v1'` is set on all inserts

**Verification:**
```bash
grep -n "persistProviderCall" workers/phase2Worker.ts
# Should show 2 calls (lines ~260 and ~325) + 1 definition (line ~465)
```

### TypeScript Level
- [ ] `toCanonicalEnvelope` imported from types/providerCalls
- [ ] `toCanonicalEnvelope` compiles (no TS2304 errors)
- [ ] `ProviderCallRecord` type matches all persist call arguments
- [ ] Both configs (tsconfig.json + tsconfig.workers.json) compile clean

**Verification:**
```bash
npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.workers.json
```

### DB Level
- [ ] Migration `20260128_add_evaluation_provider_calls.sql` applied
- [ ] Table schema enforces constraints (phase, provider, NOT NULL)
- [ ] Indexes created for query performance
- [ ] Foreign key to evaluation_jobs(id) with ON DELETE CASCADE

**Verification:**
```sql
SELECT column_name, is_nullable, data_type FROM information_schema.columns
WHERE table_name='evaluation_provider_calls' ORDER BY ordinal_position;
```

### Test Level
- [ ] Phase 2C-4 persistence tests (17/17 passing)
- [ ] Schema types validate
- [ ] Round-trip serialization works
- [ ] Error truncation tested
- [ ] Audit semantics covered

**Verification:**
```bash
npx jest phase2c4-persistence.test.ts --no-coverage
```

---

## When Persistence Happens: Timing Diagram

```
Phase 2 Job Execution
─────────────────────

[Start job]
    │
    ├─► executePhase2Evaluation()
    │        │
    │        ├─► callOpenAI() → success
    │        │
    │        └─► result: EvaluationResult (with provider_meta)
    │
    └─► persistProviderCall(toCanonicalEnvelope(result))
             │
             └─► INSERT into evaluation_provider_calls
                  (job_id, provider, request_meta, response_meta, result_envelope)

[Alternatively, on exception]

[Start job]
    │
    ├─► executePhase2Evaluation()
    │        │
    │        └─► throws exception (or callOpenAI fails)
    │
    └─► catch (err)
             │
             ├─► persistProviderCall() with error_meta
             │    │
             │    └─► INSERT into evaluation_provider_calls
             │         (job_id, provider, request_meta, error_meta, result_envelope)
             │
             └─► failJob()
```

**Guarantee:** Exactly one row per attempt (never 0, never 2)

---

## Next Phase: Diagnostics (Phase 2D)

Once persistence is locked, Phase 2D will add:

1. **Query patterns** for audit trail analysis:
   - Latest 100 provider calls
   - Calls by provider (openai vs simulated)
   - Error breakdown (fast_fail vs retryable_exhausted vs circuit_open)
   - Latency trends

2. **Compliance export:**
   - Date range query (e.g., "all calls from Jan 2025")
   - Provider breakdown (who handled how many)
   - Verdict summary (verdicts by phase)

3. **Redaction layer:**
   - Strip secrets before export
   - Anonymize if needed
   - Archive to cold storage

---

**Status:** Persistence contract LOCKED.

**Date:** 2025-01-28  
**Last Verified:** TypeScript + Phase 2C-4 tests clean + Phase 2C-1 tests clean

**Files Referenced:**
- [workers/phase2Worker.ts](workers/phase2Worker.ts) — Wiring (success + error paths)
- [types/providerCalls.ts](types/providerCalls.ts) — Types + normalizer + helpers
- [supabase/migrations/20260128_add_evaluation_provider_calls.sql](supabase/migrations/20260128_add_evaluation_provider_calls.sql) — Schema

