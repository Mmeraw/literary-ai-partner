import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildEvaluationSeedBenchmark,
  type EvaluationMode,
  type EvaluationSeedBenchmarkArtifact,
  type EvaluationSeedBenchmarkRun,
  type EvaluationSeedRunArtifacts,
  type SeedArtifact,
  type StoryLedgerGoldExpectation,
} from './evaluationSeedBenchmark';
import { sha256Hex, upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';

const BENCHMARK_ARTIFACT_TYPE = 'evaluation_seed_benchmark_v1' as const;

const RUN_ARTIFACT_TYPES = [
  'story_seed_v1',
  'evaluation_seed_v1',
  'chunk_evidence_index_v1',
  'accepted_story_ledger_v1',
  'pass12_handoff_v1',
  'evaluation_result_v2',
] as const;

type RunArtifactType = typeof RUN_ARTIFACT_TYPES[number];

type ArtifactRow = {
  artifact_type: string;
  content: unknown;
  source_hash?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type JobRow = {
  id: string;
  manuscript_id: number | string;
  evaluation_project_id?: string | null;
  status?: string | null;
  progress?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

export type PersistEvaluationSeedBenchmarkInput = {
  supabase: SupabaseClient;
  baselineJobId: string;
  seedJobId: string;
  gold?: StoryLedgerGoldExpectation;
};

export type PersistEvaluationSeedBenchmarkResult = {
  artifactId: string;
  artifact: EvaluationSeedBenchmarkArtifact;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function msBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return endMs - startMs;
}

function normalizeEvaluationMode(raw: unknown, wordCount: number): EvaluationMode {
  if (raw === 'short_form_evaluation' || raw === 'long_form_evaluation' || raw === 'long_form_multi_layer_evaluation') {
    return raw;
  }
  return wordCount >= 25_000 ? 'long_form_multi_layer_evaluation' : 'short_form_evaluation';
}

function contentFor(rows: ArtifactRow[], artifactType: RunArtifactType): unknown {
  return rows.find((row) => row.artifact_type === artifactType)?.content;
}

function getProgressMetric(progress: unknown, key: string): unknown {
  return isRecord(progress) ? progress[key] : undefined;
}

function deriveWordCount(job: JobRow, rows: ArtifactRow[]): number {
  const evaluationResult = contentFor(rows, 'evaluation_result_v2');
  const acceptedLedger = contentFor(rows, 'accepted_story_ledger_v1');
  const progress = job.progress;

  const candidates = [
    isRecord(evaluationResult) ? evaluationResult.word_count : undefined,
    isRecord(evaluationResult) && isRecord(evaluationResult.metadata) ? evaluationResult.metadata.word_count : undefined,
    isRecord(acceptedLedger) ? acceptedLedger.word_count : undefined,
    isRecord(acceptedLedger) && isRecord(acceptedLedger.metadata) ? acceptedLedger.metadata.word_count : undefined,
    getProgressMetric(progress, 'word_count'),
    getProgressMetric(progress, 'wordCount'),
  ];

  return firstNumber(...candidates) ?? 0;
}

function deriveTotalMs(job: JobRow, rows: ArtifactRow[]): number {
  const evaluationResult = contentFor(rows, 'evaluation_result_v2');
  const progress = job.progress;
  const candidates = [
    isRecord(evaluationResult) ? evaluationResult.total_ms : undefined,
    isRecord(evaluationResult) ? evaluationResult.runtime_ms : undefined,
    isRecord(evaluationResult) && isRecord(evaluationResult.metadata) ? evaluationResult.metadata.total_ms : undefined,
    isRecord(evaluationResult) && isRecord(evaluationResult.metadata) ? evaluationResult.metadata.runtime_ms : undefined,
    getProgressMetric(progress, 'total_ms'),
    getProgressMetric(progress, 'runtime_ms'),
    getProgressMetric(progress, 'elapsed_ms'),
  ];

  return firstNumber(...candidates) ?? msBetween(job.created_at, job.completed_at ?? job.updated_at) ?? 0;
}

function deriveEvaluationMode(job: JobRow, rows: ArtifactRow[], wordCount: number): EvaluationMode {
  const evaluationResult = contentFor(rows, 'evaluation_result_v2');
  const evaluationSeed = contentFor(rows, 'evaluation_seed_v1');
  const progress = job.progress;
  return normalizeEvaluationMode(
    firstString(
      isRecord(evaluationSeed) ? evaluationSeed.scope_mode : undefined,
      isRecord(evaluationResult) ? evaluationResult.evaluation_mode : undefined,
      isRecord(evaluationResult) && isRecord(evaluationResult.metadata) ? evaluationResult.metadata.evaluation_mode : undefined,
      getProgressMetric(progress, 'evaluation_mode'),
    ),
    wordCount,
  );
}

function mapRunArtifacts(rows: ArtifactRow[]): EvaluationSeedRunArtifacts {
  return {
    story_seed_v1: contentFor(rows, 'story_seed_v1') as SeedArtifact | undefined,
    evaluation_seed_v1: contentFor(rows, 'evaluation_seed_v1') as SeedArtifact | undefined,
    chunk_evidence_index_v1: contentFor(rows, 'chunk_evidence_index_v1'),
    accepted_story_ledger_v1: contentFor(rows, 'accepted_story_ledger_v1') as Record<string, unknown> | undefined,
    pass12_handoff_v1: contentFor(rows, 'pass12_handoff_v1'),
    evaluation_result_v2: contentFor(rows, 'evaluation_result_v2'),
  };
}

async function readJob(supabase: SupabaseClient, jobId: string): Promise<JobRow> {
  const { data, error } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, evaluation_project_id, status, progress, created_at, updated_at, completed_at')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw new Error(`Failed to read evaluation job ${jobId}: ${error.message}`);
  if (!data) throw new Error(`Evaluation job not found: ${jobId}`);
  return data as JobRow;
}

async function readRunArtifacts(supabase: SupabaseClient, jobId: string): Promise<ArtifactRow[]> {
  const { data, error } = await supabase
    .from('evaluation_artifacts')
    .select('artifact_type, content, source_hash, created_at, updated_at')
    .eq('job_id', jobId)
    .in('artifact_type', [...RUN_ARTIFACT_TYPES])
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to read evaluation artifacts for ${jobId}: ${error.message}`);

  const latestByType = new Map<string, ArtifactRow>();
  for (const row of (data ?? []) as ArtifactRow[]) {
    if (!latestByType.has(row.artifact_type)) latestByType.set(row.artifact_type, row);
  }
  return [...latestByType.values()];
}

export async function readEvaluationSeedBenchmarkRun(
  supabase: SupabaseClient,
  jobId: string,
  runIdPrefix: 'baseline' | 'seed',
): Promise<EvaluationSeedBenchmarkRun> {
  const job = await readJob(supabase, jobId);
  const rows = await readRunArtifacts(supabase, jobId);
  const wordCount = deriveWordCount(job, rows);

  return {
    run_id: `${runIdPrefix}:${job.id}`,
    job_id: job.id,
    manuscript_id: Number(job.manuscript_id),
    word_count: wordCount,
    evaluation_mode: deriveEvaluationMode(job, rows, wordCount),
    total_ms: deriveTotalMs(job, rows),
    artifacts: mapRunArtifacts(rows),
  };
}

export function buildBenchmarkSourceHash(artifact: EvaluationSeedBenchmarkArtifact): string {
  return sha256Hex(JSON.stringify({
    artifact_type: artifact.artifact_type,
    artifact_version: artifact.artifact_version,
    baseline_run_id: artifact.baseline_run_id,
    seed_run_id: artifact.seed_run_id,
    baseline_total_ms: artifact.baseline_total_ms,
    seed_total_ms: artifact.seed_total_ms,
    baseline_story_ledger_score: artifact.baseline_story_ledger_score,
    seed_story_ledger_score: artifact.seed_story_ledger_score,
    ledger_quality_delta: artifact.ledger_quality_delta,
    path_issues: artifact.path_issues,
    recommendation: artifact.recommendation,
  }));
}

export async function buildAndPersistEvaluationSeedBenchmark(
  input: PersistEvaluationSeedBenchmarkInput,
): Promise<PersistEvaluationSeedBenchmarkResult> {
  const baseline = await readEvaluationSeedBenchmarkRun(input.supabase, input.baselineJobId, 'baseline');
  const seed = await readEvaluationSeedBenchmarkRun(input.supabase, input.seedJobId, 'seed');

  if (baseline.manuscript_id !== seed.manuscript_id) {
    throw new Error(
      `Cannot benchmark different manuscripts: baseline manuscript ${baseline.manuscript_id}, seed manuscript ${seed.manuscript_id}`,
    );
  }

  const artifact = buildEvaluationSeedBenchmark({ baseline, seed, gold: input.gold });
  const artifactId = await upsertEvaluationArtifact({
    supabase: input.supabase,
    jobId: seed.job_id,
    manuscriptId: seed.manuscript_id,
    artifactType: BENCHMARK_ARTIFACT_TYPE,
    artifactVersion: 'v1',
    sourceHash: buildBenchmarkSourceHash(artifact),
    content: artifact,
  });

  return { artifactId, artifact };
}
