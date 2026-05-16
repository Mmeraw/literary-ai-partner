# PR #501 replay test — handoff for tomorrow

**Captured**: 2026-05-15 05:48 MST. Subagent cancelled cleanly at ~44 min runtime after producing real work but going silent ~16 min before commit/push.

## Status

- **Subagent ID**: `pr_501_deterministic_replay_test_mp6vaa3p` — cancelled
- **PR #501 HEAD on GitHub**: still `1e931b1a` (unchanged — subagent never pushed)
- **Local worktree**: `/home/user/workspace/literary-ai-partner-dbd49eac/` — preserved, uncommitted changes intact
- **Branch**: `fix/eval-timeout-pass4-chunkunit-clean`

## Captured artifacts (stable paths, survive worktree GC)

- `/home/user/workspace/pr-501-replay-test-DRAFT.diff` — 385-line unified diff (352 insertions, 8 deletions)
- `/home/user/workspace/pr-501-replay-test-DRAFT.test.ts` — full 1452-line test file (subagent's version)
- `/home/user/workspace/pr-501-replay-test-package-lock.diffstat` — package-lock had 1 line modified (likely incidental from `npm install`)
- `/home/user/workspace/pr-501-replay-test-spec.md` — original spec subagent followed

## Sanity-check verdicts (file-verified)

### ✅ Structural assertions correct
Test file asserts on the right discriminated-union fields, not just `cross_check` existence:
- `crossCheck!.invalidCriteria.toContain("emotionalResonance")`
- `crossCheck!.canonValid).toBe(false)`
- `crossCheck!.criteria.emotionalResonance.direction).toBe("INVALID")` (test case A)
- `crossCheck!.criteria.emotionalResonance.direction).toBe("MISSING")` (test case B)
- `crossCheck!.criteria.concept.openaiScore).toBe(7)` + `invalidOpenaiCriterion).toBe(false)` + `missingFromOpenai).toBe(false)` + `invalidCriteria).not.toContain("concept")` (test case C — sibling-unaffected)

These map 1:1 to the `normalizeOpenAIScore` patch contract in commit `1e931b1a`. Tests genuinely prove the patch, not "test exists, looks fine."

### ✅ Mocking strategy looks sound
- Used `jest.mock("@/lib/evaluation/pipeline/perplexityCrossCheck", ...)` with `jest.requireActual` wrapping the real implementation
- Captures return value via `mock.results` for assertions
- Default delegates to real implementation so existing tests unaffected
- New tests can override with `mockResolvedValueOnce` for synthetic `CrossCheckOutput`
- Comment about SWC hoisting behavior — sophisticated and consistent with real toolchain knowledge, not invented

### ⚠️ Tests were loaded but pass/fail status UNKNOWN
- `node_modules/.cache/jest/haste-map-*` written 2026-05-15 12:22 UTC (same minute as test file mod)
- Jest did parse/load the file
- No `jest_*` output logs, no `.snap` files, no `junit*.xml`, no jest process running at cancel time
- **Cannot confirm** whether the test actually passes
- Subagent went silent at filesystem level ~12:22 UTC and never wrote a result file

## Tomorrow's first action (suggested)

```bash
# 1. Open the diff cold, read it
cd /home/user/workspace
less pr-501-replay-test-DRAFT.diff

# 2. If diff looks good, apply against fresh clone or use existing worktree:
cd literary-ai-partner-dbd49eac
git status   # should show same two M files

# 3. Actually run the tests
npm test -- tests/evaluation/pipeline/pipeline-e2e.test.ts

# 4. If green, commit and push:
git add tests/evaluation/pipeline/pipeline-e2e.test.ts
# Revert package-lock if the 1-line change looks incidental:
# git checkout package-lock.json
git commit -m "test(pass4): deterministic replay for normalizeOpenAIScore preservation

Three test cases covering the normalizeOpenAIScore patch in 1e931b1a:
- Pass 3 emits final_score_0_10:0 → direction=INVALID, criterion preserved
- Pass 3 criterion missing entirely → direction=MISSING, criterion preserved
- Valid sibling criteria unaffected by one invalid sibling

Uses jest.mock + requireActual to wrap runPerplexityCrossCheck without
breaking existing tests in the file."
git push origin fix/eval-timeout-pass4-chunkunit-clean

# 5. Update PR #501 body's deferred-blocker section with:
# "Supplementary evidence: deterministic replay test at
#  tests/evaluation/pipeline/pipeline-e2e.test.ts (commit <SHA>)."
```

## What doesn't change tonight

- PR #501 stays draft (non-waivable merge precondition still requires the live Tier 2 chapter rerun, blocked by OpenAI account spend threshold)
- PR body's deferred-blocker section already pushed at 12:00 UTC, accurate
- The actual Pass 3 bug (why model emits `final_score_0_10:0` for emotionalResonance) is **queued for tomorrow** — replay test only validates the safety net, not the root cause

## Night summary

| Artifact | State |
|---|---|
| `normalizeOpenAIScore` patch on PR #501 (HEAD `1e931b1a`) | shipped, 20/20 unit tests green |
| PR body with deferred-blocker section | shipped (12:00 UTC) |
| 3 self-corrections to canonical comment #4457384705 | all caught at boundary, none shipped wrong |
| AI-imposed work-limit language | purged from workspace and confirmed clean on PR/comments/repo |
| Replay test | draft captured to stable workspace paths, ready for morning review |
| Pass 3 score-emission root cause | untouched, queued for tomorrow |
