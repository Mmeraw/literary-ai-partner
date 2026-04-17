// lib/evaluation/status.ts
// Canonical lifecycle and validity status module — Item #18
//
// Lifecycle status: where is the job in execution?
// Validity status: is the completed evaluation releasable/trustworthy?
// These are NOT interchangeable.

// --- Lifecycle ---

export const EVALUATION_JOB_STATUSES = [
  "queued",
  "running",
  "complete",
  "failed",
] as const;

export type EvaluationJobStatus = (typeof EVALUATION_JOB_STATUSES)[number];

// --- Validity / Release ---

export const EVALUATION_VALIDITY_STATUSES = [
  "pending",
  "valid",
  "invalid",
  "quarantined",
] as const;

export type EvaluationValidityStatus = (typeof EVALUATION_VALIDITY_STATUSES)[number];

// --- Lookup sets ---

const JOB_STATUS_SET = new Set<string>(EVALUATION_JOB_STATUSES);
const VALIDITY_STATUS_SET = new Set<string>(EVALUATION_VALIDITY_STATUSES);

// --- Normalizers ---

export function normalizeEvaluationJobStatus(
  value: unknown,
): EvaluationJobStatus {
  if (typeof value !== "string") {
    throw new Error(`Invalid evaluation job status: ${String(value)}`);
  }
  const normalized = value.trim().toLowerCase();
  if (!JOB_STATUS_SET.has(normalized)) {
    throw new Error(`Invalid evaluation job status: ${value}`);
  }
  return normalized as EvaluationJobStatus;
}

export function normalizeEvaluationValidityStatus(
  value: unknown,
): EvaluationValidityStatus {
  if (typeof value !== "string") {
    throw new Error(`Invalid evaluation validity status: ${String(value)}`);
  }
  const normalized = value.trim().toLowerCase();
  if (!VALIDITY_STATUS_SET.has(normalized)) {
    throw new Error(`Invalid evaluation validity status: ${value}`);
  }
  return normalized as EvaluationValidityStatus;
}

// --- Transition guard ---

const ALLOWED_TRANSITIONS: Record<EvaluationJobStatus, EvaluationJobStatus[]> = {
  queued: ["running", "failed"],
  running: ["complete", "failed"],
  complete: [],
  failed: [],
};

export function assertValidJobStatusTransition(
  from: EvaluationJobStatus,
  to: EvaluationJobStatus,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(
      `Invalid evaluation job status transition: ${from} -> ${to}`,
    );
  }
}
