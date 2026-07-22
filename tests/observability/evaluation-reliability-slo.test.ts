import {
  aggregateEvaluationReliability,
  type ReliabilityJob,
} from '@/lib/observability/evaluationReliabilitySlo';

const window = {
  start: '2026-07-01T00:00:00.000Z',
  end: '2026-08-01T00:00:00.000Z',
};

function job(overrides: Partial<ReliabilityJob> = {}): ReliabilityJob {
  return {
    id: 'job-1',
    jobType: 'full_evaluation',
    status: 'complete',
    createdAt: '2026-07-01T00:00:00.000Z',
    terminalAt: '2026-07-01T00:01:00.000Z',
    attemptCount: 1,
    maxAttempts: 3,
    failureCode: null,
    exposureState: 'certified',
    ...overrides,
  };
}

describe('aggregateEvaluationReliability', () => {
  it('requires certified author exposure for operational success', () => {
    const report = aggregateEvaluationReliability([
      job({ id: 'certified' }),
      job({ id: 'blocked', exposureState: 'blocked' }),
      job({ id: 'unknown', exposureState: 'unknown' }),
    ], window);

    expect(report.operational.successful).toBe(1);
    expect(report.operational.completedButBlocked).toBe(1);
    expect(report.operational.completedCertificationUnknown).toBe(1);
    expect(report.operational.successRate).toBeCloseTo(1 / 3);
    expect(report.certification).toEqual({
      known: 2,
      unknown: 1,
      coverageRate: 2 / 3,
      target: 1,
      targetMet: false,
    });
  });

  it('reports failure codes and retry exhaustion without hiding unclassified failures', () => {
    const report = aggregateEvaluationReliability([
      job({ id: 'retry', status: 'failed', exposureState: 'unknown', failureCode: 'PASS2_INCOMPLETE', attemptCount: 3, maxAttempts: 3 }),
      job({ id: 'unclassified', status: 'failed', exposureState: 'unknown', failureCode: null, attemptCount: 1, maxAttempts: 3 }),
    ], window);

    expect(report.operational.failed).toBe(2);
    expect(report.operational.retryExhausted).toBe(1);
    expect(report.operational.failureCodeDistribution).toEqual({
      PASS2_INCOMPLETE: 1,
      UNCLASSIFIED_FAILURE: 1,
    });
  });

  it('uses a settled cohort and discloses every exclusion', () => {
    const report = aggregateEvaluationReliability([
      job(),
      job({ id: 'running', status: 'running', terminalAt: null }),
      job({ id: 'test', isTest: true }),
      job({ id: 'revise', jobType: 'revision' }),
      job({ id: 'outside', terminalAt: '2026-08-01T00:00:00.000Z' }),
      job({ id: 'missing-terminal', terminalAt: null }),
    ], window);

    expect(report.cohort.eligible).toBe(1);
    expect(report.cohort.excluded).toBe(5);
    expect(report.cohort.exclusions).toEqual({
      non_terminal: 1,
      test_job: 1,
      non_evaluation_job: 1,
      outside_window: 1,
      missing_terminal_timestamp: 1,
    });
  });

  it('calculates nearest-rank p50 and p95 latency', () => {
    const jobs = [1, 2, 3, 4, 20].map((minutes, index) => job({
      id: `latency-${index}`,
      terminalAt: new Date(Date.parse('2026-07-01T00:00:00.000Z') + minutes * 60_000).toISOString(),
    }));
    const report = aggregateEvaluationReliability(jobs, window);

    expect(report.operational.latencyMs).toEqual({ p50: 180_000, p95: 1_200_000 });
  });

  it('meets the 98% operational target only at or above 98 certified successes', () => {
    const jobs = Array.from({ length: 100 }, (_, index) => job({
      id: `job-${index}`,
      exposureState: index < 98 ? 'certified' : 'blocked',
    }));
    const report = aggregateEvaluationReliability(jobs, window);

    expect(report.operational.successRate).toBe(0.98);
    expect(report.operational.targetMet).toBe(true);
    expect(report.certification.coverageRate).toBe(1);
  });

  it('does not claim an SLO result for an empty cohort', () => {
    const report = aggregateEvaluationReliability([], window);
    expect(report.operational.successRate).toBeNull();
    expect(report.operational.targetMet).toBeNull();
    expect(report.certification.coverageRate).toBeNull();
  });

  it('rejects an invalid reporting window', () => {
    expect(() => aggregateEvaluationReliability([], { start: window.end, end: window.start }))
      .toThrow('start before end');
  });
});
