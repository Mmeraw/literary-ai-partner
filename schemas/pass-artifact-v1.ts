/**
 * PassArtifact v1 — Runtime Validator
 *
 * Validates that a raw object conforms to the PassArtifact contract.
 * Throws a descriptive error for any violation; returns typed value on success.
 */

import type { PassArtifact, EvidenceAnchor, CriterionAssessment } from "../lib/jobs/finalize.types";

export class PassArtifactValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(`[PassArtifact:${field}] ${message}`);
    this.name = "PassArtifactValidationError";
  }
}

function validateEvidenceAnchor(anchor: unknown, path: string): asserts anchor is EvidenceAnchor {
  if (typeof anchor !== "object" || anchor === null) {
    throw new PassArtifactValidationError(path, "must be an object");
  }
  const a = anchor as Record<string, unknown>;
  if (typeof a.anchor_id !== "string" || !a.anchor_id) {
    throw new PassArtifactValidationError(`${path}.anchor_id`, "must be a non-empty string");
  }
  if (!["manuscript_chunk", "manuscript_span", "criterion_note"].includes(a.source_type as string)) {
    throw new PassArtifactValidationError(`${path}.source_type`, `invalid value: ${a.source_type}`);
  }
  if (typeof a.source_ref !== "string" || !a.source_ref) {
    throw new PassArtifactValidationError(`${path}.source_ref`, "must be a non-empty string");
  }
}

function validateCriterionAssessment(criterion: unknown, path: string): asserts criterion is CriterionAssessment {
  if (typeof criterion !== "object" || criterion === null) {
    throw new PassArtifactValidationError(path, "must be an object");
  }
  const c = criterion as Record<string, unknown>;
  if (typeof c.criterion_id !== "string" || !c.criterion_id) {
    throw new PassArtifactValidationError(`${path}.criterion_id`, "must be a non-empty string");
  }
  if (typeof c.score_0_10 !== "number" || c.score_0_10 < 0 || c.score_0_10 > 10) {
    throw new PassArtifactValidationError(`${path}.score_0_10`, "must be a number in [0, 10]");
  }
  if (typeof c.rationale !== "string") {
    throw new PassArtifactValidationError(`${path}.rationale`, "must be a string");
  }
  if (typeof c.confidence_0_1 !== "number" || c.confidence_0_1 < 0 || c.confidence_0_1 > 1) {
    throw new PassArtifactValidationError(`${path}.confidence_0_1`, "must be a number in [0, 1]");
  }
  if (!Array.isArray(c.evidence)) {
    throw new PassArtifactValidationError(`${path}.evidence`, "must be an array");
  }
  (c.evidence as unknown[]).forEach((anchor, i) => validateEvidenceAnchor(anchor, `${path}.evidence[${i}]`));
  if (!Array.isArray(c.warnings)) {
    throw new PassArtifactValidationError(`${path}.warnings`, "must be an array");
  }
}

export function validatePassArtifact(raw: unknown): PassArtifact {
  if (typeof raw !== "object" || raw === null) {
    throw new PassArtifactValidationError("root", "must be an object");
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== "string" || !r.id) {
    throw new PassArtifactValidationError("id", "must be a non-empty string");
  }
  if (typeof r.job_id !== "string" || !r.job_id) {
    throw new PassArtifactValidationError("job_id", "must be a non-empty string");
  }
  if (!["pass1", "pass2", "pass3"].includes(r.pass_id as string)) {
    throw new PassArtifactValidationError("pass_id", `invalid value: ${r.pass_id}`);
  }
  if (typeof r.schema_version !== "string" || !r.schema_version) {
    throw new PassArtifactValidationError("schema_version", "must be a non-empty string");
  }
  if (typeof r.manuscript_revision_id !== "string" || !r.manuscript_revision_id) {
    throw new PassArtifactValidationError("manuscript_revision_id", "must be a non-empty string");
  }
  if (typeof r.generated_at !== "string" || !r.generated_at) {
    throw new PassArtifactValidationError("generated_at", "must be a non-empty string");
  }
  if (typeof r.summary !== "string") {
    throw new PassArtifactValidationError("summary", "must be a string");
  }
  if (!Array.isArray(r.criteria)) {
    throw new PassArtifactValidationError("criteria", "must be an array");
  }
  (r.criteria as unknown[]).forEach((c, i) => validateCriterionAssessment(c, `criteria[${i}]`));

  // Provenance
  if (typeof r.provenance !== "object" || r.provenance === null) {
    throw new PassArtifactValidationError("provenance", "must be an object");
  }
  const prov = r.provenance as Record<string, unknown>;
  if (typeof prov.evaluator_version !== "string" || !prov.evaluator_version) {
    throw new PassArtifactValidationError("provenance.evaluator_version", "must be a non-empty string");
  }
  if (typeof prov.run_id !== "string" || !prov.run_id) {
    throw new PassArtifactValidationError("provenance.run_id", "must be a non-empty string");
  }

  // Validations block
  if (typeof r.validations !== "object" || r.validations === null) {
    throw new PassArtifactValidationError("validations", "must be an object");
  }
  const v = r.validations as Record<string, unknown>;
  for (const flag of ["schema_valid", "anchor_contract_valid", "evidence_nonempty", "orphan_reasoning_absent"]) {
    if (typeof v[flag] !== "boolean") {
      throw new PassArtifactValidationError(`validations.${flag}`, "must be a boolean");
    }
  }

  return raw as unknown as PassArtifact;
}
