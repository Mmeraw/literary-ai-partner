# RevisionGrade Test Scripts

This directory contains test scripts for validating database schema, integrity, and performance.

## Core Tests

### Phase 2 Schema Enforcement
- **`verify-phase2-schema-enforcement.sh`** - Audit-grade verification of enum constraints
  - Validates DB CHECK constraints exist
  - Tests script guardrails reject invalid values
  - Confirms DB enforcement blocks invalid INSERTs
  - Proves valid canonical values work

### Large Document Chunking
- **`test-large-chunks-canonical.sh`** ⭐ **CANONICAL**
  - Tests Phase 1 chunking with realistic 250k word manuscript
  - Creates 100 chunks, validates integrity
  - Checks job_id linking, sequential indexing, boundaries
  - Verifies query performance (<500ms local)
  - **This is the definitive large-doc proof test**

### Phase 2 Tests
- **`test-phase2-vertical-slice.sh`** - End-to-end Phase 1 → Phase 2 flow
- **`test-phase2b-chunk-fetch.sh`** - Phase 2B chunk aggregation regression test
- **`test-phase2d-concurrency.sh`** - Multi-worker SKIP LOCKED atomicity test

## Standards

### Word Count
**For RevisionGrade (literary platform), word counts MUST be exact, not estimated.**

- ✅ **User-facing:** Exact word count (whitespace-delimited tokens)
- ✅ **Database:** `manuscripts.word_count` stores exact integer
- ❌ **Never show:** "estimated words" or "~84k words" to users

**Why:** In publishing, word count is used for:
- Editor pricing (per-word billing)
- Agent submission guidelines
- Contract terms

**Implementation:** Compute from canonical full text at ingest/upload, not from chunk heuristics.

### Canonical Enum Values
All test scripts use validated enum values:
- `policy_family`: `'standard'` (default), `'dark_fiction'`, `'trauma_memoir'`
- `voice_preservation_level`: `'balanced'` (default), `'strict'`, `'expressive'`
- `english_variant`: `'us'` (default), `'uk'`, `'ca'`, `'au'`

See `docs/EVALUATION_JOBS_ENUM_VALUES.md` for complete reference.

## Running Tests

```bash
# Canonical large document test
./scripts/test-large-chunks-canonical.sh

# Keep test data for inspection
KEEP_TEST_DATA=1 ./scripts/test-large-chunks-canonical.sh

# Phase 2 schema enforcement verification
./scripts/verify-phase2-schema-enforcement.sh

# Full vertical slice (Phase 1 → Phase 2)
./scripts/test-phase2-vertical-slice.sh
```

## Test Data Cleanup

All tests clean up automatically on exit via `trap`. To preserve test data:
```bash
KEEP_TEST_DATA=1 ./scripts/test-large-chunks-canonical.sh
```

Manual cleanup if needed:
```bash
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres \
  -c "DELETE FROM manuscripts WHERE id = 99999;"
```
