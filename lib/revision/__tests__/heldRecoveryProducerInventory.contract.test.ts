import { describe, it, expect } from '@jest/globals';
import {
  HELD_REASON_INVENTORY,
  getHeldReasonInfo,
  normalizeHeldReasonCode,
} from '@/lib/revision/heldRecoveryReasons';
import { HELD_REASON_SOURCE_REGISTRY } from '@/lib/revision/heldRecoverySources';
import {
  VOICE_GATE_REASON_CODES,
} from '@/lib/revision/voiceGate';
import { CANON_GATE_REASON_CODES } from '@/lib/revision/canonGate';
import {
  ADMISSION_CANDIDATE_QUALITY_REASON_CODES,
  LEDGER_CANDIDATE_QUALITY_REASON_CODES,
  LEDGER_CARD_QUALITY_FAILED,
} from '@/lib/revision/candidateQuality';
import {
  COPY_PASTE_ADMISSION_REASON_CODES,
  STRATEGY_ADMISSION_REASON_CODES,
  ADMISSION_REASON,
} from '@/lib/revision/reviseAdmissionGate';
import {
  BASE_DECISION_LOCAL_REASON_CODES,
  BASE_DECISION_REASON,
  evaluateRecommendationExecutability,
} from '@/lib/revision/recommendationExecutability';
import { INTEGRITY_VIOLATION_CODES } from '@/lib/evaluation/pipeline/recommendationIntegrityGate';
import {
  LEDGER_CANDIDATE_COMPLIANCE_REASON_CODES,
  LEDGER_DIAGNOSTIC_REASON_CODES,
  LEDGER_HYDRATION_REASON_CODES,
  LEDGER_PREFLIGHT_REASON_CODES,
  LEDGER_TELEMETRY_REASON_CODES,
} from '@/lib/revision/opportunityLedger';
import {
  partitionClassifiedWorkbenchQueue,
  buildClassifiedWorkbenchOpportunity,
  classifyWorkbenchExecutabilityDetailed,
  type ClassifiedWorkbenchOpportunity,
} from '@/lib/revision/workbenchQueueProjection';
import type { WorkbenchOpportunity } from '@/lib/revision/workbenchQueue';

function normalize(code: string): string {
  return normalizeHeldReasonCode(code);
}

function* allProducerCodes(): Generator<string> {
  for (const code of VOICE_GATE_REASON_CODES) yield normalize(code);
  for (const code of CANON_GATE_REASON_CODES) yield normalize(code);
  for (const code of ADMISSION_CANDIDATE_QUALITY_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_CANDIDATE_QUALITY_REASON_CODES) yield normalize(code);
  yield normalize(LEDGER_CARD_QUALITY_FAILED);
  for (const code of COPY_PASTE_ADMISSION_REASON_CODES) yield normalize(code);
  for (const code of STRATEGY_ADMISSION_REASON_CODES) yield normalize(code);
  for (const code of BASE_DECISION_LOCAL_REASON_CODES) yield normalize(code);
  for (const code of INTEGRITY_VIOLATION_CODES) {
    yield `integrity_${normalize(code)}`;
  }
  yield normalize(ADMISSION_REASON.INTEGRITY_BELOW_PASS_STRONG);
  for (const code of LEDGER_CANDIDATE_COMPLIANCE_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_DIAGNOSTIC_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_PREFLIGHT_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_HYDRATION_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_TELEMETRY_REASON_CODES) yield normalize(code);
  yield normalize(BASE_DECISION_REASON.COPY_PASTE_ADMISSION_FAILED);
  yield normalize(BASE_DECISION_REASON.STRATEGY_ADMISSION_FAILED);
}

function buildMinimalOpportunity(overrides: Partial<WorkbenchOpportunity> = {}): WorkbenchOpportunity {
  return {
    id: 'opp-test',
    severity: 'must',
    scope: 'Passage',
    mode: 'direct-rewrite',
    source: 'evaluation',
    criterion: 'pacing',
    leverage: 'pacing',
    crumb: 'pacing',
    title: 'Test',
    issueStatement: 'Test issue',
    meta: '',
    confidence: 'high',
    anchor: '',
    quoteHighlight: '',
    quoteRest: '',
    symptom: 'The moment feels rushed.',
    cause: 'Summary replaces observable action.',
    fixDirection: 'Add one concrete physical action.',
    readerEffect: 'Reader witnesses the decision.',
    mistakeProofing: 'Keep names and events unchanged.',
    diagnostic: {
      symptom: 'The moment feels rushed.',
      cause: 'Summary replaces observable action.',
      fixStrategy: 'Add one concrete physical action.',
      readerImpact: 'Reader witnesses the decision.',
      evidence: { quotedExcerpt: '', locationLabel: '' },
      operationTargeting: '',
      mistakeProofing: 'Keep names and events unchanged.',
    },
    revisionOperation: 'replace_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: null,
    options: [
      { key: 'A', mechanism: 'Primary', candidateText: 'Mara set the letter down.', text: 'Mara set the letter down.', rationale: 'Direct action.' },
      { key: 'B', mechanism: 'Rhythm', candidateText: 'Mara laid the letter aside.', text: 'Mara laid the letter aside.', rationale: 'Softer rhythm.' },
      { key: 'C', mechanism: 'Bold', candidateText: 'Mara kept the letter in her hand.', text: 'Mara kept the letter in her hand.', rationale: 'Hesitation.' },
    ],
    ...overrides,
  } as WorkbenchOpportunity;
}

describe('held recovery producer characterization', () => {
  it('enumerates every code emitted by a held-state producer in the inventory', () => {
    const unmapped: string[] = [];
    for (const code of new Set(allProducerCodes())) {
      const info = getHeldReasonInfo(code);
      if (info.isUnknown) {
        unmapped.push(code);
      }
    }
    expect(unmapped).toEqual([]);
  });

  it('records final_decision as the only source authoritative for routing', () => {
    const routingSources = HELD_REASON_SOURCE_REGISTRY.filter((s) => s.authoritativeForRouting);
    expect(routingSources).toHaveLength(1);
    expect(routingSources[0]!.source).toBe('final_decision');
  });

  it('records executability and grounding_note as non-authoritative display annotations', () => {
    const executability = HELD_REASON_SOURCE_REGISTRY.find((s) => s.source === 'executability');
    const groundingNote = HELD_REASON_SOURCE_REGISTRY.find((s) => s.source === 'grounding_note');
    expect(executability?.authoritativeForRecoveryPlanning).toBe(false);
    expect(executability?.authoritativeForRouting).toBe(false);
    expect(groundingNote?.authoritativeForRecoveryPlanning).toBe(false);
    expect(groundingNote?.authoritativeForRouting).toBe(false);
  });

  it('produces a recovery-metadata row for every inventory entry without asserting correctness', () => {
    const rows: Record<string, unknown>[] = [];
    for (const [code] of Object.entries(HELD_REASON_INVENTORY)) {
      const info = getHeldReasonInfo(code);
      rows.push({
        code,
        canonicalPlanningSources: info.canonicalPlanningSources,
        repairFamily: info.repairFamily,
        recoverable: info.recoverable,
        automaticRecoveryAllowed: info.automaticRecoveryAllowed,
        allowedTerminalOutcomes: info.allowedTerminalOutcomes,
        isHardBlocker: info.isHardBlocker,
      });
    }
    expect(rows.length).toBeGreaterThan(0);
    const sample = rows.find((r) => r.code === 'truncated_anchor');
    expect(sample).toMatchObject({
      code: 'truncated_anchor',
      repairFamily: 'anchor',
      recoverable: true,
    });
  });

  it('characterizes base-decision executability: missing evidence yields withheld', () => {
    const result = evaluateRecommendationExecutability({
      evidencePresent: false,
      contextPresent: false,
      canonClear: false,
      diagnosisSupported: false,
      anchorPrecise: false,
      passageLength: 'short',
      beforeAfterContextSufficient: false,
      ledgerConflictPossible: false,
      canonConflict: false,
      affectsSceneArchitecture: false,
      affectsPOVVoiceCanonMetaphor: false,
      downstreamContinuityRisk: false,
      voiceFingerprintStable: false,
      localOperation: false,
      passingCandidateCount: 0,
      candidateProseNarrativeSafe: false,
    });
    expect(result.cardType).toBe('withheld');
    expect(result.reasons).toContain(BASE_DECISION_REASON.EVIDENCE_MISSING);
  });

  it('characterizes base-decision executability: safe inputs yield copy_paste_rewrite', () => {
    const result = evaluateRecommendationExecutability({
      evidencePresent: true,
      contextPresent: true,
      canonClear: true,
      diagnosisSupported: true,
      anchorPrecise: true,
      passageLength: 'short',
      beforeAfterContextSufficient: true,
      ledgerConflictPossible: false,
      canonConflict: false,
      affectsSceneArchitecture: false,
      affectsPOVVoiceCanonMetaphor: false,
      downstreamContinuityRisk: false,
      voiceFingerprintStable: true,
      localOperation: true,
      passingCandidateCount: 2,
      candidateProseNarrativeSafe: true,
    });
    expect(result.cardType).toBe('copy_paste_rewrite');
    expect(result.reasons).toContain(BASE_DECISION_REASON.SAFE_LOCAL_COPY_PASTE_REWRITE);
  });

  it('classification produces a finalDecision.cardType and copies it to the opportunity', () => {
    const opportunity = buildMinimalOpportunity({
      quoteHighlight: 'Mara paused at the threshold.',
      quoteRest: '',
      groundingStatus: 'supported',
      contextQuality: 'clean',
      preflightStatus: 'passed',
    });
    const classified = classifyWorkbenchExecutabilityDetailed(opportunity);
    expect(classified.finalDecision.cardType).toBeDefined();
    expect(classified.finalDecision.reasons.length).toBeGreaterThan(0);

    const built = buildClassifiedWorkbenchOpportunity(opportunity, classified);
    expect(built.cardType).toBe(classified.finalDecision.cardType);
    expect(built.finalDecision.cardType).toBe(classified.finalDecision.cardType);
    expect(built.executabilityReasons).toEqual(classified.finalDecision.reasons);
  });

  it('partitionClassifiedWorkbenchQueue routes by finalDecision.cardType, not by display reasons', () => {
    const make = (cardType: ClassifiedWorkbenchOpportunity['finalDecision']['cardType']): ClassifiedWorkbenchOpportunity =>
      buildClassifiedWorkbenchOpportunity(buildMinimalOpportunity(), {
        cardType,
        trustedPathStatus: cardType === 'copy_paste_rewrite' ? 'eligible' : cardType === 'revision_strategy' ? 'unavailable_author_review_required' : 'impossible',
        reasons: ['test-reason'],
        strategyCardViewModel: null,
        copyPasteAdmissionPassed: false,
        copyPasteAdmissionReasons: [],
        strategyAdmissionPassed: false,
        strategyAdmissionReasons: [],
        baseDecision: { cardType, trustedPathStatus: 'impossible', reasons: ['test-reason'] },
        finalDecision: { cardType, trustedPathStatus: 'impossible', reasons: ['test-reason'] },
        needsTargetingPromotionApplied: false,
        promotionTransitionReason: null,
        needsTargetingOverrideApplied: false,
        gates: { copyPaste: { passed: false, reasons: [], passedCandidateCount: 0 }, strategy: { passed: false, reasons: [], passedCandidateCount: 0 } },
      } as any);

    const copyPaste = make('copy_paste_rewrite');
    const strategy = make('revision_strategy');
    const withheld = make('withheld');

    const partition = partitionClassifiedWorkbenchQueue([copyPaste, strategy, withheld]);
    expect(partition.opportunities.map((o) => o.id)).toContain(copyPaste.id);
    expect(partition.needsTargeting.map((o) => o.id)).toContain(strategy.id);
    expect(partition.withheldUnsupported.map((o) => o.id)).toContain(withheld.id);
  });

  it('records whether a recovery action is encoded, inferred, or absent for representative reasons', () => {
    const rows = [
      { code: 'truncated_anchor', source: 'preflight', recoveryAction: 'expand_anchor', encoded: false },
      { code: 'context_missing', source: 'base_decision', recoveryAction: 'retrieve_context', encoded: false },
      { code: 'candidate_quality_failed', source: 'candidate_quality', recoveryAction: 'regenerate_candidates', encoded: false },
      { code: 'diagnostic_missing_symptom', source: 'copy_paste_admission', recoveryAction: 'repair_diagnosis', encoded: false },
      { code: 'testimony_fabrication_risk', source: 'candidate_quality', recoveryAction: 'none', encoded: false },
    ];

    for (const row of rows) {
      const info = getHeldReasonInfo(row.code);
      expect(info.isUnknown).toBe(false);
      if (row.recoveryAction === 'none') {
        expect(info.repairFamily).toBe('none');
      }
    }
  });
});
