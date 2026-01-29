# Word Count Standards — RevisionGrade

## Executive Summary

**RevisionGrade must display EXACT word counts, never estimates.**

In the literary industry, word count is a contractual standard used for:
- Editor billing (per-word pricing)
- Agent submission requirements
- Publisher guidelines
- Rights and licensing agreements

Showing "estimated words" or "~84k words" undermines trust and credibility.

## Implementation Standard

### User-Facing (Frontend/API)
```typescript
// ✅ CORRECT
interface Manuscript {
  word_count: number;  // Exact integer, e.g., 84213
}

// Display: "Word count: 84,213"
```

```typescript
// ❌ NEVER DO THIS
interface Manuscript {
  estimated_words?: number;
  approx_words?: string;  // "~84k"
}
```

### Database
```sql
-- manuscripts.word_count is NOT NULL and stores exact count
CREATE TABLE manuscripts (
  id UUID PRIMARY KEY,
  word_count INTEGER NOT NULL DEFAULT 0,  -- Exact, not estimated
  ...
);
```

### Computation Method

**Definition:** Word count = number of whitespace-delimited tokens after normalization.

```python
# Example: exact word count computation
def count_words_exact(text: str) -> int:
    """
    Industry-standard word count.
    Matches common tools (Word, Google Docs) closely.
    """
    # Normalize whitespace
    normalized = re.sub(r'\s+', ' ', text.strip())
    # Split on whitespace
    words = normalized.split(' ')
    # Count non-empty tokens
    return len([w for w in words if w])
```

**Key principles:**
1. **Deterministic** — same input always gives same count
2. **Documented** — users know how it's computed
3. **Consistent** — all manuscripts use same method

### When Word Count is Computed

1. **On upload/paste:** Compute from original full text
2. **On edit:** Recompute if content changes
3. **Never from chunks:** Chunks may overlap or have whitespace variations

```typescript
// ✅ CORRECT: Compute from source
async function ingestManuscript(content: string) {
  const word_count = countWordsExact(content);
  await db.manuscripts.insert({
    content_url: savedFileUrl,
    word_count,  // Store exact count
  });
}
```

```typescript
// ❌ WRONG: Don't estimate from chunks
async function estimateFromChunks(chunks: Chunk[]) {
  // This gives unreliable results due to:
  // - Chunk overlaps
  // - Whitespace handling differences
  // - No single source of truth
  return chunks.reduce((sum, c) => sum + c.char_count / 5, 0);
}
```

## Internal vs User-Facing

### Internal (logs, diagnostics, tests)
Estimates are acceptable for:
- Performance benchmarking ("processing ~300k words")
- Chunk generation logs ("chunk 42/108, ~2500 words")
- Test output ("generated test content, approx_words=309500")

```bash
# ✅ ACCEPTABLE in test logs
echo "Estimated words: $(printf "%'d" $EST_WORDS)"
```

### User-Facing (UI, API, emails)
Always exact:
- Dashboard: "Word count: 84,213"
- API response: `"word_count": 84213`
- Email: "Your 84,213-word manuscript has been processed"

## Rationale: Why Estimates Undermine Trust

| Scenario | Estimate Shown | Impact |
|----------|---------------|--------|
| Editor pricing | "~85k words" | Can't quote accurately, billing disputes |
| Agent submission | "approx 84,000" | Doesn't meet "80-90k exact" guidelines |
| Rights contract | "estimated 84k" | Legally ambiguous for per-word royalties |

**User expectation:** Literary platforms show exact counts (like Word, Scrivener, Google Docs).

**RevisionGrade promise:** World-class literary AI partner = precision and trust.

## Exception: When Estimates Are Acceptable

**Reading time approximations:**
- "Estimated reading time: 5 hours 30 min" ✅
- Based on word count, but clearly labeled as estimate

**Page count:**
- "Approximately 336 pages (250 words/page)" ✅
- Industry knows this varies by formatting

**Never for the word count itself:**
- "Estimated words: ~84,000" ❌

## Verification

```sql
-- All manuscripts must have exact word_count
SELECT id, title, word_count
FROM manuscripts
WHERE word_count = 0 OR word_count IS NULL;
-- Should return 0 rows for production data
```

```typescript
// Type safety: word_count is required, not optional
interface Manuscript {
  id: string;
  word_count: number;  // Not: number | null | undefined
}
```

## Migration Notes (if needed)

If existing data has estimated counts:
1. Flag manuscripts needing recount: `word_count_verified = false`
2. Recompute from source during next access
3. Mark verified once exact count stored

## Summary

| Context | Standard |
|---------|----------|
| **User display** | Exact integer only |
| **Database** | `manuscripts.word_count` (integer, NOT NULL) |
| **Computation** | From full source text, whitespace-delimited |
| **Labeling** | "Word count: 84,213" (never "estimated") |
| **Internal logs** | Estimates acceptable if clearly labeled |
| **API** | `word_count: number` (exact) |

**Golden rule:** If a user sees it, it must be exact.
