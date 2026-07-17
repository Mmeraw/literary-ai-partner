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
  resolveRepairScope,
  modeForScope,
  resolveEvidenceLocationScope,
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

function buildSafeOpportunity(overrides: Partial<WorkbenchOpportunity> = {}): WorkbenchOpportunity {
  return buildMinimalOpportunity({
    quoteHighlight: 'The night wind cut through the open window.',
    quoteRest: '',
    anchor: 'chapter_1',
    groundingStatus: 'supported',
    contextQuality: 'clean',
    preflightStatus: 'passed',
    preflightReasons: [],
    ...overrides,
  });
}

function withoutFields<T extends Record<string, unknown>>(obj: T, ...keys: (keyof T)[]): T {
  const clone = { ...obj };
  for (const key of keys) {
    delete clone[key];
  }
  return clone;
}

function assertOpportunitiesEqualExcept<T extends Record<string, unknown>>(
  a: T,
  b: T,
  except: (keyof T)[],
): void {
  const aStripped = withoutFields(a, ...except);
  const bStripped = withoutFields(b, ...except);
  expect(aStripped).toEqual(bStripped);
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
      const opportunity = buildSafeOpportunity();
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('copy_paste_rewrite');
      expect(classification.finalDecision.reasons).toEqual([BASE_DECISION_REASON.SAFE_LOCAL_COPY_PASTE_REWRITE]);
    });

    it('missing evidence / unsupported grounding produces withheld with EVIDENCE_MISSING', () => {
      const opportunity = buildSafeOpportunity({
        quoteHighlight: '',
        quoteRest: '',
        groundingStatus: 'unsupported_blocked',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(new Set(classification.finalDecision.reasons)).toEqual(
        new Set([
          BASE_DECISION_REASON.EVIDENCE_MISSING,
          BASE_DECISION_REASON.CONTEXT_MISSING,
          BASE_DECISION_REASON.DIAGNOSIS_UNSUPPORTED,
        ]),
      );
    });

    it('hard context block produces withheld with CONTEXT_MISSING', () => {
      const opportunity = buildSafeOpportunity({
        contextQuality: 'blocked',
        preflightStatus: 'blocked',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(new Set(classification.finalDecision.reasons)).toEqual(
        new Set([BASE_DECISION_REASON.CONTEXT_MISSING, BASE_DECISION_REASON.CANON_UNCLEAR]),
      );
    });

    it('hard canon conflict produces withheld with CANON_UNCLEAR', () => {
      const opportunity = buildSafeOpportunity({
        preflightReasons: ['canon_authority_blocked'],
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toEqual([BASE_DECISION_REASON.CANON_UNCLEAR]);
    });

    it('missing diagnostic contract produces withheld with diagnostic and integrity reasons', () => {
      const opportunity = buildSafeOpportunity({
        symptom: '',
        cause: '',
        fixDirection: '',
        readerEffect: '',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(new Set(classification.finalDecision.reasons)).toEqual(
        new Set([
          BASE_DECISION_REASON.COPY_PASTE_ADMISSION_FAILED,
          'DIAGNOSTIC_MISSING_SYMPTOM',
          'DIAGNOSTIC_MISSING_CAUSE',
          'DIAGNOSTIC_MISSING_FIX_DIRECTION',
          'DIAGNOSTIC_MISSING_READER_EFFECT',
          ADMISSION_REASON.INTEGRITY_BELOW_PASS_STRONG,
          'INTEGRITY_INCOMPLETE_FIELD',
          BASE_DECISION_REASON.STRATEGY_ADMISSION_FAILED,
        ]),
      );
    });

    it('needs_targeting with strategy admission passed produces revision_strategy', () => {
      const opportunity = buildSafeOpportunity({
        readiness: 'needs_targeting',
        revisionOperation: 'needs_targeting',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('revision_strategy');
      expect(classification.needsTargetingOverrideApplied).toBe(true);
    });

    it('chapter scope with safe inputs produces revision_strategy', () => {
      const opportunity = buildSafeOpportunity({
        scope: 'Chapter',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('revision_strategy');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.PASSAGE_TOO_LONG);
    });

    it('candidate quality failure produces withheld when strategy admission also fails', () => {
      const opportunity = buildSafeOpportunity({
        options: [
          { key: 'A', mechanism: 'Empty', candidateText: '', text: '', rationale: '' },
          { key: 'B', mechanism: 'Empty', candidateText: '', text: '', rationale: '' },
          { key: 'C', mechanism: 'Empty', candidateText: '', text: '', rationale: '' },
        ],
      });
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(new Set(classification.finalDecision.reasons)).toEqual(
        new Set([
          BASE_DECISION_REASON.COPY_PASTE_ADMISSION_FAILED,
          'EMPTY_CANDIDATE',
          'REVISION_QUALITY_FAILED',
          BASE_DECISION_REASON.STRATEGY_ADMISSION_FAILED,
        ]),
      );
    });
  });

  describe('B. partition characterization — finalDecision.cardType → Workbench bucket', () => {
    function buildClassificationWithFinal(
      opportunity: WorkbenchOpportunity,
      cardType: ClassifiedWorkbenchOpportunity['finalDecision']['cardType'],
    ): ClassifiedWorkbenchOpportunity {
      const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
      const overridden = {
        ...classification,
        finalDecision: { ...classification.finalDecision, cardType },
        baseDecision: { ...classification.baseDecision, cardType },
      };
      return buildClassifiedWorkbenchOpportunity(opportunity, overridden);
    }

    it('routes classified opportunities by finalDecision.cardType', () => {
      const opportunity = buildSafeOpportunity();
      const copyPaste = buildClassificationWithFinal(opportunity, 'copy_paste_rewrite');
      const strategy = buildClassificationWithFinal(opportunity, 'revision_strategy');
      const withheld = buildClassificationWithFinal(opportunity, 'withheld');

      const partition = partitionClassifiedWorkbenchQueue([copyPaste, strategy, withheld]);
      expect(partition.opportunities.map((o) => o.id)).toContain(copyPaste.id);
      expect(partition.needsTargeting.map((o) => o.id)).toContain(strategy.id);
      expect(partition.withheldUnsupported.map((o) => o.id)).toContain(withheld.id);
    });

    it('ignores stale opportunity.cardType when it differs from finalDecision.cardType', () => {
      const opportunity = buildSafeOpportunity();
      const classified = buildClassificationWithFinal(opportunity, 'withheld');
      classified.cardType = 'copy_paste_rewrite';

      const partition = partitionClassifiedWorkbenchQueue([classified]);
      expect(partition.withheldUnsupported.map((o) => o.id)).toContain(classified.id);
      expect(partition.opportunities).toHaveLength(0);
    });

    it('ignores stale readiness when finalDecision.cardType is withheld', () => {
      const opportunity = buildSafeOpportunity();
      const classified = buildClassificationWithFinal(opportunity, 'withheld');
      classified.readiness = 'ready_for_revise';

      const partition = partitionClassifiedWorkbenchQueue([classified]);
      expect(partition.withheldUnsupported.map((o) => o.id)).toContain(classified.id);
    });
  });

  describe('C. recovery behavior characterization — current state of the repository', () => {
    it('records whether a recovery action is encoded, inferred, or absent for representative reasons', () => {
      const rows = [
        { code: 'truncated_anchor', source: 'preflight', repairFamily: 'anchor' },
        { code: 'context_missing', source: 'base_decision', repairFamily: 'context' },
        { code: 'candidate_quality_failed', source: 'candidate_quality', repairFamily: 'candidates' },
        { code: 'diagnostic_missing_symptom', source: 'copy_paste_admission', repairFamily: 'diagnosis' },
        { code: 'testimony_fabrication_risk', source: 'candidate_quality', repairFamily: 'none' },
      ];

      for (const row of rows) {
        const info = getHeldReasonInfo(row.code);
        expect(info.isUnknown).toBe(false);
        expect(info.repairFamily).toBe(row.repairFamily);
      }
    });
  });

  describe('D. classifier field consumption and withheld mapping', () => {
    it('hydrationFailureReasons is not read by the classifier', () => {
      const safe = buildSafeOpportunity();
      const withHydrationFailures = buildSafeOpportunity({
        hydrationFailureReasons: ['hydration_anchor_truncated'],
      });

      const safeClassification = classifyWorkbenchExecutabilityDetailed(safe);
      const withFailuresClassification = classifyWorkbenchExecutabilityDetailed(withHydrationFailures);

      expect(safeClassification.finalDecision).toEqual(withFailuresClassification.finalDecision);
    });

    it('rationale is resolved upstream into scope and mode before classification', () => {
      const scope = resolveRepairScope({
        fixDirection: 'Replace the summary.',
        symptom: 'The scene loses momentum.',
        readerEffect: 'The reader sees Mara hesitate.',
        rationale: 'This must be redistributed across the whole manuscript.',
        revisionOperation: 'replace_selected_passage',
        scope: 'Passage',
      });
      expect(scope).toBe('Manuscript');
      expect(modeForScope(scope)).toBe('repair-brief');
    });

    it('anchor is resolved upstream to a scope before classification', () => {
      expect(resolveEvidenceLocationScope('chapter:1')).toBe('Chapter');
      expect(resolveEvidenceLocationScope('')).toBe('Passage');
    });

    const directFieldCases: Array<{
      name: string;
      category: 'classifier' | 'admission gates';
      baseOverrides: Partial<WorkbenchOpportunity>;
      variantOverrides: Partial<WorkbenchOpportunity>;
      expectedBase: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld';
      expectedVariant: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld';
      onlyFieldChanged: keyof WorkbenchOpportunity | [keyof WorkbenchOpportunity, keyof WorkbenchOpportunity];
    }> = [
      {
        name: 'quoteHighlight + quoteRest',
        category: 'classifier',
        baseOverrides: {},
        variantOverrides: { quoteHighlight: '', quoteRest: '' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: ['quoteHighlight', 'quoteRest'],
      },
      {
        name: 'groundingStatus',
        category: 'classifier',
        baseOverrides: {},
        variantOverrides: { groundingStatus: 'unsupported_blocked' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: 'groundingStatus',
      },
      {
        name: 'contextQuality',
        category: 'classifier',
        baseOverrides: {},
        variantOverrides: { contextQuality: 'blocked' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: 'contextQuality',
      },
      {
        name: 'preflightStatus',
        category: 'classifier',
        baseOverrides: {},
        variantOverrides: { preflightStatus: 'blocked' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: 'preflightStatus',
      },
      {
        name: 'preflightReasons',
        category: 'classifier',
        baseOverrides: {},
        variantOverrides: { preflightReasons: ['canon_authority_blocked'] },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: 'preflightReasons',
      },
      {
        name: 'anchor',
        category: 'classifier',
        baseOverrides: {},
        variantOverrides: { anchor: '' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'revision_strategy',
        onlyFieldChanged: 'anchor',
      },
      {
        name: 'scope',
        category: 'classifier',
        baseOverrides: {},
        variantOverrides: { scope: 'Chapter' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'revision_strategy',
        onlyFieldChanged: 'scope',
      },
      {
        name: 'mode',
        category: 'classifier',
        baseOverrides: {},
        variantOverrides: { mode: 'repair-brief' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'revision_strategy',
        onlyFieldChanged: 'mode',
      },
      {
        name: 'revisionOperation',
        category: 'classifier',
        baseOverrides: {},
        variantOverrides: { revisionOperation: 'needs_targeting' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'revision_strategy',
        onlyFieldChanged: 'revisionOperation',
      },
      {
        name: 'options',
        category: 'admission gates',
        baseOverrides: {},
        variantOverrides: {
          options: [
            { key: 'A', mechanism: 'Empty', candidateText: '', text: '', rationale: '' },
            { key: 'B', mechanism: 'Empty', candidateText: '', text: '', rationale: '' },
            { key: 'C', mechanism: 'Empty', candidateText: '', text: '', rationale: '' },
          ],
        },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: 'options',
      },
      {
        name: 'symptom',
        category: 'admission gates',
        baseOverrides: {},
        variantOverrides: { symptom: '' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: 'symptom',
      },
      {
        name: 'cause',
        category: 'admission gates',
        baseOverrides: {},
        variantOverrides: { cause: '' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: 'cause',
      },
      {
        name: 'fixDirection',
        category: 'admission gates',
        baseOverrides: {},
        variantOverrides: { fixDirection: '' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: 'fixDirection',
      },
      {
        name: 'readerEffect',
        category: 'admission gates',
        baseOverrides: {},
        variantOverrides: { readerEffect: '' },
        expectedBase: 'copy_paste_rewrite',
        expectedVariant: 'withheld',
        onlyFieldChanged: 'readerEffect',
      },
    ];

    for (const testCase of directFieldCases) {
      it(`${testCase.category} consume ${testCase.name}`, () => {
        const base = buildSafeOpportunity(testCase.baseOverrides);
        const variant = buildSafeOpportunity(testCase.variantOverrides);

        const changedFields = Array.isArray(testCase.onlyFieldChanged)
          ? testCase.onlyFieldChanged
          : [testCase.onlyFieldChanged];
        assertOpportunitiesEqualExcept(base, variant, changedFields as (keyof WorkbenchOpportunity)[]);

        const baseClassification = classifyWorkbenchExecutabilityDetailed(base);
        const variantClassification = classifyWorkbenchExecutabilityDetailed(variant);

        expect(baseClassification.finalDecision.cardType).toBe(testCase.expectedBase);
        expect(variantClassification.finalDecision.cardType).toBe(testCase.expectedVariant);
        expect(baseClassification.finalDecision.cardType).not.toBe(variantClassification.finalDecision.cardType);
      });
    }

    it('readiness drives needs-targeting promotion and drops base evidence_missing reasons', () => {
      const base = buildSafeOpportunity({ quoteHighlight: '', quoteRest: '' });
      const variant = buildSafeOpportunity({ quoteHighlight: '', quoteRest: '', readiness: 'needs_targeting' });
      assertOpportunitiesEqualExcept(base, variant, ['readiness']);

      const baseClassification = classifyWorkbenchExecutabilityDetailed(base);
      const variantClassification = classifyWorkbenchExecutabilityDetailed(variant);

      expect(baseClassification.finalDecision).toEqual({
        cardType: 'withheld',
        trustedPathStatus: 'impossible',
        reasons: [
          BASE_DECISION_REASON.EVIDENCE_MISSING,
          BASE_DECISION_REASON.CONTEXT_MISSING,
          BASE_DECISION_REASON.DIAGNOSIS_UNSUPPORTED,
        ],
      });

      // Design note for recovery-contract phase: the promotion replaces
      // finalDecision.reasons with the union of strategyAdmission.reasons and
      // copyPasteAdmission.reasons. When both gates report no reasons, the
      // promoted revision_strategy carries an empty reason array, dropping the
      // base evidence_missing/context_missing/diagnosis_unsupported explanation.
      expect(variantClassification.finalDecision).toEqual({
        cardType: 'revision_strategy',
        trustedPathStatus: 'unavailable_author_review_required',
        reasons: [],
      });
      expect(variantClassification.needsTargetingOverrideApplied).toBe(true);
      expect(variantClassification.needsTargetingPromotionApplied).toBe(true);
      expect(variantClassification.promotionTransitionReason).toBe(
        "readiness === 'needs_targeting' and strategy admission passed; base executability was withheld and has been promoted to revision_strategy",
      );
    });
  });

  describe('E. optional-field representability', () => {
    it('still classifies when optional fields are absent', () => {
      const absent = withoutFields(
        buildSafeOpportunity(),
        'groundingStatus',
        'contextQuality',
        'preflightStatus',
        'preflightReasons',
        'hydrationFailureReasons',
      );
      const classification = classifyWorkbenchExecutabilityDetailed(absent);
      expect(classification.finalDecision.cardType).toBe('withheld');
    });

    it('still classifies when optional fields are explicitly undefined', () => {
      const undefinedOptional = buildSafeOpportunity({
        groundingStatus: undefined,
        contextQuality: undefined,
        preflightStatus: undefined,
        preflightReasons: undefined,
        hydrationFailureReasons: undefined,
      });
      const classification = classifyWorkbenchExecutabilityDetailed(undefinedOptional);
      expect(classification.finalDecision.cardType).toBe('withheld');
    });

    it('treats contradictory context/preflight states as the strongest block', () => {
      const contradictory = buildSafeOpportunity({
        contextQuality: 'clean',
        preflightStatus: 'blocked',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(contradictory);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.CONTEXT_MISSING);
    });

    it('treats missing source excerpt as withheld regardless of other safe fields', () => {
      const missingExcerpt = withoutFields(buildSafeOpportunity(), 'quoteHighlight', 'quoteRest');
      const classification = classifyWorkbenchExecutabilityDetailed(missingExcerpt);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.EVIDENCE_MISSING);
    });

    it('treats empty options as a candidate-quality failure', () => {
      const missingOptions = withoutFields(buildSafeOpportunity(), 'options');
      const classification = classifyWorkbenchExecutabilityDetailed(missingOptions);
      expect(classification.finalDecision.cardType).toBe('withheld');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.COPY_PASTE_ADMISSION_FAILED);
    });

    it('treats a placeholder coordinate as imprecise', () => {
      const placeholderAnchor = buildSafeOpportunity({
        anchor: 'evaluation_result:recommendation',
      });
      const classification = classifyWorkbenchExecutabilityDetailed(placeholderAnchor);
      expect(classification.finalDecision.cardType).toBe('revision_strategy');
      expect(classification.finalDecision.reasons).toContain(BASE_DECISION_REASON.ANCHOR_NOT_PRECISE);
    });
  });
});
