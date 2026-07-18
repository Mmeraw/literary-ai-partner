import type { Mock } from 'jest-mock';
import {
  revisionCandidateHash,
  revisionOpportunityVersion,
} from '@/lib/revision/decisionAuthorityIdentity';

const sourceText = 'Alpha original sentence. Untouched middle paragraph. Untouched final paragraph.';
const replacementText = 'Alpha revised sentence with a grounded, author-approved improvement.';

const canonicalOpportunity = {
  id: 'opp-1',
  cardType: 'copy_paste_rewrite',
  trustedPathStatus: 'eligible',
  quoteHighlight: 'Alpha original sentence.',
  quoteRest: '',
  anchor: 'Opening paragraph',
  sourceUedHash: 'ued-shadow-1',
  sourceOpportunityId: 'source-opp-1',
  sourceCriterion: 'Opening clarity',
  options: [
    { key: 'A', candidateText: replacementText },
    { key: 'B', candidateText: 'Alternate grounded opening sentence.' },
    { key: 'C', candidateText: 'Second alternate grounded opening sentence.' },
  ],
};

const opportunityVersion = revisionOpportunityVersion({
  id: canonicalOpportunity.id,
  sourceUedHash: canonicalOpportunity.sourceUedHash,
  sourceOpportunityId: canonicalOpportunity.sourceOpportunityId,
  sourceCriterion: canonicalOpportunity.sourceCriterion,
  sourceExcerpt: canonicalOpportunity.quoteHighlight,
  sourceLocation: canonicalOpportunity.anchor,
  cardType: canonicalOpportunity.cardType,
  trustedPathStatus: canonicalOpportunity.trustedPathStatus,
  options: canonicalOpportunity.options,
});

const candidateHash = revisionCandidateHash({
  opportunityId: canonicalOpportunity.id,
  candidateSlot: 'A',
  candidateText: replacementText,
  sourceUedHash: canonicalOpportunity.sourceUedHash,
  sourceOpportunityId: canonicalOpportunity.sourceOpportunityId,
  sourceCriterion: canonicalOpportunity.sourceCriterion,
});

const decision = {
  id: 'decision-1',
  opportunity_id: 'opp-1',
  opportunity_title: 'Strengthen the opening sentence',
  decision: 'accepted_a',
  selected_option: 'A',
  custom_text: null,
  selected_text: replacementText,
  source_excerpt: 'Alpha original sentence.',
  source_location: 'Opening paragraph',
  metadata: {
    opportunityVersion,
    candidateSlot: 'A',
    candidateHash,
    sourceUedHash: canonicalOpportunity.sourceUedHash,
    sourceOpportunityId: canonicalOpportunity.sourceOpportunityId,
    sourceCriterion: canonicalOpportunity.sourceCriterion,
    cardType: canonicalOpportunity.cardType,
    trustedPathStatus: canonicalOpportunity.trustedPathStatus,
  },
  created_at: '2026-07-14T00:00:00.000Z',
};

const rpcCalls: Array<Record<string, unknown>> = [];
const insertedRuns: Array<Record<string, unknown>> = [];

function queryFor(table: string) {
  const query: Record<string, unknown> = {};
  const chain = query as Record<string, Mock>;

  chain.select = jest.fn(() => query);
  chain.eq = jest.fn(() => query);
  chain.order = jest.fn(async () => {
    if (table === 'revision_ledger_decisions') return { data: [decision], error: null };
    return { data: [], error: null };
  });
  chain.maybeSingle = jest.fn(async () => {
    if (table === 'manuscripts') {
      return { data: { id: 7519, title: 'Shadow Proof Manuscript', user_id: 'user-1' }, error: null };
    }
    if (table === 'evaluation_jobs') {
      return {
        data: {
          id: 'job-shadow-1',
          status: 'complete',
          manuscript_id: 7519,
          manuscript_version_id: 'version-source-1',
        },
        error: null,
      };
    }
    if (table === 'manuscript_versions') {
      return { data: { id: 'version-source-1', raw_text: sourceText }, error: null };
    }
    return { data: null, error: null };
  });
  chain.insert = jest.fn(async (payload: Record<string, unknown>) => {
    insertedRuns.push(payload);
    return { data: null, error: null };
  });

  return query;
}

const supabase = {
  from: jest.fn((table: string) => queryFor(table)),
  rpc: jest.fn(async (_name: string, payload: Record<string, unknown>) => {
    rpcCalls.push(payload);
    return {
      data: [{ revised_version_id: 'version-revised-1', reused_existing_version: rpcCalls.length > 1 }],
      error: null,
    };
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: jest.fn(async () => ({ id: 'user-1', email: 'author@example.com' })),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => supabase),
}));

jest.mock('@/lib/evaluation/artifactPersistence', () => ({
  upsertEvaluationArtifact: jest.fn(async () => 'completion-artifact-1'),
}));

jest.mock('@/lib/revision/finalReviewSourceText', () => ({
  resolveFinalReviewSourceText: jest.fn(async () => sourceText),
  scrubInternalReportLeakage: jest.fn((value: string) => value),
}));

jest.mock('@/lib/revision/workbenchQueue', () => ({
  getWorkbenchQueue: jest.fn(async () => ({
    ok: true,
    opportunities: [canonicalOpportunity],
    needsTargeting: [],
    withheldUnsupported: [],
  })),
}));

import {
  applyFinalReviewDecisions,
  buildFinalReviewExport,
} from '@/lib/revision/finalReviewRuntime';

describe('pre-live shadow E2E: certified evaluation → Revise decision → revised manuscript', () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    insertedRuns.length = 0;
    jest.clearAllMocks();
  });

  it('applies the accepted decision once, preserves untouched text, and reuses the same revised version on replay', async () => {
    const first = await applyFinalReviewDecisions({ manuscriptId: 7519, evaluationJobId: 'job-shadow-1' });

    expect(first).toEqual({
      ok: true,
      revisedVersionId: 'version-revised-1',
      appliedCount: 1,
      reusedExistingVersion: false,
    });
    expect(rpcCalls).toHaveLength(1);

    const firstPayload = rpcCalls[0];
    const revisedText = String(firstPayload.p_raw_text);
    expect(revisedText).toContain(replacementText);
    expect(revisedText).not.toContain('Alpha original sentence.');
    expect(revisedText).toContain('Untouched middle paragraph.');
    expect(revisedText).toContain('Untouched final paragraph.');
    expect(firstPayload.p_applied_decision_ids).toEqual(['decision-1']);
    expect(firstPayload.p_skipped_decision_ids).toEqual([]);
    expect(String(firstPayload.p_apply_fingerprint)).toMatch(/^[a-f0-9]{64}$/);

    const second = await applyFinalReviewDecisions({ manuscriptId: 7519, evaluationJobId: 'job-shadow-1' });

    expect(second).toEqual({
      ok: true,
      revisedVersionId: 'version-revised-1',
      appliedCount: 1,
      reusedExistingVersion: true,
    });
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[1].p_apply_fingerprint).toBe(firstPayload.p_apply_fingerprint);
    expect(rpcCalls[1].p_raw_text).toBe(firstPayload.p_raw_text);
  });

  it('builds a clean export from the same persisted author decision and excludes superseded source text', async () => {
    const exported = await buildFinalReviewExport({
      manuscriptId: 7519,
      evaluationJobId: 'job-shadow-1',
      format: 'clean',
      file: 'txt',
    });

    expect(exported.contentType).toBe('text/plain; charset=utf-8');
    expect(exported.filename).toContain('semi-revised-draft');
    expect(exported.content).toContain(replacementText);
    expect(exported.content).not.toContain('Alpha original sentence.');
    expect(exported.content).toContain('Untouched middle paragraph.');
    expect(exported.content).toContain('Untouched final paragraph.');

    expect(insertedRuns.some((run) => run.status === 'exported' && run.mode === 'export_clean')).toBe(true);
  });
});
