import { deriveCriterionConfidence, deriveOverallConfidence } from "./confidence";
import { buildProvenance } from "./provenance";
import type { A6BuildInput, A6EvaluationReport } from "./types";
import { validateA6Report } from "./validateA6Report";

export function buildA6Report(input: A6BuildInput): A6EvaluationReport {
  const provenance = buildProvenance(input.criteria, input.anchors);

  const criteria = input.criteria.map((criterion) => {
    const anchorsForCriterion = input.anchors.filter((anchor) =>
      criterion.evidence_refs.includes(anchor.anchor_id),
    );

    return {
      name: criterion.name,
      score: criterion.score,
      max_score: criterion.max_score,
      reasoning: criterion.reasoning,
      evidence_refs: criterion.evidence_refs,
      confidence: deriveCriterionConfidence(criterion, anchorsForCriterion),
    };
  });

  const overallScore =
    criteria.reduce((sum, criterion) => sum + criterion.score, 0) / criteria.length;

  const overallConfidence = deriveOverallConfidence(
    criteria.map((criterion) => criterion.confidence),
  );

  const report: A6EvaluationReport = {
    evaluation_id: input.evaluation_id,
    criteria,
    overall: {
      score: Number(overallScore.toFixed(2)),
      confidence: overallConfidence,
      summary:
        "A6 credibility layer generated rubric transparency, confidence scoring, and provenance trace.",
    },
    provenance,
    metadata: {
      commit_sha: input.commit_sha,
      model_version: input.model_version,
      generated_at: new Date().toISOString(),
    },
  };

  validateA6Report(report, input.source_text);
  return report;
}
