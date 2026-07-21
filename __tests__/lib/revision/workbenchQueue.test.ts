import { getWorkbenchQueue, __testing } from '@/lib/revision/workbenchQueue';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { ensureRevisionOpportunityLedgerArtifact } from '@/lib/revision/opportunityLedger';
import { loadReviseQueueWarmupCorpus } from '@/lib/revision/reviseQueueWarmup';
import { getAuthorExposureDecision } from '@/lib/evaluation/authorExposureCertification';
import type { DiagnosticFinding } from '@/lib/revision/types';

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/revision/opportunityLedger', () => ({
  ensureRevisionOpportunityLedgerArtifact: jest.fn(),
}));

jest.mock('@/lib/revision/reviseQueueWarmup', () => ({
  loadReviseQueueWarmupCorpus: jest.fn(),
}));

jest.mock('@/lib/evaluation/authorExposureCertification', () => ({
  getAuthorExposureDecision: jest.fn(async () => ({ exposable: true, certifiedAt: null })),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockEnsureLedger = ensureRevisionOpportunityLedgerArtifact as jest.MockedFunction<typeof ensureRevisionOpportunityLedgerArtifact>;
const mockLoadReviseQueueWarmupCorpus = loadReviseQueueWarmupCorpus as jest.MockedFunction<typeof loadReviseQueueWarmupCorpus>;
const mockGetAuthorExposureDecision = getAuthorExposureDecision as jest.MockedFunction<typeof getAuthorExposureDecision>;

function buildSupabaseMock(jobId: string, manuscriptVersionId: string, options: {
  jobStatus?: string;
  policyFamily?: string;
  voicePreservationLevel?: string;
  evaluationArtifactContent?: unknown;
} = {}) {
  const manuscriptMaybeSingle = jest.fn(async () => ({
    data: {
      id: 6074,
      title: 'Cartel Babies',
      user_id: 'user-1',
    },
    error: null,
  }));

  const manuscriptEqUser = jest.fn(() => ({
    maybeSingle: manuscriptMaybeSingle,
  }));

  const manuscriptEqId = jest.fn(() => ({
    eq: manuscriptEqUser,
  }));

  const manuscriptSelect = jest.fn(() => ({
    eq: manuscriptEqId,
  }));

  const jobMaybeSingle = jest.fn(async () => ({
    data: {
      id: jobId,
      status: options.jobStatus ?? 'complete',
      manuscript_id: 6074,
      manuscript_version_id: manuscriptVersionId,
      policy_family: options.policyFamily ?? 'standard',
      voice_preservation_level: options.voicePreservationLevel ?? 'balanced',
    },
    error: null,
  }));

  const jobEqManuscriptId = jest.fn(() => ({
    maybeSingle: jobMaybeSingle,
  }));

  const jobEqId = jest.fn(() => ({
    eq: jobEqManuscriptId,
  }));

  const jobSelect = jest.fn(() => ({
    eq: jobEqId,
  }));

  const evaluationArtifactsMaybeSingle = jest.fn(async () => ({
    data: options.evaluationArtifactContent ? { content: options.evaluationArtifactContent } : null,
    error: null,
  }));

  const evaluationArtifactsLimit = jest.fn(() => ({
    maybeSingle: evaluationArtifactsMaybeSingle,
  }));

  const evaluationArtifactsOrder = jest.fn(() => ({
    limit: evaluationArtifactsLimit,
  }));

  const evaluationArtifactsIn = jest.fn(() => ({
    order: evaluationArtifactsOrder,
  }));

  const evaluationArtifactsEq = jest.fn(() => ({
    in: evaluationArtifactsIn,
  }));

  const evaluationArtifactsSelect = jest.fn(() => ({
    eq: evaluationArtifactsEq,
  }));

  return {
    from: jest.fn((table: string) => {
      if (table === 'manuscripts') {
        return { select: manuscriptSelect };
      }

      if (table === 'evaluation_jobs') {
        return { select: jobSelect };
      }

      if (table === 'evaluation_artifacts') {
        return { select: evaluationArtifactsSelect };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function makeLedgerOpportunity(overrides: Record<string, unknown> = {}) {
  return {
    opportunity_id: 'opp-full-diag',
    criterion: 'NARRATIVE_DRIVE',
    severity: 'must',
    confidence: 'high',
    manuscript_coordinates: 'passage:15',
    evidence_anchor: 'She set the letter down and said nothing for a long time.',
    rationale: 'The quoted passage resolves the revelation as summary instead of action.',
    symptom: 'In the quoted passage “She set the letter down and said nothing for a long time,” the revelation resolves as summary instead of action.',
    cause: 'This occurs when the narrator summarizes Mara’s reaction rather than rendering the physical consequence beat by beat.',
    fix_direction: 'Replace the quoted passage “She set the letter down and said nothing for a long time” so Mara chooses a visible physical response before the narration names the emotion.',
    reader_effect: 'This lets readers track Mara’s decision through embodied action, so the revelation keeps narrative momentum instead of flattening into summary.',
    mistake_proofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
    candidate_text_a: 'She set the letter down and did not look at it again. Her hands moved to the edge of the table and stayed there.',
    candidate_text_b: 'After placing the letter flat on the table, Mara reached for her coat before either of them could ask what had changed.',
    candidate_text_c: 'The letter lay face down near the lamp while Mara kept both hands on the table and refused to pick it up.',
    revision_operation: 'replace_selected_passage',
    provenance: 'evaluation_result_v2',
    grounding_status: 'supported',
    preflight_status: 'passed',
    context_quality: 'clean',
    ...overrides,
  };
}

function makeDuplicateTrapOpportunity(opportunityId: string) {
  return {
    opportunity_id: opportunityId,
    get criterion() {
      throw new Error('classifier should not read criterion after duplicate ledger id detection');
    },
    get evidence_anchor() {
      throw new Error('classifier should not read evidence after duplicate ledger id detection');
    },
    get candidate_text_a() {
      throw new Error('classifier should not read candidates after duplicate ledger id detection');
    },
  };
}

describe('getWorkbenchQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1' } as never);
    mockGetAuthorExposureDecision.mockResolvedValue({ exposable: true, certifiedAt: null });
    mockLoadReviseQueueWarmupCorpus.mockResolvedValue({
      loadedAt: new Date().toISOString(),
      files: {} as never,
      combinedText: 'warmup',
      proof: {
        combinedSha256: 'abc123',
        combinedBytes: 42,
        fileCount: 10,
        benchmarkCount: 3,
        benchmarkFilesLoaded: [
          'docs/benchmarks/froggin-noggin-dream-longform-multilayer-gold-standard.md',
          'docs/benchmarks/let-the-river-decide-dream-longform-multilayer-gold-standard.md',
          'docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md',
        ],
        perFile: {} as never,
      },
    });
  });

  it('keeps separate stable queues for two completed evaluations on the same manuscript', async () => {
    const supabaseOne = buildSupabaseMock('job-1', 'version-1');
    const supabaseTwo = buildSupabaseMock('job-2', 'version-2');

    mockCreateAdminClient
      .mockReturnValueOnce(supabaseOne as never)
      .mockReturnValueOnce(supabaseTwo as never);

    mockEnsureLedger
      .mockResolvedValueOnce({ artifactId: 'ledger-1', opportunities: [] as never })
      .mockResolvedValueOnce({ artifactId: 'ledger-2', opportunities: [] as never });

    const first = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-1' });
    const second = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-2' });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.evaluationJobId).toBe('job-1');
    expect(second.evaluationJobId).toBe('job-2');
    expect(first.revisionPackage?.revision_package_id).toBe('revision_package:job-1:version-1');
    expect(second.revisionPackage?.revision_package_id).toBe('revision_package:job-2:version-2');
    expect(first.revisionPackage?.revision_opportunity_ledger_artifact_id).toBe('ledger-1');
    expect(second.revisionPackage?.revision_opportunity_ledger_artifact_id).toBe('ledger-2');
    expect(first.goLiveProof?.phase0Warmup.status).toBe('loaded');
    expect(first.goLiveProof?.phase0Warmup.warning).toBeNull();
    expect(first.goLiveProof?.phase0Warmup.fileCount).toBe(10);
    expect(first.goLiveProof?.phase0Warmup.corpusSha256).toBe('abc123');
    expect(first.goLiveProof?.contractEnforcement.candidateTextOnly).toBe(true);
    expect(first.goLiveProof?.contractEnforcement.sixPartDiagnosticRequired).toBe(true);
    expect(mockLoadReviseQueueWarmupCorpus).toHaveBeenCalledTimes(2);
  });

  it('returns an explicit error when revision ids are missing', async () => {
    const supabase = buildSupabaseMock('job-1', 'version-1');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    const result = await getWorkbenchQueue({});

    expect(result.ok).toBe(false);
    expect(result.error).toContain('saved revision package');
    expect(mockEnsureLedger).not.toHaveBeenCalled();
  });

  it('kicks back incomplete upstream evaluations instead of fabricating a Revise queue', async () => {
    const supabase = buildSupabaseMock('job-running', 'version-running', {
      jobStatus: 'running',
    });
    mockCreateAdminClient.mockReturnValue(supabase as never);

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-running' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('This evaluation is not complete yet. Revise can load after the report is finished.');
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(0);
    expect(mockEnsureLedger).not.toHaveBeenCalled();
  });

  it('fails closed when author exposure certification is not certified', async () => {
    mockGetAuthorExposureDecision.mockResolvedValue({
      exposable: false,
      reason: 'decision_not_certified',
    });

    const supabase = buildSupabaseMock('job-author-blocked', 'version-author-blocked');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-author-blocked' });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('author_exposure:decision_not_certified');
    expect(mockEnsureLedger).not.toHaveBeenCalled();
  });

  it('surfaces author exposure DB errors as system errors without rendering queue data', async () => {
    mockGetAuthorExposureDecision.mockResolvedValue({
      exposable: false,
      reason: 'db_error',
      details: 'connection refused',
    });

    const supabase = buildSupabaseMock('job-author-db-error', 'version-author-db-error');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-author-db-error' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('System error checking author exposure certification. Please try again shortly.');
    expect(result.opportunities).toHaveLength(0);
    expect(mockEnsureLedger).not.toHaveBeenCalled();
  });

  it('routes missing candidate prose to needs targeting instead of falling back to rationale', async () => {
    const supabase = buildSupabaseMock('job-3', 'version-3');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-3',
      opportunities: [
        {
          opportunity_id: 'opp-1',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'must',
          confidence: '0.92',
          manuscript_coordinates: 'passage:42',
          evidence_anchor: 'Benjamin stood at the chapel door and did not enter.',
          rationale: 'Apply the same repair goal with a lighter touch.',
          symptom: 'The beat transition is abrupt.',
          cause: 'The scene skips connective prose.',
          fix_direction: 'Insert a connective bridge beat.',
          reader_effect: 'Readers lose continuity.',
          mistake_proofing: 'Do not introduce new plot facts.',
          candidate_text_a: 'Benjamin paused at the chapel threshold, letting the hymn settle before he stepped inside.',
          candidate_text_b: '',
          candidate_text_c: '',
          revision_operation: 'insert_after_selected_passage',
          provenance: 'evaluation_result_v2',
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-3' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(1);
    expect(result.needsTargeting[0].readiness).toBe('needs_targeting');
    expect(result.needsTargeting[0].readinessReason).toContain('Candidate B is not copy-paste ready');
    expect(result.needsTargeting[0].options[1].text).toBe('');
  });

  it('routes internal-token evidence anchors to needs targeting and strips leaked evidence text', async () => {
    const supabase = buildSupabaseMock('job-4', 'version-4');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-4',
      opportunities: [
        {
          opportunity_id: 'opp-token-evidence',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'should',
          confidence: '0.88',
          manuscript_coordinates: 'passage:9',
          evidence_anchor: 'NARRATIVEDRIVE:recommendation',
          rationale: 'Expand Newton’s immediate response into a full beat.',
          symptom: 'The beat transition is abrupt.',
          cause: 'The scene skips connective prose.',
          fix_direction: 'Insert a connective bridge beat.',
          reader_effect: 'Readers lose continuity.',
          mistake_proofing: 'Do not introduce new plot facts.',
          candidate_text_a: 'Move aside, Small Fry, Twillow answers in motion, and the consequence lands without a pause for explanation.',
          candidate_text_b: 'Move aside, Small Fry, a physical beat carries the turn, so pressure stays visible and the scene keeps forward momentum.',
          candidate_text_c: 'Move aside, Small Fry, making Newton’s decision and its fallout concrete will sharpen stakes and give readers a clear causal engine.',
          revision_operation: 'replace_selected_passage',
          provenance: 'evaluation_result_v2',
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-4' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(1);
    expect(result.needsTargeting[0].quoteHighlight).toBe('No excerpt available');
    expect(result.needsTargeting[0].readiness).toBe('needs_targeting');
  });

  it('surfaces hydration failure reasons separately from RES blockers for admin triage', async () => {
    const supabase = buildSupabaseMock('job-hydration-split', 'version-hydration-split');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-hydration-split',
      opportunities: [
        {
          opportunity_id: 'opp-hydration-split',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'should',
          confidence: 'medium',
          manuscript_coordinates: 'NARRATIVEDRIVE:recommendation',
          evidence_anchor: 'Studies are mixed on the success of safe injection sites.',
          rationale: 'Insert one concrete stakes beat that lands the deferred decision at the current scene turn.',
          symptom: 'The transition is abrupt.',
          cause: 'The scene skips connective prose.',
          fix_direction: 'Insert a bridge beat with explicit consequence.',
          reader_effect: 'Readers lose momentum at the scene turn.',
          mistake_proofing: 'Do not invent new events.',
          candidate_text_a: '',
          candidate_text_b: '',
          candidate_text_c: '',
          revision_operation: 'insert_after_selected_passage',
          provenance: 'evaluation_result.criteria.recommendations',
          preflight_status: 'blocked',
          preflight_reasons: ['hydration_context_not_found', 'hydration_placeholder_coordinates', 'insufficient_anchor_grounding'],
          preflight_note: 'Needs hydration repair: anchor/context not recoverable.',
          admin_actions: ['Regenerate from source manuscript context'],
          grounding_status: 'unsupported_blocked',
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-hydration-split' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(1);
    const blocked = result.needsTargeting[0];
    expect(blocked.readinessReason).toBe('Needs hydration repair');
    expect(blocked.hydrationFailureReasons).toEqual(['hydration_context_not_found', 'hydration_placeholder_coordinates']);
    expect(blocked.resBlockerReasons).toEqual(['insufficient_anchor_grounding']);
    expect(blocked.adminRepairLabel).toBe('Needs hydration repair');
    expect(blocked.adminRepairReason).toBe('anchor/context not recoverable');
    expect(blocked.adminActions).toContain('Regenerate from source manuscript context');
  });

  it('preserves natural-language chapter-scale coordinates as Chapter cards instead of passage cards', async () => {
    const supabase = buildSupabaseMock('job-structural', 'version-structural');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-structural',
      opportunities: [
        {
          opportunity_id: 'opp-chapter-scale',
          criterion: 'STRUCTURE',
          severity: 'must',
          confidence: 'high',
          manuscript_coordinates: 'Chapter 12 — midpoint reversal',
          evidence_anchor: 'The midpoint reversal changes the bargain before Mara has chosen what it costs.',
          rationale: 'The chapter-scale reversal needs exact targeting before prose can be accepted.',
          symptom: 'The chapter-scale reversal is under-targeted.',
          cause: 'The issue spans multiple beats rather than one local passage.',
          fix_direction: 'Target the exact chapter beats before drafting A/B/C prose.',
          reader_effect: 'Readers need the structural turn to preserve cause and effect.',
          mistake_proofing: 'Do not solve a chapter-scale issue with a passage-level rewrite.',
          candidate_text_a: '',
          candidate_text_b: '',
          candidate_text_c: '',
          revision_operation: 'needs_targeting',
          provenance: 'evaluation_result_v2',
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-structural' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(1);
    expect(result.needsTargeting[0].scope).toBe('Chapter');
    expect(result.needsTargeting[0].mode).toBe('repair-brief');
    expect(result.needsTargeting[0].readiness).toBe('needs_targeting');
  });

  it('withholds ready-looking cards when preflight status is missing (fail-closed admission)', async () => {
    const supabase = buildSupabaseMock('job-missing-preflight', 'version-missing-preflight');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-missing-preflight',
      opportunities: [
        {
          opportunity_id: 'opp-missing-preflight',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'must',
          confidence: 'high',
          manuscript_coordinates: 'passage:12',
          evidence_anchor: 'He stopped at the threshold and let the room settle before answering.',
          rationale: 'Bridge the transition with one concrete beat that carries immediate consequence.',
          symptom: 'Transition lands abruptly.',
          cause: 'Connective bridge beat is missing.',
          fix_direction: 'Insert one bridge beat that preserves continuity.',
          reader_effect: 'Readers can follow cause-and-effect without losing momentum.',
          mistake_proofing: 'Do not add new events or alter intent.',
          candidate_text_a: 'He paused at the threshold, letting the room settle before he answered.',
          candidate_text_b: 'At the doorway, he measured the silence, then answered without forcing the beat.',
          candidate_text_c: 'He held one breath at the threshold and answered only when the silence could carry it.',
          revision_operation: 'insert_after_selected_passage',
          provenance: 'evaluation_result_v2',
          grounding_status: 'supported',
          // intentionally no preflight_status
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-missing-preflight' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.withheldUnsupported).toHaveLength(1);
    expect(result.readinessTotals.ready_for_revise).toBe(0);
    expect(result.readinessTotals.withheld_unsupported).toBe(1);
  });

  it('excludes candidate-quality-failed cards from user queue even when ledger marks them ready', async () => {
    const supabase = buildSupabaseMock('job-quality-failed', 'version-quality-failed');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-quality-failed',
      opportunities: [
        {
          opportunity_id: 'opp-quality-failed',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'must',
          confidence: 'high',
          manuscript_coordinates: 'passage:12',
          evidence_anchor: 'He stopped at the threshold and let the room settle before answering.',
          rationale: 'Bridge the transition with one concrete beat that carries immediate consequence.',
          symptom: 'Transition lands abruptly.',
          cause: 'Connective bridge beat is missing.',
          fix_direction: 'Insert one bridge beat that preserves continuity.',
          reader_effect: 'Readers can follow cause-and-effect without losing momentum.',
          mistake_proofing: 'Do not add new events or alter intent.',
          candidate_text_a: 'He paused at the threshold, letting the room settle before he answered.',
          candidate_text_b: 'At the doorway, he measured the silence, then answered without forcing the beat.',
          candidate_text_c: 'He looked away first, and that was enough for the moment to claim its price.',
          revision_operation: 'insert_after_selected_passage',
          provenance: 'evaluation_result_v2',
          grounding_status: 'supported',
          preflight_status: 'passed',
          context_quality: 'clean',
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-quality-failed' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.withheldUnsupported).toHaveLength(1);
    const renderedText = JSON.stringify(result.opportunities);
    expect(renderedText).not.toMatch(/looked away first|moment to claim its price|moment tightened|keep the air still|pressure of the moment/i);
  });

  it('carries confirmed evaluation mode and voice preservation into the Revise queue contract', async () => {
    const supabase = buildSupabaseMock('job-mode', 'version-mode', {
      policyFamily: 'standard',
      voicePreservationLevel: 'balanced',
      evaluationArtifactContent: {
        confirmed_mode: {
          evaluationMode: 'TESTIMONY',
          voicePreservationMode: 'MAXIMUM',
        },
      },
    });
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({ artifactId: 'ledger-mode', opportunities: [] as never });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-mode' });

    expect(result.ok).toBe(true);
    expect(result.modeContract).toMatchObject({
      evaluation_mode: 'TESTIMONY',
      voice_preservation: 'MAXIMUM',
      source: 'evaluation_result_v2.confirmed_mode',
      policy_family: 'standard',
      voice_preservation_level: 'balanced',
    });
  });

  it('withholds ledger rows with empty required diagnostics instead of padding canned fallbacks (withhold path)', async () => {
    // A ledger row with real evidence, valid candidates, and preflight passed — but
    // empty cause, reader_effect, and mistake_proofing. Without fabricated fallbacks,
    // validateReviseCardContract must fire DIAGNOSTIC_MISSING_CAUSE and withhold the card.
    const supabase = buildSupabaseMock('job-empty-diag', 'version-empty-diag');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-empty-diag',
      opportunities: [
        {
          opportunity_id: 'opp-empty-diag',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'must',
          confidence: 'high',
          manuscript_coordinates: 'passage:7',
          evidence_anchor: 'He crossed the threshold without looking back at her.',
          rationale: 'The beat transition needs a connective bridge.',
          symptom: 'The beat transition lands abruptly without connective tissue.',
          cause: '',           // intentionally empty — must NOT be padded
          fix_direction: 'Insert a single bridging beat that carries the consequence forward.',
          reader_effect: '',   // intentionally empty — must NOT be padded
          mistake_proofing: '', // intentionally empty — must NOT be padded
          candidate_text_a: 'He crossed the threshold, the door clicking shut behind him before she could speak.',
          candidate_text_b: 'He stepped through without pausing, leaving her with the weight of the unsaid.',
          candidate_text_c: 'The threshold passed, and with it the last moment she might have stopped him.',
          revision_operation: 'replace_selected_passage',
          provenance: 'evaluation_result_v2',
          grounding_status: 'supported',
          preflight_status: 'passed',
          context_quality: 'clean',
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-empty-diag' });

    expect(result.ok).toBe(true);
    // Empty required diagnostics must withhold the card — never emit it to opportunities.
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting.length + result.withheldUnsupported.length).toBeGreaterThan(0);
    expect(result.readinessTotals.ready_for_revise).toBe(0);
    // Confirm no canned fallback phrases leaked into any queue bucket.
    const allText = JSON.stringify([...result.needsTargeting, ...result.withheldUnsupported]);
    expect(allText).not.toMatch(/craft clarity or momentum weakens/i);
    expect(allText).not.toMatch(/repairing this can improve reader trust/i);
    expect(allText).not.toMatch(/preserve author intent/i);
  });

  it('admits ledger rows with complete real diagnostics to the live queue (admit path)', async () => {
    // All six diagnostic fields populated with evidence-backed prose, three
    // distinct candidates, grounding supported, preflight passed. The card
    // must reach opportunities — not be held back by the contract gate.
    const supabase = buildSupabaseMock('job-full-diag', 'version-full-diag');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-full-diag',
      opportunities: [
        {
          opportunity_id: 'opp-full-diag',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'must',
          confidence: 'high',
          manuscript_coordinates: 'passage:15',
          evidence_anchor: 'She set the letter down and said nothing for a long time.',
          rationale: 'The quoted passage resolves the revelation as summary instead of action.',
          symptom: 'In the quoted passage “She set the letter down and said nothing for a long time,” the revelation resolves as summary instead of action.',
          cause: 'This occurs when the narrator summarizes Mara’s reaction rather than rendering the physical consequence beat by beat.',
          fix_direction: 'Replace the quoted passage “She set the letter down and said nothing for a long time” so Mara chooses a visible physical response before the narration names the emotion.',
          reader_effect: 'This lets readers track Mara’s decision through embodied action, so the revelation keeps narrative momentum instead of flattening into summary.',
          mistake_proofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
          candidate_text_a: 'She set the letter down and did not look at it again. Her hands moved to the edge of the table and stayed there.',
          candidate_text_b: 'After placing the letter flat on the table, Mara reached for her coat before either of them could ask what had changed.',
          candidate_text_c: 'The letter lay face down near the lamp while Mara kept both hands on the table and refused to pick it up.',
          revision_operation: 'replace_selected_passage',
          provenance: 'evaluation_result_v2',
          grounding_status: 'supported',
          preflight_status: 'passed',
          context_quality: 'clean',
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-full-diag' });

    expect(result.ok).toBe(true);
    // Complete evidence-backed diagnostics must be admitted.
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].id).toBe('opp-full-diag');
    expect(result.readinessTotals.ready_for_revise).toBe(1);
    expect(result.readinessTotals.needs_targeting).toBe(0);
    expect(result.readinessTotals.withheld_unsupported).toBe(0);
    // The real cause must be present — no canned fallback substituted.
    const card = result.opportunities[0];
    expect(card.cause).toContain('summarizes Mara’s reaction');
    expect(card.readerEffect).toContain('readers track Mara’s decision');
    expect(card.mistakeProofing).toContain('Do not introduce new information');
  });

  it('conserves ledger rows through classification and exactly one payload bucket per opportunity', async () => {
    const supabase = buildSupabaseMock('job-conservation', 'version-conservation');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-conservation',
      opportunities: [
        makeLedgerOpportunity({ opportunity_id: 'ledger-copy' }),
        makeLedgerOpportunity({
          opportunity_id: 'ledger-strategy',
          preflight_status: 'limited_context',
          context_quality: 'limited',
          preflight_reasons: ['limited_context_due_to_degraded_canon'],
        }),
        makeLedgerOpportunity({
          opportunity_id: 'ledger-held',
          preflight_status: 'limited_context',
          context_quality: 'limited',
          preflight_reasons: ['canon_conflict'],
        }),
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-conservation' });

    expect(result.ok).toBe(true);
    expect(result.opportunities.map((item) => item.id)).toEqual(['ledger-copy']);
    expect(result.needsTargeting.map((item) => item.id)).toEqual(['ledger-strategy']);
    expect(result.withheldUnsupported.map((item) => item.id)).toEqual(['ledger-held']);

    const payloadItems = [
      ...result.opportunities,
      ...result.needsTargeting,
      ...result.withheldUnsupported,
    ];
    const ledgerIds = ['ledger-copy', 'ledger-strategy', 'ledger-held'];

    expect(payloadItems).toHaveLength(ledgerIds.length);
    expect(new Set(payloadItems.map((item) => item.id))).toEqual(new Set(ledgerIds));
    for (const ledgerId of ledgerIds) {
      expect(payloadItems.filter((item) => item.id === ledgerId)).toHaveLength(1);
    }

    for (const item of payloadItems) {
      expect(item.classification).toBeDefined();
      expect(item.baseDecision).toBeDefined();
      expect(item.finalDecision).toBeDefined();
      expect(item.cardType).toBe(item.finalDecision.cardType);
      expect(item.trustedPathStatus).toBe(item.finalDecision.trustedPathStatus);
    }

    expect(result.opportunities.every((item) => item.finalDecision.cardType === 'copy_paste_rewrite')).toBe(true);
    expect(result.needsTargeting.every((item) => item.finalDecision.cardType === 'revision_strategy')).toBe(true);
    expect(result.withheldUnsupported.every((item) => item.finalDecision.cardType === 'withheld')).toBe(true);
  });

  it('fails closed when the persisted ledger contains duplicate opportunity IDs', async () => {
    const supabase = buildSupabaseMock('job-duplicate-ledger', 'version-duplicate-ledger');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-duplicate',
      opportunities: [
        makeDuplicateTrapOpportunity('duplicate-opportunity'),
        makeDuplicateTrapOpportunity('duplicate-opportunity'),
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-duplicate-ledger' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Revision opportunity ledger contains duplicate opportunity id: duplicate-opportunity.');
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(0);
    expect(result.withheldUnsupported).toHaveLength(0);
  });

  it('routes limited_context with supported grounding to needsTargeting as revision_strategy', async () => {
    const supabase = buildSupabaseMock('job-limited', 'version-limited');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-limited',
      opportunities: [
        {
          opportunity_id: 'opp-limited',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'must',
          confidence: 'high',
          manuscript_coordinates: 'passage:15',
          evidence_anchor: 'She set the letter down and said nothing for a long time.',
          rationale: 'The quoted passage resolves the revelation as summary instead of action.',
          symptom: 'In the quoted passage “She set the letter down and said nothing for a long time,” the revelation resolves as summary instead of action.',
          cause: 'This occurs when the narrator summarizes Mara’s reaction rather than rendering the physical consequence beat by beat.',
          fix_direction: 'Replace the quoted passage “She set the letter down and said nothing for a long time” so Mara chooses a visible physical response before the narration names the emotion.',
          reader_effect: 'This lets readers track Mara’s decision through embodied action, so the revelation keeps narrative momentum instead of flattening into summary.',
          mistake_proofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
          candidate_text_a: 'She set the letter down and did not look at it again. Her hands moved to the edge of the table and stayed there.',
          candidate_text_b: 'After placing the letter flat on the table, Mara reached for her coat before either of them could ask what had changed.',
          candidate_text_c: 'The letter lay face down near the lamp while Mara kept both hands on the table and refused to pick it up.',
          revision_operation: 'replace_selected_passage',
          provenance: 'evaluation_result_v2',
          grounding_status: 'supported',
          preflight_status: 'limited_context',
          context_quality: 'limited',
          preflight_reasons: ['limited_context_due_to_degraded_canon'],
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-limited' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.withheldUnsupported).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(1);
    const card = result.needsTargeting[0];
    expect(card.id).toBe('opp-limited');
    expect(card.cardType).toBe('revision_strategy');
    expect(card.trustedPathStatus).toBe('unavailable_author_review_required');
    expect(card.contextQuality).toBe('limited');
    expect(card.preflightStatus).toBe('limited_context');
    expect(card.readiness).toBe('ready_for_revise');
    expect(card.executabilityReasons).toEqual(
      expect.arrayContaining(['insufficient_before_after_context']),
    );
  });

  it('withholds limited_context cards that have a real canon conflict', async () => {
    const supabase = buildSupabaseMock('job-limited-canon', 'version-limited-canon');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-limited-canon',
      opportunities: [
        {
          opportunity_id: 'opp-limited-canon',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'must',
          confidence: 'high',
          manuscript_coordinates: 'passage:15',
          evidence_anchor: 'She set the letter down and said nothing for a long time.',
          rationale: 'The quoted passage resolves the revelation as summary instead of action.',
          symptom: 'In the quoted passage “She set the letter down and said nothing for a long time,” the revelation resolves as summary instead of action.',
          cause: 'This occurs when the narrator summarizes Mara’s reaction rather than rendering the physical consequence beat by beat.',
          fix_direction: 'Replace the quoted passage “She set the letter down and said nothing for a long time” so Mara chooses a visible physical response before the narration names the emotion.',
          reader_effect: 'This lets readers track Mara’s decision through embodied action, so the revelation keeps narrative momentum instead of flattening into summary.',
          mistake_proofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
          candidate_text_a: 'She set the letter down and did not look at it again. Her hands moved to the edge of the table and stayed there.',
          candidate_text_b: 'After placing the letter flat on the table, Mara reached for her coat before either of them could ask what had changed.',
          candidate_text_c: 'The letter lay face down near the lamp while Mara kept both hands on the table and refused to pick it up.',
          revision_operation: 'replace_selected_passage',
          provenance: 'evaluation_result_v2',
          grounding_status: 'supported',
          preflight_status: 'limited_context',
          context_quality: 'limited',
          preflight_reasons: ['canon_conflict'],
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-limited-canon' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(0);
    expect(result.withheldUnsupported).toHaveLength(1);
    const card = result.withheldUnsupported[0];
    expect(card.cardType).toBe('withheld');
    expect(card.trustedPathStatus).toBe('impossible');
    expect(card.executabilityReasons).toEqual(expect.arrayContaining(['canon_unclear']));
  });

  it('withholds blocked context regardless of preflight reason', async () => {
    const supabase = buildSupabaseMock('job-blocked', 'version-blocked');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-blocked',
      opportunities: [
        {
          opportunity_id: 'opp-blocked',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'must',
          confidence: 'high',
          manuscript_coordinates: 'passage:15',
          evidence_anchor: 'She set the letter down and said nothing for a long time.',
          rationale: 'The quoted passage resolves the revelation as summary instead of action.',
          symptom: 'In the quoted passage “She set the letter down and said nothing for a long time,” the revelation resolves as summary instead of action.',
          cause: 'This occurs when the narrator summarizes Mara’s reaction rather than rendering the physical consequence beat by beat.',
          fix_direction: 'Replace the quoted passage “She set the letter down and said nothing for a long time” so Mara chooses a visible physical response before the narration names the emotion.',
          reader_effect: 'This lets readers track Mara’s decision through embodied action, so the revelation keeps narrative momentum instead of flattening into summary.',
          mistake_proofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
          candidate_text_a: 'She set the letter down and did not look at it again. Her hands moved to the edge of the table and stayed there.',
          candidate_text_b: 'After placing the letter flat on the table, Mara reached for her coat before either of them could ask what had changed.',
          candidate_text_c: 'The letter lay face down near the lamp while Mara kept both hands on the table and refused to pick it up.',
          revision_operation: 'replace_selected_passage',
          provenance: 'evaluation_result_v2',
          grounding_status: 'supported',
          preflight_status: 'blocked',
          context_quality: 'blocked',
          preflight_reasons: ['insufficient_context'],
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-blocked' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(0);
    expect(result.withheldUnsupported).toHaveLength(1);
    expect(result.withheldUnsupported[0].cardType).toBe('withheld');
  });

  it('withholds limited context when grounding is unsupported', async () => {
    const supabase = buildSupabaseMock('job-limited-unsupported', 'version-limited-unsupported');
    mockCreateAdminClient.mockReturnValue(supabase as never);

    mockEnsureLedger.mockResolvedValueOnce({
      artifactId: 'ledger-limited-unsupported',
      opportunities: [
        {
          opportunity_id: 'opp-limited-unsupported',
          criterion: 'NARRATIVE_DRIVE',
          severity: 'must',
          confidence: 'high',
          manuscript_coordinates: 'passage:15',
          evidence_anchor: 'She set the letter down and said nothing for a long time.',
          rationale: 'The quoted passage resolves the revelation as summary instead of action.',
          symptom: 'In the quoted passage “She set the letter down and said nothing for a long time,” the revelation resolves as summary instead of action.',
          cause: 'This occurs when the narrator summarizes Mara’s reaction rather than rendering the physical consequence beat by beat.',
          fix_direction: 'Replace the quoted passage “She set the letter down and said nothing for a long time” so Mara chooses a visible physical response before the narration names the emotion.',
          reader_effect: 'This lets readers track Mara’s decision through embodied action, so the revelation keeps narrative momentum instead of flattening into summary.',
          mistake_proofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
          candidate_text_a: 'She set the letter down and did not look at it again. Her hands moved to the edge of the table and stayed there.',
          candidate_text_b: 'After placing the letter flat on the table, Mara reached for her coat before either of them could ask what had changed.',
          candidate_text_c: 'The letter lay face down near the lamp while Mara kept both hands on the table and refused to pick it up.',
          revision_operation: 'replace_selected_passage',
          provenance: 'evaluation_result_v2',
          grounding_status: 'unsupported_blocked',
          preflight_status: 'limited_context',
          context_quality: 'limited',
          preflight_reasons: ['limited_context_due_to_degraded_canon'],
        },
      ] as never,
    });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-limited-unsupported' });

    expect(result.ok).toBe(true);
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(0);
    expect(result.withheldUnsupported).toHaveLength(1);
    expect(result.withheldUnsupported[0].cardType).toBe('withheld');
  });

  it('renders queue with caution when phase 0 warmup corpus cannot be loaded', async () => {
    mockLoadReviseQueueWarmupCorpus.mockRejectedValueOnce(new Error('missing benchmark corpus'));
    const supabase = buildSupabaseMock('job-1', 'version-1');
    mockCreateAdminClient.mockReturnValue(supabase as never);
    mockEnsureLedger.mockResolvedValueOnce({ artifactId: 'ledger-1', opportunities: [] as never });

    const result = await getWorkbenchQueue({ manuscriptId: '6074', evaluationJobId: 'job-1' });

    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(result.goLiveProof?.phase0Warmup.status).toBe('unavailable');
    expect(result.goLiveProof?.phase0Warmup.warning).toContain('temporarily unavailable');
    expect(result.goLiveProof?.phase0Warmup.fileCount).toBe(0);
    expect(result.goLiveProof?.phase0Warmup.benchmarkFiles).toEqual([]);
    expect(result.revisionPackage?.revision_package_id).toBe('revision_package:job-1:version-1');
    expect(mockEnsureLedger).toHaveBeenCalledTimes(1);
  });
});

function makeFinding(overrides: Partial<DiagnosticFinding> = {}): DiagnosticFinding {
  return {
    id: overrides.id ?? 'finding-1',
    evaluation_job_id: overrides.evaluation_job_id ?? 'eval-1',
    manuscript_version_id: overrides.manuscript_version_id ?? 'mv-1',
    artifact_id: overrides.artifact_id ?? null,
    criterion_key: overrides.criterion_key ?? 'PACING',
    wave_id: overrides.wave_id ?? null,
    finding_type: overrides.finding_type ?? 'diagnostic_finding',
    severity: overrides.severity ?? 'medium',
    confidence: overrides.confidence ?? 0.8,
    location_ref: overrides.location_ref ?? null,
    chunk_id: overrides.chunk_id ?? null,
    chapter_index: overrides.chapter_index ?? null,
    paragraph_index: overrides.paragraph_index ?? null,
    sentence_index: overrides.sentence_index ?? null,
    original_text: overrides.original_text ?? null,
    evidence_excerpt: overrides.evidence_excerpt ?? null,
    diagnosis: overrides.diagnosis ?? 'Long paragraph may dilute pacing or visual clarity for the reader.',
    recommendation: overrides.recommendation ?? 'Condense repeated exposition beats.',
    action_hint: overrides.action_hint ?? 'refine',
    status: overrides.status ?? 'open',
    created_at: overrides.created_at ?? '2026-05-29T00:00:00.000Z',
  };
}

describe('workbench queue admission synthesis', () => {
  test('holds findings with missing evidence and no location/manuscript-wide support', () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({ id: 'no-evidence', evidence_excerpt: null, original_text: null, location_ref: null, diagnosis: 'Generic style issue.' }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.synthesis.held).toBe(1);
    expect(result.synthesis.admitted).toBe(0);
    expect(result.synthesis.clustered).toBe(0);
    expect(result.opportunities).toHaveLength(0);
  });

  test('clusters repeated generic findings at threshold and suppresses duplicates', () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({ id: 'r1', evidence_excerpt: 'Paragraph 1 excerpt' }),
      makeFinding({ id: 'r2', evidence_excerpt: 'Paragraph 2 excerpt' }),
      makeFinding({ id: 'r3', evidence_excerpt: 'Paragraph 3 excerpt' }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.synthesis.clustered).toBe(1);
    expect(result.synthesis.suppressed).toBe(2);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].id.startsWith('cluster:')).toBe(true);
    expect(result.opportunities[0].scope).toBe('Manuscript');
  });

  test('keeps findings individual when repetition is below clustering threshold', () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({ id: 'i1', evidence_excerpt: 'excerpt one' }),
      makeFinding({ id: 'i2', evidence_excerpt: 'excerpt two' }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.synthesis.admitted).toBe(2);
    expect(result.synthesis.clustered).toBe(0);
    expect(result.synthesis.suppressed).toBe(0);
    expect(result.opportunities).toHaveLength(2);
    expect(result.opportunities.every((item) => !item.id.startsWith('cluster:'))).toBe(true);
  });

  test('leaves diagnostics empty instead of padding canned boilerplate when no real data exists', () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({
        id: 'no-diagnostics',
        recommendation: '',
        diagnosis: 'A clear observable reader symptom describing the problem.',
        evidence_excerpt: 'A real excerpt drawn straight from the manuscript passage.',
      }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.opportunities).toHaveLength(1);
    const card = result.opportunities[0];
    // With no rich enrichment and no real recommendation, the pre-gate builder
    // must leave cause/fixDirection/readerEffect empty — never padded — so the
    // admission gate can withhold the card instead of showing boilerplate.
    expect(card.cause).toBe('');
    expect(card.fixDirection).toBe('');
    expect(card.readerEffect).toBe('');
    expect(card.diagnostic.cause).toBe('');
    expect(card.diagnostic.fixStrategy).toBe('');
    expect(card.diagnostic.readerImpact).toBe('');
    expect(card.cause).not.toMatch(/manuscript readiness concern/i);
    expect(card.fixDirection).not.toMatch(/choose a repair path/i);
    expect(card.readerEffect).not.toMatch(/Repairing this can/i);
    // Empty required diagnostics must kick the card back, not admit it.
    expect(card.readiness).toBe('needs_targeting');
  });

  test('uses the finding recommendation as real diagnostic data when present', () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({
        id: 'real-recommendation',
        recommendation: 'Condense the repeated exposition beats into a single decisive turn.',
        evidence_excerpt: 'A real excerpt drawn straight from the manuscript passage.',
      }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.opportunities).toHaveLength(1);
    const card = result.opportunities[0];
    expect(card.cause).toBe('Condense the repeated exposition beats into a single decisive turn.');
    expect(card.fixDirection).toBe('Condense the repeated exposition beats into a single decisive turn.');
  });

  test('treats manuscript-wide support as actionable evidence', () => {
    const findings: DiagnosticFinding[] = [
      makeFinding({
        id: 'manuscript-wide',
        evidence_excerpt: null,
        original_text: null,
        location_ref: null,
        diagnosis: 'This pattern appears across the manuscript and creates drag.',
      }),
    ];

    const result = __testing.synthesizeFindingsForWorkbench(findings, new Map());

    expect(result.synthesis.held).toBe(0);
    expect(result.opportunities).toHaveLength(1);
  });
});
