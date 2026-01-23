# Chunk Processing Stability - Test Summary

## ✅ All Tests Passing (8/8)

Last run: 2026-01-23  
Test file: `tests/manuscript-chunks-stability.test.ts`  
Environment: Supabase staging (`ngfszuqjoyixmtlbthyv`)

### Test Results

```
✓ only one worker can claim the same chunk under concurrent load (720 ms)
✓ failed chunks can be reclaimed, but only one worker succeeds (711 ms)
✓ processing chunks stuck beyond lease become eligible for recovery (1235 ms)
✓ non-stuck processing chunks are not eligible for recovery (776 ms)
✓ done chunks cannot be claimed and are immutable (647 ms)
✓ failed chunks at max attempts are immutable (651 ms)
✓ chunk cannot transition from done to any other state (664 ms)
✓ chunk survives worker crash and is successfully reprocessed (1443 ms)
```

## Running the Tests

### Prerequisites

Set environment variables for the staging Supabase project:

```bash
export SUPABASE_URL="https://ngfszuqjoyixmtlbthyv.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
```

### Run Stability Tests

```bash
npm test -- manuscript-chunks-stability.test.ts
```

### Run All Tests

```bash
# Make sure env vars are set first!
npm test
```

## What These Tests Validate

### 1. Atomic Claiming (Contract Test 1)
- ✅ Only one concurrent worker can claim a pending chunk
- ✅ Failed chunks can be retried, but only one worker succeeds
- **Guarantee**: No double-processing, no race conditions

### 2. Crash Recovery (Contract Test 2)
- ✅ Chunks with expired leases become eligible for recovery
- ✅ Recently-claimed chunks are NOT eligible (prevents stealing)
- **Guarantee**: Worker crashes don't leave chunks orphaned

### 3. Terminal Immutability (Contract Test 3)
- ✅ Done chunks cannot be claimed again
- ✅ Chunks at max_attempts cannot be retried
- ✅ State transitions are irreversible (done → any = forbidden)
- **Guarantee**: Completed work is never reprocessed

### 4. Full Crash-Recovery Cycle (Integration)
- ✅ Worker 1 claims → crashes → Worker 2 detects → reclaims → completes
- ✅ Attempt count increments correctly through recovery
- **Guarantee**: End-to-end resilience works in practice

## Database Setup

The tests require these columns in `manuscript_chunks`:

```sql
lease_id uuid NULL
lease_expires_at timestamptz NULL
max_attempts integer NULL DEFAULT 3
```

Applied via migrations:
- `20260123222852_add_manuscript_chunks_lease_fields.sql`
- `20260123222958_update_claim_chunk_function_with_lease.sql`

## RPC Function

`claim_chunk_for_processing(p_chunk_id, p_worker_id, p_lease_seconds)` enforces:

```sql
-- Eligible if:
status = 'pending'
OR (status = 'failed' AND attempt_count < max_attempts)
OR (status = 'processing' AND lease_expires_at <= now())

-- Never eligible if:
status = 'done'
OR attempt_count >= max_attempts
```

## Troubleshooting

### "column lease_expires_at does not exist"

Check which Supabase project your CLI is linked to:

```bash
npx supabase projects list
# Should show ● (linked) next to ngfszuqjoyixmtlbthyv
```

If wrong, relink:

```bash
npx supabase link --project-ref ngfszuqjoyixmtlbthyv
npx supabase db push
```

### "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL"

Set the environment variable correctly:

```bash
# ❌ Wrong (literal dots)
SUPABASE_URL="..."

# ✅ Right (actual URL)
SUPABASE_URL="https://ngfszuqjoyixmtlbthyv.supabase.co"
```

### Tests fail on CI/CD

Ensure secrets are set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Example GitHub Actions:

```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_STAGING_URL }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_STAGING_SERVICE_ROLE_KEY }}
```

## Next Steps

1. **Add to CI/CD**: Run these tests on every PR
2. **Monitor in Production**: Set up alerts for chunks stuck > 10 minutes
3. **Optimize Lease Duration**: Tune based on actual LLM call times
4. **Add Metrics**: Track recovery rates, attempt distributions

---

**Status**: ✅ Production-ready  
**Last Updated**: 2026-01-23  
**Maintainer**: @Mmeraw
