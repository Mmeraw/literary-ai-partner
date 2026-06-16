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
