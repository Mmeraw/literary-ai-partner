import {
  requireCurrentRecommendationDisposition,
  type RecommendationStatus,
} from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import type {
  CurrentSynthesisOutput,
  CurrentSynthesizedCriterion,
  SynthesisOutput,
  SynthesizedCriterion,
} from "@/lib/evaluation/pipeline/types";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";

type SynthesisRecommendation = SynthesizedCriterion["recommendations"][number];

export type ProcessorSynthesisCriterionPatch = Partial<
  Omit<
    SynthesizedCriterion,
    "key" | "recommendations" | "recommendation_status" | "recommendation_status_rationale"
  >
> & {
  key: CriterionKey;
  recommendations?: SynthesisRecommendation[];
  recommendation_status?: RecommendationStatus;
  recommendation_status_rationale?: string;
};

export type ProcessorSynthesisCriterionMutation = Omit<
  ProcessorSynthesisCriterionPatch,
  "key"
>;

export type ProcessorSynthesisFixtureOverrides = Omit<
  Partial<SynthesisOutput>,
  "criteria" | "overall" | "metadata" | "enrichment"
> & {
  criteria?: readonly ProcessorSynthesisCriterionPatch[];
  mutateCriterion?: (
    criterion: Readonly<CurrentSynthesizedCriterion>,
    index: number,
  ) => ProcessorSynthesisCriterionMutation | undefined;
  overall?: Partial<SynthesisOutput["overall"]>;
  metadata?: Partial<SynthesisOutput["metadata"]>;
  enrichment?: Partial<NonNullable<SynthesisOutput["enrichment"]>>;
};

export const PROCESSOR_SYNTHESIS_CRITERION_TERMS: Record<CriterionKey, string> = {
  concept: "premise",
  narrativeDrive: "propulsion",
  character: "motivation",
  voice: "voice",
  sceneConstruction: "scene",
  dialogue: "dialogue",
  theme: "theme",
  worldbuilding: "world",
  pacing: "pacing",
  proseControl: "prose",
  tone: "tone",
  narrativeClosure: "closure",
  marketability: "market",
};

const EMPTY_DISPOSITION_RATIONALE =
  "The synthesis fixture intentionally provides no supported revision recommendation for this criterion.";

const CRITERION_ISSUE_FAMILY: Record<CriterionKey, SynthesisRecommendation["issue_family"]> = {
  concept: "concept",
  narrativeDrive: "tension",
  character: "characterization",
  voice: "voice",
  sceneConstruction: "scene_structure",
  dialogue: "dialogue",
  theme: "theme",
  worldbuilding: "worldbuilding",
  pacing: "pacing",
  proseControl: "prose_control",
  tone: "exposition",
  narrativeClosure: "closure",
  marketability: "market_positioning",
};

export function processorSynthesisCriterionAnchors(key: CriterionKey) {
  const term = PROCESSOR_SYNTHESIS_CRITERION_TERMS[key];
  return {
    a: `In chapter two, the ${term} signal around ${key} escalates through concrete beat-level evidence.`,
    b: `Later in chapter two, the ${term} pattern for ${key} shifts with explicit consequence and reader-facing pressure.`,
    c: `By chapter three, the ${term} execution for ${key} resolves into a clear causal outcome on the page.`,
  };
}

export function buildProcessorSynthesisManuscriptContent(): string {
  return CRITERIA_KEYS.flatMap((key) => {
    const anchors = processorSynthesisCriterionAnchors(key);
    return [anchors.a, anchors.b, anchors.c];
  }).join(" ");
}

export function buildProcessorSynthesisRecommendations(
  key: CriterionKey,
): SynthesisRecommendation[] {
  const term = PROCESSOR_SYNTHESIS_CRITERION_TERMS[key];
  const anchors = processorSynthesisCriterionAnchors(key);
  return [
    {
      priority: "medium",
      action: `Because the ${term} beat for ${key} currently resolves too quickly, stage one additional line-level turn at the second anchor to preserve causal pressure for the reader.`,
      expected_impact: `Improves ${key} specificity while sustaining momentum, clarity, and reader trust through the revision beat.`,
      anchor_snippet: anchors.b,
      source_pass: 3,
      issue_family: CRITERION_ISSUE_FAMILY[key],
      strategic_lever: "tension_escalation",
      revision_granularity: "beat",
      mechanism: `The ${term} turn resolves before its consequence can accumulate enough pressure.`,
      specific_fix: `Add a beat-level consequence immediately after the ${term} turn at the second anchor.`,
      reader_effect: `The reader can track how the ${term} choice changes the scene instead of experiencing an abrupt resolution.`,
      symptom: `The ${term} pressure dissipates before the scene establishes a visible consequence.`,
      cause: `The current sequence moves from setup to resolution without an intervening consequence beat.`,
      rationale: `The second anchor contains the clearest location for preserving the existing voice while extending causal pressure.`,
      fix_direction: `Stage one consequence beat at the second anchor before the scene advances.`,
      mistake_proofing: `Preserve the existing voice and do not add exposition outside the anchored scene turn.`,
    },
    {
      priority: "low",
      action: `Strengthen the ${term} foundation for ${key} by adding a preparatory beat at the first anchor to establish stakes before the escalation.`,
      expected_impact: `Deepens ${key} grounding through earlier setup, giving the reader more context for the payoff.`,
      anchor_snippet: anchors.a,
      source_pass: 3,
      issue_family: CRITERION_ISSUE_FAMILY[key],
      strategic_lever: "scene_goal_clarity",
      revision_granularity: "beat",
      mechanism: `The first ${term} signal arrives before the scene makes its immediate stakes explicit.`,
      specific_fix: `Add one preparatory beat beside the first anchor that establishes the immediate stake.`,
      reader_effect: `The reader understands why the later ${term} escalation matters before it arrives.`,
      symptom: `The early ${term} beat lacks enough setup for its later payoff to carry full weight.`,
      cause: `The scene introduces the signal before establishing the consequence attached to it.`,
      rationale: `The first anchor is the earliest manuscript-grounded location where the missing setup can be restored.`,
      fix_direction: `Establish the immediate stake at the first anchor without adding a new subplot.`,
      mistake_proofing: `Keep the addition bounded to one beat and preserve the manuscript's existing pacing and tone.`,
    },
  ];
}

function defaultCriterion(key: CriterionKey): SynthesizedCriterion {
  const score = key === "pacing" || key === "theme" ? 4 : 5;
  const term = PROCESSOR_SYNTHESIS_CRITERION_TERMS[key];
  const anchors = processorSynthesisCriterionAnchors(key);
  return {
    key,
    craft_score: score,
    editorial_score: score,
    final_score_0_10: score,
    score_delta: 0,
    final_rationale:
      `The ${term} handling for ${key} is observable because the manuscript shows causal movement between setup, pressure, and consequence in distinct scene anchors.`,
    fit_summary: `The manuscript establishes a visible ${term} pattern across multiple scene anchors.`,
    gap_summary: `The ${term} execution would benefit from one more causal turn before the consequence lands.`,
    pressure_points: [anchors.a, anchors.b],
    decision_points: [anchors.b],
    consequence_status: "landed",
    evidence: [
      { snippet: anchors.a },
      { snippet: anchors.b },
      { snippet: anchors.c },
    ],
    recommendations: [],
    recommendation_status: "no_recommendation_warranted",
    recommendation_status_rationale: EMPTY_DISPOSITION_RATIONALE,
  };
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function applyPatch(
  criterion: SynthesizedCriterion,
  patch: ProcessorSynthesisCriterionMutation | ProcessorSynthesisCriterionPatch | undefined,
): SynthesizedCriterion {
  if (!patch) return criterion;

  const recommendationsChanged = hasOwn(patch, "recommendations");
  const statusProvided = hasOwn(patch, "recommendation_status");
  const rationaleProvided = hasOwn(patch, "recommendation_status_rationale");
  const next: SynthesizedCriterion = {
    ...criterion,
    ...patch,
    key: criterion.key,
  };

  if (recommendationsChanged && !statusProvided) {
    if (next.recommendations.length > 0) {
      next.recommendation_status = "recommendation_provided";
      if (!rationaleProvided) delete next.recommendation_status_rationale;
    } else {
      next.recommendation_status = "no_recommendation_warranted";
      if (!rationaleProvided) {
        next.recommendation_status_rationale = EMPTY_DISPOSITION_RATIONALE;
      }
    }
  }

  return next;
}

function buildCurrentCriterion(
  key: CriterionKey,
  patch: ProcessorSynthesisCriterionPatch | undefined,
  mutation: ProcessorSynthesisCriterionMutation | undefined,
): CurrentSynthesizedCriterion {
  const patched = applyPatch(applyPatch(defaultCriterion(key), patch), mutation);
  return requireCurrentRecommendationDisposition(patched, {
    score: patched.final_score_0_10,
    context: `processor_synthesis_fixture:${key}`,
  });
}

/**
 * Single strict construction authority for processor integration-test Pass 3 outputs.
 *
 * The factory always builds all 13 criteria, rejects duplicate override identities,
 * and re-derives governed disposition metadata whenever a bounded mutation changes
 * recommendation cardinality. Tests cannot accidentally preserve a stale
 * `recommendation_provided` status after clearing recommendations.
 */
export function makeCurrentProcessorSynthesisOutput(
  overrides: ProcessorSynthesisFixtureOverrides = {},
): CurrentSynthesisOutput {
  const {
    criteria: criterionPatches,
    mutateCriterion,
    overall: overallOverrides,
    metadata: metadataOverrides,
    enrichment: enrichmentOverrides,
    ...synthesisOverrides
  } = overrides;
  const byKey = new Map<CriterionKey, ProcessorSynthesisCriterionPatch>();
  for (const patch of criterionPatches ?? []) {
    if (byKey.has(patch.key)) {
      throw new Error(`Duplicate processor synthesis fixture criterion override: ${patch.key}`);
    }
    byKey.set(patch.key, patch);
  }

  const criteria = CRITERIA_KEYS.map((key, index) => {
    const base = buildCurrentCriterion(key, byKey.get(key), undefined);
    const mutation = mutateCriterion?.(base, index);
    return buildCurrentCriterion(key, byKey.get(key), mutation);
  });

  return {
    ...synthesisOverrides,
    criteria,
    overall: {
      overall_score_0_100: 74,
      verdict: "revise",
      one_sentence_pitch:
        "A craft-focused manuscript tests whether scene-level pressure can sustain reader trust across all thirteen criteria.",
      one_paragraph_pitch:
        "A craft-focused manuscript follows scene-by-scene pressure shifts, character decisions, and consequence tracking to test whether execution can support a complete RevisionGrade evaluation. As weaknesses in pacing and theme emerge, the revision path asks whether targeted evidence-anchored repairs can convert promising material into submission-ready narrative coherence.",
      one_paragraph_summary:
        "The manuscript demonstrates measurable craft with targeted revision opportunities, with pacing and theme as the weakest criteria requiring focused revision.",
      top_3_strengths: [
        "Distinctive authorial voice with tonal authority across scenes.",
        "Character motivation is grounded in concrete scene-level decisions.",
        "Dialogue carries subtext and advances conflict naturally.",
      ],
      top_3_risks: [
        "Pacing stalls in mid-section transitions between major scenes.",
        "Thematic integration relies on repetition rather than escalation.",
        "Narrative closure leaves key causal threads unresolved for the reader.",
      ],
      submission_readiness: "nearly_ready",
      ...overallOverrides,
    },
    metadata: {
      pass1_model: "gpt-4o",
      pass2_model: "o3",
      pass3_model: "o3",
      generated_at: "2026-07-20T00:00:00.000Z",
      ...metadataOverrides,
    },
    partial_evaluation: overrides.partial_evaluation ?? false,
    enrichment: {
      premise:
        "A manuscript exploring craft fundamentals across thirteen criteria with targeted revision opportunities in pacing and thematic integration.",
      diagnosed_genre: "literary fiction",
      target_audience:
        "Adult readers of character-driven literary fiction with interest in craft-forward narrative.",
      ...enrichmentOverrides,
    },
  };
}
