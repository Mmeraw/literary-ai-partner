/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EvaluationUnavailableReloadButton from '@/components/evaluation/EvaluationUnavailableReloadButton';

const refresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('EvaluationUnavailableReloadButton', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('probes the job API, invokes queued job kickoff, and refreshes the page', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, job: { status: 'queued' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ success: true, message: 'Evaluation recovery has been restarted.' }),
      }) as unknown as typeof fetch;

    render(<EvaluationUnavailableReloadButton jobId="job-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/jobs/job-1', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/jobs/job-1/resume', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    expect(refresh).toHaveBeenCalled();
  });

  test('refreshes immediately when the job is already complete', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, job: { status: 'complete' } }),
    }) as unknown as typeof fetch;

    render(<EvaluationUnavailableReloadButton jobId="job-2" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalled();
  });

  test('still refreshes and shows feedback when the status API cannot access the job', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ ok: false, error: 'Job not found' }),
    }) as unknown as typeof fetch;

    render(<EvaluationUnavailableReloadButton jobId="job-3" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(await screen.findByText(/Job not found/i)).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });
});
