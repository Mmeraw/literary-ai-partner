import { describe, it, expect } from "@jest/globals";
import type { Pass1aCharacterLedger } from "@/lib/evaluation/pipeline/types";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS1_SYSTEM_PROMPT, buildPass1UserPrompt } from "@/lib/evaluation/pipeline/prompts/pass1-craft";
import { PASS2_SYSTEM_PROMPT, buildPass2UserPrompt } from "@/lib/evaluation/pipeline/prompts/pass2-editorial";
import { PASS3_SYSTEM_PROMPT, buildPass3UserPrompt } from "@/lib/evaluation/pipeline/prompts/pass3-synthesis";

const pass2aStructuredContext = {
  character_ledger: [{ name: "Hyla", first_chunk_index: 0, mention_count: 2, sample_snippet: "Crown Hyla watched the chamber." }],
  scene_index: [{ chunk_index: 0, scene_preview: "Crown Hyla watched the chamber.", named_entities: ["Hyla"] }],
  timeline_anchors: [{ chunk_index: 0, anchor_type: "duration" as const, anchor_text: "three years later" }],
};


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

describe("prompt pack governance specs", () => {
  it("Pass 1 includes canonical criteria and LLR enforcement language", () => {
    for (const key of CRITERIA_KEYS) {
      expect(PASS1_SYSTEM_PROMPT).toContain(key);
    }

    expect(PASS1_SYSTEM_PROMPT).toContain("compatibility mode");
    expect(PASS1_SYSTEM_PROMPT).toContain("Evidence must be manuscript-grounded; no generic claims");
    expect(PASS1_SYSTEM_PROMPT).toContain("No editorial/thematic market commentary");
    expect(PASS1_SYSTEM_PROMPT).toContain("NONE|WEAK|SUFFICIENT|STRONG");
    expect(PASS1_SYSTEM_PROMPT).toContain("SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL");
    expect(PASS1_SYSTEM_PROMPT).toContain("never MODERATE");

    const userPrompt = buildPass1UserPrompt({
      manuscriptText: "Sample manuscript text.",
      workType: "novel_chapter",
      title: "DOMINATUS I:4",
      executionMode: "TRUSTED_PATH",
    });

    expect(userPrompt).toContain("Execution mode: TRUSTED_PATH");
    expect(userPrompt).toContain("Cover all 13 criteria");
  });

  it("Pass 2 requires independence, schema compliance, and canonical vocabulary", () => {
    for (const key of CRITERIA_KEYS) {
      expect(PASS2_SYSTEM_PROMPT).toContain(key);
    }

    expect(PASS2_SYSTEM_PROMPT).toContain("independent from Pass 1");
    expect(PASS2_SYSTEM_PROMPT).not.toContain("I agree with Pass 1");
    expect(PASS2_SYSTEM_PROMPT).toContain("NONE|WEAK|SUFFICIENT|STRONG");
    expect(PASS2_SYSTEM_PROMPT).toContain("SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL");
    expect(PASS2_SYSTEM_PROMPT).toContain("never MODERATE");

    const userPrompt = buildPass2UserPrompt({
      manuscriptText: "Sample manuscript text.",
      workType: "novel_chapter",
      title: "DOMINATUS I:4",
      executionMode: "STUDIO",
    });

    expect(userPrompt).toContain("Execution mode: STUDIO");
    expect(userPrompt).toContain("Stay fully independent");
  });

  it("Pass 3 includes agreement/divergence/arbitration sections and forbids silent merge", () => {
    expect(PASS3_SYSTEM_PROMPT).toContain("agreement_map");
    expect(PASS3_SYSTEM_PROMPT).toContain("divergence_map");
    expect(PASS3_SYSTEM_PROMPT).toContain("arbitration_rationale");
    expect(PASS3_SYSTEM_PROMPT).toContain("Do NOT silently overwrite disagreement");
    expect(PASS3_SYSTEM_PROMPT).toContain("pressure signal -> decision inflection -> consequence trajectory");
    expect(PASS3_SYSTEM_PROMPT).toContain("pressure->decision->consequence logic");
    expect(PASS3_SYSTEM_PROMPT).toContain("NONE|WEAK|SUFFICIENT|STRONG");
    expect(PASS3_SYSTEM_PROMPT).toContain("SCORABLE|NOT_APPLICABLE|NO_SIGNAL|INSUFFICIENT_SIGNAL");
    expect(PASS3_SYSTEM_PROMPT).toContain("never MODERATE");
    expect(PASS3_SYSTEM_PROMPT.length).toBeLessThanOrEqual(6000); // prompt is exactly 5000 chars; strict < fails at boundary

    const userPrompt = buildPass3UserPrompt({
      comparisonPacketJson: "{\"criteria\":[],\"criteria_count_by_state\":{\"agree\":0,\"soft_divergence\":0,\"hard_divergence\":0,\"missing_or_invalid\":0}}",
      pass2aStructuredContext,
      manuscriptText: "Sample manuscript text.",
      title: "DOMINATUS I:4",
      executionMode: "TRUSTED_PATH",
      characterLedger: MINIMAL_CHARACTER_LEDGER,
    });

    expect(userPrompt).toContain("Execution mode: TRUSTED_PATH");
    expect(userPrompt).toContain("PASS2A_STRUCTURED_CONTEXT");
    expect(userPrompt).toContain("Hyla");
    expect(userPrompt).toContain("Produce explicit agreement_map and divergence_map");
    expect(userPrompt).toContain("identify concrete pressure, then the chapter-level decision (or non-decision), then the resulting consequence");
    expect(userPrompt).toContain("If consequence is deferred, name the risk and expected downstream cost explicitly");
  });
});
