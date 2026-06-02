import fs from 'fs';
import path from 'path';
import {
  ARTIFACT_REGISTRY,
} from '../../lib/evaluation/artifacts/artifactRegistry';
import {
  CANONICAL_EVALUATION_ARTIFACT_TYPES,
} from '../../lib/evaluation/artifacts/artifactTypes';

describe('canonical artifact registry', () => {
  const repoRoot = path.resolve(__dirname, '../..');

  it('has exactly one registry entry for every canonical artifact type', () => {
    expect(Object.keys(ARTIFACT_REGISTRY).sort()).toEqual(
      [...CANONICAL_EVALUATION_ARTIFACT_TYPES].sort(),
    );

    for (const artifactType of CANONICAL_EVALUATION_ARTIFACT_TYPES) {
      const entry = ARTIFACT_REGISTRY[artifactType];
      expect(entry.artifactType).toBe(artifactType);
      expect(entry.contractDocPath).toMatch(/^(docs\/canon\/|docs\/phase-0-warmup\/)/);
    }
  });

  it('points every schema-backed registry entry to an existing JSON schema file', () => {
    for (const entry of Object.values(ARTIFACT_REGISTRY)) {
      if (!entry.schemaPath) continue;
      const absoluteSchemaPath = path.join(repoRoot, entry.schemaPath);
      expect(fs.existsSync(absoluteSchemaPath)).toBe(true);
      expect(entry.schemaPath).toMatch(/^schemas\/evaluation\/.+\.schema\.json$/);
    }
  });

  it('keeps Phase 2 story authority limited to accepted_story_ledger_v1', () => {
    const phase2StoryAuthorities = Object.values(ARTIFACT_REGISTRY)
      .filter((entry) => entry.phase2StoryAuthority)
      .map((entry) => entry.artifactType);

    expect(phase2StoryAuthorities).toEqual(['accepted_story_ledger_v1']);
  });

  it('marks support artifacts as non-authoritative and never story-layer creators', () => {
    const supportArtifacts = Object.values(ARTIFACT_REGISTRY).filter(
      (entry) => entry.supportArtifact,
    );

    expect(supportArtifacts.map((entry) => entry.artifactType).sort()).toEqual([
      'evaluation_seed_v1',
      'manuscript_signal_appendix_v1',
      'seed_fit_gap_report_v1',
      'story_map_seed_v1',
      'story_shape_signal_map_v1',
    ]);

    const enrichmentSupportArtifacts = supportArtifacts
      .filter((entry) => entry.authority === 'phase2_enrichment')
      .map((entry) => entry.artifactType)
      .sort();

    expect(enrichmentSupportArtifacts).toEqual([
      'manuscript_signal_appendix_v1',
      'story_shape_signal_map_v1',
    ]);

    for (const entry of supportArtifacts) {
      expect(entry.phase2StoryAuthority).toBe(false);
      expect(entry.createsStoryLayer).toBe(false);
    }
  });
});
