import { runReviseAdmissionGate, runWorkbenchAdmissionGate } from '../../../lib/revision/reviseAdmissionGate';

const base = {
  opportunity_id: 'op-1',
  grounding_status: 'supported',
  preflight_status: 'passed',
  context_quality: 'clean',
  evidence_anchor: 'He waited by the door.',
  manuscript_context: { before: 'The hallway was empty.', after: 'She did not answer.' },
};

const workbenchBase = {
  id: 'op-1',
  readiness: 'ready_for_revise',
  groundingStatus: 'supported',
  preflightStatus: 'passed',
  contextQuality: 'clean',
  anchor: 'He waited by the door.',
  quoteHighlight: 'The hallway was empty.',
  quoteRest: 'She did not answer.',
  options: [
    { key: 'A', candidateText: 'He kept one hand on the doorframe and listened for her answer.' },
    { key: 'B', candidateText: 'He stayed beside the door, counting the seconds until she moved.' },
    { key: 'C', candidateText: 'The silence stretched until the room seemed smaller.' },
  ],
};

describe('reviseAdmissionGate', () => {
  it('admits cards with at least two quality candidates', () => {
    const result = runReviseAdmissionGate({
      ...base,
      candidate_text_a: 'He kept one hand on the doorframe and listened for her answer.',
      candidate_text_b: 'He stayed beside the door, counting the seconds until she moved.',
      candidate_text_c: 'The silence stretched until the room seemed smaller.',
    });
    expect(result.admission_status).toBe('admission_passed');
  });

  it('withholds unsupported cards', () => {
    const result = runReviseAdmissionGate({ ...base, grounding_status: 'unsupported_blocked' });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toContain('UNSUPPORTED_REVISION');
  });

  it('admits workbench cards through the same Volume VII gate', () => {
    const result = runWorkbenchAdmissionGate(workbenchBase);
    expect(result.admission_status).toBe('admission_passed');
    expect(result.passedCandidateCount).toBe(2);
  });

  it('withholds workbench cards that are not ready for revise', () => {
    const result = runWorkbenchAdmissionGate({ ...workbenchBase, readiness: 'needs_targeting' });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toContain('NOT_READY_FOR_REVISE');
  });

  it('withholds workbench cards with generic candidate sets', () => {
    const result = runWorkbenchAdmissionGate({
      ...workbenchBase,
      options: [
        { key: 'A', candidateText: 'The silence stretched.' },
        { key: 'B', candidateText: 'The air grew heavy.' },
        { key: 'C', candidateText: 'Something shifted.' },
      ],
    });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toContain('GENERIC_PROSE');
  });
});
