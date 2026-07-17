/**
 * WORKBENCH QUEUE MEMBERSHIP PROOF
 *
 * Three independent guarantees, in dependency order:
 *
 *   1. Pure partition authority
 *      finalDecision.cardType determines bucket membership.
 *      raw cardType, readiness, and any other legacy field are irrelevant.
 *
 *   2. Classifier → projection → partition integration
 *      The full production chain produces all three terminal outcomes.
 *      Classifier assertion fires before bucket assertion so a fixture problem
 *      is distinguishable from a partition problem.
 *
 *   3. UI surface conservation
 *      Payload buckets map correctly to interactive / held surfaces.
 *      Key non-obvious invariant: needsTargeting payload bucket contains
 *      strategy cards that ARE interactive, not held.
 */

import {
  buildClassifiedWorkbenchOpportunity,
  classifyWorkbenchExecutabilityDetailed,
  partitionClassifiedWorkbenchQueue,
} from '@/lib/revision/workbenchQueueProjection';
import type {
  ClassifiedWorkbenchOpportunity,
  WorkbenchExecutabilityClassification,
} from '@/lib/revision/workbenchQueueProjection';
import type { WorkbenchOpportunity } from '@/lib/revision/workbenchQueue';

// ---------------------------------------------------------------------------
// Shared base objects used as structural scaffolding for direct construction
// ---------------------------------------------------------------------------

const BASE_DECISION = {
  cardType: 'withheld' as const,
  trustedPathStatus: 'impossible' as const,
  reasons: ['base_stub'] as readonly string[],
} as unknown as WorkbenchExecutabilityClassification['finalDecision'];

const BASE_CLASSIFICATION = {
  cardType: 'withheld' as const,
  trustedPathStatus: 'impossible' as const,
  reasons: ['base_stub'] as readonly string[],
  strategyCardViewModel: null,
  copyPasteAdmissionPassed: false,
  copyPasteAdmissionReasons: [],
  strategyAdmissionPassed: false,
  strategyAdmissionReasons: [],
  baseDecision: BASE_DECISION,
  finalDecision: BASE_DECISION,
  needsTargetingPromotionApplied: false,
  promotionTransitionReason: null,
  needsTargetingOverrideApplied: false,
  gates: {
    copyPaste: { passed: false, reasons: [], passedCandidateCount: 0 },
    strategy: { passed: false, reasons: [] },
  },
} as unknown as WorkbenchExecutabilityClassification;

const BASE_OPPORTUNITY = {
  id: 'base',
  severity: 'must',
  scope: 'Passage',
  mode: 'direct-rewrite',
  source: 'evaluation',
  criterion: 'NARRATIVE_DRIVE',
  leverage: 'Evaluation',
  crumb: 'NARRATIVE_DRIVE · passage:base',
  title: 'Base opportunity',
  issueStatement: 'Base issue statement.',
  meta: 'passage:base',
  confidence: 'high confidence',
  anchor: 'passage:1',
  quoteHighlight: 'The quick brown fox jumped over the lazy dog.',
  quoteRest: '',
  symptom: 'In the quoted passage "The quick brown fox jumped over the lazy dog," the moment resolves as summary instead of action.',
  cause: 'This happens because Mara summarizes the action instead of rendering the physical beat.',
  fixDirection: 'Replace the quoted passage "The quick brown fox jumped over the lazy dog" so Mara chooses a visible physical response, dramatizing the consequence before the emotion is named.',
  readerEffect: 'This lets readers track Mara\'s action through the body, so the theme of momentum keeps the revelation from flattening into summary.',
  mistakeProofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
  diagnostic: {
    symptom: 'In the quoted passage "The quick brown fox jumped over the lazy dog," the moment resolves as summary instead of action.',
    cause: 'This happens because Mara summarizes the action instead of rendering the physical beat.',
    fixStrategy: 'Replace the quoted passage.',
    readerImpact: 'This lets readers track action through the body.',
    evidence: { quotedExcerpt: 'The quick brown fox jumped over the lazy dog.', locationLabel: 'passage:1' },
    operationTargeting: 'Passage · passage:1',
    mistakeProofing: 'Do not introduce new information.',
  },
  revisionOperation: 'replace_selected_passage',
  readiness: 'ready_for_revise',
  readinessReason: null,
  cardType: 'withheld',
  trustedPathStatus: 'impossible',
  executabilityReasons: [],
  options: [
    { key: 'A', mechanism: 'Recommended repair', candidateText: 'base A', text: 'base A', rationale: 'Primary' },
    { key: 'B', mechanism: 'Rhythm variant', candidateText: 'base B', text: 'base B', rationale: 'Variant' },
    { key: 'C', mechanism: 'Bolder shift', candidateText: 'base C', text: 'base C', rationale: 'Bolder' },
  ],
} as unknown as WorkbenchOpportunity;

/**
 * Build a ClassifiedWorkbenchOpportunity with any subset of fields overridden.
 * overrides MUST spread last so deliberately contradictory fields are preserved.
 * Supply complete finalDecision / baseDecision objects — they are assigned
 * directly, not merged with the base stub.
 */
function makeClassifiedOpportunity(
  overrides: Partial<ClassifiedWorkbenchOpportunity>,
): ClassifiedWorkbenchOpportunity {
  return {
    ...BASE_OPPORTUNITY,
    classification: BASE_CLASSIFICATION,
    baseDecision: BASE_DECISION,
    finalDecision: BASE_DECISION,
    ...overrides,
  } as ClassifiedWorkbenchOpportunity;
}

// ---------------------------------------------------------------------------
// Raw WorkbenchOpportunity fixtures for the integration proof layer.
// Fixture values taken from existing passing projection tests.
// ---------------------------------------------------------------------------

const LONG_A =
  'Mara pressed her palm against the cool glass and watched the rain dissolve the lights below the bridge.';
const LONG_B =
  'A slow river carries the boat past the willows where the heron waits without moving through the long afternoon.';
const LONG_C =
  'The quick brown fox jumps over the lazy dog while the sun stays low behind the distant hills at dusk.';

function makeLongOptions() {
  return [
    { key: 'A' as const, mechanism: 'Recommended repair', candidateText: LONG_A, text: LONG_A, rationale: 'Primary' },
    { key: 'B' as const, mechanism: 'Rhythm variant', candidateText: LONG_B, text: LONG_B, rationale: 'Variant' },
    { key: 'C' as const, mechanism: 'Bolder shift', candidateText: LONG_C, text: LONG_C, rationale: 'Bolder' },
  ];
}

function makeRawOpportunity(
  id: string,
  overrides: Record<string, unknown> = {},
): WorkbenchOpportunity {
  return {
    ...BASE_OPPORTUNITY,
    id,
    anchor: `passage:${id}`,
    crumb: `NARRATIVE_DRIVE · passage:${id}`,
    options: makeLongOptions(),
    ...overrides,
  } as unknown as WorkbenchOpportunity;
}

// ---------------------------------------------------------------------------
// UI surface derivation — mirrors exact logic in ReviseCockpitClientWorkflowV2
//
// Note: the component filters by item.cardType (the mirrored field), not
// item.finalDecision.cardType. For the UI surface proof we use fixtures where
// cardType === finalDecision.cardType, matching production output from
// buildClassifiedWorkbenchOpportunity. Pure routing authority — proven in
// section 1 — is intentionally separate.
// ---------------------------------------------------------------------------

function deriveUiSurfaces(payload: {
  opportunities: ClassifiedWorkbenchOpportunity[];
  needsTargeting: ClassifiedWorkbenchOpportunity[];
  withheldUnsupported: ClassifiedWorkbenchOpportunity[];
}): {
  interactiveItems: ClassifiedWorkbenchOpportunity[];
  heldItems: ClassifiedWorkbenchOpportunity[];
} {
  const seenInteractive = new Set<string>();
  const interactiveItems = [...payload.opportunities, ...payload.needsTargeting]
    .filter((item) => item.cardType !== 'withheld')
    .filter((item) => {
      if (seenInteractive.has(item.id)) return false;
      seenInteractive.add(item.id);
      return true;
    });

  const seenHeld = new Set<string>();
  const heldItems = [
    ...payload.withheldUnsupported,
    ...payload.needsTargeting.filter((item) => item.cardType === 'withheld'),
  ].filter((item) => {
    if (seenHeld.has(item.id)) return false;
    seenHeld.add(item.id);
    return true;
  });

  return { interactiveItems, heldItems };
}

// ===========================================================================
// 1. PURE PARTITION AUTHORITY
// ===========================================================================

describe('Workbench queue membership proof', () => {
  describe('pure partition authority', () => {
    /**
     * Three items with deliberately contradictory legacy fields.
     *
     *   id           raw cardType         raw readiness      finalDecision.cardType
     *   copy-paste   withheld             blocked            copy_paste_rewrite
     *   strategy     copy_paste_rewrite   ready_for_revise   revision_strategy
     *   withheld     revision_strategy    needs_targeting    withheld
     */
    const copyPaste = makeClassifiedOpportunity({
      id: 'copy-paste',
      cardType: 'withheld',           // stale raw field — must not affect routing
      readiness: 'blocked' as any,    // stale raw field — must not affect routing
      finalDecision: {
        cardType: 'copy_paste_rewrite',
        trustedPathStatus: 'eligible',
        reasons: ['authoritative_copy_paste'],
      } as unknown as WorkbenchExecutabilityClassification['finalDecision'],
    });

    const strategy = makeClassifiedOpportunity({
      id: 'strategy',
      cardType: 'copy_paste_rewrite', // stale raw field — must not affect routing
      readiness: 'ready_for_revise',  // stale raw field — must not affect routing
      finalDecision: {
        cardType: 'revision_strategy',
        trustedPathStatus: 'unavailable_author_review_required',
        reasons: ['authoritative_strategy'],
      } as unknown as WorkbenchExecutabilityClassification['finalDecision'],
    });

    const withheld = makeClassifiedOpportunity({
      id: 'withheld',
      cardType: 'revision_strategy',  // stale raw field — must not affect routing
      readiness: 'needs_targeting',   // stale raw field — must not affect routing
      finalDecision: {
        cardType: 'withheld',
        trustedPathStatus: 'impossible',
        reasons: ['authoritative_withheld'],
      } as unknown as WorkbenchExecutabilityClassification['finalDecision'],
    });

    const inputs = [copyPaste, strategy, withheld];
    let result: ReturnType<typeof partitionClassifiedWorkbenchQueue>;

    beforeAll(() => {
      result = partitionClassifiedWorkbenchQueue(inputs);
    });

    it('routes copy_paste_rewrite finalDecision to opportunities', () => {
      expect(result.opportunities).toEqual([copyPaste]);
    });

    it('routes revision_strategy finalDecision to needsTargeting', () => {
      expect(result.needsTargeting).toEqual([strategy]);
    });

    it('routes withheld finalDecision to withheldUnsupported', () => {
      expect(result.withheldUnsupported).toEqual([withheld]);
    });

    it('preserves object reference identity — no copies or new objects created', () => {
      expect(result.opportunities[0]).toBe(copyPaste);
      expect(result.needsTargeting[0]).toBe(strategy);
      expect(result.withheldUnsupported[0]).toBe(withheld);
    });

    it('conservation equation: sum of bucket lengths equals input length', () => {
      expect(
        result.opportunities.length +
          result.needsTargeting.length +
          result.withheldUnsupported.length,
      ).toBe(inputs.length);
    });

    it('conservation by reference: every input appears exactly once across all outputs', () => {
      const outputs = [
        ...result.opportunities,
        ...result.needsTargeting,
        ...result.withheldUnsupported,
      ];
      expect(outputs).toHaveLength(inputs.length);
      for (const input of inputs) {
        expect(outputs.filter((output) => output === input)).toHaveLength(1);
      }
    });

    it('set equality: output IDs match input IDs exactly — no silent drops, no foreign outputs', () => {
      const outputs = [
        ...result.opportunities,
        ...result.needsTargeting,
        ...result.withheldUnsupported,
      ];
      expect(new Set(outputs.map((item) => item.id))).toEqual(
        new Set(inputs.map((item) => item.id)),
      );
    });

    it('withheldUnsupported equals exactly inputs where finalDecision.cardType is withheld', () => {
      expect(result.withheldUnsupported).toEqual(
        inputs.filter((item) => item.finalDecision.cardType === 'withheld'),
      );
    });

    it('opportunities equals exactly inputs where finalDecision.cardType is copy_paste_rewrite', () => {
      expect(result.opportunities).toEqual(
        inputs.filter((item) => item.finalDecision.cardType === 'copy_paste_rewrite'),
      );
    });

    it('needsTargeting equals exactly inputs where finalDecision.cardType is revision_strategy', () => {
      expect(result.needsTargeting).toEqual(
        inputs.filter((item) => item.finalDecision.cardType === 'revision_strategy'),
      );
    });

    it('raw cardType did not control membership: copy-paste absent from withheldUnsupported despite raw cardType=withheld', () => {
      expect(result.withheldUnsupported.some((o) => o.id === 'copy-paste')).toBe(false);
    });

    it('readiness did not control membership: copy-paste present in opportunities despite raw readiness=blocked', () => {
      expect(result.opportunities.some((o) => o.id === 'copy-paste')).toBe(true);
    });
  });

  // =========================================================================
  // 2. CLASSIFIER → PROJECTION → PARTITION INTEGRATION
  // =========================================================================

  describe('classifier-to-partition integration', () => {
    const rawCopyPaste = makeRawOpportunity('int-copy-paste', {
      readiness: 'ready_for_revise',
      contextQuality: 'clean',
      preflightStatus: 'passed',
      groundingStatus: 'supported',
    });

    const rawStrategy = makeRawOpportunity('int-strategy', {
      readiness: 'ready_for_revise',
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      groundingStatus: 'supported',
    });

    const rawWithheld = makeRawOpportunity('int-withheld', {
      readiness: 'ready_for_revise',
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      preflightReasons: ['canon_conflict'],
      groundingStatus: 'supported',
    });

    let classifiedCopyPaste: ClassifiedWorkbenchOpportunity;
    let classifiedStrategy: ClassifiedWorkbenchOpportunity;
    let classifiedWithheld: ClassifiedWorkbenchOpportunity;
    let result: ReturnType<typeof partitionClassifiedWorkbenchQueue>;

    beforeAll(() => {
      classifiedCopyPaste = buildClassifiedWorkbenchOpportunity(
        rawCopyPaste,
        classifyWorkbenchExecutabilityDetailed(rawCopyPaste),
      );
      classifiedStrategy = buildClassifiedWorkbenchOpportunity(
        rawStrategy,
        classifyWorkbenchExecutabilityDetailed(rawStrategy),
      );
      classifiedWithheld = buildClassifiedWorkbenchOpportunity(
        rawWithheld,
        classifyWorkbenchExecutabilityDetailed(rawWithheld),
      );
      result = partitionClassifiedWorkbenchQueue([
        classifiedCopyPaste,
        classifiedStrategy,
        classifiedWithheld,
      ]);
    });

    // Classifier assertions run first. If these fail the fixture or classifier
    // is the problem — not the partition.
    it('classifier produces copy_paste_rewrite for clean context and passed preflight', () => {
      expect(classifiedCopyPaste.finalDecision.cardType).toBe('copy_paste_rewrite');
    });

    it('classifier produces revision_strategy for limited context', () => {
      expect(classifiedStrategy.finalDecision.cardType).toBe('revision_strategy');
    });

    it('classifier produces withheld when canon_conflict preflight reason is present', () => {
      expect(classifiedWithheld.finalDecision.cardType).toBe('withheld');
    });

    // Bucket assertions follow only after classifier outcomes are confirmed above.
    it('copy-paste item is in opportunities and absent from both other buckets', () => {
      expect(result.opportunities.some((o) => o === classifiedCopyPaste)).toBe(true);
      expect(result.needsTargeting.some((o) => o === classifiedCopyPaste)).toBe(false);
      expect(result.withheldUnsupported.some((o) => o === classifiedCopyPaste)).toBe(false);
    });

    it('strategy item is in needsTargeting and absent from both other buckets', () => {
      expect(result.needsTargeting.some((o) => o === classifiedStrategy)).toBe(true);
      expect(result.opportunities.some((o) => o === classifiedStrategy)).toBe(false);
      expect(result.withheldUnsupported.some((o) => o === classifiedStrategy)).toBe(false);
    });

    it('withheld item is in withheldUnsupported and absent from both other buckets', () => {
      expect(result.withheldUnsupported.some((o) => o === classifiedWithheld)).toBe(true);
      expect(result.opportunities.some((o) => o === classifiedWithheld)).toBe(false);
      expect(result.needsTargeting.some((o) => o === classifiedWithheld)).toBe(false);
    });

    it('conservation: all three classified items appear exactly once across all buckets', () => {
      const outputs = [
        ...result.opportunities,
        ...result.needsTargeting,
        ...result.withheldUnsupported,
      ];
      expect(outputs).toHaveLength(3);
      for (const item of [classifiedCopyPaste, classifiedStrategy, classifiedWithheld]) {
        expect(outputs.filter((o) => o === item)).toHaveLength(1);
      }
    });
  });

  // =========================================================================
  // 3. UI SURFACE CONSERVATION
  // =========================================================================

  describe('UI surface conservation', () => {
    /**
     * Fixtures here have cardType aligned with finalDecision.cardType, matching
     * production output from buildClassifiedWorkbenchOpportunity.
     *
     * The UI component filters by item.cardType (the mirrored field).
     * Pure routing authority is proven independently in section 1.
     */
    const uiCopyPaste = makeClassifiedOpportunity({
      id: 'ui-copy-paste',
      cardType: 'copy_paste_rewrite',
      finalDecision: {
        cardType: 'copy_paste_rewrite',
        trustedPathStatus: 'eligible',
        reasons: ['safe_local_copy_paste_rewrite'],
      } as unknown as WorkbenchExecutabilityClassification['finalDecision'],
    });

    const uiStrategy = makeClassifiedOpportunity({
      id: 'ui-strategy',
      cardType: 'revision_strategy',
      finalDecision: {
        cardType: 'revision_strategy',
        trustedPathStatus: 'unavailable_author_review_required',
        reasons: ['insufficient_before_after_context'],
      } as unknown as WorkbenchExecutabilityClassification['finalDecision'],
    });

    const uiWithheld = makeClassifiedOpportunity({
      id: 'ui-withheld',
      cardType: 'withheld',
      finalDecision: {
        cardType: 'withheld',
        trustedPathStatus: 'impossible',
        reasons: ['canon_unclear'],
      } as unknown as WorkbenchExecutabilityClassification['finalDecision'],
    });

    const payload = {
      opportunities: [uiCopyPaste],
      needsTargeting: [uiStrategy],
      withheldUnsupported: [uiWithheld],
    };

    let interactiveItems: ClassifiedWorkbenchOpportunity[];
    let heldItems: ClassifiedWorkbenchOpportunity[];

    beforeAll(() => {
      ({ interactiveItems, heldItems } = deriveUiSurfaces(payload));
    });

    it('copy-paste item is interactive', () => {
      expect(interactiveItems.some((o) => o === uiCopyPaste)).toBe(true);
    });

    it('strategy item is interactive', () => {
      expect(interactiveItems.some((o) => o === uiStrategy)).toBe(true);
    });

    it('withheld item is not interactive', () => {
      expect(interactiveItems.some((o) => o === uiWithheld)).toBe(false);
    });

    it('withheld item is held', () => {
      expect(heldItems.some((o) => o === uiWithheld)).toBe(true);
    });

    it('copy-paste item is not held', () => {
      expect(heldItems.some((o) => o === uiCopyPaste)).toBe(false);
    });

    it('strategy item is not held', () => {
      expect(heldItems.some((o) => o === uiStrategy)).toBe(false);
    });

    it('needsTargeting payload bucket is interactive: strategy cards are NOT held despite the bucket name', () => {
      // Locks in the non-obvious contract: payload.needsTargeting contains
      // strategy cards that reach the interactive queue, not the held panel.
      expect(interactiveItems).toEqual([uiCopyPaste, uiStrategy]);
      expect(heldItems).toEqual([uiWithheld]);
    });

    it('UI conservation by reference: every item surfaces exactly once across interactive and held', () => {
      const surfaced = [...interactiveItems, ...heldItems];
      expect(surfaced).toHaveLength(3);
      for (const item of [uiCopyPaste, uiStrategy, uiWithheld]) {
        expect(surfaced.filter((candidate) => candidate === item)).toHaveLength(1);
      }
    });

    it('UI conservation by ID: no item silently dropped — surfaced IDs equal all payload IDs', () => {
      const surfaced = [...interactiveItems, ...heldItems];
      const payloadIds = new Set([
        ...payload.opportunities.map((o) => o.id),
        ...payload.needsTargeting.map((o) => o.id),
        ...payload.withheldUnsupported.map((o) => o.id),
      ]);
      expect(new Set(surfaced.map((o) => o.id))).toEqual(payloadIds);
    });
  });
});
