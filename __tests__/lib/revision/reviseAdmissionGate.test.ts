import { runReviseAdmissionGate } from '../../../lib/revision/reviseAdmissionGate';

const base = {
  opportunity_id: 'op-1',
  grounding_status: 'supported',
  preflight_status: 'passed',
  context_quality: 'clean',
  evidence_anchor: 'He waited by the door.',
  manuscript_context: { before: 'The hallway was empty.', after: 'She did not answer.' },
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
});
