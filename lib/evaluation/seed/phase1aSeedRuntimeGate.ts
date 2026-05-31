import type { SupabaseClient } from '@supabase/supabase-js';
import { stableSourceHash, upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';
import { countWords } from '@/lib/evaluation/pipeline/submissionScope';
import { buildSeedFitGapReport, type SeedFitGapReportV1 } from '@/lib/evaluation/seed/seedCompletenessGuard';
import { buildCompleteEvaluationSeedV1, buildCompleteStorySeedV1 } from '@/lib/evaluation/seed/seedScaffoldFactory';

type PersistableSeedArtifactType = 'story_seed_v1' | 'evaluation_seed_v1' | 'seed_fit_gap_report_v1';

const persistSeedArtifact = upsertEvaluationArtifact as unknown as (params: {
  supabase: SupabaseClient<any, any, any>;
  jobId: string;
  manuscriptId: number;
  artifactType: PersistableSeedArtifactType;
  artifactVersion: string;
  sourceHash: string;
  content: unknown;
}) => Promise<string>;

export type Phase1aSeedGateResult = {
  ok: true;
  storySeed: unknown;
  evaluationSeed: unknown;
  fitGapReport: SeedFitGapReportV1;
} | {
  ok: false;
  error_code: 'SEED_FIT_GAP_BLOCKED';
  error_message: string;
  fitGapReport: SeedFitGapReportV1;
};

export async function ensureCompleteSeedsBeforePhase1a(args: {
  supabase: SupabaseClient<any, any, any>;
  jobId: string;
  manuscriptId: number;
  userId: string;
  manuscriptText: string;
  workType?: string | null;
}): Promise<Phase1aSeedGateResult> {
  const now = new Date().toISOString();
  const seedTypes = ['story_seed_v1', 'evaluation_seed_v1'] as const;

  const { data: existingRows, error: readError } = await args.supabase
    .from('evaluation_artifacts')
    .select('artifact_type, content')
    .eq('job_id', args.jobId)
    .in('artifact_type', [...seedTypes]);

  if (readError) {
    throw new Error(`SEED_ARTIFACT_READ_FAILED: ${readError.message}`);
  }

  const existing = new Map<string, unknown>();
  for (const row of existingRows ?? []) {
    if (row && typeof row === 'object' && typeof (row as { artifact_type?: unknown }).artifact_type === 'string') {
      existing.set((row as { artifact_type: string }).artifact_type, (row as { content?: unknown }).content);
    }
  }

  let storySeed = existing.get('story_seed_v1');
  if (!storySeed) {
    storySeed = buildCompleteStorySeedV1({ generatedAt: now });
    await persistSeedArtifact({
      supabase: args.supabase,
      jobId: args.jobId,
      manuscriptId: args.manuscriptId,
      artifactType: 'story_seed_v1',
      artifactVersion: 'story_seed_v1',
      sourceHash: stableSourceHash({
        jobId: args.jobId,
        manuscriptId: args.manuscriptId,
        userId: args.userId,
        manuscriptText: args.manuscriptText,
        promptVersion: 'story_seed_v1:complete_scaffold',
        model: 'seed_scaffold_factory',
      }),
      content: storySeed,
    });
  }

  let evaluationSeed = existing.get('evaluation_seed_v1');
  if (!evaluationSeed) {
    evaluationSeed = buildCompleteEvaluationSeedV1({
      generatedAt: now,
      wordCount: countWords(args.manuscriptText),
      workType: args.workType,
    });
    await persistSeedArtifact({
      supabase: args.supabase,
      jobId: args.jobId,
      manuscriptId: args.manuscriptId,
      artifactType: 'evaluation_seed_v1',
      artifactVersion: 'evaluation_seed_v1',
      sourceHash: stableSourceHash({
        jobId: args.jobId,
        manuscriptId: args.manuscriptId,
        userId: args.userId,
        manuscriptText: args.manuscriptText,
        promptVersion: 'evaluation_seed_v1:complete_scaffold',
        model: 'seed_scaffold_factory',
      }),
      content: evaluationSeed,
    });
  }

  const fitGapReport = buildSeedFitGapReport({ storySeed, evaluationSeed, generatedAt: now });

  await persistSeedArtifact({
    supabase: args.supabase,
    jobId: args.jobId,
    manuscriptId: args.manuscriptId,
    artifactType: 'seed_fit_gap_report_v1',
    artifactVersion: 'seed_fit_gap_report_v1',
    sourceHash: stableSourceHash({
      jobId: args.jobId,
      manuscriptId: args.manuscriptId,
      userId: args.userId,
      manuscriptText: args.manuscriptText,
      promptVersion: 'seed_fit_gap_report_v1:phase1a_gate',
      model: 'seed_completeness_guard',
    }),
    content: fitGapReport,
  });

  if (fitGapReport.status === 'blocked') {
    return {
      ok: false,
      error_code: 'SEED_FIT_GAP_BLOCKED',
      error_message: `Seed fit-gap blocked Phase 1A: ${fitGapReport.gaps.length} required section(s) missing.`,
      fitGapReport,
    };
  }

  return { ok: true, storySeed, evaluationSeed, fitGapReport };
}
