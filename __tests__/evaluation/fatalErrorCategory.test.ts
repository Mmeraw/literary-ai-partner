import {
  FatalErrorCategory,
  categorizeProcessorError,
  isLeaseLostFatal,
} from '../../lib/evaluation/orchestration/fatalErrorCategory';
import { EvaluationRunnerFatalError } from '../../lib/evaluation/orchestration/runnerHeartbeat';

describe('processor fatal error categorization', () => {
  it('classifies runner lease ownership changes as lease-lost fatal', () => {
    const error = new EvaluationRunnerFatalError('Job job-1 lease ownership changed.');

    expect(categorizeProcessorError(error)).toBe(FatalErrorCategory.LEASE_LOST);
    expect(isLeaseLostFatal(error)).toBe(true);
  });

  it('classifies RunnerHeartbeatMonitor lost running state as lease-lost fatal', () => {
    const error = new EvaluationRunnerFatalError('Job job-1 lost running state; phase_status=complete');

    expect(categorizeProcessorError(error)).toBe(FatalErrorCategory.LEASE_LOST);
    expect(isLeaseLostFatal(error)).toBe(true);
  });

  it('classifies blocked guarded updates as lease-lost fatal', () => {
    expect(categorizeProcessorError(
      new EvaluationRunnerFatalError('Guarded evaluation job update blocked for job job-1; lease ownership was not current.'),
    )).toBe(FatalErrorCategory.LEASE_LOST);
  });

  it('classifies non-lease runner fatal errors as lease-owned fatal', () => {
    expect(categorizeProcessorError(
      new EvaluationRunnerFatalError('[HEARTBEAT_CRITICAL_FAILURE] transient database error'),
    )).toBe(FatalErrorCategory.LEASE_OWNED);
  });

  it('classifies ordinary pipeline errors as non-fatal pipeline errors', () => {
    expect(categorizeProcessorError(new Error('Pass 1A produced zero chunk outputs')))
      .toBe(FatalErrorCategory.NON_FATAL);
  });

  it('classifies string lease-loss errors as lease-lost fatal', () => {
    expect(categorizeProcessorError('lease ownership validation failed for job job-1'))
      .toBe(FatalErrorCategory.LEASE_LOST);
  });
});
