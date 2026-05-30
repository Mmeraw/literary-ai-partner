import {
  buildAndPersistEvaluationSeedBenchmark,
  buildBenchmarkSourceHash,
  readEvaluationSeedBenchmarkRun,
} from '../../../../lib/evaluation/seed/evaluationSeedBenchmarkPersistence';
import type { EvaluationSeedBenchmarkArtifact } from '../../../../lib/evaluation/seed/evaluationSeedBenchmark';

jest.mock('../../../../lib/evaluation/artifactPersistence', () => ({
  sha256Hex: (input: string) => `hash:${input.length}`,
  upsertEvaluationArtifact: jest.fn(async () => 'artifact:evaluation_seed_benchmark_v1'),
}));

const { upsertEvaluationArtifact } = jest.requireMock('../../../../lib/evaluation/artifactPersistence') as {
  upsertEvaluationArtifact: jest.Mock;
};

type QueryStep = {
  table: string;
  select?: string;
  eq?: Array<[string, unknown]>;
  in?: Array<[string, unknown[]]>;
  order?: Array<[string, unknown]>;
  maybeSingle?: boolean;
};

function makeSupabase(fixtures: {
  jobs: Record<string, any>;
  artifacts: Record<string, any[]>;
}) {
  const steps: QueryStep[] = [];

  const client = {
    from(table: string) {
      const step: QueryStep = { table };
      steps.push(step);

      const builder: any = {
        select(value: string) {
          step.select = value;
          return builder;
        },
        eq(column: string, value: unknown) {
          step.eq = [...(step.eq ?? []), [column, value]];
          return builder;
        },
        in(column: string, value: unknown[]) {
          step.in = [...(step.in ?? []), [column, value]];
          return builder;
        },
        order(column: string, options: unknown) {
          step.order = [...(step.order ?? []), [column, options]];
          return builder;
        },
        async maybeSingle() {
          step.maybeSingle = true;
          const jobId = step.eq?.find(([column]) => column === 'id')?.[1] as string;
          return { data: fixtures.jobs[jobId] ?? null, error: null };
        },
        then(resolve: (value: unknown) => unknown) {
          const jobId = step.eq?.find(([column]) => column === 'job_id')?.[1] as string;
          return Promise.resolve({ data: fixtures.artifacts[jobId] ?? [], error: null }).then(resolve);
        },
      };

      return builder;
    },
    __steps: steps,
  };

  return client as any;
}

const acceptedLedger = {
  layers: {
    canonical_identity_layer: {
      identity_groups: [
        { character_id: 'aw:edna', canonical_name: 'Edna Pontellier', aliases: ['Edna Pontellier'], evidence_coordinates: ['chapter:1'] },
      ],
    },
    pov_structure_layer: {
      pov_characters: [
        { character_id: 'aw:edna', evidence_coordinates: ['chapter:1'] },
      ],
    },
    threat_antagonist_ending_layer: {
      pressure_systems: [
        { source_label: 'Sea', source_kind: 'non_character', evidence_coordinates: ['chapter:39'] },
      ],
    },
    relationship_network_layer: {
      relationship_pairs: [],
    },
  },
};

const storySeed = {
  artifact_type: 'story_seed_v1',
  authority: 'seed_only',
  artifact_status: 'created',
  claims: [
    { claim_id: 'seed:1', claim_status: 'confirmed_by_evidence', hypothesis: 'Edna appears central.' },
  ],
};

const evaluationSeed = {
  artifact_type: 'evaluation_seed_v1',
  authority: 'seed_only',
  artifact_status: 'created',
  scope_mode: 'long_form_multi_layer_evaluation',
  claims: [
    { claim_id: 'seed:2', claim_status: 'drift_detected', hypothesis: 'Robert may be overweighted.' },
  ],
};

function artifactsFor(jobId: string, includeSeeds: boolean) {
  return [
    ...(includeSeeds
      ? [
          { artifact_type: 'story_seed_v1', content: storySeed, created_at: '2026-05-30T00:00:01Z' },
          { artifact_type: 'evaluation_seed_v1', content: evaluationSeed, created_at: '2026-05-30T00:00:02Z' },
        ]
      : []),
    { artifact_type: 'chunk_evidence_index_v1', content: { chunks: [{ id: 'chunk:1' }] }, created_at: '2026-05-30T00:00:03Z' },
    { artifact_type: 'accepted_story_ledger_v1', content: acceptedLedger, created_at: '2026-05-30T00:00:04Z' },
    { artifact_type: 'pass12_handoff_v1', content: { artifact_type: 'pass12_handoff_v1' }, created_at: '2026-05-30T00:00:05Z' },
    { artifact_type: 'evaluation_result_v2', content: { artifact_type: 'evaluation_result_v2', word_count: 30100, runtime_ms: jobId === 'seed-job' ? 105000 : 100000 }, created_at: '2026-05-30T00:00:06Z' },
  ];
}

describe('evaluation seed benchmark persistence wiring', () => {
  beforeEach(() => {
    upsertEvaluationArtifact.mockClear();
  });

  it('hydrates a benchmark run from completed evaluation artifacts', async () => {
    const supabase = makeSupabase({
      jobs: {
        'seed-job': {
          id: 'seed-job',
          manuscript_id: 7307,
          evaluation_project_id: 'project:1',
          progress: {},
          created_at: '2026-05-30T00:00:00Z',
          completed_at: '2026-05-30T00:02:00Z',
        },
      },
      artifacts: {
        'seed-job': artifactsFor('seed-job', true),
      },
    });

    const run = await readEvaluationSeedBenchmarkRun(supabase, 'seed-job', 'seed');

    expect(run.run_id).toBe('seed:seed-job');
    expect(run.manuscript_id).toBe(7307);
    expect(run.word_count).toBe(30100);
    expect(run.total_ms).toBe(105000);
    expect(run.evaluation_mode).toBe('long_form_multi_layer_evaluation');
    expect(run.artifacts.story_seed_v1).toEqual(storySeed);
    expect(run.artifacts.evaluation_seed_v1).toEqual(evaluationSeed);
  });

  it('builds and persists evaluation_seed_benchmark_v1 on the SEED job', async () => {
    const supabase = makeSupabase({
      jobs: {
        'baseline-job': {
          id: 'baseline-job',
          manuscript_id: 7307,
          evaluation_project_id: 'project:1',
          progress: {},
          created_at: '2026-05-30T00:00:00Z',
          completed_at: '2026-05-30T00:02:00Z',
        },
        'seed-job': {
          id: 'seed-job',
          manuscript_id: 7307,
          evaluation_project_id: 'project:1',
          progress: {},
          created_at: '2026-05-30T00:00:00Z',
          completed_at: '2026-05-30T00:02:10Z',
        },
      },
      artifacts: {
        'baseline-job': artifactsFor('baseline-job', false),
        'seed-job': artifactsFor('seed-job', true),
      },
    });

    const result = await buildAndPersistEvaluationSeedBenchmark({
      supabase,
      baselineJobId: 'baseline-job',
      seedJobId: 'seed-job',
    });

    expect(result.artifactId).toBe('artifact:evaluation_seed_benchmark_v1');
    expect(result.artifact.artifact_type).toBe('evaluation_seed_benchmark_v1');
    expect(result.artifact.baseline_run_id).toBe('baseline:baseline-job');
    expect(result.artifact.seed_run_id).toBe('seed:seed-job');
    expect(upsertEvaluationArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase,
        jobId: 'seed-job',
        manuscriptId: 7307,
        artifactType: 'evaluation_seed_benchmark_v1',
        artifactVersion: 'v1',
        content: result.artifact,
      }),
    );
  });

  it('refuses to compare different manuscripts', async () => {
    const supabase = makeSupabase({
      jobs: {
        'baseline-job': {
          id: 'baseline-job',
          manuscript_id: 111,
          progress: {},
        },
        'seed-job': {
          id: 'seed-job',
          manuscript_id: 222,
          progress: {},
        },
      },
      artifacts: {
        'baseline-job': artifactsFor('baseline-job', false),
        'seed-job': artifactsFor('seed-job', true),
      },
    });

    await expect(
      buildAndPersistEvaluationSeedBenchmark({
        supabase,
        baselineJobId: 'baseline-job',
        seedJobId: 'seed-job',
      }),
    ).rejects.toThrow('Cannot benchmark different manuscripts');

    expect(upsertEvaluationArtifact).not.toHaveBeenCalled();
  });

  it('uses a stable benchmark source hash from material benchmark fields', () => {
    const artifact = {
      artifact_type: 'evaluation_seed_benchmark_v1',
      artifact_version: 'v1',
      baseline_run_id: 'baseline:a',
      seed_run_id: 'seed:b',
      baseline_total_ms: 100,
      seed_total_ms: 120,
      baseline_story_ledger_score: 70,
      seed_story_ledger_score: 84,
      ledger_quality_delta: 14,
      path_issues: [],
      recommendation: 'seed_improves_quality_but_costs_latency',
    } as EvaluationSeedBenchmarkArtifact;

    expect(buildBenchmarkSourceHash(artifact)).toBe(buildBenchmarkSourceHash({ ...artifact }));
  });
});
