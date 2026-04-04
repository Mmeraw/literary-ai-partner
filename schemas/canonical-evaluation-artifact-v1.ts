/**
 * CanonicalEvaluationArtifact v1 — Runtime Validator
 */

import type {
  CanonicalEvaluationArtifact,
  CriterionAssessment,
  EvidenceAnchor,
} from "../lib/jobs/finalize.types";

export class CanonicalEvaluationArtifactValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(`[CanonicalArtifact:${field}] ${message}`);
    this.name = "CanonicalEvaluationArtifactValidationError";
  }
}

function assertObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new CanonicalEvaluationArtifactValidationError(path, "must be an object");
  }
}

function validateEvidenceAnchor(anchor: unknown, path: string): asserts anchor is EvidenceAnchor {
  assertObject(anchor, path);

  if (typeof anchor.anchor_id !== "string" || anchor.anchor_id.length === 0) {
    throw new CanonicalEvaluationArtifactValidationError(`${path}.anchor_id`, "must be a non-empty string");
  }

  if (!["manuscript_chunk", "manuscript_span", "criterion_note"].includes(String(anchor.source_type))) {
    throw new CanonicalEvaluationArtifactValidationError(`${path}.source_type`, `invalid value: ${anchor.source_type}`);
  }

  if (typeof anchor.source_ref !== "string" || anchor.source_ref.length === 0) {
    throw new CanonicalEvaluationArtifactValidationError(`${path}.source_ref`, "must be a non-empty string");
  }
}

function validateCriterionAssessment(criterion: unknown, path: string): asserts criterion is CriterionAssessment {
  assertObject(criterion, path);

  if (typeof criterion.criterion_id !== "string" || criterion.criterion_id.length === 0) {
    throw new CanonicalEvaluationArtifactValidationError(`${path}.criterion_id`, "must be a non-empty string");
  }

  if (typeof criterion.score_0_10 !== "number" || criterion.score_0_10 < 0 || criterion.score_0_10 > 10) {
    throw new CanonicalEvaluationArtifactValidationError(`${path}.score_0_10`, "must be a number in [0, 10]");
  }

  if (typeof criterion.rationale !== "string") {
    throw new CanonicalEvaluationArtifactValidationError(`${path}.rationale`, "must be a string");
  }

  if (typeof criterion.confidence_0_1 !== "number" || criterion.confidence_0_1 < 0 || criterion.confidence_0_1 > 1) {
    throw new CanonicalEvaluationArtifactValidationError(`${path}.confidence_0_1`, "must be a number in [0, 1]");
  }

  if (!Array.isArray(criterion.evidence)) {
    throw new CanonicalEvaluationArtifactValidationError(`${path}.evidence`, "must be an array");
  }

  criterion.evidence.forEach((anchor, index) => {
    validateEvidenceAnchor(anchor, `${path}.evidence[${index}]`);
  });

  if (!Array.isArray(criterion.warnings)) {
    throw new CanonicalEvaluationArtifactValidationError(`${path}.warnings`, "must be an array");
  }
}

export function validateCanonicalEvaluationArtifact(raw: unknown): CanonicalEvaluationArtifact {
  assertObject(raw, "root");

  for (const requiredString of ["id", "job_id", "schema_version", "generated_at"] as const) {
    if (typeof raw[requiredString] !== "string" || raw[requiredString].length === 0) {
      throw new CanonicalEvaluationArtifactValidationError(requiredString, "must be a non-empty string");
    }
  }

  assertObject(raw.source, "source");
  for (const sourceField of [
    "pass1_artifact_id",
    "pass2_artifact_id",
    "pass3_artifact_id",
    "convergence_artifact_id",
  ] as const) {
    if (typeof raw.source[sourceField] !== "string" || raw.source[sourceField].length === 0) {
      throw new CanonicalEvaluationArtifactValidationError(`source.${sourceField}`, "must be a non-empty string");
    }
  }

  assertObject(raw.overview, "overview");
  if (
    typeof raw.overview.overall_score_0_100 !== "number"
    || raw.overview.overall_score_0_100 < 0
    || raw.overview.overall_score_0_100 > 100
  ) {
    throw new CanonicalEvaluationArtifactValidationError("overview.overall_score_0_100", "must be a number in [0, 100]");
  }

  if (typeof raw.overview.verdict !== "string" || raw.overview.verdict.length === 0) {
    throw new CanonicalEvaluationArtifactValidationError("overview.verdict", "must be a non-empty string");
  }

  if (typeof raw.overview.one_paragraph_summary !== "string") {
    throw new CanonicalEvaluationArtifactValidationError("overview.one_paragraph_summary", "must be a string");
  }

  if (!Array.isArray(raw.overview.top_strengths)) {
    throw new CanonicalEvaluationArtifactValidationError("overview.top_strengths", "must be an array");
  }

  if (!Array.isArray(raw.overview.top_risks)) {
    throw new CanonicalEvaluationArtifactValidationError("overview.top_risks", "must be an array");
  }

  if (!Array.isArray(raw.criteria)) {
    throw new CanonicalEvaluationArtifactValidationError("criteria", "must be an array");
  }

  raw.criteria.forEach((criterion, index) => {
    validateCriterionAssessment(criterion, `criteria[${index}]`);
  });

  assertObject(raw.governance, "governance");
  if (
    typeof raw.governance.confidence_0_1 !== "number"
    || raw.governance.confidence_0_1 < 0
    || raw.governance.confidence_0_1 > 1
  ) {
    throw new CanonicalEvaluationArtifactValidationError("governance.confidence_0_1", "must be a number in [0, 1]");
  }

  for (const governanceArrayField of ["warnings", "limitations"] as const) {
    if (!Array.isArray(raw.governance[governanceArrayField])) {
      throw new CanonicalEvaluationArtifactValidationError(`governance.${governanceArrayField}`, "must be an array");
    }
  }

  for (const governanceBooleanField of [
    "transparency_passed",
    "anchor_contract_passed",
    "canonical_ready",
  ] as const) {
    if (typeof raw.governance[governanceBooleanField] !== "boolean") {
      throw new CanonicalEvaluationArtifactValidationError(`governance.${governanceBooleanField}`, "must be a boolean");
    }
  }

  assertObject(raw.eligibility, "eligibility");

  for (const eligibilityFlag of [
    "structural_pass",
    "refinement_unlocked",
    "wave_unlocked",
    "submission_packaging_unlocked",
  ] as const) {
    if (typeof raw.eligibility[eligibilityFlag] !== "boolean") {
      throw new CanonicalEvaluationArtifactValidationError(`eligibility.${eligibilityFlag}`, "must be a boolean");
    }
  }

  if (raw.eligibility.reason !== null && typeof raw.eligibility.reason !== "string") {
    throw new CanonicalEvaluationArtifactValidationError("eligibility.reason", "must be a string or null");
  }

  assertObject(raw.provenance, "provenance");
  for (const provenanceField of ["evaluator_version", "run_id", "finalizer_version"] as const) {
    if (typeof raw.provenance[provenanceField] !== "string" || raw.provenance[provenanceField].length === 0) {
      throw new CanonicalEvaluationArtifactValidationError(`provenance.${provenanceField}`, "must be a non-empty string");
    }
  }

  if (raw.provenance.prompt_pack_version !== null && typeof raw.provenance.prompt_pack_version !== "string") {
    throw new CanonicalEvaluationArtifactValidationError("provenance.prompt_pack_version", "must be a string or null");
  }

  return raw as unknown as CanonicalEvaluationArtifact;
}
