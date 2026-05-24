/**
 * Single source of truth for phase → DB timestamp column mapping.
 *
 * The evaluation_jobs table physically has these timestamp columns:
 *   - phase0_started_at       (written when phase_0 calibration begins)
 *   - phase0_completed_at     (written when phase_0 calibration completes)
 *   - phase1_started_at       (written when phase_1a begins running)
 *   - phase1_completed_at     (written when phase_1a finishes)
 *   - review_gate_entered_at  (written when job enters awaiting_approval)
 *   - review_gate_passed_at   (written when author approves / gate passes)
 *   - phase2_started_at       (written when phase_2 begins running)
 *   - phase2_completed_at     (written when phase_2 finishes)
 *   - phase3_started_at       (written when phase_3 begins running)
 *   - phase3_completed_at     (written when phase_3 finishes / job complete)
 *
 * Generated / computed columns that must NEVER be written directly:
 *   - lease_expires_at  (GENERATED ALWAYS AS (lease_until) — write lease_until instead)
 *
 * If you need new timestamp columns, add a migration AND update this file
 * in the same commit. The schema-guard test (phaseTimestamps.schema.test.ts)
 * will fail CI otherwise.
 *
 * Use buildWritablePatch() to assemble any top-level evaluation_jobs DB update.
 * It strips forbidden columns at the boundary so they can never reach Supabase.
 */

export type PhaseName = 'phase_0' | 'phase_1a' | 'review_gate' | 'phase_2' | 'phase_3';

/** Columns that physically exist on evaluation_jobs for phase timestamps. */
export const PHASE_TIMESTAMP_COLUMNS = [
  'phase0_started_at',
  'phase0_completed_at',
  'phase1_started_at',
  'phase1_completed_at',
  'review_gate_entered_at',
  'review_gate_passed_at',
  'phase2_started_at',
  'phase2_completed_at',
  'phase3_started_at',
  'phase3_completed_at',
] as const;

export type PhaseTimestampColumn = (typeof PHASE_TIMESTAMP_COLUMNS)[number];

export type PhaseTimestampPatch = Partial<Record<PhaseTimestampColumn, string>>;

/**
 * Returns the DB column patch to write when a phase transitions to RUNNING / ENTERED.
 * Only returns columns that physically exist on evaluation_jobs.
 */
export function getPhaseStartTimestamps(
  phase: PhaseName,
  nowIso: string,
): PhaseTimestampPatch {
  switch (phase) {
    case 'phase_0':
      return { phase0_started_at: nowIso };
    case 'phase_1a':
      return { phase1_started_at: nowIso };
    case 'review_gate':
      return { review_gate_entered_at: nowIso };
    case 'phase_2':
      // Stamp phase1_completed_at defensively in case the phase_1a terminal
      // write was missed; phase2_started_at is the canonical running mark.
      return {
        phase1_completed_at: nowIso,
        phase2_started_at: nowIso,
      };
    case 'phase_3':
      return { phase3_started_at: nowIso };
    default: {
      const _exhaustive: never = phase;
      void _exhaustive;
      return {};
    }
  }
}

/**
 * Returns the DB column patch to write when a phase transitions to COMPLETE / PASSED.
 * Only returns columns that physically exist on evaluation_jobs.
 */
export function getPhaseCompleteTimestamps(
  phase: PhaseName,
  nowIso: string,
): PhaseTimestampPatch {
  switch (phase) {
    case 'phase_0':
      return { phase0_completed_at: nowIso };
    case 'phase_1a':
      return { phase1_completed_at: nowIso };
    case 'review_gate':
      return { review_gate_passed_at: nowIso };
    case 'phase_2':
      return { phase2_completed_at: nowIso };
    case 'phase_3':
      return { phase3_completed_at: nowIso };
    default: {
      const _exhaustive: never = phase;
      void _exhaustive;
      return {};
    }
  }
}

// ---------------------------------------------------------------------------
// Forbidden-column guard
// ---------------------------------------------------------------------------

/**
 * Columns that must NEVER appear in a top-level evaluation_jobs DB update payload.
 *
 * - lease_expires_at : GENERATED ALWAYS AS (lease_until) — Postgres rejects any attempt
 *   to write it directly with error 42601.
 * - phase1a_started_at / phase1a_completed_at : do not exist as DB columns.
 *
 * These are tracked in progress JSONB only if needed.
 */
export const FORBIDDEN_PATCH_COLUMNS = [
  'lease_expires_at',
  'phase1a_started_at',
  'phase1a_completed_at',
] as const;

export type ForbiddenPatchColumn = (typeof FORBIDDEN_PATCH_COLUMNS)[number];

/**
 * Strips any forbidden columns from a DB update payload before it reaches Supabase.
 *
 * Call this on every object passed to `.update()` on evaluation_jobs.
 * The return type omits forbidden keys so TypeScript catches attempted
 * re-additions at compile time.
 */
export function buildWritablePatch<T extends Record<string, unknown>>(
  patch: T,
): Omit<T, ForbiddenPatchColumn> {
  const forbidden = new Set<string>(FORBIDDEN_PATCH_COLUMNS);
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (!forbidden.has(key)) {
      result[key] = value;
    } else {
      console.warn(
        `[buildWritablePatch] Stripped forbidden column "${key}" from evaluation_jobs update patch. ` +
        'This column must not be written as a top-level DB column. ' +
        'Track it in progress JSONB or use a writable alias (e.g. lease_until).',
      );
    }
  }
  return result as Omit<T, ForbiddenPatchColumn>;
}
