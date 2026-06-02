export type ProgressDisplay = {
  label: string;
  valueLabel: string;
  helperText: string;
  indeterminate: boolean;
  percentage: number;
  /**
   * "amber"  → Review Gate hard stop, awaiting author approval
   * "red"    → Review Gate blocked, narrative conflicts detected
   * "blue"   → normal running state
   * "green"  → complete
   */
  color: "blue" | "amber" | "red" | "green";
  /** When true the bar must not advance until backend transitions past review_gate. */
  hardStop: boolean;
} | null;

type PhaseInputs = {
  status: "queued" | "running" | "complete" | "failed";
  phase?: string | null;
  phase_status?: string | null;
  cross_check_status?: string | null;
  phase_message?: string | null;
  heartbeat_age_seconds?: number | null;
  retry_count?: number | null;
  is_stalled?: boolean;
  stalled_reason?: string | null;
  failure_code?: string | null;
  phase_unit_fraction?: number | null;
  /** Pipeline block code — when set, the eval is gated/blocked */
  block_code?: string | null;
  /** Surfaced from jobs API via progress JSONB — true when ledger hard-fails block Phase 2 */
  hard_fail_present?: boolean | null;
  /** Phase start timestamps for elapsed-time drift within a phase range. */
  phase0_started_at?: string | null;
  phase1_started_at?: string | null;
  phase2_started_at?: string | null;
  phase3_started_at?: string | null;
  /** Narrative Synthesis (Pass 3b) completion timestamp — null/absent while synthesis is still running */
  pass3_completed_at?: string | null;
  /** Manuscript word count — used to determine if this is a long-form job (≥25k words) */
  manuscript_word_count?: number | null;
};

const LONGFORM_WORD_COUNT_THRESHOLD = 25000;

function elapsedDrift(
  startedAt: string | null | undefined,
  rangeMin: number,
  rangeMax: number,
  now: Date,
): number {
  if (!startedAt) return rangeMin;
  const elapsed = Math.max(0, now.getTime() - new Date(startedAt).getTime()) / 1000;
  const growth = Math.min(1, Math.log1p(elapsed / 30) / Math.log1p(6));
  return Math.round(rangeMin + (rangeMax - rangeMin) * growth);
}

export function getProgressDisplay(
  job: PhaseInputs,
  _now: Date = new Date(),
): ProgressDisplay {
  if (job.status === "failed") return null;

  // Honest blocked state: when block_code is set, the eval is gate-blocked.
  // Show truthful UI instead of a fake drifting percentage.
  if ((job.status === 'queued' || job.status === 'running') && job.block_code) {
    const phasePct =
      job.phase === 'phase_3' ? 86
        : job.phase === 'phase_2' ? 67
          : job.phase === 'review_gate' ? 50
            : job.phase === 'phase_1a' ? 40
              : 10;
    const isRetryable = /TECHNICAL_BLOCK|REDUCER_FAILED|PASS3A/.test(job.block_code);
    return {
      label: isRetryable
        ? 'Evaluation paused — retrying automatically'
        : 'Evaluation paused — awaiting resolution',
      valueLabel: `${phasePct}%`,
      helperText: isRetryable
        ? 'A background process encountered an issue and is being retried. Your progress is safe.'
        : 'The evaluation pipeline has paused. This will resolve automatically or contact support.',
      indeterminate: false,
      percentage: phasePct,
      color: isRetryable ? 'amber' : 'red',
      hardStop: true,
    };
  }

  if ((job.status === 'queued' || job.status === 'running') && job.is_stalled) {
    const stalledAtPct =
      job.phase === 'phase_3'
        ? 86
        : job.phase === 'phase_2'
          ? 67
          : job.phase === 'review_gate'
            ? 50
            : job.phase === 'phase_1a'
              ? 35
              : 5;

    const heartbeatAgeText =
      typeof job.heartbeat_age_seconds === 'number'
        ? `Last heartbeat ${job.heartbeat_age_seconds}s ago.`
        : 'No recent worker heartbeat.';
    const retryText =
      typeof job.retry_count === 'number' ? ` Retry attempts: ${job.retry_count}.` : '';
    const failureText =
      typeof job.failure_code === 'string' && job.failure_code.length > 0
        ? ` Code: ${job.failure_code}.`
        : '';

    return {
      label: 'Evaluation stalled — worker not advancing',
      valueLabel: 'Stalled',
      helperText: job.stalled_reason
        ?? (`${heartbeatAgeText}${retryText}${failureText}`.trim()
          || 'The worker has stopped advancing this evaluation. Please retry or contact support.'),
      indeterminate: false,
      percentage: stalledAtPct,
      color: 'red',
      hardStop: true,
    };
  }

  if (job.status === "complete") {
    const isLongForm = typeof job.manuscript_word_count === 'number'
      && job.manuscript_word_count >= LONGFORM_WORD_COUNT_THRESHOLD;
    const hasSynthesis = !!job.pass3_completed_at;

    if (isLongForm && !hasSynthesis) {
      return {
        label: "Building your report complete — Finalizing your report in progress\u2026",
        valueLabel: "92%",
        helperText:
          "Your 13-criteria diagnostic report is ready below. " +
          "Finalizing your report is still generating and will appear when complete.",
        indeterminate: false,
        percentage: 92,
        color: "blue",
        hardStop: false,
      };
    }

    return {
      label: isLongForm
        ? "Evaluation finalized — full report ready"
        : "Evaluation complete!",
      valueLabel: "100%",
      helperText: isLongForm
        ? "Your full evaluation report is ready."
        : "Your evaluation report is ready.",
      indeterminate: false,
      percentage: 100,
      color: "green",
      hardStop: false,
    };
  }

  if (job.phase === "review_gate") {
    const hasHardFail = !!job.hard_fail_present;
    return {
      label: hasHardFail
        ? "Story Layer Blocked: Narrative conflicts detected"
        : "Awaiting Story Layer Approval",
      valueLabel: "50%",
      helperText: hasHardFail
        ? "The story layer could not be approved automatically. Review the Story Ledger to resolve narrative conflicts before Phase 2 can begin."
        : "Phase 1A is complete. Review your Story Ledger and approve to continue to Phase 2.",
      indeterminate: false,
      percentage: 50,
      color: hasHardFail ? "red" : "amber",
      hardStop: true,
    };
  }

  if (job.phase === 'phase_3' && job.status === 'queued') {
    return {
      label: "Finalizing your report...",
      valueLabel: "86%",
      helperText: "Finalizing your report.",
      indeterminate: false,
      percentage: 86,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === 'phase_2' && job.status === 'queued') {
    return {
      label: "Building your report...",
      valueLabel: "67%",
      helperText: "Building your report across all thirteen evaluation criteria.",
      indeterminate: false,
      percentage: 67,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === 'phase_1a' && job.status === 'queued') {
    const fraction = job.phase_unit_fraction ?? 1;
    const isEarly = fraction < 0.5;
    return {
      label: isEarly ? "Diagnosing your manuscript..." : "Understanding your story...",
      valueLabel: isEarly ? "15%" : "35%",
      percentage: isEarly ? 15 : 35,
      color: "blue",
      hardStop: false,
      indeterminate: false,
      helperText: "Analyzing your manuscript's story, structure, and craft signals."
    };
  }

  if (job.phase === 'phase_0' && job.status === 'queued') {
    return {
      label: "Preparing your evaluation",
      valueLabel: "5%",
      percentage: 5,
      color: "blue",
      hardStop: false,
      indeterminate: false,
      helperText: job.phase_message ?? "Your manuscript has been received. Preparing your evaluation.",
    };
  }

  if (job.status === "queued") {
    return {
      label: "Starting your evaluation...",
      valueLabel: "2%",
      helperText: job.phase_message ?? "Your manuscript has been received. Your evaluation will begin shortly.",
      indeterminate: false,
      percentage: 2,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.status !== "running") return null;

  if (job.cross_check_status === "running" || job.cross_check_status === "queued") {
    return {
      label: "Finalizing your report...",
      valueLabel: "97%",
      helperText: "Finalizing your report.",
      indeterminate: false,
      percentage: 97,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === "phase_3") {
    const pct = elapsedDrift(job.phase3_started_at, 86, 96, _now);
    return {
      label: "Finalizing your report...",
      valueLabel: `${pct}%`,
      helperText: "Finalizing your report.",
      indeterminate: false,
      percentage: pct,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === "phase_2") {
    const pct = elapsedDrift(job.phase2_started_at, 67, 82, _now);
    return {
      label: "Building your report...",
      valueLabel: `${pct}%`,
      helperText: "Building your report across all thirteen evaluation criteria.",
      indeterminate: false,
      percentage: pct,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === "phase_1a" && job.phase_status === "running") {
    const fraction = job.phase_unit_fraction ?? 1;
    const isEarly = fraction < 0.5;
    const rangeMin = isEarly ? 15 : 35;
    const rangeMax = isEarly ? 34 : 48;
    const pct = elapsedDrift(job.phase1_started_at, rangeMin, rangeMax, _now);
    return {
      label: isEarly
        ? "Diagnosing your manuscript..."
        : "Understanding your story...",
      valueLabel: `${pct}%`,
      helperText: isEarly
        ? "Analyzing your manuscript's story, structure, and craft signals."
        : "Exploring your characters, relationships, and narrative arc.",
      indeterminate: false,
      percentage: pct,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === "phase_1a") {
    const pct = elapsedDrift(job.phase1_started_at, 15, 34, _now);
    return {
      label: "Diagnosing your manuscript...",
      valueLabel: `${pct}%`,
      helperText: "Analyzing your manuscript's story, structure, and craft signals.",
      indeterminate: false,
      percentage: pct,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === 'phase_0') {
    const pct = elapsedDrift(job.phase0_started_at, 5, 12, _now);
    return {
      label: "Preparing your evaluation",
      valueLabel: `${pct}%`,
      helperText: "Your manuscript has been received and your evaluation is starting.",
      indeterminate: false,
      percentage: pct,
      color: "blue",
      hardStop: false,
    };
  }

  return {
    label: "Preparing your evaluation",
    valueLabel: "5%",
    helperText: "Your evaluation will begin shortly.",
    indeterminate: false,
    percentage: 5,
    color: "blue",
    hardStop: false,
  };
}

export function getStageLabelFromPhase(
  phase: string | null | undefined,
  phaseStatus: string | null | undefined,
  crossCheckStatus: string | null | undefined,
): string | null {
  const pd = getProgressDisplay({
    status: "running",
    phase: phase ?? null,
    phase_status: phaseStatus ?? null,
    cross_check_status: crossCheckStatus ?? null,
  });
  return pd?.label ?? null;
}

export const __testing__ = {
  getProgressDisplay,
  getStageLabelFromPhase,
};
