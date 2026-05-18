import type { CriterionKey } from "@/schemas/criteria-keys";

export type ReportExperienceVerdict = "pass" | "rerender" | "fail_report_polish";

export type ReportExperienceScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReportExperienceScores {
  authorFeelsSeen: ReportExperienceScore;
  candorWithoutCruelty: ReportExperienceScore;
  recoveryPathClarity: ReportExperienceScore;
  specificityOfGuidance: ReportExperienceScore;
  motivationalEnergy: ReportExperienceScore;
  noFalsePraise: boolean;
  noUnsupportedSuperlatives: boolean;
}

export interface ReportExperienceAudit extends ReportExperienceScores {
  verdict: ReportExperienceVerdict;
  reasons: string[];
}

export interface ReportExperiencePriorityWeakness {
  title: string;
  criterion_key?: CriterionKey;
  chapters?: string[];
  observed_pattern: string;
  effect_on_reader: string;
  recovery_target: string;
  suggested_techniques: string[];
  estimated_gain: string;
}

export interface ReportExperienceChapterRecoveryItem {
  chapter_label: string;
  strengths: string[];
  opportunities: string[];
  smart_objectives: string[];
}

export interface ReportExperienceSmartObjective {
  objective: string;
  measure: string;
  scope: string;
  acceptance_check: string;
}

export interface ReportExperienceRenderedReport {
  executive_evaluation: string;
  core_strengths: string[];
  priority_weaknesses: ReportExperiencePriorityWeakness[];
  chapter_recovery_map: ReportExperienceChapterRecoveryItem[];
  smart_revision_objectives: ReportExperienceSmartObjective[];
}

export interface ReportExperienceV1 {
  schema_version: "report_experience_v1";
  job_id: string;
  manuscript_id: number;
  generated_at: string;
  renderer_model: string;
  auditor_model?: string;
  rendered_report: ReportExperienceRenderedReport;
  experience_audit: ReportExperienceAudit;
}

export function deriveReportExperienceVerdict(
  audit: ReportExperienceScores,
): ReportExperienceVerdict {
  const scores = [
    audit.authorFeelsSeen,
    audit.candorWithoutCruelty,
    audit.recoveryPathClarity,
    audit.specificityOfGuidance,
    audit.motivationalEnergy,
  ];

  if (scores.some((score) => score < 2)) {
    return "fail_report_polish";
  }

  if (scores.some((score) => score < 3)) {
    return "rerender";
  }

  if (!audit.noFalsePraise || !audit.noUnsupportedSuperlatives) {
    return "rerender";
  }

  return "pass";
}
