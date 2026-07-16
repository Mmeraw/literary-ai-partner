/**
 * ProgressAuthority — single, weighted, monotonic source of truth for evaluation
 * progress reporting.
 *
 * Problems this solves:
 *  - Coarse phase milestones (5 → 35 → 86 → 98) caused by `completed_units`
 *    being pinned to arbitrary phase boundaries.
 *  - Progress going backward on retry/resume because retries reset the bar.
 *  - 100% being reached before the job is actually durable/complete.
 *
 * Design invariants:
 *  1. `reportProgress` is running-state only. It never marks a job complete.
 *  2. `completed_units` is derived from weighted completed work plus an
 *     intra-phase fraction (when supplied). It is always monotonic.
 *  3. `progressHighWater` is the authoritative floor; no event can lower it.
 *  4. 100% overall is reserved for the final durable completion event.
 *  5. Part 1 (Diagnostic Evaluation) and Part 2 (Narrative Synthesis / WAVE) are
 *     tracked as independent sub-bars so the UI can show them separately.
 *  6. ETA is measured and smoothed per-phase using elapsed time + intra-phase
 *     fraction; it is not a static estimate.
 */

export type ProgressPhase =
  | 'phase_0'
  | 'phase_1a'
  | 'pass_3a'
  | 'phase_2'
  | 'phase_3'
  | 'wave'
  | 'finalization';

export type ProgressPartName = 'part1' | 'part2';

export interface ProgressPart {
  /** Human-readable label for the part. */
  label: string;
  /** Lifecycle status of this part. */
  status: 'pending' | 'running' | 'complete';
  /** 0-100 progress within this part. */
  completed_units: number;
  total_units: number;
  /** Estimated remaining seconds for this part, or null if not yet measurable. */
  estimated_remaining_seconds: number | null;
  /** ISO timestamp when this part completed, if known. */
  completed_at: string | null;
}

export interface ProgressOverall {
  /** Monotonic 0-100 overall evaluation progress. */
  completed_units: number;
  total_units: number;
  estimated_remaining_seconds: number | null;
}

export interface EvaluationProgressSnapshot {
  status: 'running' | 'complete';
  /** Which conceptual part is currently driving visible progress. */
  active_part: ProgressPartName | null;
  part1: ProgressPart;
  part2: ProgressPart;
  overall: ProgressOverall;
  /** Author-facing message for the current step. */
  message: string;
  /** Monotonic floor for `completed_units`; the UI should never see a value below this. */
  progress_high_water: number;
  /** ISO timestamp when the running phase/part started, for ETA measurement. */
  started_at: string | null;
  /** Current pipeline phase (legacy column mirror). */
  phase: ProgressPhase | string | null;
}

export interface EvaluationProgressEvent {
  type:
    | 'phase_started'
    | 'phase_progress'
    | 'artifact_persisted'
    | 'finalizing'
    | 'complete';
  phase?: ProgressPhase;
  /** 0-1 fraction of work completed within the current phase. */
  fraction?: number;
  /** Optional author-facing message override. */
  message?: string;
  /** Optional timestamp (defaults to now). */
  at?: string;
  /** For artifact_persisted events. */
  artifactKind?: string;
}

// Phase weights as a share of overall 0-100.
// Part 1 = phase_0 + phase_1a + pass_3a + phase_2 + phase_3.
// Part 2 = wave + finalization.
const PHASE_WEIGHTS: Record<ProgressPhase, number> = {
  phase_0: 5,
  phase_1a: 30,
  pass_3a: 10,
  phase_2: 25,
  phase_3: 20,
  wave: 8,
  finalization: 2,
};

const PART1_PHASES: readonly ProgressPhase[] = [
  'phase_0',
  'phase_1a',
  'pass_3a',
  'phase_2',
  'phase_3',
];

const PART2_PHASES: readonly ProgressPhase[] = ['wave', 'finalization'];

const TOTAL_OVERALL_WEIGHT = Object.values(PHASE_WEIGHTS).reduce((a, b) => a + b, 0);

const PHASE_ORDER: readonly ProgressPhase[] = [
  'phase_0',
  'phase_1a',
  'pass_3a',
  'phase_2',
  'phase_3',
  'wave',
  'finalization',
];

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(Math.max(n, min), max);
}

function roundProgress(n: number): number {
  return Math.round(n);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function allocateCompletedUnitsToPhaseFractions(completedUnits: number): Partial<Record<ProgressPhase, number>> {
  const fractions: Partial<Record<ProgressPhase, number>> = {};
  let remaining = clamp(completedUnits, 0, 100);
  for (const phase of PHASE_ORDER) {
    const weight = PHASE_WEIGHTS[phase];
    if (remaining <= 0) break;
    if (remaining >= weight) {
      fractions[phase] = 1;
      remaining -= weight;
    } else {
      fractions[phase] = remaining / weight;
      remaining = 0;
    }
  }
  return fractions;
}

function timestampCompletedTarget(persisted: Record<string, unknown>): number {
  const phase0Done = isNonEmptyString(persisted.phase0_completed_at) || isNonEmptyString(persisted.phase1_started_at);
  const phase1aDone =
    isNonEmptyString(persisted.phase1_completed_at) ||
    isNonEmptyString(persisted.phase2_started_at) ||
    isNonEmptyString(persisted.phase2_completed_at) ||
    isNonEmptyString(persisted.phase3_started_at) ||
    persisted.phase === 'phase_3';
  const pass3aDone = phase1aDone;
  const phase2Done = isNonEmptyString(persisted.phase2_completed_at) || isNonEmptyString(persisted.phase3_started_at) || persisted.phase === 'phase_3';
  const phase3Done = isNonEmptyString(persisted.phase3_started_at) || (isNonEmptyString(persisted.phase2_completed_at) && persisted.phase === 'phase_3');
  const waveDone = isNonEmptyString(persisted.phase2_completed_at) && persisted.phase === 'phase_3';
  const finalizationDone = waveDone;

  let target = 0;
  if (phase0Done) target += PHASE_WEIGHTS.phase_0;
  if (phase1aDone) target += PHASE_WEIGHTS.phase_1a;
  if (pass3aDone) target += PHASE_WEIGHTS.pass_3a;
  if (phase2Done) target += PHASE_WEIGHTS.phase_2;
  if (phase3Done) target += PHASE_WEIGHTS.phase_3;
  if (waveDone) target += PHASE_WEIGHTS.wave;
  if (finalizationDone) target += PHASE_WEIGHTS.finalization;
  return target;
}

function defaultMessage(phase: ProgressPhase | undefined, part: ProgressPartName | null): string {
  if (!phase) return 'Preparing your evaluation…';
  switch (phase) {
    case 'phase_0':
      return 'Calibrating the evaluation engine…';
    case 'phase_1a':
      return 'Reading your story and building the narrative ledger…';
    case 'pass_3a':
      return 'Building story analysis…';
    case 'phase_2':
      return 'Analyzing your writing across all criteria…';
    case 'phase_3':
      return 'Synthesizing your evaluation…';
    case 'wave':
      return 'Preparing revision guidance…';
    case 'finalization':
      return 'Finalizing your completed evaluation…';
    default:
      return 'Evaluation in progress…';
  }
}

export function createInitialProgressSnapshot(
  initial: Partial<EvaluationProgressSnapshot> = {},
): EvaluationProgressSnapshot {
  const now = new Date().toISOString();
  return {
    status: 'running',
    active_part: null,
    part1: {
      label: 'Part 1 of 2 — Diagnostic Evaluation',
      status: 'pending',
      completed_units: 0,
      total_units: 100,
      estimated_remaining_seconds: null,
      completed_at: null,
    },
    part2: {
      label: 'Part 2 of 2 — Narrative Synthesis',
      status: 'pending',
      completed_units: 0,
      total_units: 100,
      estimated_remaining_seconds: null,
      completed_at: null,
    },
    overall: {
      completed_units: 0,
      total_units: 100,
      estimated_remaining_seconds: null,
    },
    message: 'Preparing your evaluation…',
    progress_high_water: 0,
    started_at: now,
    phase: null,
    ...initial,
  };
}

export class ProgressAuthority {
  private snapshot: EvaluationProgressSnapshot;
  private phaseStartTimes: Partial<Record<ProgressPhase, string>> = {};
  private phaseFractions: Partial<Record<ProgressPhase, number>> = {};

  constructor(initial?: Partial<EvaluationProgressSnapshot>) {
    this.snapshot = createInitialProgressSnapshot(initial);
  }

  /** Merge an existing progress JSONB snapshot (e.g. from a resumed job). */
  static fromPersisted(persisted: Record<string, unknown>): ProgressAuthority {
    const snapshot = createInitialProgressSnapshot();
    if (persisted && typeof persisted === 'object') {
      if (persisted.part1 && typeof persisted.part1 === 'object') {
        snapshot.part1 = { ...snapshot.part1, ...(persisted.part1 as Record<string, unknown>) } as ProgressPart;
      }
      if (persisted.part2 && typeof persisted.part2 === 'object') {
        snapshot.part2 = { ...snapshot.part2, ...(persisted.part2 as Record<string, unknown>) } as ProgressPart;
      }
      if (persisted.overall && typeof persisted.overall === 'object') {
        snapshot.overall = { ...snapshot.overall, ...(persisted.overall as Record<string, unknown>) } as ProgressOverall;
      }
      if (typeof persisted.progress_high_water === 'number') {
        snapshot.progress_high_water = persisted.progress_high_water;
      }
      if (typeof persisted.message === 'string') {
        snapshot.message = persisted.message;
      }
      if (typeof persisted.phase === 'string') {
        snapshot.phase = persisted.phase as ProgressPhase;
      }
      if (typeof persisted.active_part === 'string') {
        snapshot.active_part = persisted.active_part as ProgressPartName;
      }
    }
    const authority = new ProgressAuthority(snapshot);

    // Reconstruct weighted phase fractions from durable phase timestamps so
    // resumed jobs do not reset the part bars to zero. Prefer any persisted
    // completed_units / progress_high_water; fall back to completed timestamps.
    const persistedCompletedUnits =
      typeof persisted.completed_units === 'number'
        ? persisted.completed_units
        : (persisted.overall as Record<string, unknown> | undefined)?.completed_units as number | undefined;
    const persistedHighWater = typeof persisted.progress_high_water === 'number' ? persisted.progress_high_water : undefined;
    const timestampTarget = timestampCompletedTarget(persisted);
    const targetCompletedUnits = Math.max(
      0,
      persistedCompletedUnits ?? 0,
      persistedHighWater ?? 0,
      timestampTarget,
    );
    const phaseFractions = allocateCompletedUnitsToPhaseFractions(targetCompletedUnits);
    authority.replacePhaseFractions(phaseFractions);
    return authority;
  }

  /** Record a progress event and return the new snapshot. */
  report(event: EvaluationProgressEvent): EvaluationProgressSnapshot {
    const at = event.at ?? new Date().toISOString();
    const phase = event.phase ?? (this.snapshot.phase as ProgressPhase | undefined);

    if (event.type === 'phase_started' && phase) {
      this.phaseStartTimes[phase] = at;
      this.snapshot.phase = phase;
      this.snapshot.started_at = at;
      this.snapshot.active_part = PART2_PHASES.includes(phase) ? 'part2' : 'part1';
      if (PART1_PHASES.includes(phase)) {
        this.snapshot.part1.status = 'running';
      }
      if (PART2_PHASES.includes(phase)) {
        this.snapshot.part2.status = 'running';
      }
    }

    if (event.type === 'phase_progress' && phase && typeof event.fraction === 'number') {
      this.phaseFractions[phase] = clamp(event.fraction, 0, 1);
      this.snapshot.phase = phase;
      if (PART1_PHASES.includes(phase)) {
        this.snapshot.active_part = 'part1';
      }
      if (PART2_PHASES.includes(phase)) {
        this.snapshot.active_part = 'part2';
      }
    }

    if (event.type === 'artifact_persisted') {
      // Artifact persistence advances the hidden weighted model without
      // exposing artifact names to the author.
      // No-op for percentages; the caller should also issue phase_progress.
    }

    if (event.type === 'finalizing') {
      this.snapshot.message = event.message ?? 'Preparing your completed evaluation…';
      // Lock to 99% until complete is proven durable.
      this.snapshot.overall.completed_units = Math.min(this.snapshot.overall.completed_units, 99);
      return this.toSnapshot();
    }

    if (event.type === 'complete') {
      this.snapshot.status = 'complete';
      this.snapshot.part1.status = 'complete';
      this.snapshot.part1.completed_units = 100;
      this.snapshot.part1.completed_at = at;
      this.snapshot.part2.status = 'complete';
      this.snapshot.part2.completed_units = 100;
      this.snapshot.part2.completed_at = at;
      this.snapshot.overall.completed_units = 100;
      this.snapshot.message = event.message ?? 'Evaluation complete';
      this.snapshot.active_part = null;
      this.snapshot.phase = null;
      return this.toSnapshot();
    }

    this.recompute(at);
    this.snapshot.message = event.message ?? defaultMessage(phase, this.snapshot.active_part);
    return this.toSnapshot();
  }

  /** Finalize Part 1 (Diagnostic Evaluation) when the canonical result is durably persisted. */
  finalizePart1(at = new Date().toISOString()): EvaluationProgressSnapshot {
    this.snapshot.part1.status = 'complete';
    this.snapshot.part1.completed_units = 100;
    this.snapshot.part1.completed_at = at;
    this.snapshot.part2.status = 'running';
    this.snapshot.active_part = 'part2';
    this.snapshot.message = 'Diagnostic Evaluation complete — preparing Narrative Synthesis…';
    this.recompute(at);
    return this.toSnapshot();
  }

  /** Finalize the entire evaluation. */
  finalize(at = new Date().toISOString()): EvaluationProgressSnapshot {
    return this.report({ type: 'complete', at });
  }

  /** Replace the internal phase fractions (used when rehydrating from persisted state). */
  replacePhaseFractions(fractions: Partial<Record<ProgressPhase, number>>): void {
    for (const [phase, fraction] of Object.entries(fractions)) {
      const p = phase as ProgressPhase;
      if (typeof fraction === 'number') {
        this.phaseFractions[p] = clamp(fraction, 0, 1);
      }
    }
    this.recompute(new Date().toISOString());
  }

  private recompute(now: string): void {
    let overall = 0;
    let part1Completed = 0;
    let part2Completed = 0;

    for (const phase of PART1_PHASES) {
      const weight = PHASE_WEIGHTS[phase];
      const fraction = this.phaseFractions[phase] ?? 0;
      part1Completed += (weight / TOTAL_OVERALL_WEIGHT) * 100 * fraction;
      overall += (weight / TOTAL_OVERALL_WEIGHT) * 100 * fraction;
    }

    for (const phase of PART2_PHASES) {
      const weight = PHASE_WEIGHTS[phase];
      const fraction = this.phaseFractions[phase] ?? 0;
      part2Completed += (weight / TOTAL_OVERALL_WEIGHT) * 100 * fraction;
      overall += (weight / TOTAL_OVERALL_WEIGHT) * 100 * fraction;
    }

    // Part 1 and Part 2 are also expressed as independent 0-100 bars.
    // Their internal share is the same weight distribution, just scaled.
    const part1Weight = PART1_PHASES.reduce((sum, p) => sum + PHASE_WEIGHTS[p], 0);
    const part2Weight = PART2_PHASES.reduce((sum, p) => sum + PHASE_WEIGHTS[p], 0);

    this.snapshot.part1.completed_units = roundProgress(
      clamp(part1Weight > 0 ? (part1Completed / part1Weight) * TOTAL_OVERALL_WEIGHT : 0, 0, 100),
    );
    this.snapshot.part2.completed_units = roundProgress(
      clamp(part2Weight > 0 ? (part2Completed / part2Weight) * TOTAL_OVERALL_WEIGHT : 0, 0, 100),
    );

    // Overall is the weighted sum of completed phase work.
    let nextOverall = roundProgress(clamp(overall, 0, 100));

    // Monotonic ratchet: never go below the high-water mark.
    nextOverall = Math.max(nextOverall, this.snapshot.progress_high_water);

    // During finalization, cap at 99% until we have proven durable completion.
    if (this.snapshot.phase === 'finalization' && this.snapshot.status !== 'complete') {
      nextOverall = Math.min(nextOverall, 99);
    }

    this.snapshot.overall.completed_units = nextOverall;
    this.snapshot.progress_high_water = nextOverall;

    this.snapshot.part1.estimated_remaining_seconds = this.estimateRemainingSeconds('part1', now);
    this.snapshot.part2.estimated_remaining_seconds = this.estimateRemainingSeconds('part2', now);
    this.snapshot.overall.estimated_remaining_seconds = this.estimateOverallRemainingSeconds(now);
  }

  private estimateRemainingSeconds(part: ProgressPartName, now: string): number | null {
    const p = this.snapshot[part];
    if (p.status === 'complete' || p.completed_units <= 0) return null;
    const start = this.snapshot.started_at ?? now;
    const elapsedSec = (new Date(now).getTime() - new Date(start).getTime()) / 1000;
    const rate = p.completed_units / Math.max(elapsedSec, 1); // percent per second
    const remainingPercent = 100 - p.completed_units;
    const estimate = Math.ceil(remainingPercent / Math.max(rate, 0.001));
    return estimate > 0 && estimate < 86400 ? estimate : null;
  }

  private estimateOverallRemainingSeconds(now: string): number | null {
    const start = this.snapshot.started_at ?? now;
    const elapsedSec = (new Date(now).getTime() - new Date(start).getTime()) / 1000;
    const completed = this.snapshot.overall.completed_units;
    if (completed <= 0 || completed >= 100) return null;
    const rate = completed / Math.max(elapsedSec, 1);
    const remaining = (100 - completed) / Math.max(rate, 0.001);
    return Math.ceil(remaining);
  }

  /** Return a deep copy of the current snapshot, ready to persist in `progress` JSONB. */
  toSnapshot(): EvaluationProgressSnapshot {
    return JSON.parse(JSON.stringify(this.snapshot)) as EvaluationProgressSnapshot;
  }
}

/** Convenience: create an authority and immediately report the first event. */
export function createProgressAuthority(
  initial?: Partial<EvaluationProgressSnapshot>,
  initialEvent?: EvaluationProgressEvent,
): ProgressAuthority {
  const authority = new ProgressAuthority(initial);
  if (initialEvent) authority.report(initialEvent);
  return authority;
}
