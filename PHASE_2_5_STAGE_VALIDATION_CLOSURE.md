# Phase 2.5 — Stage Validation Closure

**Status:** ✅ COMPLETED  
**Date:** 2026-03-19  
**Published Commit:** `48aa4c9`  
**Depends on:** 2.1, 2.2, 2.3, 2.4  

---

## Objective

Prove the full revision pipeline operates:

- end-to-end (ingest → extraction → validation → apply)
- deterministically (repeated runs produce identical outputs)
- fail-closed under invalid conditions (malformed input → classified failure, no silent pass)
- with reproducible, archived evidence

---

## Deliverables

| Deliverable | Location | Status |
|---|---|---|
| Stage validation harness | `tests/anchors/stage-validation-e2e.test.ts` | ✅ Complete |
| Seed evidence run (run1) | `docs/operations/evidence/runs/2026-03-19_2.5_stage_validation_run1/` | ✅ Archived |
| Matrix evidence run (run2) | `docs/operations/evidence/runs/2026-03-19_2.5_stage_validation_matrix_run2/` | ✅ Archived |
| Final gate run | `docs/operations/evidence/runs/2026-03-19_2.5_stage_validation_gate_run/` | ✅ Archived |
| Roadmap updated | `RevisionGrade_Roadmap_UPDATED.md` | ✅ 2.5 → Completed |

---

## What Was Proven

### 1. End-to-End Pipeline Integrity

The system successfully executes the canonical revision pipeline across all 5 deterministic success cases:

| Stage | Metric |
|---|---|
| Ingest total | 9 candidates |
| Extracted | 9 / 9 |
| Validated (preflight) | 9 / 9 |
| Applied | 9 / 9 |

### 2. Fail-Closed Guarantees

Invalid inputs are rejected with correct classification — no silent pass-through on any case:

| Case | Expected Code | Result |
|---|---|---|
| Malformed candidate (empty proposed_text) | `PARSE_ERROR` | ✅ Matched |
| Anchor mismatch (tampered original_text) | `ANCHOR_MISS` | ✅ Matched |
| Overlapping offset ranges | `OFFSET_CONFLICT` | ✅ Matched |

### 3. Deterministic Execution

Each success case runs the full pipeline twice with distinct session and proposal IDs. The comparator strips run-specific identifiers and compares:

- normalized offsets and anchors
- before_context / after_context
- final output text

`repeated_run_identity_passed: true` for all 5 success cases.

### 4. Representative Corpus Coverage

The final gate matrix covers 5 success cases and 3 failure cases:

| Case ID | Type | Description |
|---|---|---|
| `happy-single-proposal` | Success | Single proposal, plain prose |
| `happy-multi-proposal-unicode` | Success | Disjoint proposals with Unicode + em-dash |
| `literary-prose` | Success | Multi-sentence literary paragraph, two word-choice edits |
| `dialogue-punctuation` | Success | Dialogue with em-dash, apostrophe, and punctuation edits |
| `multi-paragraph-spacing` | Success | Multi-paragraph with blank-line separators |
| `malformed-ingest` | Failure | Empty proposed_text → `PARSE_ERROR` |
| `extraction-mismatch` | Failure | Tampered original_text → `ANCHOR_MISS` |
| `apply-preflight-overlap` | Failure | Overlapping ranges → `OFFSET_CONFLICT` |

---

## Evidence

**Final Gate Run:**  
`docs/operations/evidence/runs/2026-03-19_2.5_stage_validation_gate_run/`

**Artifacts:**
- `pack25_stage_validation.log`
- `pack25_stage_validation_report.json`
- `pack25_stage_validation_report.md`

**Commit stamped in report:** `d0e913f23a5ffe1a8b5d5eefc0f37246482a4fa4`  
**Published commit (closeout):** `48aa4c9`

---

## Gate Metrics

```json
{
  "success_case_total": 5,
  "success_case_passed": 5,
  "failure_case_total": 3,
  "failure_case_passed": 3,
  "ingest_count_total": 9,
  "extracted_count_total": 9,
  "validated_count_total": 9,
  "applied_count_total": 9,
  "repeated_run_identity_passed": true,
  "pass": true
}
```

---

## Canonical Source Files

| Role | File |
|---|---|
| Failure codes | `lib/errors/revisionCodes.ts` |
| Apply engine | `lib/revision/applyBatch.ts` |
| Extraction contract | `lib/revision/anchorContract.ts` |
| Proposal normalization | `lib/revision/proposals.ts` |
| Failure classification | `lib/revision/failureClassification.ts` |
| Stage validation harness | `tests/anchors/stage-validation-e2e.test.ts` |

---

## What This Means

Phase 2.5 confirms:

- The pipeline is **fully connected** — no broken joins between ingest, extraction, validation, and apply
- The system is **deterministic** — identical source + proposals produce identical outputs across independent runs
- All failure modes are **fail-closed and classified** — every invalid path throws and maps to a canonical `RevisionFailureCode`
- Execution is **reproducible and auditable** — evidence is machine-readable JSON, commit-stamped, and permanently archived

The engine has progressed:

> **2.4:** verified component behavior (failure codes, engine hardening, 100k soak)  
> **2.5:** verified system-level behavior (end-to-end, deterministic, fail-closed, representative corpus)

---

## Next Phase

**Phase 2.6 — A6 Report Credibility**

Focus:
- Rubric exposure layer
- Confidence scoring per criterion
- Provenance tracking (which evidence drove which score)
