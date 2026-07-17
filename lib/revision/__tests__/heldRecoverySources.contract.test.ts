import fs from 'fs';
import path from 'path';
import {
  buildClassifiedWorkbenchOpportunity,
  partitionClassifiedWorkbenchQueue,
} from '@/lib/revision/workbenchQueueProjection';
import {
  runCopyPasteAdmissionGate,
  runStrategyAdmissionGate,
} from '@/lib/revision/reviseAdmissionGate';
import {
  getHeldReasonInfo,
  HELD_REASON_INVENTORY,
  HELD_REASON_SOURCE_REGISTRY,
} from '@/lib/revision/heldRecoveryInventory';
import { buildRecoveryPlan } from '@/lib/revision/heldRecoveryPlan';

const repoRoot = path.resolve(__dirname, '../../../');

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf-8');
}

const EXCLUDED_UNREGISTERED_REASON_CODES = new Set<string>([
  // Codes that are emitted by production but are intentionally not modelled as
  // recoverable held reasons (e.g., success markers or non-canonical labels).
  'safe_local_copy_paste_rewrite',
]);

describe('Held Recovery source-contract tests', () => {
  it('partitionClassifiedWorkbenchQueue routes from finalDecision.cardType', () => {
    const make = (cardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld') =>
      ({
        id: cardType,
        cardType: 'withheld', // presentation mirror that must be ignored
        finalDecision: { cardType, reasons: [] as string[] },
        classification: { finalDecision: { cardType, reasons: [] }, baseDecision: { cardType, reasons: [] } },
      } as any);

    const opportunities = [
      make('copy_paste_rewrite'),
      make('revision_strategy'),
      make('withheld'),
      make('copy_paste_rewrite'),
    ];

    const { opportunities: copyPasteRewrites, needsTargeting: revisionStrategies, withheldUnsupported: withheld } =
      partitionClassifiedWorkbenchQueue(opportunities);

    expect(copyPasteRewrites).toHaveLength(2);
    expect(revisionStrategies).toHaveLength(1);
    expect(withheld).toHaveLength(1);
    for (const o of copyPasteRewrites) {
      expect(o.finalDecision.cardType).toBe('copy_paste_rewrite');
    }
  });

  it('buildClassifiedWorkbenchOpportunity copies finalDecision.reasons to executabilityReasons', () => {
    const opportunity = {
      id: 'x',
      groundingStatus: 'supported',
      contextQuality: 'clean',
      preflightStatus: 'passed',
      preflightReasons: [],
      copyPasteAdmissionReasons: [],
      strategyAdmissionReasons: [],
    } as any;

    const classification = {
      cardType: 'withheld' as const,
      trustedPathStatus: 'impossible' as const,
      reasons: ['truncated_anchor', 'context_missing'],
      strategyCardViewModel: null,
      copyPasteAdmissionPassed: false,
      copyPasteAdmissionReasons: [] as string[],
      strategyAdmissionPassed: false,
      strategyAdmissionReasons: [] as string[],
      baseDecision: { cardType: 'withheld' as const, trustedPathStatus: 'impossible' as const, reasons: [] as string[] },
      finalDecision: {
        cardType: 'withheld' as const,
        trustedPathStatus: 'impossible' as const,
        reasons: ['truncated_anchor', 'context_missing'],
      },
      needsTargetingPromotionApplied: false,
      promotionTransitionReason: null,
      needsTargetingOverrideApplied: false,
      gates: {
        copyPaste: { passed: false, reasons: [], passedCandidateCount: 0, candidateQualityPassed: false, diagnosticContractPassed: false, groundingPassed: false, integrityPassed: false, voicePassed: false, canonPassed: false, contextPassed: false, localOperationPassed: false },
        strategy: { passed: false, reasons: [], passedCandidateCount: 0, candidateQualityPassed: false, diagnosticContractPassed: false, groundingPassed: false, integrityPassed: false, voicePassed: false, canonPassed: false, contextPassed: false, localOperationPassed: false },
      },
    } as any;

    const classified = buildClassifiedWorkbenchOpportunity(opportunity, classification);
    expect(classified.executabilityReasons).toEqual(classified.finalDecision.reasons);
    expect(classified.executabilityReasons).toEqual(['truncated_anchor', 'context_missing']);
    expect(classified.executabilityReasons).not.toBe(classified.finalDecision.reasons);
  });

  it('executabilityReasons is treated as an annotation, not a canonical blocker', () => {
    const plan = buildRecoveryPlan({
      id: 'annotation-test',
      groundingStatus: 'supported',
      contextQuality: 'clean',
      finalDecision: { cardType: 'withheld', reasons: ['truncated_anchor'] },
      executabilityReasons: ['totally_unknown_reason_xyz'],
    });

    expect(plan.recoverable).toBe(true);
    expect(plan.unknownCanonicalReasons).toHaveLength(0);
    expect(plan.unknownAnnotations).toContain('totally_unknown_reason_xyz');
  });

  it('production queue construction populates the fields claimed by the source registry', () => {
    const opportunity = {
      id: 'field-provenance',
      groundingStatus: 'supported',
      groundingNote: 'Anchor verified.',
      contextQuality: 'clean',
      preflightStatus: 'passed',
      preflightReasons: ['hydration_anchor_truncated', 'insufficient_anchor_grounding'],
      hydrationFailureReasons: ['hydration_anchor_truncated'],
      resBlockerReasons: ['insufficient_anchor_grounding'],
      copyPasteAdmissionReasons: ['anchor_not_precise'],
      strategyAdmissionReasons: ['MISSING_CONCRETE_ACTION'],
    } as any;

    const classification = {
      cardType: 'withheld' as const,
      trustedPathStatus: 'impossible' as const,
      reasons: ['context_missing'],
      strategyCardViewModel: null,
      copyPasteAdmissionPassed: false,
      copyPasteAdmissionReasons: ['anchor_not_precise'] as string[],
      strategyAdmissionPassed: false,
      strategyAdmissionReasons: ['MISSING_CONCRETE_ACTION'] as string[],
      baseDecision: { cardType: 'withheld' as const, trustedPathStatus: 'impossible' as const, reasons: ['context_missing'] as string[] },
      finalDecision: { cardType: 'withheld' as const, trustedPathStatus: 'impossible' as const, reasons: ['context_missing'] as string[] },
      needsTargetingPromotionApplied: false,
      promotionTransitionReason: null,
      needsTargetingOverrideApplied: false,
      gates: {
        copyPaste: { passed: false, reasons: [], passedCandidateCount: 0, candidateQualityPassed: false, diagnosticContractPassed: false, groundingPassed: false, integrityPassed: false, voicePassed: false, canonPassed: false, contextPassed: false, localOperationPassed: false },
        strategy: { passed: false, reasons: [], passedCandidateCount: 0, candidateQualityPassed: false, diagnosticContractPassed: false, groundingPassed: false, integrityPassed: false, voicePassed: false, canonPassed: false, contextPassed: false, localOperationPassed: false },
      },
    } as any;

    const classified = buildClassifiedWorkbenchOpportunity(opportunity, classification);

    // Raw canonical fields flow through to the classified opportunity.
    expect(classified.groundingStatus).toBe('supported');
    expect(classified.groundingNote).toBe('Anchor verified.');
    expect(classified.contextQuality).toBe('clean');
    expect(classified.preflightStatus).toBe('passed');
    expect(classified.preflightReasons).toEqual(['hydration_anchor_truncated', 'insufficient_anchor_grounding']);
    expect(classified.hydrationFailureReasons).toEqual(['hydration_anchor_truncated']);
    expect(classified.resBlockerReasons).toEqual(['insufficient_anchor_grounding']);
    // Classification fields are exposed on the returned object.
    expect(classified.classification.copyPasteAdmissionReasons).toEqual(['anchor_not_precise']);
    expect(classified.classification.strategyAdmissionReasons).toEqual(['MISSING_CONCRETE_ACTION']);
    expect(classified.baseDecision.cardType).toBe('withheld');
    expect(classified.finalDecision.cardType).toBe('withheld');
    expect(classified.executabilityReasons).toEqual(classified.finalDecision.reasons);
  });

  it('preflight reasons are split into hydration and RES arrays in the production path', () => {
    const workbenchQueueSource = readSource('lib/revision/workbenchQueue.ts');
    expect(workbenchQueueSource).toMatch(/function splitPreflightReasonsByClass/);
    expect(workbenchQueueSource).toContain('HYDRATION_REASON_PREFIX');
    expect(workbenchQueueSource).toContain("startsWith(HYDRATION_REASON_PREFIX)");
    expect(workbenchQueueSource).toContain('hydrationFailureReasons:');
    expect(workbenchQueueSource).toContain('resBlockerReasons:');
  });

  it('partitionClassifiedWorkbenchQueue does not use opportunity.cardType as routing authority', () => {
    const projectionSource = readSource('lib/revision/workbenchQueueProjection.ts');
    const fnStart = projectionSource.indexOf('export function partitionClassifiedWorkbenchQueue');
    const fnEnd = projectionSource.indexOf('export function partitionWorkbenchQueue', fnStart);
    const partitionBody = projectionSource.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2000);
    expect(partitionBody).toContain('finalDecision.cardType');
    expect(partitionBody).not.toContain('opportunity.cardType');
    expect(partitionBody).not.toContain('item.cardType');
  });

  it('copy-paste and strategy admission reason fields come from the actual admission functions', () => {
    const input = {
      id: 'admission-test',
      readiness: 'ready_for_revise',
      groundingStatus: 'supported',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      anchor: 'The old oak tree stood in the clearing.',
      quoteHighlight: 'The old oak tree stood in the clearing.',
      quoteRest: '',
      options: [
        { key: 'A', candidateText: 'The ancient oak stood in the meadow.' },
        { key: 'B', candidateText: 'The old oak tree stood in the clearing.' },
        { key: 'C', candidateText: 'The oak tree stood in the clearing.' },
      ],
      symptom: 'The description feels generic.',
      cause: 'It uses placeholder language.',
      fixDirection: 'Replace the generic description with specific sensory detail.',
      readerEffect: 'Reader sees the scene more vividly.',
      revisionOperation: 'replace_selected_passage',
      mode: 'direct-rewrite',
    };

    const copyPaste = runCopyPasteAdmissionGate(input as any);
    const strategy = runStrategyAdmissionGate(input as any);

    expect(Array.isArray(copyPaste.reasons)).toBe(true);
    expect(Array.isArray(strategy.reasons)).toBe(true);

    // The classification projection uses these same admission functions, so the
    // returned reason arrays are the source of the copyPasteAdmissionReasons and
    // strategyAdmissionReasons fields.
    const classified = buildClassifiedWorkbenchOpportunity({
      ...input,
      copyPasteAdmissionPassed: copyPaste.passed,
      copyPasteAdmissionReasons: copyPaste.reasons,
      strategyAdmissionPassed: strategy.passed,
      strategyAdmissionReasons: strategy.reasons,
      baseDecision: { cardType: 'withheld', reasons: [] },
      finalDecision: { cardType: 'withheld', reasons: [] },
    } as any);

    expect(classified.classification.copyPasteAdmissionReasons).toEqual(copyPaste.reasons);
    expect(classified.classification.strategyAdmissionReasons).toEqual(strategy.reasons);
  });

  it('every canonical reason code emitted by admission and projection is registered or explicitly excluded', () => {
    const input = {
      id: 'coverage-test',
      readiness: 'needs_targeting',
      groundingStatus: 'unsupported_blocked',
      preflightStatus: 'blocked',
      contextQuality: 'blocked',
      anchor: '',
      quoteHighlight: '',
      quoteRest: '',
      options: [
        { key: 'A', candidateText: '[INSERT better scene here]' },
        { key: 'B', candidateText: 'FIXME' },
        { key: 'C', candidateText: 'TODO' },
      ],
      symptom: '',
      cause: '',
      fixDirection: '',
      readerEffect: '',
      revisionOperation: 'needs_targeting',
      mode: 'direct-rewrite',
    };

    const observed = new Set<string>();
    const copyPaste = runCopyPasteAdmissionGate(input as any);
    const strategy = runStrategyAdmissionGate(input as any);
    copyPaste.reasons.forEach((r) => observed.add(r));
    strategy.reasons.forEach((r) => observed.add(r));

    for (const code of observed) {
      const info = getHeldReasonInfo(code);
      if (EXCLUDED_UNREGISTERED_REASON_CODES.has(code)) continue;
      expect(info.reasonCode).not.toBe('unknown');
    }
  });

  it('source registry only allows final_decision as routing authority', () => {
    const routingSources = HELD_REASON_SOURCE_REGISTRY.filter((s) => s.authoritativeForRouting);
    expect(routingSources).toHaveLength(1);
    expect(routingSources[0]!.source).toBe('final_decision');
  });

  it('canonicalPlanningSources is always a subset of possibleProvenanceSources and never contains non-authoritative annotation sources', () => {
    const forbidden = new Set(['executability', 'grounding_note', 'admin_annotation']);
    for (const info of Object.values(HELD_REASON_INVENTORY)) {
      const canon = new Set(info.canonicalPlanningSources);
      const provenance = new Set(info.possibleProvenanceSources);
      for (const source of canon) {
        expect(provenance.has(source)).toBe(true);
        expect(forbidden.has(source)).toBe(false);
      }
    }
  });
});
