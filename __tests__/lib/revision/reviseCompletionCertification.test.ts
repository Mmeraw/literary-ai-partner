import {
  buildReviseCompletionCertification,
  assertReviseCompletionCertified,
} from '@/lib/revision/reviseCompletionCertification';

describe('revise completion certification (RCG07)', () => {
  it('certifies completion when every ready-for-revise item has a persisted canonical decision', () => {
    const result = buildReviseCompletionCertification({
      manuscriptId: 6074,
      evaluationJobId: 'job-1',
      readyOpportunityIds: ['opp-b', 'opp-a'],
      needsTargetingCount: 1,
      withheldUnsupportedCount: 0,
      certifiedAt: '2026-06-13T00:00:00.000Z',
      decisions: [
        { id: 'decision-a', opportunity_id: 'opp-a', decision: 'accepted_a' },
        { id: 'decision-b', opportunity_id: 'opp-b', decision: 'keep_original' },
        { id: 'decision-unrelated', opportunity_id: 'strategy-1', decision: 'deferred' },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected certification');
    expect(result.record).toEqual(expect.objectContaining({
      artifact_type: 'revision_completion_record_v1',
      gate_id: 'RCG07_COMPLETION_CERTIFICATION',
      stage_id: 'RS08_COMPLETION',
      status: 'certified',
      certification_status: 'certified',
      manuscript_id: '6074',
      evaluation_job_id: 'job-1',
      completion_type: 'needs_targeting_deferred',
      decision_count: 2,
      decided_count: 2,
      total_ready: 2,
      pending_sync_count: 0,
      completed_at: '2026-06-13T00:00:00.000Z',
      trusted_path_status: 'not_requested',
      unresolved_ready_opportunity_ids: [],
    }));
    expect(result.record.decision_counts.accepted_a).toBe(1);
    expect(result.record.decision_counts.keep_original).toBe(1);
    expect(result.record.source_decision_ids).toEqual(['decision-a', 'decision-b']);
    expect(result.record.certification_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.record.revision_hash).toBe(result.record.certification_hash);
  });

  it('blocks premature completion when any ready-for-revise item lacks a persisted decision', () => {
    const result = buildReviseCompletionCertification({
      manuscriptId: 6074,
      evaluationJobId: 'job-1',
      readyOpportunityIds: ['opp-a', 'opp-b'],
      certifiedAt: '2026-06-13T00:00:00.000Z',
      decisions: [{ id: 'decision-a', opportunity_id: 'opp-a', decision: 'accepted_a' }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.failure).toEqual(expect.objectContaining({
      artifact_type: 'failure_diagnosis_v1',
      failed_stage: 'RS08_COMPLETION',
      failed_gate: 'RCG07_COMPLETION_CERTIFICATION',
      diagnostic_code: 'COMPLETION_PREMATURE',
      retryable: true,
      blocking_artifact: 'revision_completion_record_v1',
    }));
    expect(result.failure.details.unresolved_ready_opportunity_ids).toEqual(['opp-b']);
    expect(result.failure.user_safe_summary).toContain('every ready revision card');
  });

  it('blocks non-canonical persisted decision values instead of certifying around dirty data', () => {
    const result = buildReviseCompletionCertification({
      manuscriptId: 6074,
      evaluationJobId: 'job-1',
      readyOpportunityIds: ['opp-a'],
      decisions: [{ id: 'decision-a', opportunity_id: 'opp-a', decision: 'completed' }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.failure.diagnostic_code).toBe('COMPLETION_CERT_INVALID');
    expect(result.failure.retryable).toBe(false);
    expect(result.failure.details.invalid_decision_opportunity_ids).toEqual(['opp-a']);
  });

  it('throws a diagnostic-coded error from assert helper when certification fails', () => {
    expect(() => assertReviseCompletionCertified({
      manuscriptId: 6074,
      evaluationJobId: 'job-1',
      readyOpportunityIds: ['opp-a'],
      decisions: [],
    })).toThrow(/COMPLETION_PREMATURE/);
  });
});
