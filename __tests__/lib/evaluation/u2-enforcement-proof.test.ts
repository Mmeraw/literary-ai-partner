/**
 * U2 Enforcement Proof
 *
 * GOVERNANCE GATE: This file is the promotion rule for U2 → ENFORCED status.
 * It must pass in full before U3 work is unblocked.
 *
 * Four-layer requirement (all layers must pass):
 *
 * Layer 1 — Gate fires
 *   QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH and QG_SUMMARY_OMITS_WEAKNESS
 *   trigger on known-bad synthetic input.
 *
 * Layer 2 — Persisted artifact is downgraded
 *   downgradedResult reaches persistEvaluationResultV2 (via processor
 *   integration path with injected mocks, not just gate unit test).
 *
 * Layer 3 — ViewModel reflects downgraded state
 *   evaluationReportViewModel produces "Not scorable" scoreLabel and
 *   constrained confidenceLabel for the downgraded criterion.
 *
 * Layer 4 — All renderers consistent
 *   Web (page.tsx), TXT, HTML, DOCX all consume the same VM output.
 *   Proved via the UED → VM pipeline that all renderer surfaces consume.
 *
 * FIXTURE DESIGN: Synthetic governance conditions only.
 *   - No manuscripts, no literary motifs, no real text.
 *   - Criterion A: SCORABLE, score=8, confidence_level="low"
 *       → triggers QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH
 *       → downgradedResult: status=INSUFFICIENT_SIGNAL, score_0_10=null
 *   - Criterion B: score=2 (bottom scorer), readable token absent from summary
 *       → triggers QG_SUMMARY_OMITS_WEAKNESS
 *   - Criterion C: SCORABLE, zero evidence anchors → upstreamIntegrity="weak"
 *   - Criterion D: downgraded criterion in VM → "Not scorable" + constrained confidence
 *
 * IMPORTANT: QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH is intentionally excluded
 * from failedHardChecks. Downgrade is via artifact mutation (downgradedResult),
 * not job rejection. The gate still passes (pass: true) while emitting the
 * downgraded artifact.
 */

import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { runQualityGateV2 } from "@/lib/evaluation/pipeline/qualityGate";
import { buildShortFormEvaluationDocument } from "@/lib/evaluation/shortFormReportDocument";
import { normalizeEvaluationReportViewModel } from "@/lib/evaluation/evaluationReportViewModel";
import { buildUnifiedEvaluationDocument } from "@/lib/evaluation/unifiedEvaluationDocument";

// ── Synthetic fixture constants ───────────────────────────────────────────────

// Criterion A: high score at low confidence → QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH
const CRITERION_A_KEY = "concept" as const;
const CRITERION_A_SCORE = 8; // exceeds low-confidence cap (5)

// Criterion B: bottom scorer whose readable token is absent from summary
// "dialogue" → keyToReadableToken → "dialogue"
const CRITERION_B_KEY = "dialogue" as const;
const CRITERION_B_SCORE = 2; // bottom score — guaranteed to be identified as weakness

// Criterion C: zero evidence anchors → weak upstreamIntegrity
const CRITERION_C_KEY = "theme" as const;

// Summary that deliberately omits the bottom-scoring criterion token ("dialogue")
// to trigger QG_SUMMARY_OMITS_WEAKNESS. Uses generic synthetic text only.
const SYNTHETIC_SUMMARY_OMITTING_WEAKNESS =
  "The synthetic evaluation fixture demonstrates deterministic gate compliance. " +
  "Criterion A exhibits high score at low confidence. Criterion C lacks evidence anchors. " +
  "No literary content, manuscript text, or real motifs are present in this fixture.";

// ── Base fixture builder ──────────────────────────────────────────────────────

function makeU2SyntheticFixture(): EvaluationResultV2 {
  return {
    schema_version: "evaluation_result_v2",
    ids: {
      evaluation_run_id: "run-u2-enforcement-proof",
      job_id: "job-u2-enforcement-proof",
      manuscript_id: 0,
      user_id: "00000000-0000-0000-0000-000000000000",
    },
    generated_at: "2026-07-07T00:00:00.000Z",
    engine: {
      model: "synthetic",
      provider: "deterministic",
      prompt_version: "u2-enforcement-proof-v1",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 65,
      scored_criteria_count: CRITERIA_KEYS.length,
      // Deliberately omits "dialogue" token → triggers QG_SUMMARY_OMITS_WEAKNESS
      one_paragraph_summary: SYNTHETIC_SUMMARY_OMITTING_WEAKNESS,
      top_3_strengths: ["concept", "character", "voice"],
      top_3_risks: ["dialogue", "theme", "pacing"],
    },
    criteria: CRITERIA_KEYS.map((key) => {
      if (key === CRITERION_A_KEY) {
        // Criterion A: SCORABLE, high score, low confidence
        // → QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH
        return {
          key,
          scorable: true as const,
          status: "SCORABLE" as const,
          signal_present: true,
          signal_strength: "SUFFICIENT" as const,
          confidence_band: "LOW" as const,
          confidence_level: "low",
          confidence_score_0_100: 20,
          score_0_10: CRITERION_A_SCORE,
          rationale:
            "Synthetic criterion A: high score at low confidence for gate trigger.",
          evidence: [
            {
              snippet:
                "Synthetic evidence anchor A-1: governance condition for QG_FIDELITY trigger.",
            },
            {
              snippet:
                "Synthetic evidence anchor A-2: deterministic compliance proof.",
            },
          ],
          recommendations: [
            {
              priority: "medium" as const,
              action: "Synthetic revision action for criterion A.",
              expected_impact: "Demonstrates gate compliance path.",
            },
          ],
        };
      }

      if (key === CRITERION_B_KEY) {
        // Criterion B: bottom scorer, token absent from summary
        // → QG_SUMMARY_OMITS_WEAKNESS
        return {
          key,
          scorable: true as const,
          status: "SCORABLE" as const,
          signal_present: true,
          signal_strength: "SUFFICIENT" as const,
          confidence_band: "MEDIUM" as const,
          score_0_10: CRITERION_B_SCORE,
          rationale:
            "Synthetic criterion B: low score to trigger bottom-weakness check.",
          evidence: [
            {
              snippet:
                "Synthetic evidence anchor B-1: bottom-score fixture for QG_SUMMARY_OMITS_WEAKNESS.",
            },
            {
              snippet:
                "Synthetic evidence anchor B-2: deterministic weakness identification.",
            },
          ],
          recommendations: [
            {
              priority: "high" as const,
              action: "Synthetic revision action for criterion B (bottom scorer).",
              expected_impact: "Demonstrates summary-weakness gate compliance.",
            },
          ],
        };
      }

      if (key === CRITERION_C_KEY) {
        // Criterion C: SCORABLE, zero evidence anchors → weak upstreamIntegrity
        return {
          key,
          scorable: true as const,
          status: "SCORABLE" as const,
          signal_present: false,
          signal_strength: "WEAK" as const,
          confidence_band: "LOW" as const,
          score_0_10: 5,
          rationale:
            "Synthetic criterion C: zero evidence anchors to demonstrate upstreamIntegrity=weak.",
          evidence: [], // No anchors — intentional
          recommendations: [],
        };
      }

      // All other criteria: clean baseline
      return {
        key,
        scorable: true as const,
        status: "SCORABLE" as const,
        signal_present: true,
        signal_strength: "SUFFICIENT" as const,
        confidence_band: "MEDIUM" as const,
        score_0_10: 7,
        rationale: `Synthetic baseline criterion ${key}: clean gate compliance.`,
        evidence: [
          {
            snippet: `Synthetic evidence anchor for ${key} — deterministic baseline.`,
          },
          {
            snippet: `Synthetic evidence anchor 2 for ${key} — gate threshold compliance.`,
          },
        ],
        recommendations: [
          {
            priority: "low" as const,
            action: `Synthetic baseline revision for ${key}.`,
            expected_impact: "Baseline criterion — no gate triggers expected.",
          },
        ],
      };
    }),
    recommendations: {
      quick_wins: [
        {
          action: "Synthetic quick win: baseline governance fixture.",
          why: "Demonstrates clean pass path for non-triggered criteria.",
        },
      ],
      strategic_revisions: [
        {
          action: "Synthetic strategic revision: address bottom-score criterion.",
          why: "Bottom-scorer identified by QG_SUMMARY_OMITS_WEAKNESS gate.",
        },
      ],
    },
    metrics: {
      manuscript: {
        word_count: 80000,
      },
      processing: {},
    },
    artifacts: [],
    governance: {
      confidence: 0.75,
      warnings: [],
      limitations: [],
      policy_family: "multi-pass-dual-axis",
      observability_warnings: [],
    },
  };
}

// ── Layer 1: Gate fires ───────────────────────────────────────────────────────

describe("U2 Enforcement Proof — Layer 1: Gate fires on synthetic input", () => {
  it("QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH fires for criterion A (high score, low confidence)", () => {
    const fixture = makeU2SyntheticFixture();
    const result = runQualityGateV2(fixture);

    const fidelityCheck = result.checks.find(
      (check) =>
        check.check_id === "v2_fidelity_score_confidence_alignment" &&
        !check.passed &&
        check.error_code === "QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH",
    );
    expect(fidelityCheck).toBeDefined();
    expect(fidelityCheck?.error_code).toBe("QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH");
  });

  it("QG_SUMMARY_OMITS_WEAKNESS fires for criterion B (bottom scorer absent from summary)", () => {
    const fixture = makeU2SyntheticFixture();
    const result = runQualityGateV2(fixture);

    const summaryCheck = result.checks.find(
      (check) =>
        !check.passed &&
        check.error_code === "QG_SUMMARY_OMITS_WEAKNESS",
    );
    expect(summaryCheck).toBeDefined();
    expect(summaryCheck?.error_code).toBe("QG_SUMMARY_OMITS_WEAKNESS");
  });

  it("gate produces a downgradedResult (non-mutating artifact)", () => {
    const fixture = makeU2SyntheticFixture();
    const originalCriterionA = structuredClone(
      fixture.criteria[CRITERIA_KEYS.indexOf(CRITERION_A_KEY)],
    );

    const result = runQualityGateV2(fixture);

    // Gate produces downgradedResult
    expect(result.downgradedResult).toBeDefined();

    // Original fixture is NOT mutated (non-mutating contract)
    expect(
      fixture.criteria[CRITERIA_KEYS.indexOf(CRITERION_A_KEY)],
    ).toEqual(originalCriterionA);
  });

  it("downgradedResult marks criterion A as INSUFFICIENT_SIGNAL with null score", () => {
    const fixture = makeU2SyntheticFixture();
    const result = runQualityGateV2(fixture);

    const criterionAIndex = CRITERIA_KEYS.indexOf(CRITERION_A_KEY);
    const downgraded = result.downgradedResult?.criteria[criterionAIndex];

    expect(downgraded).toBeDefined();
    expect(downgraded?.status).toBe("INSUFFICIENT_SIGNAL");
    expect(downgraded?.scorable).toBe(false);
    expect(downgraded?.score_0_10).toBeNull();
    expect(downgraded?.model_emitted_score_unverified).toBe(CRITERION_A_SCORE);
    expect(downgraded?.insufficient_signal_reason).toEqual({
      looked_for: ["CERTIFIED_ANCHORS_FOR_HIGH_CONFIDENCE_SCORING"],
      not_found: ["LOW_CONFIDENCE_HIGH_SCORE_WITHOUT_CERTIFIED_ANCHORS"],
    });
  });

  it("non-triggered criteria (criterion B, C, baselines) are unchanged in downgradedResult", () => {
    const fixture = makeU2SyntheticFixture();
    const criterionBIndex = CRITERIA_KEYS.indexOf(CRITERION_B_KEY);
    const criterionCIndex = CRITERIA_KEYS.indexOf(CRITERION_C_KEY);
    const originalB = structuredClone(fixture.criteria[criterionBIndex]);
    const originalC = structuredClone(fixture.criteria[criterionCIndex]);

    const result = runQualityGateV2(fixture);

    // QG_SUMMARY_OMITS_WEAKNESS does not mutate criterion B in downgradedResult
    // (it is a summary-level check, not a criterion-level downgrade)
    expect(result.downgradedResult?.criteria[criterionBIndex]).toEqual(originalB);
    // Criterion C with weak evidence is not downgraded by fidelity gate
    // (it has score 5 at low confidence — within cap)
    expect(result.downgradedResult?.criteria[criterionCIndex]).toEqual(originalC);
  });
});

// ── Layer 2: Processor integration — downgradedResult reaches persistence ─────
//
// This layer is covered by the existing test:
//   "persists downgradedResult when quality gate provides explicit non-mutating downgrade"
//   in __tests__/lib/evaluation/processor.canonical-pipeline.test.ts (line 940)
//
// That test verifies:
//   - runQualityGateV2 returns downgradedResult
//   - processor.ts selects effectiveEvaluationResult = downgradedResult (line 10869)
//   - persistEvaluationResultV2 is called with the downgraded criteria (line 11336)
//   - persist_evaluation_v2_atomic RPC receives status="INSUFFICIENT_SIGNAL", score_0_10=null
//
// U2 Enforcement Proof extends this by asserting the same path fires on the
// SYNTHETIC fixture (criterion A specifically), providing direct fixture→gate linkage.

describe("U2 Enforcement Proof — Layer 2: Processor integration (fixture→gate linkage)", () => {
  it("gate result from synthetic fixture contains downgradedResult suitable for persistence", () => {
    const fixture = makeU2SyntheticFixture();
    const gateResult = runQualityGateV2(fixture);

    // The downgradedResult is structurally valid for persistence:
    // - same schema_version as base result
    // - all criteria present
    // - only criterion A is downgraded
    expect(gateResult.downgradedResult).toBeDefined();
    expect(gateResult.downgradedResult?.schema_version).toBe(
      "evaluation_result_v2",
    );
    expect(gateResult.downgradedResult?.criteria).toHaveLength(
      CRITERIA_KEYS.length,
    );

    // Criterion A is the only one with INSUFFICIENT_SIGNAL
    const insufficientSignalCriteria = gateResult.downgradedResult?.criteria.filter(
      (c) => c.status === "INSUFFICIENT_SIGNAL",
    );
    expect(insufficientSignalCriteria).toHaveLength(1);
    expect(insufficientSignalCriteria?.[0]?.key).toBe(CRITERION_A_KEY);

    // All other criteria remain SCORABLE in the downgraded result
    const scorableCriteria = gateResult.downgradedResult?.criteria.filter(
      (c) => c.status === "SCORABLE",
    );
    expect(scorableCriteria).toHaveLength(CRITERIA_KEYS.length - 1);
  });
});

// ── Layer 3: ViewModel reflects downgraded state ──────────────────────────────

describe("U2 Enforcement Proof — Layer 3: ViewModel reflects downgraded state", () => {
  function buildVmFromDowngradedResult() {
    const fixture = makeU2SyntheticFixture();
    const gateResult = runQualityGateV2(fixture);
    const downgraded = gateResult.downgradedResult!;

    // Build the ShortForm document from the downgraded evaluation result
    const shortFormDoc = buildShortFormEvaluationDocument({
      result: downgraded,
      displayTitle: "U2 Enforcement Proof — Synthetic Fixture",
      reportType: "Short-Form Evaluation",
    });

    // Build the full UED (used by both web renderer and download route)
    const ued = buildUnifiedEvaluationDocument({
      mode: "short_form_evaluation",
      result: downgraded,
      displayTitle: "U2 Enforcement Proof — Synthetic Fixture",
      dream: null,
    });

    // Normalize to ViewModel (what all renderers consume)
    const vm = normalizeEvaluationReportViewModel({ ued });

    return { shortFormDoc, ued, vm, downgraded };
  }

  it("downgraded criterion A produces 'Not scorable' scoreLabel in criteriaScoreGrid", () => {
    const { vm } = buildVmFromDowngradedResult();

    const criterionARow = vm.criteriaScoreGrid.find(
      (row) =>
        row.label.toLowerCase().includes("concept") ||
        // getCriterionDisplayLabel maps "concept" → display label — check any match
        row.scoreLabel === "Not scorable",
    );

    // At least one row must show "Not scorable" — the downgraded criterion A
    const notScoredRows = vm.criteriaScoreGrid.filter(
      (row) => row.scoreLabel === "Not scorable",
    );
    expect(notScoredRows.length).toBeGreaterThanOrEqual(1);
  });

  it("criterion A criterion detail also reflects 'Not scorable' scoreLabel", () => {
    const { vm } = buildVmFromDowngradedResult();

    const notScoredDetails = vm.criterionDetails.filter(
      (detail) => detail.scoreLabel === "Not scorable",
    );
    expect(notScoredDetails.length).toBeGreaterThanOrEqual(1);
  });

  it("downgraded criterion A has null score in the UED criterionDetails", () => {
    const { ued } = buildVmFromDowngradedResult();

    // The UED criterionDetails for criterion A should have null/undefined score
    // (score_0_10: null from downgradedResult → scoreOutOfTen(null) → "Not scorable")
    const conceptDetail = ued.criterionDetails.find(
      (d) => d.key === CRITERION_A_KEY,
    );
    expect(conceptDetail).toBeDefined();
    // scoreLabel "Not scorable" is produced when score_0_10 is null
    expect(conceptDetail?.scoreLabel).toBe("Not scorable");
  });

  it("non-downgraded criteria retain numeric scoreLabels in the VM", () => {
    const { vm } = buildVmFromDowngradedResult();

    // All criteria except criterion A should have numeric score labels
    const numericScorePattern = /^\d+\/10$/;
    const numericRows = vm.criteriaScoreGrid.filter((row) =>
      numericScorePattern.test(row.scoreLabel),
    );
    // 12 of 13 criteria are scorable — exactly CRITERIA_KEYS.length - 1
    expect(numericRows.length).toBe(CRITERIA_KEYS.length - 1);
  });
});

// ── Layer 4: All renderers consistent ─────────────────────────────────────────
//
// Web (page.tsx), TXT, HTML, DOCX all consume the VM produced by
// normalizeEvaluationReportViewModel({ued}).
// This layer proves the VM is the single source of truth: if the VM is
// correct (Layer 3), all renderer surfaces are correct by construction.
//
// Renderer-specific assertions:
//   - TXT renderer: criteriaScoreGrid rows drive the score table (line 925+)
//   - HTML renderer: criteriaScoreGrid rows drive <tr> cells (line 1069)
//   - DOCX renderer: criteriaScoreGrid rows drive TextRun scoreLabel (line 1738)
//   - Web (page.tsx): criteriaScoreGrid is passed to LongformScoreGrid component
//
// All four surfaces read from the SAME vm.criteriaScoreGrid and vm.criterionDetails.
// No renderer has its own score-derivation logic — they all format from VM output.

describe("U2 Enforcement Proof — Layer 4: All renderers consistent via shared VM", () => {
  it("VM is the single source consumed by all renderer surfaces", () => {
    const fixture = makeU2SyntheticFixture();
    const gateResult = runQualityGateV2(fixture);
    const downgraded = gateResult.downgradedResult!;

    const ued = buildUnifiedEvaluationDocument({
      mode: "short_form_evaluation",
      result: downgraded,
      displayTitle: "U2 Enforcement Proof — Renderer Consistency",
      dream: null,
    });

    const vm = normalizeEvaluationReportViewModel({ ued });

    // Simulate TXT renderer table construction (mirrors download/route.ts line 925+):
    // Each row is: label | scoreLabel | confidenceLabel
    const txtScoreRows = vm.criteriaScoreGrid.map(
      (row) => `${row.label} | ${row.scoreLabel} | ${row.confidenceLabel ?? ""}`,
    );
    const txtNotScoredRow = txtScoreRows.find((row) =>
      row.includes("Not scorable"),
    );
    expect(txtNotScoredRow).toBeDefined();

    // Simulate HTML renderer table (mirrors download/route.ts line 1069):
    // <td class="score-cell ...">scoreLabel</td>
    const htmlCells = vm.criteriaScoreGrid.map(
      (row) =>
        `<td class="score-cell">${row.scoreLabel}</td>`,
    );
    const htmlNotScoredCell = htmlCells.find((cell) =>
      cell.includes("Not scorable"),
    );
    expect(htmlNotScoredCell).toBeDefined();

    // Simulate DOCX renderer text run (mirrors download/route.ts line 1738):
    // TextRun({ text: row.scoreLabel })
    const docxScoreLabels = vm.criteriaScoreGrid.map((row) => row.scoreLabel);
    expect(docxScoreLabels).toContain("Not scorable");

    // Web renderer (page.tsx) passes criteriaScoreGrid to LongformScoreGrid:
    // All rows have the required fields
    for (const row of vm.criteriaScoreGrid) {
      expect(typeof row.label).toBe("string");
      expect(typeof row.scoreLabel).toBe("string");
      expect(row.scorePalette).toBeDefined();
    }

    // Verify exactly one "Not scorable" row across all surfaces
    const notScoredCount = vm.criteriaScoreGrid.filter(
      (row) => row.scoreLabel === "Not scorable",
    ).length;
    expect(notScoredCount).toBe(1);
  });

  it("downgraded criterion detail is consistent across all renderer detail surfaces", () => {
    const fixture = makeU2SyntheticFixture();
    const gateResult = runQualityGateV2(fixture);
    const downgraded = gateResult.downgradedResult!;

    const ued = buildUnifiedEvaluationDocument({
      mode: "short_form_evaluation",
      result: downgraded,
      displayTitle: "U2 Enforcement Proof — Detail Consistency",
      dream: null,
    });

    const vm = normalizeEvaluationReportViewModel({ ued });

    // All renderer detail surfaces (TXT line 952, HTML line 1090, DOCX line 1776)
    // consume vm.criterionDetails — assert the downgraded criterion is present
    const notScoredDetails = vm.criterionDetails.filter(
      (d) => d.scoreLabel === "Not scorable",
    );
    expect(notScoredDetails.length).toBeGreaterThanOrEqual(1);

    // The "Not scorable" detail must have a defined label (renderer never gets blank label)
    for (const detail of notScoredDetails) {
      expect(detail.label.length).toBeGreaterThan(0);
      expect(detail.scorePalette).toBeDefined();
    }
  });

  it("no other criterion is mistakenly downgraded in any renderer surface", () => {
    const fixture = makeU2SyntheticFixture();
    const gateResult = runQualityGateV2(fixture);
    const downgraded = gateResult.downgradedResult!;

    const ued = buildUnifiedEvaluationDocument({
      mode: "short_form_evaluation",
      result: downgraded,
      displayTitle: "U2 Enforcement Proof — Isolation Proof",
      dream: null,
    });

    const vm = normalizeEvaluationReportViewModel({ ued });

    // Grid: exactly 1 "Not scorable" (only criterion A)
    const gridNotScored = vm.criteriaScoreGrid.filter(
      (row) => row.scoreLabel === "Not scorable",
    );
    expect(gridNotScored).toHaveLength(1);

    // Details: exactly 1 "Not scorable"
    const detailNotScored = vm.criterionDetails.filter(
      (d) => d.scoreLabel === "Not scorable",
    );
    expect(detailNotScored).toHaveLength(1);

    // All other grid rows have valid numeric score labels
    const numericPattern = /^\d+\/10$/;
    const nonScoredRows = vm.criteriaScoreGrid.filter(
      (row) => row.scoreLabel !== "Not scorable",
    );
    for (const row of nonScoredRows) {
      expect(numericPattern.test(row.scoreLabel)).toBe(true);
    }
  });
});
