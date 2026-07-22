export const EVALUATION_RELIABILITY_TARGET = 0.98;

export type ExposureState = 'certified' | 'blocked' | 'unknown';

export type ReliabilityJob = {
  id: string;
  jobType: string | null;
  status: string;
  createdAt: string;
  terminalAt: string | null;
  attemptCount: number | null;
  maxAttempts: number | null;
  failureCode: string | null;
  exposureState: ExposureState;
  isTest?: boolean;
};

export type ReliabilityWindow = {
  start: string;
  end: string;
};

export type ReliabilitySloReport = {
  schemaVersion: 'evaluation_reliability_slo_v1';
  target: number;
  window: ReliabilityWindow;
  cohort: {
    definition: string;
    eligible: number;
    excluded: number;
    exclusions: Record<string, number>;
  };
  operational: {
    successful: number;
    unsuccessful: number;
    successRate: number | null;
    targetMet: boolean | null;
    completedButBlocked: number;
    completedCertificationUnknown: number;
    failed: number;
    retryExhausted: number;
    failureCodeDistribution: Record<string, number>;
    latencyMs: { p50: number | null; p95: number | null };
  };
  certification: {
    known: number;
    unknown: number;
    coverageRate: number | null;
    target: 1;
    targetMet: boolean | null;
  };
};

const TERMINAL = new Set(['complete', 'completed', 'failed']);
const EVALUATION_JOB_TYPES = new Set(['evaluation', 'full_evaluation', 'quick_evaluation']);

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentileValue * ordered.length) - 1;
  return ordered[Math.max(0, index)];
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function validTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Computes the operational SLO from a settled-job cohort. A job is successful
 * only when execution completed and author exposure is authoritatively certified.
 * Certification coverage is reported independently and has a 100% target.
 */
export function aggregateEvaluationReliability(
  jobs: ReliabilityJob[],
  window: ReliabilityWindow,
): ReliabilitySloReport {
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error('Reliability window must contain valid timestamps with start before end.');
  }

  const exclusions: Record<string, number> = {};
  const eligible: ReliabilityJob[] = [];

  for (const job of jobs) {
    if (job.isTest) {
      increment(exclusions, 'test_job');
      continue;
    }
    if (!job.jobType || !EVALUATION_JOB_TYPES.has(job.jobType)) {
      increment(exclusions, 'non_evaluation_job');
      continue;
    }
    if (!TERMINAL.has(job.status)) {
      increment(exclusions, 'non_terminal');
      continue;
    }
    const terminalAt = validTimestamp(job.terminalAt);
    if (terminalAt == null) {
      increment(exclusions, 'missing_terminal_timestamp');
      continue;
    }
    if (terminalAt < start || terminalAt >= end) {
      increment(exclusions, 'outside_window');
      continue;
    }
    eligible.push(job);
  }

  let successful = 0;
  let completedButBlocked = 0;
  let completedCertificationUnknown = 0;
  let failed = 0;
  let retryExhausted = 0;
  let certificationKnown = 0;
  let completedCount = 0;
  const failureCodeDistribution: Record<string, number> = {};
  const latencyValues: number[] = [];

  for (const job of eligible) {
    const completed = job.status === 'complete' || job.status === 'completed';
    if (completed) {
      completedCount += 1;
      if (job.exposureState === 'unknown') {
        completedCertificationUnknown += 1;
      } else {
        certificationKnown += 1;
      }
    }

    if (completed && job.exposureState === 'certified') successful += 1;
    if (completed && job.exposureState === 'blocked') completedButBlocked += 1;

    if (job.status === 'failed') {
      failed += 1;
      increment(failureCodeDistribution, job.failureCode?.trim() || 'UNCLASSIFIED_FAILURE');
      if (
        typeof job.attemptCount === 'number' &&
        typeof job.maxAttempts === 'number' &&
        job.maxAttempts > 0 &&
        job.attemptCount >= job.maxAttempts
      ) {
        retryExhausted += 1;
      }
    }

    const createdAt = validTimestamp(job.createdAt);
    const terminalAt = validTimestamp(job.terminalAt);
    if (createdAt != null && terminalAt != null && terminalAt >= createdAt) {
      latencyValues.push(terminalAt - createdAt);
    }
  }

  const operationalRate = ratio(successful, eligible.length);
  const certificationCoverage = ratio(certificationKnown, completedCount);
  const excluded = Object.values(exclusions).reduce((sum, count) => sum + count, 0);

  return {
    schemaVersion: 'evaluation_reliability_slo_v1',
    target: EVALUATION_RELIABILITY_TARGET,
    window,
    cohort: {
      definition: 'Non-test evaluation jobs reaching a terminal state within [start, end).',
      eligible: eligible.length,
      excluded,
      exclusions,
    },
    operational: {
      successful,
      unsuccessful: eligible.length - successful,
      successRate: operationalRate,
      targetMet: operationalRate == null ? null : operationalRate >= EVALUATION_RELIABILITY_TARGET,
      completedButBlocked,
      completedCertificationUnknown,
      failed,
      retryExhausted,
      failureCodeDistribution,
      latencyMs: {
        p50: percentile(latencyValues, 0.5),
        p95: percentile(latencyValues, 0.95),
      },
    },
    certification: {
      known: certificationKnown,
      unknown: completedCount - certificationKnown,
      coverageRate: certificationCoverage,
      target: 1,
      targetMet: certificationCoverage == null ? null : certificationCoverage === 1,
    },
  };
}
