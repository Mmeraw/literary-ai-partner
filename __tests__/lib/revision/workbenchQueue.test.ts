import { getWorkbenchQueue, __testing } from '@/lib/revision/workbenchQueue';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { ensureRevisionOpportunityLedgerArtifact } from '@/lib/revision/opportunityLedger';
import { loadReviseQueueWarmupCorpus } from '@/lib/revision/reviseQueueWarmup';
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

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockEnsureLedger = ensureRevisionOpportunityLedgerArtifact as jest.MockedFunction<typeof ensureRevisionOpportunityLedgerArtifact>;
const mockLoadReviseQueueWarmupCorpus = loadReviseQueueWarmupCorpus as jest.MockedFunction<typeof loadReviseQueueWarmupCorpus>;

function buildSupabaseMock(jobId: string, manuscriptVersionId: string, options: {
  policyFamily?: string;
  voicePreservationLevel?: string;
  evaluationArtifactContent?: unknown;
} = {}) {
  const manuscriptMaybeSingle = jest.fn(async () => ({
    data: {
      id: 6074,
      title: 'Ancient Bloodlines—Love Between Species',
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
      status: 'complete',
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

describe('getWorkbenchQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1' } as never);
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
          'docs/benchmarks/froggin-noggin-dream-v2-governed-ledger-addendum.md',
          'docs/benchmarks/let-the-river-decide-dream-v2-governed-ledger-addendum.md',
          'docs/benchmarks/cartel-babies-dream-v2-governed-ledger-addendum.md',
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
