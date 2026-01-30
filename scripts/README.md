# RevisionGrade Scripts

This directory contains operational scripts for RevisionGrade: security tooling, verification, and tests.

---

## 🔒 Security & Safety Scripts

### **`install-hooks.sh`** — Git Hooks Installer
**Install pre-commit hooks for all contributors** (run once per machine)

```bash
./scripts/install-hooks.sh
```

**What it does:**
- Installs `.git/hooks/pre-commit` that runs automatically on every commit
- Blocks commits containing secrets (JWT tokens, API keys, long hex strings)
- Integrates with canon guard checks

**Why:** Git hooks in `.git/hooks/` don't propagate via git. This script installs them on new machines.

---

### **`print-env-safe.sh`** — Safe Environment Inspector
**Check environment variables without exposing secrets**

```bash
# Check .env.local
./scripts/print-env-safe.sh

# Check different file
./scripts/print-env-safe.sh .env.production
```

**Output:**
```
✅ SUPABASE_SERVICE_ROLE_KEY (219 chars): sha256:621ac9ecac6e
✅ ADMIN_API_KEY (64 chars): sha256:a1c35b1f76b1
```

**Features:**
- Shows presence/absence, length, and **non-reversible hash fingerprint**
- **Zero secret disclosure** (no prefixes, no suffixes, no raw values)
- Fingerprint changes after rotation (proof of update)
- Warns if pointing at production URL

**Use this instead of:** `cat .env.local`, `grep SUPABASE .env.local`

---

### **`envcat`** — Raw Env File Tripwire
**Blocks raw access to .env files** (forces use of safe inspector)

```bash
# This will be blocked
./scripts/envcat .env.local

# Emergency bypass (local only, never in CI)
ALLOW_RAW_ENV=true ./scripts/envcat .env.local
```

**Why:** Prevents accidental exposure of secrets in terminal logs, screenshots, or chat transcripts.

---

### **`check-secrets.sh`** — Pre-Commit Secret Scanner
**Detects hardcoded secrets before they enter version control**

```bash
# Scan staged changes (pre-commit)
./scripts/check-secrets.sh --staged

# Scan all uncommitted changes
./scripts/check-secrets.sh --all
```

**Detects:**
- JWT tokens (e.g., `eyJhbGciOi...`)
- Long hex API keys (32+ chars)
- Hardcoded assignments: `ADMIN_API_KEY="abc123..."`
- Supabase URLs with keys in query params

**Integrated:** Runs automatically via `.git/hooks/pre-commit` (installed by `install-hooks.sh`)

---

### **`verify-key-rotation.sh`** — Key Rotation Verifier
**Confirm new Supabase service role key works after rotation**

```bash
./scripts/verify-key-rotation.sh
```

**Checks:**
1. Service role key authenticates with Supabase API
2. TypeScript compiles cleanly
3. Dev→prod guard status
4. Key format validation (JWT)

**Use after:** Rotating compromised keys (see `docs/SECURITY_REMEDIATION_2026-01-30.md`)

---

## ✅ Verification Scripts

### **`verify-phase-a4.sh`** — Phase A.4 Verification
Verifies Phase A.4 (Observability) implementation.

```bash
./scripts/verify-phase-a4.sh
```

---

### **`verify-phase-a5-day1.sh`** — Phase A.5 Day 1 Verification
Verifies Phase A.5 Day 1 (Security) implementation.

```bash
./scripts/verify-phase-a5-day1.sh
```

**Checks:**
- Dev→prod guard in instrumentation.ts (startup-hard)
- Admin auth on all admin endpoints
- Rate limiting on retry endpoint
- ADMIN_API_KEY configured
- Production build succeeds

---

## 🧪 Test Scripts

### Phase 2 Schema Enforcement
- **`verify-phase2-schema-enforcement.sh`** - Audit-grade verification of enum constraints
  - Validates DB CHECK constraints exist
  - Tests script guardrails reject invalid values
  - Confirms DB enforcement blocks invalid INSERTs
  - Proves valid canonical values work

### Large Document Chunking
- **`test-large-chunks-canonical.sh`** ⭐ **CANONICAL**
  - Tests Phase 1 chunking with realistic 250k word manuscript
  - Creates 100 chunks (~1.5MB), validates integrity
  - Checks job_id linking, sequential indexing, boundaries
  - Verifies query performance (<500ms local)
  - Includes metrics: throughput (words/sec), insert timing, MB processed
  - Validates invariants: non-empty chunks, content_hash correctness
  - **This is the definitive large-doc proof test for audit/evidence**

- **`test-chunking-pathological.sh`** 🔥 **PATHOLOGICAL**
  - Tests worst-case text patterns (5MB single paragraph, zero-space text, Unicode edge cases)
  - Validates invariants: no chunk exceeds max_chars, no empty chunks, contiguous indexing
  - Generates test content inside Postgres (deterministic, no giant bash variables)
  - Run locally/staging/nightly (not a CI gate—5MB inserts can be slow)
  - **This proves chunking handles edge cases naive implementations break on**

- **`test-chunking-deterministic.sh`** 🔒 **DETERMINISTIC**
  - Guarantees idempotent output: same input → same chunks (always)
  - Runs chunking twice, compares fingerprints (chunk_index, content_hash, boundaries)
  - Prevents "same manuscript, different chunks" regression bugs
  - Validates: chunk count, index set, hash stability, boundary stability
  - **This proves chunking is deterministic and won't regress**

- **`audit-chunk-query-ordering.sh`** 🔍 **QUERY AUDIT**
  - Scans codebase for manuscript_chunks SELECT queries
  - Ensures all queries include ORDER BY chunk_index ASC
  - Prevents "works locally, flakes in prod" ordering bugs
  - **This prevents silent ordering regressions**

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
