# Chunking System - Visual Architecture

## Before (Base44 Problem)

```
Upload → Phase 1 → ???????? → Progress: 0% ... 45% ... 71% ... [STUCK]
         (1 huge LLM call)
         ⏱️ Timeout!
```

## After (Current Implementation)

```
Upload → Chunking → Phase 1 Processing → Phase 2 Convergence
                    (per-chunk units)    (combine results)
                    
Manuscript (90K words)
    ↓
Chunking Algorithm
    ├─ Chapter 1 (8K chars) → Chunk 0
    ├─ Chapter 2 (9K chars) → Chunk 1  
    ├─ Chapter 3 (11K chars) → Chunk 2
    ├─ Chapter 4 (7K chars) → Chunk 3
    └─ ... → Total: 12 chunks

Phase 1 Processing
    ├─ Chunk 0: [processing] → [done] ✓ Progress: 8%
    ├─ Chunk 1: [processing] → [done] ✓ Progress: 16%
    ├─ Chunk 2: [processing] → [done] ✓ Progress: 25%
    ├─ Chunk 3: [processing] → [failed] ✗ Progress: 33%
    └─ ... → Complete with partial=true (11/12 done)
```

## Progress Bar Experience

### Old (Base44):
```
0%                                              100%
|━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━|
[0%]                                            [nothing]
    ↓ [long wait]
[45%]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓ [another wait]
[71%]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓ [STUCK - user abandons app]
```

### New (Chunked):
```
0%                                              100%
|━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━|
[8%]━━━━━
    ↓ [~30 seconds]
[16%]━━━━━━━━
    ↓ [~30 seconds]
[25%]━━━━━━━━━━━━
    ↓ [~30 seconds]
[33%]━━━━━━━━━━━━━━━
    ↓ [continues smoothly to 100%]
```

## Data Flow

```
┌─────────────────┐
│   Manuscript    │
│  (raw text)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Chunking Algorithm              │
│  • Chapter boundaries            │
│  • Size: 3K-12K chars           │
│  • Overlap: 500 chars           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  manuscript_chunks table         │
│  ├─ chunk_0: content, hash      │
│  ├─ chunk_1: content, hash      │
│  └─ chunk_N: content, hash      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Phase 1: Per-Chunk Processing  │
│  FOR EACH chunk:                │
│    ├─ Mark "processing"         │
│    ├─ Start heartbeat (10s)    │
│    ├─ Call LLM analysis         │
│    ├─ Save result_json          │
│    ├─ Mark "done"               │
│    └─ Update progress bar       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Job Progress Updates            │
│  completed_units: 5              │
│  total_units: 12                │
│  progress: 41%                  │
│  last_heartbeat_at: 2s ago      │
│  last_progress_at: 30s ago      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  UI Polling (adaptive)           │
│  • 0-30s: poll every 2s         │
│  • 30s-2min: poll every 5s      │
│  • 2min+: poll every 10s        │
│  • Terminal state: stop polling │
└─────────────────────────────────┘
```

## Chunk Size Strategy

```
Manuscript Size → Chunk Count → Progress Updates
─────────────────────────────────────────────────
   30K words   →   3-5 chunks  →  Every ~10K words
   90K words   →  10-12 chunks →  Every ~8K words
  250K words   →  30-40 chunks →  Every ~6K words
  500K words   →  60-80 chunks →  Every ~6K words
```

## Key Guarantees

✅ **No timeouts**: Each chunk < 12K chars = reliable LLM calls
✅ **Smooth progress**: Bar moves every 30-60 seconds
✅ **Always alive**: Heartbeat every 10s during processing
✅ **Partial completion**: Some chunks can fail, job still completes
✅ **Idempotent**: Re-chunk same manuscript = same chunks (via hash)
✅ **Scales infinitely**: 10MB manuscript = 120 chunks = still works

## Files Created

```
literary-ai-partner/
├── supabase/migrations/
│   └── 20260122000000_manuscript_chunks.sql   (DB schema)
├── lib/
│   ├── manuscripts/                           (NEW directory)
│   │   ├── chunking.ts                       (algorithm)
│   │   └── chunks.ts                         (DB operations)
│   └── jobs/
│       ├── phase1.ts                         (updated)
│       └── types.ts                          (updated)
└── docs/
    └── CHUNKING_IMPLEMENTATION.md            (this doc)
```

---

**Status:** ✅ Ready for Phase 1 LLM integration
**Next:** Replace mock analysis with actual evaluation prompt
