import type { ComparisonPacket } from "./comparisonPacket";
import type {
  SinglePassOutput,
  Pass3CriteriaCountByState,
  DivergenceDiagnosticArtifact,
  PreSynthesisCriterionState,
} from "./types";
import { collectNgrams, QG_INDEPENDENCE_NGRAM_SIZE } from "./qualityGate";

type BuildDivergenceDiagnosticArtifactArgs = {
  pass1: SinglePassOutput;
  pass2: SinglePassOutput;
  comparisonPacket: ComparisonPacket;
  manuscriptText: string;
  comparisonPacketChars: number;
  pass3CriteriaCountByState: Pass3CriteriaCountByState;
};

function buildCriterionMap(pass: SinglePassOutput): Map<string, SinglePassOutput["criteria"][number]> {
  return new Map(pass.criteria.map((criterion) => [criterion.key, criterion]));
}

function buildRationaleOverlapCount(pass1Rationale: string, pass2Rationale: string): number {
  const pass1Ngrams = new Set(collectNgrams(pass1Rationale, QG_INDEPENDENCE_NGRAM_SIZE));
  const pass2Ngrams = new Set(collectNgrams(pass2Rationale, QG_INDEPENDENCE_NGRAM_SIZE));

  let overlap = 0;
  for (const gram of pass2Ngrams) {
    if (pass1Ngrams.has(gram)) {
      overlap += 1;
    }
  }
  return overlap;
}

function classifyFromScores(craftScore: unknown, editorialScore: unknown): Pass3CriteriaCountByState[keyof Pass3CriteriaCountByState] extends never ? never : "agree" | "soft_divergence" | "hard_divergence" | "missing_or_invalid" {
  if (
    typeof craftScore !== "number" ||
    !Number.isFinite(craftScore) ||
    typeof editorialScore !== "number" ||
    !Number.isFinite(editorialScore)
  ) {
    return "missing_or_invalid";
  }

  const delta = Math.abs(craftScore - editorialScore);
  if (delta <= 1) return "agree";
  if (delta <= 3) return "soft_divergence";
  return "hard_divergence";
}

function tryParseRawResponse(rawResponseText: string): unknown {
  const trimmed = rawResponseText.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Tolerate fenced responses without affecting runtime control flow.
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (!fenceMatch?.[1]) return null;
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      return null;
    }
  }
}

export function derivePass3CriteriaCountByStateFromRawResponse(args: {
  rawResponseText: string;
  fallback: Pass3CriteriaCountByState;
}): Pass3CriteriaCountByState {
  const parsed = tryParseRawResponse(args.rawResponseText);
  if (typeof parsed !== "object" || parsed === null) {
    return args.fallback;
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.criteria)) {
    return args.fallback;
  }

  const counts: Pass3CriteriaCountByState = {
    agree: 0,
    soft_divergence: 0,
    hard_divergence: 0,
    missing_or_invalid: 0,
  };

  for (const item of record.criteria) {
    if (typeof item !== "object" || item === null) {
      counts.missing_or_invalid += 1;
      continue;
    }

    const row = item as Record<string, unknown>;
    const state = classifyFromScores(row.craft_score, row.editorial_score);
    counts[state] += 1;
  }

  return counts;
}

export function buildDivergenceDiagnosticArtifact(
  args: BuildDivergenceDiagnosticArtifactArgs,
): DivergenceDiagnosticArtifact {
  const pass1ByKey = buildCriterionMap(args.pass1);
  const pass2ByKey = buildCriterionMap(args.pass2);

  const preSynthesisState: Record<string, PreSynthesisCriterionState> = {};

  for (const criterion of args.comparisonPacket.criteria) {
    const pass1Criterion = pass1ByKey.get(criterion.key);
    const pass2Criterion = pass2ByKey.get(criterion.key);

    preSynthesisState[criterion.key] = {
      pass1_score: criterion.pass1_score,
      pass2_score: criterion.pass2_score,
      score_delta: criterion.score_delta,
      raw_rationale_overlap_count: buildRationaleOverlapCount(
        String(pass1Criterion?.rationale ?? ""),
        String(pass2Criterion?.rationale ?? ""),
      ),
      apparent_state: criterion.state,
    };
  }

  const pass3Counts: Pass3CriteriaCountByState = args.pass3CriteriaCountByState;

  const preHasDivergence =
    args.comparisonPacket.criteria_count_by_state.soft_divergence > 0 ||
    args.comparisonPacket.criteria_count_by_state.hard_divergence > 0;

  const postAllAgree =
    pass3Counts.agree === args.comparisonPacket.criteria.length &&
    pass3Counts.soft_divergence === 0 &&
    pass3Counts.hard_divergence === 0 &&
    pass3Counts.missing_or_invalid === 0;

  return {
    pass1_pass2_criterion_state_pre_synthesis: preSynthesisState,
    comparison_packet_retained_ratio:
      args.manuscriptText.length > 0
        ? Number((args.comparisonPacketChars / args.manuscriptText.length).toFixed(4))
        : 0,
    pass3_criteria_count_by_state: pass3Counts,
    divergence_collapse_detected: preHasDivergence && postAllAgree,
  };
}
