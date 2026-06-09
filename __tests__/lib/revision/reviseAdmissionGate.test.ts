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
  symptom: 'The passage near the hallway scene stalls at the door without conveying internal hesitation, and the consequence is lost tension.',
  cause: 'Because the prose states the physical action without layering emotional subtext, the reader observes rather than experiences the moment.',
  fixDirection: 'After Marcus reaches the door, add one beat of interiority that forces a decision — a thought, a physical sensation — giving the waiting emotional weight.',
  readerEffect: 'The reader shares the character\u2019s suspended anticipation rather than merely observing an idle moment.',
  options: [
    { key: 'A', candidateText: 'He kept one hand on the doorframe and listened for her answer.' },
    { key: 'B', candidateText: 'He stayed beside the door, counting the seconds until she moved.' },
    { key: 'C', candidateText: 'He waited through one more breath before he answered, and the doorway held the pause in place.' },
  ],
};

describe('reviseAdmissionGate', () => {
  it('admits cards with at least two quality candidates', () => {
    const result = runReviseAdmissionGate({
      ...base,
      candidate_text_a: 'He kept one hand on the doorframe and listened for her answer.',
      candidate_text_b: 'He stayed beside the door, counting the seconds until she moved.',
      candidate_text_c: 'He waited through one more breath before he answered, and the doorway held the pause in place.',
    });
    expect(result.admission_status).toBe('admission_passed');
    expect(result.passedCandidateCount).toBeGreaterThanOrEqual(2);
  });

  it('withholds unsupported cards', () => {
    const result = runReviseAdmissionGate({ ...base, grounding_status: 'unsupported_blocked' });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toContain('UNSUPPORTED_REVISION');
  });

  it('admits workbench cards through the same Volume VII gate', () => {
    const result = runWorkbenchAdmissionGate(workbenchBase);
    expect(result.admission_status).toBe('admission_passed');
    expect(result.passedCandidateCount).toBe(3);
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

  it('withholds workbench cards when any candidate uses banned generic filler phrasing', () => {
    const result = runWorkbenchAdmissionGate({
      ...workbenchBase,
      options: [
        { key: 'A', candidateText: 'He kept one hand on the doorframe and listened for her answer.' },
        { key: 'B', candidateText: 'He stayed beside the door, counting the seconds until she moved.' },
        { key: 'C', candidateText: 'He looked away first, and that was enough for the moment to claim its price.' },
      ],
    });
    expect(result.admission_status).toBe('withheld');
    expect(result.reasons).toContain('GENERIC_PROSE');
  });
});
