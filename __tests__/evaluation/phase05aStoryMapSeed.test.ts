import { buildPhase05aSeedArtifacts } from '../../lib/evaluation/phase-architecture-v2/phase05aStoryMapSeed';
import type { Phase0AuthorityProofArtifact } from '../../lib/evaluation/phase-architecture-v2/phase0AuthorityProof';

const authorityProof = (overrides: Partial<Phase0AuthorityProofArtifact> = {}): Phase0AuthorityProofArtifact => ({
  artifact_id: 'authority-proof-id',
  artifact_type: 'phase0_authority_proof_v1',
  schema_version: 'phase0_authority_proof_v1',
  job_id: 'job-1',
  manuscript_id: 123,
  manuscript_version_id: 'mv-1',
  registry_path: 'docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md',
  registry_checksum: 'registry-checksum',
  loaded_authority_paths: ['docs/phase-0-warmup/WHAT_NOT_TO_DO.md'],
  missing_authority_paths: [],
  authority_checksums: {
    'docs/phase-0-warmup/WHAT_NOT_TO_DO.md': 'checksum',
  },
  loaded_at: '2026-05-31T00:00:00.000Z',
  status: 'valid',
  blocking_reason_codes: [],
  schema_valid: true,
  semantic_status: 'valid',
  is_resume_safe: true,
  ...overrides,
});

describe('Phase 0.5A Story Map Seed producer', () => {
  it('blocks without authority proof', () => {
    const result = buildPhase05aSeedArtifacts({
      jobId: 'job-1',
      manuscriptId: 123,
      authorityProof: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PHASE05A_AUTHORITY_PROOF_MISSING_OR_INVALID');
    }
  });

  it('blocks with blocked authority proof', () => {
    const result = buildPhase05aSeedArtifacts({
      jobId: 'job-1',
      manuscriptId: 123,
      authorityProof: authorityProof({
        status: 'blocked',
        semantic_status: 'blocked',
        is_resume_safe: false,
      }),
    });

    expect(result.ok).toBe(false);
  });

  it('produces candidate/provisional story and evaluation seeds under valid authority proof', () => {
    const result = buildPhase05aSeedArtifacts({
      jobId: 'job-1',
      manuscriptId: 123,
      manuscriptVersionId: 'mv-1',
      authorityProof: authorityProof(),
      draft: {
        candidate_entity_registry: ['Newton', 'Twillow'],
        candidate_pov_map: ['Newton focalization appears primary'],
        candidate_open_loop_map: ['A secondary character is introduced and may need payoff verification'],
        likely_13_criteria_risks: ['narrativeClosure'],
        known_evidence_targets: ['Chapter 1 confrontation'],
        uncertainty_flags: ['Relationships remain candidate-only until Phase 1A verification'],
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.storyMapSeed.artifact_type).toBe('story_map_seed_v1');
      expect(result.storyMapSeed.seed_status).toBe('candidate_provisional');
      expect(result.storyMapSeed.phase0_authority_proof_id).toBe('authority-proof-id');
      expect(result.storyMapSeed.candidate_entity_registry).toEqual(['Newton', 'Twillow']);
      expect(result.evaluationSeed.artifact_type).toBe('evaluation_seed_v1');
      expect(result.evaluationSeed.known_evidence_targets).toEqual(['Chapter 1 confrontation']);
      expect(result.storyMapSeed.is_resume_safe).toBe(true);
      expect(result.evaluationSeed.is_resume_safe).toBe(true);
    }
  });

  it('carries degraded authority status forward with missing canon sources', () => {
    const result = buildPhase05aSeedArtifacts({
      jobId: 'job-1',
      manuscriptId: 123,
      authorityProof: authorityProof({
        status: 'degraded',
        semantic_status: 'degraded_with_reasons',
        missing_authority_paths: ['docs/benchmarks/README.md'],
        blocking_reason_codes: ['PHASE0_AUTHORITY_PATHS_MISSING'],
      }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.storyMapSeed.semantic_status).toBe('degraded_with_reasons');
      expect(result.storyMapSeed.canon_sources_missing).toEqual(['docs/benchmarks/README.md']);
    }
  });
});
