# PR-E Baseline Audit — captured pre-merge

**Capture time:** 2026-05-16 05:10 UTC (2026-05-15 22:10 MST)
**Production SHA at capture:** `a0f582d` (PR-D merge commit)
**Audit threshold:** `SUM(LENGTH(content)) > file_size × 1.3`

## Affected manuscripts (3 found)

| manuscript_id | Title | Canonical words | file_size (bytes) | chunk_count | chunks_total_content_chars | chunker_indexed_chars | overlap_chars | content/file ratio |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 6117 | Froggin Noggin FULL NOVEL (25 Apr 2022) | 105,247 | 518,726 | 41 | 1,347,100 | 1,227,100 | 120,000 | **2.60×** |
| 6054 | Cartel_Babies_Italics removed (31 Mar 2026) | 112,975 | 597,202 | **99** | 887,234 | 838,234 | 49,000 | **1.49×** |
| 6073 | Froggin Noggin (first 100 pages) (26 Apr 2022) | 51,252 | 270,423 | 36 | 371,077 | 353,577 | 17,500 | **1.37×** |

## Post-PR-E success expectations

After PR-E merge + Vercel deploy + scoped chunk deletion for these 3 IDs + a single re-evaluation of each:

| manuscript_id | Expected chunk_count (mid-bracket ~21K target) | Expected content/file ratio | Expected chunker_indexed_chars |
|---|---:|---:|---:|
| 6117 | ~25-30 | ~1.0-1.2× | ~520K-640K |
| 6054 | ~28-32 | ~1.0-1.2× | ~600K-720K |
| 6073 | ~12-15 | ~1.0-1.2× | ~270K-330K |

## Cost regression estimate (informal)

For 6054 alone: 99 chunks vs expected ~28 = **71 extra GPT-5.1 calls per Pass × 2 passes = ~142 extra calls per evaluation**. Multiplied across however many eval runs this manuscript has had, that's the silent overbilling magnitude.

## Cleanup SQL (RUN ONLY AFTER PR-E DEPLOYED AND SHA CONFIRMED)

```sql
-- Scoped delete: only the three audited inflated manuscripts
DELETE FROM manuscript_chunks
WHERE manuscript_id IN (6054, 6073, 6117);
```

Pre-delete safety check (verify no in-flight jobs):
```sql
SELECT id, manuscript_id, status, phase
FROM evaluation_jobs
WHERE manuscript_id IN (6054, 6073, 6117)
  AND status IN ('running', 'queued', 'pending');
```
If that returns 0 rows, the DELETE is safe.

## Post-merge re-run audit (proof of fix)

After PR-E deploys and a fresh eval has rechunked at least one of the three:

```sql
WITH per_manuscript AS (
  SELECT manuscript_id, COUNT(*) AS chunk_count,
         SUM(LENGTH(content)) AS chunks_total_content_chars,
         MAX(char_end) AS chunker_indexed_chars
  FROM manuscript_chunks
  WHERE manuscript_id IN (6054, 6073, 6117)
  GROUP BY manuscript_id
)
SELECT m.id, m.title, m.word_count, m.file_size,
       pm.chunk_count, pm.chunks_total_content_chars, pm.chunker_indexed_chars,
       ROUND(pm.chunks_total_content_chars::numeric / NULLIF(m.file_size, 0), 2) AS content_vs_file_ratio
FROM manuscripts m
JOIN per_manuscript pm ON pm.manuscript_id = m.id
ORDER BY m.id;
```

Every row should show `content_vs_file_ratio ≤ 1.2` and `chunk_count` within the expected band for its word count.
