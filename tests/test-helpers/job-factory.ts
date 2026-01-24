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

function derivePhase1Status(
  status: EvaluationJobRow["status"]
): EvaluationJobRow["phase_1_status"] {
  return status === "running" ? "running" : status === "complete" ? "complete" : "failed";
}

/**
 * Build a valid EvaluationJobRow with sensible defaults
 * Allows overriding specific fields while maintaining schema compliance
 *
 * @param overrides Partial EvaluationJobRow + test helpers to override defaults
 * @returns Complete, valid EvaluationJobRow
 */
export function makeJobRow(overrides: JobFactoryOverrides = {}): EvaluationJobRow {
  const now = new Date();
  const createdAt = overrides.created_at
    ? new Date(overrides.created_at)
    : new Date(now.getTime() - (overrides.ageMs ?? 0));

  const status: EvaluationJobRow["status"] = overrides.status ?? "running";

  // Compile-time guard: ensures object literal exactly matches EvaluationJobRow
  // If someone adds a non-existent field, TypeScript will error immediately
  const row: EvaluationJobRow = {
    id: overrides.id ?? `job-${Math.random().toString(36).slice(2, 9)}`,
    manuscript_id: overrides.manuscript_id ?? 1,
    job_type: overrides.job_type ?? "evaluation",
    status,
    progress: overrides.progress ?? null,
    total_units: overrides.total_units ?? null,
    completed_units: overrides.completed_units ?? null,
    failed_units: overrides.failed_units ?? null,
    retry_count: overrides.retry_count ?? null,
    next_retry_at: overrides.next_retry_at ?? null,
    last_error: overrides.last_error ?? null,
    created_at: createdAt.toISOString(),
    updated_at: overrides.updated_at ?? createdAt.toISOString(),
    last_heartbeat: overrides.last_heartbeat ?? null,
    phase: overrides.phase ?? "1",
    work_type: overrides.work_type ?? null,
    policy_family: overrides.policy_family ?? "default",
    voice_preservation_level: overrides.voice_preservation_level ?? "medium",
    english_variant: overrides.english_variant ?? "us",
    phase_1_status: overrides.phase_1_status ?? derivePhase1Status(status),
    phase_1_locked_at: overrides.phase_1_locked_at ?? null,
    phase_1_locked_by: overrides.phase_1_locked_by ?? null,
    phase_1_started_at: overrides.phase_1_started_at ?? null,
    phase_1_completed_at: overrides.phase_1_completed_at ?? null,
    phase_1_attempt_count: overrides.phase_1_attempt_count ?? null,
    phase_1_error: overrides.phase_1_error ?? null,
  };

  return row;
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
    ageMs,
    status,
    phase_1_status: derivePhase1Status(status),
  });
}
