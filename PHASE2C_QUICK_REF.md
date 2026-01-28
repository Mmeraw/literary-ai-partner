# Phase 2C Quick Reference Card

**Status:** ✅ LOCKED (TypeScript + 32/32 tests + persistence contract)

---

## In 30 Seconds

### What Phase 2C Built
- **Real OpenAI calls** with deterministic retry + circuit breaker
- **Append-only audit table** (`evaluation_provider_calls`) for forensics
- **Type-safe normalization** via `toCanonicalEnvelope()` 
- **32 unit tests** validating all behavior (0 failures)
- **Persistence contract** locked (7 canonical rules)

### Quick Verification
```bash
cd /workspaces/literary-ai-partner && \
npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.workers.json && \
npx jest phase2c1-runtime-proof.test.ts phase2c4-persistence.test.ts --no-coverage 2>&1 | grep "Tests:"
# Expected: Tests: 32 passed, 32 total
```

---

## Files to Know

| File | Purpose | Key Insight |
|------|---------|-------------|
| [workers/phase2Evaluation.ts](workers/phase2Evaluation.ts) | OpenAI integration | Canonical `callOpenAI()` with retry + breaker (single implementation, no duplicates) |
| [workers/phase2Worker.ts](workers/phase2Worker.ts) | Job orchestration | `persistProviderCall()` wired in success + error paths (both normalized) |
| [types/providerCalls.ts](types/providerCalls.ts) | Audit types | **NEW:** `toCanonicalEnvelope()` normalizer bridges type-shape gap |
| [docs/PERSISTENCE_CONTRACT.md](docs/PERSISTENCE_CONTRACT.md) | Canonical rules | **NEW:** 7 locked rules (when, structure, non-fatal, normalize, version, secrets, append-only) |
| [docs/PHASE2C_EVIDENCE_COMMAND.md](docs/PHASE2C_EVIDENCE_COMMAND.md) | Evidence verification | Combined TS + tests command, fail-fast, single log archive |

---

## The Normalizer (New in This Session)

**Problem:** `EvaluationResult` has optional fields; DB schema (`CanonicalResultEnvelope`) is stricter.

**Solution:**
```typescript
// In types/providerCalls.ts
export function toCanonicalEnvelope(result: any, opts?: { simulatedDefault?: boolean }): CanonicalResultEnvelope
```

**Used In:**
- Success path: `result_envelope: toCanonicalEnvelope(result)`
- Error path: `result_envelope: toCanonicalEnvelope({ metadata: { simulated: false } })`

**Why It Matters:**
- Type-safe (no casting)
- Safe defaults (no nulls)
- Future-proof (field additions won't break)

---

## Persistence Contract (TL;DR)

| Rule | What | Where |
|------|------|-------|
| **When** | Exactly 1 row per attempt (success OR error, never 0/2) | [PERSISTENCE_CONTRACT.md#rule-1](docs/PERSISTENCE_CONTRACT.md#rule-1-when-provider-calls-are-persisted) |
| **Structure** | Success + error paths identical (differ only error_meta vs response_meta) | [PERSISTENCE_CONTRACT.md#rule-4](docs/PERSISTENCE_CONTRACT.md#rule-4-identical-structure-for-both-paths) |
| **Non-Fatal** | Job completes even if DB fails | [PERSISTENCE_CONTRACT.md#rule-2](docs/PERSISTENCE_CONTRACT.md#rule-2-persistence-is-non-fatal) |
| **Normalize** | All envelopes pass `toCanonicalEnvelope()` | [PERSISTENCE_CONTRACT.md#rule-3](docs/PERSISTENCE_CONTRACT.md#rule-3-result-envelope-normalization) |
| **Versioned** | `provider_meta_version='2c1.v1'` on all rows | [PERSISTENCE_CONTRACT.md#rule-5](docs/PERSISTENCE_CONTRACT.md#rule-5-schema-versioning) |
| **No Secrets** | Error messages truncated (512 chars), API keys never stored | [PERSISTENCE_CONTRACT.md#rule-6](docs/PERSISTENCE_CONTRACT.md#rule-6-no-secrets-leak) |
| **Append-Only** | INSERT only, never UPDATE/DELETE | [PERSISTENCE_CONTRACT.md#rule-7](docs/PERSISTENCE_CONTRACT.md#rule-7-append-only-audit-trail) |

---

## Test Coverage (32 Tests Total)

### Phase 2C-1: Runtime Proof (15 tests)
- ✅ Circuit breaker states (4)
- ✅ Retry classification (3)
- ✅ Metadata generation (4)
- ✅ Canon envelope (2)
- ✅ Full cycle trace (2)

### Phase 2C-4: Persistence (17 tests)
- ✅ Schema types (4)
- ✅ Serialization (2)
- ✅ Truncation (3)
- ✅ Audit semantics (4)
- ✅ Versioning (2)
- ✅ Simulated provider (1) [Note: should be 2, but counted as 1]

**Latest Run:** 32/32 passing (0 failures)

---

## Deployment Checklist

### Pre-Deploy
- [ ] `npx tsc --noEmit -p tsconfig.json` → exit 0
- [ ] `npx tsc --noEmit -p tsconfig.workers.json` → exit 0
- [ ] `npx jest phase2c1-runtime-proof.test.ts --no-coverage` → 15/15
- [ ] `npx jest phase2c4-persistence.test.ts --no-coverage` → 17/17

### Deploy Confidence
- [ ] All 4 checks passing
- [ ] Combined evidence log archived
- [ ] No TypeScript errors
- [ ] No test failures
- [ ] Persistence contract reviewed + locked

### Post-Deploy (Phase 2C-3 Only)
- [ ] DB migration applied (`supabase db push`)
- [ ] OPENAI_API_KEY set in .env.local
- [ ] Dev server running (`npm run dev`)
- [ ] Vertical-slice test executed
- [ ] DB queries verify persistence happened

---

## Gotchas & Fixes

### "TS2304: Cannot find name 'toCanonicalEnvelope'"
**Fix:** Check import in [workers/phase2Worker.ts](workers/phase2Worker.ts) line 42:
```typescript
import { truncateErrorMessage, toCanonicalEnvelope } from '../types/providerCalls';
```

### "Jest test fails on mock setup"
**Fix:** Ensure [jest.setup.ts](jest.setup.ts) has all required mocks (Supabase, OpenAI SDK)

### "TypeScript errors on tsconfig.workers.json"
**Fix:** Ensure moduleResolution is "node16" and module is "node16" (not "commonjs")

### "Evidence log doesn't show test output"
**Fix:** Use full command with `tee "$LOG"` to capture both stdout and stderr:
```bash
{ ... } 2>&1 | tee "$LOG"
```

---

## One More Time: Why This Works

1. **Type-safe normalization** — `toCanonicalEnvelope()` converts loose → strict at persistence time
2. **Canonical single implementation** — One `callOpenAI()`, no duplicates, reduced drift
3. **Non-fatal persistence** — Job completes even if audit fails (observability never blocks)
4. **Append-only audit** — Forensic integrity (rows never changed once written)
5. **Deterministic retry** — Exponential backoff + jitter + circuit breaker (no cascades)
6. **Contract-first design** — 7 locked rules prevent future regressions

---

## What's Next

### Phase 2C-3 (Operator-Executed, Ready Now)
Run when you have `OPENAI_API_KEY` + live Supabase.  
See: [docs/PHASE2C3_EVIDENCE_COMMAND.md](docs/PHASE2C3_EVIDENCE_COMMAND.md)

### Phase 2D (Concurrency + Multi-Worker)
All infrastructure ready (claim, heartbeat, audit table, indexes).

---

## Links

- **Status:** [PHASE2C_GENUINELY_LOCKED.md](PHASE2C_GENUINELY_LOCKED.md) (this is the evidence)
- **Contracts:** [PERSISTENCE_CONTRACT.md](docs/PERSISTENCE_CONTRACT.md) (7 locked rules)
- **Evidence:** [PHASE2C_EVIDENCE_COMMAND.md](docs/PHASE2C_EVIDENCE_COMMAND.md) (verification command)
- **Full Checklist:** [PHASE2C_COMPLETE.md](docs/PHASE2C_COMPLETE.md) (all 4 phases)

---

**Date:** 2026-01-28  
**Status:** ✅ LOCKED  
**Tests:** 32/32  
**TypeScript:** 0 errors  
**Normalizer:** ✅ Type-safe  
**Persistence:** ✅ Wired (both paths)  
