import { buildRevisionOpportunitiesFromEvaluationPayload, ensureRevisionOpportunityLedgerArtifact, extractCanonicalRevisionOpportunities } from '@/lib/revision/opportunityLedger';
import { buildCanonicalOpportunityLedger } from '@/lib/evaluation/canonicalOpportunityLedger';
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { getAuthorExposureDecision } from '@/lib/evaluation/authorExposureCertification';
import { loadReviseQueueWarmupCorpus } from '@/lib/revision/reviseQueueWarmup';

jest.mock('@/lib/revision/logRevisionEvent', () => ({
  logRevisionEvent: jest.fn(async () => undefined),
}));

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/evaluation/authorExposureCertification', () => ({ getAuthorExposureDecision: jest.fn() }));
jest.mock('@/lib/revision/reviseQueueWarmup', () => ({ loadReviseQueueWarmupCorpus: jest.fn() }));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetAuthorExposureDecision = getAuthorExposureDecision as jest.MockedFunction<typeof getAuthorExposureDecision>;
const mockLoadReviseQueueWarmupCorpus = loadReviseQueueWarmupCorpus as jest.MockedFunction<typeof loadReviseQueueWarmupCorpus>;

const SENTINEL_A = 'AAA_SENTINEL_ALPHA: Mara paused at the threshold until the room understood her choice.';
const SENTINEL_B = 'BBB_SENTINEL_BRAVO: For the moment, Mara held the door open and let the silence settle before she answered.';
const SENTINEL_C = 'CCC_SENTINEL_CHARLIE: The answer stayed in Maras hand before it reached her voice, quiet and deliberate.';

const ANCHOR = 'Mara set the unsigned letter beside the lamp and listened to the river striking the pilings.';

function makeRecommendation(overrides: { candidate_text_a?: string; candidate_text_b?: string; candidate_text_c?: string } = {}) {
  return {
    priority: 'high',
    severity: 'must',
    action: 'Revise the anchored passage through embodied action.',
    expected_impact: 'Improves pacing without changing story facts.',
    anchor_snippet: ANCHOR,
    manuscript_coordinates: 'Chapter 1, paragraph 1.',
    diagnosis: 'The passage reports the decision instead of dramatizing its physical consequence.',
    symptom: 'The decisive beat remains abstract when the character should make a visible physical choice.',
    cause: 'Summary language replaces an observable action at the exact point of tension.',
    fix_direction: 'Replace the anchored sentence with one concrete action that preserves the existing facts and voice.',
    reader_effect: 'The reader can witness the decision and feel its immediate consequence.',
    mistake_proofing: 'Keep every named person, object, and event unchanged while adding only observable action.',
    candidate_text_a: overrides.candidate_text_a ?? SENTINEL_A,
    candidate_text_b: overrides.candidate_text_b ?? SENTINEL_B,
    candidate_text_c: overrides.candidate_text_c ?? SENTINEL_C,
  };
}

function makeEvaluationResult(recommendation: any) {
  return {
    schema_version: 'evaluation_result_v2',
    ids: { evaluation_run_id: 'run-abc', job_id: 'job-abc', manuscript_id: 9001, user_id: 'user-abc' },
    generated_at: '2026-07-17T00:00:00.000Z',
    engine: { model: 'fixture', provider: 'test', prompt_version: 'abc' },
    overview: {
      verdict: 'revise',
      overall_score_0_100: 61,
      scored_criteria_count: 1,
      one_paragraph_summary: 'Test manuscript.',
      top_3_strengths: ['voice'],
      top_3_risks: ['pacing'],
    },
    criteria: [{
      key: 'pacing',
      scorable: true,
      status: 'SCORABLE',
      signal_present: true,
      signal_strength: 'SUFFICIENT',
      confidence_band: 'HIGH',
      score_0_10: 4,
      scorability_status: 'scorable_confident',
      rationale: 'The first passage reports action abstractly.',
      evidence: [{ snippet: ANCHOR }],
      recommendations: [recommendation],
    }],
    recommendations: { quick_wins: [], strategic_revisions: [] },
    metrics: { manuscript: { word_count: 5000, title: 'ABC Test' }, processing: {} },
    artifacts: [],
    governance: { confidence: 0.9, warnings: [], limitations: [], policy_family: 'multi-pass-dual-axis', observability_warnings: [] },
  };
}

function createStatefulSupabaseClient(initialState: any) {
  const state: any = { ...initialState };

  function applyFilters(rows: any[], filters: { eq: Record<string, unknown>; in: Record<string, unknown[]> }) {
    let result = rows;
    for (const [column, value] of Object.entries(filters.eq)) {
      if (value === undefined) continue;
      result = result.filter((row) => row[column] === value);
    }
    for (const [column, values] of Object.entries(filters.in)) {
      if (!Array.isArray(values)) continue;
      result = result.filter((row) => values.includes(row[column]));
    }
    return result;
  }

  function upsertRows(table: string, rows: any[]) {
    const target = state[table] ?? [];
    const normalized = Array.isArray(rows) ? rows : [rows];
    for (const row of normalized) {
      let existingIndex = -1;
      if (row.id != null) {
        existingIndex = target.findIndex((existing: any) => existing.id === row.id);
      } else if (row.job_id != null && row.artifact_type != null) {
        existingIndex = target.findIndex(
          (existing: any) => existing.job_id === row.job_id && existing.artifact_type === row.artifact_type,
        );
      }
      if (existingIndex >= 0) {
        target[existingIndex] = { ...target[existingIndex], ...row };
      } else {
        target.push({
          ...row,
          id: row.id ?? `${table}-${state.idCounter ?? 1}`,
          created_at: row.created_at ?? new Date().toISOString(),
        });
        state.idCounter = (state.idCounter ?? 1) + 1;
      }
    }
    state[table] = target;
  }

  function query(table: string) {
    const filters: { eq: Record<string, unknown>; in: Record<string, unknown[]> } = { eq: {}, in: {} };
    let orderBy: string | null = null;
    let orderAscending = true;
    let limitValue: number | null = null;
    let _selectColumns: string | null = null;

    const resolveList = () => {
      let rows = state[table] ?? [];
      rows = applyFilters(rows, filters);
      if (orderBy) {
        rows = [...rows].sort((a: any, b: any) => {
          const av = a[orderBy] ?? '';
          const bv = b[orderBy] ?? '';
          if (typeof av === 'string' && typeof bv === 'string') {
            return orderAscending ? av.localeCompare(bv) : bv.localeCompare(av);
          }
          if (av < bv) return orderAscending ? -1 : 1;
          if (av > bv) return orderAscending ? 1 : -1;
          return 0;
        });
      }
      if (limitValue) {
        rows = rows.slice(0, limitValue);
      }
      return { data: rows, error: null };
    };

    const resolveSingle = () => {
      const { data } = resolveList();
      return { data: data[0] ?? null, error: null };
    };

    const builder: any = {
      select: (columns: string) => { _selectColumns = columns; return builder; },
      eq: (column: string, value: unknown) => { filters.eq[column] = value; return builder; },
      in: (column: string, values: unknown[]) => { filters.in[column] = values; return builder; },
      order: (column: string, { ascending = true } = {}) => { orderBy = column; orderAscending = ascending; return builder; },
      limit: (n: number) => { limitValue = n; return builder; },
      maybeSingle: () => Promise.resolve(resolveSingle()),
      single: () => Promise.resolve(resolveSingle()),
      upsert: (rows: any[], _options: any) => { upsertRows(table, rows); return builder; },
      insert: (rows: any[]) => { upsertRows(table, rows); return Promise.resolve({ data: null, error: null }); },
      then: (onFulfilled: (value: any) => any) => Promise.resolve(onFulfilled(resolveList())),
    };
    return builder;
  }

  const rpc = jest.fn(async (_name: string, _args: any) => ({ data: null, error: null }));

  return { client: { from: query, rpc }, state };
}

function makeUedWithCandidates(recommendation?: any) {
  const evaluationResult = makeEvaluationResult(recommendation ?? makeRecommendation());
  const canonicalLedger = buildCanonicalOpportunityLedger(evaluationResult);
  const unifiedDocument = {
    schema_version: 'unified_evaluation_document_v1',
    displayTitle: 'ABC Test',
    result: evaluationResult,
    canonicalOpportunityLedger: canonicalLedger,
  };
  const hash = canonicalJsonSha256(unifiedDocument);
  return { unifiedDocument, hash };
}

function buildSupabaseForLedger(evaluationResult: any, unifiedDocument?: any, hash?: string) {
  const artifacts: any[] = [
    {
      job_id: 'job-abc',
      artifact_type: 'evaluation_result_v2',
      content: evaluationResult,
      created_at: '2026-07-17T00:00:00.000Z',
    },
  ];
  if (unifiedDocument) {
    artifacts.push({
      job_id: 'job-abc',
      artifact_type: 'unified_evaluation_document_v1',
      content: unifiedDocument,
      created_at: '2026-07-17T00:00:01.000Z',
    });
    artifacts.push({
      job_id: 'job-abc',
      artifact_type: 'author_exposure_certification_v1',
      content: {
        schema_version: 'author_exposure_certification_v1',
        decision: 'certified',
        unified_document_hash: hash,
        certified_at: '2026-07-17T00:00:02.000Z',
      },
      created_at: '2026-07-17T00:00:02.000Z',
    });
  }
  return createStatefulSupabaseClient({
    manuscripts: [{ id: 9001, title: 'ABC Test', user_id: 'user-abc' }],
    evaluation_jobs: [{
      id: 'job-abc',
      status: 'complete',
      manuscript_id: 9001,
      manuscript_version_id: 'mv-source',
      policy_family: 'multi-pass-dual-axis',
      voice_preservation_level: 'balanced',
      english_variant: 'american',
    }],
    manuscript_versions: [{ id: 'mv-source', raw_text: `${ANCHOR}\n\nA second paragraph with no revision needed.` }],
    evaluation_artifacts: artifacts,
  });
}

describe('Candidate A/B/C authority boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-abc', email: 'author@example.com' } as never);
    mockGetAuthorExposureDecision.mockResolvedValue({ exposable: true, certifiedAt: null });
    mockLoadReviseQueueWarmupCorpus.mockResolvedValue({
      loadedAt: new Date().toISOString(),
      files: {},
      combinedText: 'warmup',
      proof: {
        combinedSha256: 'abc123',
        combinedBytes: 42,
        fileCount: 10,
        benchmarkCount: 3,
        benchmarkFilesLoaded: [],
      },
    });
  });

  it('1. buildRevisionOpportunitiesFromEvaluationPayload preserves A/B/C sentinels', () => {
    const evaluation = makeEvaluationResult(makeRecommendation());
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(evaluation);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].candidate_text_a).toBe(SENTINEL_A);
    expect(opportunities[0].candidate_text_b).toBe(SENTINEL_B);
    expect(opportunities[0].candidate_text_c).toBe(SENTINEL_C);
  });

  it('2. buildCanonicalOpportunityLedger preserves A/B/C sentinels', () => {
    const evaluation = makeEvaluationResult(makeRecommendation());
    const ledger = buildCanonicalOpportunityLedger(evaluation);
    expect(ledger.opportunities).toHaveLength(1);
    expect(ledger.opportunities[0].candidate_text_a).toBe(SENTINEL_A);
    expect(ledger.opportunities[0].candidate_text_b).toBe(SENTINEL_B);
    expect(ledger.opportunities[0].candidate_text_c).toBe(SENTINEL_C);
  });

  it('3. extractCanonicalRevisionOpportunities preserves A/B/C sentinels from a UED', () => {
    const evaluation = makeEvaluationResult(makeRecommendation());
    const ledger = buildCanonicalOpportunityLedger(evaluation);
    const unifiedDocument = { canonicalOpportunityLedger: ledger };
    const extraction = extractCanonicalRevisionOpportunities(unifiedDocument);
    expect(extraction.items).toHaveLength(1);
    expect(extraction.items[0].candidate_text_a).toBe(SENTINEL_A);
    expect(extraction.items[0].candidate_text_b).toBe(SENTINEL_B);
    expect(extraction.items[0].candidate_text_c).toBe(SENTINEL_C);
  });

  it('4. ensureRevisionOpportunityLedgerArtifact persists A/B/C sentinels', async () => {
    const { unifiedDocument, hash } = makeUedWithCandidates();
    const { client: supabase, state } = buildSupabaseForLedger(unifiedDocument.result, unifiedDocument, hash);
    mockCreateAdminClient.mockReturnValue(supabase as any);

    const result = await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-abc');
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].candidate_text_a).toBe(SENTINEL_A);
    expect(result.opportunities[0].candidate_text_b).toBe(SENTINEL_B);
    expect(result.opportunities[0].candidate_text_c).toBe(SENTINEL_C);

    const persisted = state.evaluation_artifacts.find(
      (a: any) => a.artifact_type === 'revision_opportunity_ledger_v1',
    );
    expect(persisted).toBeDefined();
    expect(persisted.content.opportunities[0].candidate_text_a).toBe(SENTINEL_A);
    expect(persisted.content.opportunities[0].candidate_text_b).toBe(SENTINEL_B);
    expect(persisted.content.opportunities[0].candidate_text_c).toBe(SENTINEL_C);
  });

  it('5. persisted ledger is authoritative after original UED is destroyed', async () => {
    const { unifiedDocument, hash } = makeUedWithCandidates();
    const { client: supabase, state } = buildSupabaseForLedger(unifiedDocument.result, unifiedDocument, hash);
    mockCreateAdminClient.mockReturnValue(supabase as any);

    const first = await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-abc');
    expect(first.opportunities[0].candidate_text_a).toBe(SENTINEL_A);

    // Destroy the original UED so a rebuild cannot succeed.
    state.evaluation_artifacts = state.evaluation_artifacts.filter(
      (a: any) => a.artifact_type !== 'unified_evaluation_document_v1',
    );
    state.evaluation_artifacts = state.evaluation_artifacts.filter(
      (a: any) => a.artifact_type !== 'author_exposure_certification_v1',
    );

    const second = await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-abc');
    expect(second.opportunities[0].candidate_text_a).toBe(SENTINEL_A);
    expect(second.opportunities[0].candidate_text_b).toBe(SENTINEL_B);
    expect(second.opportunities[0].candidate_text_c).toBe(SENTINEL_C);
  });

  it('6. getWorkbenchQueue returns A/B/C sentinels in options after persisted reload', async () => {
    const { unifiedDocument, hash } = makeUedWithCandidates();
    const { client: supabase, state } = buildSupabaseForLedger(unifiedDocument.result, unifiedDocument, hash);
    mockCreateAdminClient.mockReturnValue(supabase as any);

    await getWorkbenchQueue({ manuscriptId: '9001', evaluationJobId: 'job-abc' });

    state.evaluation_artifacts = state.evaluation_artifacts.filter(
      (a: any) => a.artifact_type !== 'unified_evaluation_document_v1',
    );
    state.evaluation_artifacts = state.evaluation_artifacts.filter(
      (a: any) => a.artifact_type !== 'author_exposure_certification_v1',
    );

    const queue = await getWorkbenchQueue({ manuscriptId: '9001', evaluationJobId: 'job-abc' });
    expect(queue.opportunities).toHaveLength(1);
    const optionA = queue.opportunities[0].options.find((o: any) => o.key === 'A');
    const optionB = queue.opportunities[0].options.find((o: any) => o.key === 'B');
    const optionC = queue.opportunities[0].options.find((o: any) => o.key === 'C');
    expect(optionA?.candidateText).toBe(SENTINEL_A);
    expect(optionB?.candidateText).toBe(SENTINEL_B);
    expect(optionC?.candidateText).toBe(SENTINEL_C);
  });

  it('7. legacy A-only UED does not regenerate B/C and loads safely', async () => {
    const legacyRecommendation = makeRecommendation({ candidate_text_b: '', candidate_text_c: '' });
    const { unifiedDocument, hash } = makeUedWithCandidates(legacyRecommendation);
    const { client: supabase } = buildSupabaseForLedger(unifiedDocument.result, unifiedDocument, hash);
    mockCreateAdminClient.mockReturnValue(supabase as any);

    const result = await ensureRevisionOpportunityLedgerArtifact(supabase, 'job-abc');
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].candidate_text_a).toBe(SENTINEL_A);
    expect(result.opportunities[0].candidate_text_b).toBeFalsy();
    expect(result.opportunities[0].candidate_text_c).toBeFalsy();
  });
});
