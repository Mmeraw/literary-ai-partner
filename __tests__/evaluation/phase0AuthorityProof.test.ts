import {
  buildPhase0AuthorityProofArtifact,
  extractAuthorityPathsFromRegistry,
  PHASE0_AUTHORITY_REGISTRY_PATH,
} from '../../lib/evaluation/phase-architecture-v2/phase0AuthorityProof';

const registry = `# Registry

\`\`\`text
docs/phase-0-warmup/WHAT_NOT_TO_DO.md
docs/benchmarks/README.md
\`\`\`
`;

describe('phase0 authority proof producer', () => {
  it('extracts authority paths from registry text', () => {
    expect(extractAuthorityPathsFromRegistry(registry)).toEqual([
      'docs/phase-0-warmup/WHAT_NOT_TO_DO.md',
      'docs/benchmarks/README.md',
    ]);
  });

  it('produces valid proof when registry and authority paths resolve', async () => {
    const proof = await buildPhase0AuthorityProofArtifact({
      jobId: 'job-1',
      manuscriptId: 123,
      manuscriptVersionId: 'mv-1',
      registryText: registry,
      now: '2026-05-31T00:00:00.000Z',
      readAuthorityFile: async (path) => `content for ${path}`,
    });

    expect(proof.artifact_type).toBe('phase0_authority_proof_v1');
    expect(proof.registry_path).toBe(PHASE0_AUTHORITY_REGISTRY_PATH);
    expect(proof.status).toBe('valid');
    expect(proof.semantic_status).toBe('valid');
    expect(proof.is_resume_safe).toBe(true);
    expect(proof.loaded_authority_paths).toHaveLength(2);
    expect(proof.missing_authority_paths).toEqual([]);
    expect(Object.keys(proof.authority_checksums)).toHaveLength(2);
  });

  it('produces degraded proof when non-empty registry has missing paths', async () => {
    const proof = await buildPhase0AuthorityProofArtifact({
      jobId: 'job-1',
      manuscriptId: 123,
      registryText: registry,
      readAuthorityFile: async (path) => path.includes('README') ? null : `content for ${path}`,
    });

    expect(proof.status).toBe('degraded');
    expect(proof.semantic_status).toBe('degraded_with_reasons');
    expect(proof.is_resume_safe).toBe(true);
    expect(proof.blocking_reason_codes).toContain('PHASE0_AUTHORITY_PATHS_MISSING');
    expect(proof.missing_authority_paths).toEqual(['docs/benchmarks/README.md']);
  });

  it('produces blocked proof when registry is missing', async () => {
    const proof = await buildPhase0AuthorityProofArtifact({
      jobId: 'job-1',
      manuscriptId: 123,
      registryText: null,
      readAuthorityFile: async () => 'never called',
    });

    expect(proof.status).toBe('blocked');
    expect(proof.semantic_status).toBe('blocked');
    expect(proof.is_resume_safe).toBe(false);
    expect(proof.blocking_reason_codes).toContain('PHASE0_AUTHORITY_REGISTRY_MISSING');
  });

  it('produces blocked proof when registry contains no authority paths', async () => {
    const proof = await buildPhase0AuthorityProofArtifact({
      jobId: 'job-1',
      manuscriptId: 123,
      registryText: '# Empty registry',
      readAuthorityFile: async () => 'never called',
    });

    expect(proof.status).toBe('blocked');
    expect(proof.is_resume_safe).toBe(false);
    expect(proof.blocking_reason_codes).toContain('PHASE0_AUTHORITY_REGISTRY_EMPTY');
  });
});
