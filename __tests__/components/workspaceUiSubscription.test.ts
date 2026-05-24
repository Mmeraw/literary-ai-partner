import { mapEvaluationRealtimeRow, type SynchronizedJobState } from '../../hooks/useEvaluationSubscription';

const initialState: SynchronizedJobState = {
  jobId: 'job-1',
  phase: 'phase_1a',
  phaseStatus: 'queued',
  cancellationRequested: false,
  leaseUntil: null,
};

describe('workspace UI subscription mapping', () => {
  it('maps realtime evaluation_jobs rows into synchronized job state', () => {
    expect(mapEvaluationRealtimeRow({
      id: 'job-1',
      phase: 'phase_2',
      phase_status: 'running',
      cancellation_requested: false,
      lease_until: '2026-05-22T12:00:00.000Z',
    }, initialState)).toEqual({
      jobId: 'job-1',
      phase: 'phase_2',
      phaseStatus: 'running',
      cancellationRequested: false,
      leaseUntil: '2026-05-22T12:00:00.000Z',
    });
  });

  it('falls back to prior state for malformed realtime payload fields', () => {
    expect(mapEvaluationRealtimeRow({
      id: null,
      phase: '',
      phase_status: undefined,
      cancellation_requested: 'false',
      lease_until: null,
    }, initialState)).toEqual(initialState);
  });

  it('surfaces cancellation requests as a UI lock signal', () => {
    expect(mapEvaluationRealtimeRow({
      id: 'job-1',
      phase: 'phase_1a',
      phase_status: 'running',
      cancellation_requested: true,
      lease_until: null,
    }, initialState)).toMatchObject({
      cancellationRequested: true,
      phaseStatus: 'running',
    });
  });
});
