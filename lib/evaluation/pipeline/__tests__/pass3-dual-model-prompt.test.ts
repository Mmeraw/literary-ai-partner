/**
 * Pass 3 dual-model synthesis prompt — packet-present vs packet-absent branches.
 *
 * Verifies that buildPass3UserPrompt:
 *   1. Injects the DUAL-MODEL block when perplexityChunkPacket is provided.
 *   2. Omits the DUAL-MODEL block when perplexityChunkPacket is undefined
 *      (graceful fallback to GPT-only).
 *   3. Renders per-criterion Perplexity scores in the summary.
 */

import { describe, expect, test } from "@jest/globals";
import { buildPass3UserPrompt } from "../prompts/pass3-synthesis";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { Pass2aStructuredContext, SinglePassOutput , Pass1aCharacterLedger } from "../types";

const emptyContext: Pass2aStructuredContext = {
  character_ledger: [],
  scene_index: [],
  timeline_anchors: [],
};

function buildPerplexityPacket(): SinglePassOutput {
  return {
    pass: 1,
    axis: "craft_execution",
    model: "sonar-reasoning-pro",
    prompt_version: "pplx-chunk-scorer-v1",
    temperature: 0.1,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key, i) => ({
      key,
      score_0_10: ((i % 9) + 1),
      rationale: `Independent observation for ${key}.`,
      evidence: [{ snippet: `quote-${key}` }],
      recommendations: [],
    })),
  };
}


// Minimal character ledger stub — satisfies assertCharacterLedger() mandatory guard.
// Every novel has at least one character. Pass 3 cannot run without this.
const MINIMAL_CHARACTER_LEDGER: Pass1aCharacterLedger = {
  schema_version: "pass1a_character_ledger_v1",
  prompt_version: "test-stub",
  job_id: "test-job",
  generated_at: new Date().toISOString(),
  total_chunks_processed: 1,
  entries: [{
    canonical_name: "TestCharacter",
    aliases: [],
    pronouns: [],
    age_exact_first: null,
    age_exact_last: null,
    age_signal: null,
    gender_identity: "unknown",
    lgbtq_signals: [],
    racial_ethnic_signals: [],
    skin_tone_signals: [],
    language_signals: [],
    religion_signals: [],
    socioeconomic_signals: [],
    nationality_signals: [],
    disability_neuro_signals: [],
    role: "protagonist",
    narrative_weight_band: "major",
    is_named: true,
    who_is_this: "Test character for unit testing",
    what_do_they_want: null,
    primary_locations: [],
    why_signal: null,
    how_signal: null,
    arc_start: "initial state",
    arc_pressure: "test pressure",
    arc_turning_points: [],
    arc_end_state: "final state",
    ending_status: "resolved",
    symbolic_objects: [],
    relational_engines: [],
    evidence_anchors: [],
    report_acknowledgement_status: "adequately_accounted_for",
    warnings: [],
    first_chunk_index: 0,
    last_chunk_index: 0,
    mention_count: 1,
    nameStates: [{ name: "TestCharacter", validFromChunk: 0, validUntilChunk: null }],
    copingMechanisms: [],
    coPresenceMap: {},
  }],
  coverage_summary: {
    protagonists: ["TestCharacter"],
    co_protagonists: [],
    antagonists: [],
    major_secondary_characters: [],
    animal_companions: [],
    relational_engines: [],
    symbol_payoff_items: [],
    missing_or_underweighted: [],
    ending_accountability_warnings: [],
    hard_fail_triggers: [],
  },
};

describe("buildPass3UserPrompt — dual-model behavior", () => {
  test("omits DUAL-MODEL block when perplexityChunkPacket is undefined (GPT-only fallback)", () => {
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: emptyContext,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

    expect(prompt).not.toContain("DUAL-MODEL PARALLEL SCORING");
    expect(prompt).not.toContain("PERPLEXITY INDEPENDENT SCORES");
    expect(prompt).not.toContain("sonar-reasoning-pro");
  });

  test("injects DUAL-MODEL block when perplexityChunkPacket is provided", () => {
    const packet = buildPerplexityPacket();
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: emptyContext,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      perplexityChunkPacket: packet,
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

    expect(prompt).toContain("DUAL-MODEL PARALLEL SCORING");
    expect(prompt).toContain("PERPLEXITY INDEPENDENT SCORES");
    expect(prompt).toContain("sonar-reasoning-pro");
    // Divergence rule (>1 point) is the contract — must appear verbatim.
    expect(prompt).toContain("diverge by MORE THAN 1 point");
  });

  test("renders one summary line per criterion in the DUAL-MODEL block", () => {
    const packet = buildPerplexityPacket();
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: emptyContext,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      perplexityChunkPacket: packet,
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });
    for (const key of CRITERIA_KEYS) {
      expect(prompt).toContain(`- ${key}:`);
    }
  });

  test("dualModelMode=false suppresses the block even when packet is present", () => {
    const packet = buildPerplexityPacket();
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: emptyContext,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      perplexityChunkPacket: packet,
      dualModelMode: false,
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });
    expect(prompt).not.toContain("DUAL-MODEL PARALLEL SCORING");
  });
});

describe("buildPass3UserPrompt — manuscript entity roster grounding", () => {
  test("emits MANUSCRIPT ENTITY ROSTER with character names sorted by mention count", () => {
    const context: Pass2aStructuredContext = {
      character_ledger: [
        { name: "Benjamin", first_chunk_index: 0, mention_count: 42, sample_snippet: "Benjamin walked..." },
        { name: "Paolito", first_chunk_index: 1, mention_count: 31, sample_snippet: "Paolito laughed..." },
        { name: "Marisol", first_chunk_index: 2, mention_count: 7, sample_snippet: "Marisol said..." },
      ],
      scene_index: [
        { chunk_index: 0, scene_preview: "opening", named_entities: ["table tennis", "evil eye"] },
        { chunk_index: 1, scene_preview: "park", named_entities: ["the courtyard"] },
      ],
      timeline_anchors: [],
    };

    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: context,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

    expect(prompt).toContain("MANUSCRIPT ENTITY ROSTER");
    expect(prompt).toContain("Benjamin");
    expect(prompt).toContain("Paolito");
    expect(prompt).toContain("Marisol");
    expect(prompt).toContain("table tennis");
    expect(prompt).toContain("evil eye");
    // Highest-mention character should appear before lower-mention names.
    expect(prompt.indexOf("Benjamin")).toBeLessThan(prompt.indexOf("Marisol"));
    expect(prompt).toContain("MUST cite at least 2 specific characters by name");
    expect(prompt).toContain("Per-criterion specificity floor");
  });

  test("falls back to MANUSCRIPT GROUNDING REQUIREMENT when context has no characters or entities", () => {
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: emptyContext,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

    expect(prompt).not.toContain("## MANUSCRIPT ENTITY ROSTER");
    expect(prompt).toContain("MANUSCRIPT GROUNDING REQUIREMENT");
    expect(prompt).toContain("MUST cite at least 2 specific characters by name");
  });

  test("entity roster coexists with the DUAL-MODEL block when both are active", () => {
    const context: Pass2aStructuredContext = {
      character_ledger: [
        { name: "Benjamin", first_chunk_index: 0, mention_count: 10, sample_snippet: "x" },
      ],
      scene_index: [],
      timeline_anchors: [],
    };
    const packet = buildPerplexityPacket();
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: context,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      perplexityChunkPacket: packet,
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

    expect(prompt).toContain("MANUSCRIPT ENTITY ROSTER");
    expect(prompt).toContain("DUAL-MODEL PARALLEL SCORING");
    expect(prompt).toContain("Benjamin");
  });
});
