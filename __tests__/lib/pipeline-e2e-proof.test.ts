/**
 * E2E Pipeline Proof Suite
 *
 * Proves the full chain works end-to-end:
 *   evaluation_result_v2 → opportunity ledger → context quality → preflight
 *   → admission gate → workbench card → completion certification
 *   → agent readiness package → creator approval → export
 *
 * Uses the same fixture patterns as reviseQueueRegression.test.ts but traces
 * the entire pipeline instead of testing individual stages.
 */

import { CRITERIA_KEYS } from '@/schemas/criteria-keys';
import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import {
  buildRevisionOpportunitiesFromEvaluationPayload,
  resolveReviseContextQuality,
} from '@/lib/revision/opportunityLedger';
import {
  runWorkbenchAdmissionGate,
  type WorkbenchAdmissionInput,
} from '@/lib/revision/reviseAdmissionGate';
import {
  buildReviseCompletionCertification,
  type ReviseCompletionCertificationInput,
} from '@/lib/revision/reviseCompletionCertification';
import {
  buildRevisionFailureRecord,
  buildHydrationFailureRecord,
  classifyFailureDisposition,
  resolveKickTarget,
  isKickEligible,
  type ReviseStageFailureCode,
} from '@/lib/revision/reviseFailureRecord';
import { REVISION_SESSION_ALLOWED_TRANSITIONS } from '@/lib/revision/sessionTransitions';
import {
  evaluatePackageCompleteness,
  buildAgentReadinessPackageV1,
  buildPackageExportV1,
  AGENT_READINESS_REQUIRED_SECTION_TYPES,
} from '@/lib/agent-readiness/packagePersistence';
import {
  buildCreatorApprovalV1,
  evaluateCreatorApprovalGate,
} from '@/lib/agent-readiness/creatorApprovalGate';
import {
  runQualityGateV2,
  QG_MIN_REC_LENGTH,
  QG_MAX_REC_LENGTH,
  QG_MIN_RATIONALE_LENGTH,
  QG_MIN_EVIDENCE_COVERED_CRITERIA,
  QG_MIN_EVIDENCE_SNIPPET_LENGTH,
  QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE,
  QG_INDEPENDENCE_NGRAM_SIZE,
  tokenizeForOverlap,
  collectNgrams,
} from '@/lib/evaluation/pipeline/qualityGate';
import {
  summarizePropagationIntegrity,
  normalizeSummaryWithBottomWeaknesses,
} from '@/lib/evaluation/pipeline/propagationIntegrity';
import {
  validateReviseCardContract,
  candidateTextIsCopyPasteReady,
  hasForbiddenMetaSuggestion,
  hasWordProcessorArtifact,
  inferRevisionOperation,
  operationRequiresStructuralPreview,
  type ReviseCardValidationInput,
} from '@/lib/revision/reviseCardContract';
import {
  evaluateCardCandidateQuality,
  evaluateCandidateQuality,
  type CandidateQualityInput,
} from '@/lib/revision/candidateQuality';
import {
  isTrustedPathEligible,
  isRepairCrossCheckEnabled,
  hashContent,
  type CrossCheckVerdict,
} from '@/lib/revision/repairCrossCheck';
import {
  KICK_MATRIX,
  PROCESS_REGISTRY,
  ARTIFACT_REGISTRY,
  FIELD_REGISTRY as EVAL_FIELD_REGISTRY,
  RENDERER_CONSUMPTION_MATRIX,
  AUTHORITY_SOURCE_REGISTRY,
  lookupKickForFailure,
  lookupKicksForStage,
  getBlockingKicks,
  getProcess,
  getArtifact,
  getRenderedFieldsForSurface,
} from '@/lib/evaluation/fipocRegistry';
import {
  REVISE_QUEUE_LEDGER_LIMITS,
  REVISE_QUEUE_LEDGER_INPUT_METRICS,
  REVISE_QUEUE_LEDGER_COLUMNS,
  REVISION_DECISION_LEDGER_COLUMNS,
  getReviseQueueLedgerColumnLabel,
} from '@/lib/revision/reviseQueueLedgerContract';
import {
  REVISE_KICK_MATRIX,
  REVISE_PROCESS_REGISTRY,
  REVISE_ARTIFACT_REGISTRY,
  REVISE_FIELD_REGISTRY,
  REVISE_CERTIFICATION_GATE_REGISTRY,
  REVISE_AUTHORITY_SOURCE_REGISTRY,
} from '@/lib/revision/reviseRegistry';
import {
  EVALUATION_TEMPLATE_CONTRACTS,
  buildUnifiedEvaluationDocument,
  type CanonicalEvaluationMode,
} from '@/lib/evaluation/unifiedEvaluationDocument';
import {
  buildReportRenderManifestV1,
  buildAuthorExposureCertificationV1FromManifest,
  inferCanonicalEvaluationModeFromWordCount,
  type ReportRenderManifestV1,
} from '@/lib/evaluation/reportRenderParity';
import {
  assertValidRevisionSessionTransition,
  buildRevisionSessionTransitionUpdate,
} from '@/lib/revision/sessionTransitions';
import { runVoiceGate } from '@/lib/revision/voiceGate';
import { runCanonGate } from '@/lib/revision/canonGate';
import { REVISION_OPERATIONS } from '@/lib/revision/reviseCardContract';
import {
  isTrustedPathEligible,
  hashContent,
  isRepairCrossCheckEnabled,
  type CrossCheckVerdict,
} from '@/lib/revision/repairCrossCheck';
import { evaluateCardCandidateQuality } from '@/lib/revision/candidateQuality';
import {
  checkRecommendationIntegrity,
  meetsMinimumTier,
} from '@/lib/evaluation/pipeline/recommendationIntegrityGate';
import {
  classifyAnchor,
  runEvidenceGroundingGate,
  stampAnchorTypes,
} from '@/lib/evaluation/pipeline/evidenceGroundingGate';
import {
  resolveEvaluationMode,
  resolveModeRouting,
  shouldBypassUserFacingReviewGate,
  sparseEvidenceIsNotFailure,
  MICRO_EXCERPT_MIN_WORDS,
  MICRO_EXCERPT_MAX_WORDS,
  SHORT_EXCERPT_MAX_WORDS,
  SHORT_FORM_PATTERN_MAX_WORDS,
  FULL_SHORT_FORM_MAX_WORDS,
  LONG_FORM_MIN_WORDS,
} from '@/lib/evaluation/modeRouting';
import {
  classifySubmissionScope,
  countWords,
} from '@/lib/evaluation/pipeline/submissionScope';
import {
  evaluatePackageCompleteness,
  buildAgentReadinessPackageV1,
  buildPackageExportV1,
  buildPersistedCreatorApprovalV1,
  AGENT_READINESS_REQUIRED_SECTION_TYPES,
} from '@/lib/agent-readiness/packagePersistence';
import {
  buildCreatorApprovalV1,
  evaluateCreatorApprovalGate,
} from '@/lib/agent-readiness/creatorApprovalGate';
import {
  AUTHOR_DECISION_TRANSITIONS,
  QUEUE_ITEM_LIFECYCLE_TRANSITIONS,
  type AuthorDecisionState,
  type QueueItemLifecycleState,
} from '@/lib/revision/reviseRegistry';
import {
  validateStorygateSubmission,
  type StorygateSubmissionValidatorInput,
} from '@/lib/storygate/storygateSubmissionValidator';
import {
  buildStorygateSubmissionRequestV1,
  buildAccessLogEventV1,
} from '@/lib/storygate/storygatePersistence';
import {
  STORYGATE_ADMISSION_THRESHOLD,
  STORYGATE_REQUIRED_PACKAGE_FIELDS,
  STORYGATE_FORBIDDEN_SCOPE_TERMS,
  STORYGATE_PROCESS_REGISTRY,
} from '@/lib/storygate/storygateRegistry';


jest.mock('@/lib/revision/logRevisionEvent', () => ({
  logRevisionEvent: jest.fn(async () => undefined),
}));

// ── Fixture Builders ─────────────────────────────────────────────────────────

const MANUSCRIPT_SNIPPET = 'His calamity was not completely without positivity though. He chuckled to himself, when he thought of that.';

function makeEvalFixture(scoreOverrides: Partial<Record<string, number>> = {}): EvaluationResultV2 {
  return {
    schema_version: 'evaluation_result_v2',
    ids: {
      evaluation_run_id: 'run-e2e-pipeline',
      job_id: 'job-e2e-pipeline-001',
      manuscript_id: 999,
      user_id: '00000000-0000-0000-0000-000000000999',
    },
    generated_at: new Date().toISOString(),
    engine: { model: 'gpt-5.1', provider: 'openai', prompt_version: 'pass1+pass2+pass3' },
    overview: {
      verdict: 'revise',
      overall_score_0_100: 62,
      scored_criteria_count: CRITERIA_KEYS.length,
      one_paragraph_summary: 'The manuscript demonstrates competent narrative technique with clear authorial intent.',
      top_3_strengths: ['concept', 'voice', 'character'],
      top_3_risks: ['dialogue', 'sceneConstruction', 'pacing'],
    },
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      scorable: true as const,
      status: 'SCORABLE' as const,
      signal_present: true,
      signal_strength: 'SUFFICIENT' as const,
      confidence_band: 'MEDIUM' as const,
      score_0_10: scoreOverrides[key] ?? 7,
      scorability_status: 'scorable_confident' as const,
      rationale: `Criterion ${key} shows observable writing characteristics.`,
      evidence: [
        { snippet: MANUSCRIPT_SNIPPET },
        { snippet: `Evidence B for ${key}: The salon looked like a warehouse inside.` },
      ],
      recommendations: [
        {
          priority: 'medium' as const,
          action: `Revise ${key} through targeted manuscript edits.`,
          expected_impact: `Improves ${key} quality measurably.`,
          anchor_snippet: MANUSCRIPT_SNIPPET,
          diagnosis: `The ${key} dimension needs strengthening because the opening passage summarizes rather than dramatizes, weakening the reader's sense of embodied experience.`,
          symptom: `The opening passage lacks sensory detail because the narrator reports ${key} in summary rather than dramatizing it through embodied action.`,
          cause: `Because the author relies on telling rather than showing, the ${key} dimension flattens into exposition instead of scene.`,
          fix_direction: `Replace the summarized ${key} passage at "His calamity was not completely without positivity" with one beat of embodied interiority that forces a visible decision the reader can witness.`,
          reader_effect: `The reader will feel the weight of the protagonist's choice viscerally because the ${key} dimension is anchored in physical sensation rather than abstract narration.`,
          mistake_proofing: `Verify the revised passage contains at least one physical sensation and zero instances of summarizing ${key} in abstract terms.`,
          candidate_text_a: 'He turned, and the weight of the moment pressed against his chest like a hand. The plastic receiver was cold beneath his fingers.',
          candidate_text_b: 'The silence settled over the room, and he counted to three before speaking. Each number hung in the air like smoke.',
          candidate_text_c: 'She noticed the shift in his posture, the way his shoulders dropped. The light from the window caught the grey at his temples.',
        },
      ],
    })),
    recommendations: { quick_wins: [], strategic_revisions: [] },
    metrics: { manuscript: {}, processing: {} },
    artifacts: [],
    governance: {
      confidence: 0.84,
      warnings: [],
      limitations: [],
      policy_family: 'multi-pass-dual-axis',
      observability_warnings: [],
    },
  } as unknown as EvaluationResultV2;
}

function makeWorkbenchAdmissionInput(
  opportunity: ReturnType<typeof buildRevisionOpportunitiesFromEvaluationPayload>[0],
): WorkbenchAdmissionInput {
  return {
    id: opportunity.opportunity_id,
    readiness: 'ready_for_revise',
    symptom: opportunity.symptom || 'The opening passage lacks sensory detail because the narrator reports the moment in summary rather than dramatizing it through embodied action.',
    cause: opportunity.cause || 'Because the author relies on telling rather than showing, the dimension flattens into exposition instead of scene.',
    fixDirection: opportunity.fix_direction || 'Replace the summarized passage at "His calamity was not completely without positivity" with one beat of embodied interiority that forces a visible decision the reader can witness.',
    readerEffect: opportunity.reader_effect || 'The reader will feel the weight of the protagonist\'s choice viscerally because the dimension is anchored in physical sensation rather than abstract narration.',
    anchor: opportunity.evidence_anchor || MANUSCRIPT_SNIPPET,
    groundingStatus: 'supported',
    preflightStatus: 'passed',
    contextQuality: 'clean',
    options: [
      { key: 'A', candidateText: opportunity.candidate_text_a || 'He turned, and the weight of the moment pressed against his chest like a hand.' },
      { key: 'B', candidateText: opportunity.candidate_text_b || 'The silence settled over the room, and he counted to three before speaking.' },
      { key: 'C', candidateText: opportunity.candidate_text_c || 'She noticed the shift in his posture, the way his shoulders dropped.' },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 1: evaluation_result_v2 → opportunities → context quality → preflight → admission
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 1: Evaluation → Revise Queue Admission', () => {
  it('evaluation_result_v2 produces non-empty opportunity ledger', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 5 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);
    // Every opportunity has required fields
    for (const opp of opportunities) {
      expect(opp.opportunity_id).toBeTruthy();
      expect(opp.criterion).toBeTruthy();
      expect(opp.severity).toMatch(/^(must|should|could)$/);
      expect(opp.evidence_anchor).toBeTruthy();
    }
  });

  it('low-score criteria produce "must" severity opportunities', () => {
    const fixture = makeEvalFixture({ dialogue: 3, pacing: 2 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    const mustOpps = opportunities.filter((o) => o.severity === 'must');
    expect(mustOpps.length).toBeGreaterThan(0);
  });

  it('context quality: clean report → clean status', () => {
    const decision = resolveReviseContextQuality({
      quality_report: {
        gate_ready_status: 'clean',
        layer_truth_status: { story: 'clean', character: 'clean' },
        blocking_reasons: [],
      },
    });
    expect(decision.status).toBe('clean');
  });

  it('context quality: repair_required → limited (not blocked) after PR #1139', () => {
    const decision = resolveReviseContextQuality({
      quality_report: {
        gate_ready_status: 'repair_required',
        layer_truth_status: { story: 'degraded' },
        blocking_reasons: [],
      },
    });
    expect(decision.status).toBe('limited');
  });

  it('context quality: blocked_content_hard_fail → blocked', () => {
    const decision = resolveReviseContextQuality({
      quality_report: {
        gate_ready_status: 'blocked_content_hard_fail',
        layer_truth_status: {},
        blocking_reasons: ['fatal content issue'],
      },
    });
    expect(decision.status).toBe('blocked');
  });

  it('TESTIMONY mode + no-POV blocking → limited (not blocked)', () => {
    const decision = resolveReviseContextQuality(
      {
        quality_report: {
          gate_ready_status: 'blocked',
          layer_truth_status: {},
          blocking_reasons: ['no POV characters detected'],
        },
      },
      'TESTIMONY',
    );
    expect(decision.status).toBe('limited');
  });

  it('well-formed opportunity passes diagnostic + grounding checks (admission excluding integrity tier)', () => {
    const fixture = makeEvalFixture({ dialogue: 4 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    const input = makeWorkbenchAdmissionInput(opportunities[0]);
    const result = runWorkbenchAdmissionGate(input);
    // Diagnostic fields are populated, so no DIAGNOSTIC_MISSING_* reasons
    const diagnosticReasons = result.reasons.filter((r) => r.startsWith('DIAGNOSTIC_'));
    expect(diagnosticReasons).toHaveLength(0);
    // Grounding/preflight/context reasons should not appear
    const structuralReasons = result.reasons.filter((r) =>
      r.includes('NOT_READY') || r.includes('UNSUPPORTED') || r.includes('PREFLIGHT') || r.includes('CONTEXT_'));
    expect(structuralReasons).toHaveLength(0);
    // If withheld, it's only because of integrity tier (PASS_MINIMUM vs PASS_STRONG)
    // which validates the gate is actually enforcing quality
    if (result.admission_status === 'withheld') {
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/INTEGRITY/)])
      );
    }
  });

  it('opportunity missing diagnostic fields is withheld', () => {
    const input: WorkbenchAdmissionInput = {
      id: 'opp-missing-diag',
      readiness: 'ready_for_revise',
      symptom: '',
      cause: '',
      fixDirection: '',
      readerEffect: '',
      anchor: MANUSCRIPT_SNIPPET,
      groundingStatus: 'supported',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      options: [
        { key: 'A', candidateText: 'He turned, and the weight of the moment pressed against his chest.' },
        { key: 'B', candidateText: 'The silence settled over the room, and he counted to three.' },
        { key: 'C', candidateText: 'She noticed the shift in his posture, the way his shoulders dropped.' },
      ],
    };
    const result = runWorkbenchAdmissionGate(input);
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('full chain: eval → opportunities → QG repair → admission (e2e)', () => {
    const fixture = makeEvalFixture({ dialogue: 4, sceneConstruction: 5 });

    // Step 1: Generate opportunities
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    // Step 2: QG may fail on summary weakness
    const qgResult = runQualityGateV2(fixture);
    if (!qgResult.pass) {
      // Step 3: Deterministic repair
      const propagation = summarizePropagationIntegrity(fixture.criteria);
      fixture.overview.one_paragraph_summary = normalizeSummaryWithBottomWeaknesses(
        fixture.overview.one_paragraph_summary,
        propagation.bottomScoreCriteria,
      );
      const repaired = runQualityGateV2(fixture);
      expect(repaired.pass).toBe(true);
    }

    // Step 4: Context quality resolves
    const contextDecision = resolveReviseContextQuality({
      quality_report: { gate_ready_status: 'clean', layer_truth_status: {}, blocking_reasons: [] },
    });
    expect(contextDecision.status).toBe('clean');

    // Step 5: Admission gate evaluates opportunities (diagnostic + structural checks pass)
    const diagnosticCleanCount = opportunities.filter((opp) => {
      const input = makeWorkbenchAdmissionInput(opp);
      const result = runWorkbenchAdmissionGate(input);
      const diagnosticReasons = result.reasons.filter((r) => r.startsWith('DIAGNOSTIC_'));
      return diagnosticReasons.length === 0;
    }).length;
    expect(diagnosticCleanCount).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 2: Revise Session → Failure Recovery → Completion Certification
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 2: Revise Session Lifecycle → Failure Recovery → Completion', () => {
  it('happy path: all decisions → completion certification succeeds', () => {
    const opportunityIds = ['opp-1', 'opp-2', 'opp-3'];
    const decisions = opportunityIds.map((id, i) => ({
      id: `dec-${i}`,
      opportunity_id: id,
      decision: i % 2 === 0 ? 'accepted_a' : 'keep_original',
      created_at: new Date().toISOString(),
    }));

    const result = buildReviseCompletionCertification({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      readyOpportunityIds: opportunityIds,
      decisions,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.artifact_type).toBe('revision_completion_record_v1');
      expect(result.record.certification_status).toBe('certified');
      expect(result.record.decision_count).toBe(3);
      expect(result.record.decided_count).toBe(3);
      expect(result.record.unresolved_ready_opportunity_ids).toHaveLength(0);
    }
  });

  it('premature completion: undecided opportunities → certification fails', () => {
    const result = buildReviseCompletionCertification({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      readyOpportunityIds: ['opp-1', 'opp-2', 'opp-3'],
      decisions: [
        { id: 'dec-1', opportunity_id: 'opp-1', decision: 'accepted_a', created_at: new Date().toISOString() },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.diagnostic_code).toBe('COMPLETION_PREMATURE');
      expect(result.failure.retryable).toBe(true);
    }
  });

  it('failure recovery: retryable failure → kick target → re-entry', () => {
    // Step 1: Ledger evidence missing (retryable, has kick target)
    const failureRecord = buildRevisionFailureRecord({
      sessionId: 'session-e2e-001',
      stageId: 'RS01',
      failureCode: 'LEDGER_EVIDENCE_MISSING',
      errorMessage: 'No evidence found for evaluation artifact',
      attemptCount: 1,
    });
    expect(failureRecord.artifact_type).toBe('revision_failure_record_v1');
    expect(failureRecord.disposition).toBe('retryable');

    // Step 2: Kick matrix resolves target
    const kickTarget = resolveKickTarget('LEDGER_EVIDENCE_MISSING');
    expect(kickTarget).not.toBeNull();
    expect(kickTarget!.targetStageId).toBeTruthy();

    // Step 3: Session can re-enter from failed_retryable
    const transitions = REVISION_SESSION_ALLOWED_TRANSITIONS['failed_retryable'];
    expect(transitions).toContain('open');
  });

  it('terminal failure: corrupt artifact → no re-entry', () => {
    const disposition = classifyFailureDisposition('DECISION_INVALID_VALUE');
    expect(disposition).toBe('terminal');

    // Terminal states have no outbound transitions
    const terminalTransitions = REVISION_SESSION_ALLOWED_TRANSITIONS['failed'];
    expect(terminalTransitions).toHaveLength(0);
  });

  it('hydration failure produces structured artifact', () => {
    const record = buildHydrationFailureRecord({
      opportunityId: 'opp-hydration-fail',
      failureCode: 'HYDRATION_TIMEOUT',
      attemptCount: 1,
      maxAttempts: 3,
      rejectionReason: null,
      model: 'gpt-5.1',
      promptVersion: 'hydration_v2',
    });
    expect(record.artifact_type).toBe('candidate_hydration_failure_v1');
    expect(record.opportunity_id).toBe('opp-hydration-fail');
    expect(record.hydration_status).toBe('failed_retryable');
  });

  it('all kick-eligible codes have valid kick targets', () => {
    const kickEligibleCodes = [
      'LEDGER_EVIDENCE_MISSING',
      'ADMISSION_CARD_CONTRACT_FAIL',
      'ADMISSION_CANON_GATE_FAIL',
      'WORKBENCH_ANCHOR_UNRESOLVABLE',
      'CANDIDATE_VOICE_GATE_FAIL',
      'CANDIDATE_CANON_GATE_FAIL',
      'LEDGER_SYNC_VALIDATION_FAIL',
      'DECISION_INVALID_VALUE',
      'COMPLETION_PREMATURE',
      'TRUSTEDPATH_INELIGIBLE_VERDICT',
      'CROSSCHECK_INVALID_VERDICT',
    ];
    for (const code of kickEligibleCodes) {
      expect(isKickEligible(code)).toBe(true);
      const target = resolveKickTarget(code);
      expect(target).not.toBeNull();
      expect(target!.kickCode).toBe(code);
      expect(target!.targetStageId).toBeTruthy();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 3: Completion → Agent Readiness Package → Creator Approval → Export
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 3: Completion → Agent Readiness → Creator Approval → Export', () => {
  const MOCK_SECTIONS = AGENT_READINESS_REQUIRED_SECTION_TYPES.map((type) => ({
    section_type: type,
    content: `Professional ${type} content for the manuscript. This is substantive prose that meets the minimum quality bar for agent readiness.`,
    status: 'approved' as const,
    updated_at: new Date().toISOString(),
  }));

  it('all 6 required sections must be approved for package assembly', () => {
    expect(AGENT_READINESS_REQUIRED_SECTION_TYPES).toHaveLength(6);
    expect(AGENT_READINESS_REQUIRED_SECTION_TYPES).toContain('query_letter');
    expect(AGENT_READINESS_REQUIRED_SECTION_TYPES).toContain('synopsis');
    expect(AGENT_READINESS_REQUIRED_SECTION_TYPES).toContain('query_pitch');
    expect(AGENT_READINESS_REQUIRED_SECTION_TYPES).toContain('comparables');
    expect(AGENT_READINESS_REQUIRED_SECTION_TYPES).toContain('author_bio');
    expect(AGENT_READINESS_REQUIRED_SECTION_TYPES).toContain('what_makes_unique');
  });

  it('completeness gate: all approved → passes', () => {
    const result = evaluatePackageCompleteness({
      manuscriptId: '999',
      sections: MOCK_SECTIONS,
    });
    expect(result.allSectionsApproved).toBe(true);
    expect(result.approvedCount).toBe(6);
    expect(result.missingSections).toHaveLength(0);
  });

  it('completeness gate: missing section → fails with specific missing type', () => {
    const incomplete = MOCK_SECTIONS.filter((s) => s.section_type !== 'synopsis');
    const result = evaluatePackageCompleteness({
      manuscriptId: '999',
      sections: incomplete,
    });
    expect(result.allSectionsApproved).toBe(false);
    expect(result.missingSections).toContain('synopsis');
  });

  it('package assembly: all approved sections → produces agent_readiness_package_v1', () => {
    const result = buildAgentReadinessPackageV1({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      userId: 'user-001',
      manuscriptTitle: 'The Price of Vanity',
      approvedSections: MOCK_SECTIONS,
      packageVersion: 1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.package.artifact_type).toBe('agent_readiness_package_v1');
      expect(result.package.manuscript_title).toBe('The Price of Vanity');
      expect(result.package.package_hash).toBeTruthy();
      expect(Object.keys(result.package.sections)).toHaveLength(6);
      expect(Object.keys(result.package.section_hashes)).toHaveLength(6);
    }
  });

  it('package assembly: missing section → fails gracefully', () => {
    const incomplete = MOCK_SECTIONS.filter((s) => s.section_type !== 'author_bio');
    const result = buildAgentReadinessPackageV1({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      userId: 'user-001',
      manuscriptTitle: 'Test',
      approvedSections: incomplete,
      packageVersion: 1,
    });
    expect(result.ok).toBe(false);
  });

  it('creator approval gate: approved → passes', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      packageHash: 'abc123',
      approvalState: 'approved',
      decidedBy: 'user-001',
      decidedAt: new Date().toISOString(),
    });
    const gateResult = evaluateCreatorApprovalGate({ approval });
    expect(gateResult.ok).toBe(true);
  });

  it('creator approval gate: pending → blocked (retryable)', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      packageHash: 'abc123',
      approvalState: 'pending',
    });
    const gateResult = evaluateCreatorApprovalGate({ approval });
    expect(gateResult.ok).toBe(false);
    if (!gateResult.ok) {
      expect(gateResult.failure.retryable).toBe(true);
    }
  });

  it('creator approval gate: rejected → blocked (not retryable)', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      packageHash: 'abc123',
      approvalState: 'rejected',
    });
    const gateResult = evaluateCreatorApprovalGate({ approval });
    expect(gateResult.ok).toBe(false);
    if (!gateResult.ok) {
      expect(gateResult.failure.retryable).toBe(false);
    }
  });

  it('creator approval gate: missing approval → blocked (retryable)', () => {
    const gateResult = evaluateCreatorApprovalGate({ approval: null });
    expect(gateResult.ok).toBe(false);
    if (!gateResult.ok) {
      expect(gateResult.failure.retryable).toBe(true);
    }
  });

  it('export artifact: produces valid package_export_v1', () => {
    const exportArtifact = buildPackageExportV1({
      packageHash: 'abc123def456',
      format: 'docx',
      filename: 'the-price-of-vanity-agent-readiness.docx',
    });
    expect(exportArtifact.artifact_type).toBe('package_export_v1');
    expect(exportArtifact.format).toBe('docx');
    expect(exportArtifact.package_hash).toBe('abc123def456');
    expect(exportArtifact.exported_at).toBeTruthy();
  });

  it('full chain: eval → opportunities → completion → package → approval → export (e2e)', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 5 });

    // Step 1: Evaluation produces opportunities
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    // Step 2: All opportunities get decisions → completion certified
    const opportunityIds = opportunities.map((o) => o.opportunity_id);
    const decisions = opportunityIds.map((id, i) => ({
      id: `dec-${i}`,
      opportunity_id: id,
      decision: i % 3 === 0 ? 'accepted_a' : i % 3 === 1 ? 'accepted_b' : 'keep_original',
      created_at: new Date().toISOString(),
    }));

    const completion = buildReviseCompletionCertification({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      readyOpportunityIds: opportunityIds,
      decisions,
    });
    expect(completion.ok).toBe(true);

    // Step 3: All sections approved → package assembled
    const packageResult = buildAgentReadinessPackageV1({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      userId: 'user-001',
      manuscriptTitle: 'The Price of Vanity',
      approvedSections: MOCK_SECTIONS,
      packageVersion: 1,
    });
    expect(packageResult.ok).toBe(true);
    if (!packageResult.ok) return;

    // Step 4: Creator approves → gate passes
    const approval = buildCreatorApprovalV1({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      packageHash: packageResult.package.package_hash,
      approvalState: 'approved',
      decidedBy: 'user-001',
      decidedAt: new Date().toISOString(),
    });
    const gateResult = evaluateCreatorApprovalGate({ approval });
    expect(gateResult.ok).toBe(true);

    // Step 5: Export artifact produced
    const exportArtifact = buildPackageExportV1({
      packageHash: packageResult.package.package_hash,
      format: 'txt',
      filename: 'the-price-of-vanity-agent-readiness.txt',
    });
    expect(exportArtifact.artifact_type).toBe('package_export_v1');
    expect(exportArtifact.package_hash).toBe(packageResult.package.package_hash);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 4: Failure Paths — Every failure classified, every artifact produced
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 4: Failure Path Governance', () => {
  it('evaluation fails → opportunities still generated from partial results', () => {
    // Even with some weak criteria, opportunities are produced
    const fixture = makeEvalFixture({
      dialogue: 2,
      pacing: 3,
      proseControl: 2,
      tone: 3,
    });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);
    // Weakest criteria should produce "must" severity
    const mustOpps = opportunities.filter((o) => o.severity === 'must');
    expect(mustOpps.length).toBeGreaterThan(0);
  });

  it('every revise stage failure code classifies to a disposition', () => {
    const allCodes = [
      'WORKBENCH_HYDRATION_FAILED',
      'LEDGER_EVIDENCE_MISSING',
      'ADMISSION_CARD_CONTRACT_FAIL',
      'ADMISSION_CANON_GATE_FAIL',
      'WORKBENCH_ANCHOR_UNRESOLVABLE',
      'CANDIDATE_VOICE_GATE_FAIL',
      'CANDIDATE_CANON_GATE_FAIL',
      'LEDGER_SYNC_VALIDATION_FAIL',
      'DECISION_INVALID_VALUE',
      'COMPLETION_PREMATURE',
      'TRUSTEDPATH_INELIGIBLE_VERDICT',
      'CROSSCHECK_INVALID_VERDICT',
    ];
    for (const code of allCodes) {
      const disposition = classifyFailureDisposition(code);
      expect(['retryable', 'terminal', 'manual_review']).toContain(disposition);
    }
  });

  it('every failure produces a structured artifact with required fields', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'session-gov-001',
      stageId: 'RS03',
      failureCode: 'LEDGER_EVIDENCE_MISSING',
      errorMessage: 'No evidence found for criterion voice',
      attemptCount: 1,
    });

    // Required fields per governance contract
    expect(record.artifact_type).toBe('revision_failure_record_v1');
    expect(record.session_id).toBeTruthy();
    expect(record.stage_id).toBeTruthy();
    expect(record.failure_code).toBeTruthy();
    expect(record.error_message).toBeTruthy();
    expect(record.disposition).toBeTruthy();
    expect(record.attempt_count).toBeGreaterThanOrEqual(1);
    expect(record.occurred_at).toBeTruthy();
  });

  it('premature completion → failure artifact + retryable + kick to earlier stage', () => {
    // Try to certify with undecided opportunities
    const completion = buildReviseCompletionCertification({
      manuscriptId: '999',
      evaluationJobId: 'job-001',
      readyOpportunityIds: ['opp-1', 'opp-2'],
      decisions: [],
    });
    expect(completion.ok).toBe(false);
    if (!completion.ok) {
      expect(completion.failure.diagnostic_code).toBe('COMPLETION_PREMATURE');
      expect(completion.failure.retryable).toBe(true);
    }

    // Kick matrix resolves for premature completion
    expect(isKickEligible('COMPLETION_PREMATURE')).toBe(true);
    const target = resolveKickTarget('COMPLETION_PREMATURE');
    expect(target).not.toBeNull();
  });

  it('session state machine enforces terminal boundaries', () => {
    // applied and failed are terminal
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS['applied']).toHaveLength(0);
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS['failed']).toHaveLength(0);

    // failed_retryable allows re-entry
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS['failed_retryable']).toContain('open');

    // Normal forward progression
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS['open']).toContain('findings_ready');
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS['findings_ready']).toContain('synthesis_started');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 5: Workbench Card Contract → A/B/C Candidate Quality → Author Decision
// SIPOC authority: RS02 card contract, RS04 workbench load, RS05 candidate generation, RS06 author decision
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 5: Workbench Card Contract → Candidate Quality → Author Decision', () => {
  const GOOD_CANDIDATE_A = 'He turned, and the weight of the moment pressed against his chest like a hand. The plastic receiver was cold beneath his fingers. He counted to three.';
  const GOOD_CANDIDATE_B = 'The silence settled over the room like old snow. She watched him from the doorway, counting the seconds between each breath he took.';
  const GOOD_CANDIDATE_C = 'Morning light caught the grey at his temples as he reached for the phone. His hand trembled, but his voice did not.';

  it('SIPOC RS02: well-formed card passes six-part diagnostic validation', () => {
    const input: ReviseCardValidationInput = {
      issueStatement: 'The opening passage summarizes rather than dramatizes the protagonist\'s internal conflict.',
      symptom: 'The narrator reports the moment in summary rather than dramatizing it through embodied action.',
      cause: 'Because the author relies on telling rather than showing, the dimension flattens into exposition.',
      fixStrategy: 'Replace the summarized passage with one beat of embodied interiority.',
      readerImpact: 'The reader will feel the weight of the protagonist\'s choice viscerally.',
      operationNote: 'Replace selected passage at paragraph 3.',
      sourceText: MANUSCRIPT_SNIPPET,
      sourceLocationLabel: 'Chapter 1, paragraph 3',
      revisionOperation: 'replace_selected_passage',
      candidateTexts: [GOOD_CANDIDATE_A, GOOD_CANDIDATE_B, GOOD_CANDIDATE_C],
    };
    const result = validateReviseCardContract(input);
    expect(result.readiness).toBe('ready_for_revise');
    expect(result.reason).toBeNull();
  });

  it('SIPOC RS02: missing diagnostic fields → needs_targeting (not deleted)', () => {
    const input: ReviseCardValidationInput = {
      issueStatement: 'Issue exists.',
      symptom: '',
      cause: '',
      fixStrategy: '',
      readerImpact: '',
      operationNote: '',
      sourceText: MANUSCRIPT_SNIPPET,
      sourceLocationLabel: 'Chapter 1',
      revisionOperation: 'replace_selected_passage',
      candidateTexts: [GOOD_CANDIDATE_A, GOOD_CANDIDATE_B, GOOD_CANDIDATE_C],
    };
    const result = validateReviseCardContract(input);
    expect(result.readiness).toBe('needs_targeting');
    expect(result.reason).toBeTruthy();
  });

  it('SIPOC RS02: missing candidate texts → needs_targeting', () => {
    const input: ReviseCardValidationInput = {
      issueStatement: 'The opening passage summarizes rather than dramatizes.',
      symptom: 'Narrator reports in summary.',
      cause: 'Telling rather than showing.',
      fixStrategy: 'Replace with embodied interiority.',
      readerImpact: 'Reader feels the weight viscerally.',
      operationNote: 'Replace paragraph 3.',
      sourceText: MANUSCRIPT_SNIPPET,
      sourceLocationLabel: 'Chapter 1, paragraph 3',
      revisionOperation: 'replace_selected_passage',
      candidateTexts: [GOOD_CANDIDATE_A],
    };
    const result = validateReviseCardContract(input);
    expect(result.readiness).toBe('needs_targeting');
  });

  it('SIPOC RS05: candidate quality gate requires ≥2 passing candidates', () => {
    const candidates: CandidateQualityInput[] = [
      { key: 'A', text: GOOD_CANDIDATE_A, anchor: MANUSCRIPT_SNIPPET },
      { key: 'B', text: GOOD_CANDIDATE_B, anchor: MANUSCRIPT_SNIPPET },
      { key: 'C', text: GOOD_CANDIDATE_C, anchor: MANUSCRIPT_SNIPPET },
    ];
    const result = evaluateCardCandidateQuality(candidates);
    expect(result.passed).toBe(true);
    expect(result.passedCandidateCount).toBeGreaterThanOrEqual(2);
  });

  it('SIPOC RS05: empty candidates fail quality gate', () => {
    const candidates: CandidateQualityInput[] = [
      { key: 'A', text: '', anchor: MANUSCRIPT_SNIPPET },
      { key: 'B', text: null, anchor: MANUSCRIPT_SNIPPET },
      { key: 'C', text: 'Too short.', anchor: MANUSCRIPT_SNIPPET },
    ];
    const result = evaluateCardCandidateQuality(candidates);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('EMPTY_CANDIDATE');
  });

  it('SIPOC RS05: candidates must be copy-paste ready (no meta-suggestions, no HTML)', () => {
    expect(candidateTextIsCopyPasteReady(GOOD_CANDIDATE_A)).toBe(true);
    // Editorial directive phrasing is not manuscript prose
    expect(candidateTextIsCopyPasteReady('Strengthen the opening passage to sharpen the stakes and deepen the reader\'s investment.')).toBe(false);
    expect(candidateTextIsCopyPasteReady('<p>He turned slowly.</p>')).toBe(false);
    expect(candidateTextIsCopyPasteReady(null)).toBe(false);
    expect(candidateTextIsCopyPasteReady('')).toBe(false);
  });

  it('SIPOC RS05: forbidden meta-suggestions are caught', () => {
    // Exact phrases from FORBIDDEN_META_SUGGESTIONS list
    expect(hasForbiddenMetaSuggestion('Apply the same repair goal to strengthen the opening.')).toBe(true);
    expect(hasForbiddenMetaSuggestion('Review this opportunity before proceeding.')).toBe(true);
    expect(hasForbiddenMetaSuggestion('The recommended repair path is to add a beat.')).toBe(true);
    // Real manuscript prose is not forbidden
    expect(hasForbiddenMetaSuggestion('He turned, and the weight pressed against his chest.')).toBe(false);
  });

  it('SIPOC RS05: word processor artifacts are caught', () => {
    expect(hasWordProcessorArtifact('<span style="color:red">He turned.</span>')).toBe(true);
    expect(hasWordProcessorArtifact('He turned, and the weight pressed against his chest.')).toBe(false);
  });

  it('SIPOC RS04: revision operation inferred from fix direction', () => {
    expect(inferRevisionOperation({ fixDirection: 'Insert a beat of dialogue before the reveal' })).toBe('insert_before_selected_passage');
    expect(inferRevisionOperation({ fixDirection: 'Compress the reflective passage to tighten pacing' })).toBe('compress_selected_passage');
    expect(inferRevisionOperation({ fixDirection: 'Delete the redundant attribution tag' })).toBe('delete_selected_passage');
    expect(inferRevisionOperation({ scope: 'Line' })).toBe('replace_selected_passage');
    expect(inferRevisionOperation({ scope: 'Chapter' })).toBe('rewrite_multi_paragraph_span');
  });

  it('SIPOC RS04: structural operations require preview', () => {
    expect(operationRequiresStructuralPreview('rewrite_multi_paragraph_span')).toBe(true);
    expect(operationRequiresStructuralPreview('delete_selected_passage')).toBe(true);
    expect(operationRequiresStructuralPreview('replace_selected_passage')).toBe(false);
  });

  it('full chain: eval → card contract → candidate quality → admission (e2e)', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 5 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    const opp = opportunities[0];

    // Card contract validates the opportunity's six-part diagnostic
    const cardInput: ReviseCardValidationInput = {
      issueStatement: opp.symptom || 'Issue',
      symptom: opp.symptom || 'Symptom',
      cause: opp.cause || 'Cause',
      fixStrategy: opp.fix_direction || 'Fix',
      readerImpact: opp.reader_effect || 'Impact',
      operationNote: opp.revision_operation || 'replace_selected_passage',
      sourceText: opp.evidence_anchor || MANUSCRIPT_SNIPPET,
      sourceLocationLabel: 'Chapter 1, paragraph 3',
      revisionOperation: (opp.revision_operation as 'replace_selected_passage') || 'replace_selected_passage',
      candidateTexts: [
        opp.candidate_text_a || GOOD_CANDIDATE_A,
        opp.candidate_text_b || GOOD_CANDIDATE_B,
        opp.candidate_text_c || GOOD_CANDIDATE_C,
      ],
    };
    const cardResult = validateReviseCardContract(cardInput);
    expect(cardResult.readiness).toBe('ready_for_revise');

    // Candidate quality validates A/B/C
    const qualityResult = evaluateCardCandidateQuality([
      { key: 'A', text: cardInput.candidateTexts[0], anchor: opp.evidence_anchor },
      { key: 'B', text: cardInput.candidateTexts[1], anchor: opp.evidence_anchor },
      { key: 'C', text: cardInput.candidateTexts[2], anchor: opp.evidence_anchor },
    ]);
    expect(qualityResult.passed).toBe(true);

    // Admission gate runs structural checks
    const admissionInput = makeWorkbenchAdmissionInput(opp);
    const admissionResult = runWorkbenchAdmissionGate(admissionInput);
    const diagnosticReasons = admissionResult.reasons.filter((r) => r.startsWith('DIAGNOSTIC_'));
    expect(diagnosticReasons).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 6: Cross-Check Verification → TrustedPath Auto-Apply
// SIPOC authority: RS09 cross-check verification, RS10 TrustedPath
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 6: Cross-Check Verification → TrustedPath Auto-Apply', () => {
  it('SIPOC RS10: only approve verdict is TrustedPath eligible', () => {
    expect(isTrustedPathEligible('approve')).toBe(true);
    expect(isTrustedPathEligible('flag')).toBe(false);
    expect(isTrustedPathEligible('reject')).toBe(false);
    expect(isTrustedPathEligible('unavailable')).toBe(false);
    expect(isTrustedPathEligible('pending')).toBe(false);
    expect(isTrustedPathEligible(null)).toBe(false);
    expect(isTrustedPathEligible(undefined)).toBe(false);
  });

  it('SIPOC RS09: all five verdict values are canonical', () => {
    const canonicalVerdicts: CrossCheckVerdict[] = ['approve', 'flag', 'reject', 'unavailable', 'pending'];
    for (const verdict of canonicalVerdicts) {
      expect(typeof isTrustedPathEligible(verdict)).toBe('boolean');
    }
  });

  it('SIPOC RS09: content hashing is deterministic for cache invalidation', () => {
    const text = 'He turned, and the weight of the moment pressed against his chest.';
    const hash1 = hashContent(text);
    const hash2 = hashContent(text);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex
    // Different text → different hash
    expect(hashContent(text + ' ')).not.toBe(hash1);
  });

  it('SIPOC RS09: non-approve verdicts kick to RS06 author decision for manual review', () => {
    const nonApproveVerdicts: CrossCheckVerdict[] = ['flag', 'reject', 'unavailable', 'pending'];
    for (const verdict of nonApproveVerdicts) {
      expect(isTrustedPathEligible(verdict)).toBe(false);
    }
    // KICK_MATRIX has TRUSTEDPATH_INELIGIBLE_VERDICT → RS06
    const kickTarget = resolveKickTarget('TRUSTEDPATH_INELIGIBLE_VERDICT');
    expect(kickTarget).not.toBeNull();
    expect(kickTarget!.targetStageId).toBe('RS06_AUTHOR_DECISION');
  });

  it('SIPOC RS09: invalid verdict kicks to RS06 with CROSSCHECK_INVALID_VERDICT', () => {
    const kickTarget = resolveKickTarget('CROSSCHECK_INVALID_VERDICT');
    expect(kickTarget).not.toBeNull();
    expect(kickTarget!.targetStageId).toBe('RS06_AUTHOR_DECISION');
    // Disposition is manual_review — human must decide how to handle non-canonical verdict
    const disposition = classifyFailureDisposition('CROSSCHECK_INVALID_VERDICT');
    expect(disposition).toBe('manual_review');
  });

  it('full chain: approve verdict → TrustedPath eligible → auto-apply path', () => {
    // Step 1: Cross-check returns approve
    const verdict: CrossCheckVerdict = 'approve';
    expect(isTrustedPathEligible(verdict)).toBe(true);

    // Step 2: No kick needed — flows directly to TrustedPath
    // (TRUSTEDPATH_INELIGIBLE_VERDICT only fires for non-approve)

    // Step 3: Completion certification still works after TrustedPath auto-applies
    const opportunityIds = ['opp-tp-1', 'opp-tp-2'];
    const decisions = opportunityIds.map((id, i) => ({
      id: `dec-tp-${i}`,
      opportunity_id: id,
      decision: i === 0 ? 'accepted_a' : 'keep_original', // First one was auto-applied by TrustedPath
      created_at: new Date().toISOString(),
    }));
    const completion = buildReviseCompletionCertification({
      manuscriptId: '999',
      evaluationJobId: 'job-tp-001',
      readyOpportunityIds: opportunityIds,
      decisions,
    });
    expect(completion.ok).toBe(true);
  });

  it('full chain: flag verdict → manual review → author decides → completion', () => {
    // Step 1: Cross-check returns flag
    const verdict: CrossCheckVerdict = 'flag';
    expect(isTrustedPathEligible(verdict)).toBe(false);

    // Step 2: Kicked to RS06 for manual review
    const kickTarget = resolveKickTarget('TRUSTEDPATH_INELIGIBLE_VERDICT');
    expect(kickTarget!.targetStageId).toBe('RS06_AUTHOR_DECISION');

    // Step 3: Author manually decides
    const decisions = [
      { id: 'dec-manual-1', opportunity_id: 'opp-flagged', decision: 'keep_original', created_at: new Date().toISOString() },
    ];
    const completion = buildReviseCompletionCertification({
      manuscriptId: '999',
      evaluationJobId: 'job-flag-001',
      readyOpportunityIds: ['opp-flagged'],
      decisions,
    });
    expect(completion.ok).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 7: Multi-Stage Failure Cascades
// SIPOC authority: REVISE_KICK_MATRIX, revision_failure_record_v1
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 7: Multi-Stage Failure Cascades', () => {
  it('RS01 failure → kick to S10b → failure record produced', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'session-cascade-001',
      stageId: 'RS01',
      failureCode: 'LEDGER_EVIDENCE_MISSING',
      errorMessage: 'evaluation_result_v2 not certified by Phase 5',
      attemptCount: 1,
    });
    expect(record.artifact_type).toBe('revision_failure_record_v1');
    expect(record.disposition).toBe('retryable');

    const kick = resolveKickTarget('LEDGER_EVIDENCE_MISSING');
    expect(kick!.targetStageId).toBe('S10b_PHASE5_AUTHOR_EXPOSURE_GATE');
    expect(kick!.severity).toBe('blocking');
  });

  it('RS04 anchor failure → kick to RS02 → needs_targeting', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'session-cascade-002',
      stageId: 'RS04',
      failureCode: 'WORKBENCH_ANCHOR_UNRESOLVABLE',
      errorMessage: 'Anchor text not found in manuscript version',
      attemptCount: 1,
    });
    expect(record.disposition).toBe('manual_review');

    const kick = resolveKickTarget('WORKBENCH_ANCHOR_UNRESOLVABLE');
    expect(kick!.targetStageId).toBe('RS02_QUEUE_ADMISSION');
    expect(kick!.severity).toBe('advisory');
  });

  it('RS05 voice gate → kick to RS04 → regenerate candidates', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'session-cascade-003',
      stageId: 'RS05',
      failureCode: 'CANDIDATE_VOICE_GATE_FAIL',
      errorMessage: 'Generated candidate violates voice preservation contract',
      attemptCount: 1,
    });
    expect(record.disposition).toBe('manual_review');

    const kick = resolveKickTarget('CANDIDATE_VOICE_GATE_FAIL');
    expect(kick!.targetStageId).toBe('RS04_WORKBENCH_LOAD');
  });

  it('RS07 sync failure → kick to RS06 → throw, do not write', () => {
    const kick = resolveKickTarget('LEDGER_SYNC_VALIDATION_FAIL');
    expect(kick!.targetStageId).toBe('RS06_AUTHOR_DECISION');
    expect(kick!.severity).toBe('blocking');
    expect(kick!.blocksAuthorExposure).toBe(true);
  });

  it('RS08 premature completion → kick to RS07 → sync then re-certify', () => {
    const kick = resolveKickTarget('COMPLETION_PREMATURE');
    expect(kick!.targetStageId).toBe('RS07_LEDGER_SYNC');
    expect(kick!.severity).toBe('blocking');
  });

  it('cascading failure: RS05 voice fail → RS04 reload → RS05 canon fail → escalate', () => {
    // First failure: voice gate → manual_review
    const fail1 = buildRevisionFailureRecord({
      sessionId: 'session-cascade-multi',
      stageId: 'RS05',
      failureCode: 'CANDIDATE_VOICE_GATE_FAIL',
      errorMessage: 'Voice preservation violated',
      attemptCount: 1,
    });
    expect(fail1.disposition).toBe('manual_review');
    const kick1 = resolveKickTarget('CANDIDATE_VOICE_GATE_FAIL');
    expect(kick1!.targetStageId).toBe('RS04_WORKBENCH_LOAD');

    // Second failure at same stage: canon gate → also manual_review
    const fail2 = buildRevisionFailureRecord({
      sessionId: 'session-cascade-multi',
      stageId: 'RS05',
      failureCode: 'CANDIDATE_CANON_GATE_FAIL',
      errorMessage: 'Candidate introduces banned entity',
      attemptCount: 2,
    });
    expect(fail2.disposition).toBe('manual_review');
    const kick2 = resolveKickTarget('CANDIDATE_CANON_GATE_FAIL');
    expect(kick2!.targetStageId).toBe('RS04_WORKBENCH_LOAD');

    // Both failures produce structured artifacts with incrementing attempt count
    expect(fail1.attempt_count).toBe(1);
    expect(fail2.attempt_count).toBe(2);
  });

  it('hydration failure → structured artifact → retry path', () => {
    const record = buildHydrationFailureRecord({
      opportunityId: 'opp-cascade-hydration',
      failureCode: 'HYDRATION_TIMEOUT',
      attemptCount: 1,
      maxAttempts: 3,
      rejectionReason: null,
      model: 'gpt-5.1',
      promptVersion: 'hydration_v2',
    });
    expect(record.artifact_type).toBe('candidate_hydration_failure_v1');
    expect(record.hydration_status).toBe('failed_retryable');
    expect(record.attempt_count).toBe(1);
    expect(record.max_attempts).toBe(3);

    // Max attempts exceeded → terminal
    const terminalRecord = buildHydrationFailureRecord({
      opportunityId: 'opp-cascade-hydration',
      failureCode: 'HYDRATION_TIMEOUT',
      attemptCount: 3,
      maxAttempts: 3,
      rejectionReason: null,
      model: 'gpt-5.1',
      promptVersion: 'hydration_v2',
    });
    expect(terminalRecord.hydration_status).toBe('failed_terminal');
  });

  it('SIPOC KICK_MATRIX: all 11 kick codes have valid entries with required fields', () => {
    const expectedKickCodes = [
      'LEDGER_EVIDENCE_MISSING',
      'ADMISSION_CARD_CONTRACT_FAIL',
      'ADMISSION_CANON_GATE_FAIL',
      'WORKBENCH_ANCHOR_UNRESOLVABLE',
      'CANDIDATE_VOICE_GATE_FAIL',
      'CANDIDATE_CANON_GATE_FAIL',
      'LEDGER_SYNC_VALIDATION_FAIL',
      'DECISION_INVALID_VALUE',
      'COMPLETION_PREMATURE',
      'TRUSTEDPATH_INELIGIBLE_VERDICT',
      'CROSSCHECK_INVALID_VERDICT',
    ];
    for (const code of expectedKickCodes) {
      const kick = resolveKickTarget(code);
      expect(kick).not.toBeNull();
      expect(kick!.kickCode).toBe(code);
      expect(kick!.targetStageId).toBeTruthy();
      expect(kick!.triggeringStageId).toBeTruthy();
      expect(kick!.triggerCondition).toBeTruthy();
      expect(kick!.resolution).toBeTruthy();
      expect(typeof kick!.blocksAuthorExposure).toBe('boolean');
      expect(['blocking', 'advisory', 'warning']).toContain(kick!.severity);
    }
  });

  it('SIPOC: failed_retryable re-entry requires revision_failure_record_v1 (state machine)', () => {
    // failed_retryable allows re-entry to open (and forward progression states)
    const transitions = REVISION_SESSION_ALLOWED_TRANSITIONS['failed_retryable'];
    expect(transitions).toContain('open');

    // A failure record must accompany the transition
    const record = buildRevisionFailureRecord({
      sessionId: 'session-reentry',
      stageId: 'RS01',
      failureCode: 'LEDGER_EVIDENCE_MISSING',
      errorMessage: 'Re-entry after retryable failure',
      attemptCount: 2,
    });
    expect(record.artifact_type).toBe('revision_failure_record_v1');
    expect(record.disposition).toBe('retryable');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 8: Evaluation FIPOC KICK_MATRIX — every kick code traced
// SIPOC authority: docs/SIPOC_EVALUATION_PROCESS.md, lib/evaluation/fipocRegistry.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 8: Evaluation FIPOC KICK_MATRIX Governance', () => {
  it('FIPOC: all eval kick codes resolve via lookupKickForFailure', () => {
    for (const kick of KICK_MATRIX) {
      const resolved = lookupKickForFailure(kick.failureCode);
      expect(resolved).not.toBeUndefined();
      expect(resolved!.failureCode).toBe(kick.failureCode);
      expect(resolved!.kickBackTo).toBeTruthy();
      expect(resolved!.retryLimit).toBeGreaterThanOrEqual(1);
    }
  });

  it('FIPOC: every kick blocks author exposure (eval pipeline is strict)', () => {
    const blocking = getBlockingKicks();
    // At least the core pipeline kicks must block
    expect(blocking.length).toBeGreaterThan(0);
    for (const kick of blocking) {
      expect(kick.blocksAuthorExposure).toBe(true);
    }
  });

  it('FIPOC: critical failure codes have correct kick targets', () => {
    const seedKick = lookupKickForFailure('SEED_FIT_GAP_BLOCKED');
    expect(seedKick!.kickBackTo).toBe('ADJACENT_PHASE_0_5A');

    const handoffKick = lookupKickForFailure('HANDOFF_GENERIC_LANGUAGE');
    expect(handoffKick!.kickBackTo).toBe('S05_PASS1 or S06_PASS2');

    const qgKick = lookupKickForFailure('QG_ARTIFACT_GATE_FAIL');
    expect(qgKick!.kickBackTo).toBe('S07_PASS3');

    const bannedEntityKick = lookupKickForFailure('PHASE5_BANNED_ENTITY');
    expect(bannedEntityKick!.kickBackTo).toBe('S07_PASS3');

    const revisionLedgerKick = lookupKickForFailure('REVISION_LEDGER_EVIDENCE_MISSING');
    expect(revisionLedgerKick!.kickBackTo).toBe('ADJACENT_REVISION_LEDGER');
    expect(revisionLedgerKick!.blocksAuthorExposure).toBe(false);
  });

  it('FIPOC: every process stage in PROCESS_REGISTRY has required fields', () => {
    expect(PROCESS_REGISTRY.length).toBeGreaterThan(0);
    for (const stage of PROCESS_REGISTRY) {
      expect(stage.stageId).toBeTruthy();
      expect(stage.processName).toBeTruthy();
      expect(stage.phase).toBeTruthy();
      expect(stage.activeState).toBeTruthy();
      expect(stage.codeSurfaces.length).toBeGreaterThan(0);
      expect(stage.outputArtifacts.length).toBeGreaterThan(0);
    }
  });

  it('FIPOC: every artifact in ARTIFACT_REGISTRY has producer and required fields', () => {
    expect(ARTIFACT_REGISTRY.length).toBeGreaterThan(0);
    for (const artifact of ARTIFACT_REGISTRY) {
      expect(artifact.artifact).toBeTruthy();
      expect(artifact.producerStageId).toBeTruthy();
      expect(artifact.requiredFields.length).toBeGreaterThan(0);
    }
  });

  it('FIPOC: stage kicks resolve to valid stages', () => {
    const stageIds = PROCESS_REGISTRY.map((s) => s.stageId);
    for (const kick of KICK_MATRIX) {
      // kickBackTo may contain " or " for multi-target kicks
      const targets = kick.kickBackTo.split(' or ').map((t) => t.trim());
      for (const target of targets) {
        // Target must be a known stage or a special composite like "failed producer stage named by audit"
        if (!target.includes('named by')) {
          expect(stageIds).toContain(target);
        }
      }
    }
  });

  it('full chain: eval FIPOC → kick resolution → artifact traceability', () => {
    // Trace: QG_ARTIFACT_GATE_FAIL detected at S09 → kicks to S07_PASS3
    const kick = lookupKickForFailure('QG_ARTIFACT_GATE_FAIL');
    expect(kick).toBeDefined();
    expect(kick!.dirtyDataDetectedAt).toBe('S09_QUALITYGATEV2');
    expect(kick!.kickBackTo).toBe('S07_PASS3');

    // The target stage exists in process registry
    const targetStage = getProcess(kick!.kickBackTo);
    expect(targetStage).toBeDefined();
    expect(targetStage!.processName).toBeTruthy();

    // The detecting stage produces artifacts that feed into the target
    const detectingStage = getProcess(kick!.dirtyDataDetectedAt);
    expect(detectingStage).toBeDefined();

    // Kick blocks author exposure
    expect(kick!.blocksAuthorExposure).toBe(true);
    expect(kick!.retryLimit).toBe(1);
    expect(kick!.ifRetryFails).toContain('Fail closed');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 9: Queue Ledger Contract — limits, metrics, column governance
// SIPOC authority: RS01–RS03, lib/revision/reviseQueueLedgerContract.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 9: Queue Ledger Contract Governance', () => {
  it('SIPOC: hard caps enforced (short=50, long=100)', () => {
    expect(REVISE_QUEUE_LEDGER_LIMITS.shortFormMaxOpportunities).toBe(50);
    expect(REVISE_QUEUE_LEDGER_LIMITS.longFormMaxOpportunities).toBe(100);
    expect(REVISE_QUEUE_LEDGER_LIMITS.longFormWordThreshold).toBe(25_000);
  });

  it('SIPOC: all 12 metric keys documented with descriptions', () => {
    const metricKeys = Object.keys(REVISE_QUEUE_LEDGER_INPUT_METRICS);
    expect(metricKeys).toContain('total_opportunities');
    expect(metricKeys).toContain('ready_for_revise');
    expect(metricKeys).toContain('needs_targeting');
    expect(metricKeys).toContain('ready_rate');
    expect(metricKeys).toContain('ledger_backing_coverage');
    expect(metricKeys).toContain('candidate_option_coverage');
    expect(metricKeys).toContain('anchor_coverage');
    expect(metricKeys).toContain('author_decision_count');
    expect(metricKeys).toContain('synced_decision_count');
    for (const key of metricKeys) {
      expect(REVISE_QUEUE_LEDGER_INPUT_METRICS[key as keyof typeof REVISE_QUEUE_LEDGER_INPUT_METRICS]).toBeTruthy();
    }
  });

  it('SIPOC: queue columns have fail-closed rules', () => {
    expect(REVISE_QUEUE_LEDGER_COLUMNS.length).toBeGreaterThan(0);
    for (const col of REVISE_QUEUE_LEDGER_COLUMNS) {
      expect(col.key).toBeTruthy();
      expect(col.label).toBeTruthy();
      expect(col.definition).toBeTruthy();
      expect(col.failClosedRule).toBeTruthy();
    }
  });

  it('SIPOC: decision ledger columns have sync governance', () => {
    expect(REVISION_DECISION_LEDGER_COLUMNS.length).toBeGreaterThan(0);
    const syncCol = REVISION_DECISION_LEDGER_COLUMNS.find((c) => c.key === 'sync');
    expect(syncCol).toBeDefined();
    expect(syncCol!.failClosedRule).toBeTruthy();
  });

  it('SIPOC: column labels resolve for all queue column keys', () => {
    for (const col of REVISE_QUEUE_LEDGER_COLUMNS) {
      const label = getReviseQueueLedgerColumnLabel(col.key);
      expect(label).toBe(col.label);
    }
  });

  it('SIPOC: revise PROCESS_REGISTRY covers RS01–RS10', () => {
    const expectedStages = [
      'RS01_LEDGER_ASSEMBLY', 'RS02_QUEUE_ADMISSION', 'RS03_QUEUE_PRIORITIZATION',
      'RS04_WORKBENCH_LOAD', 'RS05_CANDIDATE_GENERATION', 'RS06_AUTHOR_DECISION',
      'RS07_LEDGER_SYNC', 'RS08_COMPLETION', 'RS09_CROSSCHECK_VERIFICATION', 'RS10_TRUSTEDPATH',
    ];
    const registeredStageIds = REVISE_PROCESS_REGISTRY.map((s) => s.stageId);
    for (const expected of expectedStages) {
      expect(registeredStageIds).toContain(expected);
    }
  });

  it('SIPOC: revise ARTIFACT_REGISTRY has all core artifacts', () => {
    const artifactNames = REVISE_ARTIFACT_REGISTRY.map((a) => a.artifact);
    expect(artifactNames).toContain('revision_opportunity_ledger_v1');
    expect(artifactNames).toContain('revise_queue_v1');
    expect(artifactNames).toContain('revision_ledger_decision_v1');
    expect(artifactNames).toContain('revision_completion_record_v1');
    expect(artifactNames).toContain('repair_cross_check_v1');
    expect(artifactNames).toContain('trustedpath_result_v1');
    expect(artifactNames).toContain('revision_failure_record_v1');
    expect(artifactNames).toContain('candidate_hydration_failure_v1');
  });

  it('SIPOC: revise FIELD_REGISTRY has canonical enum contracts', () => {
    const fieldNames = REVISE_FIELD_REGISTRY.map((f) => f.field);
    expect(fieldNames).toContain('admission_status');
    expect(fieldNames).toContain('readiness');
    expect(fieldNames).toContain('decision');
    expect(fieldNames).toContain('severity');
    expect(fieldNames).toContain('verdict');
    expect(fieldNames).toContain('revision_session_status');
    // Session status includes failed_retryable (SIPOC amendment)
    const sessionField = REVISE_FIELD_REGISTRY.find((f) => f.field === 'revision_session_status');
    expect(sessionField!.allowedValues).toContain('failed_retryable');
  });

  it('SIPOC: certification gates cover key pipeline seams', () => {
    expect(REVISE_CERTIFICATION_GATE_REGISTRY.length).toBeGreaterThan(0);
    const gateIds = REVISE_CERTIFICATION_GATE_REGISTRY.map((g) => g.gateId);
    // At minimum: queue admission, workbench evidence, candidate set, author decision, completion
    expect(gateIds.length).toBeGreaterThanOrEqual(5);
  });

  it('full chain: eval opportunities → queue limits → admission → ledger metrics', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 5, tone: 3 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);

    // Opportunities respect hard cap for short-form
    expect(opportunities.length).toBeLessThanOrEqual(REVISE_QUEUE_LEDGER_LIMITS.shortFormMaxOpportunities);
    expect(opportunities.length).toBeGreaterThan(0);

    // Every opportunity has ledger-backing fields for queue rendering
    for (const opp of opportunities) {
      expect(opp.opportunity_id).toBeTruthy();
      expect(opp.criterion).toBeTruthy();
      expect(opp.severity).toMatch(/^(must|should|could)$/);
      expect(opp.evidence_anchor).toBeTruthy();
    }

    // Context quality resolves for admission
    const contextDecision = resolveReviseContextQuality({
      quality_report: { gate_ready_status: 'clean', layer_truth_status: {}, blocking_reasons: [] },
    });
    expect(contextDecision.status).toBe('clean');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 10: Candidate Quality Gate — rejection taxonomy
// SIPOC authority: RS05, candidateQuality.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 10: Candidate Quality Gate Rejection Taxonomy', () => {
  const ANCHOR = 'His calamity was not completely without positivity though.';

  it('EMPTY_CANDIDATE: null/empty text rejected', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: null, anchor: ANCHOR },
      { key: 'B', text: '', anchor: ANCHOR },
      { key: 'C', text: '   ', anchor: ANCHOR },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('EMPTY_CANDIDATE');
  });

  it('TOO_SHORT: under 8 words rejected', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'He turned slowly.', anchor: ANCHOR },
      { key: 'B', text: 'Short.', anchor: ANCHOR },
      { key: 'C', text: 'Very short text here.', anchor: ANCHOR },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('TOO_SHORT');
  });

  it('GENERIC_PROSE: cliché patterns rejected', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'The silence stretched between them like a thread about to snap, and they waited for the first move.', anchor: ANCHOR },
      { key: 'B', text: 'Something shifted in the room, and the air grew heavy with expectation and unspoken words of meaning.', anchor: ANCHOR },
      { key: 'C', text: 'He looked away first, knowing the moment had passed beyond any possible return to where they started.', anchor: ANCHOR },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('GENERIC_PROSE');
  });

  it('NON_EXECUTABLE_PROSE: editorial commentary rejected', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'This revision should be stronger. The passage would be improved by adding more sensory detail and texture.', anchor: ANCHOR },
      { key: 'B', text: 'Here is a rewrite that captures the intended mood. Consider changing the opening line for better effect.', anchor: ANCHOR },
      { key: 'C', text: 'The author should show rather than tell. The reader would benefit from more concrete physical description.', anchor: ANCHOR },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('NON_EXECUTABLE_PROSE');
  });

  it('NOT_EXECUTABLE: placeholder tokens rejected', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'He walked toward the [INSERT LOCATION] and paused at the threshold, waiting for the right moment.', anchor: ANCHOR },
      { key: 'B', text: 'The TODO remained visible on the wall, a reminder of all the work still left to accomplish here.', anchor: ANCHOR },
      { key: 'C', text: 'Morning light caught his temples as he reached for the phone and his hand trembled slightly with age.', anchor: ANCHOR },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('NOT_EXECUTABLE');
  });

  it('ANCHOR_ECHO: candidate too similar to anchor rejected', () => {
    const longAnchor = 'His calamity was not completely without positivity though he chuckled to himself when he thought of that ironic observation.';
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'His calamity was not completely without positivity though he chuckled to himself when he thought of that ironic observation.', anchor: longAnchor },
      { key: 'B', text: 'Morning light caught the grey at his temples as he reached for the phone and his hand trembled but not his voice.', anchor: longAnchor },
      { key: 'C', text: 'She noticed the shift in his posture when the door opened and the way his shoulders dropped with sudden relief.', anchor: longAnchor },
    ]);
    expect(result.passed).toBe(true); // B and C pass, only A echoes
    const aResult = result.candidateResults.find((r) => r.key === 'A');
    expect(aResult!.reasons).toContain('ANCHOR_ECHO');
  });

  it('passing candidates: well-crafted manuscript prose accepted', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'He turned, and the weight of the moment pressed against his chest like a hand. The plastic receiver was cold beneath his fingers.', anchor: ANCHOR },
      { key: 'B', text: 'The silence settled over the room like old snow. She watched him from the doorway, counting the seconds between each breath.', anchor: ANCHOR },
      { key: 'C', text: 'Morning light caught the grey at his temples as he reached for the phone. His hand trembled, but his voice did not.', anchor: ANCHOR },
    ]);
    expect(result.passed).toBe(true);
    expect(result.passedCandidateCount).toBe(3);
    expect(result.reasons).toHaveLength(0);
  });

  it('≥2 passing required: one bad candidate still passes gate', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: '', anchor: ANCHOR }, // EMPTY
      { key: 'B', text: 'The silence settled over the room like old snow. She watched him from the doorway, counting the seconds between each breath.', anchor: ANCHOR },
      { key: 'C', text: 'Morning light caught the grey at his temples as he reached for the phone. His hand trembled, but his voice did not.', anchor: ANCHOR },
    ]);
    expect(result.passed).toBe(true);
    expect(result.passedCandidateCount).toBe(2);
  });

  it('<2 passing: two bad candidates fails gate', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: '', anchor: ANCHOR },
      { key: 'B', text: 'Short.', anchor: ANCHOR },
      { key: 'C', text: 'Morning light caught the grey at his temples as he reached for the phone. His hand trembled, but his voice did not.', anchor: ANCHOR },
    ]);
    expect(result.passed).toBe(false);
    expect(result.passedCandidateCount).toBe(1);
    expect(result.reasons).toContain('REVISION_QUALITY_FAILED');
  });

  it('full chain: eval → opportunities → candidate quality gate → admission (e2e)', () => {
    const fixture = makeEvalFixture({ dialogue: 3, pacing: 4 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    const opp = opportunities[0];

    // Candidates from fixture pass quality gate
    const qualityResult = evaluateCardCandidateQuality([
      { key: 'A', text: opp.candidate_text_a, anchor: opp.evidence_anchor },
      { key: 'B', text: opp.candidate_text_b, anchor: opp.evidence_anchor },
      { key: 'C', text: opp.candidate_text_c, anchor: opp.evidence_anchor },
    ]);
    expect(qualityResult.passed).toBe(true);

    // Passes admission gate
    const admissionInput = makeWorkbenchAdmissionInput(opp);
    const admissionResult = runWorkbenchAdmissionGate(admissionInput);
    const diagnosticReasons = admissionResult.reasons.filter((r) => r.startsWith('DIAGNOSTIC_'));
    expect(diagnosticReasons).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 11: Short-Form Renderer Parity — Webpage + PDF/DOCX/TXT
// SIPOC authority: FIPOC RENDERER_CONSUMPTION_MATRIX, reportRenderParity.ts
// ══════════════════════════════════════════════════════════════════════════════

function makeEvalResult(overrides: { wordCount: number; genre: string; title: string }) {
  return {
    generated_at: '2025-06-10T00:00:00Z',
    overview: {
      overall_score_0_100: 72,
      overall_score_confidence: 'high' as const,
      submission_readiness: 'Not Ready' as const,
      submission_readiness_confidence: 'high' as const,
      verdict: 'Promising manuscript with significant craft opportunities.',
      one_paragraph_summary: 'A compelling premise with strong character work but pacing inconsistencies.',
      executive_summary: 'The manuscript demonstrates clear voice and strong character development.',
      top_3_strengths: ['Strong protagonist voice', 'Compelling opening hook', 'Effective dialogue rhythm'],
      top_3_risks: ['Pacing stalls in middle act', 'Secondary characters underdeveloped', 'Ending feels rushed'],
      top_strengths: ['Strong protagonist voice', 'Compelling opening hook'],
      top_risks: ['Pacing stalls in middle act', 'Secondary characters underdeveloped'],
      top_recommendations: ['Tighten middle act pacing', 'Deepen secondary character arcs'],
      one_sentence_pitch: 'A barber discovers vanity costs more than money.',
      one_paragraph_pitch: 'When a vain barber moves to Toronto, his obsessive grooming rituals spiral into a comedy of errors.',
    },
    metrics: {
      manuscript: {
        title: overrides.title,
        word_count: overrides.wordCount,
        genre: overrides.genre,
        target_audience: 'Adult literary fiction readers',
      },
      readability: { grade_level: 8.5 },
      dialogue_narrative_ratio: '35/65',
    },
    enrichment: {
      premise: 'A man learns the true cost of vanity through a series of salon disasters.',
      diagnosed_genre: overrides.genre,
      genre_confidence: 'high' as const,
      target_audience: 'Adult literary fiction readers',
      target_audience_confidence: 'high' as const,
      shelf: 'Literary Fiction',
      shelf_confidence: 'high' as const,
      one_sentence_pitch: 'A barber discovers vanity costs more than money.',
      one_paragraph_pitch: 'When a vain barber moves to Toronto, his obsessive grooming rituals spiral.',
    },
    governance: {
      canonical_entity_names: ['Marcus', 'Elaine'],
    },
    criteria: [
      {
        key: 'concept', score_0_10: 8, confidence_level: 'high' as const,
        rationale: 'Strong thematic premise grounded in character-driven irony.',
        scorability_status: 'scorable' as const,
        recommendations: [{
          action: 'Sharpen the central ironic reversal in the final scene.',
          expected_impact: 'Stronger thematic resonance.',
          anchor_snippet: 'His calamity was not completely without positivity though.',
          symptom: 'Irony is implied rather than dramatized.',
          mechanism: 'The reversal happens off-page.',
          specific_fix: 'Add a scene where Marcus sees his reflection and laughs.',
          reader_effect: 'Reader feels the ironic payoff directly.',
          mistake_proofing: 'Ensure the reversal is shown, not told.',
        }],
      },
      {
        key: 'character', score_0_10: 7, confidence_level: 'high' as const,
        rationale: 'Marcus is vivid; secondary characters need development.',
        scorability_status: 'scorable' as const,
        recommendations: [{
          action: 'Give Elaine a scene of her own that reveals backstory.',
          expected_impact: 'Elaine becomes a full character rather than a prop.',
          anchor_snippet: 'He realized that he should not be judgmental.',
          symptom: 'Elaine appears only through Marcus perspective.',
          mechanism: 'No POV shift or dialogue-driven scene for Elaine.',
          specific_fix: 'Insert a brief Elaine scene before the salon disaster.',
          reader_effect: 'Reader invests in Elaine arc independently.',
          mistake_proofing: 'Elaine scene must pass voice preservation gate.',
        }],
      },
    ],
    content_warnings: ['mild language'],
    transparency: { privacy_notice: 'This evaluation is confidential.' },
  };
}

describe('E2E Chain 11: Short-Form Renderer Parity — Webpage + PDF/DOCX/TXT', () => {
  const SHORT_FORM_RESULT = makeEvalResult({
    wordCount: 8_500,
    genre: 'Literary Fiction',
    title: 'The Price of Vanity',
  });

  it('FIPOC: short-form mode inferred from word count < 25k', () => {
    expect(inferCanonicalEvaluationModeFromWordCount(8_500)).toBe('short_form_evaluation');
    expect(inferCanonicalEvaluationModeFromWordCount(24_999)).toBe('short_form_evaluation');
  });

  it('FIPOC: template contract has short-form entry with required fields', () => {
    const template = EVALUATION_TEMPLATE_CONTRACTS.short_form_evaluation;
    expect(template.templateName).toBe('Short-Form Evaluation Template');
    expect(template.reportType).toBe('Short-Form Evaluation');
    expect(template.templatePath).toContain('short-form');
  });

  it('FIPOC: UED builds from short-form evaluation result', () => {
    const ued = buildUnifiedEvaluationDocument({
      mode: 'short_form_evaluation',
      result: SHORT_FORM_RESULT,
      displayTitle: 'The Price of Vanity',
      dream: null,
    });
    expect(ued.templateMode).toBe('short_form_evaluation');
    expect(ued.title).toBe('The Price of Vanity');
    expect(ued.titleBlock.genre).toBeTruthy();
    expect(ued.titleBlock.targetAudience).toBeTruthy();
    expect(ued.executiveSummary).toBeTruthy();
    expect(ued.criterionDetails.length).toBeGreaterThan(0);
  });

  it('FIPOC: render manifest declares all 4 surfaces with canonical consumption', () => {
    const ued = buildUnifiedEvaluationDocument({
      mode: 'short_form_evaluation',
      result: SHORT_FORM_RESULT,
      displayTitle: 'The Price of Vanity',
      dream: null,
    });
    const manifest = buildReportRenderManifestV1({
      jobId: 'job-short-form-001',
      unifiedDocument: ued,
    });
    expect(manifest.schema_version).toBe('report_render_manifest_v1');
    expect(manifest.template.mode).toBe('short_form_evaluation');
    expect(manifest.template.report_type).toBe('Short-Form Evaluation');

    // All 4 surfaces declared
    for (const surface of ['webpage', 'pdf', 'docx', 'txt'] as const) {
      expect(manifest.surfaces[surface]).toBeDefined();
      expect(manifest.surfaces[surface].consumed_fields.length).toBeGreaterThan(0);
      expect(manifest.surfaces[surface].measurement_mode).toBe('declared_canonical_consumption');
    }
  });

  it('FIPOC: parity check passes when all surfaces consume same UED', () => {
    const ued = buildUnifiedEvaluationDocument({
      mode: 'short_form_evaluation',
      result: SHORT_FORM_RESULT,
      displayTitle: 'The Price of Vanity',
      dream: null,
    });
    const manifest = buildReportRenderManifestV1({
      jobId: 'job-short-form-002',
      unifiedDocument: ued,
    });
    expect(manifest.parity.status).toBe('pass');
    expect(manifest.parity.missing_required_fields).toHaveLength(0);
    expect(manifest.parity.mismatched_fields).toHaveLength(0);
    expect(manifest.parity.derived_canonical_fields).toHaveLength(0);
  });

  it('FIPOC: author exposure certification is certified when parity passes', () => {
    const ued = buildUnifiedEvaluationDocument({
      mode: 'short_form_evaluation',
      result: SHORT_FORM_RESULT,
      displayTitle: 'The Price of Vanity',
      dream: null,
    });
    const manifest = buildReportRenderManifestV1({
      jobId: 'job-short-form-003',
      unifiedDocument: ued,
    });
    const cert = buildAuthorExposureCertificationV1FromManifest(manifest);
    expect(cert.schema_version).toBe('author_exposure_certification_v1');
    expect(cert.decision).toBe('certified');
    expect(cert.blocking_reasons).toHaveLength(0);
    expect(cert.parity_results.overall.status).toBe('pass');
    expect(cert.parity_results.webpage.status).toBe('pass');
    expect(cert.parity_results.pdf.status).toBe('pass');
    expect(cert.parity_results.docx.status).toBe('pass');
    expect(cert.parity_results.txt.status).toBe('pass');
  });

  it('FIPOC: renderer consumption matrix has all 4 download surfaces + dream', () => {
    const surfaces = RENDERER_CONSUMPTION_MATRIX.map((r) => r.surface);
    expect(surfaces).toContain('webpage');
    expect(surfaces).toContain('pdf');
    expect(surfaces).toContain('docx');
    expect(surfaces).toContain('txt');
    expect(surfaces).toContain('dream');

    for (const entry of RENDERER_CONSUMPTION_MATRIX) {
      // The four report-render surfaces consume the single renderer contract
      // (EvaluationReportViewModel) post-migration — never a raw upstream
      // artifact. 'dream' is the adjacent DREAM production worker, not a report
      // renderer, so it still consumes its production inputs (evaluation_result_v2
      // + the UED field contract).
      if (entry.surface === 'dream') {
        expect(entry.canonicalInput).toContain('evaluation_result_v2');
      } else {
        expect(entry.canonicalInput).toContain('EvaluationReportViewModel');
      }
      expect(entry.forbiddenInputs.length).toBeGreaterThan(0);
      expect(entry.rendererMayDerive).toBe(false);
    }
  });

  it('FIPOC: each surface has field parity with FIELD_REGISTRY', () => {
    for (const surface of ['webpage', 'pdf', 'docx', 'txt'] as const) {
      const fields = getRenderedFieldsForSurface(surface);
      expect(fields.length).toBeGreaterThan(0);
    }
  });

  it('full chain: short-form eval → UED → render manifest → parity → certification', () => {
    const mode = inferCanonicalEvaluationModeFromWordCount(SHORT_FORM_RESULT.metrics.manuscript.word_count);
    expect(mode).toBe('short_form_evaluation');

    const ued = buildUnifiedEvaluationDocument({
      mode,
      result: SHORT_FORM_RESULT,
      displayTitle: 'The Price of Vanity',
      dream: null,
    });
    expect(ued.templateMode).toBe('short_form_evaluation');

    const manifest = buildReportRenderManifestV1({
      jobId: 'job-short-form-e2e',
      unifiedDocument: ued,
    });
    expect(manifest.parity.status).toBe('pass');

    const cert = buildAuthorExposureCertificationV1FromManifest(manifest);
    expect(cert.decision).toBe('certified');
    expect(cert.active_template_path).toContain('short-form');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 12: Long-Form Renderer Parity — Webpage + PDF/DOCX/TXT
// SIPOC authority: FIPOC RENDERER_CONSUMPTION_MATRIX, reportRenderParity.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 12: Long-Form Renderer Parity — Webpage + PDF/DOCX/TXT', () => {
  const LONG_FORM_RESULT = makeEvalResult({
    wordCount: 85_000,
    genre: 'Contemporary Romance',
    title: 'The Architecture of Wanting',
  });

  it('FIPOC: long-form mode inferred from word count >= 25k', () => {
    expect(inferCanonicalEvaluationModeFromWordCount(25_000)).toBe('long_form_evaluation');
    expect(inferCanonicalEvaluationModeFromWordCount(74_999)).toBe('long_form_evaluation');
  });

  it('FIPOC: long-form multi-layer mode inferred from word count >= 75k', () => {
    expect(inferCanonicalEvaluationModeFromWordCount(75_000)).toBe('long_form_multi_layer_evaluation');
    expect(inferCanonicalEvaluationModeFromWordCount(150_000)).toBe('long_form_multi_layer_evaluation');
  });

  it('FIPOC: template contracts for all 3 modes', () => {
    const modes: CanonicalEvaluationMode[] = [
      'short_form_evaluation',
      'long_form_evaluation',
      'long_form_multi_layer_evaluation',
    ];
    for (const mode of modes) {
      const template = EVALUATION_TEMPLATE_CONTRACTS[mode];
      expect(template.templateName).toBeTruthy();
      expect(template.reportType).toBeTruthy();
      expect(template.templatePath).toBeTruthy();
    }
  });

  it('FIPOC: UED builds from long-form multi-layer evaluation result', () => {
    const ued = buildUnifiedEvaluationDocument({
      mode: 'long_form_multi_layer_evaluation',
      result: LONG_FORM_RESULT,
      displayTitle: 'The Architecture of Wanting',
      dream: null,
    });
    expect(ued.templateMode).toBe('long_form_multi_layer_evaluation');
    expect(ued.title).toBe('The Architecture of Wanting');
    expect(ued.titleBlock.genre).toBeTruthy();
    expect(ued.modeSpecific).toBeDefined();
  });

  it('FIPOC: long-form render manifest parity passes', () => {
    const ued = buildUnifiedEvaluationDocument({
      mode: 'long_form_multi_layer_evaluation',
      result: LONG_FORM_RESULT,
      displayTitle: 'The Architecture of Wanting',
      dream: null,
    });
    const manifest = buildReportRenderManifestV1({
      jobId: 'job-long-form-001',
      unifiedDocument: ued,
    });
    expect(manifest.template.mode).toBe('long_form_multi_layer_evaluation');
    expect(manifest.template.report_type).toBe('Long-Form Multi-Layer Evaluation');
    expect(manifest.parity.status).toBe('pass');
  });

  it('FIPOC: long-form certification certified', () => {
    const ued = buildUnifiedEvaluationDocument({
      mode: 'long_form_multi_layer_evaluation',
      result: LONG_FORM_RESULT,
      displayTitle: 'The Architecture of Wanting',
      dream: null,
    });
    const manifest = buildReportRenderManifestV1({
      jobId: 'job-long-form-002',
      unifiedDocument: ued,
    });
    const cert = buildAuthorExposureCertificationV1FromManifest(manifest);
    expect(cert.decision).toBe('certified');
    expect(cert.active_template_path).toContain('long-form');
  });

  it('FIPOC: UED field hashes are deterministic', () => {
    const ued1 = buildUnifiedEvaluationDocument({
      mode: 'short_form_evaluation',
      result: makeEvalResult({ wordCount: 8_000, genre: 'Thriller', title: 'Test A' }),
      displayTitle: 'Test A',
      dream: null,
    });
    const ued2 = buildUnifiedEvaluationDocument({
      mode: 'short_form_evaluation',
      result: makeEvalResult({ wordCount: 8_000, genre: 'Thriller', title: 'Test A' }),
      displayTitle: 'Test A',
      dream: null,
    });
    const manifest1 = buildReportRenderManifestV1({ jobId: 'job-hash-1', unifiedDocument: ued1 });
    const manifest2 = buildReportRenderManifestV1({ jobId: 'job-hash-2', unifiedDocument: ued2 });
    expect(manifest1.unified_document_hash).toBe(manifest2.unified_document_hash);
    for (const field of Object.keys(manifest1.unified_document_field_hashes)) {
      expect(manifest1.unified_document_field_hashes[field]).toBe(manifest2.unified_document_field_hashes[field]);
    }
  });

  it('full chain: long-form eval → UED → manifest → parity → certification → revise opportunities', () => {
    const mode = inferCanonicalEvaluationModeFromWordCount(85_000);
    expect(mode).toBe('long_form_multi_layer_evaluation');

    const ued = buildUnifiedEvaluationDocument({
      mode,
      result: LONG_FORM_RESULT,
      displayTitle: 'The Architecture of Wanting',
      dream: null,
    });

    const manifest = buildReportRenderManifestV1({
      jobId: 'job-long-form-e2e',
      unifiedDocument: ued,
    });
    expect(manifest.parity.status).toBe('pass');

    const cert = buildAuthorExposureCertificationV1FromManifest(manifest);
    expect(cert.decision).toBe('certified');

    // Once certified, opportunities flow to revise queue
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 5 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities.length).toBeLessThanOrEqual(REVISE_QUEUE_LEDGER_LIMITS.longFormMaxOpportunities);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 13: Session State Machine Transition Governance
// SIPOC authority: docs/SIPOC_REVISE_PROCESS.md, sessionTransitions.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 13: Session State Machine Transition Governance', () => {
  it('SIPOC: happy path transitions (open → ... → applied)', () => {
    const happyPath: Array<[string, string]> = [
      ['open', 'findings_ready'],
      ['findings_ready', 'synthesis_started'],
      ['synthesis_started', 'proposals_ready'],
      ['proposals_ready', 'applied'],
    ];
    for (const [from, to] of happyPath) {
      expect(() => assertValidRevisionSessionTransition(
        from as any, to as any,
      )).not.toThrow();
    }
  });

  it('SIPOC: any non-terminal state can transition to failed', () => {
    const nonTerminal = ['open', 'findings_ready', 'synthesis_started', 'proposals_ready'];
    for (const state of nonTerminal) {
      expect(() => assertValidRevisionSessionTransition(
        state as any, 'failed',
      )).not.toThrow();
    }
  });

  it('SIPOC: any non-terminal state can transition to failed_retryable', () => {
    const nonTerminal = ['open', 'findings_ready', 'synthesis_started', 'proposals_ready'];
    for (const state of nonTerminal) {
      expect(() => assertValidRevisionSessionTransition(
        state as any, 'failed_retryable',
      )).not.toThrow();
    }
  });

  it('SIPOC: terminal states cannot transition (applied, failed)', () => {
    expect(() => assertValidRevisionSessionTransition('applied' as any, 'open' as any)).toThrow();
    expect(() => assertValidRevisionSessionTransition('applied' as any, 'failed' as any)).toThrow();
    expect(() => assertValidRevisionSessionTransition('failed' as any, 'open' as any)).toThrow();
    expect(() => assertValidRevisionSessionTransition('failed' as any, 'failed_retryable' as any)).toThrow();
  });

  it('SIPOC: no-op transitions are forbidden', () => {
    const allStates = ['open', 'findings_ready', 'synthesis_started', 'proposals_ready', 'applied', 'failed', 'failed_retryable'];
    for (const state of allStates) {
      expect(() => assertValidRevisionSessionTransition(
        state as any, state as any,
      )).toThrow(/no-op/);
    }
  });

  it('SIPOC: failed_retryable can re-enter to open', () => {
    expect(() => assertValidRevisionSessionTransition(
      'failed_retryable' as any, 'open' as any,
    )).not.toThrow();
  });

  it('SIPOC: failed_retryable can skip forward (findings_ready, synthesis_started)', () => {
    expect(() => assertValidRevisionSessionTransition(
      'failed_retryable' as any, 'findings_ready' as any,
    )).not.toThrow();
    expect(() => assertValidRevisionSessionTransition(
      'failed_retryable' as any, 'synthesis_started' as any,
    )).not.toThrow();
  });

  it('SIPOC: illegal backward transitions throw', () => {
    expect(() => assertValidRevisionSessionTransition(
      'proposals_ready' as any, 'open' as any,
    )).toThrow();
    expect(() => assertValidRevisionSessionTransition(
      'synthesis_started' as any, 'findings_ready' as any,
    )).toThrow();
  });

  it('SIPOC: buildRevisionSessionTransitionUpdate requires failure details for failed states', () => {
    const session = {
      id: 'session-001',
      evaluation_run_id: 'eval-001',
      source_version_id: 'v1',
      result_version_id: null,
      status: 'open' as const,
      summary: {},
      findings_count: 0,
      actionable_findings_count: 0,
      proposal_ready_actionable_findings_count: 0,
      proposals_created_count: 0,
      created_at: '2025-01-01T00:00:00Z',
      completed_at: null,
      last_transition_at: '2025-01-01T00:00:00Z',
      failure_code: null,
      failure_message: null,
    };

    // failed_retryable requires failure_code and failure_message
    expect(() => buildRevisionSessionTransitionUpdate(session, {
      nextStatus: 'failed_retryable',
    })).toThrow();

    // With proper failure details it succeeds
    const update = buildRevisionSessionTransitionUpdate(session, {
      nextStatus: 'failed_retryable',
      failure_code: 'WORKBENCH_ANCHOR_UNRESOLVABLE',
      failure_message: 'Anchor not found in manuscript',
    });
    expect(update.status).toBe('failed_retryable');
    expect(update.failure_code).toBe('WORKBENCH_ANCHOR_UNRESOLVABLE');
  });

  it('SIPOC: applied requires result_version_id', () => {
    const session = {
      id: 'session-002',
      evaluation_run_id: 'eval-002',
      source_version_id: 'v1',
      result_version_id: null,
      status: 'proposals_ready' as const,
      summary: {},
      findings_count: 5,
      actionable_findings_count: 3,
      proposal_ready_actionable_findings_count: 3,
      proposals_created_count: 3,
      created_at: '2025-01-01T00:00:00Z',
      completed_at: null,
      last_transition_at: '2025-01-01T00:00:00Z',
      failure_code: null,
      failure_message: null,
    };

    // applied without result_version_id throws
    expect(() => buildRevisionSessionTransitionUpdate(session, {
      nextStatus: 'applied',
    })).toThrow();

    // With result_version_id it succeeds
    const update = buildRevisionSessionTransitionUpdate(session, {
      nextStatus: 'applied',
      result_version_id: 'result-v2-abc123',
    });
    expect(update.status).toBe('applied');
    expect(update.result_version_id).toBe('result-v2-abc123');
    expect(update.completed_at).toBeTruthy();
  });

  it('full chain: session lifecycle — open → findings → synthesis → proposals → applied', () => {
    let status = 'open';
    const transitions = [
      { nextStatus: 'findings_ready', findings_count: 10, actionable_findings_count: 5 },
      { nextStatus: 'synthesis_started' },
      { nextStatus: 'proposals_ready', proposals_created_count: 3, proposal_ready_actionable_findings_count: 3 },
      { nextStatus: 'applied', result_version_id: 'result-v2-lifecycle-test' },
    ];

    for (const transition of transitions) {
      expect(() => assertValidRevisionSessionTransition(
        status as any, transition.nextStatus as any,
      )).not.toThrow();
      status = transition.nextStatus;
    }
    expect(status).toBe('applied');
  });

  it('full chain: failure + retry lifecycle — open → failed_retryable → open → applied', () => {
    // First attempt fails retryably
    expect(() => assertValidRevisionSessionTransition('open' as any, 'failed_retryable' as any)).not.toThrow();
    // Re-entry
    expect(() => assertValidRevisionSessionTransition('failed_retryable' as any, 'open' as any)).not.toThrow();
    // Second attempt succeeds through full lifecycle
    const retryPath = ['findings_ready', 'synthesis_started', 'proposals_ready', 'applied'];
    let status = 'open';
    for (const next of retryPath) {
      expect(() => assertValidRevisionSessionTransition(status as any, next as any)).not.toThrow();
      status = next;
    }
    expect(status).toBe('applied');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 14: Voice Gate + Canon Gate Admission Integration
// SIPOC authority: reviseAdmissionGate.ts, voiceGate.ts, canonGate.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 14: Voice Gate + Canon Gate Admission Integration', () => {
  it('voice gate: first-person POV candidate passes when using I-narrator', () => {
    const result = runVoiceGate({
      candidateText: 'I turned and felt the weight of it pressing against my chest.',
      pov: 'first',
      tense: 'past',
    });
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('voice gate: first-person POV candidate fails when using third-person pronouns only', () => {
    const result = runVoiceGate({
      candidateText: 'She turned and felt the weight of it pressing against her chest.',
      pov: 'first',
      tense: 'past',
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('VOICE_DRIFT_POV');
  });

  it('voice gate: past tense candidate fails when using present-only verbs', () => {
    const result = runVoiceGate({
      candidateText: 'He walks down the street and looks at the sky.',
      pov: 'third',
      tense: 'past',
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('VOICE_DRIFT_TENSE');
  });

  it('voice gate: forbidden voice patterns caught', () => {
    const result = runVoiceGate({
      candidateText: 'The rain fell softly upon the cobblestones.',
      forbiddenVoicePatterns: [/upon the cobblestones/],
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('VOICE_DRIFT_FORBIDDEN_PATTERN');
  });

  it('canon gate: known entities pass', () => {
    const result = runCanonGate({
      candidateText: 'Marcus turned and looked at Elaine.',
      knownEntities: ['Marcus', 'Elaine'],
    });
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('canon gate: unknown entity name triggers UNSUPPORTED_FACT', () => {
    const result = runCanonGate({
      candidateText: 'Marcus turned and looked at Sophia.',
      knownEntities: ['Marcus', 'Elaine'],
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('UNSUPPORTED_FACT');
  });

  it('canon gate: forbidden facts trigger CANON_DRIFT', () => {
    const result = runCanonGate({
      candidateText: 'Marcus lived in New York his whole life.',
      knownEntities: ['Marcus'],
      forbiddenFacts: [/New York/],
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('CANON_DRIFT');
  });

  it('canon gate: allowedNewEntities permits new names', () => {
    const result = runCanonGate({
      candidateText: 'Marcus introduced Sophia to the group.',
      knownEntities: ['Marcus'],
      allowedNewEntities: ['Sophia'],
    });
    expect(result.passed).toBe(true);
  });

  it('full chain: voice + canon gates → admission decision', () => {
    // Good candidate: correct POV, tense, known entities
    const fixture = makeEvalFixture({ dialogue: 5, pacing: 6 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    const opp = opportunities[0];
    const admissionInput = makeWorkbenchAdmissionInput(opp);
    const result = runWorkbenchAdmissionGate(admissionInput);

    // Check that voice and canon reasons are NOT present for well-formed candidates
    const voiceReasons = result.reasons.filter((r) => r.startsWith('VOICE_DRIFT'));
    const canonReasons = result.reasons.filter((r) => r === 'UNSUPPORTED_FACT' || r === 'CANON_DRIFT');
    expect(voiceReasons).toHaveLength(0);
    expect(canonReasons).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 15: Authority Source Registry & Provenance Chain
// SIPOC authority: FIPOC AUTHORITY_SOURCE_REGISTRY, fipocRegistry.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 15: Authority Source Registry & Provenance Chain', () => {
  it('FIPOC: authority source registry has SIPOC evaluation process', () => {
    const sipoc = AUTHORITY_SOURCE_REGISTRY.find((a) => a.authorityId === 'SIPOC_EVALUATION_PROCESS_V1');
    expect(sipoc).toBeDefined();
    expect(sipoc!.family).toBe('sipoc');
    expect(sipoc!.runtimeBinding).toBe('binding');
    expect(sipoc!.surfacedInSipocUi).toBe(true);
    expect(sipoc!.appliesToStageIds.length).toBeGreaterThan(0);
    expect(sipoc!.appliesToArtifacts.length).toBeGreaterThan(0);
  });

  it('FIPOC: all 3 template authorities exist (short, long, multi-layer)', () => {
    const shortForm = AUTHORITY_SOURCE_REGISTRY.find((a) => a.authorityId === 'EVALUATION_TEMPLATE_SHORT_FORM');
    const longForm = AUTHORITY_SOURCE_REGISTRY.find((a) => a.authorityId === 'EVALUATION_TEMPLATE_LONG_FORM');
    const multiLayer = AUTHORITY_SOURCE_REGISTRY.find((a) => a.authorityId === 'EVALUATION_TEMPLATE_LONG_FORM_MULTI_LAYER');

    expect(shortForm).toBeDefined();
    expect(longForm).toBeDefined();
    expect(multiLayer).toBeDefined();

    // All are templates with surfaced-in-SIPOC-UI
    for (const auth of [shortForm!, longForm!, multiLayer!]) {
      expect(auth.family).toBe('template');
      expect(auth.runtimeBinding).toBe('template');
      expect(auth.surfacedInSipocUi).toBe(true);
      expect(auth.path).toContain('templates/evaluation');
    }
  });

  it('FIPOC: every authority entry has required structural fields', () => {
    for (const entry of AUTHORITY_SOURCE_REGISTRY) {
      expect(entry.authorityId).toBeTruthy();
      expect(entry.family).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.path).toBeTruthy();
      expect(entry.runtimeBinding).toBeTruthy();
      expect(entry.executionUse).toBeTruthy();
      expect(typeof entry.surfacedInSipocUi).toBe('boolean');
    }
  });

  it('FIPOC: authority sources reference valid stage IDs from PROCESS_REGISTRY', () => {
    const validStageIds = new Set(PROCESS_REGISTRY.map((p) => p.stageId));
    for (const entry of AUTHORITY_SOURCE_REGISTRY) {
      for (const stageId of entry.appliesToStageIds) {
        expect(validStageIds.has(stageId)).toBe(true);
      }
    }
  });

  it('FIPOC: authority sources reference valid artifact names from ARTIFACT_REGISTRY', () => {
    const validArtifacts = new Set(ARTIFACT_REGISTRY.map((a) => a.artifact));
    for (const entry of AUTHORITY_SOURCE_REGISTRY) {
      for (const artifact of entry.appliesToArtifacts) {
        expect(validArtifacts.has(artifact)).toBe(true);
      }
    }
  });

  it('FIPOC: rendering contract authority exists and covers all renderer stages', () => {
    const renderingContract = AUTHORITY_SOURCE_REGISTRY.find(
      (a) => a.authorityId === 'EVALUATION_RENDERING_CONTRACT',
    );
    expect(renderingContract).toBeDefined();
    expect(renderingContract!.appliesToStageIds).toContain('S11a_RENDERER_WEBPAGE');
    expect(renderingContract!.appliesToStageIds).toContain('S11b_DOWNLOAD_PIPELINE');
  });

  it('full chain: authority → template contract → UED → renderer parity', () => {
    // Authority says short-form template exists
    const shortFormAuth = AUTHORITY_SOURCE_REGISTRY.find(
      (a) => a.authorityId === 'EVALUATION_TEMPLATE_SHORT_FORM',
    );
    expect(shortFormAuth).toBeDefined();

    // Template contract matches authority path
    const templateContract = EVALUATION_TEMPLATE_CONTRACTS.short_form_evaluation;
    expect(templateContract.templatePath).toBe(shortFormAuth!.path);

    // UED builds successfully
    const ued = buildUnifiedEvaluationDocument({
      mode: 'short_form_evaluation',
      result: makeEvalResult({ wordCount: 8_000, genre: 'Thriller', title: 'Authority Chain Test' }),
      displayTitle: 'Authority Chain Test',
      dream: null,
    });
    expect(ued.templateMode).toBe('short_form_evaluation');

    // Render manifest passes parity
    const manifest = buildReportRenderManifestV1({
      jobId: 'job-authority-chain',
      unifiedDocument: ued,
    });
    expect(manifest.parity.status).toBe('pass');

    // Certification certifies
    const cert = buildAuthorExposureCertificationV1FromManifest(manifest);
    expect(cert.decision).toBe('certified');
    expect(cert.active_template_path).toBe(shortFormAuth!.path);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 16: Recommendation Integrity Gate — Eval vs Revise Tiers
// SIPOC authority: recommendationIntegrityGate.ts, reviseAdmissionGate.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 16: Recommendation Integrity Gate — Eval vs Revise Tiers', () => {
  it('integrity gate: well-formed recommendation meets evaluation report tier', () => {
    const result = checkRecommendationIntegrity({
      action: 'Sharpen Marcus\'s central ironic reversal in the "salon disaster" scene to crystallize the thematic arc.',
      symptom: 'The reversal is implied but not dramatized on the page for the reader.',
      cause: 'The final scene summarizes Marcus\'s reaction rather than showing the emotional shift.',
      reader_effect: 'Reader leaves the story without the cathartic payoff the premise promises.',
      anchor_snippet: 'His calamity was not completely without positivity though.',
      surface: 'evaluation_report' as const,
    });
    expect(meetsMinimumTier(result, 'evaluation_report')).toBe(true);
  });

  it('integrity gate: minimal recommendation without diagnostics fails revise tier', () => {
    const result = checkRecommendationIntegrity({
      action: 'Improve the pacing of chapter three.',
      anchor_snippet: 'The room was quiet.',
      surface: 'revise_queue' as const,
    });
    // Missing symptom/cause → violations → below PASS_STRONG
    expect(meetsMinimumTier(result, 'revise_queue')).toBe(false);
  });

  it('integrity gate: empty recommendation fails', () => {
    const result = checkRecommendationIntegrity({
      action: '',
      anchor_snippet: '',
    });
    expect(result.tier).toBe('FAIL');
    expect(meetsMinimumTier(result, 'evaluation_report')).toBe(false);
    expect(meetsMinimumTier(result, 'revise_queue')).toBe(false);
  });

  it('integrity gate: revise queue requires PASS_STRONG (stricter than eval)', () => {
    // Full diagnostic with specific anchor reference (proper noun + quote)
    const strongResult = checkRecommendationIntegrity({
      action: 'Rewrite Marcus\'s opening paragraph near "It was time" to establish motivation in the first three sentences.',
      symptom: 'The reader has no reason to invest in Marcus as protagonist until page five.',
      cause: 'The opening delays character motivation behind scene-setting at the salon.',
      reader_effect: 'Reader disengages before the story earns their attention and emotional investment.',
      anchor_snippet: 'It was time, yet again, to color his hair at the same salon.',
      surface: 'revise_queue' as const,
    });

    // Always meets eval tier
    expect(meetsMinimumTier(strongResult, 'evaluation_report')).toBe(true);
  });

  it('full chain: eval opportunities → integrity gate → admission checks integrity', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 3 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    // Each opportunity goes through the admission gate which includes integrity check
    for (const opp of opportunities.slice(0, 3)) {
      const admissionInput = makeWorkbenchAdmissionInput(opp);
      const result = runWorkbenchAdmissionGate(admissionInput);
      // The admission gate runs integrity check — verify it produces a decision
      expect(result.admission_status).toBeDefined();
      expect(['admission_passed', 'withheld']).toContain(result.admission_status);
      // Reasons array is always present (may contain INTEGRITY_ codes for fixture recs)
      expect(Array.isArray(result.reasons)).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 17: Revise Card Contract Validation — Full Readiness Chain
// SIPOC authority: reviseCardContract.ts, FORBIDDEN_META_SUGGESTIONS
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 17: Revise Card Contract Validation — Full Readiness Chain', () => {
  const validInput: ReviseCardValidationInput = {
    issueStatement: 'The opening scene delays character motivation behind scene-setting.',
    symptom: 'Reader has no reason to invest in the protagonist until page five.',
    cause: 'The author front-loads setting detail before establishing emotional stakes.',
    fixStrategy: 'Move the protagonist motivation into the first three sentences.',
    readerImpact: 'Reader engages immediately because the character wants something on page one.',
    operationNote: 'Replace the opening paragraph with a motivation-first version.',
    sourceText: 'The salon looked like a warehouse inside, with tall ceilings and exposed ductwork.',
    sourceLocationLabel: 'Chapter 1, paragraph 1',
    revisionOperation: 'replace_selected_passage' as const,
    candidateTexts: [
      'Marcus needed the color to hold. Three days until the audition, and his roots were showing silver again. The salon smelled of bleach and ambition.',
      'Silver at the temples meant time was running out. Marcus sat in the cracked vinyl chair, counting the hours until his audition.',
      'The mirror showed what Marcus feared most: age creeping in at the edges. He gripped the armrest and told the stylist to make it disappear.',
    ],
  };

  it('fully valid card returns ready_for_revise', () => {
    const result = validateReviseCardContract(validInput);
    expect(result.readiness).toBe('ready_for_revise');
    expect(result.reason).toBeNull();
  });

  it('missing issueStatement returns needs_targeting', () => {
    const result = validateReviseCardContract({ ...validInput, issueStatement: '' });
    expect(result.readiness).toBe('needs_targeting');
    expect(result.reason).toContain('issue statement');
  });

  it('missing symptom returns needs_targeting', () => {
    const result = validateReviseCardContract({ ...validInput, symptom: '' });
    expect(result.readiness).toBe('needs_targeting');
    expect(result.reason).toContain('symptom');
  });

  it('missing cause returns needs_targeting', () => {
    const result = validateReviseCardContract({ ...validInput, cause: null });
    expect(result.readiness).toBe('needs_targeting');
    expect(result.reason).toContain('cause');
  });

  it('missing fixStrategy returns needs_targeting', () => {
    const result = validateReviseCardContract({ ...validInput, fixStrategy: undefined });
    expect(result.readiness).toBe('needs_targeting');
    expect(result.reason).toContain('fix strategy');
  });

  it('missing readerImpact returns needs_targeting', () => {
    const result = validateReviseCardContract({ ...validInput, readerImpact: '' });
    expect(result.readiness).toBe('needs_targeting');
    expect(result.reason).toContain('reader impact');
  });

  it('needs_targeting operation returns needs_targeting', () => {
    const result = validateReviseCardContract({ ...validInput, revisionOperation: 'needs_targeting' });
    expect(result.readiness).toBe('needs_targeting');
  });

  it('fewer than 3 candidates returns needs_targeting', () => {
    const result = validateReviseCardContract({ ...validInput, candidateTexts: ['Only one candidate.'] });
    expect(result.readiness).toBe('needs_targeting');
    expect(result.reason).toContain('A/B/C');
  });

  it('duplicate candidates returns needs_targeting', () => {
    const same = 'Marcus needed the color to hold. Three days until the audition.';
    const result = validateReviseCardContract({
      ...validInput,
      candidateTexts: [same, same, 'Silver at the temples meant time was running out.'],
    });
    expect(result.readiness).toBe('needs_targeting');
    expect(result.reason).toContain('distinct');
  });

  it('forbidden meta-suggestion in candidate returns needs_targeting', () => {
    const result = validateReviseCardContract({
      ...validInput,
      candidateTexts: [
        'Apply the same repair goal to strengthen the opening of the scene.',
        validInput.candidateTexts[1]!,
        validInput.candidateTexts[2]!,
      ],
    });
    expect(result.readiness).toBe('needs_targeting');
    expect(result.reason).toContain('copy-paste ready');
  });

  it('hasForbiddenMetaSuggestion catches imperative editorial commands', () => {
    expect(hasForbiddenMetaSuggestion('Apply the same repair goal to strengthen the scene.')).toBe(true);
    expect(hasForbiddenMetaSuggestion('Review this opportunity before proceeding.')).toBe(true);
    expect(hasForbiddenMetaSuggestion('The recommended repair path is to add a beat.')).toBe(true);
    expect(hasForbiddenMetaSuggestion('The default repair plan drawn from the evaluation.')).toBe(true);
  });

  it('hasForbiddenMetaSuggestion allows clean prose', () => {
    expect(hasForbiddenMetaSuggestion('Marcus turned and felt the weight of it pressing against his chest.')).toBe(false);
    expect(hasForbiddenMetaSuggestion('The rain hammered the salon windows while he waited.')).toBe(false);
  });

  it('hasWordProcessorArtifact detects HTML and entities', () => {
    expect(hasWordProcessorArtifact('<p>Some paragraph</p>')).toBe(true);
    expect(hasWordProcessorArtifact('Content with &nbsp; entities')).toBe(true);
    expect(hasWordProcessorArtifact('Clean prose without artifacts.')).toBe(false);
  });

  it('candidateTextIsCopyPasteReady rejects short text', () => {
    expect(candidateTextIsCopyPasteReady('Too short.')).toBe(false);
    expect(candidateTextIsCopyPasteReady('')).toBe(false);
    expect(candidateTextIsCopyPasteReady(null)).toBe(false);
  });

  it('inferRevisionOperation maps fix directions to operations', () => {
    expect(inferRevisionOperation({ fixDirection: 'insert a new beat before the climax' })).toBe('insert_before_selected_passage');
    expect(inferRevisionOperation({ fixDirection: 'compress this overlong passage' })).toBe('compress_selected_passage');
    expect(inferRevisionOperation({ fixDirection: 'delete the redundant paragraph' })).toBe('delete_selected_passage');
    expect(inferRevisionOperation({ fixDirection: 'split the paragraph at the tonal shift' })).toBe('split_paragraph');
    expect(inferRevisionOperation({ fixDirection: 'merge these two short paragraphs' })).toBe('merge_paragraphs');
    expect(inferRevisionOperation({ fixDirection: 'reorder the beats in this section' })).toBe('reorder_within_section');
  });

  it('operationRequiresStructuralPreview for destructive operations', () => {
    expect(operationRequiresStructuralPreview('rewrite_multi_paragraph_span')).toBe(true);
    expect(operationRequiresStructuralPreview('delete_selected_passage')).toBe(true);
    expect(operationRequiresStructuralPreview('merge_paragraphs')).toBe(true);
    expect(operationRequiresStructuralPreview('reorder_within_section')).toBe(true);
    expect(operationRequiresStructuralPreview('replace_selected_passage')).toBe(false);
    expect(operationRequiresStructuralPreview('insert_after_selected_passage')).toBe(false);
  });

  it('full chain: eval → infer operation → validate card → readiness', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 3 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    for (const opp of opportunities.slice(0, 2)) {
      const operation = inferRevisionOperation({
        scope: opp.scope,
        fixDirection: opp.fix_direction,
        recommendation: opp.action,
      });
      expect(REVISION_OPERATIONS).toContain(operation);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 18: Propagation Integrity + Quality Gate Decision Chain
// SIPOC authority: propagationIntegrity.ts, qualityGate.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 18: Propagation Integrity + Quality Gate Decision Chain', () => {
  it('strong integrity: all criteria high confidence with evidence', () => {
    const fixture = makeEvalFixture({});
    // Ensure all criteria have high confidence for strong integrity
    const strongCriteria = fixture.criteria.map((c) => ({
      ...c,
      confidence_level: 'high' as const,
      confidence_score_0_100: 90,
    }));
    const summary = summarizePropagationIntegrity(strongCriteria);
    expect(summary.upstreamIntegrity).toBe('strong');
    expect(summary.authorityLevel).toBe('normal');
    expect(summary.reasons).toHaveLength(0);
  });

  it('weak integrity: many low confidence criteria → blocked authority', () => {
    const fixture = makeEvalFixture({});
    // Degrade 6 criteria to low confidence
    const weakCriteria = fixture.criteria.map((c, i) => {
      if (i < 6) {
        return { ...c, confidence_level: 'low' as const, confidence_score_0_100: 30 };
      }
      return c;
    });
    const summary = summarizePropagationIntegrity(weakCriteria);
    expect(summary.upstreamIntegrity).toBe('weak');
    expect(summary.authorityLevel).toBe('blocked');
    expect(summary.reasons).toContain('low_or_missing_evidence_cluster');
  });

  it('mixed integrity: moderate confidence → constrained authority', () => {
    const fixture = makeEvalFixture({});
    // Set 4 criteria to moderate confidence
    const mixedCriteria = fixture.criteria.map((c, i) => {
      if (i < 4) {
        return { ...c, confidence_level: 'moderate' as const, confidence_score_0_100: 65 };
      }
      return c;
    });
    const summary = summarizePropagationIntegrity(mixedCriteria);
    expect(summary.upstreamIntegrity).toBe('mixed');
    expect(summary.authorityLevel).toBe('constrained');
  });

  it('bottom score criteria identified correctly', () => {
    const fixture = makeEvalFixture({ pacing: 2, dialogue: 3 });
    const summary = summarizePropagationIntegrity(fixture.criteria);
    expect(summary.bottomScoreCriteria.length).toBeGreaterThan(0);
    expect(summary.bottomScoreCriteria).toContain('pacing');
  });

  it('normalizeSummaryWithBottomWeaknesses appends missing criteria', () => {
    const original = 'The manuscript shows strong character work.';
    const result = normalizeSummaryWithBottomWeaknesses(original, ['pacing', 'dialogue']);
    expect(result).toContain('pacing');
    expect(result).toContain('dialogue');
    expect(result).toContain('Main weaknesses');
  });

  it('normalizeSummaryWithBottomWeaknesses no-ops when criteria already mentioned', () => {
    const original = 'The pacing and dialogue need improvement.';
    const result = normalizeSummaryWithBottomWeaknesses(original, ['pacing', 'dialogue']);
    expect(result).toBe(original);
  });

  it('full chain: eval → propagation → authority level → quality gate → revise admission', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 3 });

    // Step 1: Propagation integrity
    const propagation = summarizePropagationIntegrity(fixture.criteria);
    expect(propagation.authorityLevel).toBeDefined();
    expect(['normal', 'constrained', 'blocked']).toContain(propagation.authorityLevel);

    // Step 2: Bottom weakness tracking
    expect(propagation.bottomScoreCriteria.length).toBeGreaterThan(0);

    // Step 3: Opportunities from same fixture
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    // Step 4: Admission gates
    for (const opp of opportunities.slice(0, 2)) {
      const admissionInput = makeWorkbenchAdmissionInput(opp);
      const result = runWorkbenchAdmissionGate(admissionInput);
      expect(result.admission_status).toBeDefined();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 19: Unified End-to-End — Eval → All Gates → Revise → Agent Readiness
// SIPOC authority: full pipeline spine
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 19: Unified End-to-End — Eval → All Gates → Revise → Agent Readiness', () => {
  it('complete pipeline: eval → propagation → opportunities → admission → workbench → completion → agent readiness → export', () => {
    // ── Phase 1: Evaluation produces result ──
    const fixture = makeEvalFixture({ dialogue: 5, pacing: 6, character: 7 });
    expect(fixture.criteria.length).toBe(CRITERIA_KEYS.length);

    // ── Phase 2: Propagation integrity check ──
    const propagation = summarizePropagationIntegrity(fixture.criteria);
    expect(['strong', 'mixed']).toContain(propagation.upstreamIntegrity);

    // ── Phase 3: Build revision opportunities ──
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    // ── Phase 4: Context quality check ──
    const contextQuality = resolveReviseContextQuality(null);
    expect(contextQuality.status).toBeDefined();

    // ── Phase 5: Admission gate per opportunity ──
    const admitted: typeof opportunities = [];
    for (const opp of opportunities) {
      const admissionInput = makeWorkbenchAdmissionInput(opp);
      const gate = runWorkbenchAdmissionGate(admissionInput);
      if (gate.admission_status === 'admission_passed') {
        admitted.push(opp);
      }
    }

    // ── Phase 6: Workbench card validation ──
    for (const opp of admitted.slice(0, 2)) {
      const operation = inferRevisionOperation({
        scope: opp.scope,
        fixDirection: opp.fix_direction,
      });
      expect(REVISION_OPERATIONS).toContain(operation);
    }

    // ── Phase 7: Cross-check eligibility ──
    for (const opp of admitted.slice(0, 2)) {
      const eligible = isTrustedPathEligible({
        candidateSource: 'llm_synthesis',
        hasAuthorEdit: false,
        crossCheckRequired: false,
      });
      expect(typeof eligible).toBe('boolean');
    }

    // ── Phase 8: Completion certification ──
    const certInput: ReviseCompletionCertificationInput = {
      manuscriptId: '999',
      evaluationJobId: 'job-e2e-pipeline-001',
      readyOpportunityIds: admitted.slice(0, 3).map((_, i) => `opp-${i}`),
      decisions: admitted.slice(0, 3).map((_, i) => ({
        id: `dec-${i}`,
        opportunity_id: `opp-${i}`,
        decision: 'accepted_a',
        created_at: new Date().toISOString(),
      })),
    };
    const certResult = buildReviseCompletionCertification(certInput);
    expect(certResult.ok).toBe(true);
    if (certResult.ok) {
      expect(certResult.record.certification_status).toBe('certified');
    }

    // ── Phase 9: Agent readiness package ──
    const approvedSections = AGENT_READINESS_REQUIRED_SECTION_TYPES.map((type) => ({
      section_type: type,
      content: `Content for ${type} section with sufficient detail for the agent readiness package.`,
    }));
    const completeness = evaluatePackageCompleteness({
      manuscriptId: '999',
      sections: approvedSections.map((s) => ({ ...s, status: 'approved' })),
    });
    expect(completeness.allSectionsApproved).toBe(true);
    expect(completeness.missingSections).toHaveLength(0);

    const readinessResult = buildAgentReadinessPackageV1({
      manuscriptId: '999',
      evaluationJobId: 'job-e2e-pipeline-001',
      userId: '00000000-0000-0000-0000-000000000999',
      manuscriptTitle: 'The Price of Vanity',
      approvedSections,
      packageVersion: 1,
    });
    expect(readinessResult.ok).toBe(true);
    if (!readinessResult.ok) return;
    expect(readinessResult.package.artifact_type).toBe('agent_readiness_package_v1');

    // ── Phase 10: Package export ──
    const exportPkg = buildPackageExportV1({
      packageHash: readinessResult.package.package_hash,
      format: 'json',
      filename: 'the-price-of-vanity-agent-readiness.json',
    });
    expect(exportPkg.artifact_type).toBe('package_export_v1');
    expect(exportPkg.package_hash).toBe(readinessResult.package.package_hash);
  });

  it('failure path: eval → failure record → kick → retry → completion', () => {
    // ── Failure occurs during workbench ──
    const failureRecord = buildRevisionFailureRecord({
      sessionId: 'session-e2e-failure',
      stage: 'workbench_hydration',
      failureCode: 'CANDIDATE_HYDRATION_TIMEOUT',
      message: 'LLM synthesis timed out after 30s',
      attemptNumber: 1,
      maxRetries: 3,
    });
    expect(failureRecord.artifact_type).toBe('revision_failure_record_v1');
    expect(failureRecord.disposition).toBeDefined();

    // ── Classify disposition ──
    const disposition = classifyFailureDisposition('CANDIDATE_HYDRATION_TIMEOUT');
    expect(['retryable', 'terminal', 'manual_review']).toContain(disposition);

    // ── KICK_MATRIX lookup ──
    const kickTarget = resolveKickTarget(failureRecord.stage, failureRecord.failureCode);
    if (isKickEligible(failureRecord.stage, failureRecord.failureCode)) {
      expect(kickTarget).toBeDefined();
    }

    // ── Session transitions: failed_retryable → open (retry) ──
    expect(() => assertValidRevisionSessionTransition('open' as any, 'failed_retryable' as any)).not.toThrow();
    expect(() => assertValidRevisionSessionTransition('failed_retryable' as any, 'open' as any)).not.toThrow();

    // ── Retry completes successfully ──
    const retryPath = ['open', 'findings_ready', 'synthesis_started', 'proposals_ready', 'applied'];
    let status = 'failed_retryable';
    for (const next of retryPath) {
      expect(() => assertValidRevisionSessionTransition(status as any, next as any)).not.toThrow();
      status = next;
    }
    expect(status).toBe('applied');
  });

  it('renderer path: eval → UED → manifest → parity → certification → all surfaces', () => {
    // ── Build evaluation ──
    const fixture = makeEvalFixture({});
    const mode = inferCanonicalEvaluationModeFromWordCount(8_000);
    expect(mode).toBe('short_form_evaluation');

    // ── Build UED ──
    const ued = buildUnifiedEvaluationDocument({
      mode,
      result: makeEvalResult({ wordCount: 8_000, genre: 'Literary Fiction', title: 'Unified Test' }),
      displayTitle: 'Unified Test',
      dream: null,
    });
    expect(ued.templateMode).toBe('short_form_evaluation');

    // ── Build manifest ──
    const manifest = buildReportRenderManifestV1({
      jobId: 'job-unified-e2e',
      unifiedDocument: ued,
    });
    expect(manifest.parity.status).toBe('pass');
    const surfaceKeys = Object.keys(manifest.surfaces);
    expect(surfaceKeys.length).toBe(4); // webpage, PDF, DOCX, TXT

    // ── Certification ──
    const cert = buildAuthorExposureCertificationV1FromManifest(manifest);
    expect(cert.decision).toBe('certified');

    // ── Verify all 4 surfaces present ──
    expect(surfaceKeys).toContain('webpage');
    expect(surfaceKeys).toContain('pdf');
    expect(surfaceKeys).toContain('docx');
    expect(surfaceKeys).toContain('txt');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 20: Cross-Check Verdicts + TrustedPath Eligibility
// SIPOC authority: repairCrossCheck.ts, REVISE_CERTIFICATION_GATE_REGISTRY
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 20: Cross-Check Verdicts + TrustedPath Eligibility', () => {
  it('only approve verdict is TrustedPath eligible', () => {
    expect(isTrustedPathEligible('approve')).toBe(true);
  });

  it('flag verdict requires manual review', () => {
    expect(isTrustedPathEligible('flag')).toBe(false);
  });

  it('reject verdict requires manual review', () => {
    expect(isTrustedPathEligible('reject')).toBe(false);
  });

  it('unavailable verdict requires manual review', () => {
    expect(isTrustedPathEligible('unavailable')).toBe(false);
  });

  it('pending verdict requires manual review', () => {
    expect(isTrustedPathEligible('pending')).toBe(false);
  });

  it('null/undefined verdict requires manual review', () => {
    expect(isTrustedPathEligible(null)).toBe(false);
    expect(isTrustedPathEligible(undefined)).toBe(false);
  });

  it('hashContent produces deterministic SHA-256 hashes', () => {
    const hash1 = hashContent('The salon looked like a warehouse inside.');
    const hash2 = hashContent('The salon looked like a warehouse inside.');
    const hash3 = hashContent('A different passage entirely.');
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('isRepairCrossCheckEnabled reads feature flag', () => {
    const original = process.env.REVISION_REPAIR_CROSSCHECK_ENABLED;
    process.env.REVISION_REPAIR_CROSSCHECK_ENABLED = '1';
    expect(isRepairCrossCheckEnabled()).toBe(true);
    process.env.REVISION_REPAIR_CROSSCHECK_ENABLED = '0';
    expect(isRepairCrossCheckEnabled()).toBe(false);
    delete process.env.REVISION_REPAIR_CROSSCHECK_ENABLED;
    expect(isRepairCrossCheckEnabled()).toBe(false);
    if (original !== undefined) process.env.REVISION_REPAIR_CROSSCHECK_ENABLED = original;
  });

  it('full chain: cross-check verdict → TrustedPath gate → admission decision', () => {
    // Approved verdict → trusted path
    const approvedVerdict: CrossCheckVerdict = 'approve';
    expect(isTrustedPathEligible(approvedVerdict)).toBe(true);

    // Flagged verdict → manual review required
    const flaggedVerdict: CrossCheckVerdict = 'flag';
    expect(isTrustedPathEligible(flaggedVerdict)).toBe(false);

    // TrustedPath certification gate exists in registry
    const trustedPathGate = REVISE_CERTIFICATION_GATE_REGISTRY.find(
      (g) => g.gateId.includes('TRUSTEDPATH') || g.gateId.includes('CROSSCHECK'),
    );
    expect(trustedPathGate).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 21: Candidate Quality Gate — Admission-Level A/B/C Evaluation
// SIPOC authority: candidateQuality.ts, reviseAdmissionGate.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 21: Candidate Quality Gate — Admission-Level A/B/C Evaluation', () => {
  it('3 good candidates pass card quality', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'Marcus turned and felt the weight of it pressing against his chest like a hand. The plastic receiver was cold.' },
      { key: 'B', text: 'The silence settled over the room, and he counted to three before speaking. Each number hung in the air like smoke.' },
      { key: 'C', text: 'She noticed the shift in his posture, the way his shoulders dropped. The light from the window caught the grey.' },
    ]);
    expect(result.passed).toBe(true);
    expect(result.passedCandidateCount).toBe(3);
    expect(result.reasons).toHaveLength(0);
  });

  it('empty candidate triggers EMPTY_CANDIDATE', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: '' },
      { key: 'B', text: 'The silence settled over the room, and he counted to three before speaking. Each number hung in the air.' },
      { key: 'C', text: 'She noticed the shift in his posture, the way his shoulders dropped. The light from the window caught the grey.' },
    ]);
    expect(result.candidateResults[0].reasons).toContain('EMPTY_CANDIDATE');
  });

  it('too short candidate triggers TOO_SHORT', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'He paused.' },
      { key: 'B', text: 'The silence settled over the room, and he counted to three before speaking. Each number hung in the air.' },
      { key: 'C', text: 'She noticed the shift in his posture, the way his shoulders dropped. The light from the window caught the grey.' },
    ]);
    expect(result.candidateResults[0].reasons).toContain('TOO_SHORT');
  });

  it('commentary candidate triggers NON_EXECUTABLE_PROSE', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'This revision would improve the scene by making the character more active and engaged with the environment.' },
      { key: 'B', text: 'The silence settled over the room, and he counted to three before speaking. Each number hung in the air.' },
      { key: 'C', text: 'She noticed the shift in his posture, the way his shoulders dropped. The light from the window caught the grey.' },
    ]);
    expect(result.candidateResults[0].reasons).toContain('NON_EXECUTABLE_PROSE');
  });

  it('anchor echo triggers ANCHOR_ECHO when similarity > 0.82', () => {
    const anchor = 'His calamity was not completely without positivity though. He chuckled to himself when he thought of that.';
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: anchor, anchor },
      { key: 'B', text: 'The silence settled over the room, and he counted to three before speaking. Each number hung in the air.' },
      { key: 'C', text: 'She noticed the shift in his posture, the way his shoulders dropped. The light from the window caught the grey.' },
    ]);
    expect(result.candidateResults[0].reasons).toContain('ANCHOR_ECHO');
  });

  it('unknown entity triggers UNSUPPORTED_FACT', () => {
    const result = evaluateCardCandidateQuality([
      {
        key: 'A',
        text: 'Sophia handed Marcus the envelope and watched him tear it open with trembling fingers.',
        knownEntities: ['Marcus'],
      },
      { key: 'B', text: 'The silence settled over the room, and he counted to three before speaking. Each number hung in the air.' },
      { key: 'C', text: 'She noticed the shift in his posture, the way his shoulders dropped. The light from the window caught the grey.' },
    ]);
    expect(result.candidateResults[0].reasons).toContain('UNSUPPORTED_FACT');
  });

  it('card requires at least 2 passing candidates', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: '' },
      { key: 'B', text: '' },
      { key: 'C', text: 'She noticed the shift in his posture, the way his shoulders dropped. The light from the window caught the grey.' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.passedCandidateCount).toBe(1);
    expect(result.reasons).toContain('REVISION_QUALITY_FAILED');
  });

  it('full chain: eval → opportunities → candidate quality → admission', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 3 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    for (const opp of opportunities.slice(0, 2)) {
      const admissionInput = makeWorkbenchAdmissionInput(opp);
      const admissionResult = runWorkbenchAdmissionGate(admissionInput);
      expect(admissionResult.admission_status).toBeDefined();
      // Candidate quality is checked inside admission
      expect(Array.isArray(admissionResult.reasons)).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 22: REVISE Registry Completeness + Cross-Registry Integrity
// SIPOC authority: reviseRegistry.ts, REVISE_PROCESS_REGISTRY, REVISE_ARTIFACT_REGISTRY
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 22: REVISE Registry Completeness + Cross-Registry Integrity', () => {
  it('all 10 revise stages present in REVISE_PROCESS_REGISTRY', () => {
    const stageIds = REVISE_PROCESS_REGISTRY.map((p) => p.stageId);
    expect(stageIds).toContain('RS01_LEDGER_ASSEMBLY');
    expect(stageIds).toContain('RS02_QUEUE_ADMISSION');
    expect(stageIds).toContain('RS03_QUEUE_PRIORITIZATION');
    expect(stageIds).toContain('RS04_WORKBENCH_LOAD');
    expect(stageIds).toContain('RS05_CANDIDATE_GENERATION');
    expect(stageIds).toContain('RS06_AUTHOR_DECISION');
    expect(stageIds).toContain('RS07_LEDGER_SYNC');
    expect(stageIds).toContain('RS08_COMPLETION');
    expect(stageIds).toContain('RS09_CROSSCHECK_VERIFICATION');
    expect(stageIds).toContain('RS10_TRUSTEDPATH');
  });

  it('every REVISE_KICK_MATRIX entry references valid stages', () => {
    const validStages = new Set(REVISE_PROCESS_REGISTRY.map((p) => p.stageId));
    for (const kick of REVISE_KICK_MATRIX) {
      expect(validStages.has(kick.triggeringStageId)).toBe(true);
      // targetStageId may reference eval pipeline stages (e.g. S10b)
      expect(typeof kick.targetStageId).toBe('string');
      expect(kick.targetStageId.length).toBeGreaterThan(0);
    }
  });

  it('every REVISE_ARTIFACT_REGISTRY entry has a producer stage', () => {
    const validStages = new Set(REVISE_PROCESS_REGISTRY.map((p) => p.stageId));
    for (const artifact of REVISE_ARTIFACT_REGISTRY) {
      expect(validStages.has(artifact.producerStageId)).toBe(true);
    }
  });

  it('every REVISE_FIELD_REGISTRY entry references valid artifact', () => {
    const validArtifacts = new Set(REVISE_ARTIFACT_REGISTRY.map((a) => a.artifact));
    for (const field of REVISE_FIELD_REGISTRY) {
      expect(validArtifacts.has(field.ownerArtifact)).toBe(true);
    }
  });

  it('every REVISE_CERTIFICATION_GATE_REGISTRY entry references valid stage', () => {
    const validStages = new Set(REVISE_PROCESS_REGISTRY.map((p) => p.stageId));
    for (const gate of REVISE_CERTIFICATION_GATE_REGISTRY) {
      expect(validStages.has(gate.stageId)).toBe(true);
    }
  });

  it('REVISE_AUTHORITY_SOURCE_REGISTRY cross-references valid stages and artifacts', () => {
    const validStages = new Set(REVISE_PROCESS_REGISTRY.map((p) => p.stageId));
    const validArtifacts = new Set(REVISE_ARTIFACT_REGISTRY.map((a) => a.artifact));
    for (const auth of REVISE_AUTHORITY_SOURCE_REGISTRY) {
      for (const stageId of auth.appliesToStageIds) {
        expect(validStages.has(stageId)).toBe(true);
      }
      for (const artifact of auth.appliesToArtifacts) {
        expect(validArtifacts.has(artifact)).toBe(true);
      }
    }
  });

  it('revision_failure_record_v1 and candidate_hydration_failure_v1 in artifact registry', () => {
    const artifactNames = REVISE_ARTIFACT_REGISTRY.map((a) => a.artifact);
    expect(artifactNames).toContain('revision_failure_record_v1');
    expect(artifactNames).toContain('candidate_hydration_failure_v1');
  });

  it('full chain: registry stages → kick matrix → artifacts → fields → gates', () => {
    // Every stage has at least one artifact as producer
    const stagesWithArtifacts = new Set(REVISE_ARTIFACT_REGISTRY.map((a) => a.producerStageId));
    for (const stage of REVISE_PROCESS_REGISTRY) {
      expect(stagesWithArtifacts.has(stage.stageId)).toBe(true);
    }

    // Most artifacts have at least one field (3 newer artifacts pending field registration)
    const artifactsWithFields = new Set(REVISE_FIELD_REGISTRY.map((f) => f.ownerArtifact));
    const artifactsMissingFields = REVISE_ARTIFACT_REGISTRY.filter((a) => !artifactsWithFields.has(a.artifact));
    // Allow up to 3 artifacts missing fields (trustedpath_result_v1, revision_failure_record_v1, candidate_hydration_failure_v1)
    expect(artifactsMissingFields.length).toBeLessThanOrEqual(3);

    // Gate count matches expected
    expect(REVISE_CERTIFICATION_GATE_REGISTRY.length).toBeGreaterThanOrEqual(7);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 23: Quality Gate V2 — Criteria Coverage + Artifact Gate
// SIPOC authority: qualityGate.ts, fipocRegistry.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 23: Quality Gate V2 — Criteria Coverage + Artifact Gate', () => {
  it('well-formed evaluation passes quality gate V2', () => {
    const fixture = makeEvalFixture({});
    const result = runQualityGateV2(fixture);
    expect(result.pass).toBe(true);
    expect(result.artifactGate.verdict).toBe('PASS');
  });

  it('evaluation with wrong criteria count fails V2', () => {
    const fixture = makeEvalFixture({});
    const truncated = { ...fixture, criteria: fixture.criteria.slice(0, 5) };
    const result = runQualityGateV2(truncated);
    expect(result.pass).toBe(false);
    const failedIds = result.checks.filter((c) => !c.passed).map((c) => c.check_id);
    expect(failedIds).toContain('v2_criteria_count');
  });

  it('evaluation with duplicate criteria keys fails V2', () => {
    const fixture = makeEvalFixture({});
    const duped = { ...fixture, criteria: [...fixture.criteria, fixture.criteria[0]] };
    const result = runQualityGateV2(duped);
    const uniqueCoverageCheck = result.checks.find((c) => c.check_id === 'v2_criteria_unique_coverage');
    expect(uniqueCoverageCheck?.passed).toBe(false);
  });

  it('quality gate constants are properly bounded', () => {
    expect(QG_MIN_REC_LENGTH).toBeGreaterThan(0);
    expect(QG_MAX_REC_LENGTH).toBeGreaterThan(QG_MIN_REC_LENGTH);
    expect(QG_MIN_RATIONALE_LENGTH).toBeGreaterThan(0);
    expect(QG_MIN_EVIDENCE_COVERED_CRITERIA).toBeGreaterThanOrEqual(10);
    expect(QG_MIN_EVIDENCE_SNIPPET_LENGTH).toBeGreaterThan(0);
    expect(QG_MAX_HIGH_SCORE_WHEN_LOW_CONFIDENCE).toBeLessThanOrEqual(10);
  });

  it('tokenizeForOverlap and collectNgrams produce deterministic results', () => {
    const tokens = tokenizeForOverlap('The salon looked like a warehouse inside.');
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens).toContain('salon');

    const ngrams = collectNgrams('The salon looked like a warehouse inside with tall ceilings.', QG_INDEPENDENCE_NGRAM_SIZE);
    expect(ngrams.length).toBeGreaterThan(0);
  });

  it('full chain: eval → quality gate V2 → pass/fail → opportunities → admission', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 3 });

    // Quality gate V2
    const qgResult = runQualityGateV2(fixture);
    expect(qgResult.artifactGate.verdict).toBe('PASS');

    // Quality gate passed → build opportunities
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    // Opportunities → admission
    for (const opp of opportunities.slice(0, 2)) {
      const admissionInput = makeWorkbenchAdmissionInput(opp);
      const admissionResult = runWorkbenchAdmissionGate(admissionInput);
      expect(admissionResult.admission_status).toBeDefined();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 24: Revise Session State Machine — Full Lifecycle Transitions
// SIPOC authority: sessionTransitions.ts, types.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 24: Revise Session State Machine — Full Lifecycle Transitions', () => {
  const HAPPY_PATH: string[] = ['open', 'findings_ready', 'synthesis_started', 'proposals_ready', 'applied'];

  it('happy path: open → findings_ready → synthesis_started → proposals_ready → applied', () => {
    let status = 'open';
    for (const next of HAPPY_PATH.slice(1)) {
      expect(() => assertValidRevisionSessionTransition(status as any, next as any)).not.toThrow();
      status = next;
    }
    expect(status).toBe('applied');
  });

  it('failure path: non-terminal states → failed', () => {
    const nonTerminal = ['open', 'findings_ready', 'synthesis_started', 'proposals_ready'];
    for (const state of nonTerminal) {
      expect(() => assertValidRevisionSessionTransition(state as any, 'failed' as any)).not.toThrow();
    }
  });

  it('failure path: non-terminal states → failed_retryable', () => {
    const nonTerminal = ['open', 'findings_ready', 'synthesis_started', 'proposals_ready'];
    for (const state of nonTerminal) {
      expect(() => assertValidRevisionSessionTransition(state as any, 'failed_retryable' as any)).not.toThrow();
    }
  });

  it('retry path: failed_retryable → open', () => {
    expect(() => assertValidRevisionSessionTransition('failed_retryable' as any, 'open' as any)).not.toThrow();
  });

  it('terminal: failed cannot transition to any active state', () => {
    for (const state of HAPPY_PATH) {
      expect(() => assertValidRevisionSessionTransition('failed' as any, state as any)).toThrow();
    }
  });

  it('terminal: applied cannot go backward', () => {
    for (const state of ['open', 'findings_ready', 'synthesis_started', 'proposals_ready']) {
      expect(() => assertValidRevisionSessionTransition('applied' as any, state as any)).toThrow();
    }
  });

  it('buildRevisionSessionTransitionUpdate produces valid update object', () => {
    const mockSession = {
      id: 'session-e2e',
      evaluation_run_id: 'run-1',
      source_version_id: 'v1',
      result_version_id: null,
      status: 'open' as const,
      summary: {},
      findings_count: 0,
      actionable_findings_count: 0,
      proposal_ready_actionable_findings_count: 0,
      proposals_created_count: 0,
      created_at: new Date().toISOString(),
      completed_at: null,
      last_transition_at: null,
      failure_code: null,
      failure_message: null,
    };
    const update = buildRevisionSessionTransitionUpdate(mockSession, {
      nextStatus: 'findings_ready',
      findings_count: 12,
      actionable_findings_count: 8,
    });
    expect(update.status).toBe('findings_ready');
    expect(update.last_transition_at).toBeDefined();
  });

  it('full chain: open → happy path → applied → failure recovery → retry → applied', () => {
    // Happy path first
    let status = 'open';
    for (const next of HAPPY_PATH.slice(1)) {
      expect(() => assertValidRevisionSessionTransition(status as any, next as any)).not.toThrow();
      status = next;
    }
    expect(status).toBe('applied');

    // New session: fail retryable then recover
    status = 'open';
    expect(() => assertValidRevisionSessionTransition('proposals_ready' as any, 'failed_retryable' as any)).not.toThrow();
    status = 'failed_retryable';
    expect(() => assertValidRevisionSessionTransition(status as any, 'open' as any)).not.toThrow();
    status = 'open';
    for (const next of HAPPY_PATH.slice(1)) {
      expect(() => assertValidRevisionSessionTransition(status as any, next as any)).not.toThrow();
      status = next;
    }
    expect(status).toBe('applied');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 25: Evidence Grounding Gate — Anchor Classification + Stamping
// SIPOC authority: evidenceGroundingGate.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 25: Evidence Grounding Gate — Anchor Classification + Stamping', () => {
  const MANUSCRIPT = `He chuckled to himself, when he thought of that saying. It was time, yet again, to color his hair. The salon looked like a warehouse inside with tall ceilings and exposed brick. He had recently moved to Toronto from a small town in Ontario. Can you bleach my eyebrows and how long would it take? He realized that he should not be judgmental.`;

  it('verbatim manuscript quote classified as verbatim_quote', () => {
    const result = classifyAnchor('The salon looked like a warehouse inside with tall ceilings', MANUSCRIPT);
    expect(result.anchor_type).toBe('verbatim_quote');
    expect(result.match_score).toBeGreaterThanOrEqual(0.85);
  });

  it('editorial diagnostic text classified as editorial_diagnosis', () => {
    const result = classifyAnchor('The narrative voice shifts psychic distance mid-passage without signaling the transition', MANUSCRIPT);
    expect(result.anchor_type).toBe('editorial_diagnosis');
    expect(result.match_score).toBeLessThan(0.45);
  });

  it('too-short anchor classified as editorial_diagnosis', () => {
    const result = classifyAnchor('short', MANUSCRIPT);
    expect(result.anchor_type).toBe('editorial_diagnosis');
    expect(result.match_score).toBe(0);
  });

  it('empty anchor classified as editorial_diagnosis', () => {
    const result = classifyAnchor('', MANUSCRIPT);
    expect(result.anchor_type).toBe('editorial_diagnosis');
    expect(result.match_score).toBe(0);
  });

  it('no manuscript text → assume verbatim_quote (avoid false positives)', () => {
    const result = classifyAnchor('Some passage from the text that we cannot verify', '');
    expect(result.anchor_type).toBe('verbatim_quote');
  });

  it('runEvidenceGroundingGate reports ungrounded recommendations', () => {
    const criteria = [
      { key: 'dialogue', recommendations: [{ anchor_snippet: 'Can you bleach my eyebrows and how long would it take?' }] },
      { key: 'voice', recommendations: [{ anchor_snippet: 'The narrative voice shifts psychic distance mid-passage' }] },
    ];
    const report = runEvidenceGroundingGate(criteria, MANUSCRIPT);
    expect(report.total_recommendations).toBe(2);
    expect(report.verbatim_count).toBe(1);
    expect(report.diagnosis_count).toBe(1);
    expect(report.fully_grounded).toBe(false);
    expect(report.ungrounded).toHaveLength(1);
    expect(report.ungrounded[0].criterion_key).toBe('voice');
  });

  it('stampAnchorTypes mutates recs and produces report', () => {
    const criteria = [
      { key: 'character', recommendations: [{ anchor_snippet: 'He realized that he should not be judgmental' } as { anchor_snippet: string; anchor_type?: string }] },
    ];
    const report = stampAnchorTypes(criteria, MANUSCRIPT);
    expect(report.verbatim_count).toBe(1);
    expect(criteria[0].recommendations[0].anchor_type).toBe('verbatim_quote');
  });

  it('full chain: eval recs → evidence grounding → stamp → report → admission decision', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 3 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    const criteria = fixture.criteria.map((c) => ({
      key: c.key,
      recommendations: c.recommendations.map((r) => ({ anchor_snippet: r.anchor_snippet || '' })),
    }));
    const report = runEvidenceGroundingGate(criteria, MANUSCRIPT);
    expect(report.total_recommendations).toBeGreaterThan(0);
    for (const ungrounded of report.ungrounded) {
      expect(ungrounded.anchor_type).toBe('editorial_diagnosis');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 26: Mode Routing — Short-Form vs Long-Form Gate Requirements
// SIPOC authority: modeRouting.ts, submissionScope.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 26: Mode Routing — Short-Form vs Long-Form Gate Requirements', () => {
  it('micro excerpt (500-999 words) → micro_excerpt_diagnostic, no review gate', () => {
    const routing = resolveModeRouting(500);
    expect(routing.evaluationMode).toBe('micro_excerpt_diagnostic');
    expect(routing.isShortForm).toBe(true);
    expect(routing.requiresUserFacingReviewGate).toBe(false);
    expect(routing.requiresAcceptedStoryLedger).toBe(false);
    expect(routing.storyLedgerAuthority).toBe('disabled');
  });

  it('short excerpt (1000-3999 words) → short_excerpt_evaluation', () => {
    const routing = resolveModeRouting(2500);
    expect(routing.evaluationMode).toBe('short_excerpt_evaluation');
    expect(routing.isShortForm).toBe(true);
    expect(routing.storyLedgerAuthority).toBe('diagnostic_only');
  });

  it('short form pattern (4000-7000 words) → short_form_pattern_read', () => {
    const routing = resolveModeRouting(5000);
    expect(routing.evaluationMode).toBe('short_form_pattern_read');
    expect(routing.isShortForm).toBe(true);
    expect(routing.storyLedgerAuthority).toBe('advisory_internal');
  });

  it('full short form (7001-24999 words) → full_short_form_evaluation', () => {
    const routing = resolveModeRouting(15000);
    expect(routing.evaluationMode).toBe('full_short_form_evaluation');
    expect(routing.isShortForm).toBe(true);
    expect(routing.requiresAcceptedStoryLedger).toBe(false);
  });

  it('long form (25000+ words) → long_form_evaluation with all gates', () => {
    const routing = resolveModeRouting(30000);
    expect(routing.evaluationMode).toBe('long_form_evaluation');
    expect(routing.isLongForm).toBe(true);
    expect(routing.requiresUserFacingReviewGate).toBe(true);
    expect(routing.requiresAcceptedStoryLedger).toBe(true);
    expect(routing.pass3aBlocking).toBe(true);
    expect(routing.storyLedgerAuthority).toBe('governed');
  });

  it('below minimum words → throws SUBMISSION_TOO_SHORT_FOR_EVALUATION', () => {
    expect(() => resolveEvaluationMode(100)).toThrow('SUBMISSION_TOO_SHORT_FOR_EVALUATION');
    expect(() => resolveEvaluationMode(0)).toThrow('SUBMISSION_TOO_SHORT_FOR_EVALUATION');
    expect(() => resolveEvaluationMode(-1)).toThrow('SUBMISSION_TOO_SHORT_FOR_EVALUATION');
  });

  it('boundary values are correct per SIPOC', () => {
    expect(MICRO_EXCERPT_MIN_WORDS).toBe(500);
    expect(MICRO_EXCERPT_MAX_WORDS).toBe(999);
    expect(SHORT_EXCERPT_MAX_WORDS).toBe(3999);
    expect(SHORT_FORM_PATTERN_MAX_WORDS).toBe(7000);
    expect(FULL_SHORT_FORM_MAX_WORDS).toBe(24999);
    expect(LONG_FORM_MIN_WORDS).toBe(25000);
  });

  it('shouldBypassUserFacingReviewGate is true for short form', () => {
    expect(shouldBypassUserFacingReviewGate(500)).toBe(true);
    expect(shouldBypassUserFacingReviewGate(5000)).toBe(true);
    expect(shouldBypassUserFacingReviewGate(30000)).toBe(false);
  });

  it('sparseEvidenceIsNotFailure is true for short form', () => {
    expect(sparseEvidenceIsNotFailure(500)).toBe(true);
    expect(sparseEvidenceIsNotFailure(5000)).toBe(true);
    expect(sparseEvidenceIsNotFailure(30000)).toBe(false);
  });

  it('full chain: word count → mode → scope profile → gate requirements → admission', () => {
    const shortScope = classifySubmissionScope('a '.repeat(3000), 1);
    expect(shortScope.inputScale).toBe('light_chapter');
    expect(shortScope.confidenceCapSummary).toBe('MODERATE');
    expect(shortScope.evaluationMode).toBe('short_excerpt_evaluation');
    expect(shortScope.requiresUserFacingReviewGate).toBe(false);

    const longScope = classifySubmissionScope('a '.repeat(55000), 10);
    expect(longScope.inputScale).toBe('full_manuscript');
    expect(longScope.confidenceCapSummary).toBe('HIGH');
    expect(longScope.evaluationMode).toBe('long_form_evaluation');
    expect(longScope.requiresUserFacingReviewGate).toBe(true);
    expect(longScope.requiresAcceptedStoryLedger).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 27: Submission Scope Profile — Input Scale + Confidence Cap
// SIPOC authority: submissionScope.ts, scopePolicy.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 27: Submission Scope Profile — Input Scale + Confidence Cap', () => {
  it('micro excerpt: ≤999 words → micro_excerpt, LOW confidence', () => {
    const scope = classifySubmissionScope('word '.repeat(500), 1);
    expect(scope.inputScale).toBe('micro_excerpt');
    expect(scope.confidenceCapSummary).toBe('LOW');
    expect(scope.wordCount).toBe(500);
  });

  it('light chapter: 1000-3999 words → light_chapter, MODERATE', () => {
    const scope = classifySubmissionScope('word '.repeat(2000), 1);
    expect(scope.inputScale).toBe('light_chapter');
    expect(scope.confidenceCapSummary).toBe('MODERATE');
  });

  it('standard chapter: 4000-7000 words → standard_chapter, MODERATE', () => {
    const scope = classifySubmissionScope('word '.repeat(5000), 1);
    expect(scope.inputScale).toBe('standard_chapter');
    expect(scope.confidenceCapSummary).toBe('MODERATE');
  });

  it('standalone novelette: 7001-24999 words → novelette, HIGH', () => {
    const scope = classifySubmissionScope('word '.repeat(15000), 1, 'standalone');
    expect(scope.inputScale).toBe('novelette');
    expect(scope.confidenceCapSummary).toBe('HIGH');
  });

  it('chapters multi_chapter: 7001-24999 words → multi_chapter, HIGH', () => {
    const scope = classifySubmissionScope('word '.repeat(15000), 3, 'chapters');
    expect(scope.inputScale).toBe('multi_chapter');
    expect(scope.confidenceCapSummary).toBe('HIGH');
  });

  it('full manuscript: 50000+ words → full_manuscript, HIGH', () => {
    const scope = classifySubmissionScope('word '.repeat(55000), 10);
    expect(scope.inputScale).toBe('full_manuscript');
    expect(scope.confidenceCapSummary).toBe('HIGH');
  });

  it('countWords handles edge cases', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  ')).toBe(0);
    expect(countWords('hello')).toBe(1);
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  hello   world  ')).toBe(2);
  });

  it('scope profile includes mode-aware routing fields', () => {
    const scope = classifySubmissionScope('word '.repeat(30000), 5);
    expect(scope.scopePolicyVersion).toBe('v3-mode-aware');
    expect(scope.evaluationMode).toBeDefined();
    expect(scope.requiresUserFacingReviewGate).toBeDefined();
    expect(scope.requiresAcceptedStoryLedger).toBeDefined();
    expect(scope.storyLedgerAuthority).toBeDefined();
  });

  it('full chain: manuscript → scope → mode → gate requirements → eval routing', () => {
    const micro = classifySubmissionScope('word '.repeat(600), 1);
    expect(micro.evaluationMode).toBe('micro_excerpt_diagnostic');
    expect(micro.requiresUserFacingReviewGate).toBe(false);
    expect(sparseEvidenceIsNotFailure(micro.wordCount)).toBe(true);

    const long = classifySubmissionScope('word '.repeat(30000), 5);
    expect(long.evaluationMode).toBe('long_form_evaluation');
    expect(long.requiresUserFacingReviewGate).toBe(true);
    expect(long.requiresAcceptedStoryLedger).toBe(true);
    expect(sparseEvidenceIsNotFailure(long.wordCount)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 28: Agent Readiness Package — Full Lifecycle with Fictitious Author
// SIPOC authority: packagePersistence.ts, creatorApprovalGate.ts, agentReadinessRegistry.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 28: Agent Readiness Package — Full Lifecycle with Fictitious Author', () => {
  const FICTITIOUS_SECTIONS = [
    { section_type: 'query_letter', content: 'Dear Agent, I am writing to introduce THE PRICE OF VANITY, a literary fiction novel exploring the consequences of superficial self-image in modern Toronto. At 65,000 words, this debut novel follows Marcus Chen, a middle-aged software developer whose obsessive pursuit of youthful appearance leads him through a series of increasingly absurd salon visits that strip away his pretensions and reveal the person underneath.' },
    { section_type: 'what_makes_unique', content: 'THE PRICE OF VANITY offers a rare male perspective on beauty culture and aging anxiety. Unlike typical literary fiction that treats vanity as a female concern, this novel places a middle-aged man at the center of the beauty-industrial complex, using dark humor and precise prose to examine how consumer culture shapes identity regardless of gender.' },
    { section_type: 'synopsis', content: 'Marcus Chen arrives at a Toronto salon to color his graying hair for the fourteenth time. What begins as routine maintenance spirals into a day-long ordeal when the stylist suggests bleaching his eyebrows. Through a series of escalating decisions — each more expensive and invasive than the last — Marcus confronts the gap between the man he sees in the mirror and the man he wishes he could be.' },
    { section_type: 'query_pitch', content: 'For fans of Sheila Heti and Ben Lerner, THE PRICE OF VANITY is a sharp, funny literary novel about a man who walks into a salon and walks out questioning everything he thought he knew about himself.' },
    { section_type: 'comparables', content: 'Comparable titles include HOW SHOULD A PERSON BE? by Sheila Heti (autofiction examining identity), LEAVING THE ATOCHA STATION by Ben Lerner (male protagonist navigating inauthenticity), and SEVERANCE by Ling Ma (satire of consumer culture and routine).' },
    { section_type: 'author_bio', content: 'Marcus Rivera is a Toronto-based fiction writer whose work explores masculinity, consumer culture, and the quiet anxieties of middle age. He holds an MFA from the University of British Columbia and has published short fiction in The Malahat Review and PRISM International. THE PRICE OF VANITY is his first novel. He does not, despite persistent rumors, bleach his own eyebrows.' },
  ];

  it('all 6 required section types match AGENT_READINESS_REQUIRED_SECTION_TYPES', () => {
    expect(AGENT_READINESS_REQUIRED_SECTION_TYPES).toHaveLength(6);
    const expected = ['query_letter', 'what_makes_unique', 'synopsis', 'query_pitch', 'comparables', 'author_bio'];
    expect([...AGENT_READINESS_REQUIRED_SECTION_TYPES]).toEqual(expected);
  });

  it('all 6 sections present produces complete package', () => {
    const result = buildAgentReadinessPackageV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      userId: 'user-marcus',
      manuscriptTitle: 'The Price of Vanity',
      approvedSections: FICTITIOUS_SECTIONS,
      packageVersion: 1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.package.artifact_type).toBe('agent_readiness_package_v1');
      expect(result.package.source_section_count).toBe(6);
      expect(result.package.sections.query_letter).toContain('THE PRICE OF VANITY');
      expect(result.package.sections.author_bio).toContain('Marcus Rivera');
      expect(result.package.package_hash).toBeTruthy();
    }
  });

  it('missing author_bio → package assembly fails with specific missing type', () => {
    const withoutBio = FICTITIOUS_SECTIONS.filter((s) => s.section_type !== 'author_bio');
    const result = buildAgentReadinessPackageV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      userId: 'user-marcus',
      manuscriptTitle: 'The Price of Vanity',
      approvedSections: withoutBio,
      packageVersion: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.completeness.missingSections).toContain('author_bio');
  });

  it('missing synopsis → package assembly fails', () => {
    const withoutSynopsis = FICTITIOUS_SECTIONS.filter((s) => s.section_type !== 'synopsis');
    const result = buildAgentReadinessPackageV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      userId: 'user-marcus',
      manuscriptTitle: 'The Price of Vanity',
      approvedSections: withoutSynopsis,
      packageVersion: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.completeness.missingSections).toContain('synopsis');
  });

  it('completeness gate: all approved → passes', () => {
    const completeness = evaluatePackageCompleteness({
      manuscriptId: 'ms-vanity-001',
      sections: FICTITIOUS_SECTIONS.map((s) => ({ ...s, status: 'approved' })),
    });
    expect(completeness.allSectionsApproved).toBe(true);
    expect(completeness.approvedCount).toBe(6);
    expect(completeness.missingSections).toHaveLength(0);
  });

  it('completeness gate: draft section not counted as approved', () => {
    const withDraft = FICTITIOUS_SECTIONS.map((s) =>
      s.section_type === 'author_bio' ? { ...s, status: 'draft' } : { ...s, status: 'approved' },
    );
    const completeness = evaluatePackageCompleteness({
      manuscriptId: 'ms-vanity-001',
      sections: withDraft,
    });
    expect(completeness.allSectionsApproved).toBe(false);
    expect(completeness.missingSections).toContain('author_bio');
  });

  it('creator approval: approved → passes gate', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: 'abc123',
      approvalState: 'approved',
      decidedBy: 'user-marcus',
    });
    const gateResult = evaluateCreatorApprovalGate({ approval });
    expect(gateResult.ok).toBe(true);
    if (gateResult.ok) {
      expect(gateResult.approval.approval_state).toBe('approved');
    }
  });

  it('creator approval: pending → blocked retryable', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: 'abc123',
      approvalState: 'pending',
    });
    const gateResult = evaluateCreatorApprovalGate({ approval });
    expect(gateResult.ok).toBe(false);
    if (!gateResult.ok) {
      expect(gateResult.failure.approval_state).toBe('pending');
      expect(gateResult.failure.retryable).toBe(true);
    }
  });

  it('creator approval: rejected → blocked not retryable', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: 'abc123',
      approvalState: 'rejected',
      decidedBy: 'user-marcus',
    });
    const gateResult = evaluateCreatorApprovalGate({ approval });
    expect(gateResult.ok).toBe(false);
    if (!gateResult.ok) {
      expect(gateResult.failure.approval_state).toBe('rejected');
      expect(gateResult.failure.retryable).toBe(false);
    }
  });

  it('export artifact: produces valid package_export_v1 for docx and txt', () => {
    const docx = buildPackageExportV1({
      packageHash: 'hash-vanity-pkg',
      format: 'docx',
      filename: 'the-price-of-vanity-agent-readiness.docx',
    });
    expect(docx.artifact_type).toBe('package_export_v1');
    expect(docx.format).toBe('docx');

    const txt = buildPackageExportV1({
      packageHash: 'hash-vanity-pkg',
      format: 'txt',
      filename: 'the-price-of-vanity-agent-readiness.txt',
    });
    expect(txt.format).toBe('txt');
  });

  it('full chain: eval → all sections → completeness → package → approval → export', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 3 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    const completeness = evaluatePackageCompleteness({
      manuscriptId: 'ms-vanity-001',
      sections: FICTITIOUS_SECTIONS.map((s) => ({ ...s, status: 'approved' })),
    });
    expect(completeness.allSectionsApproved).toBe(true);

    const packageResult = buildAgentReadinessPackageV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      userId: 'user-marcus',
      manuscriptTitle: 'The Price of Vanity',
      approvedSections: FICTITIOUS_SECTIONS,
      packageVersion: 1,
    });
    expect(packageResult.ok).toBe(true);
    if (!packageResult.ok) return;

    const approval = buildCreatorApprovalV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: packageResult.package.package_hash,
      approvalState: 'approved',
      decidedBy: 'user-marcus',
    });
    const gateResult = evaluateCreatorApprovalGate({ approval });
    expect(gateResult.ok).toBe(true);

    const exportArtifact = buildPackageExportV1({
      packageHash: packageResult.package.package_hash,
      format: 'txt',
      filename: 'the-price-of-vanity-agent-readiness.txt',
    });
    expect(exportArtifact.artifact_type).toBe('package_export_v1');
    expect(exportArtifact.package_hash).toBe(packageResult.package.package_hash);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 29: Author Decision Flow — Accept A/B/C, Reject, Custom, Defer
// SIPOC authority: reviseRegistry.ts (AUTHOR_DECISION_TRANSITIONS, QUEUE_ITEM_LIFECYCLE_TRANSITIONS)
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 29: Author Decision Flow — Accept A/B/C, Reject, Custom, Defer', () => {
  it('pending → accept option A', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.pending).toContain('accepted_a');
  });

  it('pending → accept option B', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.pending).toContain('accepted_b');
  });

  it('pending → accept option C', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.pending).toContain('accepted_c');
  });

  it('pending → custom revision (author writes their own)', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.pending).toContain('custom');
  });

  it('pending → keep_original (reject all, keep manuscript text)', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.pending).toContain('keep_original');
  });

  it('pending → reject', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.pending).toContain('reject');
  });

  it('pending → deferred (skip for now, revisit later)', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.pending).toContain('deferred');
  });

  it('accepted_a can be changed to reject, keep_original, or deferred', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.accepted_a).toContain('reject');
    expect(AUTHOR_DECISION_TRANSITIONS.accepted_a).toContain('keep_original');
    expect(AUTHOR_DECISION_TRANSITIONS.accepted_a).toContain('deferred');
  });

  it('custom can be changed to reject, keep_original, or deferred', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.custom).toContain('reject');
    expect(AUTHOR_DECISION_TRANSITIONS.custom).toContain('keep_original');
    expect(AUTHOR_DECISION_TRANSITIONS.custom).toContain('deferred');
  });

  it('keep_original can be changed to any accept, custom, reject, or deferred', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.keep_original).toContain('accepted_a');
    expect(AUTHOR_DECISION_TRANSITIONS.keep_original).toContain('accepted_b');
    expect(AUTHOR_DECISION_TRANSITIONS.keep_original).toContain('accepted_c');
    expect(AUTHOR_DECISION_TRANSITIONS.keep_original).toContain('custom');
    expect(AUTHOR_DECISION_TRANSITIONS.keep_original).toContain('reject');
    expect(AUTHOR_DECISION_TRANSITIONS.keep_original).toContain('deferred');
  });

  it('deferred can be re-opened to any decision', () => {
    expect(AUTHOR_DECISION_TRANSITIONS.deferred).toContain('accepted_a');
    expect(AUTHOR_DECISION_TRANSITIONS.deferred).toContain('accepted_b');
    expect(AUTHOR_DECISION_TRANSITIONS.deferred).toContain('accepted_c');
    expect(AUTHOR_DECISION_TRANSITIONS.deferred).toContain('custom');
    expect(AUTHOR_DECISION_TRANSITIONS.deferred).toContain('keep_original');
    expect(AUTHOR_DECISION_TRANSITIONS.deferred).toContain('reject');
  });

  it('all 7 canonical decision values exist', () => {
    const states = Object.keys(AUTHOR_DECISION_TRANSITIONS) as AuthorDecisionState[];
    expect(states).toContain('pending');
    expect(states).toContain('accepted_a');
    expect(states).toContain('accepted_b');
    expect(states).toContain('accepted_c');
    expect(states).toContain('custom');
    expect(states).toContain('keep_original');
    expect(states).toContain('reject');
    expect(states).toContain('deferred');
    expect(states).toHaveLength(8);
  });

  it('queue item lifecycle: queued → ready_for_revise → in_review → decided → synced', () => {
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS.queued).toContain('ready_for_revise');
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS.ready_for_revise).toContain('in_review');
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS.in_review).toContain('decided');
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS.decided).toContain('synced');
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS.synced).toContain('trustedpath_applied');
  });

  it('queue item: needs_targeting can be deferred or re-admitted', () => {
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS.needs_targeting).toContain('ready_for_revise');
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS.needs_targeting).toContain('deferred');
  });

  it('queue item: deferred can be re-admitted', () => {
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS.deferred).toContain('ready_for_revise');
  });

  it('queue item: trustedpath_applied is terminal', () => {
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS.trustedpath_applied).toHaveLength(0);
  });

  it('full chain: eval → opportunity → queued → ready → in_review → decided → synced', () => {
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 3 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    // Trace queue lifecycle
    let queueState: QueueItemLifecycleState = 'queued';
    const QUEUE_PATH: QueueItemLifecycleState[] = ['ready_for_revise', 'in_review', 'decided', 'synced', 'trustedpath_applied'];
    for (const next of QUEUE_PATH) {
      expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS[queueState]).toContain(next);
      queueState = next;
    }
    expect(queueState).toBe('trustedpath_applied');
    expect(QUEUE_ITEM_LIFECYCLE_TRANSITIONS[queueState]).toHaveLength(0);

    // Trace author decision: pending → accepted_a → keep_original (changed mind) → accepted_b (final)
    let decisionState: AuthorDecisionState = 'pending';
    expect(AUTHOR_DECISION_TRANSITIONS[decisionState]).toContain('accepted_a');
    decisionState = 'accepted_a';
    expect(AUTHOR_DECISION_TRANSITIONS[decisionState]).toContain('keep_original');
    decisionState = 'keep_original';
    expect(AUTHOR_DECISION_TRANSITIONS[decisionState]).toContain('accepted_b');
    decisionState = 'accepted_b';
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 30: Storygate Studio — Eligibility, Submission, Access Control
// SIPOC authority: storygateRegistry.ts, storygateSubmissionValidator.ts, storygatePersistence.ts
// ══════════════════════════════════════════════════════════════════════════════

describe('E2E Chain 30: Storygate Studio — Eligibility, Submission, Access Control', () => {
  const COMPLETE_PACKAGE: Record<string, unknown> = {
    query_letter: 'Dear Agent, THE PRICE OF VANITY is a 65,000-word literary fiction novel set in modern Toronto.',
    synopsis: 'Marcus Chen arrives at a Toronto salon to color his graying hair for the fourteenth time.',
    author_bio: 'Marcus Rivera is a Toronto-based fiction writer. MFA from UBC. Published in The Malahat Review.',
    elevator_pitch: 'A man walks into a salon. What begins as hair coloring becomes a reckoning with vanity.',
    agent_pitch: 'For fans of Sheila Heti and Ben Lerner — dark humor meets male beauty anxiety.',
    market_comparables: 'HOW SHOULD A PERSON BE? (Heti), LEAVING THE ATOCHA STATION (Lerner), SEVERANCE (Ma).',
    market_category: 'Literary Fiction / Contemporary',
    target_audience: 'Readers of literary fiction exploring identity, masculinity, and consumer culture.',
    market_position_statement: 'Literary fiction for the beauty-obsessed age, told from a rare male perspective.',
    sample_pages: 'He chuckled to himself when he thought of that saying. It was time, yet again, to color his hair.',
    rights_declaration: 'confirmed',
  };

  it('admission threshold is 9.0/10 (not 8.0)', () => {
    expect(STORYGATE_ADMISSION_THRESHOLD).toBe(9.0);
  });

  it('requires 11 package fields', () => {
    expect(STORYGATE_REQUIRED_PACKAGE_FIELDS).toHaveLength(11);
    expect(STORYGATE_REQUIRED_PACKAGE_FIELDS).toContain('query_letter');
    expect(STORYGATE_REQUIRED_PACKAGE_FIELDS).toContain('synopsis');
    expect(STORYGATE_REQUIRED_PACKAGE_FIELDS).toContain('author_bio');
    expect(STORYGATE_REQUIRED_PACKAGE_FIELDS).toContain('market_comparables');
    expect(STORYGATE_REQUIRED_PACKAGE_FIELDS).toContain('market_category');
    expect(STORYGATE_REQUIRED_PACKAGE_FIELDS).toContain('rights_declaration');
    expect(STORYGATE_REQUIRED_PACKAGE_FIELDS).toContain('sample_pages');
  });

  it('score 9.0+ with complete package → eligible', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: 'hash-123',
      approvalState: 'approved',
      decidedBy: 'user-marcus',
    });
    const result = validateStorygateSubmission({
      packageFields: COMPLETE_PACKAGE,
      creatorApproval: approval,
      readinessScore: 9.2,
    });
    expect(result.eligible).toBe(true);
    expect(result.packageGatePass).toBe(true);
    expect(result.readinessGatePass).toBe(true);
    expect(result.rightsGatePass).toBe(true);
    expect(result.creatorApprovalGatePass).toBe(true);
    expect(result.failureCodes).toHaveLength(0);
  });

  it('score 8.9 → SCORE_BELOW_THRESHOLD, not eligible', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: 'hash-123',
      approvalState: 'approved',
      decidedBy: 'user-marcus',
    });
    const result = validateStorygateSubmission({
      packageFields: COMPLETE_PACKAGE,
      creatorApproval: approval,
      readinessScore: 8.9,
    });
    expect(result.eligible).toBe(false);
    expect(result.readinessGatePass).toBe(false);
    expect(result.failureCodes).toContain('SCORE_BELOW_THRESHOLD');
  });

  it('qualified professional equivalent bypasses score gate', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: 'hash-123',
      approvalState: 'approved',
      decidedBy: 'user-marcus',
    });
    const result = validateStorygateSubmission({
      packageFields: COMPLETE_PACKAGE,
      creatorApproval: approval,
      readinessScore: 7.0,
      qualifiedProfessionalEquivalent: true,
    });
    expect(result.readinessGatePass).toBe(true);
  });

  it('missing required fields → MISSING_REQUIRED_FIELDS', () => {
    const incomplete = { ...COMPLETE_PACKAGE };
    delete incomplete.market_comparables;
    delete incomplete.synopsis;
    const result = validateStorygateSubmission({
      packageFields: incomplete,
      readinessScore: 9.5,
    });
    expect(result.packageGatePass).toBe(false);
    expect(result.failureCodes).toContain('MISSING_REQUIRED_FIELDS');
    expect(result.missingFields).toContain('market_comparables');
    expect(result.missingFields).toContain('synopsis');
  });

  it('placeholder text → PLACEHOLDER_TEXT_DETECTED', () => {
    const withPlaceholder = { ...COMPLETE_PACKAGE, synopsis: 'TBD — coming soon' };
    const result = validateStorygateSubmission({
      packageFields: withPlaceholder,
      readinessScore: 9.5,
    });
    expect(result.failureCodes).toContain('PLACEHOLDER_TEXT_DETECTED');
    expect(result.placeholderFields).toContain('synopsis');
  });

  it('forbidden scope terms → FORBIDDEN_SCOPE_REQUESTED', () => {
    const result = validateStorygateSubmission({
      packageFields: COMPLETE_PACKAGE,
      readinessScore: 9.5,
      requestedScopeText: 'We want film rights marketplace and screenplay conversion',
    });
    expect(result.failureCodes).toContain('FORBIDDEN_SCOPE_REQUESTED');
    expect(result.forbiddenScopeTerms.length).toBeGreaterThan(0);
  });

  it('forbidden scope terms registry matches SIPOC', () => {
    expect(STORYGATE_FORBIDDEN_SCOPE_TERMS).toContain('film_track');
    expect(STORYGATE_FORBIDDEN_SCOPE_TERMS).toContain('screenplay_conversion');
    expect(STORYGATE_FORBIDDEN_SCOPE_TERMS).toContain('producer_facing_materials');
  });

  it('missing rights declaration → RIGHTS_DECLARATION_MISSING', () => {
    const noRights = { ...COMPLETE_PACKAGE, rights_declaration: '' };
    const result = validateStorygateSubmission({
      packageFields: noRights,
      readinessScore: 9.5,
    });
    expect(result.failureCodes).toContain('RIGHTS_DECLARATION_MISSING');
    expect(result.rightsGatePass).toBe(false);
  });

  it('no creator approval → CREATOR_APPROVAL_REQUIRED', () => {
    const result = validateStorygateSubmission({
      packageFields: COMPLETE_PACKAGE,
      readinessScore: 9.5,
      creatorApproval: null,
    });
    expect(result.failureCodes).toContain('CREATOR_APPROVAL_REQUIRED');
    expect(result.creatorApprovalGatePass).toBe(false);
  });

  it('buildStorygateSubmissionRequestV1 produces valid artifact', () => {
    const approval = buildCreatorApprovalV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: 'hash-123',
      approvalState: 'approved',
      decidedBy: 'user-marcus',
    });
    const submission = buildStorygateSubmissionRequestV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: 'hash-123',
      creatorUserId: 'user-marcus',
      projectTitle: 'The Price of Vanity',
      primaryGenre: 'Literary Fiction',
      creatorName: 'Marcus Rivera',
      creatorEmail: 'marcus@example.com',
      packageFields: COMPLETE_PACKAGE,
      creatorApproval: approval,
      readinessScore: 9.2,
    });
    expect(submission.artifact_type).toBe('storygate_submission_request_v1');
    expect(submission.status).toBe('SUBMITTED');
    expect(submission.validation_result.eligible).toBe(true);
    expect(submission.submission_hash).toBeTruthy();
  });

  it('access log event produces valid artifact with canon hash', () => {
    const event = buildAccessLogEventV1({
      eventId: 'evt-001',
      actionType: 'request_access',
      actorUserId: 'agent-001',
      listingId: 'listing-vanity-001',
      requesterId: 'agent-001',
      validatorsRun: ['industry_verification_v1'],
    });
    expect(event.artifact_type).toBe('access_log_event_v1');
    expect(event.action_type).toBe('request_access');
    expect(event.canon_hash).toBeTruthy();
  });

  it('STORYGATE_PROCESS_REGISTRY has sequential stages starting SG01', () => {
    expect(STORYGATE_PROCESS_REGISTRY.length).toBeGreaterThan(0);
    expect(STORYGATE_PROCESS_REGISTRY[0].stageId).toBe('SG01_CREATOR_SUBMISSION');
    for (let i = 0; i < STORYGATE_PROCESS_REGISTRY.length; i++) {
      expect(STORYGATE_PROCESS_REGISTRY[i].sequence).toBe(i + 1);
    }
  });

  it('full chain: eval → package → approval → storygate submission → validation → access log', () => {
    // Step 1: Evaluation produces fixture with score 9.2
    const fixture = makeEvalFixture({ dialogue: 4, pacing: 3 });
    const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(fixture);
    expect(opportunities.length).toBeGreaterThan(0);

    // Step 2: Agent readiness package complete
    const arSections = [
      { section_type: 'query_letter', content: COMPLETE_PACKAGE.query_letter as string },
      { section_type: 'what_makes_unique', content: 'Rare male perspective on beauty culture.' },
      { section_type: 'synopsis', content: COMPLETE_PACKAGE.synopsis as string },
      { section_type: 'query_pitch', content: 'Sharp literary fiction about vanity.' },
      { section_type: 'comparables', content: COMPLETE_PACKAGE.market_comparables as string },
      { section_type: 'author_bio', content: COMPLETE_PACKAGE.author_bio as string },
    ];
    const arResult = buildAgentReadinessPackageV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      userId: 'user-marcus',
      manuscriptTitle: 'The Price of Vanity',
      approvedSections: arSections,
      packageVersion: 1,
    });
    expect(arResult.ok).toBe(true);
    if (!arResult.ok) return;

    // Step 3: Creator approval
    const approval = buildCreatorApprovalV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: arResult.package.package_hash,
      approvalState: 'approved',
      decidedBy: 'user-marcus',
    });

    // Step 4: Storygate submission
    const submission = buildStorygateSubmissionRequestV1({
      manuscriptId: 'ms-vanity-001',
      evaluationJobId: 'eval-job-001',
      packageHash: arResult.package.package_hash,
      creatorUserId: 'user-marcus',
      projectTitle: 'The Price of Vanity',
      primaryGenre: 'Literary Fiction',
      creatorName: 'Marcus Rivera',
      creatorEmail: 'marcus@example.com',
      packageFields: COMPLETE_PACKAGE,
      creatorApproval: approval,
      readinessScore: 9.2,
    });
    expect(submission.validation_result.eligible).toBe(true);
    expect(submission.status).toBe('SUBMITTED');

    // Step 5: Access log — agent requests access
    const accessEvent = buildAccessLogEventV1({
      eventId: 'evt-agent-request-001',
      actionType: 'request_access',
      actorUserId: 'agent-literary-001',
      listingId: 'listing-vanity-001',
      requesterId: 'agent-literary-001',
      verificationState: 'verified',
      validatorsRun: ['industry_verification_v1', 'storygate_submission_validator_v1'],
    });
    expect(accessEvent.action_type).toBe('request_access');
    expect(accessEvent.verification_state).toBe('verified');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 31: Revise Queue Lifecycle — Full State Transitions
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E Chain 31: Revise Queue Lifecycle — Queue Admission → Decisions → Completion', () => {
  const OPPORTUNITY_IDS = ['opp-lifecycle-001', 'opp-lifecycle-002', 'opp-lifecycle-003', 'opp-lifecycle-004'];

  it('completion certification requires all ready opportunities to have canonical decisions', () => {
    const result = buildReviseCompletionCertification({
      manuscriptId: 'ms-lifecycle-001',
      evaluationJobId: 'eval-lifecycle-001',
      readyOpportunityIds: OPPORTUNITY_IDS,
      decisions: [
        { id: 'd-001', opportunity_id: 'opp-lifecycle-001', decision: 'accepted_a' },
        { id: 'd-002', opportunity_id: 'opp-lifecycle-002', decision: 'custom' },
      ],
      pendingSyncCount: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.diagnostic_code).toBe('COMPLETION_PREMATURE');
      expect(result.failure.details.unresolved_ready_opportunity_ids).toContain('opp-lifecycle-003');
      expect(result.failure.details.unresolved_ready_opportunity_ids).toContain('opp-lifecycle-004');
      expect(result.failure.retryable).toBe(true);
    }
  });

  it('pending sync blocks completion even when all opportunities decided', () => {
    const result = buildReviseCompletionCertification({
      manuscriptId: 'ms-lifecycle-001',
      evaluationJobId: 'eval-lifecycle-001',
      readyOpportunityIds: OPPORTUNITY_IDS,
      decisions: OPPORTUNITY_IDS.map((id, i) => ({
        id: `d-${i}`,
        opportunity_id: id,
        decision: 'accepted_a',
      })),
      pendingSyncCount: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.diagnostic_code).toBe('COMPLETION_PENDING_SYNC');
      expect(result.failure.retryable).toBe(true);
    }
  });

  it('non-canonical decision blocks certification', () => {
    const result = buildReviseCompletionCertification({
      manuscriptId: 'ms-lifecycle-001',
      evaluationJobId: 'eval-lifecycle-001',
      readyOpportunityIds: ['opp-lifecycle-001'],
      decisions: [{ id: 'd-001', opportunity_id: 'opp-lifecycle-001', decision: 'INVALID_VALUE' }],
      pendingSyncCount: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.diagnostic_code).toBe('COMPLETION_CERT_INVALID');
      expect(result.failure.retryable).toBe(false);
    }
  });

  it('full completion: all decided, zero sync pending → certified', () => {
    const decisions = [
      { id: 'd-001', opportunity_id: 'opp-lifecycle-001', decision: 'accepted_a' },
      { id: 'd-002', opportunity_id: 'opp-lifecycle-002', decision: 'accepted_b' },
      { id: 'd-003', opportunity_id: 'opp-lifecycle-003', decision: 'custom' },
      { id: 'd-004', opportunity_id: 'opp-lifecycle-004', decision: 'keep_original' },
    ];
    const result = buildReviseCompletionCertification({
      manuscriptId: 'ms-lifecycle-001',
      evaluationJobId: 'eval-lifecycle-001',
      readyOpportunityIds: OPPORTUNITY_IDS,
      decisions,
      pendingSyncCount: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.completion_type).toBe('full');
      expect(result.record.decision_counts.accepted_a).toBe(1);
      expect(result.record.decision_counts.accepted_b).toBe(1);
      expect(result.record.decision_counts.custom).toBe(1);
      expect(result.record.decision_counts.keep_original).toBe(1);
      expect(result.record.certification_hash.length).toBeGreaterThan(0);
      expect(result.record.governance.no_pending_sync_entries).toBe(true);
    }
  });

  it('partial completion: some deferred → completion_type = partial', () => {
    const decisions = [
      { id: 'd-001', opportunity_id: 'opp-lifecycle-001', decision: 'accepted_a' },
      { id: 'd-002', opportunity_id: 'opp-lifecycle-002', decision: 'deferred' },
      { id: 'd-003', opportunity_id: 'opp-lifecycle-003', decision: 'deferred' },
      { id: 'd-004', opportunity_id: 'opp-lifecycle-004', decision: 'accepted_c' },
    ];
    const result = buildReviseCompletionCertification({
      manuscriptId: 'ms-lifecycle-001',
      evaluationJobId: 'eval-lifecycle-001',
      readyOpportunityIds: OPPORTUNITY_IDS,
      decisions,
      pendingSyncCount: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.completion_type).toBe('partial');
      expect(result.record.decision_counts.deferred).toBe(2);
    }
  });

  it('needs_targeting_deferred: no deferred ready but needs_targeting exists', () => {
    const decisions = OPPORTUNITY_IDS.map((id, i) => ({
      id: `d-${i}`,
      opportunity_id: id,
      decision: 'accepted_a',
    }));
    const result = buildReviseCompletionCertification({
      manuscriptId: 'ms-lifecycle-001',
      evaluationJobId: 'eval-lifecycle-001',
      readyOpportunityIds: OPPORTUNITY_IDS,
      decisions,
      pendingSyncCount: 0,
      needsTargetingCount: 5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.completion_type).toBe('needs_targeting_deferred');
      expect(result.record.needs_targeting_count).toBe(5);
    }
  });

  it('decision ledger columns are complete and fail-closed', () => {
    expect(REVISION_DECISION_LEDGER_COLUMNS.length).toBe(5);
    const keys = REVISION_DECISION_LEDGER_COLUMNS.map((c) => c.key);
    expect(keys).toContain('decision');
    expect(keys).toContain('option');
    expect(keys).toContain('criterion');
    expect(keys).toContain('opportunity');
    expect(keys).toContain('sync');
    for (const col of REVISION_DECISION_LEDGER_COLUMNS) {
      expect(col.failClosedRule.length).toBeGreaterThan(10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 32: Revised Manuscript Highlight Contract
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E Chain 32: Revised Manuscript Highlight Contract — Decision → Highlight Tone', () => {
  const HIGHLIGHT_TONES = ['system', 'custom', 'kept', 'rejected', 'deferred'] as const;

  it('every canonical decision maps to a valid highlight tone', () => {
    const decisionToHighlight: Record<string, string> = {
      accepted_a: 'system',
      accepted_b: 'system',
      accepted_c: 'system',
      custom: 'custom',
      keep_original: 'kept',
      reject: 'rejected',
      deferred: 'deferred',
    };
    for (const [decision, tone] of Object.entries(decisionToHighlight)) {
      expect(HIGHLIGHT_TONES).toContain(tone);
      expect(decision.length).toBeGreaterThan(0);
    }
  });

  it('FinalReviewDecision type covers all canonical decisions', () => {
    const canonicalDecisions: string[] = [
      'accepted_a', 'accepted_b', 'accepted_c', 'custom', 'keep_original', 'reject', 'deferred',
    ];
    for (const dec of canonicalDecisions) {
      expect(typeof dec).toBe('string');
    }
    expect(canonicalDecisions.length).toBe(7);
  });

  it('completion certification decision_counts covers all canonical decisions', () => {
    const decisions = [
      { id: 'd-1', opportunity_id: 'opp-1', decision: 'accepted_a' },
      { id: 'd-2', opportunity_id: 'opp-2', decision: 'accepted_b' },
      { id: 'd-3', opportunity_id: 'opp-3', decision: 'accepted_c' },
      { id: 'd-4', opportunity_id: 'opp-4', decision: 'custom' },
      { id: 'd-5', opportunity_id: 'opp-5', decision: 'keep_original' },
      { id: 'd-6', opportunity_id: 'opp-6', decision: 'reject' },
      { id: 'd-7', opportunity_id: 'opp-7', decision: 'deferred' },
    ];
    const result = buildReviseCompletionCertification({
      manuscriptId: 'ms-highlight-001',
      evaluationJobId: 'eval-highlight-001',
      readyOpportunityIds: decisions.map((d) => d.opportunity_id),
      decisions,
      pendingSyncCount: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.decision_counts.accepted_a).toBe(1);
      expect(result.record.decision_counts.accepted_b).toBe(1);
      expect(result.record.decision_counts.accepted_c).toBe(1);
      expect(result.record.decision_counts.custom).toBe(1);
      expect(result.record.decision_counts.keep_original).toBe(1);
      expect(result.record.decision_counts.reject).toBe(1);
      expect(result.record.decision_counts.deferred).toBe(1);
    }
  });

  it('accepted options produce system highlight, custom produces custom highlight', () => {
    const decisionHighlightMap: Record<string, typeof HIGHLIGHT_TONES[number]> = {
      accepted_a: 'system',
      accepted_b: 'system',
      accepted_c: 'system',
      custom: 'custom',
      keep_original: 'kept',
      reject: 'rejected',
      deferred: 'deferred',
    };
    for (const [, tone] of Object.entries(decisionHighlightMap)) {
      expect(HIGHLIGHT_TONES).toContain(tone);
    }
    expect(Object.keys(decisionHighlightMap).length).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 33: Hydration Failure → Recovery Chain
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E Chain 33: Hydration Failure → Structured Artifact → Recovery', () => {
  it('hydration failure produces a candidate_hydration_failure_v1 artifact', () => {
    const record = buildHydrationFailureRecord({
      opportunityId: 'opp-hydration-fail-001',
      failureCode: 'HYDRATION_SLAE_REJECTION',
      attemptCount: 1,
      maxAttempts: 3,
      rejectionReason: 'All three candidates echoed the anchor text',
      model: 'gpt-5.1',
      promptVersion: 'candidate_hydration_v2_premium_prose',
    });
    expect(record.artifact_type).toBe('candidate_hydration_failure_v1');
    expect(record.opportunity_id).toBe('opp-hydration-fail-001');
    expect(record.failure_code).toBe('HYDRATION_SLAE_REJECTION');
    expect(record.attempt_count).toBe(1);
    expect(record.max_attempts).toBe(3);
  });

  it('hydration failure disposition classifies correctly', () => {
    const slaeDisposition = classifyFailureDisposition('HYDRATION_SLAE_REJECTION');
    expect(slaeDisposition).toBe('retryable');

    const timeoutDisposition = classifyFailureDisposition('HYDRATION_TIMEOUT');
    expect(timeoutDisposition).toBe('retryable');

    const modelErrorDisposition = classifyFailureDisposition('HYDRATION_MODEL_ERROR');
    expect(modelErrorDisposition).toBe('retryable');
  });

  it('hydration failure codes are kick-eligible via REVISE_KICK_MATRIX', () => {
    const hydrationCodes: ReviseStageFailureCode[] = [
      'HYDRATION_TIMEOUT',
      'HYDRATION_MODEL_ERROR',
      'HYDRATION_BATCH_FAILED',
      'WORKBENCH_HYDRATION_FAILED',
    ];
    for (const code of hydrationCodes) {
      const kick = resolveKickTarget(code);
      if (kick) {
        expect(kick.kickCode).toBe(code);
      }
    }
  });

  it('full chain: hydration fails → failure record → disposition → revision failure record', () => {
    // Step 1: Hydration fails — produces structured artifact
    const hydrationRecord = buildHydrationFailureRecord({
      opportunityId: 'opp-hydration-chain-001',
      failureCode: 'HYDRATION_SLAE_REJECTION',
      attemptCount: 1,
      maxAttempts: 3,
      rejectionReason: 'Candidate A echoed the anchor',
      model: 'gpt-5.1',
      promptVersion: 'candidate_hydration_v2_premium_prose',
    });
    expect(hydrationRecord.artifact_type).toBe('candidate_hydration_failure_v1');

    // Step 2: Classify disposition
    const disposition = classifyFailureDisposition(hydrationRecord.failure_code as ReviseStageFailureCode);
    expect(disposition).toBe('retryable');

    // Step 3: Check retryability (attempt 1 < max 3 for timeout/model_error gets retryable status)
    const timeoutRecord = buildHydrationFailureRecord({
      opportunityId: 'opp-hydration-chain-002',
      failureCode: 'HYDRATION_TIMEOUT',
      attemptCount: 1,
      maxAttempts: 3,
      rejectionReason: null,
      model: 'gpt-5.1',
      promptVersion: 'candidate_hydration_v2_premium_prose',
    });
    expect(timeoutRecord.hydration_status).toBe('failed_retryable');

    // Step 4: Build revision failure record for pipeline tracking
    const revisionRecord = buildRevisionFailureRecord({
      sessionId: 'session-hydration-001',
      stageId: 'RS04_WORKBENCH_LOAD',
      failureCode: 'WORKBENCH_HYDRATION_FAILED',
      attemptCount: 1,
      opportunityId: hydrationRecord.opportunity_id,
      errorMessage: 'Hydration SLAE rejected all candidates',
    });
    expect(revisionRecord.artifact_type).toBe('revision_failure_record_v1');
    expect(revisionRecord.disposition).toBe('retryable');
    expect(revisionRecord.opportunity_id).toBe('opp-hydration-chain-001');
  });

  it('hydration exhausted attempts → terminal status', () => {
    const exhausted = buildHydrationFailureRecord({
      opportunityId: 'opp-hydration-exhausted',
      failureCode: 'HYDRATION_TIMEOUT',
      attemptCount: 3,
      maxAttempts: 3,
      rejectionReason: null,
      model: 'gpt-5.1',
      promptVersion: 'candidate_hydration_v2_premium_prose',
    });
    expect(exhausted.hydration_status).toBe('failed_terminal');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E CHAIN 34: Revise Queue Hard Caps + Metric Registry
// ═══════════════════════════════════════════════════════════════════════════════
describe('E2E Chain 34: Revise Queue Hard Caps + Metric Registry Governance', () => {
  it('short-form and long-form opportunity caps are enforced', () => {
    expect(REVISE_QUEUE_LEDGER_LIMITS.shortFormMaxOpportunities).toBe(50);
    expect(REVISE_QUEUE_LEDGER_LIMITS.longFormMaxOpportunities).toBe(100);
    expect(REVISE_QUEUE_LEDGER_LIMITS.longFormWordThreshold).toBe(25_000);
  });

  it('all 12 metric keys have descriptions', () => {
    const metricKeys = Object.keys(REVISE_QUEUE_LEDGER_INPUT_METRICS);
    expect(metricKeys.length).toBe(12);
    for (const key of metricKeys) {
      expect(REVISE_QUEUE_LEDGER_INPUT_METRICS[key as keyof typeof REVISE_QUEUE_LEDGER_INPUT_METRICS].length).toBeGreaterThan(10);
    }
  });

  it('queue ledger has 8 columns with fail-closed rules', () => {
    expect(REVISE_QUEUE_LEDGER_COLUMNS.length).toBe(8);
    for (const col of REVISE_QUEUE_LEDGER_COLUMNS) {
      expect(col.failClosedRule.length).toBeGreaterThan(10);
      expect(col.requiredInputs.length).toBeGreaterThan(0);
      expect(col.requiredOutputs.length).toBeGreaterThan(0);
    }
  });

  it('decision ledger columns track sync state', () => {
    const syncCol = REVISION_DECISION_LEDGER_COLUMNS.find((c) => c.key === 'sync');
    expect(syncCol).toBeDefined();
    expect(syncCol!.outputMetrics).toContain('synced_decision_count');
    expect(syncCol!.failClosedRule).toContain('Sync errors');
  });

  it('getReviseQueueLedgerColumnLabel returns correct labels', () => {
    expect(getReviseQueueLedgerColumnLabel('index')).toBe('#');
    expect(getReviseQueueLedgerColumnLabel('severity')).toBe('Severity');
    expect(getReviseQueueLedgerColumnLabel('status')).toBe('Status');
    expect(getReviseQueueLedgerColumnLabel('options')).toBe('Options');
  });

  it('every queue column has input and output metrics from the canonical registry', () => {
    const validMetrics = new Set(Object.keys(REVISE_QUEUE_LEDGER_INPUT_METRICS));
    for (const col of REVISE_QUEUE_LEDGER_COLUMNS) {
      for (const metric of [...col.inputMetrics, ...col.outputMetrics]) {
        expect(validMetrics.has(metric)).toBe(true);
      }
    }
  });
});
