import {
  __testing,
  syncRevisionLedgerDecisions,
} from '@/lib/revision/ledger';
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue';
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

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetWorkbenchQueue = getWorkbenchQueue as jest.MockedFunction<typeof getWorkbenchQueue>;

function buildSupabaseMock() {
  const singleQuery = (data: unknown) => {
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      maybeSingle: jest.fn(async () => ({ data, error: null })),
    };
    return query;
  };

  const upsertSpy = jest.fn((rows: unknown[]) => ({
    select: () => ({
      order: async () => ({
        data: rows.map((row, index) => ({
          id: `row-${index + 1}`,
          ...(row as Record<string, unknown>),
        })),
        error: null,
      }),
    }),
  }));

  return {
    upsertSpy,
    client: {
      from: jest.fn((table: string) => {
        if (table === 'manuscripts') {
          return singleQuery({ id: 6074, title: 'Sister', user_id: 'user-1' });
        }

        if (table === 'evaluation_jobs') {
          return singleQuery({ id: 'job-1', manuscript_id: 6074, status: 'complete' });
        }

        if (table === 'revision_ledger_decisions') {
          return {
            upsert: upsertSpy,
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    },
  };
}

function makeCanonicalQueuePayload(opportunities: any[]) {
  return {
    ok: true,
    error: null,
    manuscriptId: '6074',
    evaluationJobId: 'job-1',
    manuscriptTitle: 'Sister',
    modeContract: null,
    opportunities,
    needsTargeting: [],
    withheldUnsupported: [],
    readinessTotals: { ready_for_revise: opportunities.length, needs_targeting: 0, withheld_unsupported: 0 },
    totals: {},
    scopes: {},
    criteria: {},
    synthesis: { admitted: opportunities.length, clustered: 0, held: 0, suppressed: 0 },
    goLiveProof: {
      phase0Warmup: {
        status: 'unavailable' as const,
        warning: null,
        loadedAt: null,
        corpusSha256: null,
        fileCount: 0,
        benchmarkCount: 0,
        benchmarkFiles: [],
      },
      contractEnforcement: {
        candidateTextOnly: true as const,
        sixPartDiagnosticRequired: true as const,
        readyForRevise: opportunities.length,
        needsTargeting: 0,
        readyRate: opportunities.length === 0 ? 0 : 1,
      },
    },
  };
}

function makeCopyPasteOpportunity(candidateText: string) {
  return {
    id: 'opp-1',
    cardType: 'copy_paste_rewrite',
    trustedPathStatus: 'eligible',
    options: [
      { key: 'A', candidateText, text: candidateText, rationale: 'Primary repair path' },
    ],
  };
}

describe('revision ledger quality drift metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1' } as never);
  });

  it('measures POV, tense, vocabulary, length, and added-name drift passively', () => {
    const metrics = __testing.calculateRevisionQualityDriftMetrics({
      sourceExcerpt: 'I held the chapel door because Mara had not answered.',
      selectedText: 'Elias holds the chapel door because she does not answer.',
    });

    expect(metrics.measurement_version).toBe('revision_quality_drift_v1');
    expect(metrics.pov_source).toBe('first_person');
    expect(metrics.pov_selected).toBe('third_person');
    expect(metrics.pov_shift).toBe(true);
    expect(metrics.tense_source).toBe('past');
    expect(metrics.tense_selected).toBe('present');
    expect(metrics.tense_shift).toBe(true);
    expect(metrics.added_proper_nouns).toContain('Elias');
    expect(metrics.flags).toEqual(expect.arrayContaining(['pov_shift', 'tense_shift', 'added_proper_nouns']));
    expect(typeof metrics.vocabulary_retention).toBe('number');
  });

  it('persists passive drift metrics for accepted decisions when canonical queue confirms eligibility', async () => {
    const { client, upsertSpy } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    const candidateText = 'Elias holds the chapel door because she does not answer.';
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([makeCopyPasteOpportunity(candidateText)]) as never);

    const rows = await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-accepted-a',
          opportunityId: 'opp-1',
          opportunityTitle: 'Preserve close POV',
          decision: 'accepted_a',
          selectedOption: 'A',
          sourceExcerpt: 'I held the chapel door because Mara had not answered.',
          selectedText: candidateText,
          clientCreatedAt: '2026-06-06T00:00:00.000Z',
          metadata: { source: 'unit-test' },
        },
      ],
    });

    expect(mockGetWorkbenchQueue).toHaveBeenCalledTimes(1);
    expect(mockGetWorkbenchQueue).toHaveBeenCalledWith({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const [persistedRows] = upsertSpy.mock.calls[0];
    const [persisted] = persistedRows as Array<{ metadata: Record<string, unknown> }>;
    expect(persisted.metadata.source).toBe('unit-test');
    expect(persisted.metadata.revision_quality).toMatchObject({
      measurement_version: 'revision_quality_drift_v1',
      pov_source: 'first_person',
      pov_selected: 'third_person',
      pov_shift: true,
      tense_shift: true,
    });
    expect(rows).toHaveLength(1);
  });

  it('rejects acceptance when the canonical queue classifies the card as a strategy card', async () => {
    const { client } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    const candidateText = 'Elias holds the chapel door because she does not answer.';
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([
      {
        ...makeCopyPasteOpportunity(candidateText),
        cardType: 'revision_strategy',
        trustedPathStatus: 'unavailable_author_review_required',
      },
    ]) as never);

    await expect(
      syncRevisionLedgerDecisions({
        manuscriptId: '6074',
        evaluationJobId: 'job-1',
        entries: [
          {
            localId: 'local-accepted-a',
            opportunityId: 'opp-1',
            opportunityTitle: 'Preserve close POV',
            decision: 'accepted_a',
            selectedOption: 'A',
            sourceExcerpt: 'I held the chapel door because Mara had not answered.',
            selectedText: candidateText,
            clientCreatedAt: '2026-06-06T00:00:00.000Z',
            metadata: { source: 'unit-test', cardType: 'copy_paste_rewrite', trustedPathStatus: 'eligible' },
          },
        ],
      }),
    ).rejects.toThrow('Ledger acceptance blocked: only TrustedPath-eligible copy-paste rewrite cards may be accepted');
  });

  it('rejects acceptance when the selected text does not match the canonical candidate text', async () => {
    const { client } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([makeCopyPasteOpportunity('Canonical candidate text')]) as never);

    await expect(
      syncRevisionLedgerDecisions({
        manuscriptId: '6074',
        evaluationJobId: 'job-1',
        entries: [
          {
            localId: 'local-accepted-a',
            opportunityId: 'opp-1',
            opportunityTitle: 'Preserve close POV',
            decision: 'accepted_a',
            selectedOption: 'A',
            sourceExcerpt: 'I held the chapel door because Mara had not answered.',
            selectedText: 'Forged candidate text that does not match the ledger.',
            clientCreatedAt: '2026-06-06T00:00:00.000Z',
            metadata: { source: 'unit-test', cardType: 'copy_paste_rewrite', trustedPathStatus: 'eligible' },
          },
        ],
      }),
    ).rejects.toThrow('Ledger acceptance blocked: selected text does not match canonical candidate text');
  });

  it('rejects acceptance when the canonical queue does not contain the opportunity', async () => {
    const { client } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([]) as never);

    await expect(
      syncRevisionLedgerDecisions({
        manuscriptId: '6074',
        evaluationJobId: 'job-1',
        entries: [
          {
            localId: 'local-accepted-a',
            opportunityId: 'opp-1',
            opportunityTitle: 'Preserve close POV',
            decision: 'accepted_a',
            selectedOption: 'A',
            sourceExcerpt: 'I held the chapel door because Mara had not answered.',
            selectedText: 'Elias holds the chapel door because she does not answer.',
            clientCreatedAt: '2026-06-06T00:00:00.000Z',
            metadata: { source: 'unit-test', cardType: 'copy_paste_rewrite', trustedPathStatus: 'eligible' },
          },
        ],
      }),
    ).rejects.toThrow('Ledger acceptance blocked: opportunity not found in canonical queue projection');
  });
});
