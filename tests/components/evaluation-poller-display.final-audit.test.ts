import { getProgressDisplay } from '@/components/evaluation-poller-display';

describe('evaluation poller final audit readiness', () => {
  test('long-form complete waits for narrative synthesis', () => {
    const display = getProgressDisplay({
      status: 'complete',
      manuscript_word_count: 50000,
      pass3_completed_at: null,
    });

    expect(display?.label).toBe('Finalizing your report in progress');
    expect(display?.percentage).toBe(92);
  });

  test('long-form complete waits for final verification after synthesis', () => {
    const display = getProgressDisplay({
      status: 'complete',
      manuscript_word_count: 50000,
      pass3_completed_at: '2026-06-06T00:00:00.000Z',
      final_external_audit_completed_at: null,
    });

    expect(display?.label).toBe('Final verification in progress.');
    expect(display?.percentage).toBe(96);
  });

  test('long-form report is ready after final audit passes', () => {
    const display = getProgressDisplay({
      status: 'complete',
      manuscript_word_count: 50000,
      pass3_completed_at: '2026-06-06T00:00:00.000Z',
      final_external_audit_completed_at: '2026-06-06T00:01:00.000Z',
      final_external_audit_verdict: 'PASS',
      final_external_audit_blocking: false,
    });

    expect(display?.label).toBe('Evaluation finalized — full report ready');
    expect(display?.percentage).toBe(100);
  });
});
