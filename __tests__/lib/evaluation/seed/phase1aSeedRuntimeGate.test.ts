import { buildCompleteEvaluationSeedV1, buildCompleteStorySeedV1 } from '@/lib/evaluation/seed/seedScaffoldFactory';
import { ensureCompleteSeedsBeforePhase1a } from '@/lib/evaluation/seed/phase1aSeedRuntimeGate';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';

jest.mock('@/lib/evaluation/artifactPersistence', () => ({
  stableSourceHash: jest.fn(() => 'stable-source-hash'),
  upsertEvaluationArtifact: jest.fn(async () => 'artifact-id'),
}));

const upsertMock = upsertEvaluationArtifact as jest.MockedFunction<typeof upsertEvaluationArtifact>;

function supabaseWithSeedRows(rows: Array<{ artifact_type: string; content: unknown }>) {
  return {
    from: jest.fn((table: string) => {
      expect(table).toBe('evaluation_artifacts');
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(async () => ({ data: rows, error: null })),
          })),
        })),
      };
    }),
  } as any;
}

const baseArgs = {
  jobId: '11111111-1111-4111-8111-111111111111',
  manuscriptId: 7723,
  userId: '22222222-2222-4222-8222-222222222222',
  manuscriptText: 'This is a short manuscript excerpt used for seed routing proof.'.repeat(20),
  workType: 'novel',
};

describe('ensureCompleteSeedsBeforePhase1a', () => {
  beforeEach(() => {
    upsertMock.mockClear();
  });

  test('repairs legacy malformed seed rows before building the fit-gap report', async () => {
    const result = await ensureCompleteSeedsBeforePhase1a({
      ...baseArgs,
      supabase: supabaseWithSeedRows([
        { artifact_type: 'story_map_seed_v1', content: { artifact_type: 'story_map_seed_v1', authority: 'seed_only' } },
        { artifact_type: 'evaluation_seed_v1', content: { artifact_type: 'evaluation_seed_v1', authority: 'seed_only' } },
      ]),
    });

    expect(result.ok).toBe(true);
    expect(result.fitGapReport.status).toBe('passed');
    expect(result.fitGapReport.gaps).toHaveLength(0);

    const persistedTypes = upsertMock.mock.calls.map(([params]) => params.artifactType).sort();
    expect(persistedTypes).toEqual([
      'evaluation_seed_v1',
      'seed_fit_gap_report_v1',
      'story_map_seed_v1',
    ]);
  });

  test('reuses complete seed rows and only persists the fit-gap report', async () => {
    const completeStorySeed = buildCompleteStorySeedV1({ generatedAt: '2026-07-15T00:00:00.000Z' });
    const completeEvaluationSeed = buildCompleteEvaluationSeedV1({
      generatedAt: '2026-07-15T00:00:00.000Z',
      wordCount: 120,
      workType: 'novel',
    });

    const result = await ensureCompleteSeedsBeforePhase1a({
      ...baseArgs,
      supabase: supabaseWithSeedRows([
        { artifact_type: 'story_map_seed_v1', content: completeStorySeed },
        { artifact_type: 'evaluation_seed_v1', content: completeEvaluationSeed },
      ]),
    });

    expect(result.ok).toBe(true);
    expect(result.fitGapReport.status).toBe('passed');

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0].artifactType).toBe('seed_fit_gap_report_v1');
  });
});
