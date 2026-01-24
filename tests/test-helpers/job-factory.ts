/**
 * Test helper: Create properly-typed mock EvaluationJobRow instances
 * Ensures tests use realistic job data without casting
 */

import type { EvaluationJobRow } from "../../lib/db/schema";

/**
 * Extended overrides type that includes test-only helper fields
 */
type JobFactoryOverrides = Partial<EvaluationJobRow> & {
  ageMs?: number; // test-only: milliseconds in the past for created_at calculation
};

/**
 * Build a valid EvaluationJobRow with sensible defaults
 * Allows overriding specific fields while maintaining schema compliance
 *
 * @param overrides Partial EvaluationJobRow + test helpers to override defaults
 * @returns Complete, valid EvaluationJobRow
 */
export function makeJobRow(
  overrides: JobFactoryOverrides = {}
): EvaluationJobRow {
  const now = new Date();
  const createdAt = overrides.created_at
    ? new Date(overrides.created_at)
    : new Date(now.getTime() - (overrides.ageMs ?? 0));

  return {
    id: overrides.id ?? `job-${Math.random().toString(36).slice(2, 9)}`,
    user_id: overrides.user_id ?? "test-user",
    status: overrides.status ?? "running",
    created_at: createdAt.toISOString(),
    updated_at: overrides.updated_at ?? createdAt.toISOString(),
    job_type: overrides.job_type ?? "evaluation",
    submission_id: overrides.submission_id ?? "test-submission",

    // Phase 1: Status reflects the job's overall status
    // Running job → phase is running, Complete job → phase is complete
    phase_1_status:
      overrides.phase_1_status ??
      (overrides.status === "running"
        ? "running"
        : overrides.status === "complete"
          ? "complete"
          : "failed"),
    phase_1_result: overrides.phase_1_result ?? null,
    phase_1_error: overrides.phase_1_error ?? null,

    // Phase 2: Not usually active during Phase 1 polling
    phase_2_status: overrides.phase_2_status ?? null,
    phase_2_result: overrides.phase_2_result ?? null,
    phase_2_error: overrides.phase_2_error ?? null,

    metadata: overrides.metadata ?? {},
  };
}

/**
 * Helper: Create a job row with a specific age in milliseconds
 * Cleaner than calculating timestamps manually in tests
 *
 * @param ageMs Job age in milliseconds
 * @param status Job status (defaults to "running")
 * @returns EvaluationJobRow with the specified age
 */
export function makeJobRowWithAge(
  ageMs: number,
  status: EvaluationJobRow["status"] = "running"
): EvaluationJobRow {
  return makeJobRow({
    status,
    created_at: new Date(Date.now() - ageMs).toISOString(),
    phase_1_status:
      status === "running"
        ? "running"
        : status === "complete"
          ? "complete"
          : "failed",
  });
}
