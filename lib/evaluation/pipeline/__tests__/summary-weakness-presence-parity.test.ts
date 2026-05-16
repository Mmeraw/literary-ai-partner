/**
 * PR-K parity test (2026-05-16):
 *
 * Locks producer/checker parity for QualityGateV2 v2_summary_weakness_presence.
 *
 * Pass 3 enforcer (`enforceSummaryWeaknessPresence`) and QualityGate V2
 * (`summaryMentionsBottomWeakness` / `missingBottomWeaknessCriteria`) must
 * always agree on whether a one-paragraph summary mentions ALL bottom-score
 * weakness criteria. Previously Pass 3 used `.some()` semantics + a slice(0,3)
 * cap and could leave the gate unsatisfied. Job a8d47d73 ("Froggin Noggin"
 * FULL NOVEL) tripped this with 5 bottom criteria (pacing, proseControl, tone,
 * narrativeClosure, marketability).
 *
 * Both layers now route through `normalizeSummaryWithBottomWeaknesses` in
 * `propagationIntegrity.ts`. This test pins that contract.
 */

import { describe, it, expect } from "@jest/globals";
import {
  summarizePropagationIntegrity,
  normalizeSummaryWithBottomWeaknesses,
  missingBottomWeaknessCriteria,
  summaryMentionsBottomWeakness,
} from "@/lib/evaluation/pipeline/propagationIntegrity";
import type { CriterionKey } from "@/schemas/criteria-keys";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";

type CriterionScore = { key: CriterionKey; score: number };

function buildV2Criteria(scores: CriterionScore[]): EvaluationResultV2["criteria"] {
  return scores.map(
    ({ key, score }) =>
      ({
        key,
        status: "SCORABLE" as const,
        score_0_10: score,
        scorability_status: "scorable_high_confidence" as const,
        evidence: [],
      }) as unknown as EvaluationResultV2["criteria"][number],
  );
}

/**
 * Reproduces the Pass 3 enforcer logic against a raw summary + criterion-score
 * list. Mirrors `enforceSummaryWeaknessPresence` in runPass3Synthesis.ts after
 * PR-K: trim → derive bottom criteria via summarizePropagationIntegrity →
 * route through the canonical normalizer.
 *
 * Kept intentionally close to the production code path so a regression in
 * either layer surfaces here.
 */
function runPass3EnforcerEquivalent(summary: string, scores: CriterionScore[]): string {
  const trimmed = summary.trim();
  if (trimmed.length === 0) return trimmed;
  const v2 = buildV2Criteria(scores);
  if (v2.length === 0) return trimmed;
  const { bottomScoreCriteria } = summarizePropagationIntegrity(v2);
  if (bottomScoreCriteria.length === 0) return trimmed;
  return normalizeSummaryWithBottomWeaknesses(trimmed, bottomScoreCriteria, 500);
}

function gateAccepts(summary: string, scores: CriterionScore[]): boolean {
  const v2 = buildV2Criteria(scores);
  const { bottomScoreCriteria } = summarizePropagationIntegrity(v2);
  return summaryMentionsBottomWeakness(summary, bottomScoreCriteria);
}

describe("PR-K: Pass 3 enforcer / QualityGateV2 summary-weakness parity", () => {
  it("case 1: 0 bottom criteria — both layers pass, enforcer is a no-op", () => {
    const scores: CriterionScore[] = [
      { key: "voice" as CriterionKey, score: 8 },
      { key: "character" as CriterionKey, score: 7 },
      { key: "pacing" as CriterionKey, score: 7 },
    ];
    const summary = "The manuscript demonstrates strong craft across all measured dimensions.";

    const enforced = runPass3EnforcerEquivalent(summary, scores);

    expect(enforced).toBe(summary.trim());
    expect(gateAccepts(enforced, scores)).toBe(true);
  });

  it("case 2: 1 bottom criterion already mentioned — both layers pass", () => {
    const scores: CriterionScore[] = [
      { key: "voice" as CriterionKey, score: 8 },
      { key: "pacing" as CriterionKey, score: 4 },
      { key: "tone" as CriterionKey, score: 7 },
    ];
    const summary = "Strong voice carries the chapter, though pacing drags through the middle scenes.";

    const enforced = runPass3EnforcerEquivalent(summary, scores);

    expect(enforced.toLowerCase()).toContain("pacing");
    expect(gateAccepts(enforced, scores)).toBe(true);
  });

  it("case 3 (Froggin Noggin regression): 5 bottom criteria, summary mentions 1 — gate fails on raw, both pass on enforced", () => {
    // Scores chosen so deriveBottomScoreCriteria threshold = min(5, minScore+1) = 4
    // pulls in exactly the 5 criteria that tripped job a8d47d73.
    const scores: CriterionScore[] = [
      { key: "pacing" as CriterionKey, score: 4 },
      { key: "proseControl" as CriterionKey, score: 4 },
      { key: "tone" as CriterionKey, score: 4 },
      { key: "narrativeClosure" as CriterionKey, score: 4 },
      { key: "marketability" as CriterionKey, score: 3 },
      { key: "voice" as CriterionKey, score: 7 },
      { key: "character" as CriterionKey, score: 7 },
    ];
    const rawSummary =
      "An ambitious literary novel with notable voice and characterization, though pacing falters across the back half.";

    // Pre-enforcement: gate would reject because tone, proseControl,
    // narrativeClosure, and marketability are unnamed.
    expect(gateAccepts(rawSummary, scores)).toBe(false);
    expect(missingBottomWeaknessCriteria(rawSummary, [
      "pacing" as CriterionKey,
      "proseControl" as CriterionKey,
      "tone" as CriterionKey,
      "narrativeClosure" as CriterionKey,
      "marketability" as CriterionKey,
    ]).length).toBeGreaterThan(0);

    const enforced = runPass3EnforcerEquivalent(rawSummary, scores);

    // After enforcement: every bottom-score criterion is named (parity!).
    expect(gateAccepts(enforced, scores)).toBe(true);
    const lower = enforced.toLowerCase();
    expect(lower).toContain("pacing");
    expect(lower).toContain("prose control");
    expect(lower).toContain("tone");
    expect(lower).toContain("narrative closure");
    expect(lower).toContain("marketability");
    expect(enforced.length).toBeLessThanOrEqual(500);
  });

  it("case 4: 5 bottom criteria, summary already names all of them — enforcer no-op, gate passes", () => {
    const scores: CriterionScore[] = [
      { key: "pacing" as CriterionKey, score: 4 },
      { key: "proseControl" as CriterionKey, score: 4 },
      { key: "tone" as CriterionKey, score: 4 },
      { key: "narrativeClosure" as CriterionKey, score: 4 },
      { key: "marketability" as CriterionKey, score: 3 },
    ];
    const summary =
      "Pacing, prose control, tone, narrative closure, and marketability all need work in the next revision.";

    expect(gateAccepts(summary, scores)).toBe(true);

    const enforced = runPass3EnforcerEquivalent(summary, scores);
    expect(enforced).toBe(summary.trim());
    expect(gateAccepts(enforced, scores)).toBe(true);
  });

  it("parity invariant: after enforcement, the gate ALWAYS accepts (across all 4 fixtures)", () => {
    const fixtures: Array<{ summary: string; scores: CriterionScore[] }> = [
      {
        summary: "The manuscript demonstrates strong craft across all measured dimensions.",
        scores: [{ key: "voice" as CriterionKey, score: 8 }],
      },
      {
        summary: "Strong voice carries the chapter, though pacing drags through the middle scenes.",
        scores: [
          { key: "voice" as CriterionKey, score: 8 },
          { key: "pacing" as CriterionKey, score: 4 },
        ],
      },
      {
        summary:
          "An ambitious literary novel with notable voice and characterization, though pacing falters.",
        scores: [
          { key: "pacing" as CriterionKey, score: 4 },
          { key: "proseControl" as CriterionKey, score: 4 },
          { key: "tone" as CriterionKey, score: 4 },
          { key: "narrativeClosure" as CriterionKey, score: 4 },
          { key: "marketability" as CriterionKey, score: 3 },
        ],
      },
      {
        summary:
          "Pacing, prose control, tone, narrative closure, and marketability all need work.",
        scores: [
          { key: "pacing" as CriterionKey, score: 4 },
          { key: "proseControl" as CriterionKey, score: 4 },
          { key: "tone" as CriterionKey, score: 4 },
          { key: "narrativeClosure" as CriterionKey, score: 4 },
          { key: "marketability" as CriterionKey, score: 3 },
        ],
      },
    ];

    for (const { summary, scores } of fixtures) {
      const enforced = runPass3EnforcerEquivalent(summary, scores);
      expect(gateAccepts(enforced, scores)).toBe(true);
    }
  });
});
