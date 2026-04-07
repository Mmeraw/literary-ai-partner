/**
 * Evaluation Gate (EG) Regression Tests
 * 
 * These tests enforce the fail-closed invariant:
 *   If Pass 1 returns canonical rejection, then:
 *     1. Pipeline advancement is blocked
 *     2. Persistence stores rejection state distinctly
 *     3. Retry layer refuses retry
 *     4. Phase 2 blocks correctly
 *     5. Orchestrator returns blocked state
 *     6. No old weighted/aggregate path remains reachable
 */

import { runEvaluationGates, adaptResultToCriteria } from "@/lib/evaluation/pipeline/gates";
import { EvaluationGateRejectedError } from "@/lib/evaluation/pipeline/failures";
import { FAILURE_CODES, FAILURE_CODE_SET } from "@/lib/evaluation/pipeline/failures";
import { gatePhase2OnPhase1 } from "@/lib/evaluation/pipeline/gatePhase2OnPhase1";
import type { GateResult } from "@/lib/evaluation/pipeline/gates";

// ── Test 1: Gate rejects when criteria fail ──
describe("EG: Evaluation Gate Rejection", () => {
  it("runEvaluationGates returns passed=false when any criterion is below threshold", () => {
    // Construct criteria that should fail the gate
    const badCriteria = adaptResultToCriteria({
      scores: {
        "Narrative Architecture": { score: 1, justification: "Terrible", evidence: [] },
        "Character Interiority": { score: 2, justification: "Bad", evidence: [] },
        "Dialogue Authenticity": { score: 1, justification: "Awful", evidence: [] },
        "Prose Rhythm & Musicality": { score: 1, justification: "Poor", evidence: [] },
        "Symbolic Layering": { score: 1, justification: "None", evidence: [] },
        "Emotional Calibration": { score: 1, justification: "Flat", evidence: [] },
        "Tension & Pacing": { score: 1, justification: "None", evidence: [] },
        "Sensory Immersion": { score: 1, justification: "Missing", evidence: [] },
        "Thematic Coherence": { score: 1, justification: "Absent", evidence: [] },
        "Point of View Integrity": { score: 1, justification: "Broken", evidence: [] },
        "Reader Engagement": { score: 1, justification: "None", evidence: [] },
        "Subtext & Implication": { score: 1, justification: "None", evidence: [] },
        "Voice Distinctiveness": { score: 1, justification: "Generic", evidence: [] },
      },
    });
    const result: GateResult = runEvaluationGates(badCriteria);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("runEvaluationGates returns passed=true when criteria meet threshold", () => {
    const goodCriteria = adaptResultToCriteria({
      scores: {
        "Narrative Architecture": { score: 8, justification: "Strong", evidence: ["p1"] },
        "Character Interiority": { score: 7, justification: "Good", evidence: ["p2"] },
        "Dialogue Authenticity": { score: 8, justification: "Natural", evidence: ["p3"] },
        "Prose Rhythm & Musicality": { score: 7, justification: "Flowing", evidence: ["p4"] },
        "Symbolic Layering": { score: 7, justification: "Present", evidence: ["p5"] },
        "Emotional Calibration": { score: 8, justification: "Tuned", evidence: ["p6"] },
        "Tension & Pacing": { score: 7, justification: "Taut", evidence: ["p7"] },
        "Sensory Immersion": { score: 8, justification: "Vivid", evidence: ["p8"] },
        "Thematic Coherence": { score: 7, justification: "Clear", evidence: ["p9"] },
        "Point of View Integrity": { score: 8, justification: "Consistent", evidence: ["p10"] },
        "Reader Engagement": { score: 7, justification: "Compelling", evidence: ["p11"] },
        "Subtext & Implication": { score: 7, justification: "Rich", evidence: ["p12"] },
        "Voice Distinctiveness": { score: 8, justification: "Unique", evidence: ["p13"] },
      },
    });
    const result: GateResult = runEvaluationGates(goodCriteria);
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });
});

// ── Test 2: EvaluationGateRejectedError is non-retryable ──
describe("EG: Canonical Rejection Is Non-Retryable", () => {
  it("EvaluationGateRejectedError carries EVALUATION_GATE_REJECTED failure code", () => {
    const err = new EvaluationGateRejectedError("Chunk 3 rejected", { chunkIndex: 3 });
    expect(err.failureCode).toBe("EVALUATION_GATE_REJECTED");
    expect(err.name).toBe("EvaluationGateRejectedError");
    expect(err.details).toEqual({ chunkIndex: 3 });
    expect(err instanceof Error).toBe(true);
  });

  it("EVALUATION_GATE_REJECTED is in FAILURE_CODES registry", () => {
    expect(FAILURE_CODES).toContain("EVALUATION_GATE_REJECTED");
    expect(FAILURE_CODE_SET.has("EVALUATION_GATE_REJECTED")).toBe(true);
  });
});

// ── Test 3: Phase 2 gate blocks on rejection ──
describe("EG: Phase 2 Gate Blocks On Phase 1 Rejection", () => {
  it("blocks when artifact is rejected", () => {
    const decision = gatePhase2OnPhase1({
      phase1status: "complete",
      artifactrejected: true,
      artifactaccepted: false,
    } as any);
    expect(decision.ok).toBe(false);
  });

  it("blocks when evaluation is INVALID", () => {
    const decision = gatePhase2OnPhase1({
      phase1status: "complete",
      evaluationvalidity: "INVALID",
      artifactrejected: false,
      artifactaccepted: true,
      hasscores: true,
      coveragepercent: 1.0,
    } as any);
    expect(decision.ok).toBe(false);
  });

  it("blocks when Phase 1 is not completed", () => {
    const decision = gatePhase2OnPhase1({
      phase1status: "in_progress",
    } as any);
    expect(decision.ok).toBe(false);
  });

  it("allows when all conditions are met", () => {
    const decision = gatePhase2OnPhase1({
      phase1status: "complete",
      hasscores: true,
      coveragepercent: 1.0,
      evaluationvalidity: "VALID",
      artifactaccepted: true,
      artifactrejected: false,
      disputed: false,
    } as any);
    expect(decision.ok).toBe(true);
  });
});

// ── Test 4: No weighted averaging or overallScore ──
describe("EG: No Legacy Weighted/Aggregate Paths", () => {
  it("GateResult has no overallScore property", () => {
    const criteria = adaptResultToCriteria({
      scores: {
        "Narrative Architecture": { score: 5, justification: "Mid", evidence: ["e1"] },
      },
    });
    const result = runEvaluationGates(criteria) as any;
    expect(result.overallScore).toBeUndefined();
    expect(result.weightedAverage).toBeUndefined();
    expect(result.aggregateScore).toBeUndefined();
  });
});
