import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { buildComparisonPacket } from "@/lib/evaluation/pipeline/comparisonPacket";
import { runPass3Synthesis } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { CreateCompletionFn } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { Pass3ReducerTelemetry, SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";

function makePass(pass: 1 | 2, axis: "craft_execution" | "editorial_literary"): SinglePassOutput {
  return {
    pass,
    axis,
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `${axis} rationale for ${key}`,
      evidence: [{ snippet: `Evidence for ${key}.`, char_start: 0, char_end: 10 }],
      recommendations: [],
    })),
    model: "gpt-4o",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.2,
    generated_at: new Date().toISOString(),
  };
}

function makePass3Completion(): CreateCompletionFn {
  const payload = {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      final_rationale: `Synthesized rationale for ${key}.`,
      evidence: [{ snippet: "Anchor line from manuscript." }],
      recommendations: [
        {
          priority: "medium",
          action: `Revise ${key} at the scene turn because causality is currently abstracted from concrete consequence.`,
          expected_impact: "Improves reader clarity through concrete consequence sequencing.",
          anchor_snippet: "Anchor line from manuscript.",
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary:
        "Strong baseline, but multiple criteria need concrete scene-level revision before submission.",
      top_3_strengths: ["voice", "concept", "scene energy"],
      top_3_risks: ["pacing", "character pressure", "dialogue attribution"],
      submission_readiness: "close",
    },
    metadata: {
      pass1_model: "gpt-4o",
      pass2_model: "gpt-4o",
      pass3_model: "gpt-4o",
    },
  };

  return async () => ({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  });
}

describe("#292 packet evidence consumption", () => {
  it("long_form_packet_consumes_chunk_derived_evidence", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    const conceptPass1 = pass1.criteria.find((c) => c.key === "concept")!;
    const conceptPass2 = pass2.criteria.find((c) => c.key === "concept")!;

    conceptPass1.score_0_10 = 9;
    conceptPass2.score_0_10 = 5;
    conceptPass1.evidence = [
      {
        snippet: "canonical chunk marker",
        char_start: 8,
        char_end: 30,
      },
    ];

    const preChunkText = "PRE_CHUNK_TEXT_ONLY_DO_NOT_USE".repeat(60);
    const canonicalChunkText = "AAAAAAA canonical chunk marker from chunk corpus BBBBBBB";

    const packet = buildComparisonPacket(pass1, pass2, {
      manuscriptText: preChunkText,
      chunks: [{ chunk_index: 0, content: canonicalChunkText }],
      excerptRadiusChars: 3,
    });

    const concept = packet.criteria.find((c) => c.key === "concept")!;

    expect(packet.packet_source).toBe("long_form_chunks_canonical");
    expect(packet.packet_scope).toBe("criterion_comparison");
    expect(packet.packet_evidence_origin).toBe("chunk_canonical_window");

    expect(concept.disputed_excerpt_window).toBeDefined();
    expect(concept.disputed_excerpt_window?.snippet).toContain("canonical chunk marker");
    expect(concept.disputed_excerpt_window?.snippet).not.toContain("PRE_CHUNK_TEXT_ONLY_DO_NOT_USE");
  });

  it("long_form_packet_provenance_telemetry_emitted", async () => {
    const registry = loadCanonicalRegistry();
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    let telemetry:
      | {
          packet_source: string;
          packet_scope: string;
          packet_evidence_origin: string;
          manuscript_words: number;
          chunks_created: number;
          chunks_consumed: number | null;
          chunk_coverage_pct: number | null;
          excerpt_count: number;
          evidence_count_by_criterion: Record<string, number>;
          comparison_packet_chars: number;
          representation_compression_ratio: number;
          criteria_with_zero_evidence: string[];
        }
      | undefined;

    await runPass3Synthesis({
      pass1,
      pass2,
      manuscriptText: "pre-chunk placeholder text",
      manuscriptChunks: [{ chunk_index: 0, content: "chunk canonical source text ".repeat(1200) }],
      title: "Long Form Test",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: makePass3Completion(),
      _onCompletion: (capture) => {
        const reducer = capture.pass3_reducer_telemetry;
        if (reducer) {
          telemetry = {
            packet_source: reducer.packet_source,
            packet_scope: reducer.packet_scope,
            packet_evidence_origin: reducer.packet_evidence_origin,
            manuscript_words: reducer.manuscript_words,
            chunks_created: reducer.chunks_created,
            chunks_consumed: reducer.chunks_consumed,
            chunk_coverage_pct: reducer.chunk_coverage_pct,
            excerpt_count: reducer.excerpt_count,
            evidence_count_by_criterion: reducer.evidence_count_by_criterion,
            comparison_packet_chars: reducer.comparison_packet_chars,
            representation_compression_ratio: reducer.representation_compression_ratio,
            criteria_with_zero_evidence: reducer.criteria_with_zero_evidence,
          };
        }
      },
    });

    expect(telemetry).toMatchObject({
      packet_source: "long_form_chunks_canonical",
      packet_scope: "criterion_comparison",
      packet_evidence_origin: "chunk_canonical_window",
    });

    expect(telemetry?.manuscript_words).toBeGreaterThan(0);
    expect(telemetry?.chunks_created).toBe(1);
    expect(telemetry?.chunks_consumed).toBeGreaterThanOrEqual(0);
    expect(telemetry?.chunk_coverage_pct).toBeGreaterThanOrEqual(0);
    expect(telemetry?.chunk_coverage_pct).toBeLessThanOrEqual(100);
    expect(telemetry?.excerpt_count).toBeGreaterThanOrEqual(0);
    expect(telemetry?.comparison_packet_chars).toBeGreaterThan(0);
    expect(telemetry?.representation_compression_ratio).toBeGreaterThan(0);
    expect(telemetry?.representation_compression_ratio).toBeLessThanOrEqual(1);
    expect(telemetry?.evidence_count_by_criterion).toBeDefined();
    expect(Object.keys(telemetry?.evidence_count_by_criterion ?? {}).length).toBe(
      CRITERIA_KEYS.length,
    );
    expect(Array.isArray(telemetry?.criteria_with_zero_evidence)).toBe(true);
  });

  it("long_form_emits_full_sipoc_coverage_diagnostics", async () => {
    const registry = loadCanonicalRegistry();
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    let reducerTelemetry: Pass3ReducerTelemetry | null = null;

    await runPass3Synthesis({
      pass1,
      pass2,
      manuscriptText: "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(3000),
      manuscriptChunks: [{ chunk_index: 0, content: "chunk canonical source text with anchored evidence ".repeat(1000) }],
      title: "Long Form SIPOC",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: makePass3Completion(),
      _onCompletion: (capture) => {
        reducerTelemetry = capture.pass3_reducer_telemetry ?? null;
      },
    });

    expect(reducerTelemetry).toBeTruthy();
    expect(reducerTelemetry?.packet_source).toBe("long_form_chunks_canonical");
    expect(reducerTelemetry?.packet_scope).toBe("criterion_comparison");
    expect(reducerTelemetry?.packet_evidence_origin).toBe("chunk_canonical_window");

    expect(reducerTelemetry?.manuscript_words).toBeGreaterThan(0);
    expect(reducerTelemetry?.chunks_created).toBe(1);
    expect(reducerTelemetry?.chunks_consumed).toBeGreaterThanOrEqual(0);
    expect(reducerTelemetry?.chunks_consumed).toBeLessThanOrEqual(reducerTelemetry?.chunks_created ?? 0);
    expect(reducerTelemetry?.chunk_coverage_pct).toBeGreaterThanOrEqual(0);
    expect(reducerTelemetry?.chunk_coverage_pct).toBeLessThanOrEqual(100);
    expect(reducerTelemetry?.excerpt_count).toBeGreaterThanOrEqual(0);
    expect(reducerTelemetry?.comparison_packet_chars).toBeGreaterThan(0);
    expect(reducerTelemetry?.representation_compression_ratio).toBeGreaterThan(0);
    expect(reducerTelemetry?.representation_compression_ratio).toBeLessThan(1);
    expect(reducerTelemetry?.evidence_count_by_criterion).toBeDefined();
    expect(Object.keys(reducerTelemetry?.evidence_count_by_criterion ?? {}).length).toBe(CRITERIA_KEYS.length);
    expect(Array.isArray(reducerTelemetry?.criteria_with_zero_evidence)).toBe(true);
  });

  it("short_form_emits_input_side_coverage_only", async () => {
    const registry = loadCanonicalRegistry();
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    let reducerTelemetry: Pass3ReducerTelemetry | null = null;

    await runPass3Synthesis({
      pass1,
      pass2,
      manuscriptText: "short manuscript text with full text evidence path",
      title: "Short Form SIPOC",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: makePass3Completion(),
      _onCompletion: (capture) => {
        reducerTelemetry = capture.pass3_reducer_telemetry ?? null;
      },
    });

    expect(reducerTelemetry).toBeTruthy();
    expect(reducerTelemetry?.packet_source).toBe("short_form_initial_text");
    expect(reducerTelemetry?.packet_evidence_origin).toBe("short_form_full_text");
    expect(reducerTelemetry?.manuscript_words).toBeGreaterThan(0);
    expect(reducerTelemetry?.chunks_created).toBe(0);
    expect(reducerTelemetry?.chunks_consumed).toBeNull();
    expect(reducerTelemetry?.chunk_coverage_pct).toBeNull();
    expect(reducerTelemetry?.excerpt_count).toBeGreaterThanOrEqual(0);
    expect(reducerTelemetry?.comparison_packet_chars).toBeGreaterThan(0);
    expect(reducerTelemetry?.representation_compression_ratio).toBeGreaterThan(0);
  });

  it("short_form_packet_behavior_unchanged", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    const packet = buildComparisonPacket(pass1, pass2, {
      manuscriptText: "short form manuscript text",
    });

    expect(packet.packet_source).toBe("short_form_initial_text");
    expect(packet.packet_scope).toBe("criterion_comparison");
    expect(packet.packet_evidence_origin).toBe("short_form_full_text");
    expect(packet.criteria).toHaveLength(CRITERIA_KEYS.length);
  });
});
