import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

export {};

function makePass(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    model: "o3",
    prompt_version: "test",
    temperature: 0.2,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale:
        key === "voice"
          ? pass === 1
            ? "Pass 1 rationale for voice highlights close third POV control, stable psychic distance, and diction-level rendering choices."
            : "Pass 2 rationale for voice highlights focalization consistency, narrative distance discipline, and sentence-level perspective management."
          : key === "dialogue"
            ? pass === 1
              ? "Pass 1 rationale for dialogue highlights clear speaker attribution via light tags and calibrated dialogue beats."
              : "Pass 2 rationale for dialogue highlights subtext signaling through turn-taking rhythm and quote-level rendering control."
          : pass === 1
            ? `Pass 1 rationale for ${key} highlights structural pressure and chapter-level movement with specific manuscript grounding.`
            : `Pass 2 rationale for ${key} highlights interpretive consequences and reader-facing impact with specific manuscript grounding.`,
      evidence: [
        {
          snippet:
            pass === 1
              ? `Pass 1 evidence for ${key}: The river bucked against the hull while Cliff recalculated his route.`
              : `Pass 2 evidence for ${key}: The narrator's restraint turns observation into consequential tension.`,
        },
      ],
      recommendations: [
        {
          priority: "medium",
          action:
            pass === 1
              ? `Strengthen ${key} by adding one earlier pressure cue that foreshadows later decisions in the chapter arc.`
              : `Strengthen ${key} by clarifying how the reflective beat changes the reader's interpretation of risk.`,
          expected_impact:
            "Improves coherence and makes criterion-level consequences legible without flattening voice.",
          anchor_snippet:
            pass === 1
              ? "The river bucked against the hull while Cliff recalculated his route."
              : "The narrator's restraint turns observation into consequential tension.",
        },
      ],
    })),
  };
}

describe("Pass 3 backfill quality", () => {
  test("backfills rationale/evidence/recommendations when synthesis output is under-covered", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "concept",
          craft_score: 6,
          editorial_score: 8,
          final_score_0_10: 7,
          final_rationale: "Neither pass supplied a focused appraisal.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 70,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, pass1, pass2, "o3");
    const concept = parsed.criteria.find((c) => c.key === "concept");

    expect(concept).toBeDefined();
    expect(concept!.final_rationale.toLowerCase()).not.toContain("neither pass supplied");
    expect(concept!.final_rationale.length).toBeGreaterThanOrEqual(40);
    expect(concept!.evidence.length).toBeGreaterThan(0);
    expect(concept!.recommendations.length).toBeGreaterThan(0);
    expect(concept!.recommendations[0].source_pass).toBe(1);
  });

  test("backfills generic voice rationale with explicit POV/rendering mechanism language", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "voice",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "The voice feels strong and mostly effective throughout this section.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, pass1, pass2, "o3");
    const voice = parsed.criteria.find((c) => c.key === "voice");

    expect(voice).toBeDefined();
    expect(voice!.final_rationale.toLowerCase()).not.toContain("voice feels strong and mostly effective");
    expect(voice!.final_rationale.toLowerCase()).toMatch(/pov|psychic distance|focali|narrative distance|perspective/);
    expect(voice!.evidence.length).toBeGreaterThan(0);
  });

  test("backfills generic dialogue rationale with explicit attribution/rendering mechanism language", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "dialogue",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Conversations are generally effective and easy to read.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, pass1, pass2, "o3");
    const dialogue = parsed.criteria.find((c) => c.key === "dialogue");

    expect(dialogue).toBeDefined();
    expect(dialogue!.final_rationale.toLowerCase()).not.toContain("conversations are generally effective and easy to read");
    expect(dialogue!.final_rationale.toLowerCase()).toMatch(/dialogue|attribution|tag|speaker|beat|subtext|quote|rendering/);
    expect(dialogue!.evidence.length).toBeGreaterThan(0);
  });

  test("injects deterministic dialogue mechanism clause when fallback inputs are generic", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    // Force both axis rationales to be generic (no mechanism markers),
    // mirroring production failure conditions where fallback text was too vague.
    const genericPass1 = {
      ...pass1,
      criteria: pass1.criteria.map((c) =>
        c.key === "dialogue"
          ? { ...c, rationale: "Dialogue works and reads smoothly overall." }
          : c,
      ),
    };
    const genericPass2 = {
      ...pass2,
      criteria: pass2.criteria.map((c) =>
        c.key === "dialogue"
          ? { ...c, rationale: "Dialogue quality is generally effective." }
          : c,
      ),
    };

    const raw = JSON.stringify({
      criteria: [
        {
          key: "dialogue",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Conversations are engaging and easy to follow.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, genericPass1, genericPass2, "o3");
    const dialogue = parsed.criteria.find((c) => c.key === "dialogue");

    expect(dialogue).toBeDefined();
    expect(dialogue!.final_rationale.toLowerCase()).toMatch(/speaker|attribution|tag|beat|quote|turn-taking|turn taking/);
  });

  test("is idempotent for generic dialogue fallback inputs", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const genericPass1 = {
      ...pass1,
      criteria: pass1.criteria.map((c) =>
        c.key === "dialogue"
          ? { ...c, rationale: "Dialogue works and reads smoothly overall." }
          : c,
      ),
    };
    const genericPass2 = {
      ...pass2,
      criteria: pass2.criteria.map((c) =>
        c.key === "dialogue"
          ? { ...c, rationale: "Dialogue quality is generally effective." }
          : c,
      ),
    };

    const raw = JSON.stringify({
      criteria: [
        {
          key: "dialogue",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Conversations are engaging and easy to follow.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsedA = parsePass3Response(raw, genericPass1, genericPass2, "o3");
    const parsedB = parsePass3Response(raw, genericPass1, genericPass2, "o3");

    const dialogueA = parsedA.criteria.find((c) => c.key === "dialogue");
    const dialogueB = parsedB.criteria.find((c) => c.key === "dialogue");

    expect(dialogueA).toBeDefined();
    expect(dialogueB).toBeDefined();
    expect(dialogueA!.final_rationale).toBe(dialogueB!.final_rationale);
  });

  test("deterministically repairs generic recommendation actions to concrete fix/move contract", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "character",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Character signal is present but can be sharpened in scene execution.",
          evidence: [
            {
              snippet: "She closed the letter and swallowed her answer.",
            },
          ],
          recommendations: [
            {
              priority: "medium",
              action: "In character-driven scenes, deepen character development by adding more personal stakes.",
              expected_impact: "Improves character quality.",
              anchor_snippet: "She closed the letter and swallowed her answer.",
              source_pass: 3,
              issue_family: "characterization",
              strategic_lever: "character_voice_differentiation",
              revision_granularity: "scene",
            },
          ],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, pass1, pass2, "o3");
    const character = parsed.criteria.find((c) => c.key === "character");
    expect(character).toBeDefined();

    const rec = character!.recommendations[0];
    expect(rec).toBeDefined();
    expect(rec.action.toLowerCase()).toMatch(/replace|insert/);
    expect(rec.action.toLowerCase()).toContain("because");
    expect(rec.expected_impact.toLowerCase()).toMatch(/reader|clarity|engagement|immersion|momentum/);
  });

  test("repairs live failed patterns with criterion-aware concrete moves while preserving intent", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "character",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Character rationale placeholder.",
          evidence: [{ snippet: "He folded the letter into his pocket." }],
          recommendations: [
            {
              priority: "medium",
              action: "In character-driven scenes, deepen character development by adding more personal stakes.",
              expected_impact: "Improves character quality.",
              anchor_snippet: "He folded the letter into his pocket.",
              source_pass: 3,
              issue_family: "characterization",
              strategic_lever: "character_voice_differentiation",
              revision_granularity: "scene",
            },
          ],
        },
        {
          key: "sceneConstruction",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Scene construction rationale placeholder.",
          evidence: [{ snippet: "Rain crossed the window while she stayed silent." }],
          recommendations: [
            {
              priority: "medium",
              action: "In slower scenes, streamline descriptive passages to improve pacing.",
              expected_impact: "Improves pacing.",
              anchor_snippet: "Rain crossed the window while she stayed silent.",
              source_pass: 3,
              issue_family: "scene_structure",
              strategic_lever: "scene_goal_clarity",
              revision_granularity: "scene",
            },
          ],
        },
        {
          key: "dialogue",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Dialogue rationale placeholder.",
          evidence: [{ snippet: '"I know," she said, then looked away.' }],
          recommendations: [
            {
              priority: "medium",
              action: "In dialogue-heavy scenes, inject more dynamic exchanges to drive the narrative.",
              expected_impact: "Improves dialogue quality.",
              anchor_snippet: '"I know," she said, then looked away.',
              source_pass: 3,
              issue_family: "dialogue",
              strategic_lever: "dialogue_exposition_density",
              revision_granularity: "beat",
            },
          ],
        },
        {
          key: "pacing",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Pacing rationale placeholder.",
          evidence: [{ snippet: "She sat still while the clock ticked louder." }],
          recommendations: [
            {
              priority: "medium",
              action: "In slower sections, balance reflective passages with more active scenes.",
              expected_impact: "Improves pacing flow.",
              anchor_snippet: "She sat still while the clock ticked louder.",
              source_pass: 3,
              issue_family: "pacing",
              strategic_lever: "momentum_visibility",
              revision_granularity: "scene",
            },
          ],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, pass1, pass2, "o3");

    const characterRec = parsed.criteria.find((c) => c.key === "character")?.recommendations?.[0];
    const sceneRec = parsed.criteria.find((c) => c.key === "sceneConstruction")?.recommendations?.[0];
    const dialogueRec = parsed.criteria.find((c) => c.key === "dialogue")?.recommendations?.[0];
    const pacingRec = parsed.criteria.find((c) => c.key === "pacing")?.recommendations?.[0];

    expect(characterRec?.action.toLowerCase()).toContain("deepen character development");
    expect(characterRec?.action.toLowerCase()).toMatch(/decision beat|desire-vs-fear contradiction/);

    expect(sceneRec?.action.toLowerCase()).toContain("streamline descriptive passages");
    expect(sceneRec?.action.toLowerCase()).toMatch(/split|move/);

    expect(dialogueRec?.action.toLowerCase()).toContain("inject more dynamic exchanges");
    expect(dialogueRec?.action.toLowerCase()).toMatch(/two short turns|interruption beat/);

    expect(pacingRec?.action.toLowerCase()).toContain("balance reflective passages");
    expect(pacingRec?.action.toLowerCase()).toMatch(/cut|insert/);
  });

  test("does not auto-repair anchorless generic recommendation and QG still fails", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "dialogue",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Dialogue rationale placeholder.",
          evidence: [{ snippet: '"I know," she said.' }],
          recommendations: [
            {
              priority: "medium",
              action: "In dialogue-heavy scenes, inject more dynamic exchanges to drive the narrative.",
              expected_impact: "Improves dialogue quality.",
              anchor_snippet: "",
              source_pass: 3,
              issue_family: "dialogue",
              strategic_lever: "dialogue_exposition_density",
              revision_granularity: "beat",
            },
          ],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, pass1, pass2, "o3");
    const rec = parsed.criteria.find((c) => c.key === "dialogue")?.recommendations?.[0];
    expect(rec?.action).toBe("In dialogue-heavy scenes, inject more dynamic exchanges to drive the narrative.");

    const minimalSynthesis = {
      criteria: [
        {
          ...parsed.criteria.find((c) => c.key === "dialogue"),
          key: "dialogue",
        },
      ],
      overall: parsed.overall,
      metadata: parsed.metadata,
      partial_evaluation: false,
    };

    const gate = runQualityGate(minimalSynthesis as any);
    const editorialCheck = gate.checks.find((c) => c.check_id === "recommendation_editorial_quality");
    expect(editorialCheck?.passed).toBe(false);
    expect(editorialCheck?.error_code).toBe("QG_EDITORIAL_GENERIC_FEEDBACK");
  });

  // ─────────────────────────────────────────────────────────────────────
  // Dialogue Attribution v2 Gate: Diagnostic-grounded enforcement tests
  // (FR-2: Real production regression fixture, AC-1 through AC-5)
  // ─────────────────────────────────────────────────────────────────────

  test("dialogue gate: rejects genuinely shallow dialogue praise without mechanism grounding", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    // Simulate a shallow dialogue assessment (true negative)
    const shallowPass1 = {
      ...pass1,
      criteria: pass1.criteria.map((c) =>
        c.key === "dialogue"
          ? { ...c, rationale: "Dialogue is good. Characters speak naturally." }
          : c,
      ),
    };
    const shallowPass2 = {
      ...pass2,
      criteria: pass2.criteria.map((c) =>
        c.key === "dialogue"
          ? { ...c, rationale: "Dialogue quality is nice. Easy to read." }
          : c,
      ),
    };

    const raw = JSON.stringify({
      criteria: [
        {
          key: "dialogue",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Overall the dialogue is good and feels natural.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, shallowPass1, shallowPass2, "o3");
    const dialogue = parsed.criteria.find((c) => c.key === "dialogue");

    // With no manuscript available for diagnostic grounding, should still include mechanism language
    expect(dialogue).toBeDefined();
    expect(dialogue!.final_rationale.toLowerCase()).toMatch(
      /speaker|attribution|tag|beat|quote|turn-taking|turn taking|rendering/,
    );
  });

  test("dialogue gate: accepts rationale with valid craft vocabulary (non-exact keyword matching)", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    // Simulate good dialogue analysis using broader craft vocabulary
    const craftPass1 = {
      ...pass1,
      criteria: pass1.criteria.map((c) =>
        c.key === "dialogue"
          ? {
              ...c,
              rationale:
                "Dialogue rendering is controlled through inter-speaker turn-taking rhythm, preserving speaker clarity without mechanical tags.",
            }
          : c,
      ),
    };
    const craftPass2 = {
      ...pass2,
      criteria: pass2.criteria.map((c) =>
        c.key === "dialogue"
          ? {
              ...c,
              rationale:
                "Speaker voices are differentiated through reported speech patterns and action-beat adjacency, creating implicit attribution.",
            }
          : c,
      ),
    };

    const raw = JSON.stringify({
      criteria: [
        {
          key: "dialogue",
          craft_score: 8,
          editorial_score: 8,
          final_score_0_10: 8,
          final_rationale:
            "The dialogue relies on implicit attribution through alternating speaker turns and action-beat rendering, maintaining clarity without mechanical tags.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 78,
        verdict: "pass",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "dialogue", "character"],
        top_3_risks: [],
        submission_readiness: "queryable_now",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, craftPass1, craftPass2, "o3");
    const dialogue = parsed.criteria.find((c) => c.key === "dialogue");

    // Rationale includes valid craft vocabulary: "rendering", "turn-taking", "attribution", "action-beat"
    expect(dialogue).toBeDefined();
    expect(dialogue!.final_rationale.toLowerCase()).toMatch(
      /rendering|turn.?taking|attribution|action.?beat|speaker|quote|tag|beat|dialogue/,
    );
  });

  test("dialogue gate: deterministic output across multiple runs (idempotency check for gate determinism)", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const raw = JSON.stringify({
      criteria: [
        {
          key: "dialogue",
          craft_score: 7,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Dialogue is clear and readable.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "close",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    // Parse the same input 5 times to verify deterministic behavior
    const results = Array.from({ length: 5 }, () =>
      parsePass3Response(raw, pass1, pass2, "o3").criteria.find((c) => c.key === "dialogue")!.final_rationale,
    );

    // All results should be identical (deterministic gate decision)
    const [first, ...rest] = results;
    for (const result of rest) {
      expect(result).toBe(first);
    }
  });

  test("dialogue gate: passes when mechanism language is present (keyword pass)", () => {
    const pass1 = makePass(1);
    const pass2 = makePass(2);

    const goodPass1 = {
      ...pass1,
      criteria: pass1.criteria.map((c) =>
        c.key === "dialogue"
          ? {
              ...c,
              rationale:
                "Dialogue uses speaker attribution tags and action beats to maintain clarity without becoming mechanical.",
            }
          : c,
      ),
    };
    const goodPass2 = {
      ...pass2,
      criteria: pass2.criteria.map((c) =>
        c.key === "dialogue"
          ? {
              ...c,
              rationale:
                "Quoted dialogue combines with narrative beats to render speaker identity, creating subtext through turn-taking patterns.",
            }
          : c,
      ),
    };

    const raw = JSON.stringify({
      criteria: [
        {
          key: "dialogue",
          craft_score: 8,
          editorial_score: 8,
          final_score_0_10: 8,
          final_rationale:
            "Both passes identify strong dialogue attribution through tags and beats, with effective subtext via quoted turn-taking.",
          evidence: [],
          recommendations: [],
        },
      ],
      overall: {
        overall_score_0_100: 78,
        verdict: "pass",
        one_paragraph_summary: "Test summary.",
        top_3_strengths: ["dialogue", "voice", "character"],
        top_3_risks: [],
        submission_readiness: "queryable_now",
      },
      metadata: {
        pass1_model: "o3",
        pass2_model: "o3",
        pass3_model: "o3",
      },
    });

    const parsed = parsePass3Response(raw, goodPass1, goodPass2, "o3");
    const dialogue = parsed.criteria.find((c) => c.key === "dialogue");

    expect(dialogue).toBeDefined();
    // Should include mechanism language from synthesis output
    expect(dialogue!.final_rationale.toLowerCase()).toMatch(/tag|beat|quote|turn|attribution|speaker|dialogue/);
  });
});
