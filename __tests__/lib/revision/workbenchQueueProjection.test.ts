import {
  resolveEvidenceLocationScope,
  resolveRepairScope,
  modeForScope,
  hasPlaceholderCoordinates,
  passageLengthForExecutability,
  classifyWorkbenchExecutability,
  partitionWorkbenchQueue,
  buildStrategyCardViewModel,
} from '@/lib/revision/workbenchQueueProjection';
import type { WorkbenchOpportunity, WorkbenchScope, WorkbenchMode } from '@/lib/revision/workbenchQueue';

type MinimalOpportunity = Omit<WorkbenchOpportunity, 'id' | 'severity' | 'scope' | 'mode' | 'source' | 'criterion' | 'leverage' | 'crumb' | 'title' | 'issueStatement' | 'meta' | 'confidence' | 'anchor' | 'quoteHighlight' | 'quoteRest' | 'symptom' | 'cause' | 'fixDirection' | 'readerEffect' | 'mistakeProofing' | 'diagnostic' | 'revisionOperation' | 'readiness' | 'readinessReason' | 'options'> & Partial<WorkbenchOpportunity>;

function makeOpportunity(overrides: Partial<WorkbenchOpportunity> = {}): WorkbenchOpportunity {
  return {
    id: 'opp-1',
    severity: 'must',
    scope: 'Passage',
    mode: 'direct-rewrite',
    source: 'evaluation',
    criterion: 'NARRATIVE_DRIVE',
    leverage: 'Evaluation',
    crumb: 'NARRATIVE_DRIVE · passage:1',
    title: 'Test opportunity',
    issueStatement: 'Test opportunity',
    meta: 'NARRATIVE_DRIVE · passage:1',
    confidence: 'high confidence',
    anchor: 'passage:1',
    quoteHighlight: 'The quick brown fox jumped over the lazy dog.',
    quoteRest: '',
    symptom: 'In the quoted passage “The quick brown fox jumped over the lazy dog,” the moment resolves as summary instead of action.',
    cause: 'This happens because Mara summarizes the action instead of rendering the physical beat.',
    fixDirection: 'Replace the quoted passage “The quick brown fox jumped over the lazy dog” so Mara chooses a visible physical response, dramatizing the consequence before the emotion is named.',
    readerEffect: 'This lets readers track Mara’s action through the body, so the theme of momentum keeps the revelation from flattening into summary.',
    mistakeProofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
    diagnostic: {
      symptom: 'In the quoted passage “The quick brown fox jumped over the lazy dog,” the moment resolves as summary instead of action.',
      cause: 'This happens because Mara summarizes the action instead of rendering the physical beat.',
      fixStrategy: 'Replace the quoted passage “The quick brown fox jumped over the lazy dog” so Mara chooses a visible physical response, dramatizing the consequence before the emotion is named.',
      readerImpact: 'This lets readers track Mara’s action through the body, so the theme of momentum keeps the revelation from flattening into summary.',
      evidence: { quotedExcerpt: 'The quick brown fox jumped over the lazy dog.', locationLabel: 'passage:1' },
      operationTargeting: 'Passage · passage:1',
      mistakeProofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
    },
    revisionOperation: 'replace_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: null,
    options: [
      { key: 'A', mechanism: 'Recommended repair', candidateText: 'A', text: 'A', rationale: 'A' },
      { key: 'B', mechanism: 'Rhythm variant', candidateText: 'B', text: 'B', rationale: 'B' },
      { key: 'C', mechanism: 'Bolder rendering shift', candidateText: 'C', text: 'C', rationale: 'C' },
    ],
    ...overrides,
  } as unknown as WorkbenchOpportunity;
}

function candidate(text: string, key: 'A' | 'B' | 'C' = 'A') {
  return { key, mechanism: 'Recommended repair', candidateText: text, text, rationale: 'Primary' };
}

describe('workbenchQueueProjection scope resolution', () => {
  it.each([
    ['line:12', 'Line'],
    ['passage:1', 'Passage'],
    ['scene:market', 'Scene'],
    ['chapter:7', 'Chapter'],
    ['structural:arc', 'Structural'],
    ['manuscript:global', 'Manuscript'],
    ['chapter:5:paragraph:1', 'Passage'],
    ['chapter 5, paragraph 1', 'Passage'],
    ['scene 4, paragraph 3', 'Passage'],
    ['paragraph 7', 'Passage'],
    ['line 12', 'Line'],
    ['Chapter 2', 'Chapter'],
    ['whole book', 'Manuscript'],
    ['unknown', 'Passage'],
  ] as const)('resolveEvidenceLocationScope(%s) -> %s', (input, expected) => {
    expect(resolveEvidenceLocationScope(input)).toBe(expected);
  });
});

describe('workbenchQueueProjection repair scope resolution', () => {
  it('keeps a local operation in Passage scope when the fix direction is local', () => {
    const scope = resolveRepairScope({
      fixDirection: 'Replace the quoted sentence with a concrete action.',
      symptom: 'The sentence is summary.',
      readerEffect: 'Readers will track the action.',
      revisionOperation: 'replace_selected_passage',
      scope: 'Passage',
    });
    expect(scope).toBe('Passage');
  });

  it('infers Structural repair scope when the fix direction redistributes across scenes', () => {
    const scope = resolveRepairScope({
      fixDirection: 'Redistribute the historical survey across later scenes such as Smokehouse Camp and the William conversation.',
      symptom: 'The chapter starts with a long historical survey.',
      readerEffect: 'Readers lose momentum before the characters land.',
      revisionOperation: 'compress_selected_passage',
      scope: 'Passage',
    });
    expect(scope).toBe('Structural');
  });

  it('infers Manuscript scope for manuscript-wide rewrite language', () => {
    const scope = resolveRepairScope({
      fixDirection: 'Rebalance the throughline of grief across the whole book.',
      symptom: 'Grief theme is inconsistently handled.',
      readerEffect: 'Readers need the throughline to cohere.',
      revisionOperation: 'rewrite_multi_paragraph_span',
      scope: 'Chapter',
    });
    expect(scope).toBe('Manuscript');
  });

  it('falls back to the provided scope when no broad language is present', () => {
    const scope = resolveRepairScope({
      fixDirection: 'Target the exact chapter beats before drafting A/B/C prose.',
      revisionOperation: 'needs_targeting',
      scope: 'Chapter',
    });
    expect(scope).toBe('Chapter');
  });
});

describe('workbenchQueueProjection mode and passage length', () => {
  it.each([
    ['Line', 'direct-rewrite'],
    ['Passage', 'direct-rewrite'],
    ['Scene', 'direct-rewrite'],
    ['Chapter', 'repair-brief'],
    ['Structural', 'repair-brief'],
    ['Manuscript', 'repair-brief'],
  ] as const)('modeForScope(%s) -> %s', (scope, expected) => {
    expect(modeForScope(scope)).toBe(expected);
  });

  it('returns long for structural/manuscript scope regardless of text length', () => {
    expect(passageLengthForExecutability('Structural', 'Short.')).toBe('long');
    expect(passageLengthForExecutability('Manuscript', 'Short.')).toBe('long');
  });

  it('classifies passage text length by word count', () => {
    const short = 'The quick brown fox.';
    const moderate = Array.from({ length: 60 }, () => 'word').join(' ');
    const long = Array.from({ length: 150 }, () => 'word').join(' ');
    expect(passageLengthForExecutability('Passage', short)).toBe('short');
    expect(passageLengthForExecutability('Passage', moderate)).toBe('moderate');
    expect(passageLengthForExecutability('Passage', long)).toBe('long');
  });
});

describe('workbenchQueueProjection classifyWorkbenchExecutability', () => {
  it('classifies clean context + passed preflight + local operation as copy-paste rewrite', () => {
    const opportunity = makeOpportunity({
      contextQuality: 'clean',
      preflightStatus: 'passed',
      groundingStatus: 'supported',
      options: [candidate('The quick brown fox jumps over the lazy dog while the sun stays low behind the hills.', 'A'), candidate('A slow river carries the boat past the willows where the heron waits without moving.', 'B'), candidate('She pressed her palm against the cool glass and watched the rain dissolve the lights below.', 'C')],
    });
    const result = classifyWorkbenchExecutability(opportunity);
    expect(result.cardType).toBe('copy_paste_rewrite');
    expect(result.trustedPathStatus).toBe('eligible');
    expect(result.reasons).toContain('safe_local_copy_paste_rewrite');
  });

  it('classifies limited context as revision strategy', () => {
    const opportunity = makeOpportunity({
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      groundingStatus: 'supported',
      options: [candidate('The quick brown fox jumps over the lazy dog while the sun stays low behind the hills.', 'A'), candidate('A slow river carries the boat past the willows where the heron waits without moving.', 'B'), candidate('She pressed her palm against the cool glass and watched the rain dissolve the lights below.', 'C')],
    });
    const result = classifyWorkbenchExecutability(opportunity);
    expect(result.cardType).toBe('revision_strategy');
    expect(result.trustedPathStatus).toBe('unavailable_author_review_required');
    expect(result.reasons).toContain('insufficient_before_after_context');
  });

  it('withholds when a real canon conflict is present', () => {
    const opportunity = makeOpportunity({
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      preflightReasons: ['canon_conflict'],
      groundingStatus: 'supported',
      options: [candidate('The quick brown fox jumps over the lazy dog while the sun stays low behind the hills.', 'A'), candidate('A slow river carries the boat past the willows where the heron waits without moving.', 'B'), candidate('She pressed her palm against the cool glass and watched the rain dissolve the lights below.', 'C')],
    });
    const result = classifyWorkbenchExecutability(opportunity);
    expect(result.cardType).toBe('withheld');
    expect(result.trustedPathStatus).toBe('impossible');
    expect(result.reasons).toContain('canon_unclear');
  });

  it('withholds when grounding is unsupported', () => {
    const opportunity = makeOpportunity({
      contextQuality: 'clean',
      preflightStatus: 'passed',
      groundingStatus: 'unsupported_blocked',
      options: [candidate('The quick brown fox jumps over the lazy dog while the sun stays low behind the hills.', 'A'), candidate('A slow river carries the boat past the willows where the heron waits without moving.', 'B'), candidate('She pressed her palm against the cool glass and watched the rain dissolve the lights below.', 'C')],
    });
    const result = classifyWorkbenchExecutability(opportunity);
    expect(result.cardType).toBe('withheld');
    expect(result.trustedPathStatus).toBe('impossible');
    expect(result.reasons).toContain('diagnosis_unsupported');
  });

  it('produces a StrategyCardViewModel for revision strategy ready cards', () => {
    const opportunity = makeOpportunity({
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      groundingStatus: 'supported',
      options: [candidate('The quick brown fox jumps over the lazy dog while the sun stays low behind the hills.', 'A'), candidate('A slow river carries the boat past the willows where the heron waits without moving.', 'B'), candidate('She pressed her palm against the cool glass and watched the rain dissolve the lights below.', 'C')],
    });
    const result = classifyWorkbenchExecutability(opportunity);
    expect(result.cardType).toBe('revision_strategy');
    expect(result.strategyCardViewModel).toBeTruthy();
    expect(result.strategyCardViewModel?.scaffold.reasonCopyPasteIsUnsafe).toBeTruthy();
    expect(result.strategyCardViewModel?.illustrativeExamples).toHaveLength(3);
  });
});

describe('workbenchQueueProjection partitionWorkbenchQueue', () => {
  it('uses cardType as terminal queue authority', () => {
    const copyPaste = makeOpportunity({
      id: 'copy',
      cardType: 'copy_paste_rewrite',
      trustedPathStatus: 'eligible',
      contextQuality: 'clean',
      preflightStatus: 'passed',
      groundingStatus: 'supported',
      options: [candidate('A'), candidate('B'), candidate('C')],
    });
    const strategy = makeOpportunity({
      id: 'strategy',
      cardType: 'revision_strategy',
      trustedPathStatus: 'unavailable_author_review_required',
      readiness: 'ready_for_revise',
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      groundingStatus: 'supported',
      options: [candidate('A'), candidate('B'), candidate('C')],
    });
    const withheldNeedsTargeting = makeOpportunity({
      id: 'withheld-needs',
      cardType: 'withheld',
      trustedPathStatus: 'impossible',
      readiness: 'needs_targeting',
      contextQuality: 'clean',
      preflightStatus: 'passed',
      groundingStatus: 'supported',
      options: [candidate('A'), candidate('B'), candidate('C')],
    });

    const result = partitionWorkbenchQueue([copyPaste, strategy, withheldNeedsTargeting]);
    expect(result.opportunities.map((o) => o.id)).toEqual(['copy']);
    expect(result.needsTargeting.map((o) => o.id)).toEqual(['strategy']);
    expect(result.withheldUnsupported.map((o) => o.id)).toEqual(['withheld-needs']);
  });

  it('never places one opportunity in more than one terminal bucket', () => {
    const entries = [
      makeOpportunity({ id: 'copy', cardType: 'copy_paste_rewrite', trustedPathStatus: 'eligible', contextQuality: 'clean', preflightStatus: 'passed', groundingStatus: 'supported' }),
      makeOpportunity({ id: 'strategy', cardType: 'revision_strategy', trustedPathStatus: 'unavailable_author_review_required', contextQuality: 'limited', preflightStatus: 'limited_context', groundingStatus: 'supported' }),
      makeOpportunity({ id: 'withheld', cardType: 'withheld', trustedPathStatus: 'impossible', readiness: 'needs_targeting', groundingStatus: 'unsupported_blocked' }),
    ];

    const result = partitionWorkbenchQueue(entries);
    const bucketedIds = [
      ...result.opportunities.map((o) => o.id),
      ...result.needsTargeting.map((o) => o.id),
      ...result.withheldUnsupported.map((o) => o.id),
    ];

    expect(new Set(bucketedIds).size).toBe(bucketedIds.length);
    expect(bucketedIds.sort()).toEqual(entries.map((o) => o.id).sort());
  });

  it('puts withheld cards into withheldUnsupported and reflects them in readiness totals', () => {
    const withheld = makeOpportunity({
      id: 'withheld',
      cardType: 'withheld',
      trustedPathStatus: 'impossible',
      readiness: 'ready_for_revise',
      contextQuality: 'blocked',
      preflightStatus: 'blocked',
      groundingStatus: 'unsupported_blocked',
      options: [candidate('A'), candidate('B'), candidate('C')],
    });
    const result = partitionWorkbenchQueue([withheld]);
    expect(result.opportunities).toHaveLength(0);
    expect(result.needsTargeting).toHaveLength(0);
    expect(result.withheldUnsupported.map((o) => o.id)).toEqual(['withheld']);
    expect(result.readinessTotals.withheld_unsupported).toBe(1);
  });
});

describe('workbenchQueueProjection buildStrategyCardViewModel', () => {
  it('returns null for non-strategy executability', () => {
    const opportunity = makeOpportunity();
    const executability = classifyWorkbenchExecutability(
      makeOpportunity({
        contextQuality: 'blocked',
        preflightStatus: 'blocked',
        groundingStatus: 'unsupported_blocked',
        options: [candidate('A'), candidate('B'), candidate('C')],
      }),
    );
    expect(buildStrategyCardViewModel(opportunity, executability)).toBeNull();
  });

  it('derives conservative, moderate, bold, and author-decision approaches without relabeling diagnostics', () => {
    const opportunity = makeOpportunity({
      evidenceLocationScope: 'Passage',
      repairScope: 'Structural',
      options: [candidate('A'), candidate('B'), candidate('C')],
    });
    const executability: ReturnType<typeof classifyWorkbenchExecutability> = {
      cardType: 'revision_strategy',
      trustedPathStatus: 'unavailable_author_review_required',
      reasons: ['insufficient_before_after_context'],
      copyPasteAdmissionPassed: false,
      copyPasteAdmissionReasons: ['insufficient_before_after_context'],
      strategyAdmissionPassed: true,
      strategyAdmissionReasons: [],
    };

    const result = buildStrategyCardViewModel(opportunity, executability);
    expect(result).not.toBeNull();
    expect(result!.scaffold.conservativeApproach).toContain('smallest safe scope');
    expect(result!.scaffold.moderateApproach).toContain('Apply the recommended repair');
    expect(result!.scaffold.boldApproach).toContain('broader scope');
    expect(result!.scaffold.authorDecisionRequired).toContain('Decide whether');
    expect(result!.scaffold.moderateApproach).not.toContain('readerEffect');
    expect(result!.scaffold.moderateApproach).not.toContain('mistakeProofing');
    expect(result!.scaffold.authorDecisionRequired).not.toContain('This happens because');
    expect(result!.illustrativeExamples).toHaveLength(3);
  });
});
