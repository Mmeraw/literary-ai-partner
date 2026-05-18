# PR-E — Fix recursive overlap inflation in `resolveManuscriptText`

## Severity
**High.** Word counts in completed reports are wrong by a growing factor (~2.18× today and rising). Every additional eval re-run on a paste-submitted manuscript amplifies the bloat by another ~10% of current size.

## Symptoms observed in job `cb200799-cb92-424f-ac8f-cf923ec1fb1e` (Froggin Noggin FULL NOVEL, manuscript 6117)
- Report word count: **228,994**
- Actual `manuscripts.word_count`: **105,247**
- Inflation factor: ~2.18×

## Root cause

`resolveManuscriptText` in `lib/evaluation/processor.ts` (lines 845-911) has this priority order:

1. `manuscript.content` (column does not exist on `manuscripts` table for paste submissions → skipped)
2. **Reconstruct from existing `manuscript_chunks` by joining all chunk `content`** ← BUG
3. Decode `file_url` data URI

For paste-submitted manuscripts (whose canonical source is `file_url` data URI), **Priority 2 fires whenever chunks already exist from prior eval attempts**. The reconstructed text includes the overlap zones (up to 3,000 chars per chunk × ~40 chunks = ~120,000 duplicated chars per pass). That inflated text is then re-chunked, and the new chunks (still with overlap) are upserted by `(manuscript_id, chunk_index)`, replacing the old ones with the now-inflated content.

Result: each re-evaluation grows the persisted chunk content by another overlap-cycle. After enough cycles, char ranges balloon from the canonical ~520-640K chars to **1,227,100 chars**.

### Evidence
| Measure | Value | Source |
|---|---|---|
| `manuscripts.file_size` | 518,726 bytes | DB |
| Decoded `file_url` body | ~520-640K chars | Math (147,771 `%XX` escapes in 935,298-char payload) |
| Chunker indexed range (`MAX(char_end)`) | 1,227,100 chars | DB |
| `SUM(LENGTH(content))` across chunks | 1,347,100 chars | DB |
| Report word count | 228,994 | UI |
| True novel length | 105,247 words | `manuscripts.word_count` |

### Overlap is correctly configured (NOT the issue)
- `overlap_pct_of_base_chars = 9.78%` — on-spec (≤10%)
- `max_overlap_chars = 3,000` — consistent with the chunker's large bracket
- Bug is upstream of chunking, in source-text resolution

## Fix 1 — Re-prioritize `resolveManuscriptText` (correctness fix)

**File:** `lib/evaluation/processor.ts` (≈lines 845-911)

**Patch intent:** Make `file_url` data URI Priority 2 (before chunk reconstruction) so paste-submissions always re-resolve from canonical source.

### Before (current)
```ts
// Priority 1: Direct content column
// Priority 2: Reconstruct from manuscript_chunks         ← causes recursive inflation
// Priority 3: Decode data URI from file_url
```

### After
```ts
// Priority 1: Direct content column (manuscripts.content if present)
// Priority 2: Decode data URI from file_url             ← canonical source for paste submissions
// Priority 3: Reconstruct from manuscript_chunks         ← last-resort fallback only
```

**Acceptance:**
1. Existing unit tests pass.
2. New unit test: when a manuscript has BOTH `file_url` data URI AND existing `manuscript_chunks`, `resolveManuscriptText` returns the decoded data URI text, not the chunk-reconstruction.
3. New unit test: when a manuscript has ONLY `manuscript_chunks` (no `file_url`), chunk reconstruction still works (legacy path preserved).
4. The `canonical_path_used` telemetry strings should be extended to include `'resolveManuscriptText.file_url_data_uri'`.

## Fix 2 — One-time cleanup of manuscript 6117 (data fix)

After PR-E ships, manually clear the bloated chunks so the next eval re-materializes them from the canonical `file_url`:

```sql
DELETE FROM manuscript_chunks WHERE manuscript_id = 6117;
```

Then relaunch one eval; verify `MAX(char_end) ≈ 520-640K` (not 1.2M) and report word count ≈ 105K.

## Scope of damage to investigate post-fix

Run this audit to find other paste-submission manuscripts that may be similarly inflated:

```sql
WITH per_manuscript AS (
  SELECT
    manuscript_id,
    COUNT(*) AS chunk_count,
    MAX(char_end) AS indexed_chars
  FROM manuscript_chunks
  GROUP BY manuscript_id
)
SELECT
  m.id,
  m.title,
  m.word_count AS table_word_count,
  m.file_size AS file_size_bytes,
  pm.chunk_count,
  pm.indexed_chars,
  ROUND(pm.indexed_chars::numeric / NULLIF(m.file_size, 0), 2) AS inflation_ratio_chars_per_byte
FROM manuscripts m
JOIN per_manuscript pm ON pm.manuscript_id = m.id
WHERE m.file_url LIKE 'data:%'
ORDER BY inflation_ratio_chars_per_byte DESC NULLS LAST
LIMIT 50;
```

Any row with `inflation_ratio_chars_per_byte > 1.5` is suspect. For a clean paste-submission UTF-8 novel, the ratio should be ~1.0-1.2.

## Out of scope

- Score Ledger normalization display bug (`Normalized 5.67 / 100`) — separate UI fix
- Pass 3 summary truncation (`"A targeted structural an."`) — separate Pass 3 synthesis fix
- "Narrative Closure comparison packet not provided" — separate packet-construction investigation

## Test strategy

1. Unit tests for new priority order
2. Integration test: simulate a paste-submission manuscript with stale bloated chunks → verify next chunking produces correct char range
3. Regression guard: add post-condition assertion `MAX(char_end) ≤ 1.5 * decoded_file_url_length` in `ensureChunksFromText` so this can never silently regress
