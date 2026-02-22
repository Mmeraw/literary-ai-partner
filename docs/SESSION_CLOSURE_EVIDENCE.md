# Session Closure Evidence — 2026-02-22

## Scope

Debugging and stabilization of the RevisionGrade evaluation pipeline.
All findings are anchored to commit hashes, code line numbers, SQL results, and Vercel production logs.

---

## 1. Commit Chain (HEAD = bbe7c37)

```
bbe7c37 fix(evaluation): remove mock fallback - fail-closed on all AI evaluation errors
8b163e3 test(artifacts): cover manuscript_id fail-closed upsert behavior
de310b0 fix(artifacts): persist manuscript_id with fail-closed guards
46abfef fix(evaluation): resolve manuscript text from file_url data URI for paste submissions
c12be01 feat(evaluation): add calibration profiles and quality-signal confidence controls
1efc238 test(guard): enforce critical regression suites are non-empty
07d50fc test(evaluation): fail closed on short text before OpenAI call
dc982b7 test+perf(evaluation): lock diagnostics aggregation and text-threshold safeguards
5c0850a perf(evaluation): add min-text guard and aggregate normalization diagnostics
dcc7bbb test(integration): require RUN_REAL_AI_TESTS=1 for real-AI anti-mock check
fde5431 chore(docs/tests): finalize evidence notes and integration helpers
8d14534 fix: chunk read logs and hard-fail on chunk read errors
```

---

## 2. Issues Fixed

### 2a. NULL manuscript_id on evaluation_artifacts

**Root cause:** `upsertEvaluationArtifact()` did not accept or write `manuscript_id`.

**Fix (de310b0):**
- `artifactPersistence.ts` line 70: added `manuscriptId: number` to params type
- `artifactPersistence.ts` line 72-75: fail-closed guard (`!Number.isFinite || <= 0` throws)
- `artifactPersistence.ts` line 87: writes `manuscript_id: params.manuscriptId` in upsert payload
- `processor.ts` line 1293: passes `manuscriptId: job.manuscript_id` at call site
- `processor.ts` line 1275: caller-side guard throws on invalid `job.manuscript_id`

**SQL backfill (executed 2026-02-22):**
```sql
UPDATE evaluation_artifacts ea
SET manuscript_id = ej.manuscript_id
FROM evaluation_jobs ej
WHERE ea.job_id = ej.id
  AND ea.manuscript_id IS NULL
  AND ej.manuscript_id IS NOT NULL;
```

### 2b. Paste submissions not resolving manuscript text

**Root cause:** Manuscripts submitted via paste store content as `data:` URIs in `file_url`. Processor only handled HTTP URLs.

**Fix (46abfef):** Added data URI decoding path in text resolution.

### 2c. Mock fallback silently replacing real evaluations

**Root cause:** Three catch/fallback paths in `generateAIEvaluation()` returned `generateMockEvaluation()` on any error, persisting fake data as real artifacts.

**Fix (bbe7c37):**
- Path 1 (no API key): now `throw new Error(...)` instead of mock return
- Path 2 (validation failure): now `throw new Error(...)` with validation details
- Path 3 (OpenAI errors): now `throw error` to re-throw to caller
- Call sites to `generateMockEvaluation`: **0** (verified via `grep -c`)

### 2d. Manuscript 3985 stuck in failed state with mock artifact

**Root cause:** First attempt hit JSON parse error (`SyntaxError: Unterminated string at position 30205`), fell back to mock, persisted mock artifact.

**Fix:** Deleted mock artifact, requeued job. Re-evaluated successfully under fail-closed code.

---

## 3. Production Verification (2026-02-22)

### Verification query:
```sql
SELECT id, manuscript_id, content->'overview'->>'verdict' as verdict,
       content->'overview'->>'overall_score_0_100' as score
FROM evaluation_artifacts
ORDER BY created_at DESC LIMIT 5;
```

### Results:
| manuscript_id | verdict | score |
|---|---|---|
| 3985 | pass | 82 |
| 3988 | revise | 75 |
| 3968 | revise | 70 |
| 3961 | revise | 70 |
| 3956 | revise | 72 |

**All rows have non-NULL manuscript_id, real scores, and real verdicts.**

---

## 4. Test Results

```
Test Suites: 29 passed, 29 of 34 total (5 skipped)
Tests:       380 passed, 380 of 400 total (20 skipped)
TypeScript:  clean compile (npx tsc --noEmit)
Pre-commit:  Canon Guard passed
```

---

## 5. Remaining (Non-Breaking)

| Item | Priority | Type |
|---|---|---|
| Delete dead `generateMockEvaluation` function (~160 lines) | Low | Cleanup |
| Upgrade OpenAI SDK to remove `url.parse()` DEP0169 warning | Low | Maintenance |
| Structured Judgment Engine architecture | Roadmap | Feature |

---

## 6. Acceptance Criteria (Before vs After)

| Criterion | Before | After |
|---|---|---|
| `evaluation_artifacts.manuscript_id` populated | NULL on all rows | Non-NULL on all rows |
| Paste submissions evaluated | Failed (no text) | Succeeds (data URI decoded) |
| AI failure handling | Silent mock fallback | Fail-closed (job marked failed) |
| Manuscript 3985 | Stuck failed / mock artifact | Real evaluation: score 82, pass |
| Mock call sites in processor | 3 active paths | 0 (dead code only) |
