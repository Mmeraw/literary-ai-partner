/**
 * Diagnostic Spine — Unit Tests
 *
 * Verifies:
 * 1. extractDiagnosticSpine populates all five fields correctly
 * 2. Confidence levels are derived correctly
 * 3. UNAVAILABLE_SPINE returned when block is absent/malformed
 * 4. diagnostic_spine passes through parsePass3Response and appears in output
 * 5. GOLDEN SPINE ISOLATION: diagnostic_spine_v1 does NOT interact with
 *    golden_spine_v1 — they are separate layers
 */

import { describe, expect, test } from "@jest/globals";
import {
  extractDiagnosticSpine,
  UNAVAILABLE_SPINE,
  buildDiagnosticSpinePromptBlock,
  type DiagnosticSpine,
} from "@/lib/evaluation/diagnosticSpine";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import type { SubmissionScopeProfile } from "@/lib/evaluation/pipeline/submissionScope";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makePassOutput(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    model: "gpt-4o",
    prompt_version: `pass${pass}-v1`,
    temperature: 0.2,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Rationale for ${key}.`,
      evidence: [{ snippet: `Evidence for ${key}.` }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `In chapter 2, tighten the ${key} beat because the turn is diffuse.`,
          expected_impact: "Gives the reader clearer momentum.",
          anchor_snippet: `Anchor for ${key}.`,
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
    })),
  };
}

const FULL_SPINE_RAW = {
  central_argument:
    "Public harm reduction and private emotional harm reduction are structurally incompatible, and the protagonist cannot pursue both without self-destruction.",
  core_story_question:
    "Can the protagonist's decision to protect the community justify the emotional abandonment of those closest to her?",
  dominant_conflict_engine: "harm-reduction paradox",
  primary_reader_promise:
    "A quiet accumulation of institutional pressure building toward an irreversible personal rupture that the protagonist has seen coming but cannot avoid.",
  primary_structural_gap:
    "The inciting rupture is withheld too long — the opening quarter establishes atmosphere without concretizing the stakes the reader is promised.",
};

const THIN_SPINE_RAW = {
  central_argument: "A story about family inheritance and silence.",
  core_story_question: "What will the patriarch leave behind?",
  dominant_conflict_engine: "sibling rivalry over silence",
};

// ── extractDiagnosticSpine unit tests ────────────────────────────────────────

describe("extractDiagnosticSpine", () => {
  test("extracts all five fields from a full-quality LLM block", () => {
    const spine = extractDiagnosticSpine(FULL_SPINE_RAW);

    expect(spine.central_argument).toContain("harm reduction");
    expect(spine.core_story_question).toContain("protagonist");
    expect(spine.dominant_conflict_engine).toBe("harm-reduction paradox");
    expect(spine.primary_reader_promise).toContain("institutional pressure");
    expect(spine.primary_structural_gap).toContain("inciting rupture");
  });

  test("returns confidence=high when all five fields are substantive", () => {
    const spine = extractDiagnosticSpine(FULL_SPINE_RAW);
    expect(spine.confidence).toBe("high");
  });

  test("returns confidence=partial when only some fields are substantive", () => {
    const spine = extractDiagnosticSpine(THIN_SPINE_RAW);
    expect(spine.confidence).toBe("partial");
  });

  test("returns UNAVAILABLE_SPINE when block is null", () => {
    const spine = extractDiagnosticSpine(null);
    expect(spine.confidence).toBe("unavailable");
    expect(spine.central_argument).toBe("");
  });

  test("returns UNAVAILABLE_SPINE when block is not an object", () => {
    expect(extractDiagnosticSpine("string")).toEqual(UNAVAILABLE_SPINE);
    expect(extractDiagnosticSpine(42)).toEqual(UNAVAILABLE_SPINE);
    expect(extractDiagnosticSpine([])).toEqual(UNAVAILABLE_SPINE);
  });

  test("returns UNAVAILABLE_SPINE when all three primary fields are empty", () => {
    const spine = extractDiagnosticSpine({
      central_argument: "",
      core_story_question: "",
      dominant_conflict_engine: "",
      primary_reader_promise: "something",
      primary_structural_gap: "something",
    });
    expect(spine.confidence).toBe("unavailable");
  });
});

// ── buildDiagnosticSpinePromptBlock ──────────────────────────────────────────

describe("buildDiagnosticSpinePromptBlock", () => {
  test("prompt block names all five required fields", () => {
    const block = buildDiagnosticSpinePromptBlock();
    expect(block).toContain("central_argument");
    expect(block).toContain("core_story_question");
    expect(block).toContain("dominant_conflict_engine");
    expect(block).toContain("primary_reader_promise");
    expect(block).toContain("primary_structural_gap");
  });

  test("prompt block instructs LLM to emit spine before criteria scoring", () => {
    const block = buildDiagnosticSpinePromptBlock();
    expect(block).toContain("diagnostic_spine");
    expect(block).toContain("DIAGNOSTIC SPINE");
  });

  test("prompt block enforces claim rules (no genre label as central_argument)", () => {
    const block = buildDiagnosticSpinePromptBlock();
    expect(block).toContain("genre labels");
  });
});

// ── parsePass3Response integration ───────────────────────────────────────────

describe("parsePass3Response — diagnostic_spine integration", () => {
  const pass1 = makePassOutput(1);
  const pass2 = makePassOutput(2);
  const longFormScope: SubmissionScopeProfile = {
    inputScale: "full_manuscript",
    wordCount: 52000,
    chunkCount: 52,
    scorableCount: 13,
    confidenceCapSummary: "HIGH",
    scopePolicyVersion: "v3-mode-aware",
    manuscriptStructure: "chapters",
    evaluationMode: "long_form_evaluation",
    requiresUserFacingReviewGate: true,
    requiresAcceptedStoryLedger: true,
    storyLedgerAuthority: "governed",
  };

  function buildRawWithSpine(spine: object | null) {
    return JSON.stringify({
      ...(spine !== null ? { diagnostic_spine: spine } : {}),
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        craft_score: 7,
        editorial_score: 6,
        final_score_0_10: 7,
        final_rationale: `Rationale for ${key} anchored to the harm-reduction paradox.`,
        evidence: [{ snippet: `Evidence for ${key}.` }],
        recommendations: [
          {
            priority: "medium",
            action: `In chapter 2, tighten the ${key} beat because the turn is diffuse.`,
            expected_impact: "Clearer cause-and-effect.",
            anchor_snippet: `Anchor for ${key}.`,
            source_pass: 3,
            issue_family: "scene_structure",
            strategic_lever: "scene_goal_clarity",
            revision_granularity: "scene",
            mechanism: "the turn is diffuse",
            specific_fix: "tighten one beat",
            reader_effect: "clearer momentum",
          },
        ],
      })),
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "The manuscript delivers strong atmosphere but needs structural grounding.",
        top_3_strengths: ["voice", "theme", "worldbuilding"],
        top_3_risks: ["narrativeClosure", "pacing", "marketability"],
        submission_readiness: "nearly_ready",
      },
    });
  }

  test("diagnostic_spine is present on output when LLM emits a full block", () => {
    const raw = buildRawWithSpine(FULL_SPINE_RAW);
    const result = parsePass3Response(raw, pass1, pass2, "o3");

    expect(result.diagnostic_spine).toBeDefined();
    expect(result.diagnostic_spine?.confidence).toBe("high");
    expect(result.diagnostic_spine?.central_argument).toContain("harm reduction");
    expect(result.diagnostic_spine?.dominant_conflict_engine).toBe("harm-reduction paradox");
  });

  test("diagnostic_spine is undefined when LLM omits the block (no crash)", () => {
    const raw = buildRawWithSpine(null);
    const result = parsePass3Response(raw, pass1, pass2, "o3");

    // Should not throw; spine is simply absent
    expect(result.diagnostic_spine).toBeUndefined();
    // criteria still evaluates fine
    expect(result.criteria).toHaveLength(13);
  });

  test("diagnostic_spine confidence=partial when LLM emits thin fields", () => {
    const raw = buildRawWithSpine(THIN_SPINE_RAW);
    const result = parsePass3Response(raw, pass1, pass2, "o3");

    expect(result.diagnostic_spine).toBeDefined();
    expect(result.diagnostic_spine?.confidence).toBe("partial");
  });

  test("throws for long-form when diagnostic_spine is absent/unusable (no silent continuation)", () => {
    const raw = buildRawWithSpine(null);

    expect(() =>
      parsePass3Response(
        raw,
        pass1,
        pass2,
        "o3",
        "word ".repeat(26_000),
        undefined,
        longFormScope,
      ),
    ).toThrow("DIAGNOSTIC_SPINE_REQUIRED_LONG_FORM");
  });

  test("ACCEPTANCE: Sister-style central_argument captures harm-reduction/enabling parallel before recommendations remain emitted", () => {
    const sisterStyleSpine = {
      ...FULL_SPINE_RAW,
      central_argument:
        "The manuscript argues that public harm reduction and private enabling run in parallel, and pursuing one without confronting the other becomes self-destructive.",
    };

    const raw = buildRawWithSpine(sisterStyleSpine);
    const result = parsePass3Response(
      raw,
      pass1,
      pass2,
      "o3",
      "word ".repeat(26_000),
      undefined,
      longFormScope,
    );

    expect(result.diagnostic_spine?.central_argument.toLowerCase()).toContain("harm reduction");
    expect(result.diagnostic_spine?.central_argument.toLowerCase()).toContain("parallel");
    const conceptCriterion = result.criteria.find((c) => c.key === "concept");
    expect((conceptCriterion?.recommendations.length ?? 0)).toBeGreaterThan(0);
  });

  test("ACCEPTANCE: recommendation inconsistent with primary_reader_promise is suppressed", () => {
    const raw = JSON.stringify({
      diagnostic_spine: {
        ...FULL_SPINE_RAW,
        primary_reader_promise:
          "A slow accumulation of environmental dread and atmospheric unease, not high-velocity escalation.",
      },
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        craft_score: 7,
        editorial_score: 6,
        final_score_0_10: 7,
        final_rationale: `Rationale for ${key}.`,
        evidence: [{ snippet: `Evidence for ${key}.` }],
        recommendations:
          key === "pacing"
            ? [
                {
                  priority: "medium",
                  action:
                    "In chapter 3, increase momentum by adding a decision beat and a clearer next step.",
                  expected_impact: "Faster pacing and stronger propulsion.",
                  anchor_snippet: "The marsh breathed in long, quiet swells.",
                  source_pass: 3,
                  issue_family: "pacing",
                  strategic_lever: "momentum_visibility",
                  revision_granularity: "scene",
                  mechanism: "the section is too atmospheric",
                  specific_fix: "add a decision beat",
                  reader_effect: "higher speed",
                  symptom: "reader urgency remains too diffuse at the scene turn",
                  mistake_proofing: "preserve atmospheric texture while adjusting scene movement",
                },
              ]
            : [
                {
                  priority: "medium",
                  action: `In chapter 2 for ${key}, tighten one sentence because the turn is diffuse.`,
                  expected_impact: "Gives the reader clearer progression.",
                  anchor_snippet: `Anchor for ${key}.`,
                  source_pass: 3,
                  issue_family: "scene_structure",
                  strategic_lever: "scene_goal_clarity",
                  revision_granularity: "scene",
                  mechanism: "the turn is diffuse",
                  specific_fix: "tighten one sentence",
                  reader_effect: "clearer progression",
                },
              ],
      })),
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Strong atmosphere, but selective structural drag.",
        top_3_strengths: ["voice", "theme", "worldbuilding"],
        top_3_risks: ["narrativeClosure", "pacing", "marketability"],
        submission_readiness: "nearly_ready",
      },
    });

    const result = parsePass3Response(
      raw,
      pass1,
      pass2,
      "o3",
      "word ".repeat(26_000),
      undefined,
      longFormScope,
    );

    const pacing = result.criteria.find((c) => c.key === "pacing");
    expect(pacing).toBeDefined();
    expect(pacing?.recommendations).toHaveLength(0);
    expect(pacing?.technical_defects?.some((d) => d.code === "DIAGNOSTIC_SPINE_PROMISE_MISMATCH")).toBe(true);
  });
});

// ── Golden Spine isolation tests ──────────────────────────────────────────────
//
// These tests do not import goldenSpineAudit — that's the point.
// They assert that the diagnostic_spine shape has no fields that
// belong to GoldenSpineArtifact and vice versa.

describe("GOLDEN SPINE ISOLATION — diagnostic_spine_v1 vs golden_spine_v1", () => {
  test("DiagnosticSpine type has no golden_spine_v1 fields", () => {
    const spine: DiagnosticSpine = {
      central_argument: "test",
      core_story_question: "test?",
      dominant_conflict_engine: "test engine",
      primary_reader_promise: "test promise",
      primary_structural_gap: "test gap",
      confidence: "high",
    };

    // These fields must NOT exist on DiagnosticSpine
    const goldenSpineFields = ["version", "motifLedger", "spines", "continuityScore", "summaryFindings", "wordCount"];
    for (const field of goldenSpineFields) {
      expect(Object.prototype.hasOwnProperty.call(spine, field)).toBe(false);
    }
  });

  test("diagnostic_spine output fields are editorial-thesis fields only", () => {
    const spine = extractDiagnosticSpine(FULL_SPINE_RAW);
    const diagnosticSpineKeys = Object.keys(spine).sort();

    expect(diagnosticSpineKeys).toEqual([
      "central_argument",
      "confidence",
      "core_story_question",
      "dominant_conflict_engine",
      "primary_reader_promise",
      "primary_structural_gap",
    ]);
  });
});
