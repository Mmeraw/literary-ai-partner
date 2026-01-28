# Phase 2B: Real Data Integration (Next Steps)

**Status:** Ready to start (Phase 2A Hardening ✅ Complete)  
**Estimated Duration:** 2-3 hours  
**Prerequisites:** Phase 2A complete with zero orphaned processes/jobs  

---

## Goals for Phase 2B

After Phase 2A hardening, the worker daemon is now stable and clean. Phase 2B will make it **do useful work** by integrating real manuscript data.

### What Works Now
✅ Worker starts/stops cleanly (zero orphans)  
✅ Jobs claimed atomically with lease validation  
✅ Graceful shutdown with SIGTERM handling  
✅ Simulated evaluation completes in 2 seconds  

### What's Missing
❌ `fetchManuscriptContent()` returns placeholder text only  
❌ No real chunk aggregation  
❌ OpenAI receives dummy data, can't provide real feedback  
❌ No way to test evaluation logic with real manuscripts  

---

## Implementation: Real Manuscript Fetching

### Current Placeholder Code
**File:** [workers/phase2Worker.ts](workers/phase2Worker.ts) (around line 150)

```typescript
async function fetchManuscriptContent(manuscriptId: number): Promise<string> {
  // Placeholder: No real implementation yet
  return `Manuscript ${manuscriptId} content would be fetched from manuscript_chunks table`;
}
```

### Real Implementation Target

#### Step 1: Query manuscript_chunks

```typescript
const { data: chunks, error } = await supabase
  .from('manuscript_chunks')
  .select('chunk_number, content, type')
  .eq('manuscript_id', manuscriptId)
  .order('chunk_number', { ascending: true });

if (error) throw new Error(`Failed to fetch chunks: ${error.message}`);
if (!chunks || chunks.length === 0) {
  logger.warn(`No chunks found for manuscript ${manuscriptId}`);
  return '';
}
```

#### Step 2: Aggregate chunks in order

```typescript
const fullContent = chunks
  .map((chunk: any) => chunk.content)
  .join('\n\n');  // Double newline between chunks

logger.info(`Aggregated ${chunks.length} chunks, ${fullContent.length} chars`, {
  manuscriptId,
  chunkCount: chunks.length,
  totalChars: fullContent.length,
});

return fullContent;
```

#### Step 3: Extract summary/preview

```typescript
// Get first N characters for context window preview
const preview = fullContent.substring(0, 500) + (fullContent.length > 500 ? '...' : '');

logger.info(`Manuscript preview: ${preview}`, { manuscriptId });
```

---

## Database: Check Your manuscript_chunks Table

Before implementing, verify the table structure:

```bash
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "\d manuscript_chunks"
```

**Expected columns:**
- `id` (UUID or INT)
- `manuscript_id` (BIGINT, foreign key to manuscripts)
- `chunk_number` (INT, for ordering)
- `content` (TEXT, the actual text)
- `type` (TEXT, optional: 'title', 'chapter', 'dialogue', etc.)
- `job_id` (UUID, optional: which evaluation job processed this)
- `created_at` (TIMESTAMPTZ)

---

## Testing Strategy

### Test 1: Verify Chunk Data Exists

```bash
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
  SELECT COUNT(*) as chunk_count, manuscript_id 
  FROM manuscript_chunks 
  GROUP BY manuscript_id 
  LIMIT 5;
"
```

If result is empty, you need to seed test data:

```bash
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
  INSERT INTO manuscript_chunks (manuscript_id, chunk_number, content, created_at)
  VALUES 
    (1, 1, 'Chapter 1: The Beginning. Our story starts...', now()),
    (1, 2, 'Chapter 2: The Middle. Things get complicated...', now()),
    (1, 3, 'Chapter 3: The End. Everything resolves...', now());
"
```

### Test 2: Update fetchManuscriptContent()

Replace placeholder with real implementation above, then:

```bash
# Start worker
./scripts/worker-stop.sh || true
./scripts/release-all-leases.sh
./scripts/worker-start.sh
sleep 5

# Queue a job for manuscript ID 1
# Allowed values: policy_family IN ('standard','dark_fiction','trauma_memoir')
#                 voice_preservation_level IN ('strict','balanced','expressive')
#                 english_variant IN ('us','uk','ca','au')
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
  INSERT INTO evaluation_jobs (manuscript_id, job_type, status, policy_family, voice_preservation_level, english_variant, phase, work_type)
  VALUES (1, 'full_evaluation', 'queued', 'standard', 'balanced', 'us', 'phase_2', 'novel');
" > /dev/null

# Wait for job to process
sleep 8

# Check logs
tail -30 .worker.log | grep -E "chunk|Manuscript|Processing"
```

**Expected log output:**
```
Aggregated 3 chunks, 157 chars
Manuscript preview: Chapter 1: The Beginning. Our story starts... Chapter 2: The Middle. Things get complicated... Chapter 3: The End. ...
Job completed (simulated)
```

### Test 3: Verify Evaluation Result

```bash
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
  SELECT 
    id, 
    status, 
    evaluation_result -> 'manuscript_chars' as manuscript_size,
    evaluation_result -> 'chunks_processed' as chunks_processed
  FROM evaluation_jobs 
  WHERE status = 'complete'
  ORDER BY created_at DESC LIMIT 1;
"
```

**Expected:**
```
 id | status   | manuscript_size | chunks_processed 
----|----------|-----------------|------------------
 XX | complete | 157             | 3
```

---

## Checklist for Phase 2B

- [ ] Verify `manuscript_chunks` table exists and has data
- [ ] Update `fetchManuscriptContent()` with real implementation
- [ ] Test with single worker, single job
- [ ] Verify logs show chunk aggregation
- [ ] Verify `evaluation_result` includes manuscript data
- [ ] Test with multiple chunks (verify ordering)
- [ ] Test with missing chunks (verify error handling)
- [ ] Document any schema changes or assumptions

---

## Common Issues & Fixes

### Issue: "No chunks found for manuscript 1"
**Cause:** Chunks haven't been seeded yet  
**Fix:** Insert test chunks (see Test 1 above)

### Issue: Chunks out of order
**Cause:** `chunk_number` column missing or not in ORDER BY  
**Fix:** Verify: `.order('chunk_number', { ascending: true })`

### Issue: "Failed to fetch chunks: permission denied"
**Cause:** Supabase RLS policy blocking query  
**Fix:** Check RLS policies on `manuscript_chunks` table:

```bash
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
  SELECT * FROM pg_policies WHERE tablename='manuscript_chunks';
"
```

### Issue: Job times out (no "Job completed" message)
**Cause:** Chunk fetching or aggregation taking too long  
**Fix:** Add logging to see where it's stuck:

```typescript
logger.info('Starting chunk fetch...', { manuscriptId });
const chunks = await supabase...;  // Add timing
logger.info('Chunks fetched', { count: chunks.length, elapsed: Date.now() });
```

---

## Success Criteria

Phase 2B is complete when:

✅ Worker fetches and aggregates real manuscript chunks  
✅ Evaluation result includes `chunks_processed` count  
✅ Logs show chunk aggregation details  
✅ Job completes in <10 seconds per manuscript  
✅ No SQL errors in logs  

Once these pass, you're ready for **Phase 2C: OpenAI Integration**.

---

## Next: Phase 2C

After Phase 2B, add real OpenAI API key:

```bash
# Add to .env.staging.local
echo "OPENAI_API_KEY=sk-..." >> .env.staging.local

# Restart worker
./scripts/worker-stop.sh
./scripts/worker-start.sh

# Queue a real evaluation job
# Worker will now call OpenAI instead of simulating
```

OpenAI will receive:
- Real manuscript content (from Phase 2B) ✅
- Policy family, voice preservation level, etc.
- Return real evaluation results

---

## Questions?

Refer to:
- [PHASE2A_CANON_FIXES.md](PHASE2A_CANON_FIXES.md) - How the worker daemon works
- [workers/phase2Worker.ts](workers/phase2Worker.ts) - Worker implementation
- Database schema (via `supabase db diff`)

Good luck! 🚀
