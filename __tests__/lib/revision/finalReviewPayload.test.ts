import { getFinalReviewPayload } from '@/lib/revision/finalReview';
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue';
import { resolveFinalReviewSourceText } from '@/lib/revision/finalReviewSourceText';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/revision/workbenchQueue', () => ({
  getWorkbenchQueue: jest.fn(),
}));

jest.mock('@/lib/revision/finalReviewSourceText', () => {
  const actual = jest.requireActual('@/lib/revision/finalReviewSourceText') as Record<string, unknown>;
  return {
    ...actual,
    resolveFinalReviewSourceText: jest.fn(),
  };
});

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetWorkbenchQueue = getWorkbenchQueue as jest.MockedFunction<typeof getWorkbenchQueue>;
const mockResolveFinalReviewSourceText = resolveFinalReviewSourceText as jest.MockedFunction<typeof resolveFinalReviewSourceText>;

const SOURCE_TEXT = 'Alpha original. Beta original. Gamma original.';

function buildSupabaseMock(decisionRows: unknown[] = []) {
  function singleQuery(data: unknown) {
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      maybeSingle: jest.fn(async () => ({ data, error: null })),
    };
    return query;
  }

  function listQuery(data: unknown[]) {
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      order: jest.fn(async () => ({ data, error: null })),
    };
    return query;
  }

  return {
    client: {
      from: jest.fn((table: string) => {
        if (table === 'manuscripts') {
          return singleQuery({ id: 6074, title: 'Sister', user_id: 'user-1' });
        }
        if (table === 'evaluation_jobs') {
          return singleQuery({ id: 'job-1', manuscript_id: 6074, status: 'complete', manuscript_version_id: 'version-1' });
        }
        if (table === 'manuscript_versions') {
          return singleQuery({ id: 'version-1', raw_text: SOURCE_TEXT });
        }
        if (table === 'revision_ledger_decisions') {
          return listQuery(decisionRows);
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
  };
}

function makeQueuePayload(opportunities: any[] = [], needsTargeting: any[] = [], withheldUnsupported: any[] = []) {
  return {
    ok: true,
    error: null,
    manuscriptId: '6074',
    evaluationJobId: 'job-1',
    manuscriptTitle: 'Sister',
    modeContract: null,
    opportunities,
    needsTargeting,
    withheldUnsupported,
    readinessTotals: { ready_for_revise: opportunities.length, needs_targeting: needsTargeting.length, withheld_unsupported: withheldUnsupported.length },
    totals: {},
    scopes: {},
    criteria: {},
    synthesis: { admitted: opportunities.length + needsTargeting.length, clustered: 0, held: withheldUnsupported.length, suppressed: 0 },
    goLiveProof: {
      phase0Warmup: { status: 'unavailable' as const, warning: null, loadedAt: null, corpusSha256: null, fileCount: 0, benchmarkCount: 0, benchmarkFiles: [] },
      contractEnforcement: { candidateTextOnly: true as const, sixPartDiagnosticRequired: true as const, readyForRevise: opportunities.length, needsTargeting: needsTargeting.length, readyRate: 0 },
    },
  };
}

function makeDecisionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'decision-1',
    local_id: 'local-1',
    opportunity_id: 'opp-1',
    opportunity_title: 'Fix pacing',
    decision: 'deferred',
    selected_option: null,
    custom_text: null,
    selected_text: 'Deferred for later decision',
    source_excerpt: 'Alpha original.',
    source_location: 'passage:1',
    metadata: { criterion: 'PACING' },
    created_at: '2026-06-08T00:00:00.000Z',
    is_undo: false,
    undone_local_id: null,
    ...overrides,
  };
}

describe('getFinalReviewPayload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1' } as never);
    mockResolveFinalReviewSourceText.mockResolvedValue(SOURCE_TEXT);
  });

  it('reads deferred decisions from the needsTargeting queue', async () => {
    const { client } = buildSupabaseMock([makeDecisionRow({ decision: 'deferred' })]);
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([], [{ id: 'opp-1' }]) as never);

    const payload = await getFinalReviewPayload({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    expect(payload.ok).toBe(true);
    expect(payload.deferredCount).toBe(1);
    expect(payload.decisions).toHaveLength(1);
    expect(payload.decisions[0].decision).toBe('deferred');
  });

  it('reads deferred decisions from the withheldUnsupported queue', async () => {
    const { client } = buildSupabaseMock([makeDecisionRow({ decision: 'deferred' })]);
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([], [], [{ id: 'opp-1' }]) as never);

    const payload = await getFinalReviewPayload({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    expect(payload.deferredCount).toBe(1);
    expect(payload.decisions[0].decision).toBe('deferred');
  });

  it('reads kept and rejected decisions, not just deferred', async () => {
    const { client } = buildSupabaseMock([
      makeDecisionRow({ local_id: 'local-1', decision: 'keep_original' }),
      makeDecisionRow({ local_id: 'local-2', opportunity_id: 'opp-2', decision: 'reject' }),
    ]);
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([], [{ id: 'opp-1' }, { id: 'opp-2' }]) as never);

    const payload = await getFinalReviewPayload({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    expect(payload.keptCount).toBe(1);
    expect(payload.rejectedCount).toBe(1);
    expect(payload.deferredCount).toBe(0);
  });

  it('excludes decisions that have been undone by a later ledger row', async () => {
    const { client } = buildSupabaseMock([
      makeDecisionRow({ local_id: 'local-1', decision: 'deferred' }),
      makeDecisionRow({ local_id: 'local-2', decision: 'keep_original', is_undo: true, undone_local_id: 'local-1' }),
    ]);
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([], [{ id: 'opp-1' }]) as never);

    const payload = await getFinalReviewPayload({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    expect(payload.deferredCount).toBe(0);
    expect(payload.decisions).toHaveLength(0);
  });

  it('filters out decisions for opportunities that are no longer in the canonical queue', async () => {
    const { client } = buildSupabaseMock([makeDecisionRow({ opportunity_id: 'opp-stale' })]);
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeQueuePayload([], [{ id: 'opp-1' }]) as never);

    const payload = await getFinalReviewPayload({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    expect(payload.decisions).toHaveLength(0);
  });
});
