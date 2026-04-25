import type { CriterionKey } from "@/schemas/criteria-keys";
import type { AdvisoryLane, AdvisoryPlanItem, AdvisorySeverity } from "./types";

const HARD_BLOCK_THRESHOLD = 5;
const SOFT_BLOCK_THRESHOLD = 6;

const ADVISORY_LANES: Record<
  CriterionKey,
  { lane: AdvisoryLane; scope: AdvisoryPlanItem["requiredRevisionScope"] }
> = {
  concept: {
    lane: "clarify_premise_hook",
    scope: "chapter",
  },
  narrativeDrive: {
    lane: "increase_escalation_consequence",
    scope: "scene",
  },
  character: {
    lane: "deepen_character_pressure",
    scope: "scene",
  },
  voice: {
    lane: "tighten_voice_control",
    scope: "line",
  },
  sceneConstruction: {
    lane: "strengthen_scene_turns",
    scope: "scene",
  },
  dialogue: {
    lane: "increase_dialogue_subtext",
    scope: "beat",
  },
  theme: {
    lane: "dramatize_theme",
    scope: "scene",
  },
  worldbuilding: {
    lane: "sharpen_environmental_function",
    scope: "beat",
  },
  pacing: {
    lane: "compress_pacing_drag",
    scope: "scene",
  },
  proseControl: {
    lane: "tighten_line_level_prose",
    scope: "line",
  },
  tone: {
    lane: "stabilize_tonal_contract",
    scope: "scene",
  },
  narrativeClosure: {
    lane: "strengthen_promise_delivery",
    scope: "chapter",
  },
  marketability: {
    lane: "clarify_market_positioning",
    scope: "manuscript",
  },
};

function severityForScore(score: number): AdvisorySeverity {
  return score <= HARD_BLOCK_THRESHOLD ? "blocking" : "advisory";
}

export function buildAdvisoryPlan(input: {
  criteria: { key: CriterionKey; final_score_0_10: number }[];
}): AdvisoryPlanItem[] {
  return input.criteria
    .filter((criterion) => criterion.final_score_0_10 <= SOFT_BLOCK_THRESHOLD)
    .map((criterion) => {
      const lane = ADVISORY_LANES[criterion.key];

      // Fail-closed guard for future key/map drift.
      if (!lane) {
        throw new Error(`Missing advisory lane for criterion: ${criterion.key}`);
      }

      return {
        criterion: criterion.key,
        score: criterion.final_score_0_10,
        severity: severityForScore(criterion.final_score_0_10),
        advisoryLane: lane.lane,
        requiredRevisionScope: lane.scope,
      };
    });
}
