# Gate A6 — Report Credibility Layer

Status: PLANNED  
Gate Owner: Founder / Architect  
Precondition: Gate A5 — Flow 1 End-to-End User Evaluation Loop CLOSED (CI green)

---

## 1. Intent

### Problem

After Gate A5, RevisionGrade produces an authoritative evaluation artifact and renders it correctly for the owning user.

However, the report presents a score without sufficient explanation for human trust.

Users can see *what* the score is, but not *why* it exists.

---

### Goal

Convert the evaluation report from a mechanically correct output into a **credible and explainable artifact**, without altering infrastructure, schema, or evaluation authority.

A completed evaluation must communicate:

- what was measured
- how results were interpreted
- why the score is trustworthy

All explanations must originate from persisted artifact data.

---

### Success Statement

> For completed jobs, the report displays score explanation, rubric mapping, confidence metadata, and provenance derived solely from the canonical artifact stored in `evaluation_artifacts`.

---

## 2. Non-Goals

Gate A6 explicitly does NOT include:

- schema migrations
- new database tables
- new evaluation models
- background workers
- recomputation at request time
- batch or multi-submission features (A8 scope)
- agent portals or sharing systems (A7 scope)

---

## 3. Scope

A6 modifies only three surfaces:

1. Phase 2 aggregation output (artifact JSON content)
2. Shared report type contracts
3. Report rendering UI

No new write paths may be introduced.

---

## 4. System Model

### 4.1 Canonical Artifact Authority (Inherited from A5)

- Phase 2 is the **only writer** of evaluation artifacts.
- Exactly one canonical artifact exists per `(job_id, artifact_type)`.
- Report pages read only from `evaluation_artifacts`.
- No report data may be recomputed from chunk data at render time.

These guarantees must remain unchanged.

---

### 4.2 Report Content Contract

Existing logical structure:

```ts
type BaseReportContent = {
  summary?: string;
  overall_score?: number;
  chunk_count?: number;
  processed_count?: number;
  generated_at?: string;
};
```

A6 extends this structure:

```ts
type RubricAxis = {
  key: string;
  label: string;
  score: number | null;
  explanation: string;
};

type Credibility = {
  rubricBreakdown: RubricAxis[];
  confidence: number;          // 0–1
  evidenceCount: number;
  coverageRatio: number;       // processed / total
  varianceStability: number;   // 0–1
  modelVersion: string;
};

type ReportContent = BaseReportContent & {
  credibility?: Credibility;
};
```

All values remain stored inside `evaluation_artifacts.content`.

No schema change permitted.

---

## 5. Derivation Rules (Critical)

Credibility values MUST be derived from real evaluation signals.

**Allowed sources:**

- chunk aggregation statistics
- coverage metrics
- variance calculations
- deterministic aggregation outputs

**Forbidden:**

- invented rubric scores
- hardcoded confidence values
- UI-level calculations
- request-time recomputation

If a rubric score cannot yet be derived, it must be `null`, not fabricated.

---

## 6. Invariants

### Preserve A5 Invariants

- Canonical artifact uniqueness
- Ownership enforcement
- DB → API → UI evidence chain
- Deterministic artifact writes

### New A6 Invariants

**Credibility Presence**

If `overall_score` exists for a completed job, credibility must exist.

**Structural Validity**

- `0 ≤ confidence ≤ 1`
- `0 ≤ coverageRatio ≤ 1`
- `rubricBreakdown.length ≥ 1`

**Consistency**

- `coverageRatio ≈ processedCount / chunkCount`

**Determinism**

Re-running Phase 2 with identical inputs produces equivalent credibility output.

**No Recompute Rule**

Reports must never derive credibility outside the artifact.

---

## 7. Implementation Specification

### 7.1 Types

Create:

```
lib/evaluation/report-types.ts
```

Export:

- `RubricAxis`
- `Credibility`
- `ReportContent`

Used by:

- Phase 2 aggregation
- Report renderer

---

### 7.2 Phase 2 Extension

Extend aggregation logic to compute:

- rubric axes from chunk metrics
- confidence
- evidenceCount
- coverageRatio
- varianceStability
- modelVersion

Validate invariants before artifact write.

If validation fails:

- mark job FAILED
- do not persist artifact

---

### 7.3 Report Page Rendering

File:

```
app/evaluate/[jobId]/report/page.tsx
```

Add sections:

- Score Explanation (rubric list)
- Confidence
- Provenance

**Behavior rules:**

- Render credibility only if present.
- If score exists but credibility missing → render internal error state.
- Never compute values client-side.

---

## 8. QA / QC

### Unit Tests

- aggregation produces valid credibility object
- invalid ranges rejected

### Integration Tests

End-to-end Flow 1 run must confirm:

- artifact JSON contains credibility block
- report HTML includes:
  - "Score Explanation"
  - "Confidence"
  - "Provenance"

CI must fail if credibility missing on completed jobs.

---

## 9. Metrics

Track:

- overall score distribution
- confidence distribution
- missing credibility rate (target ≈ 0)
- coverage ratio distribution
- variance stability distribution

---

## 10. SLA / Quality Bar

For any completed evaluation:

- report must display credibility section
- absence counts as product defect

---

## 11. Governance

Any change to artifact contract or credibility logic requires:

- updating this document
- updating Golden Spine entry
- updating tests

---

## 12. Definition of Done

Gate A6 is CLOSED when:

- canonical artifact contains valid credibility block
- report renders explanation, confidence, provenance
- no recomputation paths exist
- CI tests enforce invariants
- documentation merged
- closure evidence recorded

**Next Gate:** A7 — StoryGate Studio / Agent Portal Preview
