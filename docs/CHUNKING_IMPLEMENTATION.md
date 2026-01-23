# Manuscript Chunking Implementation

## Overview

Implemented chunked manuscript processing for Phase 1 to solve two critical UX problems:

1. **Large files timing out** - Manuscripts are now chunked into manageable pieces
2. **Progress bar hanging** (0% → 45% → 71% → stuck) - Progress now updates after every chunk

## Implementation Details

### 1. Database Schema (`supabase/migrations/20260122000000_manuscript_chunks.sql`)

Created `manuscript_chunks` table with:
- `chunk_index` - 0-based stable index
- `char_start` / `char_end` - boundaries in staged text
- `overlap_chars` - context continuity between chunks
- `label` - structural label (e.g., "Chapter 4", "Scene 12")
- `content` - chunk text including overlap
- `content_hash` - SHA256 for idempotent updates
- `status` - pending | processing | done | failed
- `result_json` - Phase 1 analysis results

Added to `evaluation_jobs`:
- `last_heartbeat_at` - updated every 10s during chunk processing
- `last_progress_at` - updated after each chunk completes
- `partial` - flag for partial completion (some chunks failed)

### 2. Chunking Algorithm (`lib/manuscripts/chunking.ts`)

**Boundary hierarchy (strict order):**
1. **Chapter headings** (CHAPTER, Chapter, roman numerals, numeric)
2. **Scene headings** (INT./EXT. for screenplays)
3. **Section breaks** (*** or 3+ blank lines)
4. **Size-based fallback** if no structure exists

**Size parameters:**
- `MIN_CHARS = 3,000` - minimum chunk size
- `TARGET_CHARS = 8,000` - target chunk size (≈2K tokens)
- `MAX_CHARS = 12,000` - hard maximum before forced split
- `OVERLAP = 500` - overlap between chunks for context

**Results for typical manuscripts:**
- 90K novel (≈300 pages) = ~10-12 chunks
- 250K novel = ~30-40 chunks
- Progress updates every ~30 pages worth of content

### 3. Database Operations (`lib/manuscripts/chunks.ts`)

**Key functions:**
- `ensureChunks(manuscriptId)` - Create chunks if they don't exist
- `getManuscriptChunks(manuscriptId)` - Retrieve all chunks
- `updateChunkStatus(manuscriptId, chunkIndex, updates)` - Update chunk state
- `upsertChunks(manuscriptId, chunks)` - Idempotent chunk insertion

**Idempotency:**
- Chunks are upserted by (manuscript_id, chunk_index)
- If `content_hash` matches, no update
- If hash differs, content updated and status/results reset

### 4. Phase 1 Integration (`lib/jobs/phase1.ts`)

**Updated workflow:**

1. **Initialization:**
   - Call `ensureChunks()` to create chunks if needed
   - Set `total_units = chunkCount`
   - Set `completed_units = 0`

2. **Per-chunk processing:**
   - Mark chunk as "processing"
   - Start heartbeat timer (10s interval)
   - Run Phase 1 analysis (currently mocked)
   - Mark chunk as "done" with `result_json`
   - Update `completed_units++`
   - Update `last_progress_at`

3. **Progress updates:**
   - `progress = completed_units / total_units`
   - Progress bar moves after every chunk (no big jumps)
   - Heartbeat shows "alive" status during long chunks

4. **Error handling:**
   - If chunk fails, mark as "failed" but continue processing
   - Partial completion strategy for better user trust
   - Job marked as `partial=true` if some chunks failed

5. **Terminal states:**
   - All chunks done → Phase 1 "complete"
   - No chunks processed → "failed" with retry
   - Some chunks failed → "complete" with `partial=true`

## What This Fixes

✅ **No more timeouts** - Manuscripts chunked into reliable-size pieces
✅ **No more 0% → 71% jumps** - Progress updates every few minutes
✅ **No more "is it frozen?"** - Heartbeat + visible progress
✅ **Better error handling** - Partial completion for trust
✅ **Scales to any size** - 500K novel = 60-80 chunks = smooth progress

## Next Steps (Not Implemented Yet)

1. **Replace mock LLM call** in Phase 1 with actual evaluation prompt
2. **Implement manuscript text fetching** from S3/Supabase Storage
3. **Add Phase 2 convergence** to combine chunk results
4. **Optimize chunking** based on real manuscript patterns
5. **Add chunk parallelization** for faster processing (v2)

## Testing

To test the chunking system:

1. Run migration: `supabase migration up`
2. Create a job with a manuscript
3. Call `/api/jobs/:id/run-phase1`
4. Watch progress updates via `/api/jobs` polling
5. Verify chunks in `manuscript_chunks` table

## Files Changed

- ✅ `supabase/migrations/20260122000000_manuscript_chunks.sql` - Schema
- ✅ `lib/manuscripts/chunking.ts` - Chunking algorithm
- ✅ `lib/manuscripts/chunks.ts` - Database operations
- ✅ `lib/jobs/phase1.ts` - Phase 1 chunk processing
- ✅ `lib/jobs/types.ts` - Added heartbeat/progress fields
- ✅ `lib/manuscripts/` - New directory for manuscript utilities

---

**Status:** ✅ Complete - Ready for LLM integration
**Date:** 2026-01-22
**Spec Source:** ChatGPT + Perplexity + GitHub AI synthesis
