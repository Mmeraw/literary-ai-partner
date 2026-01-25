/**
 * EvaluationResult Schema v1
 * 
 * Authoritative result envelope for manuscript evaluations.
 * Used by:
 * - Report page rendering
 * - Package generation (query letters, synopses)
 * - Agent portal previews
 * - Downstream analysis tools
 * 
 * Schema version: evaluation_result_v1
 * Created: 2026-01-25
 */

/**
 * Main evaluation result envelope
 */
export type EvaluationResultV1 = {
  /** Schema version for forward compatibility */
  schema_version: "evaluation_result_v1";

  /** Traceability identifiers */
  ids: {
    /** UUID of the evaluation run */
    evaluation_run_id: string;
    /** UUID of the job that generated this result (if job-driven) */
    job_id?: string;
    /** Manuscript primary key */
    manuscript_id: number;
    /** Project ID (if manuscript belongs to a project) */
    project_id?: number;
    /** User who owns this evaluation */
    user_id: string; // auth.users UUID
  };

  /** Timestamp when evaluation was generated */
  generated_at: string; // ISO 8601

  /** AI engine metadata */
  engine: {
    /** Model identifier (e.g., "gpt-4o", "claude-sonnet-4") */
    model: string;
    /** Provider name */
    provider: "openai" | "anthropic" | "other";
    /** Internal prompt version tag for reproducibility */
    prompt_version: string;
  };

  /** High-level verdict and summary */
  overview: {
    /** Overall assessment */
    verdict: "pass" | "revise" | "fail";
    /** Aggregate score (0-100) */
    overall_score_0_100: number;
    /** One-paragraph executive summary */
    one_paragraph_summary: string;
    /** Top 3 strengths */
    top_3_strengths: string[];
    /** Top 3 risks or concerns */
    top_3_risks: string[];
  };

  /** Detailed criteria evaluation (13 criteria rubric) */
  criteria: Array<{
    /** Criterion identifier */
    key:
      | "concept"
      | "plot"
      | "character"
      | "dialogue"
      | "voice"
      | "pacing"
      | "structure"
      | "theme"
      | "worldbuilding"
      | "stakes"
      | "clarity"
      | "marketability"
      | "craft";
    
    /** Score for this criterion (0-10) */
    score_0_10: number;
    
    /** Short rationale explaining the score */
    rationale: string;
    
    /** Supporting evidence from manuscript */
    evidence: Array<{
      /** Text snippet from manuscript */
      snippet: string;
      /** Location metadata (optional) */
      location?: {
        /** Segment/chunk identifier */
        segment_id?: string;
        /** Character offset start */
        char_start?: number;
        /** Character offset end */
        char_end?: number;
      };
      /** Evaluator's note about this evidence */
      note?: string;
    }>;
    
    /** Specific recommendations for improving this criterion */
    recommendations: Array<{
      /** Priority level */
      priority: "high" | "medium" | "low";
      /** Action to take (imperative form) */
      action: string;
      /** Expected impact if action is taken */
      expected_impact: string;
    }>;
  }>;

  /** Cross-cutting recommendations */
  recommendations: {
    /** Quick wins: low effort, visible impact */
    quick_wins: Array<{
      /** Action to take */
      action: string;
      /** Why this matters */
      why: string;
      /** Effort required */
      effort: "low" | "medium" | "high";
      /** Expected impact */
      impact: "low" | "medium" | "high";
    }>;
    
    /** Strategic revisions: higher effort, fundamental improvements */
    strategic_revisions: Array<{
      /** Action to take */
      action: string;
      /** Why this matters */
      why: string;
      /** Effort required */
      effort: "low" | "medium" | "high";
      /** Expected impact */
      impact: "low" | "medium" | "high";
    }>;
  };

  /** Quantitative metrics */
  metrics: {
    /** Manuscript-level metrics */
    manuscript: {
      /** Total word count */
      word_count?: number;
      /** Total character count */
      char_count?: number;
      /** Detected or declared genre */
      genre?: string;
      /** Target audience */
      target_audience?: string;
    };
    
    /** Processing metrics */
    processing: {
      /** Number of segments/chunks analyzed */
      segment_count?: number;
      /** Estimated tokens processed */
      total_tokens_estimated?: number;
      /** Processing time in milliseconds */
      runtime_ms?: number;
    };
  };

  /** Generated artifacts (outputs from this evaluation) */
  artifacts: Array<{
    /** Artifact type */
    type:
      | "evaluation_report"
      | "query_letter"
      | "synopsis"
      | "one_page"
      | "pitch_deck"
      | "scene_list"
      | "revision_plan";
    
    /** Artifact primary key (UUID or ID) */
    artifact_id: string;
    
    /** Human-readable title */
    title: string;
    
    /** Artifact status */
    status: "ready" | "pending" | "failed";
    
    /** Timestamp when artifact was created */
    created_at?: string; // ISO 8601
  }>;

  /** Governance and confidence metadata */
  governance: {
    /** AI confidence in this evaluation (0.0 - 1.0) */
    confidence: number;
    
    /** Warnings about limitations or edge cases */
    warnings: string[];
    
    /** Known limitations of this evaluation */
    limitations: string[];
    
    /** Policy family used for evaluation */
    policy_family: string; // e.g., "standard", "dark_fiction", "trauma_memoir"
  };
};

/**
 * Type guard to check if an object is a valid EvaluationResultV1
 */
export function isEvaluationResultV1(obj: unknown): obj is EvaluationResultV1 {
  if (!obj || typeof obj !== "object") return false;
  const result = obj as Partial<EvaluationResultV1>;
  
  return (
    result.schema_version === "evaluation_result_v1" &&
    typeof result.ids === "object" &&
    typeof result.overview === "object" &&
    Array.isArray(result.criteria) &&
    Array.isArray(result.artifacts)
  );
}

/**
 * Criteria keys enum for type safety
 */
export const CRITERIA_KEYS = [
  "concept",
  "plot",
  "character",
  "dialogue",
  "voice",
  "pacing",
  "structure",
  "theme",
  "worldbuilding",
  "stakes",
  "clarity",
  "marketability",
  "craft",
] as const;

export type CriterionKey = (typeof CRITERIA_KEYS)[number];

/**
 * Helper type: minimal evaluation result for previews
 */
export type EvaluationResultPreview = Pick<
  EvaluationResultV1,
  "ids" | "generated_at" | "overview"
> & {
  schema_version: "evaluation_result_v1";
};

/**
 * Example validation function
 */
export function validateEvaluationResult(
  result: EvaluationResultV1
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check schema version
  if (result.schema_version !== "evaluation_result_v1") {
    errors.push(`Invalid schema_version: ${result.schema_version}`);
  }

  // Check required IDs
  if (!result.ids.evaluation_run_id) {
    errors.push("Missing ids.evaluation_run_id");
  }
  if (!result.ids.manuscript_id) {
    errors.push("Missing ids.manuscript_id");
  }
  if (!result.ids.user_id) {
    errors.push("Missing ids.user_id");
  }

  // Check overview
  if (!["pass", "revise", "fail"].includes(result.overview.verdict)) {
    errors.push(`Invalid overview.verdict: ${result.overview.verdict}`);
  }
  if (
    typeof result.overview.overall_score_0_100 !== "number" ||
    result.overview.overall_score_0_100 < 0 ||
    result.overview.overall_score_0_100 > 100
  ) {
    errors.push("overview.overall_score_0_100 must be 0-100");
  }

  // Check criteria count
  if (result.criteria.length !== 13) {
    errors.push(`Expected 13 criteria, got ${result.criteria.length}`);
  }

  // Check each criterion
  result.criteria.forEach((criterion, idx) => {
    if (!CRITERIA_KEYS.includes(criterion.key as CriterionKey)) {
      errors.push(`criteria[${idx}].key invalid: ${criterion.key}`);
    }
    if (criterion.score_0_10 < 0 || criterion.score_0_10 > 10) {
      errors.push(`criteria[${idx}].score_0_10 must be 0-10`);
    }
  });

  // Check governance confidence
  if (
    typeof result.governance.confidence !== "number" ||
    result.governance.confidence < 0 ||
    result.governance.confidence > 1
  ) {
    errors.push("governance.confidence must be 0.0-1.0");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
