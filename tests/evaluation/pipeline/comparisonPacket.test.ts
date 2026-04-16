import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import { buildComparisonPacket } from "@/lib/evaluation/pipeline/comparisonPacket";
import type { SinglePassOutput, EvidenceAnchor } from "@/lib/evaluation/pipeline/types";

function makeEvidence(snippet: string, char_start?: number, char_end?: number): EvidenceAnchor[] {
  return [{ snippet, char_start, char_end }];
}

function makePass(pass: 1 | 2, axis: "craft_execution" | "editorial_literary"): SinglePassOutput {
  return {
    pass,
    axis,
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `${axis} rationale for ${key}. Secondary sentence should be ignored.`,
      evidence: makeEvidence(`Evidence for ${key}.`, 100, 140),
      recommendations: [],
    })),
    model: "o3",
    prompt_version: pass === 1 ? "pass1-craft-v5-compat" : "pass2-editorial-v5-judgment",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

describe("buildComparisonPacket", () => {
  it("emits one criterion packet per canonical key in canonical order", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    const packet = buildComparisonPacket(pass1, pass2);

    expect(packet.criteria).toHaveLength(CRITERIA_KEYS.length);
    expect(packet.criteria.map((c) => c.key)).toEqual(CRITERIA_KEYS);
  });

  it("classifies agree / soft_divergence / hard_divergence from score deltas", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    const setScore = (key: CriterionKey, pass1Score: number, pass2Score: number) => {
      const c1 = pass1.criteria.find((c) => c.key === key)!;
      const c2 = pass2.criteria.find((c) => c.key === key)!;
      c1.score_0_10 = pass1Score;
      c2.score_0_10 = pass2Score;
    };

    setScore("concept", 7, 8); // delta 1 => agree
    setScore("character", 9, 7); // delta 2 => soft
    setScore("voice", 10, 5); // delta 5 => hard

    const packet = buildComparisonPacket(pass1, pass2);

    const concept = packet.criteria.find((c) => c.key === "concept");
    const character = packet.criteria.find((c) => c.key === "character");
    const voice = packet.criteria.find((c) => c.key === "voice");

    expect(concept?.state).toBe("agree");
    expect(character?.state).toBe("soft_divergence");
    expect(voice?.state).toBe("hard_divergence");
    expect(packet.criteria_count_by_state.agree).toBeGreaterThanOrEqual(1);
    expect(packet.criteria_count_by_state.soft_divergence).toBeGreaterThanOrEqual(1);
    expect(packet.criteria_count_by_state.hard_divergence).toBeGreaterThanOrEqual(1);
  });

  it("classifies missing_or_invalid when a criterion is missing in either pass", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    pass2.criteria = pass2.criteria.filter((c) => c.key !== "dialogue");

    const packet = buildComparisonPacket(pass1, pass2);
    const dialogue = packet.criteria.find((c) => c.key === "dialogue");

    expect(dialogue?.state).toBe("missing_or_invalid");
    expect(dialogue?.pass2_score).toBeNull();
    expect(packet.criteria_count_by_state.missing_or_invalid).toBeGreaterThanOrEqual(1);
  });

  it("dedupes repeated pass1 evidence snippets per criterion", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    const target = pass1.criteria.find((c) => c.key === "theme")!;
    target.evidence = [
      { snippet: "Repeated snippet.", char_start: 10, char_end: 20 },
      { snippet: "Repeated snippet.", char_start: 30, char_end: 40 },
      { snippet: "Distinct snippet.", char_start: 50, char_end: 60 },
    ];

    const packet = buildComparisonPacket(pass1, pass2);
    const theme = packet.criteria.find((c) => c.key === "theme")!;

    expect(theme.pass1_evidence).toHaveLength(2);
    expect(theme.pass1_evidence.map((e) => e.snippet)).toEqual([
      "Repeated snippet.",
      "Distinct snippet.",
    ]);
  });

  it("includes disputed_excerpt_window only for divergence states when manuscript text is provided", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    const manuscriptText = "A".repeat(1000) + "DISPUTED" + "B".repeat(1000);

    const concept1 = pass1.criteria.find((c) => c.key === "concept")!;
    const concept2 = pass2.criteria.find((c) => c.key === "concept")!;
    concept1.score_0_10 = 9;
    concept2.score_0_10 = 5; // hard divergence
    concept1.evidence = [{ snippet: "Concept anchor", char_start: 995, char_end: 1005 }];

    const voice1 = pass1.criteria.find((c) => c.key === "voice")!;
    const voice2 = pass2.criteria.find((c) => c.key === "voice")!;
    voice1.score_0_10 = 7;
    voice2.score_0_10 = 7; // agree

    const packet = buildComparisonPacket(pass1, pass2, { manuscriptText, excerptRadiusChars: 10 });

    const concept = packet.criteria.find((c) => c.key === "concept")!;
    const voice = packet.criteria.find((c) => c.key === "voice")!;

    expect(concept.state).toBe("hard_divergence");
    expect(concept.disputed_excerpt_window).toBeDefined();
    expect(concept.disputed_excerpt_window?.char_start).toBe(985);
    expect(concept.disputed_excerpt_window?.char_end).toBe(1015);

    expect(voice.state).toBe("agree");
    expect(voice.disputed_excerpt_window).toBeUndefined();
  });

  it("extracts disputed excerpt from raw evidence even when bounded evidence omits ranged anchor", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    const manuscriptText = "A".repeat(2000) + "ANCHOR" + "B".repeat(2000);

    const concept1 = pass1.criteria.find((c) => c.key === "concept")!;
    const concept2 = pass2.criteria.find((c) => c.key === "concept")!;
    concept1.score_0_10 = 9;
    concept2.score_0_10 = 5; // hard divergence
    concept1.evidence = [
      { snippet: "first plain anchor" },
      { snippet: "second plain anchor" },
      { snippet: "ranged anchor", char_start: 1998, char_end: 2004 },
    ];

    const packet = buildComparisonPacket(pass1, pass2, {
      manuscriptText,
      excerptRadiusChars: 5,
      maxEvidencePerCriterion: 2,
    });

    const concept = packet.criteria.find((c) => c.key === "concept")!;
    expect(concept.pass1_evidence).toHaveLength(2);
    expect(concept.pass1_evidence.every((e) => typeof e.char_start !== "number")).toBe(true);
    expect(concept.disputed_excerpt_window).toBeDefined();
    expect(concept.disputed_excerpt_window?.char_start).toBe(1993);
    expect(concept.disputed_excerpt_window?.char_end).toBe(2009);
  });

  it("preserves verbatim snippet spacing while still deduping by normalized text", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    const target = pass1.criteria.find((c) => c.key === "theme")!;
    target.evidence = [
      { snippet: "Line  one   has   spacing" },
      { snippet: "Line one has spacing" },
    ];

    const packet = buildComparisonPacket(pass1, pass2);
    const theme = packet.criteria.find((c) => c.key === "theme")!;

    expect(theme.pass1_evidence).toHaveLength(1);
    expect(theme.pass1_evidence[0]?.snippet).toBe("Line  one   has   spacing");
  });

  it("sets score_delta to null when either score is missing or invalid", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    const dialoguePass2 = pass2.criteria.find((c) => c.key === "dialogue")!;
    dialoguePass2.score_0_10 = Number.NaN;

    const packet = buildComparisonPacket(pass1, pass2);
    const dialogue = packet.criteria.find((c) => c.key === "dialogue")!;

    expect(dialogue.state).toBe("missing_or_invalid");
    expect(dialogue.score_delta).toBeNull();
  });
});
