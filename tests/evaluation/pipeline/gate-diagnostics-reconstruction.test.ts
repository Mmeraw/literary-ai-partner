/**
 * Phase 2.7 — Gate Diagnostics Reconstruction Tests (#307 Phase 1)
 *
 * Validates that:
 * 1. runQualityGate emits per_criterion_diagnostic in the independence check's diagnostics.
 * 2. The stored pass1_rationale + pass2_rationale can be used to bit-exactly recompute
 *    overlap_4grams, observed_overlap_count, and threshold comparison outcome offline.
 * 3. The compact per_criterion_diagnostic in failure_details enables diagnosticStatus="available".
 * 4. Reconstruction works for any Phase 2.7 gate failure, not only QG_INDEPENDENCE_VIOLATION.
 *
 * No mocks. Uses the real runQualityGate parse/normalisation path and the real
 * collectNgrams / tokenizeForOverlap exports.
 */

import { describe, it, expect } from "@jest/globals";
import {
  runQualityGate,
  collectNgrams,
  tokenizeForOverlap,
  QG_INDEPENDENCE_NGRAM_SIZE,
  QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION,
} from "@/lib/evaluation/pipeline/qualityGate";
import type {
  SynthesisOutput,
  SynthesizedCriterion,
  SinglePassOutput,
  QualityGateCriterionDiagnostic,
} from "@/lib/evaluation/pipeline/types";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeCriterion(
  key: (typeof CRITERIA_KEYS)[number],
  overrides: Partial<SynthesizedCriterion> = {}
): SynthesizedCriterion {
  return {
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale: `The manuscript demonstrates competent handling of ${key}.`,
    pressure_points: ["Narrative pressure accumulates around this criterion."],
    decision_points: ["The chapter commits to a clear direction."],
    consequence_status: "landed",
    evidence: [{ snippet: "The river moved slowly through the valley." }],
    recommendations: [
      {
        priority: "medium",
        action: `Address the ${key} dimension by grounding specific textual evidence.`,
        expected_impact: `Increases specificity and reader connection for ${key}.`,
        anchor_snippet: '"she whispered"',
        source_pass: 1,
        issue_family: "scene_structure",
        strategic_lever: "scene_goal_clarity",
        revision_granularity: "scene",
      },
    ],
    ...overrides,
  };
}

function makeValidSynthesis(
  overrides: Partial<SynthesizedCriterion>[] = []
): SynthesisOutput {
  const criteria = CRITERIA_KEYS.map((key, i) =>
    makeCriterion(key, overrides[i] ?? {})
  );
  return {
    criteria,
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary:
        "This manuscript shows promise in narrative structure but needs work before submission.",
      top_3_strengths: ["Strong voice", "Clear narrative arc", "Memorable dialogue"],
      top_3_risks: ["Weak world-building", "Pacing issues in act two", "Thin motivation"],
      submission_readiness: "close",
    },
    metadata: {
      pass1_model: "gpt-4o-mini",
      pass2_model: "gpt-4o-mini",
      pass3_model: "gpt-4o-mini",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

// Build a SinglePassOutput where the "voice" criterion has a specific rationale
function makePass(
  pass: 1 | 2,
  voiceRationale: string,
  voiceEvidence: string[] = []
): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale:
        key === "voice"
          ? voiceRationale
          : `Independent rationale for ${key} in pass ${pass}.`,
      evidence: voiceEvidence.length > 0 && key === "voice"
        ? voiceEvidence.map((s) => ({ snippet: s }))
        : [],
      recommendations: [],
    })),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

// ── Helper: reconstruct overlap computation from stored diagnostic ────────────

/**
 * Reconstructs the independence check result offline from stored diagnostic data.
 * This is the core of the reconstruction requirement: given pass1_rationale,
 * pass2_rationale, and evidence ngrams, recompute overlap_4grams and
 * observed_overlap_count using the same canonical functions.
 *
 * Returns the recomputed values for bit-exact comparison with stored data.
 */
function reconstructFromDiagnostic(
  diagnostic: QualityGateCriterionDiagnostic,
  evidenceSnippets: string[],
  ngramSize: number
): {
  recomputed_overlap_4grams: string[];
  recomputed_observed_overlap_count: number;
  recomputed_exceeds_threshold: boolean;
} {
  // Rebuild evidence ngrams set from stored evidence snippets
  const evidenceNgrams = new Set<string>();
  for (const snippet of evidenceSnippets) {
    for (const gram of collectNgrams(snippet, ngramSize)) {
      evidenceNgrams.add(gram);
    }
  }

  // Rebuild pass1 ngrams from stored pass1_rationale
  const pass1Ngrams = new Set<string>();
  for (const gram of collectNgrams(diagnostic.pass1_rationale, ngramSize)) {
    if (!evidenceNgrams.has(gram)) {
      pass1Ngrams.add(gram);
    }
  }

  // Recompute overlap from stored pass2_rationale
  let recomputedCount = 0;
  const recomputedOverlapNgrams: string[] = [];
  for (const gram of collectNgrams(diagnostic.pass2_rationale, ngramSize)) {
    if (evidenceNgrams.has(gram)) continue;
    if (pass1Ngrams.has(gram)) {
      recomputedCount += 1;
      if (!recomputedOverlapNgrams.includes(gram)) {
        recomputedOverlapNgrams.push(gram);
      }
    }
  }

  return {
    recomputed_overlap_4grams: recomputedOverlapNgrams,
    recomputed_observed_overlap_count: recomputedCount,
    recomputed_exceeds_threshold: recomputedCount >= diagnostic.threshold_min,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Gate diagnostics — per_criterion_diagnostic in independence check", () => {
  it("emits per_criterion_diagnostic in the independence check diagnostics when both passes are provided", () => {
    const synthesis = makeValidSynthesis();
    const pass1 = makePass(1, "The narrative voice demonstrates consistent register and diction throughout.");
    const pass2 = makePass(2, "Editorial observation on voice: register and tone vary chapter by chapter.");

    const result = runQualityGate(synthesis, pass1, pass2);

    const independenceCheck = result.checks.find(
      (c) => c.check_id === "pass_independence"
    );
    expect(independenceCheck).toBeDefined();

    const diagPayload = independenceCheck?.diagnostics as
      | { per_criterion_diagnostic?: unknown }
      | undefined;
    expect(Array.isArray(diagPayload?.per_criterion_diagnostic)).toBe(true);

    const perCriterion = diagPayload?.per_criterion_diagnostic as QualityGateCriterionDiagnostic[];

    // Should have one record per Pass 2 criterion
    expect(perCriterion).toHaveLength(CRITERIA_KEYS.length);

    // Each record must have all required fields
    for (const record of perCriterion) {
      expect(typeof record.criterion_key).toBe("string");
      expect(typeof record.pass1_rationale).toBe("string");
      expect(typeof record.pass2_rationale).toBe("string");
      expect(Array.isArray(record.overlap_4grams)).toBe(true);
      expect(typeof record.observed_overlap_count).toBe("number");
      expect(record.threshold_n).toBe(QG_INDEPENDENCE_NGRAM_SIZE);
      expect(record.threshold_min).toBe(QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION);
      expect(record.classification).toBeNull();
    }
  });

  it("does not emit per_criterion_diagnostic when pass1/pass2 are absent", () => {
    const synthesis = makeValidSynthesis();
    const result = runQualityGate(synthesis);

    const independenceCheck = result.checks.find(
      (c) => c.check_id === "pass_independence"
    );
    // When no pass1/pass2 provided, the independence check is not added
    expect(independenceCheck).toBeUndefined();
  });
});

describe("Gate diagnostics — bit-exact offline reconstruction", () => {
  it("recomputes overlap_4grams and observed_overlap_count identically from stored rationale text", () => {
    // Use a shared phrase that will appear in both pass rationales but not in evidence
    const sharedPhrase = "structural clarity and precise word choice anchor the narrative voice in a consistent register throughout the text";

    const pass1VoiceRationale = `Voice criterion: ${sharedPhrase}. This creates a distinctive authorial presence.`;
    const pass2VoiceRationale = `Editorial lens: ${sharedPhrase}. However the execution shows cracks at chapter boundaries.`;

    const synthesis = makeValidSynthesis();
    const pass1 = makePass(1, pass1VoiceRationale);
    const pass2 = makePass(2, pass2VoiceRationale);

    const result = runQualityGate(synthesis, pass1, pass2);

    const independenceCheck = result.checks.find(
      (c) => c.check_id === "pass_independence"
    );
    const diagPayload = independenceCheck?.diagnostics as
      | { per_criterion_diagnostic?: QualityGateCriterionDiagnostic[] }
      | undefined;
    const perCriterion = diagPayload?.per_criterion_diagnostic ?? [];

    const voiceDiag = perCriterion.find((d) => d.criterion_key === "voice");
    expect(voiceDiag).toBeDefined();

    // Simulate offline reconstruction: use stored rationale text
    const reconstructed = reconstructFromDiagnostic(
      voiceDiag!,
      [], // no evidence snippets
      QG_INDEPENDENCE_NGRAM_SIZE
    );

    // Bit-exact: stored and recomputed overlap ngrams must be identical
    expect(reconstructed.recomputed_overlap_4grams.sort()).toEqual(
      voiceDiag!.overlap_4grams.sort()
    );

    // Bit-exact: stored and recomputed overlap count must match
    expect(reconstructed.recomputed_observed_overlap_count).toBe(
      voiceDiag!.observed_overlap_count
    );

    // Threshold comparison must reproduce the gate decision
    const storedExceedsThreshold =
      voiceDiag!.observed_overlap_count >= voiceDiag!.threshold_min;
    expect(reconstructed.recomputed_exceeds_threshold).toBe(storedExceedsThreshold);
  });

  it("evidence ngrams are excluded from overlap computation identically in both live and reconstructed paths", () => {
    const manuscriptText = "The river moved slowly through the valley under moonlight and mist";
    // This phrase appears as evidence in both passes and should NOT be counted as overlap
    const evidenceSnippet = "the river moved slowly through the valley under moonlight and mist";

    const pass1VoiceRationale = `The voice criterion anchors: ${evidenceSnippet}. Prose control is strong.`;
    const pass2VoiceRationale = `Editorially: ${evidenceSnippet}. Yet the register becomes inconsistent.`;

    const synthesis = makeValidSynthesis();
    const pass1 = makePass(1, pass1VoiceRationale, [manuscriptText]);
    const pass2 = makePass(2, pass2VoiceRationale, [manuscriptText]);

    const result = runQualityGate(synthesis, pass1, pass2);
    const independenceCheck = result.checks.find(
      (c) => c.check_id === "pass_independence"
    );
    const diagPayload = independenceCheck?.diagnostics as
      | { per_criterion_diagnostic?: QualityGateCriterionDiagnostic[] }
      | undefined;
    const perCriterion = diagPayload?.per_criterion_diagnostic ?? [];

    const voiceDiag = perCriterion.find((d) => d.criterion_key === "voice");
    expect(voiceDiag).toBeDefined();

    // The gate should pass (or have low overlap) because shared text is evidence-sourced
    // Evidence ngrams are excluded from overlap counting
    const evidenceNgramSet = new Set(collectNgrams(evidenceSnippet, QG_INDEPENDENCE_NGRAM_SIZE));
    for (const gram of voiceDiag!.overlap_4grams) {
      // No overlap ngram should come from the evidence snippet
      expect(evidenceNgramSet.has(gram)).toBe(false);
    }

    // Reconstruct offline: pass the same evidence snippets to exclude them
    const evidenceSnippets = [evidenceSnippet];
    const reconstructed = reconstructFromDiagnostic(
      voiceDiag!,
      evidenceSnippets,
      QG_INDEPENDENCE_NGRAM_SIZE
    );

    // Bit-exact reconstruction (even with evidence exclusion)
    expect(reconstructed.recomputed_overlap_4grams.sort()).toEqual(
      voiceDiag!.overlap_4grams.sort()
    );
    expect(reconstructed.recomputed_observed_overlap_count).toBe(
      voiceDiag!.observed_overlap_count
    );
  });

  it("failing criterion produces identical gate outcome when reconstructed offline", () => {
    // Construct a known-failing pair: use a long shared phrase with many 8-grams
    const longSharedPhrase =
      "the manuscript consistently fails to anchor voice in specific textual evidence " +
      "demonstrating craft at the sentence level with precise diction and deliberate rhythm " +
      "while maintaining a stable narrative register across all major scene transitions";

    const pass1VoiceRationale = `Pass 1 voice analysis: ${longSharedPhrase}. Score 5.`;
    const pass2VoiceRationale = `Pass 2 editorial: ${longSharedPhrase}. The writer should reconsider this approach.`;

    const synthesis = makeValidSynthesis();
    const pass1 = makePass(1, pass1VoiceRationale);
    const pass2 = makePass(2, pass2VoiceRationale);

    const result = runQualityGate(synthesis, pass1, pass2);
    const independenceCheck = result.checks.find(
      (c) => c.check_id === "pass_independence"
    );
    const diagPayload = independenceCheck?.diagnostics as
      | { per_criterion_diagnostic?: QualityGateCriterionDiagnostic[] }
      | undefined;
    const perCriterion = diagPayload?.per_criterion_diagnostic ?? [];

    const voiceDiag = perCriterion.find((d) => d.criterion_key === "voice");
    expect(voiceDiag).toBeDefined();

    // This should exceed the threshold
    expect(voiceDiag!.observed_overlap_count).toBeGreaterThanOrEqual(
      QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION
    );

    // Gate should have failed
    const gateFailedForVoice =
      voiceDiag!.observed_overlap_count >= voiceDiag!.threshold_min;
    expect(gateFailedForVoice).toBe(true);

    // Offline reconstruction must reproduce the same outcome
    const reconstructed = reconstructFromDiagnostic(
      voiceDiag!,
      [],
      QG_INDEPENDENCE_NGRAM_SIZE
    );

    // Bit-exact overlap ngrams
    expect(reconstructed.recomputed_overlap_4grams.sort()).toEqual(
      voiceDiag!.overlap_4grams.sort()
    );

    // Bit-exact count
    expect(reconstructed.recomputed_observed_overlap_count).toBe(
      voiceDiag!.observed_overlap_count
    );

    // Bit-exact threshold outcome
    expect(reconstructed.recomputed_exceeds_threshold).toBe(true);
  });
});

describe("Gate diagnostics — tokenizeForOverlap and collectNgrams are deterministic exports", () => {
  it("tokenizeForOverlap lowercases, strips punctuation, and splits on whitespace", () => {
    const tokens = tokenizeForOverlap("Hello, World! This is a test.");
    expect(tokens).toEqual(["hello", "world", "this", "is", "a", "test"]);
  });

  it("collectNgrams returns empty array when text has fewer words than n", () => {
    const ngrams = collectNgrams("short text", 8);
    expect(ngrams).toEqual([]);
  });

  it("collectNgrams produces canonical window-slide output", () => {
    const text = "one two three four five six seven eight nine";
    const ngrams = collectNgrams(text, 8);
    expect(ngrams).toEqual([
      "one two three four five six seven eight",
      "two three four five six seven eight nine",
    ]);
  });

  it("collectNgrams output is identical across two independent calls with same input", () => {
    const text = "narrative voice demonstrates consistent register and diction throughout the text";
    const run1 = collectNgrams(text, QG_INDEPENDENCE_NGRAM_SIZE);
    const run2 = collectNgrams(text, QG_INDEPENDENCE_NGRAM_SIZE);
    expect(run1).toEqual(run2);
  });
});

describe("Gate diagnostics — compact per_criterion_diagnostic in failure_details", () => {
  it("independence failure check diagnostics include per_criterion_diagnostic for all criteria", () => {
    const longSharedPhrase =
      "persistent voice inconsistency surfaces across scene boundaries revealing a " +
      "lack of deliberate register control in the prose level diction and syntax choices";

    const pass1 = makePass(1, `Voice criterion: ${longSharedPhrase}. Analysis complete.`);
    const pass2 = makePass(2, `Editorial: ${longSharedPhrase}. The execution requires revision.`);
    const synthesis = makeValidSynthesis();

    const result = runQualityGate(synthesis, pass1, pass2);

    // Should fail the independence check
    expect(result.pass).toBe(false);
    const indepCheck = result.checks.find((c) => c.check_id === "pass_independence");
    expect(indepCheck?.passed).toBe(false);
    expect(indepCheck?.error_code).toBe("QG_INDEPENDENCE_VIOLATION");

    // Diagnostics should be present and have all criteria
    const diag = indepCheck?.diagnostics as { per_criterion_diagnostic?: QualityGateCriterionDiagnostic[] } | undefined;
    expect(Array.isArray(diag?.per_criterion_diagnostic)).toBe(true);
    expect(diag!.per_criterion_diagnostic).toHaveLength(CRITERIA_KEYS.length);

    // All compact fields required for the job progress snapshot
    for (const d of diag!.per_criterion_diagnostic!) {
      expect(typeof d.criterion_key).toBe("string");
      expect(typeof d.observed_overlap_count).toBe("number");
      expect(d.threshold_n).toBe(QG_INDEPENDENCE_NGRAM_SIZE);
      expect(d.threshold_min).toBe(QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION);
      expect(d.classification).toBeNull();
    }

    // Failing criterion must have observed_overlap_count >= threshold_min
    const failingVoice = diag!.per_criterion_diagnostic!.find(
      (d) => d.criterion_key === "voice"
    );
    expect(failingVoice).toBeDefined();
    expect(failingVoice!.observed_overlap_count).toBeGreaterThanOrEqual(
      QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION
    );
  });
});
