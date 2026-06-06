import { buildFinalExternalAuditPacket } from '@/lib/evaluation/pipeline/finalExternalAuditPrompt';
import { persistFinalExternalAudit, runFinalExternalAudit } from '@/lib/evaluation/pipeline/finalExternalAudit';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';

jest.mock('@/lib/evaluation/artifactPersistence', () => {
  const actual = jest.requireActual('@/lib/evaluation/artifactPersistence');
  return {
    ...actual,
    upsertEvaluationArtifact: jest.fn(async () => 'artifact-final-audit-1'),
  };
});

function makeResult() {
  return {
    overview: { overall_score_0_100: 82, verdict: 'Near Market Ready', summary: 'Evidence-backed summary.' },
    criteria: Array.from({ length: 13 }, (_, index) => ({
      key: `criterion_${index}`,
      score_0_10: 7,
      status: 'SCORABLE',
      confidence_level: 'moderate',
      evidence: [{ snippet: `Specific submitted-text anchor number ${index} with enough length.` }],
    })),
    governance: { transparency: { coverage_summary: { analyzedWords: 50000 } } },
  } as any;
}

const completeArtifacts = {
  evaluation_result_v2: { present: true },
  longform_document_v1: { present: true },
  revision_opportunity_ledger_v1: { present: true },
  wave_revision_plan_v1: { present: true },
};

const originalPerplexityApiKey = process.env.PERPLEXITY_API_KEY;

describe('final external audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PERPLEXITY_API_KEY;
  });

  afterAll(() => {
    if (originalPerplexityApiKey === undefined) {
      delete process.env.PERPLEXITY_API_KEY;
    } else {
      process.env.PERPLEXITY_API_KEY = originalPerplexityApiKey;
    }
  });

  test('skips short-form by default', () => {
    const result = runFinalExternalAudit({
      wordCount: 1200,
      evaluationResult: makeResult(),
      checkedArtifacts: completeArtifacts,
      providerAvailable: false,
    });

    expect(result.verdict).toBe('SKIP');
    expect(result.codes).toContain('FINAL_AUDIT_SKIPPED_SHORT_FORM');
    expect(result.blocking).toBe(false);
  });

  test('blocks required long-form audit when DREAM is missing', () => {
    const result = runFinalExternalAudit({
      wordCount: 50000,
      evaluationResult: makeResult(),
      checkedArtifacts: {
        ...completeArtifacts,
        longform_document_v1: { present: false },
      },
      mode: 'required',
      providerAvailable: true,
    });

    expect(result.verdict).toBe('BLOCK');
    expect(result.codes).toContain('FINAL_AUDIT_MISSING_DREAM');
    expect(result.missing_required_artifacts).toContain('longform_document_v1');
  });

  test('passes complete long-form artifact set without full manuscript text', () => {
    const evaluationResult = makeResult();
    const packet = buildFinalExternalAuditPacket({
      evaluationResult,
      checkedArtifacts: completeArtifacts,
    });
    const serialized = JSON.stringify(packet);

    expect(packet.representative_evidence_anchors.length).toBeGreaterThan(0);
    expect(serialized).not.toContain('CHAPTER ONE FULL MANUSCRIPT TEXT');

    const result = runFinalExternalAudit({
      wordCount: 50000,
      evaluationResult,
      checkedArtifacts: completeArtifacts,
      mode: 'optional',
      providerAvailable: true,
    });

    expect(result.verdict).toBe('PASS');
    expect(result.codes).toContain('FINAL_AUDIT_SAFE_TO_RELEASE');
    expect(result.blocking).toBe(false);
  });

  test('persists final_external_audit_v1 artifact', async () => {
    const result = await persistFinalExternalAudit({
      supabase: {} as any,
      jobId: 'job-final-audit',
      manuscriptId: 123,
      userId: 'user-1',
      wordCount: 50000,
      workType: 'novel',
      evaluationResult: makeResult(),
      checkedArtifacts: completeArtifacts,
    });

    expect(result.schema_version).toBe('final_external_audit_v1');
    expect(upsertEvaluationArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-final-audit',
        manuscriptId: 123,
        artifactType: 'final_external_audit_v1',
        artifactVersion: 'final_external_audit_v1',
        content: expect.objectContaining({ schema_version: 'final_external_audit_v1' }),
      }),
    );
  });
});
