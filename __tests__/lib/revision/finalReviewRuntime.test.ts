import { applyFinalReviewDecisions, buildFinalReviewExport } from '@/lib/revision/finalReviewRuntime';
import { createDerivedVersion } from '@/lib/manuscripts/versions';
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

jest.mock('@/lib/manuscripts/versions', () => ({
  createDerivedVersion: jest.fn(),
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
const mockCreateDerivedVersion = createDerivedVersion as jest.MockedFunction<typeof createDerivedVersion>;
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

function decision(overrides: Partial<Record<string, unknown>>) {
  return {
    id: 'decision-1',
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
  options?: { manuscriptOwnerId?: string },
) {
  const insertSpy = jest.fn(async () => ({ data: null, error: null }));
  const artifactUpsertSpy = jest.fn(() => makeQuery({ single: { id: 'completion-artifact-1' } }));
  const manuscriptOwnerId = options?.manuscriptOwnerId ?? 'user-1';

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
    client: {
      from: jest.fn((table: string) => {
        const query = tables[table];
        if (!query) throw new Error(`Unexpected table: ${table}`);
        return query;
      }),
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
    mockCreateDerivedVersion.mockResolvedValue({ id: 'version-2' } as never);
    mockQueue();
  });

  afterEach(() => {
    process.env.EVALUATION_OPERATOR_EMAILS = ORIGINAL_OPERATOR_EMAILS;
    process.env.REVISIONGRADE_ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  });

  it('exports a semi-revised manuscript by applying only queue-visible copy-paste repairs', async () => {
    const { client, insertSpy, artifactUpsertSpy } = buildSupabaseMock([
      decision({ id: 'decision-copy' }),
      decision({
        id: 'decision-strategy',
        opportunity_id: 'strategy-1',
        opportunity_title: 'Strategy card',
        selected_text: 'Beta strategy replacement should not apply.',
        source_excerpt: 'Beta original strategy.',
        metadata: { cardType: 'revision_strategy', trustedPathStatus: 'manual_review' },
      }),
      decision({
        id: 'decision-withheld',
        opportunity_id: 'withheld-1',
        opportunity_title: 'Withheld card',
        selected_text: 'Gamma withheld replacement should not apply.',
        source_excerpt: 'Gamma original withheld.',
        metadata: { cardType: 'withheld', trustedPathStatus: 'blocked' },
      }),
      decision({
        id: 'decision-stale-copy',
        opportunity_id: 'stale-copy-1',
        opportunity_title: 'Stale persisted copy-paste metadata',
        selected_text: 'Delta stale replacement should not apply.',
        source_excerpt: 'Delta unchanged.',
        metadata: { cardType: 'copy_paste_rewrite', trustedPathStatus: 'eligible' },
      }),
    ]);
    mockCreateAdminClient.mockReturnValue(client as never);

    const exported = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'clean' });

    expect(exported.filename).toBe('revisiongrade-sister-semi-revised-draft.txt');
    expect(exported.content).toContain('Alpha repaired safe.');
    expect(exported.content).toContain('Beta original strategy.');
    expect(exported.content).toContain('Gamma original withheld.');
    expect(exported.content).toContain('Delta unchanged.');
    expect(exported.content).not.toContain('Beta strategy replacement should not apply.');
    expect(exported.content).not.toContain('Gamma withheld replacement should not apply.');
    expect(exported.content).not.toContain('Delta stale replacement should not apply.');

    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'exported',
      applied_decision_ids: ['decision-copy'],
      skipped_decision_ids: ['decision-strategy', 'decision-withheld', 'decision-stale-copy'],
      metadata: expect.objectContaining({
        copy_paste_repair_count: 1,
        strategy_card_count: 1,
        withheld_blocked_count: 1,
        revision_completion_artifact_id: 'completion-artifact-1',
        revision_completion_certification: expect.objectContaining({
          artifact_type: 'revision_completion_record_v1',
          status: 'certified',
          decision_count: 1,
          completed_at: expect.any(String),
          trusted_path_status: 'not_requested',
        }),
      }),
    }));
    expect(artifactUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact_type: 'revision_completion_record_v1',
        artifact_version: 'revision_completion_record_v1',
        source_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        content: expect.objectContaining({
          artifact_type: 'revision_completion_record_v1',
          status: 'certified',
          revision_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
          decision_count: 1,
          completed_at: expect.any(String),
          trusted_path_status: 'not_requested',
        }),
      }),
      expect.objectContaining({ onConflict: 'job_id,artifact_type' }),
    );
  });

  it('reports copy-paste, strategy, and withheld counts in the changelog', async () => {
    const { client } = buildSupabaseMock([
      decision({ id: 'decision-copy' }),
      decision({ id: 'decision-strategy', opportunity_id: 'strategy-1', metadata: { cardType: 'revision_strategy' } }),
      decision({ id: 'decision-withheld', opportunity_id: 'withheld-1', metadata: { cardType: 'withheld' } }),
    ]);
    mockCreateAdminClient.mockReturnValue(client as never);

    const exported = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'changelog' });

    expect(exported.content).toContain('1 safe copy-paste repair applied or ready to apply.');
    expect(exported.content).toContain('1 Strategy Card require author decision and were not applied.');
    expect(exported.content).toContain('1 withheld/blocked card stayed invisible to the semi-revised manuscript.');
    expect(exported.content).toContain('TrustedPath applies only safe, local copy-paste repairs.');
  });

  it('blocks Final Review export until every ready-for-revise opportunity has a persisted decision', async () => {
    mockGetWorkbenchQueue.mockResolvedValue({
      ok: true,
      opportunities: [{ id: 'copy-1' }, { id: 'copy-2' }],
      needsTargeting: [],
      withheldUnsupported: [],
    } as never);

    const { client, insertSpy } = buildSupabaseMock([
      decision({ id: 'decision-copy', opportunity_id: 'copy-1' }),
    ]);
    mockCreateAdminClient.mockReturnValue(client as never);

    const exported = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'clean' });

    expect(exported.filename).toBe('revisiongrade-sister-final-review-blocked.txt');
    expect(exported.content).toContain('Final Review unlocks after every ready revision card has a saved decision.');
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'blocked',
      mode: 'export_clean',
      blocked_reason: 'Final Review unlocks after every ready revision card has a saved decision.',
      metadata: expect.objectContaining({
        revision_completion_failure: expect.objectContaining({
          artifact_type: 'failure_diagnosis_v1',
          failed_gate: 'RCG07_COMPLETION_CERTIFICATION',
          diagnostic_code: 'COMPLETION_PREMATURE',
          details: expect.objectContaining({
            unresolved_ready_opportunity_ids: ['copy-2'],
          }),
        }),
      }),
    }));
  });

  it('creates a derived manuscript version from safe copy-paste decisions only', async () => {
    const { client, insertSpy } = buildSupabaseMock([
      decision({ id: 'decision-copy' }),
      decision({
        id: 'decision-strategy',
        opportunity_id: 'strategy-1',
        selected_text: 'Beta strategy replacement should not apply.',
        source_excerpt: 'Beta original strategy.',
        metadata: { cardType: 'revision_strategy' },
      }),
    ]);
    mockCreateAdminClient.mockReturnValue(client as never);

    const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-1' });

    expect(result).toEqual({ ok: true, revisedVersionId: 'version-2', appliedCount: 1 });
    expect(mockCreateDerivedVersion).toHaveBeenCalledWith(expect.objectContaining({
      manuscript_id: 6074,
      source_version_id: 'version-1',
      raw_text: 'Alpha repaired safe. Beta original strategy. Gamma original withheld. Delta unchanged.',
      created_by: 'user-1',
    }));
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'applied',
      applied_decision_ids: ['decision-copy'],
      skipped_decision_ids: ['decision-strategy'],
    }));
  });

  it('allows privileged operator export for non-owned manuscripts using owner ledger rows', async () => {
    process.env.EVALUATION_OPERATOR_EMAILS = 'ops@example.com';
    process.env.REVISIONGRADE_ADMIN_EMAILS = '';
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'operator-1', email: 'ops@example.com' } as never);

    const { client } = buildSupabaseMock([
      decision({ id: 'decision-copy' }),
    ], { manuscriptOwnerId: 'owner-1' });
    mockCreateAdminClient.mockReturnValue(client as never);

    const exported = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-1', format: 'clean' });

    expect(exported.content).toContain('Alpha repaired safe.');

    const revisionLedgerQueryIndex = (client.from as jest.Mock).mock.calls
      .findIndex((call) => call[0] === 'revision_ledger_decisions');
    expect(revisionLedgerQueryIndex).toBeGreaterThanOrEqual(0);

    const revisionLedgerQuery = (client.from as jest.Mock).mock.results[revisionLedgerQueryIndex]?.value;
    expect(revisionLedgerQuery.eq).toHaveBeenCalledWith('user_id', 'owner-1');
  });
});
