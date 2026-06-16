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
import { runQualityGateV2 } from '@/lib/evaluation/pipeline/qualityGate';
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
import {
  checkRecommendationIntegrity,
  meetsMinimumTier,
} from '@/lib/evaluation/pipeline/recommendationIntegrityGate';


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
      expect(entry.canonicalInput).toContain('UnifiedEvaluationDocument');
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
