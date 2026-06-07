export {};

import {
  sendEvaluationFailureSupportAlert,
  sendEvaluationMajorIssueUserAlert,
  sendRecoverySupportAlert,
  shouldAlertSupportForRecoveryAction,
  toUserSafeRecoveryMessage,
} from '../../../lib/evaluation/recoverySupportAlertMailer';
import { REVISIONGRADE_SUPPORT_EMAIL } from '../../../lib/evaluation/hardStopGovernance';

describe('recoverySupportAlertMailer', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.RECOVERY_ALERT_EMAIL_PROVIDER;
    delete process.env.RECOVERY_ALERT_FROM_EMAIL;
    delete process.env.RESEND_FROM_EMAIL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('alerts are required for recover + halt actions', () => {
    expect(shouldAlertSupportForRecoveryAction('repair_to_expected_handoff')).toBe(true);
    expect(shouldAlertSupportForRecoveryAction('sync_progress_to_job_state')).toBe(true);
    expect(shouldAlertSupportForRecoveryAction('halt_for_engineering_review')).toBe(true);
    expect(shouldAlertSupportForRecoveryAction('none')).toBe(false);
    expect(shouldAlertSupportForRecoveryAction(undefined)).toBe(false);
  });

  test('sends support@revisiongrade.com payload with required subject + fields', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const result = await sendRecoverySupportAlert(
      {
        job_id: 'job-123',
        manuscript_id: 77,
        user_id: 'user-abc',
        phase: 'phase_3',
        phase_status: 'queued',
        progress_phase: 'phase_2',
        progress_phase_status: 'complete',
        recovery_key: 'SPLIT_BRAIN:HEALABLE:job-123:phase_3:queued:phase_2:complete',
        recovery_action: 'repair_to_expected_handoff',
        internal_diagnosis: 'Split-brain state detected: ...',
        user_safe_message: 'Evaluation paused while synchronizing progress.',
        created_at: '2026-06-05T12:00:00.000Z',
        updated_at: '2026-06-05T12:01:00.000Z',
      },
      { fetchFn: fetchMock as unknown as typeof fetch },
    );

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(requestInit.body));

    expect(parsedBody.to).toBe(REVISIONGRADE_SUPPORT_EMAIL);
    expect(parsedBody.subject).toBe(
      '[RevisionGrade] Evaluation recovery alert: SPLIT_BRAIN:HEALABLE:job-123:phase_3:queued:phase_2:complete',
    );

    const textBody = String(parsedBody.text);
    expect(textBody).toContain('job_id: job-123');
    expect(textBody).toContain('manuscript_id: 77');
    expect(textBody).toContain('user_id: user-abc');
    expect(textBody).toContain('phase: phase_3');
    expect(textBody).toContain('phase_status: queued');
    expect(textBody).toContain('progress.phase: phase_2');
    expect(textBody).toContain('progress.phase_status: complete');
    expect(textBody).toContain('recovery_key: SPLIT_BRAIN:HEALABLE:job-123:phase_3:queued:phase_2:complete');
    expect(textBody).toContain('recovery_action: repair_to_expected_handoff');
    expect(textBody).toContain('internal_diagnosis: Split-brain state detected: ...');
    expect(textBody).toContain('user_safe_message: Evaluation paused while synchronizing progress.');
    expect(textBody).toContain('created_at: 2026-06-05T12:00:00.000Z');
    expect(textBody).toContain('updated_at: 2026-06-05T12:01:00.000Z');
  });

  test('missing provider config logs warning and does not throw', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendRecoverySupportAlert({
      job_id: 'job-no-key',
      recovery_key: 'SPLIT_BRAIN:STRUCTURAL:job-no-key',
      recovery_action: 'halt_for_engineering_review',
      internal_diagnosis: 'Split-brain state detected: ...',
      user_safe_message: 'Evaluation paused while synchronizing progress.',
    });

    expect(result.sent).toBe(false);
    expect(result.attempted).toBe(false);
    expect(result.error).toMatch(/RESEND_API_KEY/i);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('failed evaluation alert emails only job id and failure type to support', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const result = await sendEvaluationFailureSupportAlert(
      {
        job_id: '1dce7039-674d-44d6-b647-0742e0e696ec',
        manuscript_id: 7497,
        user_id: 'user-should-not-be-emailed',
        phase: 'phase_3',
        phase_status: 'failed',
        progress_phase: 'phase_3',
        progress_phase_status: 'failed',
        failure_code: 'TEMPLATE_COMPLETENESS_GATE_FAILED',
        failure_message: 'internal failure details should stay in admin diagnostics',
        source: 'processor',
        pipeline_stage: 'template_completeness_gate',
        retry_eligible: false,
        diagnostics: {
          violations: [{ code: 'MISSING_TARGET_AUDIENCE', message: 'do not email this' }],
        },
        created_at: '2026-06-06T22:49:06.845Z',
        updated_at: '2026-06-06T22:57:26.953Z',
      },
      { fetchFn: fetchMock as unknown as typeof fetch },
    );

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(requestInit.body));

    expect(parsedBody.to).toBe(REVISIONGRADE_SUPPORT_EMAIL);
    expect(parsedBody.subject).toBe(
      '[RevisionGrade] Evaluation failed: TEMPLATE_COMPLETENESS_GATE_FAILED (1dce7039…)',
    );
    expect(parsedBody.text).toBe(
      'job_id: 1dce7039-674d-44d6-b647-0742e0e696ec\n' +
        'failure_type: TEMPLATE_COMPLETENESS_GATE_FAILED',
    );
    expect(String(parsedBody.text)).not.toContain('user-should-not-be-emailed');
    expect(String(parsedBody.text)).not.toContain('MISSING_TARGET_AUDIENCE');
    expect(String(parsedBody.text)).not.toContain('internal failure details');
  });

  test('major issue user alert emails the login address with short proforma copy and job id', async () => {
    process.env.RESEND_API_KEY = 'test-key';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const result = await sendEvaluationMajorIssueUserAlert(
      {
        job_id: '1dce7039-674d-44d6-b647-0742e0e696ec',
        manuscript_id: 7497,
        user_email: 'Writer@Example.com',
      },
      { fetchFn: fetchMock as unknown as typeof fetch },
    );

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(requestInit.body));

    expect(parsedBody.to).toBe('writer@example.com');
    expect(parsedBody.subject).toBe('[RevisionGrade] Evaluation support update: 1dce7039…');
    expect(parsedBody.text).toContain('Job ID: 1dce7039-674d-44d6-b647-0742e0e696ec');
    expect(parsedBody.text).toContain('Manuscript ID: 7497');
    expect(parsedBody.text).toContain('Engineering support has been alerted and is investigating');
    expect(parsedBody.text).toContain('We will email you again when the problem has been fixed.');
    expect(parsedBody.text).not.toContain('PROCESSOR_UNCAUGHT_ERROR');
    expect(parsedBody.text).not.toContain('created_at=');
  });

  test('unsafe user message is sanitized before exposure', () => {
    const safe = toUserSafeRecoveryMessage('Split-brain state detected: internal mismatch details');
    expect(safe).not.toMatch(/split-brain/i);

    const passthrough = toUserSafeRecoveryMessage('Evaluation paused while synchronizing progress.');
    expect(passthrough).toBe('Evaluation paused while synchronizing progress.');
  });
});
