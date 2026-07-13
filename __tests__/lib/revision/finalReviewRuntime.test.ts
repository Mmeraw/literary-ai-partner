import { applyFinalReviewDecisions, buildFinalReviewExport } from '@/lib/revision/finalReviewRuntime';
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue';
import { resolveFinalReviewSourceText } from '@/lib/revision/finalReviewSourceText';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';

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

type MockQueryInput = {
  single?: unknown;
  list?: unknown[];
  insertSpy?: jest.Mock;
  upsertSpy?: jest.Mock;
};

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
    metadata: {},
    created_at: '2026-06-08T00:00:00.000Z',
    ...overrides,
  };
}

function buildSupabaseMock(
  decisions: Array<Record<string, unknown>>,
  options?: {
    manuscriptOwnerId?: string;
    rpcResults?: Array<{ revised_version_id: string; reused_existing_version: boolean }>;
  },
) {
  const insertSpy = jest.fn(async () => ({ data: null, error: null }));
  const artifactUpsertSpy = jest.fn(() => makeQuery({ single: { id: 'completion-artifact-1' } }));
  const manuscriptOwnerId = options?.manuscriptOwnerId ?? 'user-1';
  const rpcResults = options?.rpcResults ?? [
    { revised_version_id: 'version-2', reused_existing_version: false },
  ];
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

function mockQueue() {
  mockGetWorkbenchQueue.mockResolvedValue({
    ok: true,
    opportunities: [{ id: 'copy-1' }],
    needsTargeting: [{ id: 'strategy-1', cardType: 'revision_strategy' }],
    withheldUnsupported: [{ id: 'withheld-1' }],
  } as never);
}

describe('final review runtime governance', () => {
  const ORIGINAL_OPERATOR_EMAILS = process.env.EVALUATION_OPERATOR_EMAILS;
  const ORIGINAL_ADMIN_EMAILS = process.env.REVISIONGRADE_ADMIN_EMAILS;

  beforeEach(() => {
    jest.clearAllMocks();
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
      decision({
        id: '00000000-0000-0000-0000-000000000002',
        opportunity_id: 'strategy-1',
        opportunity_title: 'Strategy card',
        selected_text: 'Beta strategy replacement should not apply.',
        source_excerpt: 'Beta original strategy.',
      }),
      decision({
        id: '00000000-0000-0000-0000-000000000003',
        opportunity_id: 'withheld-1',
        opportunity_title: 'Withheld card',
        selected_text: 'Gamma withheld replacement should not apply.',
        source_excerpt: 'Gamma original withheld.',
      }),
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
      skipped_decision_ids: [
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
      ],
    }));
    expect(artifactUpsertSpy).toHaveBeenCalled();
  });

  it('blocks Final Review until every ready copy-paste opportunity has a saved decision', async () => {
    mockGetWorkbenchQueue.mockResolvedValue({
      ok: true,
      opportunities: [{ id: 'copy-1' }, { id: 'copy-2' }],
      needsTargeting: [],
      withheldUnsupported: [],
    } as never);
    const { client, insertSpy, rpc } = buildSupabaseMock([decision()]);
    mockCreateAdminClient.mockReturnValue(client as never);

    const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });

    expect(result).toEqual({
      ok: false,
      error: 'Final Review unlocks after every ready revision card has a saved decision.',
    });
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'blocked', mode: 'apply' }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('claims and creates a derived version through the atomic Apply RPC', async () => {
    const { client, rpc, insertSpy } = buildSupabaseMock([
      decision(),
      decision({
        id: '00000000-0000-0000-0000-000000000002',
        opportunity_id: 'strategy-1',
        opportunity_title: 'Strategy card',
      }),
    ]);
    mockCreateAdminClient.mockReturnValue(client as never);

    const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });

    expect(result).toEqual({
      ok: true,
      revisedVersionId: 'version-2',
      appliedCount: 1,
      reusedExistingVersion: false,
    });
    expect(rpc).toHaveBeenCalledWith('apply_final_review_once', expect.objectContaining({
      p_user_id: 'user-1',
      p_manuscript_id: 6074,
      p_evaluation_job_id: 'job-1',
      p_source_version_id: 'version-1',
      p_apply_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_raw_text: 'Alpha repaired safe. Beta original strategy. Gamma original withheld. Delta unchanged.',
      p_word_count: 10,
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
    const firstFingerprint = rpc.mock.calls[0][1].p_apply_fingerprint;
    const secondFingerprint = rpc.mock.calls[1][1].p_apply_fingerprint;
    expect(secondFingerprint).toBe(firstFingerprint);
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
});
