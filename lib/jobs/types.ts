// lib/jobs/types.ts
// Canonical job typing — Phase 0 locked

import { PHASE_1_STATES } from "./phase1";

/**
 * Canonical phases.
 * Explicit, finite, and aligned to implemented state machines.
 * No phantom files.
 */
export const PHASES = {
  PHASE_0: "phase_0",
  PHASE_1: "phase_1",
  PHASE_2: "phase_2",
} as const;

export type Phase = (typeof PHASES)[keyof typeof PHASES];

/**
 * Phase 1 lifecycle states (derived from implementation)
 */
export type Phase1State = (typeof PHASE_1_STATES)[keyof typeof PHASE_1_STATES];

/**
 * Canonical job types
 */
export const JOB_TYPES = {
  // Phase 1 (locked)
  EVALUATE_QUICK: "evaluate_quick",
  EVALUATE_FULL: "evaluate_full",

  // Phase 2 (expand deliberately)
  WAVE_PASS: "wave_pass",
  SYNOPSIS_GENERATE: "synopsis_generate",
  QUERY_GENERATE: "query_generate",
  STORYGATE_PACKAGE: "storygate_package",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/**
 * Guards
 */
export function isPhase1JobType(jobType: JobType): boolean {
  return jobType === JOB_TYPES.EVALUATE_QUICK || jobType === JOB_TYPES.EVALUATE_FULL;
}

export function assertJobTypeAllowedForPhase(phase: Phase, jobType: JobType): void {
  if (phase === PHASES.PHASE_1 && !isPhase1JobType(jobType)) {
    throw new Error(`Job type ${jobType} not allowed in Phase 1.`);
  }
}

/**
 * JOB_CONTRACT_v1 — CANON status model (binding)
 * Allowed values only: queued, running, complete, failed
 */
export const JOB_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  FAILED: "failed",
  COMPLETE: "complete",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

/**
 * PhaseStatus is canonical JobStatus (or null).
 * Worker contract: selects jobs where status='queued' AND phase_status='queued'.
 */
export type PhaseStatus = JobStatus | null;

/**
 * JOB_CONTRACT_v1 — CANON progress shape (minimum)
 * May include additional keys, but these keys must match meaning.
 * 
 * CANON keys (written by phase1.ts and phase2.ts):
 * - total_units: total work items (chunks)
 * - completed_units: completed work items
 */
export type JobProgress = {
  phase: Phase | null;
  phase_status: PhaseStatus;
  total_units: number | null;
  completed_units: number | null;
  [k: string]: unknown;
};

/**
 * #18.6 canonical validity contract at type layer.
 * Keep aligned with lib/evaluation/status.ts and DB CHECK constraint.
 */
export type JobValidityStatus = "pending" | "valid" | "invalid" | "quarantined";

export type JobRecord = {
  id: string; // uuid
  user_id: string; // ownership: x-user-id from request header
  manuscript_id: number | string; // bigint-as-number in DB, string in tests
  job_type: JobType; // validated at API boundary
  status: JobStatus;

  // Canon progress (truth-first)
  progress: JobProgress | null;

  created_at: string;
  updated_at: string;

  // JOB_CONTRACT_v1 field name
  last_heartbeat: string | null;

  // #18.6b: restore DB/type coherence for validity_status (NOT NULL in DB)
  validity_status: JobValidityStatus;

  // Optional/legacy helpers (do not affect canon truth)
  last_error?: string | null;
  failure_code?: string | null;
  retry_count?: number;
};

export type GetJobApiResponse =
  | { ok: true; job: JobRecord }
  | { ok: false; error: string };

export type Job = JobRecord;
