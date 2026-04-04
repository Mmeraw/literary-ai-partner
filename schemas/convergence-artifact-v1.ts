/**
 * ConvergenceArtifact v1 — Runtime Validator
 */

import type {
  ConvergenceArtifact,
  CriterionAssessment,
  EvidenceAnchor,
} from "../lib/jobs/finalize.types";

export class ConvergenceArtifactValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(`[ConvergenceArtifact:${field}] ${message}`);
    this.name = "ConvergenceArtifactValidationError";
  }
}

function assertObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new ConvergenceArtifactValidationError(path, "must be an object");
  }
}

function validateEvidenceAnchor(anchor: unknown, path: string): asserts anchor is EvidenceAnchor {
  assertObject(anchor, path);

  if (typeof anchor.anchor_id !== "string" || anchor.anchor_id.length === 0) {
    throw new ConvergenceArtifactValidationError(`${path}.anchor_id`, "must be a non-empty string");
  }

  if (!["manuscript_chunk", "manuscript_span", "criterion_note"].includes(String(anchor.source_type))) {
    throw new ConvergenceArtifactValidationError(`${path}.source_type`, `invalid value: ${anchor.source_type}`);
  }

  if (typeof anchor.source_ref !== "string" || anchor.source_ref.length === 0) {
    throw new ConvergenceArtifactValidationError(`${path}.source_ref`, "must be a non-empty string");
  }
}

function validateCriterionAssessment(criterion: unknown, path: string): asserts criterion is CriterionAssessment {
  assertObject(criterion, path);

  if (typeof criterion.criterion_id !== "string" || criterion.criterion_id.length === 0) {
    throw new ConvergenceArtifactValidationError(`${path}.criterion_id`, "must be a non-empty string");
  }

  if (typeof criterion.score_0_10 !== "number" || criterion.score_0_10 < 0 || criterion.score_0_10 > 10) {
    throw new ConvergenceArtifactValidationError(`${path}.score_0_10`, "must be a number in [0, 10]");
  }

  if (typeof criterion.rationale !== "string") {
    throw new ConvergenceArtifactValidationError(`${path}.rationale`, "must be a string");
  }

  if (typeof criterion.confidence_0_1 !== "number" || criterion.confidence_0_1 < 0 || criterion.confidence_0_1 > 1) {
    throw new ConvergenceArtifactValidationError(`${path}.confidence_0_1`, "must be a number in [0, 1]");
  }

  if (!Array.isArray(criterion.evidence)) {
    throw new ConvergenceArtifactValidationError(`${path}.evidence`, "must be an array");
  }

  criterion.evidence.forEach((anchor, index) => {
    validateEvidenceAnchor(anchor, `${path}.evidence[${index}]`);
  });

  if (!Array.isArray(criterion.warnings)) {
    throw new ConvergenceArtifactValidationError(`${path}.warnings`, "must be an array");
  }
}

export function validateConvergenceArtifact(raw: unknown): ConvergenceArtifact {
  assertObject(raw, "root");

  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new ConvergenceArtifactValidationError("id", "must be a non-empty string");
  }

  if (typeof raw.job_id !== "string" || raw.job_id.length === 0) {
    throw new ConvergenceArtifactValidationError("job_id", "must be a non-empty string");
  }

  if (typeof raw.schema_version !== "string" || raw.schema_version.length === 0) {
    throw new ConvergenceArtifactValidationError("schema_version", "must be a non-empty string");
  }

  if (typeof raw.generated_at !== "string" || raw.generated_at.length === 0) {
    throw new ConvergenceArtifactValidationError("generated_at", "must be a non-empty string");
  }

  assertObject(raw.inputs, "inputs");

  if (typeof raw.inputs.pass1_artifact_id !== "string" || raw.inputs.pass1_artifact_id.length === 0) {
    throw new ConvergenceArtifactValidationError("inputs.pass1_artifact_id", "must be a non-empty string");
  }

  if (typeof raw.inputs.pass2_artifact_id !== "string" || raw.inputs.pass2_artifact_id.length === 0) {
    throw new ConvergenceArtifactValidationError("inputs.pass2_artifact_id", "must be a non-empty string");
  }

  if (typeof raw.inputs.pass3_artifact_id !== "string" || raw.inputs.pass3_artifact_id.length === 0) {
    throw new ConvergenceArtifactValidationError("inputs.pass3_artifact_id", "must be a non-empty string");
  }

  if (!Array.isArray(raw.merged_criteria)) {
    throw new ConvergenceArtifactValidationError("merged_criteria", "must be an array");
  }

  raw.merged_criteria.forEach((criterion, index) => {
    validateCriterionAssessment(criterion, `merged_criteria[${index}]`);
  });

  if (typeof raw.overview_summary !== "string") {
    throw new ConvergenceArtifactValidationError("overview_summary", "must be a string");
  }

  for (const listField of ["convergence_notes", "conflicts_detected", "conflicts_resolved"] as const) {
    if (!Array.isArray(raw[listField])) {
      throw new ConvergenceArtifactValidationError(listField, "must be an array");
    }
  }

  assertObject(raw.validations, "validations");

  for (const validationFlag of [
    "schema_valid",
    "pass_separation_preserved",
    "all_required_passes_present",
    "anchor_contract_valid",
  ] as const) {
    if (typeof raw.validations[validationFlag] !== "boolean") {
      throw new ConvergenceArtifactValidationError(`validations.${validationFlag}`, "must be a boolean");
    }
  }

  return raw as unknown as ConvergenceArtifact;
}
