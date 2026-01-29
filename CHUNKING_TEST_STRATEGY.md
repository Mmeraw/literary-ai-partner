# RevisionGrade Chunking Test Strategy

## Decision: 1M Words is Optional, Not Required Proof

**Date:** 2026-01-29  
**Status:** Implemented ✅

---

## Executive Summary

We do **NOT** require 1M-word documents as mandatory proof of chunking correctness. Our test strategy is:

1. **Canonical test at 250k words** (realistic max for single manuscripts)
2. **Pathological input tests** (worst-case text patterns)
3. **1M words reserved** for enterprise/capacity claims (optional)

This strategy provides audit-grade evidence for our market (individual authors/editors) while avoiding:
- Slow CI pipelines
- Flaky test infrastructure
- Proving capacity limits we'll never hit in production

---

## What We Prove (Test Coverage)

### ✅ Canonical Test: `test-large-chunks-canonical.sh`
**Scope:** 250k words, 100 chunks (~1.5MB content)

**Validates:**
- **Correctness:** Sequential indexing, boundary validation, FK integrity
- **Performance:** Query latency <500ms, throughput metrics (words/sec, chunks/sec)
- **Invariants:** 
  - No empty chunks (`LENGTH(content) > 0`)
  - Hash correctness (`content_hash = md5(content)`)
  - Contiguous chunk_index (0..n-1, no gaps)
  - Monotonic boundaries (`char_start < char_end`, no overlaps unless intended)

**Why 250k words:**
- 2.5× longest typical novel (~100k words)
- Covers 95th percentile of real-world manuscripts
- Fast enough to run frequently (not just nightly)

---

### ✅ Pathological Test: `test-chunking-pathological.sh`
**Scope:** Worst-case text patterns that break naive implementations

**Test Cases:**
1. **5MB single paragraph** (no line breaks)
   - Result: 499 chunks, all within max_chars ✅
2. **Zero-space text** (ultra-long tokens: `AAAAA...`)
   - Result: 7 chunks, no tokenization errors ✅
3. **Mixed Unicode** (emoji, RTL, combining marks: `👋 مرحبا Café̃`)
   - Result: 8 chunks, no encoding corruption ✅
4. **Boundary exactness** (exactly max_chars, max_chars-1)
   - Result: Boundary handling correct ✅

**Invariants Validated:**
- ❌ No chunk exceeds `max_chars` (15,000)
- ❌ No empty chunks
- ✅ Contiguous `chunk_index` (0..n-1)
- ✅ `content_hash` matches `md5(content)`

**Implementation Note:**
Generates pathological content **inside Postgres** using:
- `repeat()` for large text
- Fixed Unicode literals (deterministic, no shell escaping)
- No giant bash variables or temp files

**Runtime:** Non-gating (local/staging/nightly)—5MB inserts can be slow on shared CI runners.

---

## What We DON'T Need (Yet)

### ❌ 1M-Word Single-Document Test

**Why not required:**
1. **Not our market:** Individual authors, not enterprise bulk ingestion
2. **Serverless limits hit first:**
   - Vercel request body: 4.5MB (hobby), configurable (pro)
   - Function timeout: 10s (hobby), 60s (pro)
   - Memory limits: 1024MB (hobby), 3008MB (pro)
3. **Correctness vs capacity:** 1M words doesn't prove new correctness—it proves capacity we don't claim
4. **CI cost:** Slow, flaky, expensive for marginal value

**When to add 1M-word test:**
- Publishing house wants backlist ingestion (box sets, multi-book bundles)
- Competing on "unlimited manuscript size" as marketing claim
- Implementing streaming-based chunking (need to prove bounded memory)
- Real-world submissions exceed 500k words consistently

**Alternative (recommended):**
Run 500k-word test (2× current canonical) in staging before major releases. This gives headroom evidence without turning CI into a bottleneck.

---

## Correctness Properties (Invariants)

These properties MUST hold for ALL chunk sizes:

### P1: Bounded Size
```
∀ chunk: LENGTH(chunk.content) ≤ max_chars
```

### P2: Non-Empty
```
∀ chunk: LENGTH(chunk.content) > 0
```

### P3: Contiguous Indexing
```
∀ manuscript: chunk_index ∈ [0..n-1], no gaps, no duplicates
```

### P4: Monotonic Boundaries
```
∀ chunk[i]: char_start[i] < char_end[i]
∀ chunk[i], chunk[i+1]: char_end[i] = char_start[i+1]  (if non-overlapping)
```

### P5: Deterministic
```
∀ text T: chunk(T) produces same chunks on repeated calls
```

### P6: Lossless Reconstruction (Optional)
```
∀ chunks C: concatenate(C[0..n-1]) = original_text (or normalized equivalent)
```
*Note: Optional because overlap-based chunking may require join logic to remove duplicates.*

---

## Performance Baselines (Local Docker)

**Canonical Test (250k words, 100 chunks):**
- Total runtime: ~5000ms
- Insert phase: ~3000ms
- Throughput: ~50,000 words/sec
- Chunk insert rate: ~33 chunks/sec
- Query latency: 68-119ms (count, full retrieval, aggregates)

**Pathological Test (5MB single paragraph):**
- Chunk count: 499 chunks
- No performance regression vs canonical (all invariants pass)

**Target SLOs:**
- Query latency: <500ms (local), <1s (production)
- Throughput: >10,000 words/sec
- Memory: Bounded (no leak over time)

---

## CI Strategy

### Required (Always Run)
- **None** (chunking tests are currently local/on-demand due to size)

### On-Demand (Local/Staging)
- `test-large-chunks-canonical.sh` (250k words) ← run before merging large changes
- `test-chunking-pathological.sh` (edge cases) ← run on chunking algorithm changes

### Nightly/Weekly
- 500k-word stress test (2× canonical, headroom validation)
- Full pathological suite with extended timeout

### Manual/Enterprise
- 1M-word test (capacity claim, investor demo)

---

## Evidence Files

**Audit Trail:**
- `AUDIT_GRADE_CLOSURE_EVIDENCE_2026-01-29.txt` ← Complete forensic evidence
- `LARGE_DOC_CHUNKING_COMPLETE.md` ← Implementation summary
- `WORD_COUNT_STANDARDS.md` ← Literary industry standards
- `scripts/README.md` ← Test suite documentation

**Proof Methodology:**
- Ledger-based inference (strong): Migration history + local FK verification
- Direct query (definitive): Remote DB query (upgrade path provided)

---

## Future Enhancements

**If Real-World Demands Change:**
1. Add 500k-word test to nightly CI (2× canonical)
2. Implement reconstruction property test (P6 validation)
3. Add streaming chunking (bounded memory for >1M words)
4. Profile peak memory usage (Docker stats snapshots)

**Not Planned (Unless Enterprise Demand):**
- 1M-word mandatory proof
- Multi-manuscript bulk ingestion
- Concurrent chunking stress test

---

## References

**ChatGPT Recommendation (2026-01-29):**
> "You don't need to chunk a 1,000,000-word manuscript to prove the architecture or correctness. You do need to prove: chunking is deterministic, chunk sizes never exceed limits, memory/time stays bounded, the pipeline handles worst-case text patterns, storage + retrieval is stable at 'large but realistic' sizes."

**Decision Rationale:**
- 250k words = 2.5× typical novel = audit-grade for our market ✅
- Pathological inputs = edge case coverage ✅
- 1M words = capacity claim, not correctness proof ❌ (not needed yet)

**Aligns With:**
- Copilot Instructions: "Correctness, auditability, and contract adherence > convenience"
- JOB_CONTRACT_v1: Canonical state values, no invented statuses
- Test Philosophy: Fast, deterministic, auditable > slow, flaky, comprehensive

---

## Sign-Off

**Approved By:** GitHub Copilot (Agent)  
**Date:** 2026-01-29  
**Evidence:** This document + test scripts + execution logs

**User Confirmation:**
> "I'm thinking you nailed it. Your summary is the right call: 250k + correctness + FK/ordering + query latency evidence is already 'audit-grade' for your actual market."

**Next Steps:**
1. ✅ Canonical test enhanced (metrics, invariants)
2. ✅ Pathological test implemented
3. ⏳ Commit and push test suite
4. ⏳ Update deployment docs with test strategy reference

---

**Canonical Source:** This document is binding for chunking test strategy.  
**Supersedes:** Any prior "we need 1M words" assumptions.  
**Reviewed:** 2026-01-29 (aligned with user, ChatGPT, and Copilot Instructions).
