// lib/jobs/types.ts
// Canonical job typing — Phase 0 locked

import { PHASE_1_STATES } from "./phase1";

/**
 * Canonical phases.
 * Explicit, finite, and aligned to implemented state machines.
 * No phantom files.
 */
export const PHASES = {
  PHASE_1: "phase_1",
  PHASE_2: "phase_2",
} as const;

export type Phase = (typeof PHASES)[keyof typeof PHASES];

/**
 * Phase 1 lifecycle states (derived from implementation)
 */
export type Phase1State =
  (typeof PHASE_1_STATES)[keyof typeof PHASE_1_STATES];

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
  return (
    jobType === JOB_TYPES.EVALUATE_QUICK ||
    jobType === JOB_TYPES.EVALUATE_FULL
  );
}

export function assertJobTypeAllowedForPhase(
  phase: Phase,
  jobType: JobType
): void {
  if (phase === PHASES.PHASE_1 && !isPhase1JobType(jobType)) {
    throw new Error(`Job type ${jobType} not allowed in Phase 1.`);
  }
}
