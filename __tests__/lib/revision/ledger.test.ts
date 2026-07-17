import {
  __testing,
  syncRevisionLedgerDecisions,
  listRevisionLedgerDecisions,
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

function buildSupabaseMock(options?: { otherOwnerId?: string; readBackOverride?: unknown[] }) {
  const persistedRows: Record<string, unknown>[] = [];
  const manuscriptsOwnerId = options?.otherOwnerId ?? 'user-1';

  const singleQuery = (data: unknown) => {
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      maybeSingle: jest.fn(async () => ({ data, error: null })),
    };
    return query;
  };

  function buildLedgerQuery() {
    const eqFilters: Array<{ column: string; value: unknown }> = [];
    const inFilters: Array<{ column: string; values: unknown[] }> = [];

    const query = {
      select: jest.fn(() => query),
      eq: jest.fn((column: string, value: unknown) => {
        eqFilters.push({ column, value });
        return query;
      }),
      in: jest.fn((column: string, values: unknown[]) => {
        inFilters.push({ column, values });
        return query;
      }),
      order: jest.fn(async (column: string, options?: { ascending?: boolean }) => {
        let rows = [...persistedRows];

        for (const filter of eqFilters) {
          rows = rows.filter((row) => row[filter.column] === filter.value);
        }

        for (const filter of inFilters) {
          rows = rows.filter((row) => filter.values.includes(row[filter.column]));
        }

        const ascending = options?.ascending ?? true;
        rows.sort((left, right) => {
          const leftValue = String(left[column] ?? '');
          const rightValue = String(right[column] ?? '');
          return ascending ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue);
        });

        return { data: [...rows], error: null };
      }),
    };

    return query;
  }

  const upsertSpy = jest.fn(async (rows: unknown[]) => {
    for (const row of rows as Record<string, unknown>[]) {
      const existingIndex = persistedRows.findIndex(
        (candidate) =>
          candidate.user_id === row.user_id &&
          candidate.evaluation_job_id === row.evaluation_job_id &&
          candidate.local_id === row.local_id,
      );

      if (existingIndex >= 0) {
        const existing = persistedRows[existingIndex];
        persistedRows[existingIndex] = {
          ...existing,
          ...row,
          id: existing.id,
          created_at: existing.created_at,
          updated_at: row.updated_at ?? new Date().toISOString(),
        };
      } else {
        persistedRows.push({
          id: `row-${persistedRows.length + 1}`,
          created_at: row.client_created_at ?? new Date().toISOString(),
          updated_at: row.updated_at ?? new Date().toISOString(),
          ...row,
        });
      }
    }
    return { error: null };
  });

  return {
    upsertSpy,
    client: {
      from: jest.fn((table: string) => {
        if (table === 'manuscripts') {
          return singleQuery({ id: 6074, title: 'Sister', user_id: manuscriptsOwnerId });
        }

        if (table === 'evaluation_jobs') {
          return singleQuery({ id: 'job-1', manuscript_id: 6074, status: 'complete' });
        }

        if (table === 'revision_ledger_decisions') {
          return {
            upsert: upsertSpy,
            select: () => buildLedgerQuery(),
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

function makeNeedsTargetingOpportunity(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'opp-1',
    cardType: 'withheld',
    trustedPathStatus: 'impossible',
    options: [
      { key: 'A', candidateText: 'A', text: 'A', rationale: 'A' },
      { key: 'B', candidateText: 'B', text: 'B', rationale: 'B' },
      { key: 'C', candidateText: 'C', text: 'C', rationale: 'C' },
    ],
    ...overrides,
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
    expect(mockGetWorkbenchQueue).toHaveBeenCalledWith({ user: { id: 'user-1' }, manuscriptId: '6074', evaluationJobId: 'job-1' });
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
    expect(rows[0].opportunity_id).toBe('opp-1');
    expect(rows[0].local_id).toBe('local-accepted-a');
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

  it('rejects non-acceptance decisions when the opportunity is not in the canonical queue', async () => {
    const { client } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([]) as never);

    await expect(
      syncRevisionLedgerDecisions({
        manuscriptId: '6074',
        evaluationJobId: 'job-1',
        entries: [
          {
            localId: 'local-deferred-x',
            opportunityId: 'opp-ghost',
            opportunityTitle: 'Ghost opportunity',
            decision: 'deferred',
            clientCreatedAt: '2026-06-06T00:00:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow('Ledger decision blocked: opportunity not found in canonical queue projection');
  });

  it('persists deferred decisions for needs-targeting / withheld cards and reads them back', async () => {
    const { client, upsertSpy } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([makeNeedsTargetingOpportunity()]) as never);

    const rows = await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-deferred-1',
          opportunityId: 'opp-1',
          opportunityTitle: 'Withheld opportunity',
          decision: 'deferred',
          selectedText: 'Deferred for later decision',
          sourceExcerpt: 'The whole place sat in a strange stasis.',
          sourceLocation: 'passage:1',
          clientCreatedAt: '2026-06-06T00:00:00.000Z',
          metadata: { criterion: 'TONE' },
        },
      ],
    });

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].decision).toBe('deferred');
    expect(rows[0].opportunity_id).toBe('opp-1');
    expect(rows[0].selected_text).toBe('Deferred for later decision');
  });

  it('throws when the canonical read-back does not find the expected row', async () => {
    const { client, upsertSpy } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([makeNeedsTargetingOpportunity()]) as never);

    // Force the read-back to return an empty result, simulating a write that
    // did not durably persist.
    upsertSpy.mockImplementation(async () => ({ error: null }));

    await expect(
      syncRevisionLedgerDecisions({
        manuscriptId: '6074',
        evaluationJobId: 'job-1',
        entries: [
          {
            localId: 'local-deferred-1',
            opportunityId: 'opp-1',
            opportunityTitle: 'Withheld opportunity',
            decision: 'deferred',
            clientCreatedAt: '2026-06-06T00:00:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow('Ledger sync failed: canonical row not found after write');
  });

  it('rejects sync when the caller does not own the manuscript and is not privileged', async () => {
    const OWNER_ID = 'owner-1';
    const { client } = buildSupabaseMock({ otherOwnerId: OWNER_ID });
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'other-user-1' } as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([makeNeedsTargetingOpportunity()]) as never);

    await expect(
      syncRevisionLedgerDecisions({
        manuscriptId: '6074',
        evaluationJobId: 'job-1',
        entries: [
          {
            localId: 'local-deferred-1',
            opportunityId: 'opp-1',
            opportunityTitle: 'Withheld opportunity',
            decision: 'deferred',
            clientCreatedAt: '2026-06-06T00:00:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow('Manuscript not found in your workspace');
  });

  it('writes the ledger row under the manuscript owner when the caller is the owner', async () => {
    const OWNER_ID = 'owner-1';
    const { client, upsertSpy } = buildSupabaseMock({ otherOwnerId: OWNER_ID });
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetAuthenticatedUser.mockResolvedValue({ id: OWNER_ID } as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([makeNeedsTargetingOpportunity()]) as never);

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-deferred-1',
          opportunityId: 'opp-1',
          opportunityTitle: 'Withheld opportunity',
          decision: 'deferred',
          clientCreatedAt: '2026-06-06T00:00:00.000Z',
        },
      ],
    });

    const [persistedRows] = upsertSpy.mock.calls[0];
    expect((persistedRows as any[])[0].user_id).toBe(OWNER_ID);
  });

  it('returns deferred/kept/rejected decisions from listRevisionLedgerDecisions', async () => {
    const { client } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([makeNeedsTargetingOpportunity()]) as never);

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-deferred-1',
          opportunityId: 'opp-1',
          opportunityTitle: 'Withheld opportunity',
          decision: 'deferred',
          clientCreatedAt: '2026-06-06T00:00:00.000Z',
        },
      ],
    });

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-kept-1',
          opportunityId: 'opp-1',
          opportunityTitle: 'Withheld opportunity',
          decision: 'keep_original',
          clientCreatedAt: '2026-06-06T00:00:01.000Z',
          metadata: { expectedCurrentLocalId: 'local-deferred-1' },
        },
      ],
    });

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-reject-1',
          opportunityId: 'opp-1',
          opportunityTitle: 'Withheld opportunity',
          decision: 'reject',
          clientCreatedAt: '2026-06-06T00:00:02.000Z',
          metadata: { expectedCurrentLocalId: 'local-kept-1' },
        },
      ],
    });

    const decisions = await listRevisionLedgerDecisions({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    expect(decisions.map((d) => d.decision)).toEqual(['deferred', 'keep_original', 'reject']);
  });

  it('is idempotent: repeat sync with the same localId updates rather than duplicates', async () => {
    const { client } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([makeNeedsTargetingOpportunity()]) as never);

    const base = {
      localId: 'local-deferred-1',
      opportunityId: 'opp-1',
      opportunityTitle: 'Withheld opportunity',
      decision: 'deferred' as const,
      clientCreatedAt: '2026-06-06T00:00:00.000Z',
    };

    const first = await syncRevisionLedgerDecisions({ manuscriptId: '6074', evaluationJobId: 'job-1', entries: [base] });
    expect(first).toHaveLength(1);

    // Simulate the second call by reusing the same mock client and payload.
    const second = await syncRevisionLedgerDecisions({ manuscriptId: '6074', evaluationJobId: 'job-1', entries: [{ ...base, decision: 'keep_original' }] });
    expect(second).toHaveLength(1);
    expect(second[0].decision).toBe('keep_original');

    const list = await listRevisionLedgerDecisions({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    expect(list).toHaveLength(1);
    expect(list[0].decision).toBe('keep_original');
  });

  it('supersedes prior decisions deterministically and reloads one current authoritative decision per opportunity', async () => {
    const { client } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(
      makeCanonicalQueuePayload([
        {
          id: 'copy-1',
          cardType: 'copy_paste_rewrite',
          trustedPathStatus: 'eligible',
          options: [
            { key: 'A', candidateText: 'Candidate A', text: 'Candidate A', rationale: 'A' },
            { key: 'B', candidateText: 'Candidate B', text: 'Candidate B', rationale: 'B' },
            { key: 'C', candidateText: 'Candidate C', text: 'Candidate C', rationale: 'C' },
          ],
        },
        {
          id: 'strategy-1',
          cardType: 'withheld',
          trustedPathStatus: 'impossible',
          options: [
            { key: 'A', candidateText: 'Strategy A', text: 'Strategy A', rationale: 'A' },
            { key: 'B', candidateText: 'Strategy B', text: 'Strategy B', rationale: 'B' },
            { key: 'C', candidateText: 'Strategy C', text: 'Strategy C', rationale: 'C' },
          ],
        },
      ]) as never,
    );

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-copy-a',
          opportunityId: 'copy-1',
          opportunityTitle: 'Copy card',
          decision: 'accepted_a',
          selectedOption: 'A',
          selectedText: 'Candidate A',
          clientCreatedAt: '2026-06-06T00:00:00.000Z',
          metadata: { expectedCurrentLocalId: null },
        },
      ],
    });

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-copy-b',
          opportunityId: 'copy-1',
          opportunityTitle: 'Copy card',
          decision: 'accepted_b',
          selectedOption: 'B',
          selectedText: 'Candidate B',
          clientCreatedAt: '2026-06-06T00:00:01.000Z',
          metadata: { expectedCurrentLocalId: 'local-copy-a' },
        },
      ],
    });

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-copy-c',
          opportunityId: 'copy-1',
          opportunityTitle: 'Copy card',
          decision: 'accepted_c',
          selectedOption: 'C',
          selectedText: 'Candidate C',
          clientCreatedAt: '2026-06-06T00:00:02.000Z',
          metadata: { expectedCurrentLocalId: 'local-copy-b' },
        },
      ],
    });

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-copy-custom',
          opportunityId: 'copy-1',
          opportunityTitle: 'Copy card',
          decision: 'custom',
          selectedText: 'Custom rewrite from author.',
          customText: 'Custom rewrite from author.',
          clientCreatedAt: '2026-06-06T00:00:03.000Z',
          metadata: { expectedCurrentLocalId: 'local-copy-c' },
        },
      ],
    });

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-strategy-keep',
          opportunityId: 'strategy-1',
          opportunityTitle: 'Strategy card',
          decision: 'keep_original',
          clientCreatedAt: '2026-06-06T00:00:04.000Z',
          metadata: { expectedCurrentLocalId: null },
        },
      ],
    });

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-strategy-reject',
          opportunityId: 'strategy-1',
          opportunityTitle: 'Strategy card',
          decision: 'reject',
          clientCreatedAt: '2026-06-06T00:00:05.000Z',
          metadata: { expectedCurrentLocalId: 'local-strategy-keep' },
        },
      ],
    });

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-strategy-deferred',
          opportunityId: 'strategy-1',
          opportunityTitle: 'Strategy card',
          decision: 'deferred',
          selectedText: 'Deferred for later decision',
          clientCreatedAt: '2026-06-06T00:00:06.000Z',
          metadata: { expectedCurrentLocalId: 'local-strategy-reject' },
        },
      ],
    });

    const rows = await listRevisionLedgerDecisions({ manuscriptId: '6074', evaluationJobId: 'job-1' });

    const latestByOpportunity = new Map<string, (typeof rows)[number]>();
    for (const row of [...rows].sort((left, right) => right.created_at.localeCompare(left.created_at))) {
      if (!latestByOpportunity.has(row.opportunity_id)) {
        latestByOpportunity.set(row.opportunity_id, row);
      }
    }

    expect(latestByOpportunity.get('copy-1')?.decision).toBe('custom');
    expect(latestByOpportunity.get('strategy-1')?.decision).toBe('deferred');
    expect(latestByOpportunity.get('copy-1')?.local_id).toBe('local-copy-custom');
    expect(latestByOpportunity.get('strategy-1')?.local_id).toBe('local-strategy-deferred');
  });

  it('rejects stale writes when the expected current localId is outdated (tab concurrency)', async () => {
    const { client } = buildSupabaseMock();
    mockCreateAdminClient.mockReturnValue(client as never);
    mockGetWorkbenchQueue.mockResolvedValue(makeCanonicalQueuePayload([makeNeedsTargetingOpportunity()]) as never);

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-v3',
          opportunityId: 'opp-1',
          opportunityTitle: 'Withheld opportunity',
          decision: 'deferred',
          clientCreatedAt: '2026-06-06T00:00:00.000Z',
          metadata: { expectedCurrentLocalId: null },
        },
      ],
    });

    await syncRevisionLedgerDecisions({
      manuscriptId: '6074',
      evaluationJobId: 'job-1',
      entries: [
        {
          localId: 'local-v4',
          opportunityId: 'opp-1',
          opportunityTitle: 'Withheld opportunity',
          decision: 'keep_original',
          clientCreatedAt: '2026-06-06T00:00:01.000Z',
          metadata: { expectedCurrentLocalId: 'local-v3' },
        },
      ],
    });

    await expect(
      syncRevisionLedgerDecisions({
        manuscriptId: '6074',
        evaluationJobId: 'job-1',
        entries: [
          {
            localId: 'local-v3-stale-submit',
            opportunityId: 'opp-1',
            opportunityTitle: 'Withheld opportunity',
            decision: 'reject',
            clientCreatedAt: '2026-06-06T00:00:02.000Z',
            metadata: { expectedCurrentLocalId: 'local-v3' },
          },
        ],
      }),
    ).rejects.toThrow('Ledger stale write blocked');

    const rows = await listRevisionLedgerDecisions({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    const latest = [...rows].sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
    expect(latest.local_id).toBe('local-v4');
    expect(latest.decision).toBe('keep_original');
  });
});
