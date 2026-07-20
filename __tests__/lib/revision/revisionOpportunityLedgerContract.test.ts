import {
  assertRevisionOpportunityLedgerPayload,
  validateRevisionOpportunityLedgerPayload,
} from '@/lib/revision/revisionOpportunityLedgerContract';

function opportunity(id: string) {
  return {
    opportunity_id: id,
    finding_id: `finding:${id}`,
    criterion: 'Pacing',
    severity: 'must',
    rationale: 'The transition omits a connective beat.',
    evidence_anchor: 'Mara stopped at the chapel door.',
    manuscript_coordinates: 'passage:1',
    provenance: 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities',
    confidence: 'high',
    decision_state: 'open',
    revision_operation: 'insert_after_selected_passage',
    preflight_status: 'passed',
    grounding_status: 'supported',
  };
}

function ledger(opportunities: unknown[]) {
  return {
    job_id: 'job-123',
    manuscript_id: 6074,
    manuscript_version_hash: 'manuscript_6074_job-123',
    artifact_id: 'revision_opportunity_ledger_v1:123',
    artifact_type: 'revision_opportunity_ledger_v1',
    artifact_version: 'v1',
    source_hash: 'hash-123',
    generated_at: '2026-07-20T00:00:00.000Z',
    opportunity_source_authority: 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities',
    quality_manifest: {
      dcip_compliance: { status: 'pass' },
      constitutional_authority_registry: { status: 'pass' },
    },
    revise_queue_preflight: { version: 'revise_queue_preflight_gate_v1' },
    opportunities,
  };
}

describe('revision opportunity ledger contract', () => {
  it('accepts explicit governed empty authority', () => {
    expect(validateRevisionOpportunityLedgerPayload(ledger([]))).toEqual({
      valid: true,
      issues: [],
      opportunityCount: 0,
    });
  });

  it('accepts every fully formed sibling opportunity', () => {
    expect(validateRevisionOpportunityLedgerPayload(ledger([opportunity('opp-1'), opportunity('opp-2')]))).toMatchObject({
      valid: true,
      opportunityCount: 2,
    });
  });

  it('rejects a malformed sibling instead of allowing a valid sibling to mask it', () => {
    const dirty = opportunity('opp-2') as Record<string, unknown>;
    delete dirty.finding_id;

    const result = validateRevisionOpportunityLedgerPayload(ledger([opportunity('opp-1'), dirty]));
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'OPPORTUNITY_FIELD_MISSING', path: '$.opportunities[1].finding_id' }),
    ]));
  });

  it('rejects duplicate durable opportunity identities', () => {
    const result = validateRevisionOpportunityLedgerPayload(ledger([opportunity('opp-1'), opportunity('opp-1')]));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DUPLICATE_OPPORTUNITY_ID', path: '$.opportunities[1].opportunity_id' }),
    ]));
  });

  it('rejects unknown contract enum values', () => {
    const dirty = { ...opportunity('opp-1'), revision_operation: 'invent_new_scene' };
    const result = validateRevisionOpportunityLedgerPayload(ledger([dirty]));
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'OPPORTUNITY_FIELD_INVALID', path: '$.opportunities[0].revision_operation' }),
    ]));
  });

  it('throws a bounded upstream kickback summary before dirty persistence', () => {
    expect(() => assertRevisionOpportunityLedgerPayload(ledger([{ ...opportunity('opp-1'), criterion: '' }]))).toThrow(
      /OPPORTUNITY_FIELD_MISSING:\$\.opportunities\[0\]\.criterion/,
    );
  });
});
