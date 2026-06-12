import { createHash } from 'crypto';
import {
  isUnifiedEvaluationDocument,
  loadCertifiedUnifiedEvaluationDocumentArtifact,
} from '@/lib/evaluation/persistedUnifiedEvaluationDocument';
import { buildUnifiedEvaluationDocument } from '@/lib/evaluation/unifiedEvaluationDocument';

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function makeUnifiedDocument() {
  return buildUnifiedEvaluationDocument({
    mode: 'short_form_evaluation',
    displayTitle: 'Certified Manuscript',
    dream: null,
    result: {
      generated_at: '2026-06-12T00:00:00.000Z',
      overview: {
        overall_score_0_100: 84,
        verdict: 'revise',
        one_paragraph_summary: 'A persisted canonical summary.',
        top_3_strengths: ['Voice'],
        top_3_risks: ['Pacing'],
      },
      metrics: {
        manuscript: {
          title: 'Certified Manuscript',
          word_count: 4500,
          genre: 'literary fiction',
          target_audience: 'Adult readers',
        },
      },
      enrichment: {
        premise: 'A premise from the canonical artifact.',
        trigger_warnings: [],
        reading_grade_level: 8,
        dialogue_percentage: 20,
        narrative_percentage: 80,
      },
      criteria: [
        {
          key: 'narrativeDrive',
          score_0_10: 8,
          confidence_level: 'high',
          rationale: 'The canonical criterion rationale.',
          recommendations: [{ priority: 'high', action: 'Tighten the midpoint.' }],
        },
      ],
      recommendations: {
        quick_wins: [{ action: 'Clarify the opening image.' }],
        strategic_revisions: [{ action: 'Rebalance the second act.' }],
      },
    },
  });
}

function makeSupabaseMock(rows: Record<string, unknown>, errors: Record<string, { message: string } | null> = {}) {
  return {
    from: jest.fn(() => {
      const chain = {
        artifactType: undefined as string | undefined,
        select: jest.fn(() => chain),
        eq: jest.fn((field: string, value: string) => {
          if (field === 'artifact_type') chain.artifactType = value;
          return chain;
        }),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({
          data: chain.artifactType ? rows[chain.artifactType] ?? null : null,
          error: chain.artifactType ? errors[chain.artifactType] ?? null : null,
        })),
      };
      return chain;
    }),
  };
}

describe('persisted unified evaluation document loader', () => {
  test('recognizes a valid UnifiedEvaluationDocument shape', () => {
    const unifiedDocument = makeUnifiedDocument();
    expect(isUnifiedEvaluationDocument(unifiedDocument)).toBe(true);
    expect(isUnifiedEvaluationDocument({ ...unifiedDocument, titleBlock: null })).toBe(false);
  });

  test('loads certified persisted UED when certification hash matches', async () => {
    const unifiedDocument = makeUnifiedDocument();
    const supabase = makeSupabaseMock({
      unified_evaluation_document_v1: { content: unifiedDocument },
      author_exposure_certification_v1: {
        content: {
          schema_version: 'author_exposure_certification_v1',
          decision: 'certified',
          unified_document_hash: stableHash(unifiedDocument),
        },
      },
    });

    const result = await loadCertifiedUnifiedEvaluationDocumentArtifact(supabase as never, 'job-1');

    expect(result).toMatchObject({ ok: true, source: 'persisted_artifact' });
    if (result.ok) {
      expect(result.document.title).toBe('Certified Manuscript');
      expect(result.unifiedDocumentHash).toBe(stableHash(unifiedDocument));
    }
  });

  test('reports missing UED separately so routes can legacy-fallback old jobs', async () => {
    const supabase = makeSupabaseMock({
      author_exposure_certification_v1: {
        content: {
          schema_version: 'author_exposure_certification_v1',
          decision: 'certified',
          unified_document_hash: 'unused',
        },
      },
    });

    const result = await loadCertifiedUnifiedEvaluationDocumentArtifact(supabase as never, 'legacy-job');

    expect(result).toEqual({ ok: false, reason: 'missing_unified_document_artifact' });
  });

  test('fails closed when certification hash does not match persisted UED', async () => {
    const unifiedDocument = makeUnifiedDocument();
    const supabase = makeSupabaseMock({
      unified_evaluation_document_v1: { content: unifiedDocument },
      author_exposure_certification_v1: {
        content: {
          schema_version: 'author_exposure_certification_v1',
          decision: 'certified',
          unified_document_hash: 'not-the-current-ued-hash',
        },
      },
    });

    const result = await loadCertifiedUnifiedEvaluationDocumentArtifact(supabase as never, 'job-1');

    expect(result).toMatchObject({ ok: false, reason: 'certification_hash_mismatch' });
  });

  test('fails closed when certification artifact is not certified', async () => {
    const unifiedDocument = makeUnifiedDocument();
    const supabase = makeSupabaseMock({
      unified_evaluation_document_v1: { content: unifiedDocument },
      author_exposure_certification_v1: {
        content: {
          schema_version: 'author_exposure_certification_v1',
          decision: 'blocked',
          unified_document_hash: stableHash(unifiedDocument),
        },
      },
    });

    const result = await loadCertifiedUnifiedEvaluationDocumentArtifact(supabase as never, 'job-1');

    expect(result).toEqual({ ok: false, reason: 'invalid_certification_artifact' });
  });
});
