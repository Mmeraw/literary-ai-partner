import { NextRequest } from 'next/server';
import { GET } from './route';

jest.mock('@/lib/admin/requireAdmin', () => ({
  requireAdmin: jest.fn(async () => null),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

const { createAdminClient } = require('@/lib/supabase/admin') as {
  createAdminClient: jest.Mock;
};

function makeQuery(result: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(result);
  return {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

describe('GET /api/admin/artifact-health', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('assigns registry completeness, accuracy, SIPOC metrics, and quality issues to artifacts', async () => {
    const jobsQuery = makeQuery({
      data: [
        {
          id: 'job-artifact-health',
          manuscript_id: 7519,
          user_id: 'user-1',
          job_type: 'evaluation',
          status: 'complete',
          phase: 'phase_2',
          phase_status: 'complete',
          failure_code: null,
          created_at: '2026-06-14T02:00:25.402Z',
          updated_at: '2026-06-14T02:22:09.016Z',
          completed_at: '2026-06-14T02:22:09.016Z',
          manuscripts: [{ title: 'Let the River Decide', word_count: 50000 }],
        },
      ],
      error: null,
    });
    const artifactsQuery = makeQuery({
      data: [
        {
          id: 'artifact-1',
          job_id: 'job-artifact-health',
          manuscript_id: 7519,
          artifact_type: 'evaluation_result_v2',
          artifact_version: 'v2',
          source_hash: 'hash',
          created_at: '2026-06-14T02:10:00.000Z',
          content: {
            schema_version: 'evaluation_result_v2',
            overview: { overall_score_0_100: 80 },
            criteria: [],
          },
        },
      ],
      error: null,
    });
    const from = jest
      .fn()
      .mockReturnValueOnce(jobsQuery)
      .mockReturnValueOnce(artifactsQuery);
    createAdminClient.mockReturnValue({ from });

    const req = new NextRequest('http://localhost/api/admin/artifact-health?job_id=job-artifact-health');
    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.summary.jobs).toBe(1);
    expect(json.summary.artifacts).toBe(1);
    expect(json.summary.expectedArtifacts).toBeGreaterThanOrEqual(28);
    expect(json.summary.missingExpectedArtifacts).toBeGreaterThan(0);
    expect(json.summary.contractGapArtifacts).toBe(1);
    expect(json.expectedArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jobId: 'job-artifact-health',
          artifactType: 'evaluation_result_v2',
          present: true,
          quality: expect.objectContaining({ certified: false, contractStatus: 'degraded' }),
          registry: expect.objectContaining({
            completenessMetric: expect.stringContaining('13 canonical criteria'),
            accuracyMetric: expect.stringContaining('single source of truth'),
          }),
        }),
      ]),
    );
    expect(json.artifacts[0].artifactType).toBe('evaluation_result_v2');
    expect(json.artifacts[0].registered).toBe(true);
    expect(json.artifacts[0].registry.completenessMetric).toContain('13 canonical criteria');
    expect(json.artifacts[0].registry.accuracyMetric).toContain('single source of truth');
    expect(json.artifacts[0].registry.producerOutputMetrics.length).toBeGreaterThan(0);
    expect(json.artifacts[0].quality.certified).toBe(false);
    expect(json.artifacts[0].quality.missingFields).toEqual(expect.arrayContaining(['metrics', 'enrichment']));
  });
});
