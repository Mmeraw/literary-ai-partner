import { NextRequest } from 'next/server';
import { GET } from '@/app/api/jobs/[jobId]/route';
import { getJob } from '@/lib/jobs/store';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { canViewEvaluationOperationalDetails } from '@/lib/auth/evaluationOperationalAccess';

jest.mock('@/lib/jobs/store', () => ({
  getJob: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/auth/evaluationOperationalAccess', () => ({
  canViewEvaluationOperationalDetails: jest.fn(),
}));

jest.mock('@/lib/evaluation/processor', () => ({
  isTerminalFailureCode: jest.fn((code: string | null | undefined) => (
    code === 'USER_CANCELLED' || code === 'TECHNICAL_FAILURE_REQUIRES_REVIEW'
  )),
}));

jest.mock('@/lib/evaluation/recoverySupportAlertMailer', () => ({
  MAJOR_TECHNICAL_ISSUE_PUBLIC_MESSAGE:
    'We hit a technical issue that needs engineering support. Our team has been alerted and is investigating. Your manuscript and completed analysis have been preserved; you do not need to retry. We will notify you by email when the problem has been fixed.',
}));

const mockGetJob = getJob as jest.MockedFunction<typeof getJob>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCanViewEvaluationOperationalDetails = canViewEvaluationOperationalDetails as jest.MockedFunction<typeof canViewEvaluationOperationalDetails>;

describe('GET /api/jobs/[jobId] public failure messaging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1', email: 'writer@example.com' } as never);
    mockCanViewEvaluationOperationalDetails.mockReturnValue(false);
  });

  test('hides raw recoverable failure internals from non-operator users', async () => {
    mockGetJob.mockResolvedValue({
      id: 'job-public-safe',
      user_id: 'user-1',
      manuscript_id: 123,
      job_type: 'full_evaluation',
      status: 'failed',
      phase: 'phase_3',
      phase_status: 'failed',
      progress: {
        phase: 'phase_3',
        phase_status: 'failed',
        recovery_message: 'Evaluation delayed — recovery is in progress. Your manuscript and completed analysis have been preserved.',
      },
      total_units: 100,
      completed_units: 98,
      failed_units: 0,
      last_error: 'Global pipeline SLA exceeded for non-terminal job: created_at=2026-06-07T00:56:18.322738+00:00.',
      failure_code: 'PROCESSOR_UNCAUGHT_ERROR',
      created_at: '2026-06-07T00:56:18.322Z',
      updated_at: '2026-06-07T01:06:36.045Z',
    } as never);

    const response = await GET(
      new NextRequest('https://example.test/api/jobs/job-public-safe'),
      { params: Promise.resolve({ jobId: 'job-public-safe' }) },
    );
    const json = await response.json() as {
      ok: true;
      job: {
        public_status_message?: string;
        last_error?: string;
        failure_code?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(json.job.public_status_message).toBe('Evaluation delayed — recovery is in progress. Your manuscript and completed analysis have been preserved.');
    expect(json.job.public_status_message).not.toContain('created_at=');
    expect(json.job.last_error).toBeUndefined();
    expect(json.job.failure_code).toBeUndefined();
  });

  test('shows stop-gap engineering support message for technical review failures without leaking internals', async () => {
    mockGetJob.mockResolvedValue({
      id: 'job-technical-review',
      user_id: 'user-1',
      manuscript_id: 123,
      job_type: 'full_evaluation',
      status: 'failed',
      phase: 'phase_3',
      phase_status: 'failed',
      progress: {
        phase: 'phase_3',
        phase_status: 'failed',
        dashboard_status: 'technical_review_required',
        recovery_message: 'We hit a technical issue that needs engineering support. Our team has been alerted and is investigating. Your manuscript and completed analysis have been preserved; you do not need to retry. We will notify you by email when the problem has been fixed.',
      },
      total_units: 100,
      completed_units: 98,
      failed_units: 0,
      last_error: 'Self-recovery exhausted for PROCESSOR_UNCAUGHT_ERROR created_at=2026-06-07T00:56:18.322738+00:00.',
      failure_code: 'TECHNICAL_FAILURE_REQUIRES_REVIEW',
      created_at: '2026-06-07T00:56:18.322Z',
      updated_at: '2026-06-07T01:06:36.045Z',
    } as never);

    const response = await GET(
      new NextRequest('https://example.test/api/jobs/job-technical-review'),
      { params: Promise.resolve({ jobId: 'job-technical-review' }) },
    );
    const json = await response.json() as {
      ok: true;
      job: {
        public_status_message?: string;
        last_error?: string;
        failure_code?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(json.job.public_status_message).toContain('engineering support');
    expect(json.job.public_status_message).toContain('We will notify you by email when the problem has been fixed');
    expect(json.job.public_status_message).not.toContain('PROCESSOR_UNCAUGHT_ERROR');
    expect(json.job.public_status_message).not.toContain('created_at=');
    expect(json.job.last_error).toBeUndefined();
    expect(json.job.failure_code).toBeUndefined();
  });
});
