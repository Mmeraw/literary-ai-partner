# Resume + Skip Completed - Quick Reference

## 🎯 What It Does

Enables Phase 1 to automatically resume from failures and skip already-completed chunks.

## 🔑 Key Functions

### 1. Get Work To Do
```typescript
const eligibleChunks = await getEligibleChunks(manuscriptId, 3);
// Returns: status IN ('pending', 'failed') AND attempt_count < 3
// Automatically skips 'done' chunks
```

### 2. Claim Exclusive Access
```typescript
const claimed = await claimChunkForProcessing(chunk.id);
if (!claimed) {
  continue; // Another worker got it, or it's already done
}
// Process chunk (guaranteed no duplicate work)
```

### 3. Record Success
```typescript
await updateChunkStatus(manuscriptId, chunkIndex, {
  status: 'done',
  result_json: result,
  last_error: null,
});
```

### 4. Record Failure (Preserve Success)
```typescript
await updateChunkStatus(manuscriptId, chunkIndex, {
  status: 'failed',
  last_error: errorMessage,
  // result_json NOT cleared - preserves prior success
});
```

## 📊 Job Outcomes

| All Done | Some Failed | Pending Work | Outcome | Partial |
|----------|-------------|--------------|---------|---------|
| ✅ | ❌ | ❌ | Completed | false |
| ✅ | ✅ | ❌ | Completed | true |
| ❌ | ✅ | ✅ | Running | false |
| ❌ | ✅ | ❌ | Failed | false |

## 🔄 Resume Workflow

### First Run
```
Chunks: [P, P, P, P, P, P, P, P, P, P]
Result: [D, D, D, D, D, D, D, F, D, D]
Job: Completed (partial=true)
```

### Second Run (Automatic Resume)
```
Eligible: [F] (index 7 only)
Result: [D, D, D, D, D, D, D, D, D, D]
Job: Completed (partial=false)
```

## 🚀 Running Tests

```bash
# All tests
npm test

# Specific test
npm test -- lib/jobs/phase1.test.ts

# Build check
npm run build

# Verify implementation
bash scripts/verify-resume-implementation.sh
```

## 📁 Files Changed

1. `supabase/migrations/20260122000000_manuscript_chunks.sql` - Schema updates
2. `supabase/migrations/20260122000001_claim_chunk_function.sql` - Atomic claim RPC
3. `lib/manuscripts/chunks.ts` - New functions
4. `lib/jobs/phase1.ts` - Updated runner logic

## 📚 Documentation

- Full Guide: [docs/RESUME_SKIP_COMPLETED.md](docs/RESUME_SKIP_COMPLETED.md)
- Summary: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

## ⚙️ Database Migration

```bash
# Apply migrations to local Supabase
supabase db push

# Or apply to remote
supabase db push --linked
```

## 🎭 Acceptance Test

1. Force failures (set LLM stub failure rate to 30%)
2. Run Phase 1 → Expect partial completion
3. Reset failure rate to normal
4. Run Phase 1 again → Expect full completion (only failed chunks reprocessed)

## ⚡ Quick Wins

✅ **Idempotent**: Safe to run multiple times  
✅ **Automatic**: No manual intervention needed  
✅ **Atomic**: No duplicate work in concurrent scenarios  
✅ **Preserves Success**: Results never overwritten  
✅ **Partial Progress**: Jobs with failures can still proceed  

## 🐛 Known Limitations

- Chunks stuck in 'processing' (from crashed workers) not auto-reset
- No admin "retry all" function yet
- High concurrency may cause inefficient skipping (safe but slower)

## 📞 Support

See [docs/RESUME_SKIP_COMPLETED.md](docs/RESUME_SKIP_COMPLETED.md) for detailed implementation guide.
