import { evaluateArtifactPayloadQuality } from '@/lib/evaluation/artifactQualityCertification';

describe('artifact producer-consumer contract reconciliation', () => {
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
});
