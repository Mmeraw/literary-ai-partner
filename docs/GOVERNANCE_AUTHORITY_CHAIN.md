# Governance Authority Chain Reference

> ⚠️ **Supersession Notice (2026-04):**
> Portions of this document describe pre-cutover architecture and are retained for historical/audit context.
> Current binding runtime authority for execution flow is:
> `docs/CANONICAL_RUNTIME_OPERATIONS.md`
>
> If any section here conflicts with canonical runtime operations or current architecture invariants,
> treat this document as historical and follow canonical runtime operations.
**Version:** 1.0.0  
**Date:** 2026-02-21  
**Purpose:** Document the binding authority chain for WAVE evaluation and artifact persistence

---

## Executive Summary

The RevisionGrade evaluation system operates under a strict **canonical authority chain** where WAVE Revision Guide principles flow through code, into artifacts, and surface in the UI. This document maps that chain and verifies each component enforces it.

---

## Authority Chain (Top-Down)

```
┌─────────────────────────────────────────────────────────────────────┐
│                  1. WAVE REVISION GUIDE (CANONICAL)                 │
│              docs/WAVE_REVISION_GUIDE_CANON.md                      │
│                                                                       │
│  • Sole authority for narrative interpretation                       │
│  • Defines 3 tiers: Early (Structural), Mid (Momentum), Late (Polish)│
│  • Requires all 13 criteria evaluation                               │
│  • Platforms implement; do not redefine                              │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│          2. 13-CRITERION REGISTRY (GOVERNANCE ENFORCEMENT)          │
│              schemas/criteria-keys.ts                               │
│                                                                       │
│  • CRITERIA_KEYS = 13 canonical keys (immutable)                    │
│  • CRITERIA_METADATA = human-readable labels + descriptions         │
│  • Order is stable (supports audit reproducibility)                 │
│                                                                       │
│  Keys:                                                               │
│   1. concept              5. sceneConstruction  9. pacing            │
│   2. narrativeDrive       6. dialogue          10. proseControl      │
│   3. character            7. theme             11. tone              │
│   4. voice                8. worldbuilding      12. narrativeClosure  │
│                                                13. marketability      │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│          3. AI EVALUATION PROCESSOR (REAL OR MOCK)                  │
│              lib/evaluation/processor.ts                            │
│                                                                       │
│  Real Path (OPENAI_API_KEY configured):                             │
│  • Calls OpenAI gpt-4o-mini with manuscript                         │
│  • Returns EvaluationResultV1 with criterion analysis               │
│  • governance.warnings = [] (no mock flag)                          │
│                                                                       │
│  Mock Path (fallback):                                              │
│  • Returns structurally valid EvaluationResultV1                    │
│  • governance.warnings = ["MOCK EVALUATION: ..."]                   │
│  • Used for testing, CI/CD, missing API key                         │
│                                                                       │
│  All results must include all 13 criteria (fail-closed validation)  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│          4. MANUSCRIPT EVALUATOR (ORCHESTRATOR)                     │
│              lib/evaluation/fullManuscript.ts                       │
│                                                                       │
│  Process:                                                            │
│  1. Receives EvaluationResultV1 from processor                      │
│  2. Validates result contains all 13 criteria                       │
│  3. Calls Phase 2 to persist to evaluation_artifacts                │
│  4. Returns artifact ID or error                                    │
│                                                                       │
│  Enforces WAVE tiers in comments (Early/Mid/Late)                   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│          5. PHASE 2 ARTIFACT PERSISTENCE (CANONICAL)                │
│              lib/evaluation/phase2.ts                               │
│                                                                       │
│  Invariants:                                                         │
│  • Validates exactly 13 criteria via CRITERIA_KEYS                  │
│  • Computes source_hash for idempotency                             │
│  • Upserts to evaluation_artifacts table (never duplicate)          │
│  • Stores full EvaluationResultV1 as content                        │
│  • artifact_type = "one_page_summary" (canonical)                   │
│                                                                       │
│  Fail-Closed: Artifact must have 13 criteria or write fails         │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│          6. EVALUATION ARTIFACTS TABLE (PERSISTED SOURCE)           │
│              Supabase: evaluation_artifacts                         │
│                                                                       │
│  Canonical fields:                                                   │
│  • id (unique)                                                       │
│  • job_id (links to evaluation_jobs)                                │
│  • artifact_type = "one_page_summary"                               │
│  • content (JSON) = full EvaluationResultV1                         │
│  • source_hash (idempotency key)                                    │
│  • created_at / updated_at (database-managed)                       │
│                                                                       │
│  Truth Source: Report UI reads from this table, not inline results  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│          7. REPORT GENERATION (DOWNSTREAM CONSUMER)                 │
│              app/evaluate/[jobId]/page.tsx                          │
│                                                                       │
│  Process:                                                            │
│  1. Fetch artifact from evaluation_artifacts table                  │
│  2. Render criteria with canonical labels from CRITERIA_METADATA    │
│  3. Display governance warnings (mock flag if present)              │
│  4. Show all 13 criteria in report                                  │
│                                                                       │
│  Source: Artifact content, never inline_job_result fallback         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Governance Contracts (Non-Negotiable)

### 1. Canonical Authority
**Rule**: The WAVE Revision Guide is the sole source of truth for evaluation semantics.

**Enforcement**: 
- Code comments reference `docs/WAVE_REVISION_GUIDE_CANON.md`
- Platform behavior conforms to guide; guide does not conform to platform

**Violation**: Platform behavior that contradicts the guide = bug (not feature)

### 2. 13 Criteria Completeness
**Rule**: All evaluation results must contain exactly 13 criteria from CRITERIA_KEYS.

**Enforcement**:
- `validateCriteriaCompleteness()` in fullManuscript.ts
- `validateCriteriaCompleteness()` in phase2.ts
- Missing criterion = artifact write fails (fail-closed)
- Extra/invalid criterion = artifact write fails (fail-closed)

**Violation**: Evaluation with fewer than 13 criteria is non-compliant

### 3. Artifact Persistence (Phase 2)
**Rule**: Evaluation results must be written to evaluation_artifacts table before reporting.

**Enforcement**:
- runPhase2Aggregation() in phase2.ts
- Idempotent upsert via source_hash
- Report UI reads from evaluation_artifacts, not inline results

**Violation**: Report reading from inline_job_result instead of artifact = bug

### 4. Idempotency via source_hash
**Rule**: Same job + same content = same artifact (no duplicates).

**Enforcement**:
- computeSourceHash() excludes timestamps
- Upsert on (job_id, artifact_type) composite key
- Multiple evaluations of same job overwrite, never duplicate

**Violation**: Evaluation run twice = two artifact rows (idempotency failure)

### 5. Mock Evaluation Honesty
**Rule**: Mock evaluations must be flagged in governance.warnings.

**Enforcement**:
- generateMockEvaluation() includes "MOCK EVALUATION" warning
- Real AI path includes no mock warning
- UI can surface warning when present

**Violation**: Serving mock data without governance warning = deceptive

---

## Code-to-Canon Mapping

| WAVE Canon | Code Enforcement | Verification |
|---|---|---|
| "Sole authority for narrative interpretation" | CRITERIA_KEYS immutable registry | `CRITERIA_KEYS.length === 13` |
| "Platforms implement; do not redefine" | Code references guide by path | grep `WAVE_REVISION_GUIDE_CANON.md` |
| "All 13 criteria required" | validateCriteriaCompleteness() | Two validators (fullManuscript + phase2) |
| "Artifacts persist to table" | runPhase2Aggregation() upserts | evaluation_artifacts row exists |
| "No duplicates" | source_hash idempotency | upsert on (job_id, artifact_type) |
| "Mock must be flagged" | governance.warnings in result | warnings array populated |

---

## Audit Checklist

- [ ] **WAVE Guide Present**: `docs/WAVE_REVISION_GUIDE_CANON.md` exists and is linked in processor/fullManuscript comments
- [ ] **13 Criteria Registry**: CRITERIA_KEYS defined in schemas/criteria-keys.ts with all 13 keys
- [ ] **Processor References WAVE**: lib/evaluation/processor.ts header includes WAVE authority chain comments
- [ ] **Full Manuscript Validates**: lib/evaluation/fullManuscript.ts calls validateEvaluationCompleteness() before Phase 2
- [ ] **Phase 2 Validates**: lib/evaluation/phase2.ts calls validateCriteriaCompleteness() before upsert
- [ ] **Phase 2 Persists**: evaluation_artifacts table written to with full EvaluationResultV1 content
- [ ] **Source Hash Implemented**: phase2.ts computes hash for idempotency
- [ ] **Mock Flagged**: generateMockEvaluation() includes governance.warnings
- [ ] **Report Reads Artifacts**: app/evaluate/[jobId]/page.tsx fetches from evaluation_artifacts, not inline_job_result
- [ ] **No "12 Criteria" Language**: Active code uses CRITERIA_KEYS.length, not hardcoded "12"

---

## Deployment Verification

Before production deployment, verify:

1. **OPENAI_API_KEY set** in Vercel environment
   - Without key, mock evaluations will be used (governance warning will flag this)

2. **evaluation_artifacts table exists** in Supabase
   - Schema: id (uuid), job_id (text), artifact_type (text), content (jsonb), source_hash (text), created_at, updated_at

3. **RLS policies allow inserts** from service role
   - Phase 2 writes with SUPABASE_SERVICE_ROLE_KEY
   - Verify INSERT permission on evaluation_artifacts

4. **Report page reads from evaluation_artifacts**
   - Check that app/evaluate/[jobId]/page.tsx queries evaluation_artifacts table
   - Fallback to inline_job_result only if artifact missing (development mode)

5. **One real evaluation runs end-to-end**
   - Job created → processor ← AI → phase2 → artifact → report
   - Verify artifact row appears in evaluation_artifacts
   - Verify report displays all 13 criteria

---

## Governance Violations & Resolution

| Violation | Detection | Fix |
|---|---|---|
| Evaluation missing criterion | validateCriteriaCompleteness() fails | Processor must return full 13 criteria |
| Artifact not persisted | No row in evaluation_artifacts | Verify Phase 2 runs after processor |
| Report reads inline result | Fallback display mode | Enable evaluate_artifacts table |
| Mock evaluation not flagged | governance.warnings empty | Verify generateMockEvaluation() called |
| Duplicate artifacts | Multiple rows for same job_id | Verify source_hash idempotency |
| "12 criteria" in code | grep finds hardcoded "12" | Replace with CRITERIA_KEYS.length |

---

## References

- **WAVE Revision Guide**: `/docs/WAVE_REVISION_GUIDE_CANON.md`
- **Criteria Registry**: `/schemas/criteria-keys.ts`
- **Processor**: `/lib/evaluation/processor.ts`
- **Full Manuscript Evaluator**: `/lib/evaluation/fullManuscript.ts`
- **Phase 2 Artifact Writer**: `/lib/evaluation/phase2.ts`
- **Report Page**: `/app/evaluate/[jobId]/page.tsx`
- **EvaluationResultV1 Schema**: `/schemas/evaluation-result-v1.ts`

---

**End Governance Authority Chain Reference — Version 1.0.0**

**Authority**: Historical governance reference. Runtime execution authority is governed by
`docs/CANONICAL_RUNTIME_OPERATIONS.md`, `docs/JOB_CONTRACT_v1.md`, and enforced architecture invariants.
