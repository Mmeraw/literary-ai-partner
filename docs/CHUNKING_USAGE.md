# Chunking System - Usage Guide

## For Developers

### 1. Running the Migration

```bash
# Apply the manuscript_chunks schema
cd /workspaces/literary-ai-partner
supabase migration up

# Or if using Supabase CLI with project
supabase db push
```

### 2. Using the Chunking API

```typescript
import { chunkManuscript } from '@/lib/manuscripts/chunking';
import { ensureChunks, getManuscriptChunks } from '@/lib/manuscripts/chunks';

// Example 1: Chunk text directly
const text = "Your manuscript content...";
const chunks = await chunkManuscript(text);

console.log(`Created ${chunks.length} chunks`);
// Example output:
// Chunk 0: "Chapter 1" (8,245 chars)
// Chunk 1: "Chapter 2" (9,102 chars)
// Chunk 2: "Chapter 3" (11,567 chars)

// Example 2: Ensure chunks exist for a manuscript
const manuscriptId = 42;
const chunkCount = await ensureChunks(manuscriptId);
console.log(`Manuscript ${manuscriptId} has ${chunkCount} chunks`);

// Example 3: Get all chunks for processing
const chunks = await getManuscriptChunks(manuscriptId);
for (const chunk of chunks) {
  console.log(`Chunk ${chunk.chunk_index}: ${chunk.label} (${chunk.status})`);
}
```

### 3. Custom Chunking Configuration

```typescript
import { chunkManuscript, ChunkingConfig } from '@/lib/manuscripts/chunking';

// Override default sizes
const config: Partial<ChunkingConfig> = {
  minChars: 5000,     // Larger minimum
  targetChars: 10000, // Larger target
  maxChars: 15000,    // Larger maximum
  overlapChars: 800,  // More overlap for context
};

const chunks = await chunkManuscript(text, config);
```

### 4. Integrating Phase 1 LLM Calls

**Current state (mock):**
```typescript
// lib/jobs/phase1.ts line ~195
const mockResult = {
  chunk_index: chunk.chunk_index,
  analysis: "Phase 1 analysis placeholder",
  processed_at: new Date().toISOString(),
};
```

**Replace with actual LLM call:**
```typescript
// Import your LLM client
import { callLLM } from '@/lib/llm';

// In the chunk processing loop:
try {
  // Build Phase 1 prompt
  const prompt = buildPhase1Prompt(chunk.content, job.work_type);
  
  // Call LLM
  const response = await callLLM({
    model: "claude-3-opus-20240229",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4096,
  });

  // Parse response
  const analysis = parsePhase1Response(response);

  // Save result
  await updateChunkStatus(manuscriptIdNum, chunk.chunk_index, {
    status: "done",
    result_json: {
      chunk_index: chunk.chunk_index,
      analysis,
      tokens_used: response.usage.total_tokens,
      processed_at: new Date().toISOString(),
    },
  });

  processed = i + 1;

} catch (chunkError) {
  // Error handling (already implemented)
  await updateChunkStatus(manuscriptIdNum, chunk.chunk_index, {
    status: "failed",
    error: chunkError instanceof Error ? chunkError.message : String(chunkError),
  });
}
```

### 5. Testing the System

```bash
# 1. Start development server
npm run dev

# 2. Create a test manuscript (via UI or API)
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "manuscript_id": "1",
    "job_type": "evaluate_full",
    "work_type": "novel"
  }'

# 3. Start Phase 1 processing
curl -X POST http://localhost:3000/api/jobs/{job_id}/run-phase1

# 4. Watch progress (poll every 2s)
watch -n 2 'curl -s http://localhost:3000/api/jobs | jq ".jobs[0].progress"'

# Expected output (every 30s):
# {
#   "phase": "phase1",
#   "phase_status": "running",
#   "completed_units": 5,
#   "total_units": 12,
#   "message": "Processed Chapter 5"
# }
```

### 6. Database Queries for Monitoring

```sql
-- Check chunks for a manuscript
SELECT 
  chunk_index,
  label,
  status,
  char_start,
  char_end,
  LENGTH(content) as content_length,
  overlap_chars,
  created_at
FROM manuscript_chunks
WHERE manuscript_id = 1
ORDER BY chunk_index;

-- Check job progress
SELECT 
  id,
  status,
  progress->>'completed_units' as completed,
  progress->>'total_units' as total,
  progress->>'message' as message,
  last_progress_at,
  last_heartbeat_at
FROM evaluation_jobs
WHERE id = 'your-job-id';

-- Check failed chunks
SELECT 
  manuscript_id,
  chunk_index,
  label,
  error,
  updated_at
FROM manuscript_chunks
WHERE status = 'failed'
ORDER BY updated_at DESC;
```

## For Product/QA

### Testing Checklist

- [ ] **Small manuscript (30K words)**
  - Should create 3-5 chunks
  - Progress updates every ~1 minute
  - Completes in 3-5 minutes

- [ ] **Medium manuscript (90K words)**
  - Should create 10-12 chunks
  - Progress updates every ~30-60 seconds
  - Completes in 10-15 minutes

- [ ] **Large manuscript (250K words)**
  - Should create 30-40 chunks
  - Progress updates every ~20-40 seconds
  - Completes in 30-45 minutes

- [ ] **Progress bar behavior**
  - Starts at 0%
  - Moves incrementally (never jumps more than 10%)
  - Shows "alive" heartbeat during processing
  - Reaches 100% at completion

- [ ] **Error handling**
  - If one chunk fails, others continue
  - Job completes with `partial=true`
  - Failed chunks shown in UI

- [ ] **Cancellation**
  - Can cancel mid-processing
  - Chunks already completed are saved
  - Can resume later (TODO)

### Expected UX

**Old Base44 experience:**
```
[Upload] → [0%] → ... → [45% after 5 min] → ... → [71% after 10 min] → [STUCK]
User: "Is it frozen? I'll just leave..."
```

**New chunked experience:**
```
[Upload] → [8%] → [16%] → [25%] → [33%] → ... → [100% Complete]
         30s    30s     30s     30s
User: "I can see it's working! I'll wait."
```

## Troubleshooting

### "Chunks not being created"

Check:
1. Is `getManuscriptText()` returning actual content?
2. Is the manuscript_id valid?
3. Are there migration errors?

```typescript
// Debug in lib/manuscripts/chunks.ts
export async function ensureChunks(manuscriptId: number): Promise<number> {
  const existing = await getManuscriptChunks(manuscriptId);
  console.log(`[DEBUG] Existing chunks: ${existing.length}`);
  
  if (existing.length > 0) {
    return existing.length;
  }

  const text = await getManuscriptText(manuscriptId);
  console.log(`[DEBUG] Manuscript text length: ${text.length}`);
  
  const chunks = await chunkManuscript(text);
  console.log(`[DEBUG] Generated ${chunks.length} chunks`);
  
  await upsertChunks(manuscriptId, chunks);
  return chunks.length;
}
```

### "Progress not updating"

Check:
1. Is polling active in the UI?
2. Is `last_progress_at` being updated?
3. Are chunks actually completing?

```sql
-- Check if progress is moving
SELECT 
  id,
  progress->>'completed_units' as completed,
  last_progress_at,
  NOW() - last_progress_at as time_since_progress
FROM evaluation_jobs
WHERE id = 'your-job-id';
```

### "All chunks failing"

Check:
1. Is the LLM API key valid?
2. Is the prompt too large?
3. Are there rate limits?

```sql
-- See error messages
SELECT chunk_index, error, updated_at
FROM manuscript_chunks
WHERE manuscript_id = 1 AND status = 'failed'
ORDER BY chunk_index;
```

## Next Steps

1. **Implement actual LLM calls** (replace mock in phase1.ts)
2. **Add manuscript text fetching** (replace placeholder in chunks.ts)
3. **Build Phase 2 convergence** (combine chunk results)
4. **Add resumption logic** (restart from last completed chunk)
5. **Optimize chunk sizes** (tune based on real data)
6. **Add parallel processing** (process multiple chunks at once - v2)

---

**Questions?** Check [CHUNKING_IMPLEMENTATION.md](./CHUNKING_IMPLEMENTATION.md) or [CHUNKING_ARCHITECTURE.md](./CHUNKING_ARCHITECTURE.md)
