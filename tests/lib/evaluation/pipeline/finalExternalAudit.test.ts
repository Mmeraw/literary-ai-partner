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
    schema_version: 'evaluation_result_v2',
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
    expect(result.word_count).toBe(1200);
    expect(result.evaluation_result_version).toBe('evaluation_result_v2');
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

  test('does NOT block when revision_opportunity_ledger_v1 is missing (Revise-phase artifact)', () => {
    const result = runFinalExternalAudit({
      wordCount: 50000,
      evaluationResult: makeResult(),
      checkedArtifacts: {
        evaluation_result_v2: { present: true },
        longform_document_v1: { present: true },
        revision_opportunity_ledger_v1: { present: false },
        wave_revision_plan_v1: { present: true },
      },
      mode: 'optional',
      providerAvailable: true,
    });

    expect(result.verdict).not.toBe('BLOCK');
    expect(result.blocking).toBe(false);
  });

  test('does NOT block when wave_revision_plan_v1 is missing — warns instead', () => {
    const result = runFinalExternalAudit({
      wordCount: 50000,
      evaluationResult: makeResult(),
      checkedArtifacts: {
        evaluation_result_v2: { present: true },
        longform_document_v1: { present: true },
        revision_opportunity_ledger_v1: { present: false },
        wave_revision_plan_v1: { present: false },
      },
      mode: 'optional',
      providerAvailable: true,
    });

    expect(result.verdict).toBe('WARN');
    expect(result.blocking).toBe(false);
    expect(result.codes).toContain('FINAL_AUDIT_MISSING_WAVE');
    expect(result.missing_required_artifacts).toContain('wave_revision_plan_v1');
  });

  test('Cartel Babies regression: DREAM + eval present, ledger missing → PASS not BLOCK', () => {
    const result = runFinalExternalAudit({
      wordCount: 109472,
      evaluationResult: makeResult(),
      checkedArtifacts: {
        evaluation_result_v2: { present: true },
        longform_document_v1: { present: true },
        revision_opportunity_ledger_v1: { present: false },
        wave_revision_plan_v1: { present: true },
      },
      mode: 'optional',
      providerAvailable: false,
    });

    expect(result.verdict).not.toBe('BLOCK');
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

  test('persists short-form final_external_audit_v1 with SKIP verdict and source hash binding', async () => {
    const result = await persistFinalExternalAudit({
      supabase: {} as any,
      jobId: 'job-short-form',
      manuscriptId: 123,
      userId: 'user-1',
      wordCount: 1200,
      workType: 'short_story',
      evaluationResult: makeResult(),
      checkedArtifacts: completeArtifacts,
      evaluationResultSourceHash: 'result-source-hash-1',
    });

    expect(result.schema_version).toBe('final_external_audit_v1');
    expect(result.verdict).toBe('SKIP');
    expect(result.blocking).toBe(false);
    expect(result.word_count).toBe(1200);
    expect(result.evaluation_result_version).toBe('evaluation_result_v2');
    expect(result.evaluation_result_source_hash).toBe('result-source-hash-1');
    expect(upsertEvaluationArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-short-form',
        manuscriptId: 123,
        artifactType: 'final_external_audit_v1',
        artifactVersion: 'final_external_audit_v1',
        content: expect.objectContaining({
          schema_version: 'final_external_audit_v1',
          verdict: 'SKIP',
          blocking: false,
          word_count: 1200,
          evaluation_result_version: 'evaluation_result_v2',
          evaluation_result_source_hash: 'result-source-hash-1',
        }),
      }),
    );
  });

  test('provider cannot block solely for missing revision_opportunity_ledger_v1', async () => {
    process.env.PERPLEXITY_API_KEY = 'test-key';
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                verdict: 'BLOCK',
                codes: ['FINAL_AUDIT_SCHEMA_INVALID'],
                reason: 'Required artifact revision_opportunity_ledger_v1 is missing, so the packet is not auditable.',
                contradictions: [],
              }),
            },
          },
        ],
      }),
    } as Response)) as jest.Mock;

    try {
      const result = await persistFinalExternalAudit({
        supabase: {} as any,
        jobId: 'job-final-audit-provider-false-block',
        manuscriptId: 123,
        userId: 'user-1',
        wordCount: 50000,
        workType: 'novel',
        evaluationResult: makeResult(),
        checkedArtifacts: {
          evaluation_result_v2: { present: true },
          longform_document_v1: { present: true },
          revision_opportunity_ledger_v1: { present: false },
          wave_revision_plan_v1: { present: true },
        },
      });

      expect(result.verdict).not.toBe('BLOCK');
      expect(result.blocking).toBe(false);
      expect(result.codes).toContain('FINAL_AUDIT_SAFE_TO_RELEASE');
      expect(result.reason).toContain('Revise-phase only');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
