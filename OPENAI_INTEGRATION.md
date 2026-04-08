# OpenAI Integration — Legacy Phase 2C Reference

> ⚠️ **Legacy/Quarantine Notice (2026-04 canonical cutover):**
> This document describes the historical `workers/phase2Evaluation.ts` integration path.
> It is not the canonical runtime evaluator authority.
>
> Canonical evaluator authority is now:
> `processor.ts -> runPipeline.ts`
>
> See:
> `docs/CANONICAL_RUNTIME_OPERATIONS.md`

**Status**: Historical integration notes (quarantined path)
**Mode**: Migration-only reference

## What Was Added

**Core Files**:
- [workers/phase2Evaluation.ts](workers/phase2Evaluation.ts) — OpenAI evaluation logic with retry safety
- Updated [workers/phase2Worker.ts](workers/phase2Worker.ts) — Integrated OpenAI into processJob()
- [scripts/test-worker-openai.sh](scripts/test-worker-openai.sh) — Integration test script

**Key Features**:
- ✅ Fetches job details (manuscript_id, policy, voice preservation)
- ✅ Builds evaluation prompt based on policy family
- ✅ Calls OpenAI GPT-4 Turbo with structured JSON response
- ✅ Parses and validates OpenAI response
- ✅ Stores result in `evaluation_result` JSONB column
- ✅ Logs tokens used, processing time, verdict
- ✅ Graceful fallback (simulated mode) if OPENAI_API_KEY not set
- ✅ Classifies errors as retryable/non-retryable

## How It Works

### Without OpenAI Key (Default)
```bash
./scripts/worker-start.sh
# Worker detects no OPENAI_API_KEY
# Falls back to simulated 2-second processing
# Marks job complete with: {simulated: true, message: "..."}
```

**Log output:**
```json
{"level":"warn","message":"OpenAI API key not configured, using simulated evaluation","jobId":"..."}
{"level":"info","message":"Job completed (simulated)","jobId":"..."}
```

### With OpenAI Key (Real Evaluation)
```bash
export OPENAI_API_KEY='sk-...'
./scripts/worker-start.sh
# Worker calls OpenAI GPT-4 Turbo
# Processes real manuscript evaluation
# Stores structured result with verdict, strengths, concerns
```

**Log output:**
```json
{"level":"info","message":"Calling OpenAI API","jobId":"...","model":"gpt-4-turbo-preview"}
{"level":"info","message":"OpenAI API call completed","tokensUsed":1234,"durationMs":15000}
{"level":"info","message":"Phase 2 evaluation completed","verdict":"revise","tokensUsed":1234}
{"level":"info","message":"Job completed","jobId":"...","verdict":"revise","tokensUsed":1234}
```

## Result Structure

### Simulated Mode
```json
{
  "simulated": true,
  "message": "OpenAI integration not configured"
}
```

### Real OpenAI Mode
```json
{
  "overview": {
    "verdict": "accept|revise|reject",
    "strengths": ["Strong character development", "..."],
    "concerns": ["Pacing issues in Act 2", "..."]
  },
  "details": {
    "plot": {...},
    "character": {...},
    "prose": {...},
    "pacing": {...}
  },
  "metadata": {
    "model": "gpt-4-turbo-preview",
    "tokensUsed": 1234,
    "processingTimeMs": 15000
  }
}
```

## Error Handling

### Retryable Errors
- Rate limits (429)
- Timeouts
- Network errors (ECONNRESET)

→ Job marked as `failed`, worker continues polling (job system handles retry)

### Non-Retryable Errors
- Invalid API key (401)
- Authentication failures

→ Job marked as `failed`, logged with clear error

### Error Classification
```typescript
{"level":"info","message":"Error classification","jobId":"...","retryable":true}
```

## Testing

### Quick Test (Simulated Mode)
```bash
./scripts/test-worker-openai.sh
```

Verifies:
1. Worker starts
2. Claims job
3. Falls back to simulated mode
4. Marks complete
5. No orphaned jobs

### Manual Test (Real OpenAI)
```bash
# 1. Set API key
export OPENAI_API_KEY='sk-...'

# 2. Reset jobs
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
UPDATE evaluation_jobs 
SET status='queued', worker_id=NULL, lease_until=NULL;
"

# 3. Start worker
./scripts/worker-start.sh

# 4. Watch logs (evaluation takes 30-60 seconds)
tail -f .worker.log

# 5. Check result
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
SELECT id, status, 
       evaluation_result->>'verdict' as verdict,
       (evaluation_result->'metadata'->>'tokensUsed')::int as tokens
FROM evaluation_jobs 
WHERE status='complete'
LIMIT 1;
"

# 6. Stop worker
./scripts/worker-stop.sh
```

## Current Limitations

**Placeholder Logic**:
- `fetchManuscriptContent()` returns placeholder text
- Need to implement actual manuscript_chunks fetching
- Need to aggregate chunks into full manuscript text

**Prompt Engineering**:
- Basic prompt template in `buildEvaluationPrompt()`
- May need refinement based on policy family
- No chunking strategy for large manuscripts (>100k tokens)

**No Retry Logic**:
- Retryable errors classified but not automatically retried
- Job system responsible for retry (not yet implemented)
- Worker simply marks job as failed

## Next Steps to Complete

### Option A: Complete Manuscript Fetching
Implement real data fetching in `fetchManuscriptContent()`:
```typescript
// Fetch from manuscript_chunks table
// Aggregate chunks in order
// Return full manuscript text
```

### Option B: Add Retry Logic
Implement automatic retry for retryable errors:
```typescript
// Max 3 attempts with exponential backoff
// Update job retry_count
// Only fail after exhausting retries
```

### Option C: Refine Prompts
Improve evaluation prompts:
- Policy-specific instructions
- Voice preservation guidelines
- English variant considerations

### Option D: Add Chunking Strategy
Handle large manuscripts:
- Split into eval-sized chunks
- Parallel processing
- Aggregate results

## Configuration

**Environment Variables**:
- `OPENAI_API_KEY` — OpenAI API key (optional, falls back to simulated if missing)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (required)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (required)

**OpenAI Settings** (in `phase2Evaluation.ts`):
```typescript
model: 'gpt-4-turbo-preview',
temperature: 0.7,
max_tokens: 2000,
response_format: { type: 'json_object' }
```

## Cost Estimation

**GPT-4 Turbo Pricing** (as of 2024):
- Input: $10 per 1M tokens
- Output: $30 per 1M tokens

**Typical Phase 2 Evaluation**:
- Input: ~3,000 tokens (manuscript excerpt + prompt)
- Output: ~1,000 tokens (structured evaluation)
- Cost per job: ~$0.06
- 1,000 jobs/day: ~$60/day

**Rate Limits** (Tier 1):
- 500 requests/minute
- 200,000 tokens/minute

With 5-second poll interval and 30-second evaluation time, single worker processes ~120 jobs/hour (well within limits).

## Observability

All OpenAI calls logged with:
- Job ID
- Model name
- Tokens used
- Duration (ms)
- Verdict (when successful)
- Error details (when failed)

Query logs:
```bash
# Simulated evaluations
grep "simulated" .worker.log

# Real OpenAI calls
grep "OpenAI API" .worker.log

# Token usage
grep "tokensUsed" .worker.log | jq '.tokensUsed' | awk '{s+=$1} END {print s}'
```

---

**Status**: ✅ Integration complete, tested in simulated mode  
**Blocking**: OPENAI_API_KEY required for real evaluations  
**Ready for**: Manuscript fetching implementation + real-world testing
