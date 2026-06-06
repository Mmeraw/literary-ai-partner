/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CancelEvaluationButton } from '@/components/evaluation/CancelEvaluationButton';

const push = jest.fn();
const refresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

describe('CancelEvaluationButton', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('uses Keep Evaluation before cancellation', () => {
    render(<CancelEvaluationButton jobId="job-1" returnHref="/evaluate" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Evaluation' }));

    expect(screen.getByRole('button', { name: 'Keep Evaluation' })).toBeTruthy();
  });

  test('redirects to evaluations after confirmed cancellation and shows Return to Evaluations copy', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;

    render(<CancelEvaluationButton jobId="job-1" returnHref="/evaluate" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Evaluation' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel Evaluation' })[1]);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/evaluate'));
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Return to Evaluations' })).toBeTruthy();
  });

  test('error close returns to evaluations instead of staying on stalled page', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Cancellation could not be saved.' }),
    }) as unknown as typeof fetch;

    render(<CancelEvaluationButton jobId="job-1" returnHref="/evaluate" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Evaluation' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel Evaluation' })[1]);

    const returnButton = await screen.findByRole('button', { name: 'Return to Evaluations' });
    fireEvent.click(returnButton);

    expect(push).toHaveBeenCalledWith('/evaluate');
    expect(refresh).toHaveBeenCalled();
  });
});
