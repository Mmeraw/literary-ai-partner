/**
 * Single source of truth for phase → DB timestamp column mapping.
 *
 * The evaluation_jobs table physically has these timestamp columns:
 *   - phase1_started_at     (written when phase_1a begins running)
 *   - phase1_completed_at   (written when phase_1a finishes / phase_2 begins)
 *   - phase2_started_at     (written when phase_2 begins running)
 *   - phase2_completed_at   (written when phase_2 finishes)
 *
 * The following do NOT exist as DB columns and must NEVER be written
 * in top-level Supabase update payloads (progress JSONB only):
 *   - phase1a_started_at, phase1a_completed_at
 *   - phase3_started_at,  phase3_completed_at
 *
 * If you need new timestamp columns, add a migration AND update this file
 * in the same commit. The schema-guard test (phaseTimestamps.schema.test.ts)
 * will fail CI otherwise.
 */

export type PhaseName = 'phase_1a' | 'phase_2' | 'phase_3';

/** Columns that physically exist on evaluation_jobs for phase timestamps. */
export const PHASE_TIMESTAMP_COLUMNS = [
  'phase1_started_at',
  'phase1_completed_at',
  'phase2_started_at',
  'phase2_completed_at',
] as const;

export type PhaseTimestampColumn = (typeof PHASE_TIMESTAMP_COLUMNS)[number];

export type PhaseTimestampPatch = Partial<Record<PhaseTimestampColumn, string>>;

/**
 * Returns the DB column patch to write when a phase transitions to RUNNING.
 * Only returns columns that physically exist on evaluation_jobs.
 */
export function getPhaseStartTimestamps(
  phase: PhaseName,
  nowIso: string,
): PhaseTimestampPatch {
  switch (phase) {
    case 'phase_1a':
      return { phase1_started_at: nowIso };
    case 'phase_2':
      // Stamp phase1_completed_at defensively in case the phase_1a terminal
      // write was missed; phase2_started_at is the canonical running mark.
      return {
        phase1_completed_at: nowIso,
        phase2_started_at: nowIso,
      };
    case 'phase_3':
      // phase_3 has no DB timestamp columns — progress JSONB only.
      return {};
    default: {
      const _exhaustive: never = phase;
      void _exhaustive;
      return {};
    }
  }
}

/**
 * Returns the DB column patch to write when a phase transitions to COMPLETE.
 * Only returns columns that physically exist on evaluation_jobs.
 */
export function getPhaseCompleteTimestamps(
  phase: PhaseName,
  nowIso: string,
): PhaseTimestampPatch {
  switch (phase) {
    case 'phase_1a':
      return { phase1_completed_at: nowIso };
    case 'phase_2':
      return { phase2_completed_at: nowIso };
    case 'phase_3':
      // phase_3 has no DB timestamp columns — progress JSONB only.
      return {};
    default: {
      const _exhaustive: never = phase;
      void _exhaustive;
      return {};
    }
  }
}
