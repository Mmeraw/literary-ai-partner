import { describe, it, expect } from '@jest/globals';
import {
  HELD_REASON_INVENTORY,
  getHeldReasonInfo,
  normalizeHeldReasonCode,
} from '@/lib/revision/heldRecoveryReasons';
import { HELD_REASON_SOURCE_REGISTRY } from '@/lib/revision/heldRecoverySources';
import { VOICE_GATE_REASON_CODES } from '@/lib/revision/voiceGate';
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
    symptom: 'The scene loses physical momentum because the action is summarized rather than shown in the passage.',
    cause: 'The summary flattens the beat because it reports action instead of dramatizing it, with the result that the scene loses momentum.',
    fixDirection: 'Replace the summary with one concrete physical action Mara performs in the scene so the reader can decide how she acts.',
    readerEffect: 'The reader sees Mara hesitate and the emotional weight of the moment lands with clarity.',
    mistakeProofing: 'Keep Mara, the letter, and the surrounding scene unchanged.',
    diagnostic: {
      symptom: 'The scene loses physical momentum because the action is summarized rather than shown in the passage.',
      cause: 'The summary flattens the beat because it reports action instead of dramatizing it, with the result that the scene loses momentum.',
      fixStrategy: 'Replace the summary with one concrete physical action Mara performs in the scene so the reader can decide how she acts.',
      readerImpact: 'The reader sees Mara hesitate and the emotional weight of the moment lands with clarity.',
      evidence: { quotedExcerpt: '', locationLabel: '' },
      operationTargeting: '',
      mistakeProofing: 'Keep Mara, the letter, and the surrounding scene unchanged.',
    },
    revisionOperation: 'replace_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: null,
    options: [
      { key: 'A', mechanism: 'Primary', candidateText: 'Mara set the letter down and waited for the sound to fade.', text: 'Mara set the letter down and waited for the sound to fade.', rationale: 'Direct action.' },
      { key: 'B', mechanism: 'Rhythm', candidateText: 'Mara laid the letter aside, her fingers still resting on its edge.', text: 'Mara laid the letter aside, her fingers still resting on its edge.', rationale: 'Softer rhythm.' },
      { key: 'C', mechanism: 'Bold', candidateText: 'Mara kept the letter in her hand and did not look away.', text: 'Mara kept the letter in her hand and did not look away.', rationale: 'Hesitation.' },
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

  describe('A. classification characterization — real producer state → finalDecision.cardType', () => {
    it('safe local copy-paste inputs produce copy_paste_rewrite', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: 'The night wind cut through the open window.',
        quoteRest: '',
        anchor: 'chapter_1',
        groundingStatus: 'supported',
        contextQuality: 'clean',
        preflightStatus: 'passed',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('copy_paste_rewrite');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.SAFE_LOCAL_COPY_PASTE_REWRITE);
    });

    it('missing evidence / unsupported grounding produces withheld with EVIDENCE_MISSING', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: '',
        quoteRest: '',
        anchor: 'chapter_1',
        groundingStatus: 'unsupported_blocked',
        contextQuality: 'blocked',
        preflightStatus: 'blocked',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.EVIDENCE_MISSING);
    });

    it('hard context block produces withheld with CONTEXT_MISSING', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: 'The night wind cut through the open window.',
        quoteRest: '',
        anchor: 'chapter_1',
        groundingStatus: 'supported',
        contextQuality: 'blocked',
        preflightStatus: 'blocked',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.CONTEXT_MISSING);
    });

    it('hard canon conflict produces withheld with CANON_UNCLEAR', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: 'The night wind cut through the open window.',
        quoteRest: '',
        anchor: 'chapter_1',
        groundingStatus: 'supported',
        contextQuality: 'clean',
        preflightStatus: 'blocked',
        preflightReasons: ['canon_authority_blocked'],
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.CANON_UNCLEAR);
    });

    it('missing diagnostic contract produces withheld with diagnostic missing reasons', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: 'Mara paused at the threshold.',
        quoteRest: '',
        groundingStatus: 'supported',
        contextQuality: 'clean',
        preflightStatus: 'passed',
        symptom: '',
        cause: '',
        fixDirection: '',
        readerEffect: '',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      const reasons = classification.finalDecision.reasons;
      expect(reasons.some((reason) => /DIAGNOSTIC_MISSING_/i.test(reason))).toBe(true);
    });

    it('needs_targeting with strategy admission passed produces revision_strategy', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: 'The night wind cut through the open window.',
        quoteRest: '',
        anchor: 'chapter_1',
        groundingStatus: 'supported',
        contextQuality: 'clean',
        preflightStatus: 'passed',
        readiness: 'needs_targeting',
        revisionOperation: 'needs_targeting',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('revision_strategy');
      expect(classification.needsTargetingOverrideApplied).toBe(true);
    });

    it('chapter scope with safe inputs produces revision_strategy', () => {
      const opportunity = buildMinimalOpportunity({
        scope: 'Chapter',
        mode: 'repair-brief',
        quoteHighlight: 'The night wind cut through the open window.',
        quoteRest: '',
        anchor: 'chapter_1',
        groundingStatus: 'supported',
        contextQuality: 'clean',
        preflightStatus: 'passed',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('revision_strategy');
    });

    it('candidate quality failure produces withheld when strategy admission also fails', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: 'Mara paused at the threshold.',
        quoteRest: '',
        groundingStatus: 'supported',
        contextQuality: 'clean',
        preflightStatus: 'passed',
        options: [
          { key: 'A', mechanism: 'Empty', candidateText: '', text: '', rationale: '' },
          { key: 'B', mechanism: 'Empty', candidateText: '', text: '', rationale: '' },
          { key: 'C', mechanism: 'Empty', candidateText: '', text: '', rationale: '' },
        ],
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons.some((r) => /EMPTY|TOO_SHORT|REVISION_QUALITY_FAILED/i.test(r))).toBe(true);
    });
  });

  describe('B. partition characterization — finalDecision.cardType → Workbench bucket', () => {
    it('routes classified opportunities by finalDecision.cardType', () => {
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

    it('ignores stale opportunity.cardType when it differs from finalDecision.cardType', () => {
      const classified = buildClassifiedWorkbenchOpportunity(buildMinimalOpportunity(), {
        cardType: 'copy_paste_rewrite',
        trustedPathStatus: 'eligible',
        reasons: [BASE_DECISION_REASON.SAFE_LOCAL_COPY_PASTE_REWRITE],
        strategyCardViewModel: null,
        copyPasteAdmissionPassed: true,
        copyPasteAdmissionReasons: [],
        strategyAdmissionPassed: false,
        strategyAdmissionReasons: [],
        baseDecision: { cardType: 'copy_paste_rewrite', trustedPathStatus: 'eligible', reasons: [BASE_DECISION_REASON.SAFE_LOCAL_COPY_PASTE_REWRITE] },
        finalDecision: { cardType: 'withheld', trustedPathStatus: 'impossible', reasons: ['stale_override'] },
        needsTargetingPromotionApplied: false,
        promotionTransitionReason: null,
        needsTargetingOverrideApplied: false,
        gates: { copyPaste: { passed: true, reasons: [], passedCandidateCount: 2 }, strategy: { passed: false, reasons: [], passedCandidateCount: 0 } },
      } as any);

      classified.cardType = 'copy_paste_rewrite';

      const partition = partitionClassifiedWorkbenchQueue([classified]);
      expect(partition.withheldUnsupported.map((o) => o.id)).toContain(classified.id);
      expect(partition.opportunities).toHaveLength(0);
    });

    it('ignores stale readiness when finalDecision.cardType is withheld', () => {
      const classified = buildClassifiedWorkbenchOpportunity(buildMinimalOpportunity(), {
        readiness: 'ready_for_revise',
        finalDecision: { cardType: 'withheld', trustedPathStatus: 'impossible', reasons: ['context_missing'] },
      } as any);

      const partition = partitionClassifiedWorkbenchQueue([classified]);
      expect(partition.withheldUnsupported.map((o) => o.id)).toContain(classified.id);
    });
  });

  describe('C. recovery behavior characterization — current state of the repository', () => {
    it('records that no held recovery executor exists yet', () => {
      expect(() => require('../heldRecoveryExecutor')).toThrow();
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

  describe('D. classifier field consumption and withheld mapping', () => {
    it('lists every WorkbenchOpportunity field consumed by classifyWorkbenchExecutabilityDetailedCore', () => {
      const consumed = [
        'quoteHighlight',
        'quoteRest',
        'groundingStatus',
        'contextQuality',
        'preflightStatus',
        'preflightReasons',
        'hydrationFailureReasons',
        'anchor',
        'scope',
        'mode',
        'revisionOperation',
        'readiness',
        'fixDirection',
        'symptom',
        'readerEffect',
        'options',
      ];

      const opportunity = buildMinimalOpportunity({
        quoteHighlight: 'The night wind cut through the open window.',
        quoteRest: '',
        anchor: 'chapter_1',
        groundingStatus: 'supported',
        contextQuality: 'clean',
        preflightStatus: 'passed',
        preflightReasons: [],
        hydrationFailureReasons: [],
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('copy_paste_rewrite');

      for (const field of consumed) {
        expect(opportunity).toHaveProperty(field);
      }
    });

    it('maps missing evidence to withheld / evidence_missing', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: '',
        quoteRest: '',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.EVIDENCE_MISSING);
    });

    it('maps blocked context to withheld / context_missing', () => {
      const opportunity = buildMinimalOpportunity({
        contextQuality: 'blocked',
        preflightStatus: 'blocked',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.CONTEXT_MISSING);
    });

    it('maps canon conflict to withheld / canon_unclear', () => {
      const opportunity = buildMinimalOpportunity({
        preflightReasons: ['canon_authority_blocked'],
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.CANON_UNCLEAR);
    });

    it('maps missing diagnostic contract to withheld with diagnostic reasons', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: 'The night wind cut through the open window.',
        quoteRest: '',
        groundingStatus: 'supported',
        contextQuality: 'clean',
        preflightStatus: 'passed',
        symptom: '',
        cause: '',
        fixDirection: '',
        readerEffect: '',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons.some((r) => /diagnostic|integrity|strategy_admission/i.test(r))).toBe(true);
    });

    it('maps failed candidate quality and strategy admission to withheld with candidate-quality reasons', () => {
      const opportunity = buildMinimalOpportunity({
        quoteHighlight: 'The night wind cut through the open window.',
        quoteRest: '',
        groundingStatus: 'supported',
        contextQuality: 'clean',
        preflightStatus: 'passed',
        options: [
          { key: 'A', mechanism: 'Bad', candidateText: '', text: '', rationale: '' },
          { key: 'B', mechanism: 'Bad', candidateText: '', text: '', rationale: '' },
          { key: 'C', mechanism: 'Bad', candidateText: '', text: '', rationale: '' },
        ],
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(
        classification.finalDecision.reasons.some((r) =>
          /candidate|quality|strategy_admission|copy_paste_admission/i.test(r),
        ),
      ).toBe(true);
    });
  });
});
