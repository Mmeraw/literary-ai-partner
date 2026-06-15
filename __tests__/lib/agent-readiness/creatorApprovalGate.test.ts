import {
  buildCreatorApprovalV1,
  evaluateCreatorApprovalGate,
} from '@/lib/agent-readiness/creatorApprovalGate';

describe('creator approval gate', () => {
  it('passes only explicit approved creator_approval_v1 artifacts', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: 6074,
      evaluationJobId: 'job-1',
      packageHash: 'hash-1',
      approvalState: 'approved',
      decidedBy: 'user-1',
      decidedAt: '2026-06-13T00:00:00.000Z',
    });

    const result = evaluateCreatorApprovalGate({ approval });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected approval');
    expect(result.approval).toEqual(expect.objectContaining({
      artifact_type: 'creator_approval_v1',
      approval_state: 'approved',
      approved: true,
      package_hash: 'hash-1',
    }));
  });

  it.each(['pending', 'rejected'] as const)('blocks %s approval states', (approvalState) => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: 6074,
      evaluationJobId: 'job-1',
      packageHash: 'hash-1',
      approvalState,
    });

    const result = evaluateCreatorApprovalGate({ approval });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.failure).toEqual(expect.objectContaining({
      artifact_type: 'failure_diagnosis_v1',
      failed_gate: 'ARCG09_CREATOR_APPROVAL_GATE',
      blocking_artifact: 'creator_approval_v1',
      diagnostic_code: 'CREATOR_APPROVAL_REQUIRED',
      approval_state: approvalState,
    }));
  });

  it('blocks missing approval as retryable', () => {
    const result = evaluateCreatorApprovalGate({ approval: null });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.failure.approval_state).toBe('missing');
    expect(result.failure.retryable).toBe(true);
  });
});
