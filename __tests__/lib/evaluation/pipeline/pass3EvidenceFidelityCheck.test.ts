/**
 * Tests for Pass 3 Evidence Fidelity Check (U2-004 G2)
 *
 * Validates the extended metric:
 *   1. Count regression: pass3 count < pass2 count
 *   2. Concept regression: pass2 semantic n-grams absent from pass3
 *   3. New unsupported concepts: pass3 content with no pass2 anchor
 *   4. Grounded count scaffold: null until G4 lands
 *   5. fidelity_intact reflects both count AND concept signals
 */

import {
  checkPass3EvidenceFidelity,
  type Pass3EvidenceFidelityResult,
  type EvidenceFidelityEntry,
} from "@/lib/evaluation/pipeline/pass3EvidenceFidelityCheck";
import type { SinglePassOutput, SynthesisOutput } from "@/lib/evaluation/pipeline/types";

// ── Minimal fixture helpers ──────────────────────────────────────────────────

function makeAnchor(snippet: string) {
  return { snippet };
}

function makePass2Criterion(key: string, snippets: string[]) {
  return {
    key,
    score_0_10: 6,
    rationale: "pass2 rationale",
    evidence: snippets.map(makeAnchor),
    recommendations: [],
  };
}

function makePass3Criterion(key: string, snippets: string[]) {
  return {
    key,
    craft_score: 6,
    editorial_score: 6,
    final_score_0_10: 6,
    score_delta: 0,
    final_rationale: "pass3 rationale",
    pressure_points: [],
    decision_points: [],
    consequence_status: "landed" as const,
    evidence: snippets.map(makeAnchor),
    recommendations: [],
  };
}

function makePass2(criteriaSnippets: Record<string, string[]>): SinglePassOutput {
  return {
    criteria: Object.entries(criteriaSnippets).map(([key, snippets]) =>
      makePass2Criterion(key, snippets),
    ),
    model: "gpt-4.1",
    prompt_version: "pass2-v1",
    overall: {
      overall_score_0_100: 60,
      verdict: "revise" as const,
      one_paragraph_summary: "summary",
      top_3_strengths: [],
      top_3_risks: [],
      submission_readiness: "nearly_ready" as const,
    },
  } as unknown as SinglePassOutput;
}

function makePass3(criteriaSnippets: Record<string, string[]>): SynthesisOutput {
  return {
    criteria: Object.entries(criteriaSnippets).map(([key, snippets]) =>
      makePass3Criterion(key, snippets),
    ),
    overall: {
      overall_score_0_100: 60,
      verdict: "revise" as const,
      one_paragraph_summary: "summary",
      top_3_strengths: [],
      top_3_risks: [],
      submission_readiness: "nearly_ready" as const,
    },
    metadata: {
      pass1_model: "gpt-4.1",
      pass2_model: "gpt-4.1",
      pass3_model: "gpt-4.1",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  } as unknown as SynthesisOutput;
}

function entryFor(result: Pass3EvidenceFidelityResult, key: string): EvidenceFidelityEntry {
  const entry = result.criteria.find((c) => c.criterion_key === key);
  if (!entry) throw new Error(`No entry for criterion: ${key}`);
  return entry;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("checkPass3EvidenceFidelity — count dimension", () => {
  it("is fidelity_intact when Pass 3 count >= Pass 2 count for all criteria", () => {
    const pass2 = makePass2({ pacing: ["slow pacing near the midpoint scene", "tension drops during chapter three bridge"], characterization: ["the protagonist avoids direct confrontation"] });
    const pass3 = makePass3({ pacing: ["slow pacing near the midpoint scene", "tension drops during chapter three bridge", "additional synthesis anchor"], characterization: ["the protagonist avoids direct confrontation"] });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    expect(result.count_regression_criteria).toHaveLength(0);
    expect(result.total_count_delta).toBe(0);
  });

  it("fires count_regression when Pass 3 drops below Pass 2 count", () => {
    const pass2 = makePass2({
      pacing: ["slow pacing near the midpoint", "tension drops in chapter three", "bridge scene drags"],
    });
    const pass3 = makePass3({
      pacing: ["slow pacing near the midpoint"],
    });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    expect(result.count_regression_criteria).toContain("pacing");
    expect(result.total_count_delta).toBe(2);
    expect(entryFor(result, "pacing").count_delta).toBe(2);
  });

  it("does NOT flag as count regression when Pass 3 produces more anchors than Pass 2", () => {
    // 2 Pass 2 → 4 Pass 3 (even if count increases, not a count regression)
    const pass2 = makePass2({ theme: ["thematic motif appears in chapter one opening"] });
    const pass3 = makePass3({
      theme: [
        "thematic motif appears in chapter one opening",
        "motif echoes in the midpoint scene resolution",
        "callback completes the thematic arc",
        "final image mirrors the opening premise",
      ],
    });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    expect(result.count_regression_criteria).not.toContain("theme");
    expect(entryFor(result, "theme").count_delta).toBeLessThanOrEqual(0);
  });
});

describe("checkPass3EvidenceFidelity — concept dimension", () => {
  it("detects missing Pass 2 concepts when Pass 3 ignores them", () => {
    // Pass 2 has specific content about 'dialogue attribution error'
    // Pass 3 drops that entirely and talks about something else
    const pass2 = makePass2({
      dialogue: ["dialogue attribution error disrupts reader tracking through scene transitions"],
    });
    const pass3 = makePass3({
      dialogue: ["voice patterns establish character differentiation across exchanges"],
    });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    expect(result.concept_regression_criteria).toContain("dialogue");
    expect(result.total_missing_concepts).toBeGreaterThan(0);

    const entry = entryFor(result, "dialogue");
    // 'dialogue attribution error' ngrams should be missing from pass3
    expect(entry.concept_coverage.missing_pass2_concepts.length).toBeGreaterThan(0);
  });

  it("reports new unsupported concepts when Pass 3 introduces content with no Pass 2 anchor", () => {
    const pass2 = makePass2({
      tone: ["tonal register shifts abruptly between chapters"],
    });
    const pass3 = makePass3({
      tone: [
        "tonal register shifts abruptly between chapters",
        "genre signal density creates commercial positioning alignment with market expectations",
      ],
    });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    const entry = entryFor(result, "tone");
    // Pass 3 introduces 'genre signal density ... market expectations' — no Pass 2 anchor
    expect(entry.concept_coverage.new_unsupported_concepts.length).toBeGreaterThan(0);
    expect(result.total_new_concepts).toBeGreaterThan(0);
  });

  it("does NOT flag concept regression when Pass 3 covers all Pass 2 concepts (even with fewer anchors)", () => {
    // This is the key case: Pass 3 produces 2 merged anchors that contain all
    // the semantic content from 3 Pass 2 anchors — count regression but not
    // a concept regression. Count alone would wrongly flag this.
    const sharedText = "repetitive sentence structure reduces rhythmic variety across prose passages pacing suffers when clause length lacks variation";
    const pass2 = makePass2({
      proseControl: [
        "repetitive sentence structure reduces rhythmic variety",
        "across prose passages pacing suffers when clause length lacks variation",
        "rhythmic variety is important for prose passages",
      ],
    });
    const pass3 = makePass3({
      proseControl: [
        // One merged snippet covering both pass2 concepts
        sharedText,
      ],
    });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    // count_delta = 2 (3 → 1), so count regression fires
    expect(result.count_regression_criteria).toContain("proseControl");
    // BUT concept regression should NOT fire — all Pass 2 concepts are present
    expect(result.concept_regression_criteria).not.toContain("proseControl");
    expect(entryFor(result, "proseControl").concept_coverage.missing_pass2_concepts.length).toBe(0);
  });

  it("flags fidelity_intact=false when concept regression fires even if count is stable", () => {
    // Pass 3 produces same count but entirely different content — worst case
    const pass2 = makePass2({
      character: ["protagonist avoids confrontation with mentor figure throughout narrative"],
    });
    const pass3 = makePass3({
      character: ["dialogue exchanges demonstrate relationship dynamics between secondary figures"],
    });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    expect(result.count_regression_criteria).not.toContain("character"); // same count
    expect(result.concept_regression_criteria).toContain("character"); // different content
    expect(result.fidelity_intact).toBe(false);
  });
});

describe("checkPass3EvidenceFidelity — grounding scaffold", () => {
  it("always returns null for grounded counts until G4 lands", () => {
    const pass2 = makePass2({ pacing: ["some evidence"] });
    const pass3 = makePass3({ pacing: ["some evidence"] });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    for (const entry of result.criteria) {
      expect(entry.pass2_grounded_count).toBeNull();
      expect(entry.pass3_grounded_count).toBeNull();
    }
  });
});

describe("checkPass3EvidenceFidelity — edge cases", () => {
  it("handles criteria with zero evidence in both passes without flagging", () => {
    const pass2 = makePass2({ theme: [] });
    const pass3 = makePass3({ theme: [] });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    expect(result.fidelity_intact).toBe(true);
    expect(result.count_regression_criteria).toHaveLength(0);
    expect(result.concept_regression_criteria).toHaveLength(0);
  });

  it("handles criterion present in Pass 3 but absent from Pass 2 (treated as zero Pass 2 evidence)", () => {
    const pass2 = makePass2({ pacing: ["pacing evidence"] }); // no 'theme'
    const pass3 = makePass3({ pacing: ["pacing evidence"], theme: ["theme evidence"] });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    // theme: pass2 count = 0, pass3 count = 1 → not a count regression
    expect(result.count_regression_criteria).not.toContain("theme");
    // theme: no pass2 concepts to be missing → not a concept regression
    expect(result.concept_regression_criteria).not.toContain("theme");
  });

  it("emits all criteria in result.criteria regardless of regression status", () => {
    const pass2 = makePass2({
      pacing: ["evidence a"],
      dialogue: ["evidence b"],
    });
    const pass3 = makePass3({
      pacing: ["evidence a"],
      dialogue: ["evidence b"],
    });

    const result = checkPass3EvidenceFidelity(pass2, pass3);
    // All Pass 3 criteria should appear in the result
    const keys = result.criteria.map((c) => c.criterion_key);
    expect(keys).toContain("pacing");
    expect(keys).toContain("dialogue");
  });
});
