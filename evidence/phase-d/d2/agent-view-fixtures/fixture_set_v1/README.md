# D2 Agent View Fixtures — fixture_set_v1

These fixtures support Phase D Gate D2 closure for the agent-view surface.

**Target surface:** app/reports/[jobId]/page.tsx

## What These Fixtures Prove

✅ **Positive Case:** Work Type + matrix version are visible in agent-view report  
✅ **Positive Case:** Applicability summary includes R/O/NA/C and explicit NA exclusion language  
✅ **Positive Case:** Repro anchor includes jobId + timestamp + matrix version  
✅ **Negative Case:** Forbidden "market guarantee" language is blocked (fail-closed)  
✅ **Negative Case:** Missing required fields cause fail-closed behavior  

## Files in This Fixture Set

### sample_evaluation_result_v1__sanitized.json
"Passing" fixture showing a minimal valid evaluation result that:
- Includes all required D2 fields
- Contains no forbidden market language
- Should render as a complete agent-view report

Use this to manually test the happy path or as a reference for integration tests.

### sample_evaluation_result_v1__forbidden_language.json
"Failing" fixture showing an evaluation result with market guarantee language:
- Includes all required D2 fields
- Contains forbidden phrase: "This will sell. Guaranteed."
- Should trigger fail-closed behavior (report is withheld)

Use this to verify that the forbiddenMarketClaims scanner correctly rejects dangerous language.

## How to Run Tests

```bash
# Run the full test suite (Jest)
npm test

# Run only D2 tests
npm test -- d2_

# Run with verbose output
npm test -- d2_ --verbose

# Watch mode for development
npm test -- d2_ --watch
```

## What "Pass" Means

**Tests pass when:**
1. `d2_forbidden_language_scan.test.ts` assertions all succeed
   - Scanner detects all forbidden patterns (case-insensitive)
   - Scanner does not flag neutral language
   - Scanner traverses nested objects correctly

2. `d2_agent_trust_header.test.tsx` assertions all succeed
   - All 4 required fields render in the header
   - NA exclusion language appears explicitly
   - Repro anchor is readable and contains all components

3. Route-level enforcement works (manual or E2E test)
   - Forbidden language causes fail-closed (renders "Compliance Hold")
   - Missing required fields cause fail-closed
   - Valid reports render with the trust header

## Fixture Format Notes

Both JSON fixtures follow the `evaluation_result_v1` schema.

**Key fields for D2:**
- `finalWorkTypeUsed` (string) — Work type label
- `matrixVersion` (string) — Matrix version identifier
- `criteriaPlan` (object with R/O/NA/C arrays) — Applicability breakdown
- `generatedAt` (ISO 8601 timestamp) — Report generation time
- `agentSummary` (object) — Text content that may contain forbidden language

**Sanitization approach:**
The "sanitized" fixture contains generic, neutral text that would pass all D2 checks.
The "forbidden language" fixture intentionally includes prohibited patterns to test rejection.

---

**Evidence Committed:** 2026-02-08  
**Fixture Set Version:** v1  
**Status:** ✅ Ready for D2 gate closure PR
