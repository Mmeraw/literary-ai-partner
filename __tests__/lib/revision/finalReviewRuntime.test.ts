import { applyFinalReviewDecisions, buildFinalReviewExport } from '@/lib/revision/finalReviewRuntime';
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue';
import { resolveFinalReviewSourceText } from '@/lib/revision/finalReviewSourceText';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import {
  revisionCandidateHash,
  revisionOpportunityVersion,
  type RevisionCandidateSlot,
} from '@/lib/revision/decisionAuthorityIdentity';

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/revision/workbenchQueue', () => ({ getWorkbenchQueue: jest.fn() }));
jest.mock('@/lib/revision/finalReviewSourceText', () => {
  const actual = jest.requireActual('@/lib/revision/finalReviewSourceText') as Record<string, unknown>;
  return { ...actual, resolveFinalReviewSourceText: jest.fn() };
});

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetWorkbenchQueue = getWorkbenchQueue as jest.MockedFunction<typeof getWorkbenchQueue>;
const mockResolveFinalReviewSourceText = resolveFinalReviewSourceText as jest.MockedFunction<typeof resolveFinalReviewSourceText>;

const SOURCE_TEXT = 'Alpha original safe. Beta original strategy. Gamma original withheld. Delta unchanged.';
let decisionCounter = 0;

function makeCopyPasteOpportunity(input: {
  id: string;
  title?: string;
  anchor?: string;
  sourceExcerpt?: string;
  candidateA?: string;
  candidateB?: string;
  candidateC?: string;
  sourceUedHash?: string;
  sourceOpportunityId?: string;
  sourceCriterion?: string;
}) {
  const candidateA = input.candidateA !== undefined ? input.candidateA : 'Alpha repaired safe.';
  const candidateB = input.candidateB !== undefined ? input.candidateB : 'Alpha repaired variant B.';
  const candidateC = input.candidateC !== undefined ? input.candidateC : 'Alpha repaired variant C.';
  return {
    id: input.id,
    title: input.title ?? `Opportunity ${input.id}`,
    cardType: 'copy_paste_rewrite',
    trustedPathStatus: 'eligible',
    anchor: input.anchor ?? 'chapter 1',
    quoteHighlight: input.sourceExcerpt ?? 'Alpha original safe.',
    quoteRest: '',
    sourceUedHash: input.sourceUedHash ?? 'ued-hash-1',
    sourceOpportunityId: input.sourceOpportunityId ?? `${input.id}-source`,
    sourceCriterion: input.sourceCriterion ?? 'PACING',
    options: [
      { key: 'A', candidateText: candidateA, text: candidateA },
      { key: 'B', candidateText: candidateB, text: candidateB },
      { key: 'C', candidateText: candidateC, text: candidateC },
    ],
  };
}

function authorityMetadata(input: {
  id?: string;
  anchor?: string;
  sourceExcerpt?: string;
  candidateA?: string;
  candidateB?: string;
  candidateC?: string;
  sourceUedHash?: string;
  sourceOpportunityId?: string;
  sourceCriterion?: string;
  selectedOption?: RevisionCandidateSlot | null;
} = {}) {
  const opportunity = makeCopyPasteOpportunity({
    id: input.id ?? 'copy-1',
    anchor: input.anchor,
    sourceExcerpt: input.sourceExcerpt,
    candidateA: input.candidateA,
    candidateB: input.candidateB,
    candidateC: input.candidateC,
    sourceUedHash: input.sourceUedHash,
    sourceOpportunityId: input.sourceOpportunityId,
    sourceCriterion: input.sourceCriterion,
  });
  const sourceExcerpt = `${opportunity.quoteHighlight}${opportunity.quoteRest}`.trim();
  const sourceLocation = opportunity.anchor;
  const base = {
    sourceUedHash: opportunity.sourceUedHash,
    sourceOpportunityId: opportunity.sourceOpportunityId,
    sourceCriterion: opportunity.sourceCriterion,
    opportunityVersion: revisionOpportunityVersion({
      id: opportunity.id,
      sourceUedHash: opportunity.sourceUedHash,
      sourceOpportunityId: opportunity.sourceOpportunityId,
      sourceCriterion: opportunity.sourceCriterion,
      sourceExcerpt,
      sourceLocation,
      cardType: opportunity.cardType,
      trustedPathStatus: opportunity.trustedPathStatus,
      options: opportunity.options,
    }),
  };

  const selectedOption = input.selectedOption === undefined ? 'A' : input.selectedOption;
  if (!selectedOption) return base;

  const option = opportunity.options.find((candidate) => candidate.key === selectedOption);
  return {
    ...base,
    candidateSlot: selectedOption,
    candidateHash: revisionCandidateHash({
      opportunityId: opportunity.id,
      candidateSlot: selectedOption,
      candidateText: option?.candidateText ?? option?.text ?? '',
      sourceUedHash: opportunity.sourceUedHash,
      sourceOpportunityId: opportunity.sourceOpportunityId,
      sourceCriterion: opportunity.sourceCriterion,
    }),
  };
}

type MockQueryInput = { single?: unknown; list?: unknown[]; insertSpy?: jest.Mock; upsertSpy?: jest.Mock };

function makeQuery(input: MockQueryInput = {}) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(async () => ({ data: input.list ?? [], error: null })),
    maybeSingle: jest.fn(async () => ({ data: input.single ?? null, error: null })),
    single: jest.fn(async () => ({ data: input.single ?? null, error: null })),
    insert: input.insertSpy ?? jest.fn(async () => ({ data: null, error: null })),
    upsert: input.upsertSpy ?? jest.fn(() => query),
  };
  return query;
}

function decision(overrides: Partial<Record<string, unknown>> = {}) {
  decisionCounter += 1;
  const createdAt = new Date(Date.UTC(2026, 5, 8, 0, 0, decisionCounter)).toISOString();
  return {
    id: '00000000-0000-0000-0000-000000000001',
    opportunity_id: 'copy-1',
    opportunity_title: 'Safe copy repair',
    decision: 'accepted_a',
    selected_option: 'A',
    custom_text: null,
    selected_text: 'Alpha repaired safe.',
    source_excerpt: 'Alpha original safe.',
    source_location: 'chapter 1',
    metadata: authorityMetadata(),
    created_at: createdAt,
    ...overrides,
  };
}

function buildSupabaseMock(
  decisions: Array<Record<string, unknown>>,
  options?: { manuscriptOwnerId?: string; rpcResults?: Array<{ revised_version_id: string; reused_existing_version: boolean }> },
) {
  const insertSpy = jest.fn(async () => ({ data: null, error: null }));
  const artifactUpsertSpy = jest.fn(() => makeQuery({ single: { id: 'completion-artifact-1' } }));
  const manuscriptOwnerId = options?.manuscriptOwnerId ?? 'user-1';
  const rpcResults = options?.rpcResults ?? [{ revised_version_id: 'version-2', reused_existing_version: false }];
  let rpcCall = 0;
  const rpc = jest.fn(async () => ({
    data: [rpcResults[Math.min(rpcCall++, rpcResults.length - 1)]],
    error: null,
  }));

  const tables: Record<string, ReturnType<typeof makeQuery>> = {
    manuscripts: makeQuery({ single: { id: 6074, title: 'Sister', user_id: manuscriptOwnerId } }),
    evaluation_jobs: makeQuery({ single: { id: 'job-1', status: 'complete', manuscript_id: 6074, manuscript_version_id: 'version-1' } }),
    manuscript_versions: makeQuery({ single: { id: 'version-1', raw_text: SOURCE_TEXT } }),
    revision_ledger_decisions: makeQuery({ list: decisions }),
    final_review_apply_runs: makeQuery({ insertSpy }),
    evaluation_artifacts: makeQuery({ upsertSpy: artifactUpsertSpy }),
  };

  return {
    insertSpy,
    artifactUpsertSpy,
    rpc,
    client: {
      from: jest.fn((table: string) => {
        const query = tables[table];
        if (!query) throw new Error(`Unexpected table: ${table}`);
        return query;
      }),
      rpc,
    },
  };
}

function mockQueueWithIds(copyPasteIds: string[] = ['copy-1']) {
  const opportunities = copyPasteIds.map((id) => {
    if (id === 'copy-1') {
      return makeCopyPasteOpportunity({
        id,
        title: 'Safe copy repair',
        anchor: 'chapter 1',
        sourceExcerpt: 'Alpha original safe.',
        candidateA: 'Alpha repaired safe.',
      });
    }
    if (id === 'copy-2') {
      return makeCopyPasteOpportunity({
        id,
        title: 'Delta copy repair',
        anchor: 'chapter 4',
        sourceExcerpt: 'Delta unchanged.',
        candidateA: 'Delta preserved.',
      });
    }
    return makeCopyPasteOpportunity({ id });
  });

  mockGetWorkbenchQueue.mockResolvedValue({
    ok: true,
    opportunities,
    needsTargeting: [{ id: 'strategy-1', cardType: 'revision_strategy' }],
    withheldUnsupported: [{ id: 'withheld-1' }],
  } as never);
}

function mockQueue() {
  mockQueueWithIds();
}

describe('final review runtime governance', () => {
  const ORIGINAL_OPERATOR_EMAILS = process.env.EVALUATION_OPERATOR_EMAILS;
  const ORIGINAL_ADMIN_EMAILS = process.env.REVISIONGRADE_ADMIN_EMAILS;

  beforeEach(() => {
    jest.clearAllMocks();
    decisionCounter = 0;
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1' } as never);
    mockResolveFinalReviewSourceText.mockResolvedValue(SOURCE_TEXT);
    mockQueue();
  });

  afterEach(() => {
    process.env.EVALUATION_OPERATOR_EMAILS = ORIGINAL_OPERATOR_EMAILS;
    process.env.REVISIONGRADE_ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  });

  it('exports a semi-revised manuscript by applying only queue-visible copy-paste repairs', async () => {
    const { client, insertSpy, artifactUpsertSpy } = buildSupabaseMock([
      decision(),
      decision({ id: '00000000-0000-0000-0000-000000000002', opportunity_id: 'strategy-1', opportunity_title: 'Strategy card', selected_text: 'Beta strategy replacement should not apply.', source_excerpt: 'Beta original strategy.' }),
      decision({ id: '00000000-0000-0000-0000-000000000003', opportunity_id: 'withheld-1', opportunity_title: 'Withheld card', selected_text: 'Gamma withheld replacement should not apply.', source_excerpt: 'Gamma original withheld.' }),
    ]);
    mockCreateAdminClient.mockReturnValue(client as never);

    const exported = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'clean' });

    expect(exported.content).toContain('Alpha repaired safe.');
    expect(exported.content).toContain('Beta original strategy.');
    expect(exported.content).toContain('Gamma original withheld.');
    expect(exported.content).not.toContain('Beta strategy replacement should not apply.');
    expect(exported.content).not.toContain('Gamma withheld replacement should not apply.');
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'exported',
      applied_decision_ids: ['00000000-0000-0000-0000-000000000001'],
      skipped_decision_ids: ['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'],
    }));
    expect(artifactUpsertSpy).toHaveBeenCalled();
  });

  it('blocks Final Review until every ready copy-paste opportunity has a saved decision', async () => {
    mockGetWorkbenchQueue.mockResolvedValue({ ok: true, opportunities: [{ id: 'copy-1' }, { id: 'copy-2' }], needsTargeting: [], withheldUnsupported: [] } as never);
    const { client, insertSpy, rpc } = buildSupabaseMock([decision()]);
    mockCreateAdminClient.mockReturnValue(client as never);

    const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });

    expect(result).toEqual({ ok: false, error: 'Final Review unlocks after every ready revision card has a saved decision.' });
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'blocked', mode: 'apply' }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('claims and creates a derived version through the atomic Apply RPC', async () => {
    const { client, rpc, insertSpy } = buildSupabaseMock([
      decision(),
      decision({ id: '00000000-0000-0000-0000-000000000002', opportunity_id: 'strategy-1', opportunity_title: 'Strategy card' }),
    ]);
    mockCreateAdminClient.mockReturnValue(client as never);

    const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });

    expect(result).toEqual({ ok: true, revisedVersionId: 'version-2', appliedCount: 1, reusedExistingVersion: false });
    expect(rpc).toHaveBeenCalledWith('apply_final_review_once', expect.objectContaining({
      p_user_id: 'user-1',
      p_manuscript_id: 6074,
      p_evaluation_job_id: 'job-1',
      p_source_version_id: 'version-1',
      p_apply_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_raw_text: 'Alpha repaired safe. Beta original strategy. Gamma original withheld. Delta unchanged.',
      p_word_count: 11,
      p_applied_decision_ids: ['00000000-0000-0000-0000-000000000001'],
      p_skipped_decision_ids: ['00000000-0000-0000-0000-000000000002'],
    }));
    expect(insertSpy).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'applied' }));
  });

  it('returns the same revised version for a sequential duplicate Apply', async () => {
    const { client, rpc } = buildSupabaseMock([decision()], {
      rpcResults: [
        { revised_version_id: 'version-2', reused_existing_version: false },
        { revised_version_id: 'version-2', reused_existing_version: true },
      ],
    });
    mockCreateAdminClient.mockReturnValue(client as never);

    const first = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
    const second = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });

    expect(first).toEqual(expect.objectContaining({ revisedVersionId: 'version-2', reusedExistingVersion: false }));
    expect(second).toEqual(expect.objectContaining({ revisedVersionId: 'version-2', reusedExistingVersion: true }));
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1].p_apply_fingerprint).toBe(rpc.mock.calls[0][1].p_apply_fingerprint);
  });

  it('uses the same deterministic fingerprint for concurrent duplicate requests', async () => {
    const { client, rpc } = buildSupabaseMock([decision()], {
      rpcResults: [
        { revised_version_id: 'version-2', reused_existing_version: false },
        { revised_version_id: 'version-2', reused_existing_version: true },
      ],
    });
    mockCreateAdminClient.mockReturnValue(client as never);

    const [first, second] = await Promise.all([
      applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' }),
      applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' }),
    ]);

    expect(first.revisedVersionId).toBe('version-2');
    expect(second.revisedVersionId).toBe('version-2');
    expect(rpc.mock.calls[0][1].p_apply_fingerprint).toBe(rpc.mock.calls[1][1].p_apply_fingerprint);
  });

  it('allows privileged operator export for non-owned manuscripts using owner ledger rows', async () => {
    process.env.EVALUATION_OPERATOR_EMAILS = 'ops@example.com';
    process.env.REVISIONGRADE_ADMIN_EMAILS = '';
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'operator-1', email: 'ops@example.com' } as never);

    const { client } = buildSupabaseMock([decision()], { manuscriptOwnerId: 'owner-1' });
    mockCreateAdminClient.mockReturnValue(client as never);

    const exported = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'clean' });
    expect(exported.content).toContain('Alpha repaired safe.');

    const queryIndex = (client.from as jest.Mock).mock.calls.findIndex((call) => call[0] === 'revision_ledger_decisions');
    const ledgerQuery = (client.from as jest.Mock).mock.results[queryIndex]?.value;
    expect(ledgerQuery.eq).toHaveBeenCalledWith('user_id', 'owner-1');
  });

  describe('manuscript determinism and fail-closed application', () => {
    it('applies accepted copy-paste decisions exactly once and preserves unchanged passages', async () => {
      const source = 'Alpha original safe. Beta original strategy. Gamma original withheld. Delta unchanged.';
      mockResolveFinalReviewSourceText.mockResolvedValue(source);
      mockQueueWithIds(['copy-1', 'copy-2']);

      const acceptedDelta = decision({
        id: '00000000-0000-0000-0000-000000000004',
        opportunity_id: 'copy-2',
        source_excerpt: 'Delta unchanged.',
        source_location: 'chapter 4',
        selected_text: 'Delta preserved.',
        metadata: authorityMetadata({ id: 'copy-2', anchor: 'chapter 4', sourceExcerpt: 'Delta unchanged.', candidateA: 'Delta preserved.' }),
      });

      const { client, rpc } = buildSupabaseMock([decision(), acceptedDelta]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(true);

      const rawText = rpc.mock.calls[0][1].p_raw_text as string;
      expect(rawText).toBe('Alpha repaired safe. Beta original strategy. Gamma original withheld. Delta preserved.');
      expect(rawText).toContain('Beta original strategy.');
      expect(rawText).toContain('Gamma original withheld.');
      expect(rawText.indexOf('Alpha repaired safe.')).toBeLessThan(rawText.indexOf('Delta preserved.'));

      const appliedIds = rpc.mock.calls[0][1].p_applied_decision_ids as string[];
      expect(appliedIds).toHaveLength(2);
      expect(new Set(appliedIds).size).toBe(2);
    });

    it('does not modify the manuscript for rejected, deferred, keep_original, strategy, or withheld decisions', async () => {
      const source = 'Alpha original safe. Beta original strategy. Gamma original withheld. Delta unchanged.';
      mockResolveFinalReviewSourceText.mockResolvedValue(source);

      const decisions = [
        decision(),
        decision({ id: '00000000-0000-0000-0000-000000000002', opportunity_id: 'copy-1', decision: 'rejected', selected_text: 'REJECTED BETA' }),
        decision({ id: '00000000-0000-0000-0000-000000000003', opportunity_id: 'copy-1', decision: 'deferred', selected_text: 'DEFERRED BETA' }),
        decision({ id: '00000000-0000-0000-0000-000000000004', opportunity_id: 'copy-1', decision: 'keep_original', selected_text: 'KEPT BETA' }),
        decision({ id: '00000000-0000-0000-0000-000000000005', opportunity_id: 'strategy-1', decision: 'accepted_a', selected_text: 'STRATEGY BETA' }),
        decision({ id: '00000000-0000-0000-0000-000000000006', opportunity_id: 'withheld-1', decision: 'accepted_a', selected_text: 'WITHHELD GAMMA' }),
      ];

      const { client } = buildSupabaseMock(decisions);
      mockCreateAdminClient.mockReturnValue(client as never);

      const exported = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'clean' });
      expect(exported.content).toContain('Alpha repaired safe.');
      expect(exported.content).toContain('Beta original strategy.');
      expect(exported.content).toContain('Gamma original withheld.');
      expect(exported.content).toContain('Delta unchanged.');
      expect(exported.content).not.toContain('REJECTED BETA');
      expect(exported.content).not.toContain('STRATEGY BETA');
      expect(exported.content).not.toContain('WITHHELD GAMMA');
    });

    it('replays the same decision ledger to an identical raw text and fingerprint', async () => {
      const { client, rpc } = buildSupabaseMock([decision()], {
        rpcResults: [
          { revised_version_id: 'version-2', reused_existing_version: false },
          { revised_version_id: 'version-2', reused_existing_version: true },
        ],
      });
      mockCreateAdminClient.mockReturnValue(client as never);

      const first = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      const second = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });

      expect(first.ok && second.ok).toBe(true);
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls[0][1].p_raw_text).toBe(rpc.mock.calls[1][1].p_raw_text);
      expect(rpc.mock.calls[0][1].p_apply_fingerprint).toBe(rpc.mock.calls[1][1].p_apply_fingerprint);
    });

    it('blocks apply when a source excerpt does not match the manuscript (anchor mismatch)', async () => {
      mockResolveFinalReviewSourceText.mockResolvedValue(SOURCE_TEXT);
      const stale = decision({ selected_text: 'Alpha repaired safe.', source_excerpt: 'Missing excerpt.' });

      const { client } = buildSupabaseMock([stale]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/source identity mismatch/i);
    });

    it('blocks apply when a source excerpt is not unique', async () => {
      const duplicated = 'The river moved below them. The river moved below them.';
      mockResolveFinalReviewSourceText.mockResolvedValue(duplicated);
      const ambiguous = decision({ source_excerpt: 'The river moved below them.', selected_text: 'Alpha repaired safe.' });
      ambiguous.metadata = authorityMetadata({ sourceExcerpt: 'The river moved below them.', candidateA: 'Alpha repaired safe.' });

      mockGetWorkbenchQueue.mockResolvedValue({
        ok: true,
        opportunities: [makeCopyPasteOpportunity({ id: 'copy-1', sourceExcerpt: 'The river moved below them.', candidateA: 'Alpha repaired safe.' })],
        needsTargeting: [{ id: 'strategy-1', cardType: 'revision_strategy' }],
        withheldUnsupported: [],
      } as never);

      const { client } = buildSupabaseMock([ambiguous]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not unique/i);
    });

    it('blocks apply when accepted decisions have overlapping edit regions', async () => {
      const source = 'Alpha beta gamma delta.';
      mockResolveFinalReviewSourceText.mockResolvedValue(source);
      mockQueueWithIds(['copy-1', 'copy-2']);
      const first = decision({
        id: '00000000-0000-0000-0000-000000000002',
        opportunity_id: 'copy-1',
        source_excerpt: 'beta gamma',
        selected_text: 'BETA GAMMA',
        metadata: authorityMetadata({ sourceExcerpt: 'beta gamma', candidateA: 'BETA GAMMA' }),
      });
      const second = decision({
        id: '00000000-0000-0000-0000-000000000003',
        opportunity_id: 'copy-2',
        source_excerpt: 'gamma delta',
        selected_text: 'GAMMA DELTA',
        metadata: authorityMetadata({ id: 'copy-2', sourceExcerpt: 'gamma delta', candidateA: 'GAMMA DELTA' }),
      });

      mockGetWorkbenchQueue.mockResolvedValue({
        ok: true,
        opportunities: [
          makeCopyPasteOpportunity({ id: 'copy-1', sourceExcerpt: 'beta gamma', candidateA: 'BETA GAMMA' }),
          makeCopyPasteOpportunity({ id: 'copy-2', sourceExcerpt: 'gamma delta', candidateA: 'GAMMA DELTA' }),
        ],
        needsTargeting: [{ id: 'strategy-1', cardType: 'revision_strategy' }],
        withheldUnsupported: [],
      } as never);

      const { client } = buildSupabaseMock([first, second]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/overlapping edit regions/i);
    });

    it('blocks apply when duplicate decision ids are present', async () => {
      mockQueueWithIds(['copy-1', 'copy-2']);
      const duplicate = decision({
        id: '00000000-0000-0000-0000-000000000001',
        opportunity_id: 'copy-2',
        source_excerpt: 'Delta unchanged.',
        selected_text: 'Other.',
        metadata: authorityMetadata({ id: 'copy-2', anchor: 'chapter 4', sourceExcerpt: 'Delta unchanged.', candidateA: 'Delta preserved.' }),
      });

      const { client } = buildSupabaseMock([decision(), duplicate]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/duplicate decision id/i);
    });

    it('blocks apply when a duplicate decision id appears across applicable and non-applicable rows', async () => {
      const duplicate = decision({
        id: '00000000-0000-0000-0000-000000000001',
        opportunity_id: 'strategy-1',
        decision: 'reject',
        selected_text: 'REJECTED',
        source_excerpt: 'Beta original strategy.',
      });

      const { client } = buildSupabaseMock([decision(), duplicate]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/duplicate decision id/i);
    });

    it('exports clean, marked, and changelog from the same canonical source and decisions', async () => {
      const { client } = buildSupabaseMock([decision()]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const clean = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'clean' });
      const marked = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'marked' });
      const changelog = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'changelog' });

      expect(clean.content).toBe('Alpha repaired safe. Beta original strategy. Gamma original withheld. Delta unchanged.');
      expect(marked.content).toContain(SOURCE_TEXT);
      expect(marked.content).toContain('Alpha repaired safe.');
      expect(changelog.content).toContain('Safe copy repair');
      expect(changelog.content).toContain('Accepted A');
    });
    it('uses the latest persisted decision state (not stale prior choices) for apply authority', async () => {
      const staleAccepted = decision({
        id: '00000000-0000-0000-0000-000000000010',
        local_id: 'local-v3',
        decision: 'accepted_a',
        selected_option: 'A',
        selected_text: 'Alpha repaired safe.',
        created_at: '2026-06-08T00:00:00.000Z',
      });

      const latestRejected = decision({
        id: '00000000-0000-0000-0000-000000000011',
        local_id: 'local-v4',
        decision: 'reject',
        selected_option: null,
        selected_text: 'Rejected recommendation',
        created_at: '2026-06-08T00:01:00.000Z',
      });

      const { client, rpc, insertSpy } = buildSupabaseMock([latestRejected, staleAccepted]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });

      expect(result).toEqual({
        ok: false,
        error: 'No applicable accepted/custom decisions with persisted text snapshots.',
      });
      expect(rpc).not.toHaveBeenCalled();
      expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'blocked',
        mode: 'apply',
        blocked_reason: expect.stringContaining('No applicable accepted/custom decisions'),
      }));
    });

    it('blocks apply when accepted selected text fails the secondary integrity diagnostic', async () => {
      const staleAccepted = decision({
        selected_option: 'A',
        selected_text: 'Alpha repaired OLD version.',
      });

      const { client } = buildSupabaseMock([staleAccepted]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/selected text diagnostic mismatch/i);
    });

    it('blocks apply when an opportunity is rebuilt with the same id but a different candidate set', async () => {
      const savedAgainstOldCandidateSet = decision({
        selected_option: 'A',
        selected_text: 'Alpha repaired safe.',
        metadata: authorityMetadata({ candidateA: 'Alpha repaired safe.' }),
      });

      mockGetWorkbenchQueue.mockResolvedValue({
        ok: true,
        opportunities: [makeCopyPasteOpportunity({ id: 'copy-1', candidateA: 'Alpha rebuilt candidate from a newer opportunity version.' })],
        needsTargeting: [{ id: 'strategy-1', cardType: 'revision_strategy' }],
        withheldUnsupported: [],
      } as never);

      const { client, rpc } = buildSupabaseMock([savedAgainstOldCandidateSet]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/opportunity version mismatch/i);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('uses candidate slot and hash identity so equal candidate text in another slot is not accepted as membership proof', async () => {
      const sameText = 'Alpha repaired safe.';
      const savedAsSlotB = decision({
        selected_option: 'A',
        selected_text: sameText,
        metadata: authorityMetadata({ candidateA: sameText, candidateB: sameText, selectedOption: 'B' }),
      });

      mockGetWorkbenchQueue.mockResolvedValue({
        ok: true,
        opportunities: [makeCopyPasteOpportunity({ id: 'copy-1', candidateA: sameText, candidateB: sameText })],
        needsTargeting: [{ id: 'strategy-1', cardType: 'revision_strategy' }],
        withheldUnsupported: [],
      } as never);

      const { client, rpc } = buildSupabaseMock([savedAsSlotB]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/candidateSlot B does not match selected option A/i);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('blocks apply when authoritative candidate text is missing for an accepted option', async () => {
      mockGetWorkbenchQueue.mockResolvedValue({
        ok: true,
        opportunities: [makeCopyPasteOpportunity({ id: 'copy-1', candidateA: '' })],
        needsTargeting: [{ id: 'strategy-1', cardType: 'revision_strategy' }],
        withheldUnsupported: [],
      } as never);

      const { client } = buildSupabaseMock([decision({ metadata: authorityMetadata({ candidateA: '' }) })]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/authoritative candidate A is missing/i);
    });

    it('blocks apply on source identity mismatch between persisted decision and authoritative opportunity', async () => {
      const mismatchedDecision = decision({
        source_excerpt: 'Alpha original safe.',
        source_location: 'chapter 9',
      });

      const { client } = buildSupabaseMock([mismatchedDecision]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/source identity mismatch/i);
      expect(result.error).toMatch(/location/i);
    });

    it('blocks apply when multiple concurrent latest decisions exist for one opportunity', async () => {
      const conflictedA = decision({
        id: '00000000-0000-0000-0000-000000000101',
        decision: 'accepted_a',
        selected_option: 'A',
        selected_text: 'Alpha repaired safe.',
        created_at: '2026-06-08T00:00:00.000Z',
      });
      const conflictedB = decision({
        id: '00000000-0000-0000-0000-000000000102',
        decision: 'custom',
        selected_option: null,
        custom_text: 'Custom replacement text.',
        selected_text: 'Custom replacement text.',
        created_at: '2026-06-08T00:00:00.000Z',
      });

      const { client, rpc } = buildSupabaseMock([conflictedA, conflictedB]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/concurrent latest decisions/i);
      expect(rpc).not.toHaveBeenCalled();
    });
  });
});
