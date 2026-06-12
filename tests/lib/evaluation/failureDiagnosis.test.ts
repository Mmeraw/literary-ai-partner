import { describe, expect, it } from '@jest/globals';
import { buildFailureDiagnosisV1 } from '@/lib/evaluation/failureDiagnosis';

describe('failureDiagnosis', () => {
  it('builds a QG summary-weakness packet with capped criterion evidence and no backward kick', () => {
    const packet = buildFailureDiagnosisV1({
      jobId: 'job-cartel-babies',
      createdAt: '2026-06-12T01:16:52.000Z',
      phase: 'phase_3',
      phaseStatus: 'failed',
      failureCode: 'QG_FAILED',
      errorMessage:
        '[QualityGateV2] v2_summary_weakness_presence: Overview summary omits bottom-score weakness criteria: theme',
      failureContext: {
        pipelineStage: 'quality_gate_v2',
        reasonCodes: ['v2_summary_weakness_presence'],
        diagnostics: {
          summary_repair: {
            attempted: true,
            mechanism: 'normalizeSummaryWithBottomWeaknesses',
            used_source: 'evaluationResult.criteria',
            expected_source: 'qualityGateV2.downgradedResult.criteria',
            outcome: 'failed',
          },
        },
      },
      artifacts: [
        {
          artifact_type: 'pass12_handoff_v1',
          created_at: '2026-06-12T01:14:00.000Z',
        },
        {
          artifact_type: 'pass3_preflight_draft_v1',
          created_at: '2026-06-12T01:14:10.000Z',
        },
        {
          artifact_type: 'pass_outputs_diagnostic_v1',
          created_at: '2026-06-12T01:16:50.000Z',
        },
        {
          artifact_type: 'quality_gate_diagnostics_v1',
          created_at: '2026-06-12T01:16:51.000Z',
          content: {
            failed_checks: [
              'v2_summary_weakness_presence: Overview summary omits bottom-score weakness criteria: theme',
            ],
            score_cap_for_low_confidence: 5,
            failed_criteria: [
              {
                criterion_key: 'theme',
                score: 10,
                confidence: 59,
                reasons: ['score=10 exceeds cap=5 for low-confidence criterion'],
              },
            ],
            per_criterion: [
              {
                criterion_key: 'theme',
                score: 10,
                confidence: 59,
                score_cap_applies: true,
                violated: true,
                reasons: ['score=10 exceeds cap=5 for low-confidence criterion'],
              },
            ],
          },
        },
      ],
    });

    expect(packet.failure_point.stage).toBe('Phase 3');
    expect(packet.failure_point.gate).toBe('QualityGateV2');
    expect(packet.failure_point.failed_check).toBe('v2_summary_weakness_presence');
    expect(packet.failed_criteria).toEqual(['theme']);
    expect(packet.admin_summary).toBe('Overview omitted QG-normalized bottom weakness: theme.');
    expect(packet.developer_summary).toContain('theme carried score 10');
    expect(packet.developer_summary).toContain('capped to 5');
    expect(packet.repair_status).toEqual(
      expect.objectContaining({
        attempted: true,
        used_source: 'evaluationResult.criteria',
        expected_source: 'qualityGateV2.downgradedResult.criteria',
        outcome: 'failed',
      }),
    );
    expect(packet.score_caps).toEqual([
      expect.objectContaining({
        criterion: 'theme',
        original_score: 10,
        effective_score: 5,
        confidence: 59,
      }),
    ]);
    expect(packet.backward_kick_status).toEqual(
      expect.objectContaining({
        triggered: false,
      }),
    );
    expect(packet.recommended_next_action).toBe(
      'Run post-QG consistency repair/gate using QG-normalized criteria before canonical persistence.',
    );
  });

  it('maps artifact consistency blocking reasons into the diagnosis packet', () => {
    const packet = buildFailureDiagnosisV1({
      jobId: 'job-artifact-gate',
      createdAt: '2026-06-12T02:00:00.000Z',
      phase: 'phase_3',
      phaseStatus: 'failed',
      failureCode: 'ARTIFACT_CONSISTENCY_GATE_FAILED',
      errorMessage: 'Evaluation consistency certification failed before report persistence.',
      artifacts: [
        {
          artifact_type: 'artifact_consistency_gate_v1',
          created_at: '2026-06-12T01:59:59.000Z',
          content: {
            blocking_reasons: ['summary_criteria_bottom_weakness_alignment'],
            checks: [
              {
                check_id: 'summary_criteria_bottom_weakness_alignment',
                status: 'fail',
                details: 'Overview summary omits QG-normalized bottom-score weakness criteria: theme',
                affected_criteria: ['theme'],
              },
            ],
          },
        },
      ],
    });

    expect(packet.failure_point.gate).toBe('ArtifactConsistencyGateV1');
    expect(packet.failed_checks).toEqual(['summary_criteria_bottom_weakness_alignment']);
    expect(packet.failed_criteria).toEqual(['theme']);
    expect(packet.blocking_reasons).toEqual(['summary_criteria_bottom_weakness_alignment']);
    expect(packet.admin_summary).toContain('Consistency gate blocked canonical persistence');
    expect(packet.developer_summary).toContain('summary_criteria_bottom_weakness_alignment');
  });

  it('creates a minimal packet when supporting diagnostics are missing', () => {
    const packet = buildFailureDiagnosisV1({
      jobId: 'job-minimal',
      createdAt: '2026-06-12T02:05:00.000Z',
      phase: 'phase_2',
      phaseStatus: 'failed',
      failureCode: 'PHASE2_PASS12_FAILED',
      errorMessage: 'phase_2 handoff artifact missing',
      artifacts: [],
    });

    expect(packet.artifact_type).toBe('failure_diagnosis_v1');
    expect(packet.failed_checks).toEqual(['handoff_artifact_missing']);
    expect(packet.admin_summary).toContain('pass12_handoff_v1');
    expect(packet.artifact_inventory.first_missing_or_failed_artifact).toBe('pass12_handoff_v1');
    expect(packet.failed_criteria).toEqual([]);
  });
});
