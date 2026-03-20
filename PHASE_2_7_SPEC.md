# Phase 2.7 — Evaluation Uplift (Pass 1-4, Dual Axis)

**Status:** READY TO IMPLEMENT  
**Owner:** Mike + Copilot  
**Depends on:** 2.6 (A6 Report Credibility) — CLOSED  
**LOE:** 12-16 hours  
**Canon References:** Vol II (13 Criteria, 10 diagnostic patterns), Vol III Tools (§PASS1/PASS2/PASS3 prompts, temps 0.3/0.2), Vol IV (§multi-AI consensus)

---

## 1. Intent

### Problem

After Phase 2.6, RevisionGrade produces a credible, explainable evaluation artifact — rubric, confidence, provenance all present.

But the evaluation itself is still a **single-pass** analysis using one prompt call. The result is competent but shallow: it reads like a rubric engine, not a senior editor.

Specific weaknesses:
- Recommendations tend toward generic advice ("strengthen character motivation") instead of anchoring to specific scenes, lines, or events
- No separation between structural/craft analysis and editorial/literary insight
- No quality guards prevent duplicated, vague, or coverage-incomplete output
- Single-pass evaluation cannot build interpretive depth — it describes surface-level observations

### Goal

Transform the evaluation from a single AI call into a **multi-pass pipeline** that produces dual-axis analysis:

1. **Craft Execution Axis** — How well is this written? (structural, technical, mechanical)
2. **Editorial/Literary Insight Axis** — What does this manuscript mean? (interpretive, thematic, artistic)

Each pass builds on the prior pass's observations. Quality guards enforce that output meets minimum evidence, specificity, and non-duplication standards before persistence.

### Success Statement

> A completed evaluation scores each of the 13 criteria on both axes, produces zero generic recommendations, anchors all recommendations to specific manuscript text, and passes quality guards that reject vague or duplicated output.

---

## 2. Non-Goals

Phase 2.7 explicitly does NOT include:

- Multi-chunk evaluation (that's 2.8)
- New database tables or schema migrations
- UI changes to the report page (report rendering remains as-is)
- WAVE revision suggestions (Phase 3 scope)
- Canon Gate enforcement at runtime (Phase 0 scope)
- Provider switching or multi-AI consensus (Phase 2.10/2.11 scope)

The evaluation still runs against a single text input (one chunk). Multi-chunk synthesis is Phase 2.8.

---

## 3. Architecture: Four-Pass Pipeline

### Pass 1 — Structural Analysis (Craft Execution)

**Purpose:** Analyze the manuscript for structural and technical craft quality.

**Scope:** 13 criteria, Craft Execution axis only.

**What it produces per criterion:**
- `craft_score_0_10: number` — craft execution score
- `craft_rationale: string` — structural/technical reasoning
- `craft_evidence: Evidence[]` — anchored to specific text (snippet + location)
- `craft_recommendations: Recommendation[]` — specific, actionable, anchored

**Temperature:** 0.3 (per Vol III Tools §PASS1)  
**Max tokens:** 4,000 (per Vol III Tools)

**Constraints:**
- Every recommendation MUST reference a specific `snippet` from the manuscript
- No recommendation shorter than 50 chars (per Canon Reference: soft fail minimum)
- No evidence excerpt longer than 200 chars (per Canon Reference)

---

### Pass 2 — Editorial/Literary Insight

**Purpose:** Analyze the manuscript for interpretive, thematic, and artistic quality.

**Scope:** 13 criteria, Editorial/Literary Insight axis only.

**What it produces per criterion:**
- `editorial_score_0_10: number` — editorial/literary insight score
- `editorial_rationale: string` — interpretive reasoning
- `editorial_evidence: Evidence[]` — anchored to specific text
- `editorial_recommendations: Recommendation[]` — specific, actionable, anchored

**Temperature:** 0.3 (per Vol III Tools §PASS2)  
**Max tokens:** 4,000

**Critical rule:** Pass 2 MUST NOT receive Pass 1 outputs. This is Non-Negotiable Rule #3 from the Canon Reference: "Pass 2 must never receive Pass 1 outputs — independence guarantee is absolute."

Pass 2 receives only: the original manuscript text + the 13 criteria definitions + the editorial/literary axis prompt.

---

### Pass 3 — Synthesis & Reconciliation

**Purpose:** Merge Pass 1 and Pass 2 into a unified evaluation with resolved conflicts.

**Inputs:** Pass 1 output + Pass 2 output + original manuscript text.

**What it produces per criterion:**
- `final_score_0_10: number` — reconciled score (not a simple average)
- `final_rationale: string` — synthesized reasoning that explains both axes
- `score_delta: number` — difference between craft and editorial scores
- `delta_explanation: string` — why the scores differ (if they do)

**What it produces overall:**
- `overall_score_0_100: number` — aggregate (computed per Vol II-A §WCS)
- `verdict: "pass" | "revise" | "fail"` — based on eligibility thresholds
- `one_paragraph_summary: string` — max 500 chars (per Canon Reference)
- `top_3_strengths: string[]`
- `top_3_risks: string[]`

**Temperature:** 0.2 (per Vol III Tools §PASS3 — lower for precision)  
**Max tokens:** 5,000

**Reconciliation rules:**
- If craft and editorial scores for a criterion differ by ≤2 points: use the average, rounded to nearest integer
- If they differ by >2 points: the synthesis pass must explain the divergence in `delta_explanation`
- Per Canon Reference: ±10 points auto-resolve (minor disagreement), ±20 triggers human review flag

---

### Pass 4 — Quality Gate (Deterministic, No AI)

**Purpose:** Validate the synthesized output meets quality standards before persistence. This is NOT an AI call — it is deterministic code.

**Quality checks:**

| Check | Rule | On Failure |
|---|---|---|
| No generic recommendations | Every recommendation must contain at least one quoted `snippet` from the manuscript | Reject + error code `QG_GENERIC_REC` |
| No duplicated recommendations | Recommendations across criteria must not repeat the same action | Reject + error code `QG_DUPLICATE_REC` |
| Recommendation minimum length | Every `action` field ≥ 50 chars | Reject + error code `QG_SHORT_REC` |
| Recommendation maximum length | Every `action` field ≤ 300 chars | Reject + error code `QG_LONG_REC` |
| Evidence excerpt length | Every evidence `snippet` ≤ 200 chars | Reject + error code `QG_LONG_EVIDENCE` |
| Overview length | `one_paragraph_summary` ≤ 500 chars | Reject + error code `QG_LONG_OVERVIEW` |
| All 13 criteria present | Output must contain exactly 13 criterion entries matching CRITERIA_KEYS | Reject + error code `QG_CRITERIA_MISSING` |
| Score range | All scores 0-10 integer (no half-points per Canon) | Reject + error code `QG_SCORE_RANGE` |
| Confidence minimum | Every criterion confidence ≥ 0.5 (per Canon soft fail) | Warn (do not reject) |
| No cross-contamination | Pass 2 outputs must not contain verbatim phrases from Pass 1 (independence check) | Reject + error code `QG_INDEPENDENCE_VIOLATION` |

On any rejection: the pipeline returns a structured error. The job is marked FAILED with the quality gate error code. No artifact is persisted.

---

## 4. Type Contracts

### New types (create in `lib/evaluation/pipeline/types.ts`)

```ts
import type { CriterionKey } from "@/schemas/criteria-keys";

// ── Evidence ──
type EvidenceAnchor = {
  snippet: string;          // ≤200 chars, from manuscript
  char_start?: number;
  char_end?: number;
  segment_id?: string;
};

// ── Single-axis criterion result ──
type AxisCriterionResult = {
  key: CriterionKey;
  score_0_10: number;       // integer, 0-10
  rationale: string;
  evidence: EvidenceAnchor[];
  recommendations: {
    priority: "high" | "medium" | "low";
    action: string;          // 50-300 chars, must reference snippet
    expected_impact: string;
    anchor_snippet: string;  // the specific text this rec targets
  }[];
};

// ── Pass 1 / Pass 2 output ──
type SinglePassOutput = {
  pass: 1 | 2;
  axis: "craft_execution" | "editorial_literary";
  criteria: AxisCriterionResult[];
  model: string;
  prompt_version: string;
  temperature: number;
  generated_at: string;      // ISO 8601
};

// ── Pass 3: Synthesized criterion ──
type SynthesizedCriterion = {
  key: CriterionKey;
  craft_score: number;
  editorial_score: number;
  final_score_0_10: number;  // reconciled
  score_delta: number;       // |craft - editorial|
  delta_explanation?: string; // required if delta > 2
  final_rationale: string;
  evidence: EvidenceAnchor[];
  recommendations: {
    priority: "high" | "medium" | "low";
    action: string;
    expected_impact: string;
    anchor_snippet: string;
    source_pass: 1 | 2 | 3;  // which pass originated this rec
  }[];
};

// ── Pass 3 output ──
type SynthesisOutput = {
  criteria: SynthesizedCriterion[];
  overall: {
    overall_score_0_100: number;
    verdict: "pass" | "revise" | "fail";
    one_paragraph_summary: string;
    top_3_strengths: string[];
    top_3_risks: string[];
  };
  metadata: {
    pass1_model: string;
    pass2_model: string;
    pass3_model: string;
    generated_at: string;
  };
};

// ── Pass 4: Quality gate result ──
type QualityGateResult = {
  pass: boolean;
  checks: {
    check_id: string;
    passed: boolean;
    error_code?: string;
    details?: string;
  }[];
  warnings: string[];
};

// ── Pipeline result ──
type PipelineResult =
  | { ok: true; synthesis: SynthesisOutput; quality_gate: QualityGateResult }
  | { ok: false; error: string; error_code: string; failed_at: "pass1" | "pass2" | "pass3" | "pass4" };
```

---

## 5. File Structure

```
lib/evaluation/pipeline/
  types.ts                    — type contracts (above)
  runPass1.ts                 — Craft Execution pass
  runPass2.ts                 — Editorial/Literary Insight pass  
  runPass3Synthesis.ts        — Reconciliation + synthesis
  qualityGate.ts              — Deterministic quality validation (Pass 4)
  runPipeline.ts              — Orchestrator: Pass1 → Pass2 → Pass3 → Pass4
  prompts/
    pass1-craft.ts            — Pass 1 system prompt
    pass2-editorial.ts        — Pass 2 system prompt
    pass3-synthesis.ts        — Pass 3 system prompt

tests/evaluation/pipeline/
  pass1-craft.test.ts         — Pass 1 unit tests
  pass2-editorial.test.ts     — Pass 2 unit tests  
  pass3-synthesis.test.ts     — Reconciliation tests
  quality-gate.test.ts        — Quality gate validation tests
  pipeline-e2e.test.ts        — Full pipeline integration test
  independence.test.ts        — Pass 1/2 independence guarantee test

scripts/pipeline/
  run-pipeline-evidence.ts    — Evidence runner (like run-a6-evidence.ts)
```

---

## 6. Integration with Existing Code

### processor.ts

The existing `processor.ts` makes a single OpenAI call and produces `EvaluationResultV1`. Phase 2.7 replaces this with the 4-pass pipeline but MUST produce a compatible `EvaluationResultV1` at the end.

**Approach:** `runPipeline.ts` returns a `SynthesisOutput`. A new function `synthesisToEvaluationResult()` maps it to `EvaluationResultV1` format so downstream code (phase2.ts, governance bridge, report UI) continues to work unchanged.

### phase2.ts

No changes. It receives `EvaluationResultV1` and persists it. The pipeline is upstream of phase2.

### evaluationBridge.ts

No changes. The governance bridge translates criterion keys and enforces eligibility. The pipeline's output, once mapped to `EvaluationResultV1`, flows through the existing bridge.

### report-types.ts / A6 credibility

The A6 credibility layer reads from persisted artifacts. As long as the artifact contains valid `EvaluationResultV1`, credibility computation works. The pipeline adds richer data, which the credibility layer will naturally reflect.

---

## 7. Invariants

### Pipeline Invariants
1. Pass 2 NEVER receives Pass 1 output (independence guarantee — Non-Negotiable Rule #3)
2. Quality gate is deterministic code, not an AI call
3. Pipeline fails closed — any pass failure → job FAILED, no artifact persisted
4. All 13 criteria must appear in output — missing criteria = rejection
5. Scores are integers 0-10, no half-points

### Quality Invariants
6. Zero generic recommendations (every rec anchors to specific text)
7. No duplicated recommendations across criteria
8. Evidence excerpts ≤ 200 chars
9. Recommendations 50-300 chars
10. Overview ≤ 500 chars

---

## 8. Test Strategy

### Unit Tests

| Test File | What It Tests |
|---|---|
| `pass1-craft.test.ts` | Pass 1 produces valid AxisCriterionResult[] for all 13 criteria, craft axis |
| `pass2-editorial.test.ts` | Pass 2 produces valid AxisCriterionResult[] for all 13 criteria, editorial axis |
| `pass3-synthesis.test.ts` | Reconciliation logic: score merging, delta explanation, verdict computation |
| `quality-gate.test.ts` | All 10 quality checks: generic recs, duplicates, length bounds, score ranges, independence |
| `independence.test.ts` | Pass 2 output contains no verbatim phrases from Pass 1 |

### Integration Test

| Test File | What It Tests |
|---|---|
| `pipeline-e2e.test.ts` | Full pipeline: Pass1 → Pass2 → Pass3 → Pass4 → EvaluationResultV1 mapping |

### Evidence Run

`scripts/pipeline/run-pipeline-evidence.ts` — runs the full pipeline against a test manuscript, produces:
- `pipeline_report.json` — full synthesis output
- `pipeline_report.md` — rendered markdown
- `quality_gate_results.json` — all check results
- `metadata.json` — run metadata

---

## 9. Success Criteria (from Roadmap)

- [ ] Dual-axis scores (craft + editorial) for all 13 criteria
- [ ] Zero generic recommendations — all anchored to specific manuscript text
- [ ] All recommendations 50-300 chars with quoted snippet
- [ ] Quality guards pass CI (10 checks)
- [ ] Pass 1/2 independence guarantee enforced and tested
- [ ] Pipeline produces valid EvaluationResultV1 (backward compatible)
- [ ] Evidence run archived with all artifacts

---

## 10. Closure Template

When complete, produce `PHASE_2_7_EVALUATION_UPLIFT_CLOSURE.md` with:
- Deliverables table (file → status)
- What was proven (dual-axis, quality guards, independence)
- Evidence artifacts and locations
- Gate metrics (quality gate results)
- Test suite summary
- Canonical source files
- Spec compliance check

---

## 11. Estimated Approach

Suggested implementation order:

1. **Types first** — `lib/evaluation/pipeline/types.ts`
2. **Quality gate** — `qualityGate.ts` + `quality-gate.test.ts` (deterministic, no AI needed)
3. **Prompts** — `pass1-craft.ts`, `pass2-editorial.ts`, `pass3-synthesis.ts`
4. **Pass 1** — `runPass1.ts` + test
5. **Pass 2** — `runPass2.ts` + test + independence test
6. **Pass 3** — `runPass3Synthesis.ts` + test
7. **Orchestrator** — `runPipeline.ts` + `pipeline-e2e.test.ts`
8. **Bridge** — `synthesisToEvaluationResult()` mapping function
9. **Evidence run** — `run-pipeline-evidence.ts`
10. **Closure doc**
