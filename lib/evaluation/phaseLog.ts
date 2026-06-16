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
 *   label:  string            // user-facing e.g. "Analyzing writing"
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

export type PhaseLogEvent = "entered" | "passed" | "failed" | "containment_bypass" | "phase_0_5a_enhanced_started" | "phase_0_5a_enhanced_completed" | "phase_0_5a_enhanced_failed" | "kick_forward_auto_accepted" | "quality_issue_detected";

export interface PhaseLogEntry {
  stage: string;
  label: string;
  event: PhaseLogEvent;
  at: string;
}

/** Canonical user-facing label for each internal phase key.
 *  Phase Architecture v2 naming (issue #736):
 *  - phase_0       → Phase 0 calibrating
 *  - chunk_routing → Chunk routing / manuscript prep
 *  - phase_1a      → Phase 1A Story Layer reading
 *  - pass_3a_map   → Pass 3A MAP reading
 *  - pass_3a_reduce→ Pass 3A REDUCE
 *  - review_gate   → Review Gate
 *  - phase_2       → Phase 2 Criteria Analysis
 *  - phase_3       → Phase 3B Synthesis
 *  - quality_gate  → Quality Gate
 *  - wave_revision → WAVE Revision
 *  - dream         → DREAM longform
 */
export const PHASE_STAGE_LABELS: Record<string, string> = {
  queued:          "Queued",
  phase_0:         "Phase 0 calibrating",
  chunk_routing:   "Chunk routing / manuscript prep",
  phase_1a:        "Phase 1A Story Layer reading",
  pass_3a_map:     "Pass 3A MAP reading",
  pass_3a_reduce:  "Pass 3A REDUCE",
  review_gate:     "Review Gate",
  phase_2:         "Phase 2 Criteria Analysis",
  phase_3:         "Phase 3B Synthesis",
  quality_gate:    "Quality Gate",
  wave_revision:   "WAVE Revision",
  dream:           "DREAM longform",
  complete:        "Complete",
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

/** Ordered pipeline stages for display — always shown in this sequence.
 *  Phase Architecture v2 canonical ordering (issue #736). */
export const PIPELINE_STAGE_ORDER: string[] = [
  "queued",
  "phase_0",
  "chunk_routing",
  "phase_1a",
  "pass_3a_map",
  "pass_3a_reduce",
  "review_gate",
  "phase_2",
  "phase_3",
  "quality_gate",
  "wave_revision",
  "dream",
  "complete",
];

/**
 * Phase Architecture v2 progress ladder.
 * Maps each pipeline stage to its canonical progress percentage.
 * Used by UI to display deterministic progress without relying on unit counts.
 */
export const PHASE_PROGRESS_LADDER: Record<string, number> = {
  queued:          2,
  phase_0:         5,
  chunk_routing:   10,
  phase_1a:        15,
  pass_3a_map:     30,
  pass_3a_reduce:  42,
  review_gate:     50,
  phase_2:         60,
  phase_3:         80,
  quality_gate:    92,
  wave_revision:   95,
  dream:           99,
  complete:        100,
};

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
