export {};

import {
  sendCompletenessAlertEmail,
  TEMPLATE_COMPLETENESS_FAILURE_CODE,
  type TemplateViolation,
} from '@/lib/evaluation/pipeline/templateCompletenessGate';
import { REVISIONGRADE_SUPPORT_EMAIL } from '@/lib/evaluation/hardStopGovernance';

describe('template completeness support alert email', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, RESEND_API_KEY: 'test-key' };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('emails only job id and failure type; violation details remain admin-only', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    } as Response);

    const violations: TemplateViolation[] = [
      {
        code: 'MISSING_TARGET_AUDIENCE',
        message: 'This detailed validator output belongs in admin diagnostics, not email.',
        severity: 'critical',
      },
    ];

    const result = await sendCompletenessAlertEmail(
      '1dce7039-674d-44d6-b647-0742e0e696ec',
      violations,
    );

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(requestInit.body));

    expect(parsedBody.to).toEqual([REVISIONGRADE_SUPPORT_EMAIL]);
    expect(parsedBody.subject).toBe(
      `[RevisionGrade] Evaluation failed: ${TEMPLATE_COMPLETENESS_FAILURE_CODE} (1dce7039…)`,
    );
    expect(parsedBody.text).toBe(
      'job_id: 1dce7039-674d-44d6-b647-0742e0e696ec\n' +
        `failure_type: ${TEMPLATE_COMPLETENESS_FAILURE_CODE}`,
    );
    expect(parsedBody.html).toBeUndefined();
    expect(String(parsedBody.text)).not.toContain('MISSING_TARGET_AUDIENCE');
    expect(String(parsedBody.text)).not.toContain('validator output');
  });
});