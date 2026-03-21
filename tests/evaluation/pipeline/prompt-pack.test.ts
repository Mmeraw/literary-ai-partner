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

    expect(PASS1_SYSTEM_PROMPT).toContain("too many ideas");
    expect(PASS1_SYSTEM_PROMPT).toContain("boundary blur / conceptual overlap");
    expect(PASS1_SYSTEM_PROMPT).toContain("Do NOT use generic critique language");

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

    expect(PASS2_SYSTEM_PROMPT).toContain("independent evaluator");
    expect(PASS2_SYSTEM_PROMPT).toContain("divergence_declaration");
    expect(PASS2_SYSTEM_PROMPT).not.toContain("I agree with Pass 1");

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

    const userPrompt = buildPass3UserPrompt({
      pass1Json: "{\"criteria\":[]}",
      pass2Json: "{\"criteria\":[]}",
      manuscriptText: "Sample manuscript text.",
      title: "DOMINATUS I:4",
      executionMode: "TRUSTED_PATH",
    });

    expect(userPrompt).toContain("Execution mode: TRUSTED_PATH");
    expect(userPrompt).toContain("Produce explicit agreement_map and divergence_map");
  });
});
