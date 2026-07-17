import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue';
import { syncRevisionLedgerDecisions } from '@/lib/revision/ledger';
import { applyFinalReviewDecisions, buildFinalReviewExport } from '@/lib/revision/finalReviewRuntime';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { getAuthorExposureDecision } from '@/lib/evaluation/authorExposureCertification';
import { loadReviseQueueWarmupCorpus } from '@/lib/revision/reviseQueueWarmup';
import { resolveFinalReviewSourceText } from '@/lib/revision/finalReviewSourceText';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';
import * as opportunityLedger from '@/lib/revision/opportunityLedger';

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/evaluation/authorExposureCertification', () => ({ getAuthorExposureDecision: jest.fn() }));
jest.mock('@/lib/revision/reviseQueueWarmup', () => ({ loadReviseQueueWarmupCorpus: jest.fn() }));
jest.mock('@/lib/revision/finalReviewSourceText', () => ({
  ...jest.requireActual('@/lib/revision/finalReviewSourceText'),
  resolveFinalReviewSourceText: jest.fn(),
}));
jest.mock('@/lib/evaluation/artifactPersistence', () => ({ upsertEvaluationArtifact: jest.fn() }));
jest.mock('@/lib/revision/opportunityLedger', () => ({
  ...jest.requireActual('@/lib/revision/opportunityLedger'),
  ensureRevisionOpportunityLedgerArtifact: jest.fn(),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetAuthorExposureDecision = getAuthorExposureDecision as jest.MockedFunction<typeof getAuthorExposureDecision>;
const mockLoadReviseQueueWarmupCorpus = loadReviseQueueWarmupCorpus as jest.MockedFunction<typeof loadReviseQueueWarmupCorpus>;
const mockResolveFinalReviewSourceText = resolveFinalReviewSourceText as jest.MockedFunction<typeof resolveFinalReviewSourceText>;
const mockUpsertEvaluationArtifact = upsertEvaluationArtifact as jest.MockedFunction<typeof upsertEvaluationArtifact>;

const SOURCE_A = 'Mara set the unsigned letter beside the lamp and listened to the river striking the pilings.';
const SOURCE_B = 'Jonah closed the ledger, but his thumb remained trapped between the pages.';
const UNTOUCHED = 'Outside, rain moved steadily through the cedar branches.';

const CANDIDATES_A = [
  'Mara slid the unsigned letter beneath the lamp, then pressed both palms to the table as the river hammered the pilings below.',
  'The river struck the pilings hard enough to shake the lamp while Mara folded the unsigned letter into a narrow white blade.',
  'Mara held the unsigned letter over the flame, stopped, and laid it beside the lamp when the floor trembled under the river.',
];

const CANDIDATES_B = [
  'Jonah shut the ledger and kept one finger between the pages, preserving the exact place where the missing payment should have appeared.',
  'The ledger snapped closed, yet Jonah marked the disputed page with his thumb as though the paper itself might confess.',
  'Jonah closed the book slowly, his thumb fixed at the gap in the accounts while the rain ticked against the window.',
];

const CUSTOM_TEXT = 'Jonah closed the ledger, marked the missing payment with his thumbnail, and left the book open beneath the rain-dark window.';

const STRATEGY_EVIDENCE = 'By the third week of summer, the protagonist had still not returned the borrowed coat.';

const STRATEGY_CANDIDATES = [
  'Restage the midpoint reveal as three shorter beats distributed across chapters six through eight.',
  'Let the midpoint secret surface through two secondary characters before the protagonist confronts it.',
  'Break the midpoint revelation into a deferred question in chapter six and an answer in chapter eight.',
];

const WITHHELD_EVIDENCE = 'The dog had already begun to whine before the train rounded the bend.';

function makeEvaluationFixture(): any {
  const criteria = CRITERIA_KEYS.map((key, index) => {
    if (index === 0) {
      return {
        key,
        scorable: true,
        status: 'SCORABLE',
        signal_present: true,
        signal_strength: 'SUFFICIENT',
        confidence_band: 'HIGH',
        score_0_10: 4,
        scorability_status: 'scorable_confident',
        rationale: 'The first passage reports action abstractly.',
        evidence: [{ snippet: SOURCE_A }],
        recommendations: [{
          priority: 'high',
          severity: 'must',
          action: 'Revise the anchored passage through embodied action.',
          expected_impact: 'Improves pacing without changing story facts.',
          anchor_snippet: SOURCE_A,
          manuscript_coordinates: 'Chapter 1, paragraph 1',
          diagnosis: 'The passage reports the decision instead of dramatizing its physical consequence.',
          symptom: 'The decisive beat remains abstract when the character should make a visible physical choice.',
          cause: 'Summary language replaces an observable action at the exact point of tension.',
          fix_direction: 'Replace the anchored sentence with one concrete action that preserves the existing facts and voice.',
          reader_effect: 'The reader can witness the decision and feel its immediate consequence.',
          mistake_proofing: 'Keep every named person, object, and event unchanged while adding only observable action.',
          candidate_text_a: CANDIDATES_A[0],
          candidate_text_b: CANDIDATES_A[1],
          candidate_text_c: CANDIDATES_A[2],
        }],
      };
    }

    if (index === 1) {
      return {
        key,
        scorable: true,
        status: 'SCORABLE',
        signal_present: true,
        signal_strength: 'SUFFICIENT',
        confidence_band: 'HIGH',
        score_0_10: 4,
        scorability_status: 'scorable_confident',
        rationale: 'The second passage also reports the gesture instead of dramatizing it.',
        evidence: [{ snippet: SOURCE_B }],
        recommendations: [{
          priority: 'high',
          severity: 'must',
          action: 'Revise the anchored passage through embodied action.',
          expected_impact: 'Improves scene construction without changing story facts.',
          anchor_snippet: SOURCE_B,
          manuscript_coordinates: 'Chapter 1, paragraph 3',
          diagnosis: 'The passage reports the gesture instead of dramatizing its physical consequence.',
          symptom: 'The decisive beat remains abstract when the character should make a visible physical choice.',
          cause: 'Summary language replaces an observable action at the exact point of tension.',
          fix_direction: 'Replace the anchored sentence with one concrete action that preserves the existing facts and voice.',
          reader_effect: 'The reader can witness the decision and feel its immediate consequence.',
          mistake_proofing: 'Keep every named person, object, and event unchanged while adding only observable action.',
          candidate_text_a: CANDIDATES_B[0],
          candidate_text_b: CANDIDATES_B[1],
          candidate_text_c: CANDIDATES_B[2],
        }],
      };
    }

    if (index === 2) {
      return {
        key,
        scorable: true,
        status: 'SCORABLE',
        signal_present: true,
        signal_strength: 'SUFFICIENT',
        confidence_band: 'HIGH',
        score_0_10: 5,
        scorability_status: 'scorable_confident',
        rationale: 'The midpoint tension remains trapped in a single chapter.',
        evidence: [{ snippet: STRATEGY_EVIDENCE }],
        recommendations: [{
          priority: 'medium',
          severity: 'should',
          action: 'Redistribute the midpoint tension across later scenes.',
          expected_impact: 'Improves structural balance without removing existing events.',
          anchor_snippet: STRATEGY_EVIDENCE,
          manuscript_coordinates: 'structural: midpoint',
          diagnosis: 'The midpoint tension remains trapped in a single chapter.',
          symptom: 'The second act carries no structural redistribution.',
          cause: 'The narrative does not redistribute the weight across the second act.',
          fix_direction: 'Redistribute the revelation across later scenes so the second act carries the load.',
          reader_effect: 'The reader feels the structure shift rather than stall.',
          mistake_proofing: 'Do not remove existing characters or events.',
          candidate_text_a: STRATEGY_CANDIDATES[0],
          candidate_text_b: STRATEGY_CANDIDATES[1],
          candidate_text_c: STRATEGY_CANDIDATES[2],
        }],
      };
    }

    if (index === 3) {
      return {
        key,
        scorable: true,
        status: 'SCORABLE',
        signal_present: true,
        signal_strength: 'SUFFICIENT',
        confidence_band: 'HIGH',
        score_0_10: 7,
        scorability_status: 'scorable_confident',
        rationale: 'The opening could be more marketable.',
        evidence: [{ snippet: WITHHELD_EVIDENCE }],
        recommendations: [{
          priority: 'low',
          severity: 'could',
          action: 'Sharpen the opening line to include an urgent story question.',
          expected_impact: 'Improves marketability without changing the scene.',
          anchor_snippet: WITHHELD_EVIDENCE,
          manuscript_coordinates: 'Chapter 1, paragraph 1',
          diagnosis: 'The opening could be more marketable.',
          symptom: 'The opening does not immediately signal genre promise.',
          cause: 'The first paragraph relies on atmosphere alone.',
          fix_direction: 'Sharpen the opening line to include an urgent story question.',
          reader_effect: 'The reader feels compelled to continue.',
          mistake_proofing: 'Preserve the lamp and the unsigned letter.',
          candidate_text_a: '',
          candidate_text_b: '',
          candidate_text_c: '',
        }],
      };
    }

    return {
      key,
      scorable: true,
      status: 'SCORABLE',
      signal_present: true,
      signal_strength: 'SUFFICIENT',
      confidence_band: 'HIGH',
      score_0_10: 7,
      scorability_status: 'scorable_confident',
      rationale: `The ${key} evidence is specific and observable.`,
      evidence: [{ snippet: 'A safe passage that needs no revision.' }],
      recommendations: [],
    };
  });

  return {
    schema_version: 'evaluation_result_v2',
    ids: {
      evaluation_run_id: 'run-e2e',
      job_id: 'job-e2e',
      manuscript_id: 6074,
      user_id: 'user-e2e',
    },
    generated_at: '2026-07-14T00:00:00.000Z',
    engine: { model: 'fixture', provider: 'test', prompt_version: 'e2e' },
    overview: {
      verdict: 'revise',
      overall_score_0_100: 61,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: 'The manuscript has a strong premise but needs more embodied action at decisive moments.',
      top_3_strengths: ['voice', 'concept', 'setting'],
      top_3_risks: ['pacing', 'sceneConstruction', 'character'],
    },
    criteria,
    recommendations: { quick_wins: [], strategic_revisions: [] },
    metrics: {
      manuscript: { word_count: 5000, title: 'End-to-End Manuscript' },
      processing: {},
    },
    artifacts: [],
    governance: {
      confidence: 0.9,
      warnings: [],
      limitations: [],
      policy_family: 'multi-pass-dual-axis',
      observability_warnings: [],
    },
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
      } else if (row.local_id != null && row.user_id != null && row.evaluation_job_id != null) {
        existingIndex = target.findIndex(
          (existing: any) =>
            existing.local_id === row.local_id &&
            existing.user_id === row.user_id &&
            existing.evaluation_job_id === row.evaluation_job_id,
        );
      } else if (row.job_id != null && row.artifact_type != null) {
        existingIndex = target.findIndex(
          (existing: any) =>
            existing.job_id === row.job_id && existing.artifact_type === row.artifact_type,
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

  function insertRows(table: string, rows: any[]) {
    const target = state[table] ?? [];
    const normalized = Array.isArray(rows) ? rows : [rows];
    for (const row of normalized) {
      target.push({ ...row, created_at: row.created_at ?? new Date().toISOString() });
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
      select: (columns: string) => {
        _selectColumns = columns;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.eq[column] = value;
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        filters.in[column] = values;
        return builder;
      },
      order: (column: string, { ascending = true } = {}) => {
        orderBy = column;
        orderAscending = ascending;
        return builder;
      },
      limit: (n: number) => {
        limitValue = n;
        return builder;
      },
      maybeSingle: () => Promise.resolve(resolveSingle()),
      single: () => Promise.resolve(resolveSingle()),
      upsert: (rows: any[], _options: any) => {
        upsertRows(table, rows);
        return builder;
      },
      insert: (rows: any[]) => {
        insertRows(table, rows);
        return Promise.resolve({ data: null, error: null });
      },
      then: (onFulfilled: (value: any) => any) => Promise.resolve(onFulfilled(resolveList())),
    };

    return builder;
  }

  const rpc = jest.fn(async (_name: string, args: any) => {
    if (_name === 'sync_revision_ledger_decisions_atomic') {
      upsertRows('revision_ledger_decisions', args.p_rows ?? []);
      const localIds = new Set((args.p_rows ?? []).map((row: any) => row.local_id));
      return {
        data: state.revision_ledger_decisions.filter((row: any) => localIds.has(row.local_id)),
        error: null,
      };
    }

    if (_name !== 'apply_final_review_once') {
      return { data: null, error: { message: `Unexpected rpc: ${_name}` } };
    }

    const fingerprint = args.p_apply_fingerprint;
    if (state.versionsByFingerprint[fingerprint]) {
      return {
        data: [{
          revised_version_id: state.versionsByFingerprint[fingerprint],
          reused_existing_version: true,
        }],
        error: null,
      };
    }
    const versionId = `mv-revised-${state.versionCounter ?? 1}`;
    state.versionCounter = (state.versionCounter ?? 1) + 1;
    state.versionsByFingerprint[fingerprint] = versionId;
    state.versions[versionId] = args;
    return {
      data: [{ revised_version_id: versionId, reused_existing_version: false }],
      error: null,
    };
  });

  const client = {
    from: query,
    rpc,
  };

  return { client, state };
}

function buildStatefulSupabase(evaluation: any, sourceText: string) {
  const state = {
    manuscripts: [{ id: 6074, title: 'End-to-End Manuscript', user_id: 'user-e2e' }],
    evaluation_jobs: [{
      id: 'job-e2e',
      status: 'complete',
      manuscript_id: 6074,
      manuscript_version_id: 'mv-source',
      policy_family: 'multi-pass-dual-axis',
      voice_preservation_level: 'balanced',
      english_variant: 'american',
    }],
    manuscript_versions: [{ id: 'mv-source', raw_text: sourceText }],
    evaluation_artifacts: [
      {
        job_id: 'job-e2e',
        artifact_type: 'evaluation_result_v2',
        content: evaluation,
        created_at: '2026-07-14T00:00:00.000Z',
      },
    ],
    revision_ledger_decisions: [],
    final_review_apply_runs: [],
    versionsByFingerprint: {},
    versions: {},
    versionCounter: 1,
  };
  return createStatefulSupabaseClient(state);
}

describe('Evaluate → Revise → Revised Manuscript end-to-end', () => {
  const ORIGINAL_SOURCE_TEXT = `${SOURCE_A}\n\n${UNTOUCHED}\n\n${SOURCE_B}\n\n${STRATEGY_EVIDENCE}`;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-e2e', email: 'author@example.com' } as never);
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
        perFile: {},
      },
    } as never);
    mockResolveFinalReviewSourceText.mockResolvedValue(ORIGINAL_SOURCE_TEXT);
    mockUpsertEvaluationArtifact.mockResolvedValue('artifact-e2e');

    const actual = jest.requireActual('@/lib/revision/opportunityLedger') as any;
    (opportunityLedger.ensureRevisionOpportunityLedgerArtifact as jest.Mock).mockImplementation(async (supabase: any, _jobId: string) => {
      const { data } = await supabase
        .from('evaluation_artifacts')
        .select('content')
        .eq('job_id', 'job-e2e')
        .in('artifact_type', ['evaluation_result_v2', 'evaluation_result_v1'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const evaluationPayload = data?.content ?? {};
      const opportunities = actual.buildRevisionOpportunitiesFromEvaluationPayload(evaluationPayload).map((opportunity: any) => ({
        ...opportunity,
        context_quality: 'clean',
        preflight_status: 'passed',
        preflight_reasons: [],
      }));
      return { artifactId: 'ledger-e2e', opportunities };
    });
  });

  it('produces a deterministic revised manuscript from evaluation through export', async () => {
    const evaluation = makeEvaluationFixture();
    const { client: supabase } = buildStatefulSupabase(evaluation, ORIGINAL_SOURCE_TEXT);
    mockCreateAdminClient.mockReturnValue(supabase as never);

    // 1. Canonical evaluation artifact → revision opportunities → Workbench queue.
    const queuePayload = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-e2e' });
    expect(queuePayload.ok).toBe(true);
    if (!queuePayload.ok) throw new Error(queuePayload.error ?? 'Queue failed');

    expect(queuePayload.opportunities).toHaveLength(2);
    expect(queuePayload.needsTargeting).toHaveLength(1);
    expect(queuePayload.withheldUnsupported).toHaveLength(1);

    const [copyPasteA, copyPasteB] = queuePayload.opportunities;
    const [strategy] = queuePayload.needsTargeting;
    const [withheld] = queuePayload.withheldUnsupported;

    expect(copyPasteA.cardType).toBe('copy_paste_rewrite');
    expect(copyPasteB.cardType).toBe('copy_paste_rewrite');
    expect(strategy.cardType).toBe('revision_strategy');
    expect(withheld.cardType).toBe('withheld');

    // 2. Persist author decisions through the real ledger sync boundary.
    const acceptedOption = copyPasteA.options.find((option: any) => option.key === 'B');
    expect(acceptedOption).toBeDefined();

    const synced = await syncRevisionLedgerDecisions({
      manuscriptId: 6074,
      evaluationJobId: 'job-e2e',
      entries: [
        {
          localId: 'local-accepted-b',
          opportunityId: copyPasteA.id,
          opportunityTitle: copyPasteA.title,
          decision: 'accepted_b',
          selectedOption: 'B',
          selectedText: acceptedOption.candidateText,
          sourceExcerpt: SOURCE_A,
          sourceLocation: 'Chapter 1, paragraph 1',
          metadata: {},
        },
        {
          localId: 'local-custom',
          opportunityId: copyPasteB.id,
          opportunityTitle: copyPasteB.title,
          decision: 'custom',
          customText: CUSTOM_TEXT,
          sourceExcerpt: SOURCE_B,
          sourceLocation: 'Chapter 1, paragraph 3',
          metadata: {},
        },
        {
          localId: 'local-reject-strategy',
          opportunityId: strategy.id,
          opportunityTitle: strategy.title,
          decision: 'reject',
          sourceExcerpt: STRATEGY_EVIDENCE,
          sourceLocation: 'structural: midpoint',
          metadata: {},
        },
        {
          localId: 'local-keep-withheld',
          opportunityId: withheld.id,
          opportunityTitle: withheld.title,
          decision: 'keep_original',
          sourceExcerpt: WITHHELD_EVIDENCE,
          sourceLocation: 'Chapter 1, paragraph 1',
          metadata: {},
        },
      ],
    });
    expect(synced).toHaveLength(4);

    // 3. Final Review apply: accepted/custom edits applied exactly once.
    const firstApply = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-e2e' });
    expect(firstApply.ok).toBe(true);
    if (!firstApply.ok) throw new Error(String(firstApply.error));
    expect(firstApply.appliedCount).toBe(2);
    expect(firstApply.reusedExistingVersion).toBe(false);

    const expectedRevisedText = `${acceptedOption.candidateText}\n\n${UNTOUCHED}\n\n${CUSTOM_TEXT}\n\n${STRATEGY_EVIDENCE}`;
    const applyRpcCalls = (supabase.rpc as jest.Mock).mock.calls.filter(([name]) => name === 'apply_final_review_once');
    const rpcArgs = applyRpcCalls[0][1];
    expect(rpcArgs.p_raw_text).toBe(expectedRevisedText);
    expect(rpcArgs.p_applied_decision_ids).toEqual([synced[0].id, synced[1].id]);

    // 4. Replay the same ledger: identical fingerprint and version reuse.
    const secondApply = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-e2e' });
    expect(secondApply.ok).toBe(true);
    expect(secondApply.reusedExistingVersion).toBe(true);
    expect(secondApply.revisedVersionId).toBe(firstApply.revisedVersionId);
    const replayApplyRpcCalls = (supabase.rpc as jest.Mock).mock.calls.filter(([name]) => name === 'apply_final_review_once');
    expect(replayApplyRpcCalls[1][1].p_apply_fingerprint).toBe(rpcArgs.p_apply_fingerprint);

    // 5. Export determinism: clean, marked, and changelog derive from the same canonical source.
    const cleanExport = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-e2e', format: 'clean', file: 'txt' });
    expect(cleanExport.content).toBe(expectedRevisedText);

    const markedExport = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-e2e', format: 'marked', file: 'txt' });
    expect(markedExport.content).toContain(ORIGINAL_SOURCE_TEXT);
    expect(markedExport.content).toContain(acceptedOption.candidateText);
    expect(markedExport.content).toContain(CUSTOM_TEXT);
    expect(markedExport.content).toContain(SOURCE_A);
    expect(markedExport.content).toContain(SOURCE_B);

    const changelogExport = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-e2e', format: 'changelog', file: 'txt' });
    expect(changelogExport.content).toContain(acceptedOption.candidateText);
    expect(changelogExport.content).toContain(CUSTOM_TEXT);
    expect(changelogExport.content).toContain(SOURCE_A);
    expect(changelogExport.content).toContain(SOURCE_B);
    // Strategy and withheld edits do not appear as applied changes.
    expect(changelogExport.content).not.toContain(STRATEGY_CANDIDATES[0]);

    const cleanPdf = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-e2e', format: 'clean', file: 'pdf' });
    const cleanDocx = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-e2e', format: 'clean', file: 'docx' });
    expect(cleanPdf.content).toBe(cleanExport.content);
    expect(cleanDocx.content).toBe(cleanExport.content);

    // 6. Accepted and custom text appear exactly once; kept/rejected/strategy/withheld unchanged text remains.
    expect(cleanExport.content.split(acceptedOption.candidateText).length - 1).toBe(1);
    expect(cleanExport.content.split(CUSTOM_TEXT).length - 1).toBe(1);
    expect(cleanExport.content).not.toContain(SOURCE_A);
    expect(cleanExport.content).not.toContain(SOURCE_B);
    expect(cleanExport.content).toContain(UNTOUCHED);
  });

  it('fails closed when the source manuscript anchor drifts before Final Review', async () => {
    const evaluation = makeEvaluationFixture();
    const { client: supabase, state } = buildStatefulSupabase(evaluation, ORIGINAL_SOURCE_TEXT);
    mockCreateAdminClient.mockReturnValue(supabase as never);

    const queuePayload = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-e2e' });
    expect(queuePayload.ok).toBe(true);
    if (!queuePayload.ok) throw new Error(queuePayload.error ?? 'Queue failed');

    const [copyPasteA, copyPasteB] = queuePayload.opportunities;
    const acceptedOption = copyPasteA.options.find((option: any) => option.key === 'B');
    expect(acceptedOption).toBeDefined();

    await syncRevisionLedgerDecisions({
      manuscriptId: 6074,
      evaluationJobId: 'job-e2e',
      entries: [
        {
          localId: 'local-accepted-b',
          opportunityId: copyPasteA.id,
          opportunityTitle: copyPasteA.title,
          decision: 'accepted_b',
          selectedOption: 'B',
          selectedText: acceptedOption.candidateText,
          sourceExcerpt: SOURCE_A,
          sourceLocation: 'Chapter 1, paragraph 1',
          metadata: {},
        },
        {
          localId: 'local-custom',
          opportunityId: copyPasteB.id,
          opportunityTitle: copyPasteB.title,
          decision: 'custom',
          customText: CUSTOM_TEXT,
          sourceExcerpt: SOURCE_B,
          sourceLocation: 'Chapter 1, paragraph 3',
          metadata: {},
        },
      ],
    });

    const decisionsBefore = [...state.revision_ledger_decisions];

    // Anchor drift: the resolved source text no longer contains SOURCE_A exactly.
    mockResolveFinalReviewSourceText.mockResolvedValue(
      `${SOURCE_A.replace('listened', 'watched')}\n\n${UNTOUCHED}\n\n${SOURCE_B}`,
    );

    const result = await applyFinalReviewDecisions({ manuscriptId: 6074, evaluationJobId: 'job-e2e' });
    expect(result.ok).toBe(false);

    // No revised version should be persisted and no partial apply RPC called.
    expect((supabase.rpc as jest.Mock).mock.calls.some(([name]) => name === 'apply_final_review_once')).toBe(false);
    expect(Object.keys(state.versionsByFingerprint)).toHaveLength(0);

    // Author decisions remain intact; no partial edit appears anywhere.
    expect(state.revision_ledger_decisions).toHaveLength(decisionsBefore.length);
    for (const before of decisionsBefore) {
      const after = state.revision_ledger_decisions.find((row: any) => row.id === before.id);
      expect(after).toMatchObject(before);
    }

    // Export cannot present a newly revised manuscript.
    const cleanExport = await buildFinalReviewExport({ manuscriptId: 6074, evaluationJobId: 'job-e2e', format: 'clean', file: 'txt' });
    expect(cleanExport.content).not.toContain(acceptedOption.candidateText);
    expect(cleanExport.content).not.toContain(CUSTOM_TEXT);
  });
});
