import fs from 'fs';
import path from 'path';
import { ARTIFACT_REGISTRY } from '../../lib/evaluation/artifacts/artifactRegistry';

const RUNTIME_ENVELOPE_REQUIRED_FIELDS = [
  'job_id',
  'evaluation_project_id',
  'manuscript_id',
  'manuscript_version_hash',
  'artifact_id',
  'artifact_type',
  'artifact_version',
  'source_hash',
  'generated_at',
];

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

describe('evaluation artifact JSON schemas', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const schemaEntries = Object.values(ARTIFACT_REGISTRY).filter((entry) => entry.schemaPath);

  it('uses JSON Schema 2020-12 for every schema-backed artifact', () => {
    for (const entry of schemaEntries) {
      const schema = readJson(path.join(repoRoot, entry.schemaPath!));
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(schema.type).toBe('object');
      expect(schema.title).toBe(entry.artifactType);
    }
  });

  it('requires the canonical runtime artifact envelope in every schema', () => {
    for (const entry of schemaEntries) {
      const schema = readJson(path.join(repoRoot, entry.schemaPath!));
      const required = schema.required as string[];
      expect(required).toEqual(expect.arrayContaining(RUNTIME_ENVELOPE_REQUIRED_FIELDS));
    }
  });

  it('pins each schema to its artifact_type const', () => {
    for (const entry of schemaEntries) {
      const schema = readJson(path.join(repoRoot, entry.schemaPath!));
      const properties = schema.properties as Record<string, unknown>;
      const artifactTypeProperty = properties.artifact_type as Record<string, unknown>;
      expect(artifactTypeProperty.const).toBe(entry.artifactType);
    }
  });

  it('keeps story layer schema shallow but requires exactly the eight core layers', () => {
    const schema = readJson(path.join(repoRoot, 'schemas/evaluation/pass1a_story_layer_v1.schema.json'));
    const required = schema.required as string[];

    expect(required).toEqual(expect.arrayContaining([
      'source_integrity_layer',
      'pov_structure_layer',
      'canonical_identity_layer',
      'cast_role_tier_layer',
      'relationship_network_layer',
      'object_symbol_layer',
      'location_timeline_worldstate_layer',
      'threat_antagonist_ending_layer',
    ]));
  });

  it('requires accepted ledger dependencies and support artifact staleness fields', () => {
    const acceptedLedger = readJson(path.join(repoRoot, 'schemas/evaluation/accepted_story_ledger_v1.schema.json'));
    const acceptedProperties = acceptedLedger.properties as Record<string, unknown>;
    const sourceArtifacts = acceptedProperties.source_artifacts as Record<string, unknown>;
    expect(sourceArtifacts.required).toEqual(expect.arrayContaining([
      'pass1a_story_layer_v1',
      'ledger_user_feedback_v1',
    ]));

    for (const schemaName of ['story_shape_signal_map_v1', 'manuscript_signal_appendix_v1']) {
      const schema = readJson(path.join(repoRoot, `schemas/evaluation/${schemaName}.schema.json`));
      expect(schema.required).toEqual(expect.arrayContaining([
        'accepted_story_ledger_artifact_id',
        'accepted_story_ledger_source_hash',
        'status',
        'warnings',
      ]));
    }
  });
});
