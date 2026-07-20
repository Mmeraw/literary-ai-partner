import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('revision opportunity ledger contract wiring', () => {
  test('has one active producer and no Workbench-derived parallel producer', () => {
    const registry = read('lib/revision/reviseRegistry.ts');
    expect(registry).toContain("codeSurfaces: ['lib/revision/opportunityLedger.ts', 'lib/revision/revisionOpportunityLedgerContract.ts'");
    expect(registry).not.toContain('lib/revision/revisionOpportunityLedgerArtifact.ts');
    expect(fs.existsSync(path.join(root, 'lib/revision/revisionOpportunityLedgerArtifact.ts'))).toBe(false);
  });

  test('validates the complete payload before persistence and validates persisted content before reuse', () => {
    const producer = read('lib/revision/opportunityLedger.ts');
    const assertion = producer.indexOf('assertRevisionOpportunityLedgerPayload(payload)');
    const persistence = producer.indexOf(".from('evaluation_artifacts')", assertion);
    expect(assertion).toBeGreaterThan(0);
    expect(persistence).toBeGreaterThan(assertion);
    expect(producer).toContain('validateRevisionOpportunityLedgerPayload(existingLedgerRow.content)');
    expect(producer).toContain('existingLedgerValidation?.valid');
  });

  test('Held Recovery uses the same canonical validator', () => {
    const heldRecovery = read('lib/revision/heldRecoveryRuntimeOrchestrator.ts');
    expect(heldRecovery).toContain("from './revisionOpportunityLedgerContract'");
    expect(heldRecovery).toContain('validateRevisionOpportunityLedgerPayload(content)');
  });

  test('JSON schema and executable registry both require per-opportunity fields', () => {
    const schema = JSON.parse(read('schemas/evaluation/revision_opportunity_ledger_v1.schema.json')) as {
      properties: { opportunities: { items: { required: string[] } } };
    };
    const required = schema.properties.opportunities.items.required;
    expect(required).toEqual(expect.arrayContaining([
      'opportunity_id',
      'finding_id',
      'criterion',
      'evidence_anchor',
      'revision_operation',
      'preflight_status',
      'grounding_status',
    ]));

    const fipoc = read('lib/evaluation/fipocRegistry.ts');
    expect(fipoc).toContain("'$.opportunities[].finding_id'");
    expect(fipoc).toContain("'$.quality_manifest.dcip_compliance'");
  });
});
