import {
  findHydrationChunkForAnchor,
  resolveReviseContextQuality,
} from '../../../lib/revision/opportunityLedger';
import { runWorkbenchAdmissionGate } from '../../../lib/revision/reviseAdmissionGate';

const manuscriptChunk =
  'The hallway was empty. He waited by the door — one hand resting on the frame, while the silence lengthened. She did not answer.';

const diagnosticFields = {
  symptom:
    'The hallway beat stalls at the door without translating the delay into character pressure, so the tension remains observational.',
  cause:
    'The prose records the physical action but omits the internal decision pressure that gives the pause narrative consequence.',
  fixDirection:
    'After Marcus reaches the door, add one restrained physical or interior beat that turns the waiting into a visible decision point.',
  readerEffect:
    'The reader experiences suspended anticipation and understands why the delayed answer matters rather than watching an idle pause.',
};

const admittedOptions = [
  { key: 'A', candidateText: 'He kept one hand on the doorframe and listened for her answer.' },
  { key: 'B', candidateText: 'He stayed beside the door, counting the seconds until she moved.' },
  {
    key: 'C',
    candidateText:
      'He waited through one more breath before he answered, and the doorway held the pause in place.',
  },
];

const repairReasons = ['Fritz', 'Schultz', 'Martin', 'Robin'].map((name) => ({
  key: 'ending_accountability',
  layer: 'threat_antagonist_ending_layer',
  message: `Ending accountability for ${name} requires author confirmation.`,
  evidence_reference:
    'pass1a_character_ledger_v1.coverage_summary.ending_accountability_warnings',
}));

describe('C2 deterministic integration layer', () => {
  it('keeps repair_required advisory and carries it into a limited-context hydration path', () => {
    const context = resolveReviseContextQuality({
      quality_report: {
        gate_ready_status: 'repair_required',
        blocking_reasons: [],
        root_cause_warning_count: repairReasons.length,
        repair_reasons: repairReasons,
      },
    });

    expect(context.status).toBe('limited');
    expect(context.gate_ready_status).toBe('repair_required');
    expect(context.blocking_reasons).toEqual([]);
  });

  it('hydrates a normalized evidence wrapper against the manuscript without a model call', () => {
    const hydration = findHydrationChunkForAnchor(
      'Evidence: “He waited by the door — one hand resting on the frame, while the silence lengthened.”',
      [{ content: manuscriptChunk }],
    );

    expect(hydration.content).toBe(manuscriptChunk);
    expect(hydration.diagnostic.strategy).toBe('exact_match');
    expect(hydration.diagnostic.wrapper_stripped).toBe(true);
    expect(hydration.diagnostic.dash_normalized).toBe(true);
  });

  it('admits a fully hydrated, supported workbench card through the real admission gate', () => {
    const hydration = findHydrationChunkForAnchor('He waited by the door', [
      { content: manuscriptChunk },
    ]);

    expect(hydration.content).toBe(manuscriptChunk);

    const admission = runWorkbenchAdmissionGate({
      id: 'c2-opportunity-1',
      readiness: 'ready_for_revise',
      groundingStatus: 'supported',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      anchor: 'He waited by the door',
      quoteHighlight: 'The hallway was empty.',
      quoteRest: 'She did not answer.',
      revisionOperation: 'replace_selected_passage',
      ...diagnosticFields,
      options: admittedOptions,
    });

    expect(admission.admission_status).toBe('admission_passed');
    expect(admission.reasons).toEqual([]);
    expect(admission.passedCandidateCount).toBeGreaterThanOrEqual(2);
  });

  it('classifies a fabricated anchor as a hydration failure and prevents workbench admission', () => {
    const hydration = findHydrationChunkForAnchor(
      'The glacier split open beneath the burning observatory while Marcus raised a silver compass.',
      [{ content: manuscriptChunk }],
    );

    expect(hydration.content).toBeUndefined();
    expect(hydration.diagnostic.strategy).toBe('no_match');

    const admission = runWorkbenchAdmissionGate({
      id: 'c2-opportunity-fabricated-anchor',
      readiness: 'withheld_unsupported',
      groundingStatus: 'unsupported_blocked',
      preflightStatus: 'blocked',
      contextQuality: 'blocked',
      anchor:
        'The glacier split open beneath the burning observatory while Marcus raised a silver compass.',
      quoteHighlight: null,
      quoteRest: null,
      revisionOperation: 'replace_selected_passage',
      ...diagnosticFields,
      options: admittedOptions,
    });

    expect(admission.admission_status).toBe('withheld');
    expect(admission.reasons).toEqual(
      expect.arrayContaining([
        'NOT_READY_FOR_REVISE',
        'UNSUPPORTED_REVISION',
        'PREFLIGHT_NOT_PASSED',
        'CONTEXT_INSUFFICIENT',
      ]),
    );
  });
});
