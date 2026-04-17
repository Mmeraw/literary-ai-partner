import {
  normalizeEvaluationJobStatus,
  normalizeEvaluationValidityStatus,
  assertValidJobStatusTransition,
  EVALUATION_JOB_STATUSES,
  EVALUATION_VALIDITY_STATUSES,
} from '../../../lib/evaluation/status';

describe('normalizeEvaluationJobStatus', () => {
  it('accepts canonical statuses unchanged', () => {
    for (const s of EVALUATION_JOB_STATUSES) {
      expect(normalizeEvaluationJobStatus(s)).toBe(s);
    }
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizeEvaluationJobStatus('  COMPLETE ')).toBe('complete');
    expect(normalizeEvaluationJobStatus('Running')).toBe('running');
    expect(normalizeEvaluationJobStatus('QUEUED')).toBe('queued');
  });

  it('throws on non-canonical (legacy) status values', () => {
    expect(() => normalizeEvaluationJobStatus('completed')).toThrow();
    expect(() => normalizeEvaluationJobStatus('done')).toThrow();
    expect(() => normalizeEvaluationJobStatus('error')).toThrow();
    expect(() => normalizeEvaluationJobStatus('pending')).toThrow();
    expect(() => normalizeEvaluationJobStatus('in_progress')).toThrow();
  });

  it('throws on empty or null', () => {
    expect(() => normalizeEvaluationJobStatus('')).toThrow();
    expect(() => normalizeEvaluationJobStatus(null as any)).toThrow();
    expect(() => normalizeEvaluationJobStatus(undefined as any)).toThrow();
  });
});

describe('normalizeEvaluationValidityStatus', () => {
  it('accepts canonical validity statuses unchanged', () => {
    for (const s of EVALUATION_VALIDITY_STATUSES) {
      expect(normalizeEvaluationValidityStatus(s)).toBe(s);
    }
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizeEvaluationValidityStatus('  VALID ')).toBe('valid');
    expect(normalizeEvaluationValidityStatus('Pending')).toBe('pending');
    expect(normalizeEvaluationValidityStatus('QUARANTINED')).toBe('quarantined');
  });

  it('throws on unknown validity status', () => {
    expect(() => normalizeEvaluationValidityStatus('bogus')).toThrow();
    expect(() => normalizeEvaluationValidityStatus('disputed')).toThrow();
    expect(() => normalizeEvaluationValidityStatus(null as any)).toThrow();
  });
});

describe('assertValidJobStatusTransition', () => {
  it('allows queued -> running', () => {
    expect(() => assertValidJobStatusTransition('queued', 'running')).not.toThrow();
  });

  it('allows queued -> failed', () => {
    expect(() => assertValidJobStatusTransition('queued', 'failed')).not.toThrow();
  });

  it('allows running -> complete', () => {
    expect(() => assertValidJobStatusTransition('running', 'complete')).not.toThrow();
  });

  it('allows running -> failed', () => {
    expect(() => assertValidJobStatusTransition('running', 'failed')).not.toThrow();
  });

  it('rejects complete -> running (terminal state)', () => {
    expect(() => assertValidJobStatusTransition('complete', 'running')).toThrow();
  });

  it('rejects failed -> complete (terminal state)', () => {
    expect(() => assertValidJobStatusTransition('failed', 'complete')).toThrow();
  });

  it('rejects queued -> complete (must go through running)', () => {
    expect(() => assertValidJobStatusTransition('queued', 'complete')).toThrow();
  });
});
