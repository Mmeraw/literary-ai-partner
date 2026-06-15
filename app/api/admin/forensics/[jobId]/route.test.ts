import { NextRequest } from 'next/server';
import { GET } from './route';

jest.mock('@/lib/admin/requireAdmin', () => ({
  requireAdmin: jest.fn(async () => null),
}));

jest.mock('@/lib/auth/devHeaderActor', () => ({
  getDevHeaderActor: jest.fn(() => ({ isAdmin: true })),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

const { createAdminClient } = require('@/lib/supabase/admin') as {
  createAdminClient: jest.Mock;
};

function makeThenableResult(result: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(result);
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

function mockAdminClient(results: Array<{ data: unknown; error: unknown }>) {
  const from = jest.fn().mockImplementation(() => makeThenableResult(results.shift() ?? { data: null, error: null }));
  createAdminClient.mockReturnValue({ from });
  return { from };
}

describe('GET /api/admin/forensics/[jobId]', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('redacts manuscript-derived prose and seed/ledger artifact mentions from forensic payload surfaces', async () => {
    const { from } = mockAdminClient([
      {
        data: {
          id: 'job-1',
          user_id: 'user-1',
          manuscript_id: 101,
          job_type: 'evaluation',
          status: 'failed',
          phase: 'phase_3',
          phase_status: 'quality_gate',
          progress: {
            timeline: [{ stage: 'quality_gate', event: 'failed', reason: 'story_ledger_v1 contained the revealing premise beat.', timestamp: '2026-06-12T00:00:00.000Z' }],
            pipeline_failure_envelope: {
              pipeline_stage: 'quality_gate',
              failed_at: 'quality_gate',
              error_code: 'QG_FAILED',
            },
          },
          total_units: 1,
          completed_units: 0,
          failed_units: 1,
          last_error: 'story_map_seed_v1 leaked that the girl walked into the forest and whispered the secret name.',
          failure_code: 'QG_FAILED',
          created_at: '2026-06-12T00:00:00.000Z',
          updated_at: '2026-06-12T00:00:00.000Z',
          evaluation_result: null,
        },
        error: null,
      },
      {
        data: [
          {
            id: 'artifact-1',
            job_id: 'job-1',
            manuscript_id: 101,
            artifact_type: 'pass12_handoff_v1',
            artifact_version: '1',
            source_hash: 'hash-1',
            created_at: '2026-06-12T00:00:01.000Z',
            content: {
              schema_version: '1',
              pass1Output: { ok: true },
              pass2Output: { ok: true },
            },
          },
          {
            id: 'artifact-2',
            job_id: 'job-1',
            manuscript_id: 101,
            artifact_type: 'evaluation_result_v2',
            artifact_version: '1',
            source_hash: 'hash-2',
            created_at: '2026-06-12T00:00:02.000Z',
            content: {},
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: 'log-1',
            job_id: 'job-1',
            level: 'warn',
            stage: 'quality_gate',
            message: 'evaluation_seed_v1 noted the heroine remembers the old wound and hidden betrayal in the village.',
            metadata: { phase: 'quality_gate' },
            created_at: '2026-06-12T00:00:03.000Z',
          },
        ],
        error: null,
      },
      {
        data: {
          content: {
            artifact_type: 'failure_diagnosis_v1',
            version: 1,
            job_id: 'job-1',
            created_at: '2026-06-12T00:00:04.000Z',
            phase: 'phase_3',
            failure_code: 'QG_FAILED',
            failure_class: 'governance_blocked',
            failure_point: { stage: 'quality_gate' },
            user_safe_summary: 'Safe summary.',
            admin_summary: 'story_ledger_v1 indicates duplicate emotional beat rendering in output.',
            developer_summary: 'dream_evaluation_v1 diagnostics said the queen wept at the gate.',
            failed_checks: ['qg.summary_mismatch: fail'],
            failed_criteria: [],
            blocking_reasons: ['reason'],
            artifact_inventory: {
              present_artifacts: ['pass12_handoff_v1'],
              missing_expected_artifacts: ['evaluation_result_v2'],
            },
            repair_status: { attempted: false, outcome: 'not_attempted' },
            backward_kick_status: { triggered: false, reason: 'none' },
            recommended_next_action: 'Inspect story_map_seed_v1 and dream_evaluation_v1 payload lineage.',
            evidence_refs: [
              {
                artifact_type: 'evaluation_result_v2',
                excerpt: 'dream_evaluation_v1 excerpt: The dragon returned to the castle and the queen wept at the gate.',
              },
            ],
          },
        },
        error: null,
      },
      {
        data: { content: { criteria: [] } },
        error: null,
      },
      {
        data: null,
        error: null,
      },
    ]);

    const req = new NextRequest('http://localhost/api/admin/forensics/job-1');
    const response = await GET(req, { params: Promise.resolve({ jobId: 'job-1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.artifactQuality.grade).toBe('contaminated');
    expect(json.artifactQuality.contamination_start_artifact).toBe('evaluation_result_v2');
    expect(json.artifactQuality.weak_sipoc_stage).toBe('Quality Gate (Pass 4)');
    expect(json.stages.find((stage: { logs: Array<{ message: string }> }) => stage.logs.length > 0)?.logs[0].message).toBe('[redacted prose]');
    expect(json.failureDiagnosis.evidence_refs[0].excerpt).toBe('[redacted excerpt]');
    expect(json.job.last_error).toBe('[redacted prose]');
    expect(json.forensicPacket.root_cause_hint).toBe('[redacted prose]');

    const payload = JSON.stringify(json);
    expect(payload).not.toContain('The girl walked into the forest and whispered the secret name.');
    expect(payload).not.toContain('The heroine remembers the old wound and the hidden betrayal in the village.');
    expect(payload).not.toContain('The dragon returned to the castle and the queen wept at the gate.');
    expect(payload).not.toContain('story_map_seed_v1');
    expect(payload).not.toContain('evaluation_seed_v1');
    expect(payload).not.toContain('story_ledger_v1');
    expect(payload).not.toContain('dream_evaluation_v1');
    expect(payload).toContain('QG_FAILED');
    expect(payload).toContain('evaluation_result_v2');
    expect(from).toHaveBeenCalled();
  });
});
