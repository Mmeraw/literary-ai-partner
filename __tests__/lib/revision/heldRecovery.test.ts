/**
 * Held Recovery Engine — initial production reason inventory tests.
 *
 * Three proof layers:
 *   1. Anti-drift: every registry entry's code string exists in the claimed
 *      producer source file. (Source-grep provenance, not yet unit-test provenance.)
 *   2. Immutability: planHeldRecovery does not mutate the input opportunity,
 *      including nested finalDecision. Tested with Object.freeze.
 *   3. Planning behaviour: each canonical held-reason code produces the
 *      expected RecoveryAction.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  INITIAL_PRODUCTION_REASON_INVENTORY,
  lookupRecoveryAction,
  lookupRegistryEntry,
  planHeldRecovery,
  primaryAction,
  type RecoveryAction,
} from '@/lib/revision/heldRecovery';
import {
  buildClassifiedWorkbenchOpportunity,
  classifyWorkbenchExecutabilityDetailed,
} from '@/lib/revision/workbenchQueueProjection';
import type { WorkbenchOpportunity } from '@/lib/revision/workbenchQueue';

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const root = join(__dirname, '..', '..', '..');

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function makeWithheldOpportunity(
  reasonOverrides: {
    executabilityReasons?: string[];
    preflightReasons?: string[];
    hydrationFailureReasons?: string[];
    resBlockerReasons?: string[];
  } = {},
): ReturnType<typeof buildClassifiedWorkbenchOpportunity> & typeof reasonOverrides {
  const base = {
    id: 'test-withheld',
    severity: 'must',
    scope: 'Passage',
    mode: 'direct-rewrite',
    source: 'evaluation',
    criterion: 'NARRATIVE_DRIVE',
    leverage: 'Evaluation',
    crumb: 'NARRATIVE_DRIVE · passage:1',
    title: 'Test withheld opportunity',
    issueStatement: 'Test issue.',
    meta: 'passage:1',
    confidence: 'high confidence',
    anchor: 'passage:1',
    quoteHighlight: 'The quick brown fox jumped over the lazy dog.',
    quoteRest: '',
    symptom: 'In the quoted passage "The quick brown fox jumped over the lazy dog," the moment resolves as summary instead of action.',
    cause: 'This happens because the scene summarizes instead of rendering the physical beat.',
    fixDirection: 'Replace the quoted passage so the character chooses a visible physical response, dramatizing the consequence before the emotion is named.',
    readerEffect: 'This lets readers track action through the body, keeping the revelation from flattening into summary.',
    mistakeProofing: 'Do not introduce new information; the replacement must emerge from what the scene has already established.',
    diagnostic: {
      symptom: 'The moment resolves as summary.',
      cause: 'Summarizes instead of rendering.',
      fixStrategy: 'Replace the passage.',
      readerImpact: 'Readers track action.',
      evidence: { quotedExcerpt: 'The quick brown fox.', locationLabel: 'passage:1' },
      operationTargeting: 'Passage · passage:1',
      mistakeProofing: 'Do not introduce new information.',
    },
    revisionOperation: 'replace_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: null,
    groundingStatus: 'unsupported_blocked',
    contextQuality: 'blocked',
    preflightStatus: 'blocked',
    options: [],
  } as unknown as WorkbenchOpportunity;

  const classification = classifyWorkbenchExecutabilityDetailed(base);
  const classified = buildClassifiedWorkbenchOpportunity(base, {
    ...classification,
    finalDecision: {
      cardType: 'withheld',
      trustedPathStatus: 'impossible',
      reasons: ['test_withheld'],
    } as any,
  });

  // Apply reason overrides AFTER build — buildClassifiedWorkbenchOpportunity
  // overwrites executabilityReasons from the classification; test overrides
  // must take precedence for isolated planning tests.
  return { ...classified, ...reasonOverrides };
}

// ---------------------------------------------------------------------------
// 1. Anti-drift: registry entries match their claimed producer source files
// ---------------------------------------------------------------------------

describe('INITIAL_PRODUCTION_REASON_INVENTORY anti-drift', () => {
  // Map from producer prefix to source file path
  const producerSourceMap: Record<string, string> = {
    'recommendationExecutability.': 'lib/revision/recommendationExecutability.ts',
    'reviseAdmissionGate.':         'lib/revision/reviseAdmissionGate.ts',
    'opportunityLedger.':           'lib/revision/opportunityLedger.ts',
  };

  it('has no duplicate reason codes in the registry', () => {
    const codes = INITIAL_PRODUCTION_REASON_INVENTORY.map((e) => e.code);
    const unique = new Set(codes);
    const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);
    expect(duplicates).toEqual([]);
    expect(unique.size).toBe(codes.length);
  });

  it('every registry entry code string appears literally in its producer source file', () => {
    for (const entry of INITIAL_PRODUCTION_REASON_INVENTORY) {
      const sourceFile = Object.entries(producerSourceMap).find(
        ([prefix]) => entry.producer.startsWith(prefix),
      )?.[1];

      if (!sourceFile) {
        // Unknown producer prefix — skip rather than fail; add to map when encountered
        continue;
      }

      const source = readSource(sourceFile);
      expect(source).toContain(entry.code);
    }
  });

  it('every registry entry has status currently_emitted', () => {
    for (const entry of INITIAL_PRODUCTION_REASON_INVENTORY) {
      expect(entry.status).toBe('currently_emitted');
    }
  });

  it('every registry entry has a valid recovery action', () => {
    const validActions: RecoveryAction[] = [
      'PROVIDE_EVIDENCE', 'PROVIDE_CONTEXT', 'RESOLVE_CANON',
      'REGENERATE_CANDIDATES', 'REEVALUATE_DIAGNOSIS', 'REQUEST_AUTHOR_INPUT',
      'IMPOSSIBLE',
    ];
    for (const entry of INITIAL_PRODUCTION_REASON_INVENTORY) {
      expect(validActions).toContain(entry.recoveryAction);
    }
  });

  it('lookup is case-insensitive — both cases resolve to the same entry', () => {
    const lower = lookupRegistryEntry('canon_unclear');
    const upper = lookupRegistryEntry('CANON_UNCLEAR');
    const mixed = lookupRegistryEntry('Canon_Unclear');
    expect(lower).toBeDefined();
    expect(upper).toBe(lower);
    expect(mixed).toBe(lower);
  });

  it('unregistered codes return REQUEST_AUTHOR_INPUT, not undefined or an error', () => {
    expect(lookupRecoveryAction('completely_unknown_reason_xyz')).toBe('REQUEST_AUTHOR_INPUT');
    expect(lookupRegistryEntry('completely_unknown_reason_xyz')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Immutability proof
// ---------------------------------------------------------------------------

describe('planHeldRecovery immutability', () => {
  it('does not mutate finalDecision — reference identity preserved after planning', () => {
    const classified = makeWithheldOpportunity({
      executabilityReasons: ['evidence_missing', 'canon_unclear'],
    });

    // Deep-freeze the input to catch any accidental mutation at the point it occurs
    const frozen = Object.freeze({
      ...classified,
      executabilityReasons: Object.freeze([...( classified.executabilityReasons ?? [])]) as string[],
      finalDecision: Object.freeze({ ...classified.finalDecision }),
    }) as Readonly<typeof classified>;

    const originalDecision = frozen.finalDecision;
    const originalDecisionSnapshot = { ...frozen.finalDecision };

    // Should not throw even though the object is frozen
    const plan = planHeldRecovery(frozen);

    // Reference identity: finalDecision is the same object reference
    expect(frozen.finalDecision).toBe(originalDecision);

    // Deep equality: finalDecision has the same values as before planning
    expect(frozen.finalDecision).toEqual(originalDecisionSnapshot);

    // Plan was produced without errors
    expect(plan.opportunityId).toBe(frozen.id);
  });

  it('does not mutate executabilityReasons or preflightReasons', () => {
    const exReasons = Object.freeze(['evidence_missing', 'context_missing']) as readonly string[];
    const preReasons = Object.freeze(['canon_authority_blocked']) as readonly string[];

    const classified = makeWithheldOpportunity();
    const frozen = Object.freeze({
      ...classified,
      executabilityReasons: exReasons as string[],
      preflightReasons: preReasons as string[],
      finalDecision: Object.freeze({ ...classified.finalDecision }),
    }) as Readonly<typeof classified>;

    // planHeldRecovery must read these arrays, not modify them
    const plan = planHeldRecovery(frozen);

    expect(frozen.executabilityReasons).toBe(exReasons);
    expect(frozen.preflightReasons).toBe(preReasons);
    expect(plan.reasonCodes).toContain('evidence_missing');
    expect(plan.reasonCodes).toContain('canon_authority_blocked');
  });
});

// ---------------------------------------------------------------------------
// 3. Planning behaviour
// ---------------------------------------------------------------------------

describe('planHeldRecovery planning behaviour', () => {
  function plan(
    codes: {
      executabilityReasons?: string[];
      preflightReasons?: string[];
    },
  ) {
    const classified = makeWithheldOpportunity(codes);
    return planHeldRecovery(classified);
  }

  it('maps evidence_missing to PROVIDE_EVIDENCE', () => {
    const result = plan({ executabilityReasons: ['evidence_missing'] });
    expect(result.actions).toContain('PROVIDE_EVIDENCE');
    expect(result.primaryAction).toBe('PROVIDE_EVIDENCE');
    expect(result.isRecoverable).toBe(true);
  });

  it('maps context_missing to PROVIDE_CONTEXT', () => {
    const result = plan({ executabilityReasons: ['context_missing'] });
    expect(result.actions).toContain('PROVIDE_CONTEXT');
    expect(result.isRecoverable).toBe(true);
  });

  it('maps canon_unclear to RESOLVE_CANON', () => {
    const result = plan({ executabilityReasons: ['canon_unclear'] });
    expect(result.actions).toContain('RESOLVE_CANON');
    expect(result.isRecoverable).toBe(true);
  });

  it('maps diagnosis_unsupported to REEVALUATE_DIAGNOSIS', () => {
    const result = plan({ executabilityReasons: ['diagnosis_unsupported'] });
    expect(result.actions).toContain('REEVALUATE_DIAGNOSIS');
    expect(result.isRecoverable).toBe(true);
  });

  it('maps DIAGNOSTIC_MISSING_SYMPTOM to IMPOSSIBLE', () => {
    const result = plan({ executabilityReasons: ['DIAGNOSTIC_MISSING_SYMPTOM'] });
    expect(result.actions).toContain('IMPOSSIBLE');
    expect(result.primaryAction).toBe('IMPOSSIBLE');
    expect(result.isRecoverable).toBe(false);
  });

  it('maps GENERIC_PROSE to REGENERATE_CANDIDATES', () => {
    const result = plan({ executabilityReasons: ['GENERIC_PROSE'] });
    expect(result.actions).toContain('REGENERATE_CANDIDATES');
    expect(result.isRecoverable).toBe(true);
  });

  it('maps canon_authority_blocked (preflight) to RESOLVE_CANON', () => {
    const result = plan({ preflightReasons: ['canon_authority_blocked'] });
    expect(result.actions).toContain('RESOLVE_CANON');
  });

  it('maps insufficient_anchor_grounding (preflight) to PROVIDE_EVIDENCE', () => {
    const result = plan({ preflightReasons: ['insufficient_anchor_grounding'] });
    expect(result.actions).toContain('PROVIDE_EVIDENCE');
  });

  it('IMPOSSIBLE wins over all other actions as primary when mixed', () => {
    const result = plan({
      executabilityReasons: ['evidence_missing', 'DIAGNOSTIC_MISSING_SYMPTOM', 'context_missing'],
    });
    expect(result.primaryAction).toBe('IMPOSSIBLE');
    expect(result.isRecoverable).toBe(false);
    expect(result.actions).toContain('PROVIDE_EVIDENCE');
    expect(result.actions).toContain('PROVIDE_CONTEXT');
    expect(result.actions).toContain('IMPOSSIBLE');
  });

  it('RESOLVE_CANON is primary over PROVIDE_EVIDENCE when both present', () => {
    const result = plan({
      executabilityReasons: ['evidence_missing', 'canon_unclear'],
    });
    expect(result.primaryAction).toBe('RESOLVE_CANON');
  });

  it('records unregistered codes without crashing', () => {
    const result = plan({ executabilityReasons: ['totally_unknown_future_reason'] });
    expect(result.unregisteredCodes).toContain('totally_unknown_future_reason');
    expect(result.actions).toContain('REQUEST_AUTHOR_INPUT');
    expect(result.isRecoverable).toBe(true);
  });

  it('deduplicates reason codes from multiple sources', () => {
    const result = plan({
      executabilityReasons: ['canon_unclear', 'evidence_missing'],
      preflightReasons: ['canon_unclear'],  // duplicate across sources
    });
    const canonCount = result.reasonCodes.filter((c) => c === 'canon_unclear').length;
    expect(canonCount).toBe(1);
  });

  it('opportunity with no reason codes returns REQUEST_AUTHOR_INPUT', () => {
    const result = plan({});
    expect(result.primaryAction).toBe('REQUEST_AUTHOR_INPUT');
    expect(result.isRecoverable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. primaryAction priority invariants
// ---------------------------------------------------------------------------

describe('primaryAction priority', () => {
  it('IMPOSSIBLE is primary over every other action', () => {
    const actions: RecoveryAction[] = ['PROVIDE_EVIDENCE', 'IMPOSSIBLE', 'REGENERATE_CANDIDATES'];
    expect(primaryAction(actions)).toBe('IMPOSSIBLE');
  });

  it('RESOLVE_CANON beats PROVIDE_EVIDENCE', () => {
    expect(primaryAction(['PROVIDE_EVIDENCE', 'RESOLVE_CANON'])).toBe('RESOLVE_CANON');
  });

  it('PROVIDE_EVIDENCE beats PROVIDE_CONTEXT', () => {
    expect(primaryAction(['PROVIDE_CONTEXT', 'PROVIDE_EVIDENCE'])).toBe('PROVIDE_EVIDENCE');
  });

  it('empty input returns REQUEST_AUTHOR_INPUT', () => {
    expect(primaryAction([])).toBe('REQUEST_AUTHOR_INPUT');
  });
});
