/**
 * @jest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { CancelEvaluationButton } from '@/components/evaluation/CancelEvaluationButton';

describe('CancelEvaluationButton', () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;
  const assign = jest.fn();

  beforeAll(() => {
    delete (window as unknown as { location?: Location }).location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  test('uses Keep Evaluation before cancellation', () => {
    render(<CancelEvaluationButton jobId="job-1" returnHref="/evaluate" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Evaluation' }));

    expect(screen.getByRole('button', { name: 'Keep Evaluation' })).toBeTruthy();
  });

  test('forces a fresh evaluations navigation after confirmed cancellation', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;

    render(<CancelEvaluationButton jobId="job-1" returnHref="/evaluate" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Evaluation' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel Evaluation' })[1]);

    expect(await screen.findByRole('button', { name: 'Return to Evaluations' })).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(assign).toHaveBeenCalledWith('/evaluate');
  });

  test('error return forces a fresh evaluations navigation', async () => {
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

    expect(assign).toHaveBeenCalledWith('/evaluate');
  });
});
