import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';
import type { Phase0AuthorityProofArtifact } from './phase0AuthorityProof';

export type StoryMapSeedArtifact = {
  artifact_id: string;
  artifact_type: 'story_map_seed_v1';
  schema_version: 'story_map_seed_v1';
  job_id: string;
  manuscript_id: number;
  manuscript_version_id: string | null;
  phase0_authority_proof_id: string;
  loaded_authority_paths: string[];
  authority_checksums: Record<string, string>;
  canon_sources_missing: string[];
  seed_status: 'candidate_provisional';
  schema_valid: boolean;
  semantic_status: 'valid' | 'degraded_with_reasons' | 'blocked';
  is_resume_safe: boolean;
  candidate_entity_registry: string[];
  candidate_alias_map: Array<{ canonical: string; aliases: string[] }>;
  candidate_relationship_map: Array<{ source: string; target: string; relationship: string; confidence: 'low' | 'medium' | 'high' }>;
  candidate_object_symbol_map: Array<{ name: string; role: string; confidence: 'low' | 'medium' | 'high' }>;
  candidate_location_map: string[];
  candidate_timeline_map: string[];
  candidate_pov_map: string[];
  candidate_pressure_map: string[];
  candidate_open_loop_map: string[];
  uncertainty_flags: string[];
};

export type EvaluationSeedArtifact = {
  artifact_id: string;
  artifact_type: 'evaluation_seed_v1';
  schema_version: 'evaluation_seed_v1';
  job_id: string;
  manuscript_id: number;
  manuscript_version_id: string | null;
  phase0_authority_proof_id: string;
  loaded_authority_paths: string[];
  authority_checksums: Record<string, string>;
  canon_sources_missing: string[];
  schema_valid: boolean;
  semantic_status: 'valid' | 'degraded_with_reasons' | 'blocked';
  is_resume_safe: boolean;
  likely_13_criteria_strengths: string[];
  likely_13_criteria_risks: string[];
  known_story_risks: string[];
  known_evidence_targets: string[];
  evaluation_focus_notes: string[];
  uncertainty_flags: string[];
};

export type Phase05aSeedDraft = Partial<
  Pick<
    StoryMapSeedArtifact,
    | 'candidate_entity_registry'
    | 'candidate_alias_map'
    | 'candidate_relationship_map'
    | 'candidate_object_symbol_map'
    | 'candidate_location_map'
    | 'candidate_timeline_map'
    | 'candidate_pov_map'
    | 'candidate_pressure_map'
    | 'candidate_open_loop_map'
    | 'uncertainty_flags'
  >
> &
  Partial<
    Pick<
      EvaluationSeedArtifact,
      | 'likely_13_criteria_strengths'
      | 'likely_13_criteria_risks'
      | 'known_story_risks'
      | 'known_evidence_targets'
      | 'evaluation_focus_notes'
    >
  >;

export type BuildPhase05aSeedInput = {
  jobId: string;
  manuscriptId: number;
  manuscriptVersionId?: string | null;
  authorityProof: Phase0AuthorityProofArtifact | null | undefined;
  draft?: Phase05aSeedDraft;
};

export type PersistPhase05aSeedInput = BuildPhase05aSeedInput & {
  supabase: SupabaseClient;
};

function isAuthorityProofUsable(proof: Phase0AuthorityProofArtifact | null | undefined): proof is Phase0AuthorityProofArtifact {
  return !!proof && proof.schema_valid === true && proof.is_resume_safe === true &&
    (proof.semantic_status === 'valid' || proof.semantic_status === 'degraded_with_reasons');
}

function stableArtifactId(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

const emptyDraft: Required<Phase05aSeedDraft> = {
  candidate_entity_registry: [],
  candidate_alias_map: [],
  candidate_relationship_map: [],
  candidate_object_symbol_map: [],
  candidate_location_map: [],
  candidate_timeline_map: [],
  candidate_pov_map: [],
  candidate_pressure_map: [],
  candidate_open_loop_map: [],
  uncertainty_flags: [],
  likely_13_criteria_strengths: [],
  likely_13_criteria_risks: [],
  known_story_risks: [],
  known_evidence_targets: [],
  evaluation_focus_notes: [],
};

export function buildPhase05aSeedArtifacts(input: BuildPhase05aSeedInput): {
  ok: true;
  storyMapSeed: StoryMapSeedArtifact;
  evaluationSeed: EvaluationSeedArtifact;
} | {
  ok: false;
  code: string;
  reason: string;
} {
  if (!isAuthorityProofUsable(input.authorityProof)) {
    return {
      ok: false,
      code: 'PHASE05A_AUTHORITY_PROOF_MISSING_OR_INVALID',
      reason: 'Phase 0.5A Story Map Seed cannot be generated without a valid or degraded-with-reasons Phase 0 authority proof.',
    };
  }

  const draft = { ...emptyDraft, ...(input.draft ?? {}) };
  const semanticStatus = input.authorityProof.semantic_status === 'degraded_with_reasons'
    ? 'degraded_with_reasons'
    : 'valid';

  const base = {
    job_id: input.jobId,
    manuscript_id: input.manuscriptId,
    manuscript_version_id: input.manuscriptVersionId ?? null,
    phase0_authority_proof_id: input.authorityProof.artifact_id,
    loaded_authority_paths: input.authorityProof.loaded_authority_paths,
    authority_checksums: input.authorityProof.authority_checksums,
    canon_sources_missing: input.authorityProof.missing_authority_paths,
    schema_valid: true,
    semantic_status: semanticStatus,
    is_resume_safe: true,
  } as const;

  const storyArtifactId = stableArtifactId({
    artifact_type: 'story_map_seed_v1',
    ...base,
    candidate_entity_registry: draft.candidate_entity_registry,
    uncertainty_flags: draft.uncertainty_flags,
  });

  const evaluationArtifactId = stableArtifactId({
    artifact_type: 'evaluation_seed_v1',
    ...base,
    likely_13_criteria_risks: draft.likely_13_criteria_risks,
    known_story_risks: draft.known_story_risks,
  });

  return {
    ok: true,
    storyMapSeed: {
      artifact_id: storyArtifactId,
      artifact_type: 'story_map_seed_v1',
      schema_version: 'story_map_seed_v1',
      ...base,
      seed_status: 'candidate_provisional',
      candidate_entity_registry: draft.candidate_entity_registry,
      candidate_alias_map: draft.candidate_alias_map,
      candidate_relationship_map: draft.candidate_relationship_map,
      candidate_object_symbol_map: draft.candidate_object_symbol_map,
      candidate_location_map: draft.candidate_location_map,
      candidate_timeline_map: draft.candidate_timeline_map,
      candidate_pov_map: draft.candidate_pov_map,
      candidate_pressure_map: draft.candidate_pressure_map,
      candidate_open_loop_map: draft.candidate_open_loop_map,
      uncertainty_flags: draft.uncertainty_flags,
    },
    evaluationSeed: {
      artifact_id: evaluationArtifactId,
      artifact_type: 'evaluation_seed_v1',
      schema_version: 'evaluation_seed_v1',
      ...base,
      likely_13_criteria_strengths: draft.likely_13_criteria_strengths,
      likely_13_criteria_risks: draft.likely_13_criteria_risks,
      known_story_risks: draft.known_story_risks,
      known_evidence_targets: draft.known_evidence_targets,
      evaluation_focus_notes: draft.evaluation_focus_notes,
      uncertainty_flags: draft.uncertainty_flags,
    },
  };
}

export async function persistPhase05aSeedArtifacts(input: PersistPhase05aSeedInput): Promise<{
  storyMapArtifactId: string;
  evaluationSeedArtifactId: string;
  storyMapSeed: StoryMapSeedArtifact;
  evaluationSeed: EvaluationSeedArtifact;
}> {
  const built = buildPhase05aSeedArtifacts(input);
  if (!built.ok) {
    throw new Error(`${built.code}: ${built.reason}`);
  }

  const storyMapArtifactId = await upsertEvaluationArtifact({
    supabase: input.supabase,
    jobId: input.jobId,
    manuscriptId: input.manuscriptId,
    artifactType: 'story_map_seed_v1',
    content: built.storyMapSeed,
    sourceHash: built.storyMapSeed.artifact_id,
    artifactVersion: 'story_map_seed_v1',
  });

  const evaluationSeedArtifactId = await upsertEvaluationArtifact({
    supabase: input.supabase,
    jobId: input.jobId,
    manuscriptId: input.manuscriptId,
    artifactType: 'evaluation_seed_v1',
    content: built.evaluationSeed,
    sourceHash: built.evaluationSeed.artifact_id,
    artifactVersion: 'evaluation_seed_v1',
  });

  return {
    storyMapArtifactId,
    evaluationSeedArtifactId,
    storyMapSeed: built.storyMapSeed,
    evaluationSeed: built.evaluationSeed,
  };
}
