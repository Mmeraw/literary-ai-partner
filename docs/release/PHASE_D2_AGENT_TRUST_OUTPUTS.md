# Phase D2 — Agent Trust Signals and Output Clarity

**Authority:** Release Governance (Binding)  
**Status:** ACTIVE (Closes via evidence-bearing PR)  
**Effective Date:** 2026-02-08  
**Last Updated:** 2026-02-08  
**Agent-View Surface:** app/reports/[jobId]/page.tsx  
**Change Control:** ACTIVE (updated as gates close)

---

## Scope

This gate governs agent-facing report output clarity and trust signals.

D2 is CLOSED only when the agent-view surface renders required trust signals and blocks forbidden claims, proven by fixtures + tests.

---

## Required Fields (Must Be Visible)

The agent-view report MUST visibly display:

### 1. Work Type Used
- Field: `finalWorkTypeUsed`
- Type: Non-empty string
- Display requirement: Must appear in the "Evaluation Transparency" header

### 2. Matrix Version
- Field: `matrixVersion`
- Type: Non-empty string
- Display requirement: Must appear in the "Evaluation Transparency" header

### 3. Criteria Applicability Summary
- Derived from: `criteriaPlan` (R/O/NA/C counts)
- Type: Structured with counts and explicit NA language
- Display requirement: Must include clear summary:
  - "R={n} · O={n} · NA={n} · C={n}"
  - **Explicit statement:** "NA criteria were structurally excluded and were not evaluated."

### 4. Repro Anchor
- Must visibly include:
  - jobId
  - timestamp (report generation time)
  - matrixVersion
- Display requirement: Must appear as repro coordinate in header

---

## Forbidden Claims (Must Not Appear)

The agent-view report MUST NOT contain market guarantees or predictive certainty language.

This is a **fail-closed requirement**: if forbidden language is detected, the report must not render as a completed evaluation.

### Forbidden Patterns (case-insensitive)

- `guarantee`, `guaranteed`, `guarantees`
- `will sell`
- `best-seller`, `bestseller`
- `surefire`
- `certain to sell`
- `agent will` (in context of market success)
- `publisher will` (in context of market success)
- `will get picked up`
- `will be acquired`

---

## Fail-Closed Behavior

If D2 requirements are **not** satisfied:

1. The report must **not** present as "complete"
2. A user-safe "Compliance Hold" message must appear
3. Repro anchor (jobId) must be logged for support
4. No internal errors or stack traces may be displayed to end-user

### Fail-Closed Conditions

- Any forbidden market claim language detected in result string fields
- Any required trust field missing (`finalWorkTypeUsed`, `matrixVersion`, `criteriaPlan`)

---

## Evidence Requirements

D2 closure PR must include:

1. **docs/release/PHASE_D2_AGENT_TRUST_OUTPUTS.md** (this file)
2. **evidence/phase-d/d2/agent-view-fixtures/**
   - README.md (fixture description and test command)
   - sample_evaluation_result_v1__sanitized.json (exemplary passing case)
   - sample_evaluation_result_v1__forbidden_language.json (exemplary forbidden-language rejection)
3. **Code changes:**
   - lib/release/forbiddenMarketClaims.ts (scanner + pattern list)
   - components/reports/AgentTrustHeader.tsx (required header component)
   - app/reports/[jobId]/page.tsx (route enforcement + component embedding)
4. **Tests:**
   - __tests__/phase_d/d2_forbidden_language_scan.test.ts (scanner assertions)
   - __tests__/phase_d/d2_agent_trust_header.test.tsx (header rendering assertions)
5. **CI/PR Checks:**
   - All tests must pass
   - No linter errors allowed

---

## Testing Contract

The test suite must assert:

### Positive Cases (Header renders correctly)
- All 4 required fields present in rendered output
- NA exclusion language explicitly appears
- Repro anchor is readable

### Negative Cases (Fail-closed prevents rendering)
- Any forbidden claim causes report to fail-close
- Missing required field causes report to fail-close
- Compliance hold message is clear and safe

### Pattern Matching
- Scanner must detect all forbidden patterns (case-insensitive)
- Scanner must not flag neutral language as forbidden
- Scanner must traverse nested JSON/object structures

---

## Architectural Notes

### Trust Header Component
- Rendered above all evaluation content
- Clearly labeled "Evaluation Transparency"
- Non-dismissable (required for every agent-view page)
- Audit-safe styling (no obfuscation)

### Scanner Function
- Pure function (no side effects)
- Detects patterns anywhere in object tree
- Safe for circular reference detection
- Returns simple boolean (detected / not detected)

### Route-Level Enforcement
- Check forbidden claims **before** component rendering
- Check required fields **before** component rendering
- Fail-closed decision happens in route, not in component

---

## Related Documents

- **docs/release/PHASE_D_RELEASE_GATES_v1.md** — Gate definitions and closure requirements
- **docs/release/PHASE_D_RELEASE_READINESS.md** — RRS thresholds and go/no-go criteria
- **docs/GOVERNANCE_AUTHORITY_INDEX.md** — Rule #2 (Immutable Public API Rule) governs agent-facing contracts

---

## No-Go Indicators

D2 cannot close if:

- Required fields are not universally visible in agent-view surface
- Forbidden language is not fail-closed (i.e., report renders despite detection)
- Tests do not pass
- Evidence is incomplete or unlinked

---

## Audit Trail

**Created:** 2026-02-08  
**Rationale:** Phase C completed all 5 governance rules (60 RRS points). Phase D D2 is the first closure gate: fastest (4-6 days), highest-confidence delivery (UI-only, no infra changes), unblocks controlled beta at RRS 76%.

**Key Decision:** Fail-closed (do not render) on forbidden market language, rather than redact or warn. This is the military-grade stance: if agent-facing copy contains market guarantees, the entire report is withheld and escalated for review.
