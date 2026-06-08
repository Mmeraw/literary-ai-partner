import { regenerateUntilAdmitted } from '../../../lib/revision/candidateRegeneration';

const base = {
  opportunity_id: 'op-1',
  grounding_status: 'supported',
  preflight_status: 'passed',
  context_quality: 'clean',
  candidate_text_a: 'The silence stretched.',
  candidate_text_b: 'The air grew heavy.',
  candidate_text_c: 'Something shifted.',
};

describe('candidateRegeneration', () => {
  it('regenerates bad candidates and admits passing replacements', async () => {
    const result = await regenerateUntilAdmitted(base, async () => ({
      candidate_text_a: 'He kept one hand on the doorframe and listened for her answer.',
      candidate_text_b: 'He stayed beside the door, counting the seconds until she moved.',
      candidate_text_c: 'He lowered his voice before he asked again.',
    }));
    expect(result.admitted).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it('withholds after maximum failed regeneration attempts', async () => {
    const result = await regenerateUntilAdmitted(base, async () => ({
      candidate_text_a: 'The silence stretched.',
      candidate_text_b: 'The air grew heavy.',
      candidate_text_c: 'Something shifted.',
    }));
    expect(result.admitted).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.reasons).toContain('CANDIDATE_QUALITY_FAILED_AFTER_REGENERATION');
  });
});
