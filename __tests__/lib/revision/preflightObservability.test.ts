import { runReviseAdmissionGate } from '@/lib/revision/reviseAdmissionGate';
import { summarizePreflightObservability } from '@/lib/revision/preflightObservability';

describe('preflight observability', () => {
  it('reports limited_context as preflight-admissible without claiming earned grounding or final admission', () => {
    const metrics = summarizePreflightObservability([
      {
        preflight_status: 'limited_context',
        candidate_text_a: '',
        candidate_text_b: '',
        candidate_text_c: '',
      },
      {
        preflight_status: 'blocked',
      },
    ]);

    expect(metrics).toEqual({
      preflight_status_admissible: 1,
      preflight_clean: 0,
      preflight_advisory: 1,
      preflight_blocked: 1,
      grounding_supported: null,
      hydration_required: 1,
      final_admission_status: 'not_executed',
      workbench_runtime_status: 'not_executed',
    });
  });

  it('confirms limited_context is not rejected by the runtime preflight-status boundary', () => {
    const result = runReviseAdmissionGate({
      opportunity_id: 'limited-advisory-1',
      grounding_status: 'supported',
      preflight_status: 'limited_context',
      context_quality: 'limited',
      evidence_anchor: 'He kept one hand on the doorframe and listened for her answer.',
      candidate_text_a: 'He kept one hand against the doorframe until the wood grain pressed a red line into his palm.',
      candidate_text_b: 'He waited beside the door, counting each second until the hallway light shifted beneath it.',
      candidate_text_c: 'He stayed there for one more breath, then turned the handle before silence could answer for her.',
      manuscript_context: {
        before: 'The hallway was empty.',
        after: 'She did not answer.',
      },
    });

    expect(result.reasons).not.toContain('PREFLIGHT_NOT_PASSED');
    expect(result.reasons).not.toContain('CONTEXT_INSUFFICIENT');
  });
});
