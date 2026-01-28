# PHASE 2C: Combined Evidence Command (Final Form)

**Status:** ✅ Ready to execute  
**Purpose:** Single, fail-fast verification that Phase 2C is locked (TS + runtime + persistence)  
**Output:** Timestamped log archive for audit trail  
**Canonical Method:** Use `npm run evidence:phase2c` or `tsc -p <tsconfig>`, never single-file `tsc`

---

## ⚠️ CRITICAL: TypeScript Compilation Method

**Single-file `tsc` is forbidden for evidence.** It bypasses project configuration and produces spurious errors (e.g., TS18028 for ES2018 private fields even in ES2020+ code).

### ❌ WRONG (do not use for evidence)
```bash
npx tsc --noEmit workers/phase2Evaluation.ts
npx tsc --noEmit workers/phase2Worker.ts
```
Result: May surface TS18028 "Private identifiers are only available..." even though the project compiles clean.

### ✅ CANONICAL (use for evidence)
```bash
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.workers.json
```
Result: Uses project configuration (target: ES2018, moduleResolution: bundler/node16). Exit 0 = genuinely clean build.

---

## ⚠️ CRITICAL: Canonical Artifact Log Output

**Do not use `tail` when producing the canonical artifact log.** Truncation hides early failures and makes audit trails incomplete.

### ❌ WRONG (truncates output)
```bash
npx jest phase2c1-runtime-proof.test.ts --no-coverage 2>&1 | tail -35
```
Result: If tests fail early, you won't see the failure. Audit trail is incomplete.

### ✅ CANONICAL (full output)
```bash
npx jest phase2c1-runtime-proof.test.ts --no-coverage
```
Result: Complete test output captured in log. All failures visible. Full audit trail.

**Note:** Using `tail` for local viewing/debugging is fine, but the saved artifact log (`/tmp/phase2c-evidence-*.log`) must contain full output.

---

## Quick Run (One-Liner)

**Preferred method:** Use npm script
```bash
npm run evidence:phase2c
```

**Or run command directly:**
```bash
cd /workspaces/literary-ai-partner && \
set -euo pipefail && \
LOG="/tmp/phase2c-evidence-$(date +%s).log" && \
{
  echo "========================================="
  echo "PHASE 2C COMBINED EVIDENCE"
  echo "========================================="
  echo ""
  echo "1) TypeScript (main + workers)"
  npx tsc --noEmit -p tsconfig.json
  npx tsc --noEmit -p tsconfig.workers.json
  echo "✅ TS clean"
  echo ""
  echo "2) Phase 2C-1 runtime proof"
  npx jest phase2c1-runtime-proof.test.ts --no-coverage
  echo "✅ 2C-1 tests clean"
  echo ""
  echo "3) Phase 2C-4 persistence proof"
  npx jest phase2c4-persistence.test.ts --no-coverage
  echo "✅ 2C-4 tests clean"
  echo ""
  echo "========================================="
  echo "✅ PHASE 2C LOCKED"
  echo "========================================="
} 2>&1 | tee "$LOG"
echo ""
echo "Evidence archived to: $LOG"
```

---

## What Gets Verified

| Step | Command | Expected | Evidence |
|------|---------|----------|----------|
| 1 | `npx tsc --noEmit -p tsconfig.json` | Exit 0 | No TS errors (main config) |
| 2 | `npx tsc --noEmit -p tsconfig.workers.json` | Exit 0 | No TS errors (worker config) |
| 3 | `npx jest phase2c1-runtime-proof.test.ts` | 15/15 passing | Circuit breaker, retry, metadata, canon envelope |
| 4 | `npx jest phase2c4-persistence.test.ts` | 17/17 passing | Schema types, serialization, truncation, audit semantics |

**Total:** 32 tests, 0 failures

---

## Step-by-Step Execution

### Step 1: Navigate to Repo
```bash
cd /workspaces/literary-ai-partner
```

### Step 2: Set Up Output Log
```bash
LOG="/tmp/phase2c-evidence-$(date +%s).log"
echo "Logging to: $LOG"
```

### Step 3: Run Combined Evidence (With `-p` Flags)
```bash
set -euo pipefail && \
{
  echo "========================================="
  echo "PHASE 2C COMBINED EVIDENCE"
  echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "========================================="
  echo ""
  
  echo "1) TypeScript (main config)"
  npx tsc --noEmit -p tsconfig.json
  echo "✅ Main config clean"
  echo ""
  
  echo "2) TypeScript (worker config)"
  npx tsc --noEmit -p tsconfig.workers.json
  echo "✅ Worker config clean"
  echo ""
  
  echo "3) Phase 2C-1 Runtime Proof"
  npx jest phase2c1-runtime-proof.test.ts --no-coverage
  echo "✅ 2C-1 (15 tests) passing"
  echo ""
  
  echo "4) Phase 2C-4 Persistence Proof"
  npx jest phase2c4-persistence.test.ts --no-coverage
  echo "✅ 2C-4 (17 tests) passing"
  echo ""
  
  echo "========================================="
  echo "✅ PHASE 2C LOCKED"
  echo "Ended: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "========================================="
} 2>&1 | tee "$LOG"
```

### Step 4: Verify Output (No Tail — Artifact Must Be Complete)

**Do NOT use tail on the canonical artifact log.** Use grep to verify markers instead:

```bash
# Verify success markers exist in the log
grep -n "✅ PHASE 2C LOCKED" "$LOG" && echo "✅ Lock marker found"
grep -n "Evidence archived:" "$LOG" && echo "✅ Archive marker found"

# Verify log file exists and is non-empty
LOG_PATH="$(grep -oE '/tmp/phase2c-evidence-[0-9]+\.log' "$LOG" | tail -n 1)"
test -n "$LOG_PATH" && test -s "$LOG_PATH" && echo "✅ Log OK: $LOG_PATH"
```

Expected output:
```
123:✅ PHASE 2C LOCKED
✅ Lock marker found
456:Evidence archived: /tmp/phase2c-evidence-1769576091.log
✅ Archive marker found
✅ Log OK: /tmp/phase2c-evidence-1769576091.log
```

If you need to read the full log for debugging (only for local troubleshooting, not as evidence):
```bash
cat "$LOG"  # Full output for debugging
```

---

## Expected Output Sample

```
=========================================
PHASE 2C COMBINED EVIDENCE
Started: 2025-01-28T14:30:45Z
=========================================

1) TypeScript (main config)
✅ Main config clean

2) TypeScript (worker config)
✅ Worker config clean

3) Phase 2C-1 Runtime Proof
PASS ./phase2c1-runtime-proof.test.ts
  Phase 2C-1 Runtime Proof
    Circuit Breaker State Machine
      ✓ should start in closed state
      ✓ should trip to open after failure threshold
      ✓ should transition to half-open after cooldown
      ✓ should reset to closed on success
    Retry Logic with Exponential Backoff
      ✓ should classify retryable status codes
      ✓ should classify fast-fail status codes
      ✓ should calculate exponential backoff with jitter
    OpenAI Metadata Generation
      ✓ should build openai_runtime metadata
      ✓ should build full provider_meta on success
      ✓ should build provider_meta on fast-fail error
      ✓ should build provider_meta on retryable exhausted
      ✓ should build provider_meta on circuit open
    Canon-Compatible Result Envelope
      ✓ should build success result with openai_runtime
      ✓ should build partial result on OpenAI error
    Integration: Full Request/Response Cycle
      ✓ should trace a complete successful evaluation
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
✅ 2C-1 (15 tests) passing

4) Phase 2C-4 Persistence Proof
PASS ./phase2c4-persistence.test.ts
  Phase 2C-4 Persistence
    Schema Types
      ✓ should construct valid ProviderRequestMeta
      ✓ should construct valid ProviderResponseMeta
      ✓ should construct valid ProviderErrorMeta
      ✓ should construct valid CanonicalResultEnvelope
    Round-Trip Serialization
      ✓ should serialize and deserialize a full provider call record
      ✓ should handle optional fields gracefully
    Error Truncation
      ✓ should truncate long error messages
      ✓ should not truncate short error messages
      ✓ should handle exact boundary
    Redaction
      ✓ should redact a provider call record
    Audit Trail Semantics
      ✓ should support fast-fail error classification
      ✓ should support retryable exhausted classification
      ✓ should support circuit breaker open classification
      ✓ should support success with no error_meta
    Schema Version Tracking
      ✓ should track provider_meta_version for future evolution
      ✓ should allow multiple versions in the same database
    Simulated Provider Tracking
      ✓ should track simulated runs with same audit structure
Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
✅ 2C-4 (17 tests) passing

=========================================
✅ PHASE 2C LOCKED
Ended: 2025-01-28T14:30:52Z
=========================================
```

## Failure Diagnosis

### TypeScript Fails
**Error:** `error TS...`

**Causes:**
- toCanonicalEnvelope not imported (check import statement in phase2Worker.ts)
- tsconfig.target not ES2018 (check tsconfig.json line 7)
- Module resolution mismatch (check tsconfig.workers.json)

**Fix:**
```bash
# Verify imports
grep -n "toCanonicalEnvelope" workers/phase2Worker.ts
# Should show 3+ matches

# Verify config
grep "target" tsconfig.json | head -1
# Should show: "target": "ES2018"
```

### Jest Tests Fail
**Error:** `FAIL ./phase2c...test.ts`

**Causes:**
- Test file syntax error (check Jest output for line number)
- Missing mock (check jest.setup.ts for mock definitions)
- Import path error (check relative paths)

**Fix:**
```bash
# Run verbose (full output, no tail)
npx jest phase2c1-runtime-proof.test.ts --no-coverage -v 2>&1

# Or grep for errors in full output
npx jest phase2c1-runtime-proof.test.ts --no-coverage -v 2>&1 | grep -E "error|FAIL|✕"

# Check mock setup
cat jest.setup.ts | grep -A 5 "jest.mock"
```

### Log Truncated
**Error:** Log shows only last N lines, earlier failures hidden

**Fix:**
```bash
# Always save full log (never tail when saving)
bash scripts/evidence-phase2c.sh > /tmp/phase2c-verify.out 2>&1

# Then check full content
wc -l /tmp/phase2c-verify.out
grep "error\|FAIL\|❌" /tmp/phase2c-verify.out | head -20

# Use grep markers for quick verification (not tail)
grep -E "✅ PHASE 2C LOCKED|Evidence archived:" /tmp/phase2c-verify.out
```

---

## Archiving Evidence

Once combined evidence completes successfully:

```bash
# Copy to timestamped archive
cp "$LOG" /tmp/phase2c-evidence-$(date +%Y%m%d-%H%M%S).log

# List all Phase 2C evidence runs (GREP for latest, not tail)
ls -lhtr /tmp/phase2c-evidence-*.log | grep "$(date +%Y%m%d)" | sort -k 6,7

# Search for failures across all runs
for f in /tmp/phase2c-evidence-*.log; do
  if grep -q "error\|FAIL\|❌" "$f"; then
    echo "⚠️  Found errors in: $f"
  fi
done
```

---

## Pre-Flight Checks

Before running combined evidence:

```bash
# 1. Check Node.js
node --version
# Expected: v18+ or v20+

# 2. Check npm
npm --version
# Expected: v8+

# 3. Verify jest installed
npx jest --version
# Expected: v29+

# 4. Verify project built
npm run build 2>&1 | tail -5
# Should complete without "error" in output

# 5. Verify test files exist
ls -la phase2c1-runtime-proof.test.ts phase2c4-persistence.test.ts
# Should show 2 files
```

---

## Success Criteria

| Criteria | Status |
|----------|--------|
| TypeScript (main): Exit 0 | ✅ |
| TypeScript (workers): Exit 0 | ✅ |
| Phase 2C-1 tests: 15/15 passing | ✅ |
| Phase 2C-4 tests: 17/17 passing | ✅ |
| Total tests: 32/32 passing | ✅ |
| Log archived to `/tmp/phase2c-evidence-*.log` | ✅ |
| No errors or warnings in log | ✅ |
| Evidence chain complete | ✅ |

---

## Post-Evidence: Next Steps

Once combined evidence completes successfully:

### Option 1: Real Run Proof (Phase 2C-3)
If you have `OPENAI_API_KEY` + live Supabase:
1. Apply DB migration: `supabase db push`
2. Set `.env.local` with credentials
3. Start dev server: `npm run dev`
4. Run vertical-slice test: `bash scripts/test-phase2-vertical-slice.sh`
5. Query DB to verify persistence happened

**See:** [docs/PHASE2C3_EVIDENCE_COMMAND.md](PHASE2C3_EVIDENCE_COMMAND.md)

### Option 2: Phase 2D Planning (Concurrency + Multi-Worker)
If combined evidence is solid and you're ready for next phase:
1. Start 3 worker processes
2. Seed N jobs to the database
3. Wait for completion
4. Assert all jobs complete, no orphans, 0 running
5. Query audit table for consistency

**Files ready for Phase 2D:**
- [workers/phase2Worker.ts](workers/phase2Worker.ts) — Job claim/heartbeat/complete logic proven
- [types/providerCalls.ts](types/providerCalls.ts) — Audit schema versioning (enables concurrency diagnostics)
- [supabase/migrations/20260128_add_evaluation_provider_calls.sql](supabase/migrations/20260128_add_evaluation_provider_calls.sql) — Indexes for multi-worker queries

---

## Troubleshooting

### "Command not found: tsc"
```bash
npm install
# Then retry
```

### "Cannot find module: jest"
```bash
npm install --save-dev jest
npm install --save-dev @types/jest
npm install --save-dev ts-jest
npm install --save-dev typescript
```

### "ENOENT: no such file or directory"
```bash
# Verify you're in the repo root
pwd
# Should output: /workspaces/literary-ai-partner

# Check test files exist
find . -name "phase2c*.test.ts"
```

### "Log file not created"
```bash
# Ensure /tmp is writable
touch /tmp/test && rm /tmp/test
echo $?
# Should output: 0
```

---

**Status:** Combined evidence command ready to execute.

**When to run:** After any code changes to phase2Evaluation.ts, phase2Worker.ts, types/providerCalls.ts, or test files.

**Expected duration:** ~10 seconds (TypeScript + Jest overhead)

**Artifact:** Single timestamped log file for audit trail

---

**Related:**
- [PHASE2C_LOCKED.md](PHASE2C_LOCKED.md) — Overall Phase 2C status
- [PERSISTENCE_CONTRACT.md](PERSISTENCE_CONTRACT.md) — Persistence rules (newly locked)
- [PHASE2C1_CHECKLIST.md](PHASE2C1_CHECKLIST.md) — Phase 2C-1 details
- [PHASE2C4_PERSISTENCE.md](PHASE2C4_PERSISTENCE.md) — Phase 2C-4 specification
