import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sha256Hex, upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';

export const PHASE0_AUTHORITY_REGISTRY_PATH = 'docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md';

export type Phase0AuthorityProofStatus = 'valid' | 'degraded' | 'blocked';

export type AuthorityFileReader = (path: string) => Promise<string | null | undefined>;

export type Phase0AuthorityProofArtifact = {
  artifact_id: string;
  artifact_type: 'phase0_authority_proof_v1';
  schema_version: 'phase0_authority_proof_v1';
  job_id: string;
  manuscript_id: number;
  manuscript_version_id: string | null;
  registry_path: typeof PHASE0_AUTHORITY_REGISTRY_PATH;
  registry_checksum: string | null;
  loaded_authority_paths: string[];
  missing_authority_paths: string[];
  authority_checksums: Record<string, string>;
  loaded_at: string;
  status: Phase0AuthorityProofStatus;
  blocking_reason_codes: string[];
  schema_valid: boolean;
  semantic_status: 'valid' | 'degraded_with_reasons' | 'blocked';
  is_resume_safe: boolean;
};

export type BuildPhase0AuthorityProofInput = {
  jobId: string;
  manuscriptId: number;
  manuscriptVersionId?: string | null;
  registryText: string | null | undefined;
  readAuthorityFile: AuthorityFileReader;
  now?: string;
};

export type PersistPhase0AuthorityProofInput = BuildPhase0AuthorityProofInput & {
  supabase: SupabaseClient;
};

function isNonEmptyPath(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('#')) return false;
  if (trimmed.startsWith('```')) return false;
  if (!trimmed.includes('/')) return false;
  return trimmed.endsWith('.md') || trimmed.endsWith('.ts') || trimmed.endsWith('.tsx') || trimmed.endsWith('.json');
}

export function extractAuthorityPathsFromRegistry(registryText: string): string[] {
  const paths = registryText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(isNonEmptyPath)
    .map((line) => line.replace(/^[-*]\s+/u, '').trim());

  return Array.from(new Set(paths));
}

function buildArtifactId(params: { jobId: string; manuscriptId: number; registryChecksum: string | null }): string {
  return sha256Hex(JSON.stringify({
    artifact_type: 'phase0_authority_proof_v1',
    job_id: params.jobId,
    manuscript_id: params.manuscriptId,
    registry_checksum: params.registryChecksum,
  }));
}

export async function buildPhase0AuthorityProofArtifact(
  input: BuildPhase0AuthorityProofInput,
): Promise<Phase0AuthorityProofArtifact> {
  const loadedAt = input.now ?? new Date().toISOString();
  const registryText = typeof input.registryText === 'string' ? input.registryText : null;
  const registryChecksum = registryText ? sha256Hex(registryText) : null;
  const authorityPaths = registryText ? extractAuthorityPathsFromRegistry(registryText) : [];

  const loadedAuthorityPaths: string[] = [];
  const missingAuthorityPaths: string[] = [];
  const authorityChecksums: Record<string, string> = {};

  for (const authorityPath of authorityPaths) {
    const authorityText = await input.readAuthorityFile(authorityPath);
    if (typeof authorityText === 'string' && authorityText.length > 0) {
      loadedAuthorityPaths.push(authorityPath);
      authorityChecksums[authorityPath] = sha256Hex(authorityText);
    } else {
      missingAuthorityPaths.push(authorityPath);
    }
  }

  const blockingReasonCodes: string[] = [];
  if (!registryText) {
    blockingReasonCodes.push('PHASE0_AUTHORITY_REGISTRY_MISSING');
  }
  if (authorityPaths.length === 0 && registryText) {
    blockingReasonCodes.push('PHASE0_AUTHORITY_REGISTRY_EMPTY');
  }
  if (missingAuthorityPaths.length > 0) {
    blockingReasonCodes.push('PHASE0_AUTHORITY_PATHS_MISSING');
  }

  const status: Phase0AuthorityProofStatus = !registryText || authorityPaths.length === 0
    ? 'blocked'
    : missingAuthorityPaths.length > 0
    ? 'degraded'
    : 'valid';

  return {
    artifact_id: buildArtifactId({
      jobId: input.jobId,
      manuscriptId: input.manuscriptId,
      registryChecksum,
    }),
    artifact_type: 'phase0_authority_proof_v1',
    schema_version: 'phase0_authority_proof_v1',
    job_id: input.jobId,
    manuscript_id: input.manuscriptId,
    manuscript_version_id: input.manuscriptVersionId ?? null,
    registry_path: PHASE0_AUTHORITY_REGISTRY_PATH,
    registry_checksum: registryChecksum,
    loaded_authority_paths: loadedAuthorityPaths,
    missing_authority_paths: missingAuthorityPaths,
    authority_checksums: authorityChecksums,
    loaded_at: loadedAt,
    status,
    blocking_reason_codes: blockingReasonCodes,
    schema_valid: true,
    semantic_status: status === 'valid' ? 'valid' : status === 'degraded' ? 'degraded_with_reasons' : 'blocked',
    is_resume_safe: status === 'valid' || status === 'degraded',
  };
}

export async function persistPhase0AuthorityProofArtifact(
  input: PersistPhase0AuthorityProofInput,
): Promise<{ artifactId: string; proof: Phase0AuthorityProofArtifact }> {
  const proof = await buildPhase0AuthorityProofArtifact(input);
  const sourceHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      artifact_type: proof.artifact_type,
      job_id: proof.job_id,
      manuscript_id: proof.manuscript_id,
      registry_checksum: proof.registry_checksum,
      authority_checksums: proof.authority_checksums,
      missing_authority_paths: proof.missing_authority_paths,
      status: proof.status,
    }), 'utf8')
    .digest('hex');

  const artifactId = await upsertEvaluationArtifact({
    supabase: input.supabase,
    jobId: input.jobId,
    manuscriptId: input.manuscriptId,
    artifactType: 'phase0_authority_proof_v1',
    content: proof,
    sourceHash,
    artifactVersion: 'phase0_authority_proof_v1',
  });

  return { artifactId, proof };
}
