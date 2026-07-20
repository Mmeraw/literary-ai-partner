import { evaluateArtifactPayloadQuality } from '@/lib/evaluation/artifactQualityCertification';

describe('artifact producer-consumer contract reconciliation', () => {
  const ledgerOpportunity = {
    opportunity_id: 'opp-1',
    finding_id: 'finding-1',
    criterion: 'Pacing',
    severity: 'must',
    rationale: 'A connective beat is missing.',
    evidence_anchor: 'Mara stopped at the chapel door.',
    manuscript_coordinates: 'passage:1',
    provenance: 'canonical_ued',
    confidence: 'high',
    decision_state: 'open',
    revision_operation: 'insert_after_selected_passage',
    preflight_status: 'passed',
    grounding_status: 'supported',
  };

  function ledgerContent(opportunities: unknown[]) {
    return {
      job_id: 'job-1',
      manuscript_id: 1,
      manuscript_version_hash: 'version-1',
      artifact_id: 'ledger-1',
      artifact_type: 'revision_opportunity_ledger_v1',
      artifact_version: 'v1',
      source_hash: 'hash-1',
      generated_at: '2026-07-20T00:00:00.000Z',
      opportunity_source_authority: 'canonical_ued',
      quality_manifest: {
        dcip_compliance: { status: 'pass' },
        constitutional_authority_registry: { status: 'pass' },
      },
      revise_queue_preflight: { version: 'revise_queue_preflight_gate_v1' },
      opportunities,
    };
  }

  it('certifies the actual durable pass12 handoff content shape', () => {
    const result = evaluateArtifactPayloadQuality({
      artifact: 'pass12_handoff_v1',
      content: {
        schema_version: 'pass12_handoff_v1',
        pass1Output: { criteria: [{ key: 'concept' }] },
        pass2Output: { criteria: [{ key: 'concept' }] },
        chunk_count: 2,
        captured_at: '2026-07-20T00:00:00.000Z',
      },
    });

    expect(result).toMatchObject({ contract_status: 'clean', certified: true, score_0_100: 100 });
    expect(result.issues).toEqual([]);
  });

  it('kicks back a handoff missing either upstream pass payload', () => {
    const result = evaluateArtifactPayloadQuality({
      artifact: 'pass12_handoff_v1',
      content: {
        schema_version: 'pass12_handoff_v1',
        pass1Output: { criteria: [{ key: 'concept' }] },
        chunk_count: 1,
        captured_at: '2026-07-20T00:00:00.000Z',
      },
    });

    expect(result).toMatchObject({ contract_status: 'degraded', certified: false });
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REQUIRED_FIELD_MISSING', path: 'pass2Output' }),
    ]));
  });

  it('certifies an explicit governed empty Revise ledger', () => {
    const result = evaluateArtifactPayloadQuality({
      artifact: 'revision_opportunity_ledger_v1',
      content: ledgerContent([]),
    });

    expect(result).toMatchObject({ contract_status: 'clean', certified: true, score_0_100: 100 });
  });

  it('checks required collection fields on every opportunity sibling', () => {
    const dirty = { ...ledgerOpportunity } as Record<string, unknown>;
    delete dirty.finding_id;
    const result = evaluateArtifactPayloadQuality({
      artifact: 'revision_opportunity_ledger_v1',
      content: ledgerContent([ledgerOpportunity, dirty]),
    });

    expect(result).toMatchObject({ contract_status: 'degraded', certified: false });
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REQUIRED_FIELD_MISSING', path: 'opportunities[1].finding_id' }),
    ]));
  });

  it('does not let an unrelated nested leaf satisfy an exact registry path', () => {
    const content = ledgerContent([ledgerOpportunity]) as Record<string, unknown>;
    content.quality_manifest = {
      unrelated: { dcip_compliance: { status: 'pass' } },
      constitutional_authority_registry: { status: 'pass' },
    };

    const result = evaluateArtifactPayloadQuality({
      artifact: 'revision_opportunity_ledger_v1',
      content,
    });
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'REQUIRED_FIELD_MISSING', path: 'quality_manifest.dcip_compliance' }),
    ]));
  });
});
