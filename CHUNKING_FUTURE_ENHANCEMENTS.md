# Chunking System: Future Enhancements

**Status**: Current system is production-ready at 100k+ user scale  
**Priority**: These are nice-to-haves for future bulletproofing, not fixes

---

## Already Solid ✅

- **Deterministic ordering**: `ORDER BY chunk_index ASC` enforced + smart audit (0 false positives)
- **Index coverage**: 7 targeted indexes, duplicate removed, <500ms at 10M rows
- **Scale thinking**: 10M row projections, crash recovery, monitoring queries
- **CI/regression safety**: Audit script, Canon Guard, clean migration trail

**Bottom line**: Would hold up at serious scale if shipped today.

---

## High-Value Enhancements (Optional)

### 1. Enforce Ordering at DB Layer (Eliminate Human Error)

**Current**: Ordering is discipline + audit rule  
**Upgrade**: Provide canonical view/function

```sql
-- Option A: View (simplest)
CREATE VIEW manuscript_chunks_ordered AS
SELECT *
FROM manuscript_chunks
ORDER BY manuscript_id, chunk_index;

-- Option B: Function (more control)
CREATE FUNCTION get_manuscript_chunks(p_manuscript_id bigint)
RETURNS SETOF manuscript_chunks
LANGUAGE sql STABLE
AS $$
  SELECT * FROM manuscript_chunks
  WHERE manuscript_id = p_manuscript_id
  ORDER BY chunk_index ASC;
$$;
```

**Benefit**: App code never queries raw table → zero ordering bugs possible

---

### 2. Guard Against Chunk Gaps (Continuity Checks)

**Risk**: `chunk_index: 0,1,2,4,5` (missing 3) breaks reassembly

**Options**:

**A. Periodic integrity check** (cron/worker):
```sql
-- Find manuscripts with gaps
SELECT manuscript_id, 
       array_agg(chunk_index ORDER BY chunk_index) as indices,
       max(chunk_index) + 1 as expected_count,
       count(*) as actual_count
FROM manuscript_chunks
GROUP BY manuscript_id
HAVING max(chunk_index) + 1 != count(*);
```

**B. Insertion-time assertion** (lib/manuscripts/chunks.ts):
```typescript
// Assert continuity before insert
const maxIndex = await getMaxChunkIndex(manuscriptId); // expect N-1
if (newChunkIndex !== maxIndex + 1) {
  throw new Error(`Gap detected: expected ${maxIndex + 1}, got ${newChunkIndex}`);
}
```

**Why it matters**:
- LLM context reconstruction
- Export/rebuild flows
- Debugging chunking logic

---

### 3. Hard Cap Chunk Size Variance

**Current**: Logical chunking strategy (assumed reasonable)  
**Upgrade**: Explicit metrics + alerts

```typescript
// lib/manuscripts/chunks.ts
const CHUNK_TOKEN_TARGET = 600;
const CHUNK_TOKEN_MIN = 400;
const CHUNK_TOKEN_MAX = 800;

async function validateChunkSize(chunk: Chunk) {
  if (chunk.token_count < CHUNK_TOKEN_MIN) {
    logger.warn('Chunk too small', { manuscript_id, chunk_index, token_count });
  }
  if (chunk.token_count > CHUNK_TOKEN_MAX) {
    logger.error('Chunk too large', { manuscript_id, chunk_index, token_count });
    // Option: reject or split
  }
}
```

**Monitoring query**:
```sql
-- Chunk size variance per manuscript
SELECT manuscript_id,
       count(*) as chunks,
       min(token_count) as min_tokens,
       max(token_count) as max_tokens,
       avg(token_count) as avg_tokens,
       stddev(token_count) as stddev_tokens
FROM manuscript_chunks
GROUP BY manuscript_id
HAVING stddev(token_count) > 200  -- alert if high variance
ORDER BY stddev_tokens DESC;
```

**Why it matters**:
- Embedding cost predictability
- Retrieval quality consistency
- LLM context window utilization

---

### 4. Partitioning Strategy (Long-Term)

**When**: 30-50M+ rows (not urgent at 10M)

**Options**:

**A. Hash partitioning by manuscript_id**:
```sql
CREATE TABLE manuscript_chunks (...)
PARTITION BY HASH (manuscript_id);

CREATE TABLE manuscript_chunks_0 PARTITION OF manuscript_chunks
  FOR VALUES WITH (MODULUS 4, REMAINDER 0);
-- etc for 1, 2, 3
```

**B. Range partitioning by created_at** (if archival):
```sql
PARTITION BY RANGE (created_at);
-- Monthly/yearly partitions
```

**Benefits**:
- Faster VACUUM (per partition)
- Reduced index depth
- Archive old manuscripts to cold storage
- Better query planner performance

**Cost**:
- Increased complexity
- Partition maintenance overhead

**Decision point**: Wait until 20M+ rows or query latency degrades

---

### 5. Observability Dashboards

**Current**: Monitoring queries documented  
**Upgrade**: Turn into visual dashboards (Grafana/Datadog)

**Metrics to track**:

```sql
-- 1. Avg chunks per manuscript
SELECT avg(chunk_count) FROM (
  SELECT manuscript_id, count(*) as chunk_count
  FROM manuscript_chunks
  GROUP BY manuscript_id
) t;

-- 2. Max chunk_index distribution
SELECT 
  CASE 
    WHEN max_idx < 50 THEN '0-49'
    WHEN max_idx < 100 THEN '50-99'
    WHEN max_idx < 200 THEN '100-199'
    ELSE '200+'
  END as bucket,
  count(*) as manuscripts
FROM (
  SELECT manuscript_id, max(chunk_index) as max_idx
  FROM manuscript_chunks
  GROUP BY manuscript_id
) t
GROUP BY bucket;

-- 3. Orphan chunks (no parent manuscript)
SELECT count(*) 
FROM manuscript_chunks c
LEFT JOIN manuscripts m ON m.id = c.manuscript_id
WHERE m.id IS NULL;

-- 4. Chunk write rate (last 5 min)
SELECT count(*) / 5.0 as chunks_per_minute
FROM manuscript_chunks
WHERE created_at > NOW() - INTERVAL '5 minutes';

-- 5. Chunk gap detection (alert)
SELECT count(DISTINCT manuscript_id) as manuscripts_with_gaps
FROM (
  SELECT manuscript_id, 
         max(chunk_index) + 1 as expected,
         count(*) as actual
  FROM manuscript_chunks
  GROUP BY manuscript_id
  HAVING max(chunk_index) + 1 != count(*)
) t;
```

**Dashboard panels**:
- Chunks per manuscript (histogram)
- Write throughput (line chart)
- Orphan chunks (counter + alert)
- Gap detection (counter + alert)
- Chunk size variance (box plot)

**Why it matters**: Turns chunking into a **measurable subsystem**, not a black box

---

## Realistic Priority

| Enhancement | When to Do It | Effort | Impact |
|------------|---------------|--------|--------|
| DB view/function | Next sprint | Low | High (eliminates ordering bugs) |
| Gap detection | When you have 1k+ manuscripts | Medium | High (data integrity) |
| Size variance metrics | Next sprint | Low | Medium (cost/quality) |
| Observability dashboard | When you have monitoring infra | Medium | High (visibility) |
| Partitioning | 30M+ rows or latency issues | High | Medium (scale ceiling) |

---

## Bottom Line

**Current state**: Production-grade SaaS, not prototype  
**Would hold up**: At serious scale if shipped today  
**These enhancements**: About elegance, future scale, safety nets—not fixing flaws

**Recommendation**: Ship what you have, add enhancements incrementally based on actual production patterns.
