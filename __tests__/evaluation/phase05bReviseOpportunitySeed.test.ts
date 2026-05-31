import { buildPhase05bReviseOpportunitySeed, type ReviseOpportunitySeedEntry } from '../../lib/evaluation/phase-architecture-v2/phase05bReviseOpportunitySeed';
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
  loaded_authority_paths: ['docs/dialogue-speech-pov-canon-enforcement.md'],
  missing_authority_paths: [],
  authority_checksums: {
    'docs/dialogue-speech-pov-canon-enforcement.md': 'checksum',
  },
  loaded_at: '2026-05-31T00:00:00.000Z',
  status: 'valid',
  blocking_reason_codes: [],
  schema_valid: true,
  semantic_status: 'valid',
  is_resume_safe: true,
  ...overrides,
});

const opportunity = (overrides: Partial<ReviseOpportunitySeedEntry> = {}): ReviseOpportunitySeedEntry => ({
  opportunity_id: 'opp-1',
  criterion_key: 'narrativeClosure',
  canon_basis: ['13 Story Criteria: narrativeClosure'],
  authority_path_basis: ['docs/dialogue-speech-pov-canon-enforcement.md'],
  severity: 'SHOULD',
  scope: 'scene',
  location_label: 'Chapter 1 confrontation',
  location_anchor: 'chapter-1:move-aside-small-fry',
  original_passage: 'Move aside, Small Fry.',
  operation_type: 'suggested_replacement',
  symptom: 'The beat raises a conflict that is not yet paid off clearly enough.',
  cause: 'The scene moves on before Newton’s choice is rendered as an observable action.',
  reader_effect: 'The reader gets a clearer cause-and-effect bridge into the next beat.',
  evidence: 'Newton is challenged, but the immediate response remains compressed.',
  fix_direction: 'Render the response as a concrete beat while preserving the author’s voice.',
  mistake_proofing: 'Do not change dialogue ownership or rewrite the scene into a different tone.',
  candidate_a: {
    label: 'A',
    role: 'recommended_repair',
    text: 'Newton held his ground for one breath longer, then shifted just enough to make the choice visible.',
  },
  candidate_b: {
    label: 'B',
    role: 'balanced_revision',
    text: 'Newton did not answer right away. He looked from Twillow to the path ahead and chose to stay where he was.',
  },
  candidate_c: {
    label: 'C',
    role: 'bolder_rendering_shift',
    text: 'For the first time, Newton let the insult land without moving. The decision cost him, but he stayed planted.',
  },
  author_decision_status: 'pending',
  validation_status: 'unvalidated',
  ...overrides,
});

describe('Phase 0.5B Revise Opportunity Seed producer', () => {
  it('blocks without authority proof', () => {
    const result = buildPhase05bReviseOpportunitySeed({
      jobId: 'job-1',
      manuscriptId: 123,
      authorityProof: null,
      opportunities: [opportunity()],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PHASE05B_AUTHORITY_PROOF_MISSING_OR_INVALID');
    }
  });

  it('produces a governed revise opportunity seed under valid authority proof', () => {
    const result = buildPhase05bReviseOpportunitySeed({
      jobId: 'job-1',
      manuscriptId: 123,
      manuscriptVersionId: 'mv-1',
      authorityProof: authorityProof(),
      opportunities: [opportunity()],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.seed.artifact_type).toBe('revise_opportunity_seed_v1');
      expect(result.seed.phase0_authority_proof_id).toBe('authority-proof-id');
      expect(result.seed.opportunities).toHaveLength(1);
      expect(result.seed.opportunities[0].candidate_a.role).toBe('recommended_repair');
      expect(result.seed.opportunities[0].author_decision_status).toBe('pending');
      expect(result.seed.opportunities[0].validation_status).toBe('unvalidated');
      expect(result.seed.is_resume_safe).toBe(true);
    }
  });

  it('rejects opportunity without location anchor', () => {
    const result = buildPhase05bReviseOpportunitySeed({
      jobId: 'job-1',
      manuscriptId: 123,
      authorityProof: authorityProof(),
      opportunities: [opportunity({ location_anchor: '' })],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PHASE05B_OPPORTUNITY_CONTRACT_INVALID');
      expect(result.opportunity_errors?.['opp-1']).toContain('location_anchor_missing');
    }
  });

  it('rejects candidate A that repeats problem statement instead of revision prose', () => {
    const result = buildPhase05bReviseOpportunitySeed({
      jobId: 'job-1',
      manuscriptId: 123,
      authorityProof: authorityProof(),
      opportunities: [opportunity({
        candidate_a: {
          label: 'A',
          role: 'recommended_repair',
          text: 'The problem is that the scene needs more response.',
        },
      })],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.opportunity_errors?.['opp-1']).toContain('candidate_a_not_revision_prose');
    }
  });

  it('rejects internal evidence tokens as candidate prose', () => {
    const result = buildPhase05bReviseOpportunitySeed({
      jobId: 'job-1',
      manuscriptId: 123,
      authorityProof: authorityProof(),
      opportunities: [opportunity({
        candidate_b: {
          label: 'B',
          role: 'balanced_revision',
          text: 'NARRATIVEDRIVE:recommendation',
        },
      })],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.opportunity_errors?.['opp-1']).toContain('candidate_b_not_revision_prose');
    }
  });

  it('carries degraded authority status forward', () => {
    const result = buildPhase05bReviseOpportunitySeed({
      jobId: 'job-1',
      manuscriptId: 123,
      authorityProof: authorityProof({
        status: 'degraded',
        semantic_status: 'degraded_with_reasons',
        missing_authority_paths: ['docs/benchmarks/README.md'],
        blocking_reason_codes: ['PHASE0_AUTHORITY_PATHS_MISSING'],
      }),
      opportunities: [opportunity()],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.seed.semantic_status).toBe('degraded_with_reasons');
      expect(result.seed.canon_sources_missing).toEqual(['docs/benchmarks/README.md']);
    }
  });
});
