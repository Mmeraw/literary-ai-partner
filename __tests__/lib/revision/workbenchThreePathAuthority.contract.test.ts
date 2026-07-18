/**
 * Issue #1260 — Workbench three-path authority contract.
 *
 * Proves author decisions made in the Workbench survive every persistence and
 * reload boundary and determine the revised manuscript. No production code is
 * exercised that is not already present; these tests characterize the actual
 * authority path.
 */

import { buildCanonicalOpportunityLedger } from '@/lib/evaluation/canonicalOpportunityLedger';
import { getWorkbenchQueue } from '@/lib/revision/workbenchQueue';
import { syncRevisionLedgerDecisions, listRevisionLedgerDecisions } from '@/lib/revision/ledger';

jest.mock('@/lib/revision/workbenchQueue', () => {
  const actual = jest.requireActual('@/lib/revision/workbenchQueue');
  return {
    ...actual,
    getWorkbenchQueue: jest.fn(),
  };
});
import { applyFinalReviewDecisions, buildFinalReviewExport } from '@/lib/revision/finalReviewRuntime';
import { getFinalReviewPayload } from '@/lib/revision/finalReview';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { getAuthorExposureDecision } from '@/lib/evaluation/authorExposureCertification';
import { loadReviseQueueWarmupCorpus } from '@/lib/revision/reviseQueueWarmup';
import { revisionCandidateHash, revisionOpportunityVersion } from '@/lib/revision/decisionAuthorityIdentity';

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({ getAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/evaluation/authorExposureCertification', () => ({ getAuthorExposureDecision: jest.fn() }));
jest.mock('@/lib/revision/reviseQueueWarmup', () => ({ loadReviseQueueWarmupCorpus: jest.fn() }));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetAuthorExposureDecision = getAuthorExposureDecision as jest.MockedFunction<typeof getAuthorExposureDecision>;
const mockLoadReviseQueueWarmupCorpus = loadReviseQueueWarmupCorpus as jest.MockedFunction<typeof loadReviseQueueWarmupCorpus>;
const mockGetWorkbenchQueue = getWorkbenchQueue as jest.MockedFunction<typeof getWorkbenchQueue>;
const realGetWorkbenchQueue = jest.requireActual('@/lib/revision/workbenchQueue').getWorkbenchQueue as typeof getWorkbenchQueue;

const SENTINEL_A = 'AAA_SENTINEL_ALPHA: Mara paused at the threshold until the room understood her choice.';
const SENTINEL_B = 'BBB_SENTINEL_BRAVO: For the moment, Mara held the door open and let the silence settle before she answered.';
const SENTINEL_C = 'CCC_SENTINEL_CHARLIE: The answer stayed in Maras hand before it reached her voice, quiet and deliberate.';

const ANCHOR = 'Mara set the unsigned letter beside the lamp and listened to the river striking the pilings.';

function makeRecommendation(overrides: { anchor_snippet?: string; candidate_text_a?: string; candidate_text_b?: string; candidate_text_c?: string } = {}) {
  return {
    priority: 'high' as const,
    severity: 'must' as const,
    action: 'Revise the anchored passage through embodied action.',
    expected_impact: 'Improves pacing without changing story facts.',
    anchor_snippet: overrides.anchor_snippet ?? ANCHOR,
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

function makeEvaluationResult(recommendation: any, verdict: string = 'revise') {
  const recommendations = Array.isArray(recommendation) ? recommendation : [recommendation];
  return {
    schema_version: 'evaluation_result_v2',
    ids: { evaluation_run_id: 'run-abc', job_id: 'job-abc', manuscript_id: 9001, user_id: 'user-abc' },
    generated_at: '2026-07-17T00:00:00.000Z',
    engine: { model: 'fixture', provider: 'test' as const, prompt_version: 'abc' },
    overview: {
      verdict,
      overall_score_0_100: 61,
      scored_criteria_count: 1,
      one_paragraph_summary: 'Test manuscript.',
      top_3_strengths: ['voice'],
      top_3_risks: ['pacing'],
    },
    criteria: [{
      key: 'pacing',
      scorable: true,
      status: 'SCORABLE' as const,
      signal_present: true,
      signal_strength: 'SUFFICIENT' as const,
      confidence_band: 'HIGH' as const,
      score_0_10: 4,
      scorability_status: 'scorable_confident',
      rationale: 'The first passage reports action abstractly.',
      evidence: [{ snippet: ANCHOR }],
      recommendations,
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
        target[existingIndex] = {
          ...target[existingIndex],
          ...row,
          id: row.id ?? target[existingIndex].id ?? `${table}-${state.idCounter ?? 1}`,
        };
        if (!target[existingIndex].id) {
          target[existingIndex].id = `${table}-${state.idCounter ?? 1}`;
          state.idCounter = (state.idCounter ?? 1) + 1;
        }
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

    const resolveList = () => {
      let rows = state[table] ?? [];
      rows = applyFilters(rows, filters);
      if (orderBy) {
        rows = [...rows].sort((a: any, b: any) => {
          const av = a[orderBy!] ?? '';
          const bv = b[orderBy!] ?? '';
          if (typeof av === 'string' && typeof bv === 'string') {
            return orderAscending ? av.localeCompare(bv) : bv.localeCompare(av);
          }
          if (av < bv) return orderAscending ? -1 : 1;
          if (av > bv) return orderAscending ? 1 : -1;
          return 0;
        });
      }
      if (limitValue) rows = rows.slice(0, limitValue);
      return { data: rows, error: null };
    };

    const resolveSingle = () => {
      const { data } = resolveList();
      return { data: data[0] ?? null, error: null };
    };

    const builder: any = {
      select: () => builder,
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

  function latestLedgerRow(user_id: string, manuscript_id: number, evaluation_job_id: string, opportunity_id: string) {
    return [...(state.revision_ledger_decisions ?? [])]
      .filter(
        (row: any) =>
          row.user_id === user_id &&
          row.manuscript_id === manuscript_id &&
          row.evaluation_job_id === evaluation_job_id &&
          row.opportunity_id === opportunity_id &&
          row.is_undo === false,
      )
      .sort((left: any, right: any) => {
        const created = String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''));
        if (created !== 0) return created;
        const updated = String(right.updated_at ?? '').localeCompare(String(left.updated_at ?? ''));
        if (updated !== 0) return updated;
        return String(right.id ?? '').localeCompare(String(left.id ?? ''));
      })[0];
  }

  const rpc = jest.fn(async (name: string, payload: any) => {
    if (name === 'sync_revision_ledger_decisions_atomic') {
      const rows = payload?.p_rows ?? [];

      for (const row of rows) {
        if (row.is_undo === true) continue;
        const metadata = row.metadata ?? {};
        const expected = metadata.expectedCurrentLocalId ?? null;
        const actual = latestLedgerRow(row.user_id, row.manuscript_id, row.evaluation_job_id, row.opportunity_id)?.local_id ?? null;
        if (expected !== actual) {
          return {
            data: null,
            error: { message: `Ledger stale write blocked: expected current localId ${expected ?? 'null'} but found ${actual ?? 'null'} for opportunity ${row.opportunity_id}.` },
          };
        }
      }

      const synced: any[] = [];
      for (const row of rows) {
        const existingIndex = (state.revision_ledger_decisions ?? []).findIndex(
          (candidate: any) =>
            candidate.user_id === row.user_id &&
            candidate.evaluation_job_id === row.evaluation_job_id &&
            candidate.local_id === row.local_id,
        );
        if (existingIndex >= 0) {
          state.revision_ledger_decisions[existingIndex] = {
            ...state.revision_ledger_decisions[existingIndex],
            ...row,
            updated_at: row.updated_at ?? new Date().toISOString(),
          };
          synced.push(state.revision_ledger_decisions[existingIndex]);
        } else {
          const inserted = {
            id: `row-${(state.revision_ledger_decisions ?? []).length + 1}`,
            created_at: row.client_created_at ?? new Date().toISOString(),
            updated_at: row.updated_at ?? new Date().toISOString(),
            ...row,
          };
          state.revision_ledger_decisions = [...(state.revision_ledger_decisions ?? []), inserted];
          synced.push(inserted);
        }
      }
      return { data: synced, error: null };
    }

    if (name === 'apply_final_review_once') {
      const rawText = payload?.p_raw_text ?? '';
      const revisedVersionId = `version-${(state.manuscript_versions?.length ?? 0) + 1}`;
      state.manuscript_versions = [...(state.manuscript_versions ?? []), {
        id: revisedVersionId,
        manuscript_id: payload?.p_manuscript_id,
        source_version_id: payload?.p_source_version_id,
        raw_text: rawText,
        word_count: rawText.trim() ? rawText.trim().split(/\s+/).length : 0,
        created_at: new Date().toISOString(),
      }];
      return { data: [{ revised_version_id: revisedVersionId, reused_existing_version: false }], error: null };
    }

    return { data: null, error: { message: `Unexpected rpc: ${name}` } };
  });

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

function buildSupabaseForAuthorityTest(evaluationResult: any, unifiedDocument?: any, hash?: string) {
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
    evaluation_artifacts: artifacts.map((a: any, i: number) => ({ id: `artifact-${i}`, ...a })),
  });
}

function buildAuthorityMetadata(opportunity: any, selectedOption: 'A' | 'B' | 'C') {
  const sourceExcerpt = `${opportunity.quoteHighlight ?? ''}${opportunity.quoteRest ?? ''}`.trim() || ANCHOR;
  const sourceLocation = opportunity.anchor ?? 'Chapter 1, paragraph 1.';
  const option = opportunity.options.find((o: any) => o.key === selectedOption);
  return {
    sourceUedHash: opportunity.sourceUedHash ?? null,
    sourceOpportunityId: opportunity.sourceOpportunityId ?? null,
    sourceCriterion: opportunity.sourceCriterion ?? null,
    opportunityVersion: revisionOpportunityVersion({
      id: opportunity.id,
      sourceUedHash: opportunity.sourceUedHash ?? null,
      sourceOpportunityId: opportunity.sourceOpportunityId ?? null,
      sourceCriterion: opportunity.sourceCriterion ?? null,
      sourceExcerpt,
      sourceLocation,
      cardType: opportunity.cardType ?? null,
      trustedPathStatus: opportunity.trustedPathStatus ?? null,
      options: opportunity.options,
    }),
    candidateSlot: selectedOption,
    candidateHash: revisionCandidateHash({
      opportunityId: opportunity.id,
      candidateSlot: selectedOption,
      candidateText: option?.candidateText ?? option?.text ?? '',
      sourceUedHash: opportunity.sourceUedHash ?? null,
      sourceOpportunityId: opportunity.sourceOpportunityId ?? null,
      sourceCriterion: opportunity.sourceCriterion ?? null,
    }),
  };
}

async function loadQueue(supabase: any) {
  mockCreateAdminClient.mockReturnValue(supabase as any);
  return getWorkbenchQueue({ manuscriptId: '9001', evaluationJobId: 'job-abc' });
}

async function syncDecision(supabase: any, entry: any) {
  mockCreateAdminClient.mockReturnValue(supabase as any);
  return syncRevisionLedgerDecisions({
    manuscriptId: 9001,
    evaluationJobId: 'job-abc',
    entries: [entry],
  });
}

describe('#1260 workbench three-path authority contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-abc', email: 'author@example.com' } as never);
    mockGetAuthorExposureDecision.mockResolvedValue({ exposable: true, certifiedAt: null });
    mockLoadReviseQueueWarmupCorpus.mockResolvedValue({
      loadedAt: new Date().toISOString(),
      files: {},
      combinedText: 'warmup',
      proof: { combinedSha256: 'abc123', combinedBytes: 42, fileCount: 10, benchmarkCount: 3, benchmarkFilesLoaded: [] },
    });
    mockGetWorkbenchQueue.mockReset();
    mockGetWorkbenchQueue.mockImplementation(realGetWorkbenchQueue);
  });

  it('persists, reloads and exports an accepted candidate B', async () => {
    const { unifiedDocument, hash } = makeUedWithCandidates();
    const { client: supabase } = buildSupabaseForAuthorityTest(unifiedDocument.result, unifiedDocument, hash);

    const queue = await loadQueue(supabase);
    expect(queue.ok).toBe(true);
    const opportunity = queue.opportunities[0];
    expect(opportunity.options.find((o: any) => o.key === 'B')?.candidateText).toBe(SENTINEL_B);

    const entry = {
      localId: 'local-1',
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      decision: 'accepted_b' as const,
      selectedOption: 'B' as const,
      selectedText: SENTINEL_B,
      sourceExcerpt: ANCHOR,
      sourceLocation: opportunity.anchor,
      clientCreatedAt: new Date().toISOString(),
      isUndo: false,
      undoneLocalId: null,
      metadata: buildAuthorityMetadata(opportunity, 'B'),
    };

    const synced = await syncDecision(supabase, entry);
    expect(synced[0].decision).toBe('accepted_b');
    expect(synced[0].selected_option).toBe('B');

    const reloaded = await listRevisionLedgerDecisions({ manuscriptId: 9001, evaluationJobId: 'job-abc' });
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].decision).toBe('accepted_b');
    expect(reloaded[0].selected_option).toBe('B');
    expect(reloaded[0].selected_text).toBe(SENTINEL_B);

    const exported = await buildFinalReviewExport({ manuscriptId: 9001, evaluationJobId: 'job-abc', format: 'clean', file: 'txt' });
    expect(exported.content).toContain(SENTINEL_B);
    expect(exported.content).not.toContain(ANCHOR);
  });

  it('persists, reloads and exports an accepted candidate C', async () => {
    const { unifiedDocument, hash } = makeUedWithCandidates();
    const { client: supabase } = buildSupabaseForAuthorityTest(unifiedDocument.result, unifiedDocument, hash);

    const queue = await loadQueue(supabase);
    const opportunity = queue.opportunities[0];

    const entry = {
      localId: 'local-1',
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      decision: 'accepted_c' as const,
      selectedOption: 'C' as const,
      selectedText: SENTINEL_C,
      sourceExcerpt: ANCHOR,
      sourceLocation: opportunity.anchor,
      clientCreatedAt: new Date().toISOString(),
      isUndo: false,
      undoneLocalId: null,
      metadata: buildAuthorityMetadata(opportunity, 'C'),
    };

    await syncDecision(supabase, entry);
    const exported = await buildFinalReviewExport({ manuscriptId: 9001, evaluationJobId: 'job-abc', format: 'clean', file: 'txt' });
    expect(exported.content).toContain(SENTINEL_C);
    expect(exported.content).not.toContain(ANCHOR);
  });

  it('applies the selected candidate exactly once and blocks a non-unique source excerpt', async () => {
    // Use the canonical ANCHOR as the evidence excerpt so candidate quality passes,
    // but place it twice in the manuscript so the source excerpt is not unique.
    const before = 'The morning light came through the window and the room was still.';
    const after = 'Then the door opened and everything changed.';
    const source = `${before} ${ANCHOR} ${ANCHOR} ${after}`;
    const recommendation = makeRecommendation();
    const { unifiedDocument, hash } = makeUedWithCandidates(recommendation);
    const { client: supabase, state } = buildSupabaseForAuthorityTest(unifiedDocument.result, unifiedDocument, hash);
    state.manuscript_versions[0].raw_text = `${source}\n\nA second paragraph.`;

    const queue = await loadQueue(supabase);
    expect(queue.ok).toBe(true);
    const opportunity = queue.opportunities[0];
    expect(opportunity?.cardType).toBe('copy_paste_rewrite');

    const entry = {
      localId: 'local-1',
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      decision: 'accepted_b' as const,
      selectedOption: 'B' as const,
      selectedText: SENTINEL_B,
      sourceExcerpt: `${opportunity.quoteHighlight}${opportunity.quoteRest}`.trim(),
      sourceLocation: opportunity.anchor,
      clientCreatedAt: new Date().toISOString(),
      isUndo: false,
      undoneLocalId: null,
      metadata: buildAuthorityMetadata(opportunity, 'B'),
    };

    await syncDecision(supabase, entry);

    // source excerpt appears twice; apply should fail-closed (not replace twice)
    const result = await applyFinalReviewDecisions({ manuscriptId: 9001, evaluationJobId: 'job-abc' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not unique/i);
  });

  it('rejects a stale opportunityVersion when the authoritative source changes after decision persistence', async () => {
    const { unifiedDocument, hash } = makeUedWithCandidates();
    const { client: supabase, state } = buildSupabaseForAuthorityTest(unifiedDocument.result, unifiedDocument, hash);

    const queue = await loadQueue(supabase);
    const opportunity = queue.opportunities[0];

    const entry = {
      localId: 'local-1',
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      decision: 'accepted_b' as const,
      selectedOption: 'B' as const,
      selectedText: SENTINEL_B,
      sourceExcerpt: ANCHOR,
      sourceLocation: opportunity.anchor,
      clientCreatedAt: new Date().toISOString(),
      isUndo: false,
      undoneLocalId: null,
      metadata: buildAuthorityMetadata(opportunity, 'B'),
    };

    await syncDecision(supabase, entry);

    // Mutate the authoritative UED source criterion and recompute its certification hash.
    const uedIndex = state.evaluation_artifacts.findIndex((a: any) => a.artifact_type === 'unified_evaluation_document_v1');
    const certIndex = state.evaluation_artifacts.findIndex((a: any) => a.artifact_type === 'author_exposure_certification_v1');
    expect(uedIndex).toBeGreaterThanOrEqual(0);
    expect(certIndex).toBeGreaterThanOrEqual(0);

    const mutatedUed = JSON.parse(JSON.stringify(state.evaluation_artifacts[uedIndex].content));
    mutatedUed.canonicalOpportunityLedger.opportunities[0].primary_criterion = 'VOICE';
    const newHash = canonicalJsonSha256(mutatedUed);

    state.evaluation_artifacts[uedIndex].content = mutatedUed;
    state.evaluation_artifacts[certIndex].content.unified_document_hash = newHash;

    // Remove the persisted ledger so the next queue load is forced to reconstruct from the mutated UED.
    state.evaluation_artifacts = state.evaluation_artifacts.filter(
      (a: any) => a.artifact_type !== 'revision_opportunity_ledger_v1',
    );

    const result = await applyFinalReviewDecisions({ manuscriptId: 9001, evaluationJobId: 'job-abc' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/opportunity version mismatch|sourceUedHash|source criterion/i);
  });

  it('preview and export agree when a source excerpt is not unique', async () => {
    const before = 'The morning light came through the window and the room was still.';
    const after = 'Then the door opened and everything changed.';
    const source = `${before} ${ANCHOR} ${ANCHOR} ${after}`;
    const recommendation = makeRecommendation();
    const { unifiedDocument, hash } = makeUedWithCandidates(recommendation);
    const { client: supabase, state } = buildSupabaseForAuthorityTest(unifiedDocument.result, unifiedDocument, hash);
    state.manuscript_versions[0].raw_text = `${source}\n\nA second paragraph.`;

    const queue = await loadQueue(supabase);
    const opportunity = queue.opportunities[0];

    await syncDecision(supabase, {
      localId: 'local-1',
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      decision: 'accepted_b' as const,
      selectedOption: 'B' as const,
      selectedText: SENTINEL_B,
      sourceExcerpt: `${opportunity.quoteHighlight}${opportunity.quoteRest}`.trim(),
      sourceLocation: opportunity.anchor,
      clientCreatedAt: new Date().toISOString(),
      isUndo: false,
      undoneLocalId: null,
      metadata: buildAuthorityMetadata(opportunity, 'B'),
    });

    const preview = await getFinalReviewPayload({ manuscriptId: '9001', evaluationJobId: 'job-abc' });
    const exported = await buildFinalReviewExport({ manuscriptId: 9001, evaluationJobId: 'job-abc', format: 'clean', file: 'txt' });

    // Parity invariant: if export refuses to apply because the source is not unique,
    // preview must not silently replace the first occurrence.
    const previewText = preview.previewParagraphs.join('\n\n');
    const exportRefused = exported.content.includes('not unique') || exported.filename.includes('blocked');
    const previewMutated = previewText.includes(SENTINEL_B);
    expect(exportRefused).toBe(true);
    expect(previewMutated).toBe(false);
  });

  describe('strategy/withheld authority parity', () => {
    function deepClone<T>(value: T): T {
      return JSON.parse(JSON.stringify(value));
    }

    function buildMinimalSupabaseWithLegacyDecision(decisionOverrides: any = {}) {
      const row = {
        id: 'row-strategy-1',
        user_id: 'user-abc',
        manuscript_id: 9001,
        evaluation_job_id: 'job-abc',
        local_id: 'local-strategy-1',
        opportunity_id: 'opp-strategy-001',
        opportunity_title: 'Strategy guidance',
        decision: 'accepted_a' as const,
        selected_option: 'A' as const,
        custom_text: null,
        selected_text: 'STRATEGY_REPLACEMENT_TEXT',
        source_excerpt: ANCHOR,
        source_location: 'Chapter 1, paragraph 1.',
        metadata: { candidateSlot: 'A' },
        created_at: '2026-07-17T00:00:00.000Z',
        is_undo: false,
        undone_local_id: null,
        ...decisionOverrides,
      };
      return createStatefulSupabaseClient({
        manuscripts: [{ id: 9001, title: 'ABC Test', user_id: 'user-abc' }],
        evaluation_jobs: [{
          id: 'job-abc',
          status: 'complete',
          manuscript_id: 9001,
          manuscript_version_id: 'mv-source',
        }],
        manuscript_versions: [{ id: 'mv-source', raw_text: `${ANCHOR}\n\nA second paragraph.` }],
        revision_ledger_decisions: [row],
      });
    }

    function strategyQueuePayload(): any {
      return {
        ok: true,
        error: null,
        opportunities: [],
        needsTargeting: [{
          id: 'opp-strategy-001',
          cardType: 'revision_strategy',
          trustedPathStatus: 'unavailable_author_review_required',
          title: 'Strategy guidance',
          anchor: 'Chapter 1, paragraph 1.',
          options: [],
        }],
        withheldUnsupported: [],
      };
    }

    beforeEach(() => {
      mockGetWorkbenchQueue.mockReset();
      mockGetWorkbenchQueue.mockResolvedValue(deepClone(strategyQueuePayload()));
    });

    it('includes needsTargeting strategy decisions in preview but excludes them from export', async () => {
      const { client: supabase } = buildMinimalSupabaseWithLegacyDecision();
      mockCreateAdminClient.mockReturnValue(supabase as any);

      const preview = await getFinalReviewPayload({ manuscriptId: '9001', evaluationJobId: 'job-abc' });
      const previewText = preview.previewParagraphs.join('\n\n');
      const strategyDecision = preview.decisions.find((d) => d.opportunityId === 'opp-strategy-001');

      // The strategy card is included in the preview payload from needsTargeting.
      expect(strategyDecision).toBeDefined();
      expect(strategyDecision?.decision).toBe('accepted_a');

      const previewMutated = previewText.includes('STRATEGY_REPLACEMENT_TEXT');

      const exported = await buildFinalReviewExport({ manuscriptId: 9001, evaluationJobId: 'job-abc', format: 'clean', file: 'txt' });
      const exportMutated = exported.content.includes('STRATEGY_REPLACEMENT_TEXT');

      // Export must not materialize a revision_strategy decision as manuscript text.
      expect(previewMutated).toBe(false);
      expect(exportMutated).toBe(false);
    });

    it('does not materialize revision_strategy guidance by replacing source excerpts in preview', async () => {
      const { client: supabase } = buildMinimalSupabaseWithLegacyDecision();
      mockCreateAdminClient.mockReturnValue(supabase as any);

      const preview = await getFinalReviewPayload({ manuscriptId: '9001', evaluationJobId: 'job-abc' });
      const previewText = preview.previewParagraphs.join('\n\n');

      // Preview must not replace the source excerpt with a strategy decision's selected text.
      expect(previewText).not.toContain('STRATEGY_REPLACEMENT_TEXT');
      expect(previewText).toContain(ANCHOR);
    });

    it('withheld decisions are not materialized in exported manuscript', async () => {
      const { client: supabase } = buildMinimalSupabaseWithLegacyDecision();
      mockCreateAdminClient.mockReturnValue(supabase as any);
      const withheldPayload = deepClone(strategyQueuePayload());
      withheldPayload.needsTargeting = [];
      withheldPayload.withheldUnsupported = [{
        id: 'opp-strategy-001',
        cardType: 'withheld',
        trustedPathStatus: 'impossible',
        title: 'Withheld guidance',
        anchor: 'Chapter 1, paragraph 1.',
        options: [],
      }];
      mockGetWorkbenchQueue.mockReset();
      mockGetWorkbenchQueue.mockResolvedValue(withheldPayload);

      const exported = await buildFinalReviewExport({ manuscriptId: 9001, evaluationJobId: 'job-abc', format: 'clean', file: 'txt' });
      expect(exported.content).not.toContain('STRATEGY_REPLACEMENT_TEXT');
      expect(exported.content).toContain(ANCHOR);
    });
  });
});
