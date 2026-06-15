import {
  EVALUATE_ARTIFACT_QUALITY_THRESHOLD,
  evaluateAllArtifactRegistryContracts,
  evaluateArtifactPayloadQuality,
} from '@/lib/evaluation/artifactQualityCertification';
import { ARTIFACT_REGISTRY } from '@/lib/evaluation/fipocRegistry';

describe('Evaluate artifact quality certification', () => {
  test('keeps 95 percent as an observability target, not a broad fail gate', () => {
    expect(EVALUATE_ARTIFACT_QUALITY_THRESHOLD).toBe(95);
  });

  test('covers the broader FIPOC artifact set, including the 28+ artifact contract surface', () => {
    expect(ARTIFACT_REGISTRY.length).toBeGreaterThanOrEqual(28);

    const certifications = evaluateAllArtifactRegistryContracts();
    expect(certifications).toHaveLength(ARTIFACT_REGISTRY.length);

    const registryMetricGaps = certifications.flatMap((certification) =>
      certification.issues.filter((issue) => issue.code === 'SIPOC_METRIC_MISSING'),
    );
    expect(registryMetricGaps).toEqual([]);
  });

  test('scores a complete evaluation_result_v2-like payload at or above the 95 percent threshold', () => {
    const certification = evaluateArtifactPayloadQuality({
      artifact: 'evaluation_result_v2',
      content: {
        schema_version: 'evaluation_result_v2',
        overview: { overall_score_0_100: 82 },
        criteria: [{ key: 'concept', score_0_10: 8 }],
        metrics: { manuscript: { word_count: 5000 } },
        enrichment: { diagnosed_genre: 'Literary Fiction' },
      },
    });

    expect(certification.score_0_100).toBeGreaterThanOrEqual(EVALUATE_ARTIFACT_QUALITY_THRESHOLD);
    expect(certification.certified).toBe(true);
    expect(certification.contract_status).toBe('clean');
    expect(certification.sipoc_metrics.completeness_metric).toContain('13 canonical criteria');
    expect(certification.issues).toEqual([]);
  });

  test('fails incomplete evaluation_result_v2 payloads below the quality floor', () => {
    const certification = evaluateArtifactPayloadQuality({
      artifact: 'evaluation_result_v2',
      content: {
        schema_version: 'evaluation_result_v2',
        criteria: [],
      },
    });

    expect(certification.certified).toBe(false);
    expect(certification.contract_status).toBe('degraded');
    expect(certification.score_0_100).toBeLessThan(EVALUATE_ARTIFACT_QUALITY_THRESHOLD);
    expect(certification.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['REQUIRED_FIELD_MISSING', 'REQUIRED_FIELD_EMPTY']),
    );
  });

  test('fails non-object artifact payloads closed', () => {
    const certification = evaluateArtifactPayloadQuality({
      artifact: 'pass12_handoff_v1',
      content: null,
    });

    expect(certification.certified).toBe(false);
    expect(certification.contract_status).toBe('degraded');
    expect(certification.score_0_100).toBe(0);
    expect(certification.issues[0]).toMatchObject({ code: 'ARTIFACT_NOT_OBJECT' });
  });

  test('blocks structurally complete artifacts with blocking status signals', () => {
    const certification = evaluateArtifactPayloadQuality({
      artifact: 'final_external_audit_v1',
      content: {
        verdict: 'BLOCK',
        blocking: true,
        codes: ['FINAL_AUDIT_CONTRADICTION'],
        checked_artifacts: ['evaluation_result_v2'],
      },
    });

    expect(certification.certified).toBe(false);
    expect(certification.contract_status).toBe('blocked');
    expect(certification.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'BLOCKING_ARTIFACT_SIGNAL' })]),
    );
  });
});
