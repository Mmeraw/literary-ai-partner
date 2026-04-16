import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS1_SYSTEM_PROMPT, buildPass1UserPrompt } from "@/lib/evaluation/pipeline/prompts/pass1-craft";
import { PASS2_SYSTEM_PROMPT, buildPass2UserPrompt } from "@/lib/evaluation/pipeline/prompts/pass2-editorial";
import { PASS3_SYSTEM_PROMPT, buildPass3UserPrompt } from "@/lib/evaluation/pipeline/prompts/pass3-synthesis";

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

  it("Pass 2 requires independent divergence declaration and avoids passive agreement framing", () => {
    for (const key of CRITERIA_KEYS) {
      expect(PASS2_SYSTEM_PROMPT).toContain(key);
    }

    expect(PASS2_SYSTEM_PROMPT).toContain("independent from Pass 1");
    expect(PASS2_SYSTEM_PROMPT).toContain("divergence_declaration");
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
    expect(PASS3_SYSTEM_PROMPT.length).toBeLessThan(2200);

    const userPrompt = buildPass3UserPrompt({
      comparisonPacketJson: "{\"criteria\":[],\"criteria_count_by_state\":{\"agree\":0,\"soft_divergence\":0,\"hard_divergence\":0,\"missing_or_invalid\":0}}",
      manuscriptText: "Sample manuscript text.",
      title: "DOMINATUS I:4",
      executionMode: "TRUSTED_PATH",
    });

    expect(userPrompt).toContain("Execution mode: TRUSTED_PATH");
    expect(userPrompt).toContain("Produce explicit agreement_map and divergence_map");
    expect(userPrompt).toContain("identify concrete pressure, then the chapter-level decision (or non-decision), then the resulting consequence");
    expect(userPrompt).toContain("If consequence is deferred, name the risk and expected downstream cost explicitly");
  });
});
