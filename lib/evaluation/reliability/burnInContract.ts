import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

export const BURN_IN_SCHEMA_VERSION = 1 as const;

export type AuthorExposureVerdict = 'safe_exposed' | 'safely_blocked' | 'unsafe_exposed';

export interface BurnInCaseManifest {
  case_id: string;
  outcome_path: string;
  outcome_sha256: string;
}

export interface BurnInCohortManifest {
  schema_version: typeof BURN_IN_SCHEMA_VERSION;
  cohort_id: string;
  source: {
    repository: string;
    commit_sha: string;
    fixture_set_version: string;
    source_kind: 'deterministic_fixture' | 'staging_replay' | 'controlled_production_like';
  };
  toolchain: { node: string; npm: string };
  target_completion_rate: number;
  cases: BurnInCaseManifest[];
}

export interface BurnInOutcome {
  schema_version: typeof BURN_IN_SCHEMA_VERSION;
  case_id: string;
  terminal_status: 'complete' | 'failed';
  terminal_failure_code: string | null;
  attempts: number;
  retry_exhausted: boolean;
  chunks_declared: number;
  chunks_consumed: number;
  author_exposure_verdict: AuthorExposureVerdict;
}

export interface BurnInReport {
  schema_version: typeof BURN_IN_SCHEMA_VERSION;
  cohort_id: string;
  cohort_manifest_sha256: string;
  source: BurnInCohortManifest['source'];
  toolchain: BurnInCohortManifest['toolchain'];
  cohort_size: number;
  completed: number;
  failed: number;
  completion_rate: number;
  target_completion_rate: number;
  terminal_failure_distribution: Record<string, number>;
  total_attempts: number;
  retries: number;
  retry_exhausted: number;
  chunks_declared: number;
  chunks_consumed: number;
  chunk_coverage_rate: number;
  author_exposure_distribution: Record<AuthorExposureVerdict, number>;
  violations: string[];
  pass: boolean;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest`);
}

export function loadBurnInCohort(manifestPath: string): {
  manifest: BurnInCohortManifest;
  manifestSha256: string;
  outcomes: BurnInOutcome[];
} {
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as BurnInCohortManifest;
  if (manifest.schema_version !== BURN_IN_SCHEMA_VERSION) throw new Error('Unsupported burn-in manifest schema');
  if (!manifest.cohort_id || !manifest.source?.commit_sha || !manifest.source?.fixture_set_version) {
    throw new Error('Burn-in manifest is missing immutable source provenance');
  }
  if (!/^[a-f0-9]{40}$/.test(manifest.source.commit_sha)) {
    throw new Error('Burn-in source commit_sha must be a full lowercase Git SHA');
  }
  if (!['deterministic_fixture', 'staging_replay', 'controlled_production_like'].includes(manifest.source.source_kind)) {
    throw new Error('Burn-in manifest has an invalid source_kind');
  }
  if (!manifest.toolchain?.node || !manifest.toolchain?.npm) {
    throw new Error('Burn-in manifest is missing toolchain provenance');
  }
  if (!(manifest.target_completion_rate > 0 && manifest.target_completion_rate <= 1)) {
    throw new Error('target_completion_rate must be in (0, 1]');
  }
  const ids = new Set<string>();
  const base = dirname(manifestPath);
  const outcomes = manifest.cases.map((entry) => {
    if (!entry.case_id || ids.has(entry.case_id)) throw new Error(`Duplicate or empty case_id: ${entry.case_id}`);
    ids.add(entry.case_id);
    assertSha256(entry.outcome_sha256, `${entry.case_id}.outcome_sha256`);
    const outcomePath = resolve(base, entry.outcome_path);
    const relativePath = relative(base, outcomePath);
    if (relativePath.startsWith('..') || relativePath.includes(':')) {
      throw new Error(`Outcome path escapes cohort directory: ${entry.case_id}`);
    }
    const bytes = readFileSync(outcomePath);
    if (sha256(bytes) !== entry.outcome_sha256) throw new Error(`Outcome digest mismatch: ${entry.case_id}`);
    const outcome = JSON.parse(bytes.toString('utf8')) as BurnInOutcome;
    if (outcome.schema_version !== BURN_IN_SCHEMA_VERSION || outcome.case_id !== entry.case_id) {
      throw new Error(`Outcome identity mismatch: ${entry.case_id}`);
    }
    if (!['complete', 'failed'].includes(outcome.terminal_status)) {
      throw new Error(`Invalid terminal status: ${entry.case_id}`);
    }
    if (!['safe_exposed', 'safely_blocked', 'unsafe_exposed'].includes(outcome.author_exposure_verdict)) {
      throw new Error(`Invalid author exposure verdict: ${entry.case_id}`);
    }
    if (![outcome.attempts, outcome.chunks_declared, outcome.chunks_consumed]
      .every((value) => Number.isSafeInteger(value) && value >= 0)) {
      throw new Error(`Invalid numeric telemetry: ${entry.case_id}`);
    }
    return outcome;
  });
  return { manifest, manifestSha256: sha256(manifestBytes), outcomes };
}

export function assessBurnIn(
  manifest: BurnInCohortManifest,
  manifestSha256: string,
  outcomes: readonly BurnInOutcome[],
): BurnInReport {
  assertSha256(manifestSha256, 'cohort_manifest_sha256');
  const violations: string[] = [];
  const failures: Record<string, number> = {};
  const exposure: Record<AuthorExposureVerdict, number> = {
    safe_exposed: 0,
    safely_blocked: 0,
    unsafe_exposed: 0,
  };
  let completed = 0;
  let totalAttempts = 0;
  let retryExhausted = 0;
  let chunksDeclared = 0;
  let chunksConsumed = 0;

  if (outcomes.length !== manifest.cases.length) violations.push('cohort_cardinality_mismatch');
  if (outcomes.length < 50) violations.push('cohort_too_small_for_98_percent_gate');
  for (const outcome of outcomes) {
    completed += outcome.terminal_status === 'complete' ? 1 : 0;
    totalAttempts += Math.max(0, outcome.attempts);
    retryExhausted += outcome.retry_exhausted ? 1 : 0;
    chunksDeclared += outcome.chunks_declared;
    chunksConsumed += outcome.chunks_consumed;
    exposure[outcome.author_exposure_verdict] += 1;
    if (outcome.attempts < 1) violations.push(`invalid_attempt_count:${outcome.case_id}`);
    if (outcome.chunks_consumed > outcome.chunks_declared) violations.push(`chunk_overconsumption:${outcome.case_id}`);
    if (outcome.terminal_status === 'failed') {
      const code = outcome.terminal_failure_code?.trim() || 'UNCLASSIFIED';
      failures[code] = (failures[code] ?? 0) + 1;
      if (code === 'UNCLASSIFIED') violations.push(`unclassified_terminal_failure:${outcome.case_id}`);
      if (outcome.author_exposure_verdict === 'safe_exposed') violations.push(`failed_job_exposed:${outcome.case_id}`);
    } else {
      if (outcome.terminal_failure_code !== null) violations.push(`completed_with_failure_code:${outcome.case_id}`);
      if (outcome.retry_exhausted) violations.push(`completed_with_retry_exhaustion:${outcome.case_id}`);
      if (outcome.chunks_consumed !== outcome.chunks_declared) violations.push(`incomplete_chunk_coverage:${outcome.case_id}`);
      if (outcome.author_exposure_verdict !== 'safe_exposed') violations.push(`completed_job_not_safely_exposed:${outcome.case_id}`);
    }
  }
  if (exposure.unsafe_exposed > 0) violations.push('unsafe_author_exposure');
  const completionRate = outcomes.length === 0 ? 0 : completed / outcomes.length;
  if (completionRate < manifest.target_completion_rate) violations.push('completion_slo_missed');
  const chunkCoverageRate = chunksDeclared === 0 ? 1 : chunksConsumed / chunksDeclared;
  return {
    schema_version: BURN_IN_SCHEMA_VERSION,
    cohort_id: manifest.cohort_id,
    cohort_manifest_sha256: manifestSha256,
    source: manifest.source,
    toolchain: manifest.toolchain,
    cohort_size: outcomes.length,
    completed,
    failed: outcomes.length - completed,
    completion_rate: completionRate,
    target_completion_rate: manifest.target_completion_rate,
    terminal_failure_distribution: Object.fromEntries(Object.entries(failures).sort()),
    total_attempts: totalAttempts,
    retries: Math.max(0, totalAttempts - outcomes.length),
    retry_exhausted: retryExhausted,
    chunks_declared: chunksDeclared,
    chunks_consumed: chunksConsumed,
    chunk_coverage_rate: chunkCoverageRate,
    author_exposure_distribution: exposure,
    violations: [...new Set(violations)].sort(),
    pass: violations.length === 0,
  };
}
