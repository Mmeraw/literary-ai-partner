import {
  __testing,
  syncRevisionLedgerDecisions,
} from '@/lib/revision/ledger';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: jest.fn(),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;

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

  it('persists passive drift metrics for accepted decisions without changing sync control flow', async () => {
    const { client, upsertSpy } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);

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
          selectedText: 'Elias holds the chapel door because she does not answer.',
          clientCreatedAt: '2026-06-06T00:00:00.000Z',
          metadata: { source: 'unit-test', cardType: 'copy_paste_rewrite', trustedPathStatus: 'eligible' },
        },
      ],
    });

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
});
