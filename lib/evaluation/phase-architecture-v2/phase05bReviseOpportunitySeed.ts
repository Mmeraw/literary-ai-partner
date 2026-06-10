import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';
import type { Phase0AuthorityProofArtifact } from './phase0AuthorityProof';

export type ReviseSeverity = 'MUST' | 'SHOULD' | 'COULD';
export type ReviseValidationStatus = 'unvalidated';

export type ReviseSeedCandidate = {
  label: 'A' | 'B' | 'C';
  role: 'recommended_repair' | 'balanced_revision' | 'bolder_rendering_shift';
  text: string;
};

export type ReviseOpportunitySeedEntry = {
  opportunity_id: string;
  criterion_key: string;
  canon_basis: string[];
  authority_path_basis: string[];
  severity: ReviseSeverity;
  scope: 'manuscript' | 'act' | 'chapter' | 'scene' | 'paragraph' | 'sentence' | 'phrase';
  location_label: string;
  location_anchor: string;
  original_passage: string;
  operation_type: string;
  symptom: string;
  cause: string;
  reader_effect: string;
  evidence: string;
  fix_direction: string;
  mistake_proofing: string;
  candidate_a: ReviseSeedCandidate;
  candidate_b: ReviseSeedCandidate;
  candidate_c: ReviseSeedCandidate;
  author_decision_status: 'pending';
  validation_status: ReviseValidationStatus;
};

export type ReviseOpportunitySeedArtifact = {
  artifact_id: string;
  artifact_type: 'revise_opportunity_seed_v1';
  schema_version: 'revise_opportunity_seed_v1';
  job_id: string;
  manuscript_id: number;
  manuscript_version_id: string | null;
  source: 'phase_0_5b';
  phase0_authority_proof_id: string;
  loaded_authority_paths: string[];
  authority_checksums: Record<string, string>;
  canon_sources_missing: string[];
  schema_valid: boolean;
  semantic_status: 'valid' | 'degraded_with_reasons' | 'blocked';
  is_resume_safe: boolean;
  opportunities: ReviseOpportunitySeedEntry[];
};

export type BuildPhase05bReviseSeedInput = {
  jobId: string;
  manuscriptId: number;
  manuscriptVersionId?: string | null;
  authorityProof: Phase0AuthorityProofArtifact | null | undefined;
  opportunities: ReviseOpportunitySeedEntry[];
};

export type PersistPhase05bReviseSeedInput = BuildPhase05bReviseSeedInput & {
  supabase: SupabaseClient;
};

const FORBIDDEN_CANDIDATE_PATTERNS = [
  /^(expand|improve|clarify|strengthen|show more)\b/i,
  /^the problem is\b/i,
  /^symptom:/i,
  /^evidence:/i,
  /NARRATIVEDRIVE:/i,
  /recommendation/i,
];

function isAuthorityProofUsable(proof: Phase0AuthorityProofArtifact | null | undefined): proof is Phase0AuthorityProofArtifact {
  return !!proof && proof.schema_valid === true && proof.is_resume_safe === true &&
    (proof.semantic_status === 'valid' || proof.semantic_status === 'degraded_with_reasons');
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function candidateHasForbiddenShape(candidate: ReviseSeedCandidate): boolean {
  const text = candidate.text.trim();
  if (!text) return true;
  return FORBIDDEN_CANDIDATE_PATTERNS.some((pattern) => pattern.test(text));
}

function validateCandidate(candidate: ReviseSeedCandidate, role: ReviseSeedCandidate['role']): string[] {
  const errors: string[] = [];
  if (candidate.role !== role) errors.push(`candidate_${candidate.label.toLowerCase()}_role_invalid`);
  if (!hasText(candidate.text)) errors.push(`candidate_${candidate.label.toLowerCase()}_text_missing`);
  if (candidateHasForbiddenShape(candidate)) errors.push(`candidate_${candidate.label.toLowerCase()}_not_revision_prose`);
  return errors;
}

function validateOpportunity(opportunity: ReviseOpportunitySeedEntry): string[] {
  const errors: string[] = [];
  const requiredTextFields: Array<keyof ReviseOpportunitySeedEntry> = [
    'opportunity_id',
    'criterion_key',
    'location_label',
    'location_anchor',
    'original_passage',
    'operation_type',
    'symptom',
    'cause',
    'reader_effect',
    'evidence',
    'fix_direction',
    'mistake_proofing',
  ];

  for (const field of requiredTextFields) {
    if (!hasText(opportunity[field])) errors.push(`${String(field)}_missing`);
  }

  if (!Array.isArray(opportunity.canon_basis) || opportunity.canon_basis.length === 0) {
    errors.push('canon_basis_missing');
  }
  if (!Array.isArray(opportunity.authority_path_basis) || opportunity.authority_path_basis.length === 0) {
    errors.push('authority_path_basis_missing');
  }

  errors.push(...validateCandidate(opportunity.candidate_a, 'recommended_repair'));
  errors.push(...validateCandidate(opportunity.candidate_b, 'balanced_revision'));
  errors.push(...validateCandidate(opportunity.candidate_c, 'bolder_rendering_shift'));

  if (opportunity.author_decision_status !== 'pending') errors.push('author_decision_status_must_be_pending');
  if (opportunity.validation_status !== 'unvalidated') errors.push('validation_status_must_be_unvalidated');

  return errors;
}

function stableArtifactId(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

export function buildPhase05bReviseOpportunitySeed(input: BuildPhase05bReviseSeedInput): {
  ok: true;
  seed: ReviseOpportunitySeedArtifact;
} | {
  ok: false;
  code: string;
  reason: string;
  opportunity_errors?: Record<string, string[]>;
} {
  if (!isAuthorityProofUsable(input.authorityProof)) {
    console.error('[SIPOC-KICK-BACKWARD] Phase 5 OUTPUT → Author: rejected — authority proof missing or invalid', {
      job_id: input.jobId,
      sipoc_boundary: 'phase5_output→author',
    });
    return {
      ok: false,
      code: 'PHASE05B_AUTHORITY_PROOF_MISSING_OR_INVALID',
      reason: 'Phase 0.5B Revise Opportunity Seed cannot be generated without a valid or degraded-with-reasons Phase 0 authority proof.',
    };
  }

  const opportunityErrors: Record<string, string[]> = {};
  for (const opportunity of input.opportunities) {
    const errors = validateOpportunity(opportunity);
    if (errors.length > 0) {
      opportunityErrors[opportunity.opportunity_id || 'unknown_opportunity'] = errors;
    }
  }

  if (Object.keys(opportunityErrors).length > 0) {
    console.error('[SIPOC-KICK-BACKWARD] Phase 5 OUTPUT → Author: rejected — opportunity contract invalid', {
      job_id: input.jobId,
      sipoc_boundary: 'phase5_output→author',
      invalid_opportunities: Object.keys(opportunityErrors).length,
      total_opportunities: input.opportunities.length,
      sample_errors: Object.entries(opportunityErrors).slice(0, 3).map(([id, errs]) => `${id}: ${errs.slice(0, 2).join(', ')}`),
    });
    return {
      ok: false,
      code: 'PHASE05B_OPPORTUNITY_CONTRACT_INVALID',
      reason: 'One or more revise opportunities failed the seed contract and must not be persisted as a ready seed.',
      opportunity_errors: opportunityErrors,
    };
  }

  const semanticStatus = input.authorityProof.semantic_status === 'degraded_with_reasons'
    ? 'degraded_with_reasons'
    : 'valid';

  const base: Omit<
    ReviseOpportunitySeedArtifact,
    'artifact_id' | 'artifact_type' | 'schema_version'
  > = {
    job_id: input.jobId,
    manuscript_id: input.manuscriptId,
    manuscript_version_id: input.manuscriptVersionId ?? null,
    source: 'phase_0_5b',
    phase0_authority_proof_id: input.authorityProof.artifact_id,
    loaded_authority_paths: input.authorityProof.loaded_authority_paths,
    authority_checksums: input.authorityProof.authority_checksums,
    canon_sources_missing: input.authorityProof.missing_authority_paths,
    schema_valid: true,
    semantic_status: semanticStatus,
    is_resume_safe: true,
    opportunities: input.opportunities,
  };

  // ── SIPOC OUTPUT Gate: Phase 5 OUTPUT → Author: validated ──────────────
  console.log('[SIPOC] Phase 5 OUTPUT → Author: validated — revise opportunity seed passes contract', {
    job_id: input.jobId,
    sipoc_boundary: 'phase5_output→author',
    opportunities_count: input.opportunities.length,
    semantic_status: semanticStatus,
  });

  return {
    ok: true,
    seed: {
      artifact_id: stableArtifactId({ artifact_type: 'revise_opportunity_seed_v1', ...base }),
      artifact_type: 'revise_opportunity_seed_v1',
      schema_version: 'revise_opportunity_seed_v1',
      ...base,
    },
  };
}

export async function persistPhase05bReviseOpportunitySeed(input: PersistPhase05bReviseSeedInput): Promise<{
  artifactId: string;
  seed: ReviseOpportunitySeedArtifact;
}> {
  const built = buildPhase05bReviseOpportunitySeed(input);
  if (!built.ok) {
    const failure = built as Extract<typeof built, { ok: false }>;
    throw new Error(`${failure.code}: ${failure.reason}`);
  }

  const artifactId = await upsertEvaluationArtifact({
    supabase: input.supabase,
    jobId: input.jobId,
    manuscriptId: input.manuscriptId,
    artifactType: 'revise_opportunity_seed_v1',
    content: built.seed,
    sourceHash: built.seed.artifact_id,
    artifactVersion: 'revise_opportunity_seed_v1',
  });

  return { artifactId, seed: built.seed };
}
