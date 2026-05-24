/**
 * phaseLog — append-only phase transition log in progress JSONB.
 *
 * Produces a `phase_log` array on the job's progress object.
 * Each entry records a stage entering or passing, with a timestamp
 * and the user-facing label. Never mutates past entries.
 *
 * Schema:
 *   progress.phase_log: PhaseLogEntry[]
 *
 * where PhaseLogEntry = {
 *   stage:  string            // internal key e.g. "phase_1a"
 *   label:  string            // user-facing e.g. "Analyzing manuscript"
 *   event:  "entered" | "passed" | "failed"
 *   at:     string            // ISO timestamp
 * }
 *
 * DB timestamp column mapping (canonical source: phaseTimestamps.ts):
 *   phase_0      → phase0_started_at      / phase0_completed_at
 *   phase_1a     → phase1_started_at      / phase1_completed_at
 *   review_gate  → review_gate_entered_at / review_gate_passed_at
 *   phase_2      → phase2_started_at      / phase2_completed_at
 *   phase_3      → phase3_started_at      / phase3_completed_at
 */

export type PhaseLogEvent = "entered" | "passed" | "failed";

export interface PhaseLogEntry {
  stage: string;
  label: string;
  event: PhaseLogEvent;
  at: string;
}

/** Canonical user-facing label for each internal phase key. */
export const PHASE_STAGE_LABELS: Record<string, string> = {
  phase_0:       "Preparing manuscript",
  phase_1a:      "Analyzing manuscript",
  review_gate:   "Story Layer Review",
  phase_2:       "Reconciling passes",
  phase_3:       "Preparing report",
  wave_revision: "Finalizing report",
};

export function getPhaseLabel(phase: string): string {
  return PHASE_STAGE_LABELS[phase] ?? "In progress";
}

/**
 * DB column pairs for each phase — used by the UI to read real timestamps
 * directly from the job row without relying solely on the JSONB log.
 */
export const PHASE_DB_TIMESTAMP_MAP: Record<string, { entered: string; passed: string }> = {
  phase_0:      { entered: "phase0_started_at",       passed: "phase0_completed_at" },
  phase_1a:     { entered: "phase1_started_at",        passed: "phase1_completed_at" },
  review_gate:  { entered: "review_gate_entered_at",   passed: "review_gate_passed_at" },
  phase_2:      { entered: "phase2_started_at",        passed: "phase2_completed_at" },
  phase_3:      { entered: "phase3_started_at",        passed: "phase3_completed_at" },
};

/** Ordered pipeline stages for display — always shown in this sequence. */
export const PIPELINE_STAGE_ORDER: string[] = [
  "phase_0",
  "phase_1a",
  "review_gate",
  "phase_2",
  "phase_3",
];

/**
 * Appends a new entry to an existing phase_log array.
 * Returns a new array — never mutates the input.
 * Safe to call with undefined/null (returns single-entry array).
 */
export function appendPhaseLog(
  existing: PhaseLogEntry[] | undefined | null,
  entry: { stage: string; event: PhaseLogEvent; at: string },
): PhaseLogEntry[] {
  const log: PhaseLogEntry[] = Array.isArray(existing) ? [...existing] : [];
  log.push({
    stage: entry.stage,
    label: getPhaseLabel(entry.stage),
    event: entry.event,
    at: entry.at,
  });
  return log;
}

/**
 * Convenience: build a phase_log patch to merge into a progress update.
 * Pass the current progress object and the new event to record.
 */
export function buildPhaseLogPatch(
  currentProgress: Record<string, unknown>,
  stage: string,
  event: PhaseLogEvent,
  nowIso: string,
): { phase_log: PhaseLogEntry[] } {
  const existing = currentProgress.phase_log as PhaseLogEntry[] | undefined;
  return {
    phase_log: appendPhaseLog(existing, { stage, event, at: nowIso }),
  };
}

/**
 * Reconstruct a phase log from raw DB timestamp columns on a job row.
 * Used when phase_log is absent (jobs that ran before this feature shipped).
 * Returns entries in pipeline order, skipping nulls.
 */
export function reconstructPhaseLogFromTimestamps(
  row: Record<string, unknown>,
): PhaseLogEntry[] {
  const log: PhaseLogEntry[] = [];

  for (const stage of PIPELINE_STAGE_ORDER) {
    const cols = PHASE_DB_TIMESTAMP_MAP[stage];
    if (!cols) continue;

    const enteredAt = row[cols.entered] as string | null | undefined;
    const passedAt  = row[cols.passed]  as string | null | undefined;

    if (enteredAt) {
      log.push({ stage, label: getPhaseLabel(stage), event: "entered", at: enteredAt });
    }
    if (passedAt) {
      log.push({ stage, label: getPhaseLabel(stage), event: "passed",  at: passedAt });
    }
  }

  // Sort by timestamp ascending so display order is always chronological
  log.sort((a, b) => a.at.localeCompare(b.at));

  return log;
}
