/**
 * tests/stress/mocks/perplexity.test.ts
 *
 * Unit-level coverage for the Pass 4 stress mock. These tests do not run the
 * full pipeline — they exercise the mock in isolation to confirm:
 *
 *   1. healthy fixture passes through to a canonValid CrossCheckOutput
 *   2. refusal phrase trips PerplexityRefusalError on the retry path
 *   3. analysisMetadata-wrapper shape variant is unwrapped by the normalizer
 *   4. criteria-as-array shape variant is rekeyed by the normalizer
 *   5. canon-invalid response yields canonValid=false (governance will reject downstream)
 *
 * Each test corresponds to a Tier 1 stress row in
 * scripts/pipeline-stress.scenarios.ts (PASS4_ROWS) and to a hardening fix
 * shipped in PR #481 (perplexityCrossCheck.ts).
 */

import { makePerplexityRunner, type PerplexityFault } from "./perplexity";
import {
  PerplexityRefusalError,
  type CriterionKey,
  type OpenAICriterionInput,
} from "@/lib/evaluation/pipeline/perplexityCrossCheck";

const CRITERION_KEYS: CriterionKey[] = [
  "concept",
  "narrativeDrive",
  "character",
  "voice",
  "sceneConstruction",
  "dialogue",
  "theme",
  "worldbuilding",
  "pacing",
  "proseControl",
  "tone",
  "emotionalResonance",
  "marketability",
];

function fakeOpenAICriteria(): Record<CriterionKey, OpenAICriterionInput> {
  const out = {} as Record<CriterionKey, OpenAICriterionInput>;
  for (const k of CRITERION_KEYS) {
    out[k] = { score: 6, rationale: `OpenAI rationale for ${k}`, evidence: [] };
  }
  return out;
}

function call(fault: PerplexityFault) {
  const { runner, context } = makePerplexityRunner(fault);
  return {
    invoke: () =>
      runner({
        openaiCriteria: fakeOpenAICriteria(),
        openaiSynthesis: "OpenAI synthesis paragraph.",
        manuscriptExcerpt: "Manuscript excerpt for stress test.",
        workType: "novel",
        title: "stress-test",
        perplexityApiKey: "test-stress-fake-key",
      }),
    context,
  };
}

describe("makePerplexityRunner (Pass 4 stress mock)", () => {
  test("healthy fixture → canonValid CrossCheckOutput with 13 criteria", async () => {
    const { invoke, context } = call({ kind: "none" });
    const result = await invoke();
    expect(result.canonValid).toBe(true);
    expect(Object.keys(result.criteria).sort()).toEqual([...CRITERION_KEYS].sort());
    expect(result.invalidCriteria).toEqual([]);
    expect(result.perplexitySynthesisNote.length).toBeGreaterThan(0);
    expect(context.invocations.at(-1)?.outcome).toBe("ok");
  });

  test("refuse-once → sharpened-prompt retry recovers; warnings record the refusal", async () => {
    const { invoke, context } = call({ kind: "refuse-once" });
    const result = await invoke();
    expect(result.canonValid).toBe(true);
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.some((w) => w.includes("refused literary judgment"))).toBe(true);
    const outcomes = context.invocations.map((i) => i.outcome);
    expect(outcomes[0]).toBe("refused");
    expect(outcomes.at(-1)).toBe("ok");
  });

  test("refuse-twice → throws PerplexityRefusalError after sharpened-prompt retry", async () => {
    const { invoke, context } = call({ kind: "refuse-twice" });
    await expect(invoke()).rejects.toBeInstanceOf(PerplexityRefusalError);
    const outcomes = context.invocations.map((i) => i.outcome);
    expect(outcomes).toEqual(["refused", "refused"]);
  });

  test("analysisMetadata wrapper variant → unwrapped by normalizer; canonValid", async () => {
    const { invoke } = call({ kind: "shape-variant-analysisMetadata" });
    const result = await invoke();
    expect(result.canonValid).toBe(true);
    expect(result.criteria.concept.perplexityScore).not.toBeNull();
    // synthesis_note (snake_case) on the fixture must be normalized to synthesisNote
    expect(result.perplexitySynthesisNote.length).toBeGreaterThan(0);
  });

  test("criteria-as-array variant → rekeyed by normalizer; canonValid", async () => {
    const { invoke } = call({ kind: "shape-variant-criteria-array" });
    const result = await invoke();
    expect(result.canonValid).toBe(true);
    expect(result.criteria.character.perplexityScore).not.toBeNull();
    expect(result.criteria.character.perplexityScoringBand).toBeTruthy();
  });

  test("canon-invalid (concept missing evidence/signals/trace) → canonValid=false, invalid 'concept'", async () => {
    const { invoke } = call({ kind: "canon-invalid-score-out-of-range" });
    const result = await invoke();
    // Parseable but canon-invalid; governance downstream will return PASS4_CANON_INVALID.
    expect(result.canonValid).toBe(false);
    expect(result.invalidCriteria).toContain("concept");
    expect(result.criteria.concept.invalidPerplexityCriterion).toBe(true);
  });

  test("truncated-json → JSON parse failure surfaced as [Pass4] error", async () => {
    const { invoke } = call({ kind: "truncated-json" });
    await expect(invoke()).rejects.toThrow(/\[Pass4\] JSON parse\/validation failed/);
  });

  test("missing API key → throws same guard as production runner", async () => {
    const { runner } = makePerplexityRunner({ kind: "none" });
    await expect(
      runner({
        openaiCriteria: fakeOpenAICriteria(),
        openaiSynthesis: "x",
        manuscriptExcerpt: "x",
        workType: "novel",
        title: "stress-test",
        perplexityApiKey: "",
      }),
    ).rejects.toThrow(/PERPLEXITY_API_KEY is required/);
  });
});
