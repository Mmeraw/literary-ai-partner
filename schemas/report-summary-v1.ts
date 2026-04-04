/**
 * ReportSummaryProjection v1 — Runtime Validator
 */

import type { ReportSummaryProjection } from "../lib/jobs/finalize.types";

export class ReportSummaryValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(`[ReportSummary:${field}] ${message}`);
    this.name = "ReportSummaryValidationError";
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ReportSummaryValidationError(field, "must be a non-empty string");
  }
}

function assertBoolean(value: unknown, field: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new ReportSummaryValidationError(field, "must be a boolean");
  }
}

export function validateReportSummary(raw: unknown): ReportSummaryProjection {
  if (typeof raw !== "object" || raw === null) {
    throw new ReportSummaryValidationError("root", "must be an object");
  }

  const r = raw as Record<string, unknown>;

  for (const requiredStringField of [
    "id",
    "job_id",
    "user_id",
    "canonical_artifact_id",
    "generated_at",
    "verdict",
    "one_paragraph_summary",
  ] as const) {
    assertString(r[requiredStringField], requiredStringField);
  }

  if (
    typeof r.overall_score_0_100 !== "number"
    || r.overall_score_0_100 < 0
    || r.overall_score_0_100 > 100
  ) {
    throw new ReportSummaryValidationError("overall_score_0_100", "must be a number in [0, 100]");
  }

  if (typeof r.confidence_0_1 !== "number" || r.confidence_0_1 < 0 || r.confidence_0_1 > 1) {
    throw new ReportSummaryValidationError("confidence_0_1", "must be a number in [0, 1]");
  }

  if (typeof r.warnings_count !== "number" || !Number.isInteger(r.warnings_count) || r.warnings_count < 0) {
    throw new ReportSummaryValidationError("warnings_count", "must be a non-negative integer");
  }

  if (!Array.isArray(r.top_3_strengths)) {
    throw new ReportSummaryValidationError("top_3_strengths", "must be an array");
  }

  if (!Array.isArray(r.top_3_risks)) {
    throw new ReportSummaryValidationError("top_3_risks", "must be an array");
  }

  for (const boolField of [
    "structural_pass",
    "refinement_unlocked",
    "wave_unlocked",
    "submission_packaging_unlocked",
  ] as const) {
    assertBoolean(r[boolField], boolField);
  }

  return raw as ReportSummaryProjection;
}
