export type A6CriterionName =
  | "narrative_cohesion"
  | "character_consistency"
  | "tone_consistency"
  | "proseControl";

export type A6ProvenanceEntry = {
  anchor_id: string;
  start_offset: number;
  end_offset: number;
  source_excerpt: string;
  used_for: A6CriterionName[];
};

export type A6CriterionReport = {
  name: A6CriterionName;
  score: number;
  max_score: number;
  reasoning: string;
  evidence_refs: string[];
  confidence: number;
};

export type A6OverallReport = {
  score: number;
  confidence: number;
  summary: string;
};

export type A6Metadata = {
  commit_sha: string;
  model_version: string;
  generated_at: string;
};

export type A6EvaluationReport = {
  evaluation_id: string;
  criteria: A6CriterionReport[];
  overall: A6OverallReport;
  provenance: A6ProvenanceEntry[];
  metadata: A6Metadata;
};

export type A6AnchorLike = {
  anchor_id: string;
  start_offset: number;
  end_offset: number;
  source_excerpt: string;
};

export type A6CriterionInput = {
  name: A6CriterionName;
  score: number;
  max_score: number;
  reasoning: string;
  evidence_refs: string[];
};

export type A6BuildInput = {
  evaluation_id: string;
  criteria: A6CriterionInput[];
  anchors: A6AnchorLike[];
  source_text: string;
  commit_sha: string;
  model_version: string;
};
