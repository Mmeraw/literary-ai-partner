import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import { buildRevisionOpportunitiesFromEvaluationPayload } from '@/lib/revision/opportunityLedger';
import { runWorkbenchAdmissionGate } from '@/lib/revision/reviseAdmissionGate';
import { evaluateCardCandidateQuality } from '@/lib/revision/candidateQuality';
import {
  buildCandidatePatch,
  buildCustomPatch,
  buildPatchPreview,
  applyPatchFromPreview,
  sha256,
} from '@/lib/revision/revisePatchLifecycle';
import {
  revisionCandidateHash,
  revisionOpportunityVersion,
} from '@/lib/revision/decisionAuthorityIdentity';

const mockGetAuthenticatedUser = jest.fn();
const mockCreateAdminClient = jest.fn();
const mockUpsertEvaluationArtifact = jest.fn();
const mockResolveFinalReviewSourceText = jest.fn();
const mockGetWorkbenchQueue = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

jest.mock('@/lib/evaluation/artifactPersistence', () => ({
  upsertEvaluationArtifact: (...args: unknown[]) => mockUpsertEvaluationArtifact(...args),
}));

jest.mock('@/lib/revision/finalReviewSourceText', () => ({
  resolveFinalReviewSourceText: (...args: unknown[]) => mockResolveFinalReviewSourceText(...args),
  scrubInternalReportLeakage: (value: string) => value,
}));

jest.mock('@/lib/revision/workbenchQueue', () => ({
  getWorkbenchQueue: (...args: unknown[]) => mockGetWorkbenchQueue(...args),
}));

import { applyFinalReviewDecisions } from '@/lib/revision/finalReviewRuntime';

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

function makeEvaluationFixture() {
  return {
    schema_version: 'evaluation_result_v2',
    ids: {
      evaluation_run_id: 'run-shadow-e2e',
      job_id: 'job-shadow-e2e',
      manuscript_id: 991,
      user_id: 'user-shadow-e2e',
    },
    generated_at: '2026-07-14T00:00:00.000Z',
    engine: { model: 'fixture', provider: 'test', prompt_version: 'shadow-e2e' },
    overview: {
      verdict: 'revise',
      overall_score_0_100: 61,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: 'The manuscript has a strong premise but needs more embodied action at decisive moments.',
      top_3_strengths: ['voice', 'concept', 'setting'],
      top_3_risks: ['pacing', 'sceneConstruction', 'character'],
    },
    criteria: CRITERIA_KEYS.map((key, index) => {
      const source = index === 0 ? SOURCE_A : SOURCE_B;
      const candidates = index === 0 ? CANDIDATES_A : CANDIDATES_B;
      return {
        key,
        scorable: true,
        status: 'SCORABLE',
        signal_present: true,
        signal_strength: 'SUFFICIENT',
        confidence_band: 'HIGH',
        score_0_10: index < 2 ? 4 : 7,
        scorability_status: 'scorable_confident',
        rationale: `The ${key} evidence is specific and observable.`,
        evidence: [{ snippet: source }],
        recommendations: index < 2 ? [{
          priority: 'high',
          action: `Revise the anchored ${key} passage through embodied action.`,
          expected_impact: `Improves ${key} without changing story facts.`,
          anchor_snippet: source,
          diagnosis: `The ${key} passage reports the decision instead of dramatizing its physical consequence.`,
          symptom: 'The decisive beat remains abstract when the character should make a visible physical choice.',
          cause: 'Summary language replaces an observable action at the exact point of tension.',
          fix_direction: `Replace the anchored sentence with one concrete action that preserves the existing facts and voice.`,
          reader_effect: 'The reader can witness the decision and feel its immediate consequence.',
          mistake_proofing: 'Keep every named person, object, and event unchanged while adding only observable action.',
          candidate_text_a: candidates[0],
          candidate_text_b: candidates[1],
          candidate_text_c: candidates[2],
        }] : [],
      };
    }),
    recommendations: { quick_wins: [], strategic_revisions: [] },
    metrics: { manuscript: {}, processing: {} },
    artifacts: [],
    governance: {
      confidence: 0.9,
      warnings: [],
      limitations: [],
      policy_family: 'multi-pass-dual-axis',
      observability_warnings: [],
    },
  } as any;
}

function makeQuery(table: string, decisions: any[]) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(async () => {
      if (table === 'revision_ledger_decisions') return { data: decisions, error: null };
      return { data: [], error: null };
    }),
    insert: jest.fn(async () => ({ data: null, error: null })),
    maybeSingle: jest.fn(async () => {
      if (table === 'manuscripts') return { data: { id: 991, title: 'Shadow Manuscript', user_id: 'user-shadow-e2e' }, error: null };
      if (table === 'evaluation_jobs') return { data: { id: 'job-shadow-e2e', status: 'complete', manuscript_id: 991, manuscript_version_id: 'mv-source' }, error: null };
      if (table === 'manuscript_versions') return { data: { id: 'mv-source', raw_text: `${SOURCE_A}\n\n${UNTOUCHED}\n\n${SOURCE_B}` }, error: null };
      return { data: null, error: null };
    }),
  };
  return query;
}

describe('Unified Revise shadow E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('chains evaluation → queue/admission → candidates → decisions → persistence/reload → revised manuscript', async () => {
    const evaluation = makeEvaluationFixture();

    // 1. Canonical evaluation produces the two revision opportunities used by the journey.
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(evaluation);
    expect(opportunities.length).toBeGreaterThanOrEqual(2);
    const [acceptedOpportunity, customOpportunity] = opportunities.slice(0, 2);
    expect(acceptedOpportunity.evidence_anchor).toBe(SOURCE_A);
    expect(customOpportunity.evidence_anchor).toBe(SOURCE_B);

    // 2. The same A/B/C prose passes candidate quality and workbench structural admission.
    const acceptedOptions = CANDIDATES_A.map((text, index) => ({
      key: ['A', 'B', 'C'][index] as 'A' | 'B' | 'C',
      text,
      anchor: SOURCE_A,
      beforeContext: UNTOUCHED,
    }));
    const candidateQuality = evaluateCardCandidateQuality(acceptedOptions);
    expect(candidateQuality.passed).toBe(true);
    expect(candidateQuality.passedCandidateCount).toBe(3);
    expect(new Set(CANDIDATES_A).size).toBe(3);

    const admission = runWorkbenchAdmissionGate({
      id: acceptedOpportunity.opportunity_id,
      readiness: 'ready_for_revise',
      symptom: acceptedOpportunity.symptom!,
      cause: acceptedOpportunity.cause!,
      fixDirection: acceptedOpportunity.fix_direction!,
      readerEffect: acceptedOpportunity.reader_effect!,
      anchor: acceptedOpportunity.evidence_anchor!,
      groundingStatus: 'supported',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      options: CANDIDATES_A.map((candidateText, index) => ({ key: ['A', 'B', 'C'][index], candidateText })),
    } as any);
    expect(admission.reasons.filter((reason: string) => reason.startsWith('DIAGNOSTIC_'))).toHaveLength(0);
    expect(admission.reasons.filter((reason: string) => /NOT_READY|UNSUPPORTED|PREFLIGHT|CONTEXT_/.test(reason))).toHaveLength(0);

    // 3. One accepted option and one author customization pass the real patch lifecycle.
    const acceptedPatch = buildCandidatePatch({
      reviseQueueItemId: acceptedOpportunity.opportunity_id,
      selectedSource: 'B',
      revisionOperation: 'replace_selected_passage',
      sourceTextSnapshot: SOURCE_A,
      sourceLocation: { chapter_index: 1, paragraph_index: 1 },
      baseManuscriptVersionId: 'mv-source',
      patchText: CANDIDATES_A[1],
    });
    const acceptedPreview = buildPatchPreview(acceptedPatch, '2026-07-14T00:01:00.000Z');
    const acceptedApply = applyPatchFromPreview({
      preview: acceptedPreview,
      decisionStatus: 'accepted_b',
      applicationStatus: 'previewed',
      currentSourceText: SOURCE_A,
      currentSourceTextHash: sha256(SOURCE_A),
      requestedAt: '2026-07-14T00:02:00.000Z',
    });
    expect(acceptedApply.ok).toBe(true);

    const customText = 'Jonah closed the ledger, marked the missing payment with his thumbnail, and left the book open beneath the rain-dark window.';
    const customPatch = buildCustomPatch({
      reviseQueueItemId: customOpportunity.opportunity_id,
      revisionOperation: 'replace_selected_passage',
      sourceTextSnapshot: SOURCE_B,
      sourceLocation: { chapter_index: 1, paragraph_index: 3 },
      baseManuscriptVersionId: 'mv-source',
      customText,
      sourceOption: 'from_scratch',
      createdAt: '2026-07-14T00:03:00.000Z',
    });
    const customPreview = buildPatchPreview(customPatch, '2026-07-14T00:04:00.000Z');
    const customApply = applyPatchFromPreview({
      preview: customPreview,
      decisionStatus: 'custom_written',
      applicationStatus: 'previewed',
      currentSourceText: SOURCE_B,
      currentSourceTextHash: sha256(SOURCE_B),
      requestedAt: '2026-07-14T00:05:00.000Z',
    });
    expect(customApply.ok).toBe(true);

    const acceptedQueueOpportunity = {
      id: acceptedOpportunity.opportunity_id,
      cardType: 'copy_paste_rewrite',
      trustedPathStatus: 'eligible',
      quoteHighlight: SOURCE_A,
      quoteRest: '',
      anchor: 'Chapter 1, paragraph 1',
      sourceUedHash: acceptedOpportunity.source_ued_hash ?? 'shadow-ued-hash',
      sourceOpportunityId: acceptedOpportunity.source_opportunity_id ?? acceptedOpportunity.opportunity_id,
      sourceCriterion: acceptedOpportunity.source_criterion ?? acceptedOpportunity.criterion,
      options: CANDIDATES_A.map((candidateText, index) => ({
        key: ['A', 'B', 'C'][index] as 'A' | 'B' | 'C',
        candidateText,
        text: candidateText,
      })),
    };
    const customQueueOpportunity = {
      id: customOpportunity.opportunity_id,
      cardType: 'copy_paste_rewrite',
      trustedPathStatus: 'eligible',
      quoteHighlight: SOURCE_B,
      quoteRest: '',
      anchor: 'Chapter 1, paragraph 3',
      sourceUedHash: customOpportunity.source_ued_hash ?? 'shadow-ued-hash',
      sourceOpportunityId: customOpportunity.source_opportunity_id ?? customOpportunity.opportunity_id,
      sourceCriterion: customOpportunity.source_criterion ?? customOpportunity.criterion,
      options: CANDIDATES_B.map((candidateText, index) => ({
        key: ['A', 'B', 'C'][index] as 'A' | 'B' | 'C',
        candidateText,
        text: candidateText,
      })),
    };
    const acceptedOpportunityVersion = revisionOpportunityVersion({
      id: acceptedQueueOpportunity.id,
      sourceUedHash: acceptedQueueOpportunity.sourceUedHash,
      sourceOpportunityId: acceptedQueueOpportunity.sourceOpportunityId,
      sourceCriterion: acceptedQueueOpportunity.sourceCriterion,
      sourceExcerpt: SOURCE_A,
      sourceLocation: acceptedQueueOpportunity.anchor,
      cardType: acceptedQueueOpportunity.cardType,
      trustedPathStatus: acceptedQueueOpportunity.trustedPathStatus,
      options: acceptedQueueOpportunity.options,
    });
    const customOpportunityVersion = revisionOpportunityVersion({
      id: customQueueOpportunity.id,
      sourceUedHash: customQueueOpportunity.sourceUedHash,
      sourceOpportunityId: customQueueOpportunity.sourceOpportunityId,
      sourceCriterion: customQueueOpportunity.sourceCriterion,
      sourceExcerpt: SOURCE_B,
      sourceLocation: customQueueOpportunity.anchor,
      cardType: customQueueOpportunity.cardType,
      trustedPathStatus: customQueueOpportunity.trustedPathStatus,
      options: customQueueOpportunity.options,
    });

    const decisions = [
      {
        id: 'decision-accepted-b', opportunity_id: acceptedOpportunity.opportunity_id,
        opportunity_title: acceptedOpportunity.title ?? 'Accepted opportunity', decision: 'accepted_b', selected_option: 'B',
        custom_text: null, selected_text: CANDIDATES_A[1], source_excerpt: SOURCE_A, source_location: 'Chapter 1, paragraph 1',
        metadata: {
          source: 'author_choice',
          sourceUedHash: acceptedQueueOpportunity.sourceUedHash,
          sourceOpportunityId: acceptedQueueOpportunity.sourceOpportunityId,
          sourceCriterion: acceptedQueueOpportunity.sourceCriterion,
          opportunityVersion: acceptedOpportunityVersion,
          candidateSlot: 'B',
          candidateHash: revisionCandidateHash({
            opportunityId: acceptedQueueOpportunity.id,
            candidateSlot: 'B',
            candidateText: CANDIDATES_A[1],
            sourceUedHash: acceptedQueueOpportunity.sourceUedHash,
            sourceOpportunityId: acceptedQueueOpportunity.sourceOpportunityId,
            sourceCriterion: acceptedQueueOpportunity.sourceCriterion,
          }),
        }, created_at: '2026-07-14T00:06:00.000Z',
      },
      {
        id: 'decision-custom', opportunity_id: customOpportunity.opportunity_id,
        opportunity_title: customOpportunity.title ?? 'Custom opportunity', decision: 'custom', selected_option: null,
        custom_text: customText, selected_text: null, source_excerpt: SOURCE_B, source_location: 'Chapter 1, paragraph 3',
        metadata: {
          source: 'author_choice',
          sourceUedHash: customQueueOpportunity.sourceUedHash,
          sourceOpportunityId: customQueueOpportunity.sourceOpportunityId,
          sourceCriterion: customQueueOpportunity.sourceCriterion,
          opportunityVersion: customOpportunityVersion,
        }, created_at: '2026-07-14T00:07:00.000Z',
      },
    ];

    // 4. Exercise the production Final Review authority with controlled transport.
    const sourceManuscript = `${SOURCE_A}\n\n${UNTOUCHED}\n\n${SOURCE_B}`;
    let persistedVersionId: string | null = null;
    let persistedFingerprint: string | null = null;
    let persistedText: string | null = null;
    const rpc = jest.fn(async (_name: string, args: any) => {
      const reused = persistedFingerprint === args.p_apply_fingerprint;
      if (!persistedVersionId) persistedVersionId = 'mv-revised-shadow';
      persistedFingerprint = args.p_apply_fingerprint;
      persistedText = args.p_raw_text;
      return { data: [{ revised_version_id: persistedVersionId, reused_existing_version: reused }], error: null };
    });
    const supabase = { from: jest.fn((table: string) => makeQuery(table, decisions)), rpc };

    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-shadow-e2e', email: 'author@example.com' });
    mockCreateAdminClient.mockReturnValue(supabase);
    mockResolveFinalReviewSourceText.mockResolvedValue(sourceManuscript);
    mockUpsertEvaluationArtifact.mockResolvedValue('artifact-completion-shadow');
    mockGetWorkbenchQueue.mockResolvedValue({
      ok: true,
      opportunities: [acceptedQueueOpportunity, customQueueOpportunity],
      needsTargeting: [],
      withheldUnsupported: [],
    });

    const first = await applyFinalReviewDecisions({ manuscriptId: 991, evaluationJobId: 'job-shadow-e2e' });
    expect(first).toEqual(expect.objectContaining({ ok: true, revisedVersionId: 'mv-revised-shadow', appliedCount: 2, reusedExistingVersion: false }));
    expect(persistedText).toContain(CANDIDATES_A[1]);
    expect(persistedText).toContain(customText);
    expect(persistedText).toContain(UNTOUCHED);
    expect(persistedText).not.toContain(SOURCE_A);
    expect(persistedText).not.toContain(SOURCE_B);
    expect(persistedText).not.toContain(CANDIDATES_A[0]);
    expect(persistedText).not.toContain(CANDIDATES_A[2]);

    // 5. A complete reload re-reads the persisted decisions and reuses the same version idempotently.
    const second = await applyFinalReviewDecisions({ manuscriptId: 991, evaluationJobId: 'job-shadow-e2e' });
    expect(second).toEqual(expect.objectContaining({ ok: true, revisedVersionId: 'mv-revised-shadow', appliedCount: 2, reusedExistingVersion: true }));
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1].p_apply_fingerprint).toBe(rpc.mock.calls[1][1].p_apply_fingerprint);
    expect(rpc.mock.calls[1][1].p_applied_decision_ids).toEqual(['decision-accepted-b', 'decision-custom']);

    // Final Review consumes the same queue identities and persisted decision snapshots; it never regenerates replacements.
    expect(mockGetWorkbenchQueue).toHaveBeenCalledTimes(2);
    expect(mockUpsertEvaluationArtifact).toHaveBeenCalledTimes(2);
  });
});
